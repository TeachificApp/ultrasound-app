import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const userId = 30462;
const courseId = 180001;
const orderId = 390001;

// Check enrollment columns
const [cols] = await conn.execute('DESCRIBE lms_enrollments');
console.log('Columns:', cols.map(c => c.Field).join(', '));

// Check existing enrollment
const [existing] = await conn.execute(
  'SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ?',
  [userId, courseId]
);
console.log('Existing enrollment:', existing);

if (existing.length === 0) {
  // Try insert
  try {
    const [r] = await conn.execute(
      'INSERT INTO lms_enrollments (user_id, course_id, order_id, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [userId, courseId, orderId]
    );
    console.log('Inserted enrollment ID:', r.insertId);
  } catch (e) {
    console.error('Insert error:', e.message);
    // Try without updated_at
    try {
      const [r2] = await conn.execute(
        'INSERT INTO lms_enrollments (user_id, course_id, order_id, created_at) VALUES (?, ?, ?, NOW())',
        [userId, courseId, orderId]
      );
      console.log('Inserted enrollment ID (v2):', r2.insertId);
    } catch (e2) {
      console.error('Insert v2 error:', e2.message);
    }
  }
}

// Verify
const [verify] = await conn.execute(
  'SELECT * FROM lms_enrollments WHERE user_id = ? AND course_id = ?',
  [userId, courseId]
);
console.log('Final enrollment:', JSON.stringify(verify));

await conn.end();
