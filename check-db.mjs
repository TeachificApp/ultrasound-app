import { createPool } from "mysql2/promise";

const url = process.env.DATABASE_URL || "";
console.log("DB URL set:", !!url);
if (!url) {
  console.log("DATABASE_URL is not set");
  process.exit(1);
}

try {
  const u = new URL(url);
  console.log("host:", u.hostname);
  console.log("port:", u.port || "3306");
  console.log("ssl param:", u.searchParams.get("ssl"));
  console.log("sslaccept param:", u.searchParams.get("sslaccept"));
} catch (e) {
  console.log("URL parse error:", e.message);
}

// Try a test connection
try {
  const pool = createPool({
    uri: url,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
  });
  const conn = await pool.getConnection();
  const [rows] = await conn.query("SELECT 1 as ok");
  console.log("DB connection OK:", rows);
  conn.release();
  await pool.end();
} catch (err) {
  console.error("DB connection FAILED:", err.message);
  console.error("Error code:", err.code);
}
