/**
 * R2 prefix probes — detect incomplete SCORM extractions (launch HTML only, missing /data assets).
 */
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

/** iSpring/Storyline packages need many files under /data — a lone index.html is not playable. */
export const SCORM_MIN_R2_OBJECT_COUNT = 4;

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

function getBucket(): string | null {
  return process.env.CF_R2_BUCKET_NAME || null;
}

export async function listR2KeysUnderPrefix(prefix: string, maxKeys = 100): Promise<string[]> {
  const client = getR2Client();
  const bucket = getBucket();
  if (!client || !bucket) return [];

  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const keys: string[] = [];
  let continuationToken: string | undefined;

  while (keys.length < maxKeys) {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalized,
        MaxKeys: Math.min(100, maxKeys - keys.length),
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    if (!result.IsTruncated || !result.NextContinuationToken) break;
    continuationToken = result.NextContinuationToken;
  }

  return keys;
}

export async function isR2ScormExtractionPlayable(
  prefix: string,
  launchFile: string,
): Promise<{ playable: boolean; objectCount: number; reason?: string }> {
  const keys = await listR2KeysUnderPrefix(prefix, 50);
  const objectCount = keys.length;

  if (objectCount === 0) {
    return { playable: false, objectCount, reason: "R2 prefix empty" };
  }

  const launchLower = launchFile.toLowerCase();
  const hasLaunch = keys.some((k) => {
    const rel = k.slice(prefix.length).replace(/^\//, "").toLowerCase();
    return rel === launchLower || rel.endsWith(`/${launchLower}`);
  });

  if (!hasLaunch) {
    return { playable: false, objectCount, reason: "Launch file missing from R2 prefix" };
  }

  if (objectCount < SCORM_MIN_R2_OBJECT_COUNT) {
    return {
      playable: false,
      objectCount,
      reason: `R2 extraction incomplete (${objectCount} file${objectCount === 1 ? "" : "s"})`,
    };
  }

  return { playable: true, objectCount };
}
