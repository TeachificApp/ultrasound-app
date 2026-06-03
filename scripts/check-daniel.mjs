import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
if (!url) { console.error('No RAILWAY_MYSQL_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Check Daniel's enrollments
const [enrollments] = await conn.execute(
  'SELECT e.id, e.user_id, e.course_id, e.enrolled_at, e.enrollment_type, c.title FROM lms_enrollments e JOIN lms_courses c ON c.id = e.course_id WHERE e.user_id = 30462'
);
console.log('ENROLLMENTS:', JSON.stringify(enrollments, null, 2));

// Find ACS quiz
const [courses] = await conn.execute(
  "SELECT id, title FROM lms_courses WHERE title LIKE '%Cardiac%' OR title LIKE '%ACS%' OR title LIKE '%Registry%'"
);
console.log('ACS COURSES:', JSON.stringify(courses, null, 2));

// Check orders for Daniel
const [orders] = await conn.execute(
  'SELECT id, user_id, course_id, status, stripe_payment_intent_id, stripe_subscription_id FROM lms_orders WHERE user_id = 30462'
);
console.log('ORDERS:', JSON.stringify(orders, null, 2));

// Check duplicate users
const [dupes] = await conn.execute(
  "SELECT email, COUNT(*) as cnt FROM users GROUP BY email HAVING cnt > 1 ORDER BY cnt DESC LIMIT 20"
);
console.log('DUPLICATE USERS:', JSON.stringify(dupes, null, 2));

await conn.end();
