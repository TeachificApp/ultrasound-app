import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0003_media_enhancements.sql"), "utf8");

const conn = await createConnection(process.env.DATABASE_URL);

// Split on semicolons, filter empty statements
const statements = sql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

for (const stmt of statements) {
  console.log("Executing:", stmt.slice(0, 80) + "...");
  try {
    await conn.execute(stmt);
    console.log("  ✓ OK");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("  ⚠ Already applied, skipping.");
    } else {
      console.error("  ✗ Error:", err.message);
      throw err;
    }
  }
}

await conn.end();
console.log("Migration 0003 complete.");
