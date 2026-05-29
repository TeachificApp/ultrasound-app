import mysql from 'mysql2/promise';
const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);
const [rows] = await conn.execute('SELECT id, price, title FROM lms_courses WHERE status="public" ORDER BY price DESC LIMIT 10');
for (const r of rows) console.log(r.id, '|', r.price, '|', r.title);
await conn.end();
