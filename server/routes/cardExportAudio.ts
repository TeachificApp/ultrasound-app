import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getDb } from "../db";
import { mediaAssets, mediaVersions } from "../../drizzle/schema";
import { authenticatePlatformMediaAdmin } from "../lib/platformMediaAuth";

const router = Router();
const execFileAsync = promisify(execFile);
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_AUDIO_BYTES = 32 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 60;
const FFMPEG_TIMEOUT_MS = 180_000;
const CARD_EXPORT_FRAME_RATE = 30;
const ALLOWED_MUX_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "application/octet-stream",
]);
const ALLOWED_MUX_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "application/octet-stream",
]);

const uploadMuxPayload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_UPLOAD_BYTES + MAX_AUDIO_BYTES },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

function ffmpegBinary() {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

function ffprobeBinary() {
  return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

let r2Client: S3Client | null = null;

type StoredAudio = {
  asset: { id: number; mediaType: string; mimeType: string | null };
  version: { s3Key: string | null; s3Url: string | null; mimeType: string | null };
};

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

async function getStoredAudio(assetId: number): Promise<StoredAudio | null> {
  const db = await getDb();
  if (!db) throw new Error("Audio storage is temporarily unavailable.");

  const [asset] = await db
    .select({ id: mediaAssets.id, mediaType: mediaAssets.mediaType, mimeType: mediaAssets.mimeType })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, assetId), isNull(mediaAssets.deletedAt)))
    .limit(1);
  if (!asset || asset.mediaType !== "audio") return null;

  const [version] = await db
    .select({ s3Key: mediaVersions.s3Key, s3Url: mediaVersions.s3Url, mimeType: mediaVersions.mimeType })
    .from(mediaVersions)
    .where(eq(mediaVersions.assetId, asset.id))
    .orderBy(desc(mediaVersions.versionNumber))
    .limit(1);
  if (!version || (!version.s3Url && !version.s3Key)) return null;
  return { asset, version };
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

async function writeLimitedStream(
  source: NodeJS.ReadableStream,
  destination: string,
  maximumBytes: number,
): Promise<void> {
  let receivedBytes = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length;
      if (receivedBytes > maximumBytes) {
        callback(new Error("The selected audio file exceeds the export size limit."));
        return;
      }
      callback(null, chunk);
    },
  });
  await pipeline(source, limit, createWriteStream(destination, { flags: "wx" }));
}

async function downloadStoredAudio(stored: StoredAudio, destination: string): Promise<void> {
  const client = getR2Client();
  if (stored.version.s3Key && client) {
    const object = await client.send(new GetObjectCommand({
      Bucket: process.env.CF_R2_BUCKET_NAME || "ultrasound-assist",
      Key: stored.version.s3Key,
    }));
    if (object.Body) {
      if (object.ContentLength != null && object.ContentLength > MAX_AUDIO_BYTES) {
        throw new Error("The selected audio file exceeds the export size limit.");
      }
      await writeLimitedStream(object.Body as NodeJS.ReadableStream, destination, MAX_AUDIO_BYTES);
      return;
    }
  }

  if (!stored.version.s3Url) throw new Error("Audio file could not be loaded from storage.");
  const upstream = await fetch(stored.version.s3Url, { redirect: "follow" });
  const contentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (!upstream.ok || !upstream.body || (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES)) {
    throw new Error("Audio file could not be loaded from storage.");
  }
  await writeLimitedStream(Readable.fromWeb(upstream.body as never), destination, MAX_AUDIO_BYTES);
}

function isH264VideoCodec(codecName: string | undefined): boolean {
  const normalized = (codecName ?? "").toLowerCase();
  return normalized === "h264" || normalized === "avc1" || normalized.startsWith("avc");
}

type VideoProbe = {
  duration: number;
  videoCodec?: string;
};

async function probeVideoFile(videoPath: string): Promise<VideoProbe> {
  const { stdout } = await execFileAsync(ffprobeBinary(), [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name",
    "-of", "json",
    videoPath,
  ], { timeout: 15_000, maxBuffer: 1_000_000 });
  const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string }> };
  const duration = Number(probe.format?.duration ?? 0);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  return { duration, videoCodec: video?.codec_name };
}

async function validateBrowserMp4(videoPath: string): Promise<void> {
  const { duration, videoCodec } = await probeVideoFile(videoPath);
  if (!isH264VideoCodec(videoCodec) || !Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error("The generated MP4 could not be validated for audio export.");
  }
}

async function transcodeVideoToH264(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(ffmpegBinary(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-vf", `fps=${CARD_EXPORT_FRAME_RATE}`,
      "-c:v", "libx264", "-preset", "fast", "-crf", "20",
      "-pix_fmt", "yuv420p", "-r", String(CARD_EXPORT_FRAME_RATE), "-fps_mode", "cfr",
      "-movflags", "+faststart",
      "-an", outputPath,
    ], { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 1_000_000 }, (error, _stdout, stderr) => {
      if (error) {
        console.error("[card-export-audio] FFmpeg transcode failed", String(stderr ?? "").slice(0, 1000));
        reject(new Error("The recorded card video could not be prepared for export."));
        return;
      }
      resolve();
    }).on("error", () => reject(new Error("The MP4 audio service is temporarily unavailable.")));
  });
}

