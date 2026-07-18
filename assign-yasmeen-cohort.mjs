import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Find Yasmeen's user
const [users] = await conn.execute(
  "SELECT id, email, name FROM users WHERE email LIKE '%yasmeen%' OR name LIKE '%Yasmeen%' LIMIT 5"
);
console.log("Users:", users);

// 2. Find her enrollment for course 480001
const [enrollments] = await conn.execute(
  "SELECT id, user_id, course_id, enrollment_type, access_expires_at FROM lms_enrollments WHERE course_id = 480001 ORDER BY enrolled_at DESC LIMIT 5"
);
console.log("Enrollments for course 480001:", enrollments);

// 3. Find the featured cohort group for course 480001
const [groups] = await conn.execute(
  "SELECT id, name, status, is_featured_on_landing FROM lms_cohort_groups WHERE course_id = 480001 ORDER BY sort_order ASC, id ASC"
);
console.log("Cohort groups for course 480001:", groups);

// 4. Check existing cohort group enrollments for course 480001
const [existing] = await conn.execute(
  "SELECT * FROM lms_cohort_group_enrollments WHERE course_id = 480001"
);
console.log("Existing cohort group enrollments:", existing);

await conn.end();
