/**
 * SCORM → Question Bank import without loading multi-hundred-MB ZIPs into RAM.
 * Uses R2 extracted prefix when available; falls back to buffer for small packages.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import unzipper from "unzipper";
import { mediaVersions } from "../../drizzle/schema";
import { getDb } from "../db";
import { parseISpringQuizFromBuffer, parseQuizFromHtml, type ParsedQuiz } from "./iSpringQuizParser";
import {
  SCORM_BACKGROUND_EXTRACT_BYTES,
  shouldUseBackgroundScormExtraction,
} from "./scormPackage";
import { downloadStorageObject } from "./downloadStorageObject";
import { loadLatestMediaVersionBuffer } from "./loadMediaVersionBuffer";

export type ZipEntryLike = { entryName: string; getData: () => Buffer };

export interface ScormImportSource {
  parsed: ParsedQuiz;
  zipEntries: ZipEntryLike[];
  extractedPrefix?: string;
}

type MediaVersionRow = {
  id: number;
  s3Key: string;
  s3Url: string;
  fileSize: number | null;
  scormExtractedPrefix: string | null;
  scormLaunchFile: string | null;
  scormExtractionStatus: string | null;
  scormExtractionError: string | null;
};

async function getLatestVersion(assetId: number): Promise<MediaVersionRow> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [version] = await db
    .select({
      id: mediaVersions.id,
      s3Key: mediaVersions.s3Key,
      s3Url: mediaVersions.s3Url,
      fileSize: mediaVersions.fileSize,
      scormExtractedPrefix: mediaVersions.scormExtractedPrefix,
      scormLaunchFile: mediaVersions.scormLaunchFile,
      scormExtractionStatus: mediaVersions.scormExtractionStatus,
      scormExtractionError: mediaVersions.scormExtractionError,
    })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, assetId))
    .orderBy(sql`${mediaVersions.versionNumber} DESC`)
    .limit(1);

  if (!version?.s3Key) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No version found for this asset" });
  }
  return version;
}

function extractionWaitMessage(status: string | null, extractionError?: string | null): string {
  if (status === "processing") {
    return "This SCORM package is still being extracted (large files can take 30+ minutes). Please wait and try again.";
  }
  if (status === "pending") {
    return "This SCORM package is queued for extraction. Please wait a few minutes and try again, or click Re-extract in Media Repository.";
  }
  if (status === "failed") {
    const detail = extractionError ? ` Error: ${extractionError}` : "";
    return `SCORM extraction failed for this package. Open the asset in Media Repository and click Re-extract, then try again.${detail}`;
  }
  return "This SCORM package must be extracted before questions can be imported. Use Re-extract in Media Repository.";
}

async function parseFromExtractedPrefix(version: MediaVersionRow): Promise<ScormImportSource> {
  const prefix = version.scormExtractedPrefix!.replace(/\/$/, "");
  const launchFile = version.scormLaunchFile || "index.html";
  const launchKey = `${prefix}/${launchFile}`.replace(/\/+/g, "/");

  let html: string;
  try {
    const buf = await downloadStorageObject(launchKey);
    html = buf.toString("utf8");
  } catch (err: any) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Could not read extracted quiz file (${launchFile}): ${err?.message ?? "unknown error"}`,
    });
  }

  let parsed: ParsedQuiz;
  try {
    parsed = parseQuizFromHtml(html);
  } catch (e: any) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
  }

  return { parsed, zipEntries: [], extractedPrefix: prefix };
}

/** Parse quiz + image source for question bank import. */
export async function loadScormImportFromMediaAsset(mediaAssetId: number): Promise<ScormImportSource> {
  const version = await getLatestVersion(mediaAssetId);
  const fileSize = version.fileSize ?? 0;
  const prefix = version.scormExtractedPrefix;
  const status = version.scormExtractionStatus ?? "pending";
  const useBackground = shouldUseBackgroundScormExtraction({
    fileSize,
    scormExtractionStatus: status,
  });

  if (prefix && !prefix.startsWith("__direct_html__:") && status === "done") {
    return parseFromExtractedPrefix(version);
  }

  if (useBackground) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        extractionWaitMessage(status, version.scormExtractionError) +
        (fileSize > SCORM_BACKGROUND_EXTRACT_BYTES
          ? ` (Package size: ${(fileSize / 1024 / 1024).toFixed(0)} MB)`
          : ""),
    });
  }

  const zipBuffer = await loadLatestMediaVersionBuffer(mediaAssetId);
  let parsed: ParsedQuiz;
  try {
    parsed = await parseISpringQuizFromBuffer(zipBuffer);
  } catch (e: any) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
  }

  const AdmZip = (await import("adm-zip")).default;
  const zipEntries = new AdmZip(zipBuffer).getEntries();
  return { parsed, zipEntries };
}

export async function loadScormImportFromBase64(bufferBase64: string): Promise<ScormImportSource> {
  const zipBuffer = Buffer.from(bufferBase64, "base64");
  if (!zipBuffer.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "SCORM file data is empty" });
  }

  if (zipBuffer.length > SCORM_BACKGROUND_EXTRACT_BYTES) {
    const tmpPath = path.join(os.tmpdir(), `scorm-qb-import-${Date.now()}.zip`);
    try {
      fs.writeFileSync(tmpPath, zipBuffer);
      const directory = await unzipper.Open.file(tmpPath);
      const indexEntry =
        directory.files.find((f) => f.path.toLowerCase().endsWith("index.html")) ??
        directory.files.find((f) => f.path.toLowerCase().includes("index.html"));
      if (!indexEntry) throw new Error("index.html not found in SCORM ZIP");

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        indexEntry
          .stream()
          .on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
          .on("end", resolve)
          .on("error", reject);
      });
      const parsed = parseQuizFromHtml(Buffer.concat(chunks).toString("utf8"));

      const zipEntries: ZipEntryLike[] = await Promise.all(
        directory.files
          .filter((f) => f.type === "File")
          .map(async (f) => {
            const chunks: Buffer[] = [];
            await new Promise<void>((resolve, reject) => {
              f.stream()
                .on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
                .on("end", resolve)
                .on("error", reject);
            });
            const data = Buffer.concat(chunks);
            return { entryName: f.path, getData: () => data };
          })
      );
      return { parsed, zipEntries };
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  let parsed: ParsedQuiz;
  try {
    parsed = await parseISpringQuizFromBuffer(zipBuffer);
  } catch (e: any) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Not a valid iSpring quiz: ${e.message}` });
  }
  const AdmZip = (await import("adm-zip")).default;
  return { parsed, zipEntries: new AdmZip(zipBuffer).getEntries() };
}
