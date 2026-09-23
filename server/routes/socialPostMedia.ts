import { Router, type Request, type Response } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import http from "node:http";
import https from "node:https";
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

function setImageHeaders(res: Response, mimeType: string) {
  res.setHeader("Content-Type", mimeType.startsWith("image/") ? mimeType : "application/octet-stream");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

async function proxyFromR2(s3Key: string, res: Response): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: process.env.CF_R2_BUCKET_NAME || "ultrasound-assist",
      Key: s3Key,
    }));
    if (!response.Body) return false;
    if (response.ContentType) res.setHeader("Content-Type", response.ContentType);
    if (response.ContentLength) res.setHeader("Content-Length", response.ContentLength);
    (response.Body as NodeJS.ReadableStream).pipe(res);
    return true;
  } catch (error: any) {
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

function proxyFromStoredUrl(url: string, res: Response): Promise<boolean> {
  return new Promise((resolve) => {
    const safeUrl = url.replace(/ /g, "%20");
    const client = safeUrl.startsWith("https:") ? https : http;
    const request = client.get(safeUrl, (upstream) => {
      const status = upstream.statusCode ?? 502;
      if (status < 200 || status >= 300) {
        upstream.resume();
        resolve(false);
        return;
      }
      const length = upstream.headers["content-length"];
      if (length) res.setHeader("Content-Length", length);
      const contentType = upstream.headers["content-type"];
      if (typeof contentType === "string" && contentType.startsWith("image/")) {
        res.setHeader("Content-Type", contentType);
      }
      upstream.pipe(res);
      resolve(true);
    });
    request.on("error", () => resolve(false));
  });
}

/**
 * Serves a private Media Repository image to an authenticated Platform Admin.
 * The same-origin URL prevents private CDN/CORS restrictions from blanking a
 * Social Post card preview or tainting its PNG/MP4 export canvas.
 */
router.get("/api/social-post-media/:assetId", async (req: Request, res: Response) => {
  const user = await authenticatePlatformMediaAdmin(req);
  if (!user) {
    res.status(401).json({ error: "Platform admin authentication is required" });
    return;
  }

  const assetId = Number(req.params.assetId);
  const brand = req.query.brand === "iheartecho" ? "iheartecho" : "aaus";
  if (!Number.isInteger(assetId) || assetId <= 0) {
    res.status(400).json({ error: "A valid media asset ID is required" });
    return;
  }

  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Media storage is temporarily unavailable" });
    return;
  }

  const [asset] = await db
    .select({
      id: mediaAssets.id,
      brand: mediaAssets.brand,
      mediaType: mediaAssets.mediaType,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, assetId), isNull(mediaAssets.deletedAt)))
    .limit(1);

  if (!asset || asset.brand !== brand || asset.mediaType !== "image") {
    res.status(404).json({ error: "Image asset not found for this brand" });
    return;
  }

  const [version] = await db
    .select({
      s3Key: mediaVersions.s3Key,
      s3Url: mediaVersions.s3Url,
      mimeType: mediaVersions.mimeType,
    })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);

  if (!version?.s3Url) {
    res.status(404).json({ error: "Image file not found" });
    return;
  }

  setImageHeaders(res, version.mimeType ?? asset.mimeType ?? "application/octet-stream");
  try {
    const servedFromUrl = await proxyFromStoredUrl(version.s3Url, res);
    if (servedFromUrl) return;
    if (version.s3Key && await proxyFromR2(version.s3Key, res)) return;
    if (!res.headersSent) res.status(502).json({ error: "Unable to load image from storage" });
  } catch {
    if (!res.headersSent) res.status(502).json({ error: "Unable to load image from storage" });
  }
});

export function registerSocialPostMediaRoute(app: import("express").Application) {
  app.use(router);
}
