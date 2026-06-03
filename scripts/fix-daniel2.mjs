import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
if (!url) { console.error('No RAILWAY_MYSQL_URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

const ACS_QUIZ_COURSE_ID = 180001;
const DANIEL_USER_ID = 30462;

// Check if already enrolled
const [existing] = await conn.execute(
  'SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ?',
  [DANIEL_USER_ID, ACS_QUIZ_COURSE_ID]
);

if (existing.length > 0) {
  console.log('Already enrolled! Enrollment ID:', existing[0].id);
} else {
  // Insert enrollment directly (no order needed — admin grant)
  const [result] = await conn.execute(
    'INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type, created_at) VALUES (?, ?, NOW(), ?, NOW())',
    [DANIEL_USER_ID, ACS_QUIZ_COURSE_ID, 'full']
  );
  console.log('Enrollment created! Insert ID:', result.insertId);
}

// Verify
const [check] = await conn.execute(
  'SELECT e.id, e.user_id, e.course_id, e.enrolled_at, e.enrollment_type, c.title FROM lms_enrollments e JOIN lms_courses c ON c.id = e.course_id WHERE e.user_id = ?',
  [DANIEL_USER_ID]
);
console.log('All enrollments for Daniel:', JSON.stringify(check, null, 2));

// Investigate duplicate users — look at the duplicate accounts
const [dupeDetails] = await conn.execute(
  `SELECT id, email, name, created_at, open_id, auth_provider 
   FROM users 
   WHERE email IN ('amanda.padilla85@outlook.com','nelyasun@list.ru','gulo.chxart@gmail.com','ezziesoli5@icloud.com')
   ORDER BY email, id`
);
console.log('DUPLICATE USER DETAILS:', JSON.stringify(dupeDetails, null, 2));

await conn.end();
