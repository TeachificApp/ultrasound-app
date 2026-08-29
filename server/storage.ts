// Storage helpers — Cloudflare R2 (Railway) or Manus Forge (legacy hosting).
// Set STORAGE_BACKEND=r2 on Railway; defaults to auto (R2 when configured).

import { createReadStream, promises as fsPromises, statSync } from "node:fs";
import { ENV } from './_core/env';
import { resolveStorageBackend } from './lib/storageBackend';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function hasForgeCredentials(): boolean {
  return !!(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY);
}

function isStorageAccessDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const name = err instanceof Error ? err.name : "";
  return (
    /access denied|accessdenied|not authorized|forbidden/i.test(msg) ||
    name === "AccessDenied"
  );
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  mirrorToR2(key, data, contentType).catch(() => {});
  return { key, url };
}

// ── R2 Client ──────────────────────────────────────────────────────────────────

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

function getR2Bucket(): string {
  return process.env.CF_R2_BUCKET_NAME || "ultrasound-assist";
}

function buildR2PublicUrl(key: string): string {
  const base = process.env.CF_R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("CF_R2_PUBLIC_URL is not configured");
  return `${base}/${key}`;
}

async function r2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  if (!client) throw new Error("R2 client is not configured");

  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: body as any,
      ContentType: contentType,
    })
  );
  return { key, url: buildR2PublicUrl(key) };
}

async function r2Delete(relKey: string): Promise<void> {
  const client = getR2Client();
  if (!client) throw new Error("R2 client is not configured");

  const key = normalizeKey(relKey);
  await client.send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }));
}

/**
 * Mirror a file upload to Cloudflare R2 (fire-and-forget).
 * Used when Forge is primary and R2 is a secondary mirror.
 */
async function mirrorToR2(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const client = getR2Client();
  if (!client) return;

  try {
    const body = typeof data === "string" ? Buffer.from(data) : data;
    await client.send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: normalizeKey(relKey),
        Body: body as any,
        ContentType: contentType,
      })
    );
    console.log(`[R2Mirror] Uploaded: ${relKey}`);
  } catch (err: any) {
    console.error(`[R2Mirror] Failed to mirror ${relKey}: ${err.message}`);
  }
}

// ── R2 Multipart Upload for Large Files (> 50 MB) ────────────────────────────

/**
 * Upload a large file directly to R2 using multipart upload.
 * Used when the file exceeds the storage proxy limit (~100 MB).
 * Returns the R2 public URL.
 */
export async function storagePutLarge(
  relKey: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  if (!client || !process.env.CF_R2_PUBLIC_URL) {
    console.warn("[StorageLarge] R2 not configured, falling back to storagePut");
    return storagePut(relKey, data, contentType);
  }

  const key = normalizeKey(relKey);
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const PART_SIZE = 10 * 1024 * 1024; // 10 MB per part

  const initResult = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  const uploadId = initResult.UploadId!;

  const parts: { ETag: string; PartNumber: number }[] = [];
  try {
    const totalParts = Math.ceil(body.length / PART_SIZE);
    for (let i = 0; i < totalParts; i++) {
      const start = i * PART_SIZE;
      const end = Math.min(start + PART_SIZE, body.length);
      const partBuffer = body.slice(start, end);
      const partResult = await client.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: i + 1,
          Body: partBuffer,
        })
      );
      parts.push({ ETag: partResult.ETag!, PartNumber: i + 1 });
      console.log(`[StorageLarge] Uploaded part ${i + 1}/${totalParts} for ${key}`);
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (err) {
    await client.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
    ).catch(() => {});
    throw err;
  }

  const url = buildR2PublicUrl(key);
  console.log(`[StorageLarge] R2 multipart upload complete: ${url}`);
  return { key, url };
}

/** Stream a file from disk to storage without loading the full file into RAM. */
export async function storagePutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (resolveStorageBackend() === "r2") {
    return r2PutStream(relKey, filePath, contentType);
  }

  const { size } = statSync(filePath);
  const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;
  const buffer = await fsPromises.readFile(filePath);
  if (size > LARGE_FILE_THRESHOLD) {
    return storagePutLarge(relKey, buffer, contentType);
  }
  return storagePut(relKey, buffer, contentType);
}

