import mysql from "mysql2/promise";

const DB_URL = "mysql://2mhhtxpXA9Esras.9b3674e1e24c:mvsCM0Xk4QDYxH86nu44@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/UrcfdRVE8J6mpMNR48QuFe?ssl={\"rejectUnauthorized\":true}";

const conn = await mysql.createConnection(DB_URL);
console.log("Connected to TiDB");

// Check Daniel's user records
const [users] = await conn.execute(
  "SELECT id, email, openId, isPending FROM users WHERE email = 'psndiddle@hotmail.com'"
);
console.log("Daniel's user records:", JSON.stringify(users, null, 2));

if (users.length === 0) {
  console.log("❌ User not found with that email!");
  await conn.end();
  process.exit(1);
}

const userId = users[0].id;
console.log("Using user ID:", userId);

// Check all enrollments
const [enrollments] = await conn.execute(
  "SELECT e.id, e.course_id, e.enrollment_type, e.enrolled_at, c.title FROM lms_enrollments e JOIN lms_courses c ON e.course_id = c.id WHERE e.user_id = ?",
  [userId]
);
console.log("Current enrollments:", JSON.stringify(enrollments, null, 2));

// Find ACS course
const [courses] = await conn.execute(
  "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%ACS%' OR title LIKE '%Advanced Cardiac%' OR (title LIKE '%cardiac%' AND title LIKE '%registry%') LIMIT 5"
);
console.log("ACS courses found:", JSON.stringify(courses, null, 2));

if (courses.length === 0) {
  // Try broader search
  const [allCourses] = await conn.execute(
    "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%cardiac%' OR title LIKE '%sonographer%' LIMIT 10"
  );
  console.log("Broader cardiac courses:", JSON.stringify(allCourses, null, 2));
} else {
  const targetCourse = courses[0];
  const alreadyEnrolled = enrollments.some(e => e.course_id === targetCourse.id);
  
  if (alreadyEnrolled) {
    console.log(`✅ Already enrolled in: ${targetCourse.title}`);
  } else {
    console.log(`Enrolling in: ${targetCourse.title} (ID: ${targetCourse.id})`);
    await conn.execute(
      "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type, created_at) VALUES (?, ?, NOW(), 'full', NOW())",
      [userId, targetCourse.id]
    );
    console.log("✅ Enrollment inserted!");
    
    // Verify
    const [verify] = await conn.execute(
      "SELECT e.id, e.course_id, e.enrollment_type, c.title FROM lms_enrollments e JOIN lms_courses c ON e.course_id = c.id WHERE e.user_id = ? AND e.course_id = ?",
      [userId, targetCourse.id]
    );
    console.log("Verified:", JSON.stringify(verify, null, 2));
  }
}

// Also check lms_orders
const [orders] = await conn.execute(
  "SELECT id, course_id, stripe_payment_intent_id, stripe_subscription_id, status, amount FROM lms_orders WHERE user_id = ? ORDER BY id DESC LIMIT 10",
  [userId]
);
console.log("Orders:", JSON.stringify(orders, null, 2));

await conn.end();
