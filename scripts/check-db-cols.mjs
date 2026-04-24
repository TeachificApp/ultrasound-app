import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [r] = await conn.query('DESCRIBE lms_enrollments');
const cols = r.map(x => x.Field);
console.log('lms_enrollments cols:', cols.join(', '));
await conn.end();