async function r2PutStream(
  relKey: string,
  filePath: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  if (!client || !process.env.CF_R2_PUBLIC_URL) {
    throw new Error("R2 is not configured for streaming upload");
  }

  const key = normalizeKey(relKey);
  const bucket = getR2Bucket();
  const { size } = statSync(filePath);
  const PART_SIZE = 10 * 1024 * 1024;

  const initResult = await client.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType })
  );
  const uploadId = initResult.UploadId!;

  const parts: { ETag: string; PartNumber: number }[] = [];
  const stream = createReadStream(filePath);
  let partNumber = 0;
  let buffer = Buffer.alloc(0);

  try {
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      while (buffer.length >= PART_SIZE) {
        partNumber++;
        const partBuffer = buffer.subarray(0, PART_SIZE);
        buffer = buffer.subarray(PART_SIZE);
        const partResult = await client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: partBuffer,
          })
        );
        parts.push({ ETag: partResult.ETag!, PartNumber: partNumber });
      }
    }

    if (buffer.length > 0 || parts.length === 0) {
      partNumber++;
      const partResult = await client.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: buffer,
        })
      );
      parts.push({ ETag: partResult.ETag!, PartNumber: partNumber });
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (err) {
    await client.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
    ).catch(() => {});
    throw err;
  }

  console.log(`[StorageStream] R2 stream upload complete (${size} bytes): ${key}`);
  return { key, url: buildR2PublicUrl(key) };
}

// ── Primary Storage Operations ─────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (resolveStorageBackend() === "r2") {
    try {
      return await r2Put(relKey, data, contentType);
    } catch (err) {
      if (isStorageAccessDeniedError(err) && hasForgeCredentials()) {
        console.warn("[Storage] R2 upload denied; falling back to Forge for", relKey);
        return forgePut(relKey, data, contentType);
      }
      throw err;
    }
  }

  return forgePut(relKey, data, contentType);
}

export type StorageHealthStatus = {
  backend: "r2" | "forge" | "unavailable";
  r2Configured: boolean;
  forgeConfigured: boolean;
  r2Write: "not_checked" | "healthy" | "access_denied" | "failed";
};

/**
 * Performs a minimal write/delete permission probe for administrators.
 * It returns no credentials, bucket names, object keys, URLs, or provider error text.
 */
export async function getStorageHealth(): Promise<StorageHealthStatus> {
  const r2Configured = Boolean(getR2Client() && process.env.CF_R2_PUBLIC_URL);
  const forgeConfigured = hasForgeCredentials();
  let backend: StorageHealthStatus["backend"] = "unavailable";

  try {
    backend = resolveStorageBackend();
  } catch {
    return { backend, r2Configured, forgeConfigured, r2Write: "not_checked" };
  }

  if (backend !== "r2" || !r2Configured) {
    return { backend, r2Configured, forgeConfigured, r2Write: "not_checked" };
  }

  const probeKey = `diagnostics/storage-health-${randomBytes(16).toString("hex")}.txt`;
  try {
    await r2Put(probeKey, "health check", "text/plain");
    try {
      await r2Delete(probeKey);
    } catch {
      // A successful write establishes upload readiness; never reveal delete-provider details.
    }
    return { backend, r2Configured, forgeConfigured, r2Write: "healthy" };
  } catch (error) {
    return {
      backend,
      r2Configured,
      forgeConfigured,
      r2Write: isStorageAccessDeniedError(error) ? "access_denied" : "failed",
    };
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);

  if (resolveStorageBackend() === "r2") {
    return { key, url: buildR2PublicUrl(key) };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);

  if (resolveStorageBackend() === "r2") {
    await r2Delete(relKey);
    return;
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(baseUrl));
  deleteUrl.searchParams.set("path", key);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: buildAuthHeaders(apiKey),
  });
  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage delete failed (${response.status}): ${message}`);
  }

  const client = getR2Client();
  if (client) {
    client.send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }))
      .catch((err: any) => console.error(`[R2Mirror] Failed to delete ${key}: ${err.message}`));
  }
}
