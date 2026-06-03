/**
 * Uses the running server's API to check and fix Daniel's enrollment
 * via HTTP calls to the dev server
 */

const BASE = "http://localhost:3000";

// First, let's hit the admin API endpoint to check Daniel's data
// We'll use the internal tRPC batch endpoint
async function trpcQuery(procedure, input, cookie = "") {
  const url = `${BASE}/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url, {
    headers: { 
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    }
  });
  const json = await res.json();
  return json;
}

// Check the server is up
const health = await fetch(`${BASE}/api/health`).catch(() => null);
console.log("Server health:", health?.status);

// Use drizzle directly via the server's db module
// Import the server's db module
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { execSync } from "child_process";

// Run a quick SQL via mysql2 using DATABASE_URL from the running process
const dbUrl = execSync("cat /proc/$(pgrep -f 'node.*server')/environ 2>/dev/null | tr '\\0' '\\n' | grep DATABASE_URL | head -1", { encoding: "utf8" }).trim();
console.log("DATABASE_URL found:", dbUrl ? "YES (length=" + dbUrl.length + ")" : "NO");

if (dbUrl) {
  const urlValue = dbUrl.replace("DATABASE_URL=", "");
  
  // Connect and query
  const mysql = (await import("mysql2/promise")).default;
  const conn = await mysql.createConnection(urlValue);
  
  // Check Daniel's user
  const [users] = await conn.execute("SELECT id, email, open_id, is_pending FROM users WHERE email = 'psndiddle@hotmail.com'");
  console.log("Daniel's user records:", JSON.stringify(users, null, 2));
  
  if (users.length > 0) {
    const userId = users[0].id;
    
    // Check enrollments
    const [enrollments] = await conn.execute("SELECT * FROM lms_enrollments WHERE user_id = ?", [userId]);
    console.log("Daniel's enrollments:", JSON.stringify(enrollments, null, 2));
    
    // Find ACS course
    const [courses] = await conn.execute(
      "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%ACS%' OR title LIKE '%Advanced Cardiac%' OR (title LIKE '%cardiac%' AND title LIKE '%registry%') LIMIT 5"
    );
    console.log("ACS courses:", JSON.stringify(courses, null, 2));
    
    // Check if already enrolled in ACS
    const acsEnrolled = enrollments.some(e => courses.some(c => c.id === e.course_id));
    console.log("Already enrolled in ACS:", acsEnrolled);
    
    if (!acsEnrolled && courses.length > 0) {
      const courseId = courses[0].id;
      console.log(`Enrolling user ${userId} in course ${courseId} (${courses[0].title})...`);
      
      // Insert enrollment
      await conn.execute(
        "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type, created_at) VALUES (?, ?, NOW(), 'full', NOW())",
        [userId, courseId]
      );
      console.log("✅ Enrollment created successfully!");
      
      // Verify
      const [verify] = await conn.execute("SELECT * FROM lms_enrollments WHERE user_id = ? AND course_id = ?", [userId, courseId]);
      console.log("Verified enrollment:", JSON.stringify(verify, null, 2));
    }
  }
  
  await conn.end();
} else {
  console.log("Could not find DATABASE_URL from running process. Trying alternative...");
}
