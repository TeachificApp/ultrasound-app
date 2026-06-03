import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
const conn = await mysql.createConnection(url);

// Get columns of users table
const [cols] = await conn.execute('SHOW COLUMNS FROM users');
console.log('USER COLUMNS:', cols.map(c => c.Field).join(', '));

// Get duplicate user details
const [dupeDetails] = await conn.execute(
  `SELECT id, email, name, createdAt, openId, loginMethod 
   FROM users 
   WHERE email IN ('amanda.padilla85@outlook.com','nelyasun@list.ru','gulo.chxart@gmail.com','ezziesoli5@icloud.com')
   ORDER BY email, id`
);
console.log('DUPLICATE USER DETAILS:', JSON.stringify(dupeDetails, null, 2));

await conn.end();
