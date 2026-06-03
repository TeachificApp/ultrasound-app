import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const userId = 30462;    // Daniel Galindo - psndiddle@hotmail.com
const courseId = 180001; // Advanced Cardiac Sonographer (ACS) - Registry Review Quiz
const orderId = 390001;  // Created in previous run

// Check existing enrollment
const [existing] = await conn.query(
  'SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ?',
  [userId, courseId]
);
console.log('Existing enrollment:', existing);

if (existing.length > 0) {
  console.log('User is already enrolled! ID:', existing[0].id);
  await conn.end();
  process.exit(0);
}

// Insert enrollment (no updated_at column in this table)
const [enrollResult] = await conn.query(
  'INSERT INTO lms_enrollments (user_id, course_id, order_id, created_at, enrollment_type) VALUES (?, ?, ?, NOW(), "full")',
  [userId, courseId, orderId]
);
console.log('Created enrollment ID:', enrollResult.insertId);

// Verify
const [verify] = await conn.query(
  'SELECT e.id, e.user_id, e.course_id, e.order_id, e.created_at, e.enrollment_type FROM lms_enrollments e WHERE e.user_id = ? AND e.course_id = ?',
  [userId, courseId]
);
console.log('Verification:', JSON.stringify(verify));

await conn.end();
console.log('Done! Daniel Galindo is now enrolled in the ACS Registry Review Quiz.');
process.exit(0);
