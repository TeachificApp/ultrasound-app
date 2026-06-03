import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/ultrasound-assist/.env" });

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL);

// Check Daniel's user record
const [users] = await conn.execute(
  "SELECT id, email, open_id, is_pending FROM users WHERE email = ?",
  ["psndiddle@hotmail.com"]
);
console.log("Users with this email:", JSON.stringify(users, null, 2));

// Check all enrollments for user ID 30462
const [enrollments] = await conn.execute(
  "SELECT * FROM lms_enrollments WHERE user_id = 30462"
);
console.log("Enrollments for user 30462:", JSON.stringify(enrollments, null, 2));

// Find the ACS quiz course
const [courses] = await conn.execute(
  "SELECT id, title, slug, type FROM lms_courses WHERE title LIKE '%cardiac%' OR title LIKE '%ACS%' OR title LIKE '%registry%' ORDER BY id LIMIT 10"
);
console.log("ACS-related courses:", JSON.stringify(courses, null, 2));

// Check lms_orders for Daniel
const [orders] = await conn.execute(
  "SELECT * FROM lms_orders WHERE user_id = 30462 ORDER BY id DESC LIMIT 10"
);
console.log("Orders for user 30462:", JSON.stringify(orders, null, 2));

await conn.end();
