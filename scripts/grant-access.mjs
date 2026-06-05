import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL);

try {
  // 1. Find the breast ultrasound registry review quiz
  const [lmsCourses] = await conn.execute(
    `SELECT id, title, type, status FROM lms_courses WHERE title LIKE '%breast%' OR title LIKE '%Breast%' OR title LIKE '%registry%' ORDER BY id LIMIT 10`
  );
  console.log("=== LMS Courses matching 'breast' or 'registry' ===");
  console.log(JSON.stringify(lmsCourses, null, 2));

  const [digitalProducts] = await conn.execute(
    `SELECT id, title, status FROM digital_products WHERE title LIKE '%breast%' OR title LIKE '%Breast%' OR title LIKE '%registry%' ORDER BY id LIMIT 10`
  );
  console.log("=== Digital Products matching 'breast' or 'registry' ===");
  console.log(JSON.stringify(digitalProducts, null, 2));

  // 2. Find the user
  const [users] = await conn.execute(
    `SELECT id, email, firstName, lastName, isPremium, membershipTier FROM users WHERE email = 'agonxxa125@gmail.com' LIMIT 1`
  );
  console.log("=== User agonxxa125@gmail.com ===");
  console.log(JSON.stringify(users, null, 2));

  // 3. Check lms_enrollments table columns
  const [enrollCols] = await conn.execute(`DESCRIBE lms_enrollments`);
  console.log("lms_enrollments columns:", enrollCols.map(c => c.Field).join(", "));

  // 4. Check digital_purchases table columns
  const [dpCols] = await conn.execute(`DESCRIBE digital_purchases`);
  console.log("digital_purchases columns:", dpCols.map(c => c.Field).join(", "));

} finally {
  await conn.end();
}
