import { Readable } from "node:stream";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { authenticatePlatformMediaAdmin } from "../lib/platformMediaAuth";

const router = Router();

let r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (r2Client) return r2Client;
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return r2Client;
}

function setAudioHeaders(res: Response, mimeType: string) {
  res.setHeader("Content-Type", mimeType.startsWith("audio/") ? mimeType : "audio/mpeg");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function copyRangeHeaders(
  res: Response,
  headers: { get(name: string): string | null },
) {
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = headers.get(name);
    if (value) res.setHeader(name, value);
  }
}

async function proxyStoredAudio(url: string, req: Request, res: Response): Promise<boolean> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return false;

  const headers = new Headers();
  if (typeof req.headers.range === "string") headers.set("Range", req.headers.range);
  const upstream = await fetch(target, { headers, redirect: "follow" });
  if (!upstream.ok || !upstream.body) return false;

  res.status(upstream.status);
  const contentType = upstream.headers.get("content-type");
  if (contentType?.startsWith("audio/")) res.setHeader("Content-Type", contentType);
  copyRangeHeaders(res, upstream.headers);
  Readable.fromWeb(upstream.body as never).pipe(res);
  return true;
}

async function proxyR2Audio(s3Key: string, req: Request, res: Response): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    const object = await client.send(new GetObjectCommand({
      Bucket: process.env.CF_R2_BUCKET_NAME || "ultrasound-assist",
      Key: s3Key,
      Range: typeof req.headers.range === "string" ? req.headers.range : undefined,
    }));
    if (!object.Body) return false;

    res.status(object.ContentRange ? 206 : 200);
    if (object.ContentType?.startsWith("audio/")) res.setHeader("Content-Type", object.ContentType);
    if (object.ContentLength != null) res.setHeader("Content-Length", object.ContentLength);
    if (object.ContentRange) res.setHeader("Content-Range", object.ContentRange);
    res.setHeader("Accept-Ranges", "bytes");
    (object.Body as NodeJS.ReadableStream).pipe(res);
    return true;
  } catch (error: any) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

/**
 * Streams a private Media Repository audio asset to an authenticated Platform
 * Admin from the application origin. This lets the browser obtain raw bytes for
 * WebCodecs MP4 encoding without exposing the R2/Forge object URL or relying on
 * object-storage CORS configuration.
 */
router.get("/api/card-export-audio/:assetId", async (req: Request, res: Response) => {
  const user = await authenticatePlatformMediaAdmin(req);
  if (!user) {
    res.status(401).json({ error: "Platform admin authentication is required." });
    return;
  }

  const assetId = Number(req.params.assetId);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) {
    res.status(400).json({ error: "A valid audio asset ID is required." });
    return;
  }

  try {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Audio storage is temporarily unavailable." });
      return;
    }

    const [asset] = await db
      .select({ id: mediaAssets.id, mediaType: mediaAssets.mediaType, mimeType: mediaAssets.mimeType })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), isNull(mediaAssets.deletedAt)))
      .limit(1);
    if (!asset || asset.mediaType !== "audio") {
      res.status(404).json({ error: "Audio asset not found." });
      return;
    }

    const [version] = await db
      .select({ s3Key: mediaVersions.s3Key, s3Url: mediaVersions.s3Url, mimeType: mediaVersions.mimeType })
      .from(mediaVersions)
      .where(eq(mediaVersions.assetId, asset.id))
      .orderBy(desc(mediaVersions.versionNumber))
      .limit(1);
    if (!version || (!version.s3Url && !version.s3Key)) {
      res.status(404).json({ error: "Audio file not found." });
      return;
    }

    setAudioHeaders(res, version.mimeType ?? asset.mimeType ?? "audio/mpeg");
    if (version.s3Url && await proxyStoredAudio(version.s3Url, req, res)) return;
    if (version.s3Key && await proxyR2Audio(version.s3Key, req, res)) return;
    if (!res.headersSent) res.status(502).json({ error: "Audio file could not be loaded from storage." });
  } catch (error) {
    console.error("[card-export-audio] proxy failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(502).json({ error: "Audio file could not be loaded." });
    else res.end();
  }
});

export function registerCardExportAudioRoute(app: import("express").Application) {
  app.use(router);
}
