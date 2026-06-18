/**
 * Download a stored object as a Buffer by storage key.
 * Tries R2 GetObject first (private bucket), then storageGet presigned URL.
 */
import https from "https";
import http from "http";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { storageGet } from "../storage";

let _r2Client: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (_r2Client) return _r2Client;
  const accountId = process.env.CF_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _r2Client;
}

function getR2Bucket(): string {
  return process.env.CF_R2_BUCKET_NAME || "ultrasound-assist";
}

function isStorageProxyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.searchParams.has("path")) return true;
    if (u.pathname.includes("/v1/storage/")) return true;
    return false;
  } catch {
    return false;
  }
}

async function readR2Object(key: string): Promise<Buffer | null> {
  const r2 = getR2Client();
  if (!r2) return null;
  try {
    const obj = await r2.send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    if (!obj.Body) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of obj.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

function fetchUrlBuffer(targetUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const follow = (url: string, redirects = 0): void => {
      if (redirects > 10) {
        reject(new Error("Too many redirects while downloading file"));
        return;
      }
      const proto = url.startsWith("https") ? https : http;
      proto.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(targetUrl);
  });
}

/**
 * Download object bytes for a media-repo key. Prefer s3Key over storedUrl.
 */
export async function downloadStorageObject(s3Key: string, storedUrl?: string): Promise<Buffer> {
  const key = s3Key.replace(/^\/+/, "");
  if (!key) throw new Error("Missing storage key");

  const fromR2 = await readR2Object(key);
  if (fromR2 && fromR2.length > 0) return fromR2;

  let downloadUrl: string | undefined;
  if (storedUrl && !isStorageProxyUrl(storedUrl)) {
    downloadUrl = storedUrl;
  } else {
    const { url } = await storageGet(key);
    downloadUrl = url;
  }

  const buffer = await fetchUrlBuffer(downloadUrl);
  if (buffer.length === 0) throw new Error("Downloaded file is empty");
  return buffer;
}
