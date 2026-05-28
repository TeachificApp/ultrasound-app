import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env var not set");

const conn = await mysql.createConnection(DATABASE_URL);

const sqls = [
  `CREATE TABLE IF NOT EXISTS media_upload_folders (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_by INT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS media_upload_responses (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    block_id VARCHAR(128) NULL COMMENT 'Block ID from page builder',
    page_id VARCHAR(128) NULL COMMENT 'Page/funnel/course slug or ID',
    page_type VARCHAR(64) NULL COMMENT 'landing|funnel|lesson|cohort_assignment|other',
    folder_id INT NULL,
    file_url VARCHAR(1024) NOT NULL,
    file_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(512) NULL,
    mime_type VARCHAR(128) NULL,
    file_size INT NULL,
    created_at BIGINT NOT NULL
  )`,
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    console.log("✅", sql.substring(0, 60).replace(/\n/g, " "));
  } catch (e) {
    if (e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("⏭  Already exists:", sql.substring(0, 40).replace(/\n/g, " "));
    } else {
      console.error("❌", e.message);
    }
  }
}

await conn.end();
console.log("Done.");
