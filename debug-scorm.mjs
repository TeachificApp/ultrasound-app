import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(url);

// Find Pediatric Echo assets
const [assets] = await conn.execute(
  "SELECT id, slug, mediaType, `access` FROM mediaAssets WHERE slug LIKE ? LIMIT 10",
  ['%pediatric-echo%']
);
console.log('=== Assets ===');
for (const a of assets) {
  console.log(a);
  const [versions] = await conn.execute(
    "SELECT id, versionNumber, scormExtractionStatus, scormExtractedPrefix, scormLaunchFile, LEFT(s3Url, 100) as s3UrlShort, mimeType FROM mediaVersions WHERE assetId = ? ORDER BY versionNumber DESC LIMIT 3",
    [a.id]
  );
  console.log('  Versions:', versions);
}

// Also check what the embed URL slug is
const [all] = await conn.execute(
  "SELECT id, slug, mediaType FROM mediaAssets WHERE mediaType IN ('scorm','zip','lms') ORDER BY id DESC LIMIT 20"
);
console.log('\n=== All SCORM/ZIP/LMS assets ===');
for (const a of all) console.log(a);

await conn.end();
