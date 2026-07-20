import { createConnection } from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(dbUrl);

// Find user by email
const [users] = await conn.execute(
  'SELECT id, name, email, role, createdAt FROM users WHERE email = ? LIMIT 3',
  ['tipnis@wisc.edu']
);
console.log('Users:', JSON.stringify(users, null, 2));

if (users.length > 0) {
  const userId = users[0].id;
  
  // Check lms enrollments
  const [enrollments] = await conn.execute(
    'SELECT e.id, e.userId, e.courseId, e.status, e.createdAt, c.title FROM lms_enrollments e LEFT JOIN lms_courses c ON c.id = e.courseId WHERE e.userId = ? LIMIT 10',
    [userId]
  );
  console.log('\nEnrollments:', JSON.stringify(enrollments, null, 2));

  // Check lms orders
  const [orders] = await conn.execute(
    'SELECT id, userId, courseId, status, stripeSessionId, amount, createdAt FROM lms_orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 5',
    [userId]
  );
  console.log('\nOrders:', JSON.stringify(orders, null, 2));
}

await conn.end();
