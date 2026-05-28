import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/ultrasound-assist/.env" });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check all media versions with their extraction status
// Note: mediaType is on mediaAssets, not mediaVersions
const [rows] = await conn.execute(`
  SELECT 
    mv.id, 
    mv.scormExtractedPrefix, 
    mv.s3Url AS fileUrl,
    ma.mediaType,
    mv.versionNumber,
    ma.slug, 
    ma.title
  FROM mediaVersions mv
  JOIN mediaAssets ma ON ma.id = mv.assetId
  WHERE ma.mediaType IN ('scorm', 'zip')
  ORDER BY ma.slug, mv.versionNumber DESC
`);

console.log(`\nTotal SCORM/ZIP versions: ${rows.length}`);
console.log("\n--- Extraction Status ---");

let extracted = 0, missing = 0;
for (const r of rows) {
  const status = r.scormExtractedPrefix ? "✓ EXTRACTED" : "✗ MISSING";
  if (r.scormExtractedPrefix) extracted++;
  else missing++;
  console.log(`[${status}] id=${r.id} v${r.versionNumber} slug="${r.slug}" prefix="${r.scormExtractedPrefix || 'null'}"`);
}

console.log(`\nSummary: ${extracted} extracted, ${missing} missing`);

// Check the OB/GYN quiz specifically
console.log("\n--- OB/GYN Quiz ---");
const [obgyn] = await conn.execute(`
  SELECT mv.id, mv.scormExtractedPrefix, mv.s3Url, ma.mediaType, ma.slug, ma.title
  FROM mediaVersions mv
  JOIN mediaAssets ma ON ma.id = mv.assetId
  WHERE ma.slug LIKE '%ob%' OR ma.slug LIKE '%gyn%' OR ma.title LIKE '%OB%' OR ma.title LIKE '%GYN%'
  ORDER BY mv.id DESC
  LIMIT 5
`);
obgyn.forEach(r => console.log(`  id=${r.id} type=${r.mediaType} prefix="${r.scormExtractedPrefix}" url="${r.s3Url?.substring(0,80)}"`));

// Check the breast quiz
console.log("\n--- Breast Quiz ---");
const [breast] = await conn.execute(`
  SELECT mv.id, mv.scormExtractedPrefix, mv.s3Url, ma.mediaType, ma.slug, ma.title
  FROM mediaVersions mv
  JOIN mediaAssets ma ON ma.id = mv.assetId
  WHERE ma.slug LIKE '%breast%' OR ma.title LIKE '%breast%'
  ORDER BY mv.id DESC
  LIMIT 5
`);
breast.forEach(r => console.log(`  id=${r.id} type=${r.mediaType} prefix="${r.scormExtractedPrefix}" url="${r.s3Url?.substring(0,80)}"`));

// Check the registry review quiz
console.log("\n--- Registry Review Quiz ---");
const [registry] = await conn.execute(`
  SELECT mv.id, mv.scormExtractedPrefix, mv.s3Url, ma.mediaType, ma.slug, ma.title
  FROM mediaVersions mv
  JOIN mediaAssets ma ON ma.id = mv.assetId
  WHERE ma.slug LIKE '%registry%' OR ma.title LIKE '%registry%'
  ORDER BY mv.id DESC
  LIMIT 5
`);
registry.forEach(r => console.log(`  id=${r.id} type=${r.mediaType} prefix="${r.scormExtractedPrefix}" url="${r.s3Url?.substring(0,80)}"`));

await conn.end();
