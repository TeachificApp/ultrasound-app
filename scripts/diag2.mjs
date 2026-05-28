import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/ultrasound-assist/.env" });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. What course IDs are in enrollments?
const [enrollCourseIds] = await conn.execute(
  "SELECT DISTINCT course_id, COUNT(*) AS cnt FROM lms_enrollments GROUP BY course_id ORDER BY cnt DESC"
);
console.log("Enrollment course_ids:", enrollCourseIds.map(r => `${r.course_id}(${r.cnt})`).join(", "));

// 2. What course IDs exist in lms_courses?
const [courseIds] = await conn.execute("SELECT id, title, type FROM lms_courses ORDER BY id");
console.log("lms_courses IDs:", courseIds.map(r => `${r.id}=${r.title}`).join(", "));

// 3. Which enrollment course_ids are NOT in lms_courses?
const [missingCourses] = await conn.execute(`
  SELECT DISTINCT e.course_id, COUNT(*) AS cnt 
  FROM lms_enrollments e 
  WHERE e.course_id NOT IN (SELECT id FROM lms_courses) 
  GROUP BY e.course_id
`);
console.log("\nEnrollment course_ids NOT in lms_courses:", missingCourses.map(r => `${r.course_id}(${r.cnt})`).join(", "));

// 4. Check thinkific_imports mapping
const [tiRows] = await conn.execute(`
  SELECT ti.id, ti.thinkific_course_id, ti.thinkific_course_name, ti.lms_course_id, ti.status
  FROM lms_thinkific_imports ti
  ORDER BY ti.id
  LIMIT 20
`);
console.log("\nlms_thinkific_imports:");
tiRows.forEach(r => console.log(`  id=${r.id} thinkific_id=${r.thinkific_course_id} lms_course_id=${r.lms_course_id} name="${r.thinkific_course_name}" status=${r.status}`));

// 5. Check if enrollments join to thinkific_imports via course_id
const [tiJoin] = await conn.execute(`
  SELECT e.course_id, ti.id AS ti_id, ti.thinkific_course_name, ti.lms_course_id
  FROM lms_enrollments e
  LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
  LIMIT 5
`);
console.log("\nEnrollments joined to thinkific_imports (via lms_course_id=course_id):");
tiJoin.forEach(r => console.log(`  enroll.course_id=${r.course_id} -> ti.id=${r.ti_id} name="${r.thinkific_course_name}" lms_course_id=${r.lms_course_id}`));

// 6. Check if thinkific_imports.id matches enrollment.course_id
const [tiJoin2] = await conn.execute(`
  SELECT e.course_id, ti.id AS ti_id, ti.thinkific_course_name, ti.lms_course_id
  FROM lms_enrollments e
  LEFT JOIN lms_thinkific_imports ti ON ti.id = e.course_id
  LIMIT 5
`);
console.log("\nEnrollments joined to thinkific_imports (via ti.id=course_id):");
tiJoin2.forEach(r => console.log(`  enroll.course_id=${r.course_id} -> ti.id=${r.ti_id} name="${r.thinkific_course_name}" lms_course_id=${r.lms_course_id}`));

// 7. Check users table column names
const [userCols] = await conn.execute(`
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
  ORDER BY ORDINAL_POSITION
`);
console.log("\nusers columns:", userCols.map(r => r.COLUMN_NAME).join(", "));

// 8. Sample users to see actual column names
const [sampleUsers] = await conn.execute("SELECT * FROM users LIMIT 1");
if (sampleUsers.length) console.log("\nSample user keys:", Object.keys(sampleUsers[0]).join(", "));

// 9. Check user_login_events
const [loginCount] = await conn.execute("SELECT COUNT(*) AS cnt FROM user_login_events");
console.log("\nuser_login_events count:", loginCount[0]?.cnt);

const [pageViewCount] = await conn.execute("SELECT COUNT(*) AS cnt FROM user_page_view_events");
console.log("user_page_view_events count:", pageViewCount[0]?.cnt);

// 10. Check userAnalytics query result
const [analyticsRows] = await conn.execute(`
  SELECT
    u.id AS userId,
    u.name,
    u.email,
    COUNT(DISTINCT l.id) AS loginCount,
    COUNT(DISTINCT p.id) AS pageViewCount
  FROM users u
  LEFT JOIN user_login_events l ON l.user_id = u.id
  LEFT JOIN user_page_view_events p ON p.user_id = u.id
  GROUP BY u.id
  HAVING loginCount > 0 OR pageViewCount > 0
  LIMIT 5
`);
console.log("\nUsers with login or page view events:", analyticsRows.length);
analyticsRows.forEach(r => console.log(`  ${r.name || r.email}: logins=${r.loginCount} views=${r.pageViewCount}`));

await conn.end();
console.log("\nDone.");
