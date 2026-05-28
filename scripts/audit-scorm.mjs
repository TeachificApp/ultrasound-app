import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT ma.id, ma.slug, ma.title, ma.mediaType, mv.id as versionId, 
         mv.scormExtractedPrefix, mv.scormLaunchFile, mv.fileSize, mv.s3Url
  FROM mediaAssets ma
  JOIN mediaVersions mv ON mv.assetId = ma.id
  WHERE ma.mediaType IN ('scorm','zip') OR mv.mimeType = 'application/zip'
  ORDER BY ma.id DESC
`);

const withExtraction = rows.filter(r => r.scormExtractedPrefix);
const withoutExtraction = rows.filter(r => !r.scormExtractedPrefix);

console.log('Total SCORM/ZIP files:', rows.length);
console.log('Already extracted:', withExtraction.length);
console.log('NOT extracted (need re-extract):', withoutExtraction.length);

console.log('\n=== NOT EXTRACTED ===');
withoutExtraction.forEach(r => {
  const mb = r.fileSize ? (r.fileSize/1024/1024).toFixed(1)+'MB' : 'unknown size';
  console.log(` - [${r.id}] ${r.slug} | ${r.title} | ${mb}`);
});

console.log('\n=== ALREADY EXTRACTED ===');
withExtraction.forEach(r => {
  console.log(` - [${r.id}] ${r.slug}`);
  console.log(`   prefix: ${r.scormExtractedPrefix}`);
  console.log(`   launch: ${r.scormLaunchFile}`);
});

await conn.end();
