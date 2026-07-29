// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)
// Also supports dual-write to Cloudflare R2 for mirroring

import { ENV } from './_core/env';
import {
  S3Client,
  PutObjectCommand,
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

// ── R2 Dual-Write Support ──────────────────────────────────────────────────────

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

/**
 * Mirror a file upload to Cloudflare R2 (fire-and-forget).
 * This runs in the background and does not block the primary upload.
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
    // Don't fail the primary upload if R2 mirror fails
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
  const r2PublicUrl = process.env.CF_R2_PUBLIC_URL;

  if (!client || !r2PublicUrl) {
    // Fall back to regular storagePut if R2 is not configured
    console.warn("[StorageLarge] R2 not configured, falling back to storagePut");
    return storagePut(relKey, data, contentType);
  }

  const key = normalizeKey(relKey);
  const body = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const PART_SIZE = 10 * 1024 * 1024; // 10 MB per part

  // Initiate multipart upload
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

    // Complete the multipart upload
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      })
    );
  } catch (err) {
    // Abort the multipart upload on error to avoid orphaned parts
    await client.send(
      new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
    ).catch(() => {});
    throw err;
  }

  const url = `${r2PublicUrl.replace(/\/+$/, "")}/${key}`;
  console.log(`[StorageLarge] R2 multipart upload complete: ${url}`);
  return { key, url };
}

// ── Primary Storage Operations ─────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
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

  // Fire-and-forget: mirror to R2 in background
  mirrorToR2(key, data, contentType).catch(() => {});

  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * storagePutStream — upload a file from a local path to storage.
 * Used by scormUploadRoutes for large ZIP file uploads.
 */
export async function storagePutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { readFileSync } = await import("fs");
  const data = readFileSync(filePath);
  return storagePut(relKey, data, contentType);
}

export async function storageDelete(relKey: string): Promise<void> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(baseUrl));
  deleteUrl.searchParams.set("path", key);
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: buildAuthHeaders(apiKey),
  });
  // 404 is acceptable — file may already be gone
  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage delete failed (${response.status}): ${message}`);
  }

  // Also delete from R2 (fire-and-forget)
  const client = getR2Client();
  if (client) {
    import("@aws-sdk/client-s3").then(({ DeleteObjectCommand }) => {
      client.send(new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }))
        .catch((err: any) => console.error(`[R2Mirror] Failed to delete ${key}: ${err.message}`));
    }).catch(() => {});
  }
}
