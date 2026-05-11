import { describe, it, expect } from "vitest";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import mysql from "mysql2/promise";

describe("Mirror Sync Credentials", () => {
  it("should connect to Cloudflare R2 with configured credentials", async () => {
    const accountId = process.env.CF_R2_ACCOUNT_ID;
    const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY;
    const bucket = process.env.CF_R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      console.log("R2 credentials not configured, skipping test");
      return;
    }

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const result = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
    );

    // Should be able to list objects (even if empty)
    expect(result.$metadata.httpStatusCode).toBe(200);
  });

  it("should connect to Railway MySQL with configured credentials", async () => {
    const railwayUrl = process.env.RAILWAY_MYSQL_URL;
    if (!railwayUrl) {
      console.log("Railway MySQL URL not configured, skipping test");
      return;
    }

    const connection = await mysql.createConnection(railwayUrl);
    try {
      const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'railway'");
      const count = (rows as any)[0].cnt;
      expect(count).toBeGreaterThan(0);
    } finally {
      await connection.end();
    }
  });
});
