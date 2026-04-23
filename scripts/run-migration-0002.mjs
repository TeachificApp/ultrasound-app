import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0002_media_repository.sql"), "utf8");

// Split on semicolons, skip comments and blanks
const stmts = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const conn = await createConnection(process.env.DATABASE_URL);
for (const stmt of stmts) {
  await conn.execute(stmt);
  console.log("OK:", stmt.slice(0, 70));
}
await conn.end();
console.log("Migration 0002 applied successfully.");
