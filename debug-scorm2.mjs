import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
const conn = await createConnection(url);

const [rows] = await conn.execute(
  `SELECT a.id, a.slug, a.mediaType, v.id as vid, v.versionNumber, 
          v.scormExtractionStatus, v.scormExtractedPrefix, v.scormLaunchFile, 
          v.s3Url, v.mimeType, v.fileName
   FROM mediaAssets a 
   JOIN mediaVersions v ON v.assetId = a.id 
   WHERE a.slug IN (
     'unlimited-registry-review-quiz-pediatric-echo-8384d011',
     'unlimited-registry-review-quiz-pediatric-echo-e684dd32'
   )
   ORDER BY a.id, v.versionNumber DESC`
);

for (const r of rows) {
  console.log(`\nAsset: ${r.slug} (id=${r.id})`);
  console.log(`  Version ${r.versionNumber} (vid=${r.vid})`);
  console.log(`  Status: ${r.scormExtractionStatus}`);
  console.log(`  MimeType: ${r.mimeType}`);
  console.log(`  FileName: ${r.fileName}`);
  console.log(`  S3Url: ${r.s3Url}`);
  console.log(`  ExtractedPrefix: ${r.scormExtractedPrefix}`);
  console.log(`  LaunchFile: ${r.scormLaunchFile}`);
}

await conn.end();
