import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const checks = [
  ['lms_certificates', null],
  ['lms_lesson_notes', null],
  ['lms_lesson_bookmarks', null],
  ['lms_sections', 'drip_days'],
];
for (const [table, col] of checks) {
  try {
    const [rows] = await conn.query(`DESCRIBE ${table}`);
    if (col) {
      const found = rows.some(r => r.Field === col);
      console.log(`${table}.${col}: ${found ? 'OK' : 'MISSING'}`);
    } else {
      console.log(`${table}: EXISTS (${rows.length} cols)`);
    }
  } catch(e) { console.log(`${table}: ERROR - ${e.message}`); }
}
await conn.end();
