import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sqls = [
  `CREATE TABLE IF NOT EXISTS lms_collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    label VARCHAR(100),
    color VARCHAR(20) DEFAULT '#189aa1',
    cover_image_url TEXT,
    position INT NOT NULL DEFAULT 0,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS lms_collection_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    collection_id INT NOT NULL,
    course_id INT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_col_course (collection_id, course_id)
  )`,
];
for (const s of sqls) {
  try {
    await conn.query(s);
    console.log('OK:', s.slice(0, 60));
  } catch(e) { console.error('ERR:', e.message); }
}
await conn.end();
console.log('Collections migration complete.');