async function ensureH264Mp4(videoPath: string, workDir: string): Promise<string> {
  const { videoCodec } = await probeVideoFile(videoPath);
  if (isH264VideoCodec(videoCodec)) return videoPath;
  const outputPath = path.join(workDir, "card-h264.mp4");
  await transcodeVideoToH264(videoPath, outputPath);
  return outputPath;
}

async function muxWithFfmpeg(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process = execFile(ffmpegBinary(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", videoPath,
      "-stream_loop", "-1", "-i", audioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
      "-shortest", "-movflags", "+faststart", outputPath,
    ], { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 1_000_000 }, (error, _stdout, stderr) => {
      if (error) {
        console.error("[card-export-audio] FFmpeg mux failed", String(stderr ?? "").slice(0, 1000));
        reject(new Error("The selected audio could not be attached to this MP4."));
        return;
      }
      resolve();
    });
    process.on("error", () => reject(new Error("The MP4 audio service is temporarily unavailable.")));
  });
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
    const stored = await getStoredAudio(assetId);
    if (!stored) {
      res.status(404).json({ error: "Audio asset not found." });
      return;
    }

    setAudioHeaders(res, stored.version.mimeType ?? stored.asset.mimeType ?? "audio/mpeg");
    if (stored.version.s3Url && await proxyStoredAudio(stored.version.s3Url, req, res)) return;
    if (stored.version.s3Key && await proxyR2Audio(stored.version.s3Key, req, res)) return;
    if (!res.headersSent) res.status(502).json({ error: "Audio file could not be loaded from storage." });
  } catch (error) {
    console.error("[card-export-audio] proxy failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(502).json({ error: "Audio file could not be loaded." });
    else res.end();
  }
});

/**
 * Reliably adds AAC audio to the browser-rendered H.264 MP4. Accepts either a
 * verified Media Repository asset ID or a same-session audio upload from the
 * card generator (Platform Admin only). Never fetches arbitrary remote URLs.
 */
router.post("/api/card-export-audio/mux", uploadMuxPayload, async (req: Request, res: Response) => {
  const user = await authenticatePlatformMediaAdmin(req);
  if (!user) {
    res.status(401).json({ error: "Platform admin authentication is required." });
    return;
  }

  const files = req.files as { video?: Express.Multer.File[]; audio?: Express.Multer.File[] } | undefined;
  const videoFile = files?.video?.[0];
  const audioFile = files?.audio?.[0];
  const assetId = Number(req.body?.assetId);

  if (!videoFile || videoFile.size <= 0 || videoFile.size > MAX_VIDEO_UPLOAD_BYTES) {
    res.status(400).json({ error: "A generated MP4 video is required." });
    return;
  }
  if (!ALLOWED_MUX_VIDEO_MIMES.has(videoFile.mimetype)) {
    res.status(400).json({ error: "Unsupported video format for MP4 export." });
    return;
  }
  const hasAssetId = Number.isSafeInteger(assetId) && assetId > 0;
  const hasUploadAudio = Boolean(audioFile && audioFile.size > 0 && audioFile.size <= MAX_AUDIO_BYTES);
  const videoOnlyTranscode = !hasAssetId && !hasUploadAudio;
  if (hasUploadAudio && audioFile && !ALLOWED_MUX_AUDIO_MIMES.has(audioFile.mimetype)) {
    res.status(400).json({ error: "Unsupported audio format for MP4 export." });
    return;
  }

  let workDir: string | null = null;
  try {
    workDir = await fs.mkdtemp(path.join(tmpdir(), "card-audio-mux-"));
    const videoExt = videoFile.mimetype.includes("webm") ? "webm" : "mp4";
    const videoPath = path.join(workDir, `card.${videoExt}`);
    const audioPath = path.join(workDir, "track.audio");
    const outputPath = path.join(workDir, "card-with-audio.mp4");
    await fs.writeFile(videoPath, videoFile.buffer, { flag: "wx" });
    const h264VideoPath = await ensureH264Mp4(videoPath, workDir);
    await validateBrowserMp4(h264VideoPath);
    let muxedVideo: Buffer;
    if (videoOnlyTranscode) {
      muxedVideo = await fs.readFile(h264VideoPath);
    } else {
      if (hasAssetId) {
        const stored = await getStoredAudio(assetId);
        if (!stored) {
          res.status(404).json({ error: "Audio asset not found." });
          return;
        }
        await downloadStoredAudio(stored, audioPath);
      } else {
        await fs.writeFile(audioPath, audioFile!.buffer, { flag: "wx" });
      }
      await muxWithFfmpeg(h264VideoPath, audioPath, outputPath);
      muxedVideo = await fs.readFile(outputPath);
    }
    if (muxedVideo.length === 0 || muxedVideo.length > MAX_VIDEO_UPLOAD_BYTES + MAX_AUDIO_BYTES) {
      throw new Error("The MP4 audio export did not produce a usable file.");
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=card-with-audio.mp4");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(muxedVideo);
  } catch (error) {
    console.error("[card-export-audio] mux failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(502).json({ error: "The selected audio could not be attached to this MP4. Please try again." });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

export function registerCardExportAudioRoute(app: import("express").Application) {
  app.use(router);
}
