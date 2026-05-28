import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('mysql2/promise');

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT COUNT(*) as total FROM mediaVersions WHERE scormExtractedPrefix IS NOT NULL AND scormExtractedPrefix != ""');
const [rows2] = await conn.execute('SELECT COUNT(*) as total FROM mediaVersions WHERE scormExtractedPrefix IS NULL OR scormExtractedPrefix = ""');
console.log('Extracted in DB:', rows[0].total);
console.log('Still null in DB:', rows2[0].total);

// Show the 5 failed ones
const [failed] = await conn.execute(`
  SELECT ma.slug, ma.title, mv.id as versionId
  FROM mediaAssets ma
  JOIN mediaVersions mv ON mv.assetId = ma.id
  WHERE ma.mediaType IN ('scorm','zip')
    AND (mv.scormExtractedPrefix IS NULL OR mv.scormExtractedPrefix = '')
  ORDER BY ma.id
`);
if (failed.length > 0) {
  console.log('\nStill unextracted:');
  failed.forEach(r => console.log(` - [${r.versionId}] ${r.slug} | ${r.title}`));
}
await conn.end();
