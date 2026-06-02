/**
 * One-off script: reset stuck SCORM asset 290001 to pending
 * Run: node scripts/resetScorm.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load the built server db helpers
const { getDb } = await import('../dist/server/db.js').catch(() => null) ?? {};

// Fallback: use mysql2 directly with DATABASE_URL
const mysql = require('mysql2/promise');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(dbUrl);
console.log('Connected');

// Find the correct table name
const [tables] = await conn.execute("SHOW TABLES");
const tableNames = tables.map(r => Object.values(r)[0]);
const versionTable = tableNames.find(t => t.toLowerCase().includes('version') && t.toLowerCase().includes('media'));
const assetTable = tableNames.find(t => t.toLowerCase().includes('asset') && t.toLowerCase().includes('media'));
console.log('Version table:', versionTable);
console.log('Asset table:', assetTable);

if (versionTable) {
  const [r] = await conn.execute(
    `UPDATE ${versionTable} SET scorm_extraction_status = 'pending', scorm_extraction_started_at = NULL WHERE asset_id = 290001`
  );
  console.log('Reset result:', r.affectedRows, 'rows updated');
}

await conn.end();
console.log('Done');
