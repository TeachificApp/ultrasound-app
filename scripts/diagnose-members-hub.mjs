/**
 * diagnose-members-hub.mjs
 * Runs the exact queries used by each MembersHub tab and reports what they return.
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/ultrasound-assist/.env" });

const DB_URL = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
if (!DB_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await mysql.createConnection(DB_URL);

async function q(label, sql, params = []) {
  try {
    const result = await conn.execute(sql, params);
    const rows = Array.isArray(result[0]) ? result[0] : [result[0]];
    return { label, rows, count: rows.length };
  } catch (e) {
    return { label, error: e.message, rows: [] };
  }
}

console.log("\n=== MembersHub Data Diagnostics ===\n");

// ── 1. USERS TAB ──────────────────────────────────────────────────────────────
console.log("── 1. USERS TAB (UserAnalytics) ──");
const usersCount = await q("Total users", "SELECT COUNT(*) AS cnt FROM users");
console.log("  Total users in DB:", usersCount.rows[0]?.cnt);

const usersWithActivity = await q("Users with any activity", `
  SELECT COUNT(DISTINCT user_id) AS cnt FROM user_activity_logs
`);
console.log("  Users with activity logs:", usersWithActivity.rows[0]?.cnt);

const activityLogCount = await q("Total activity log rows", "SELECT COUNT(*) AS cnt FROM user_activity_logs");
console.log("  Total activity_log rows:", activityLogCount.rows[0]?.cnt);

// Check the userActivityLog procedure query
const userActivitySample = await q("Sample userActivityLog query", `
  SELECT
    a.id, a.user_id AS userId, a.event_type AS eventType,
    a.description, a.created_at AS createdAt,
    COALESCE(u.name, u.email) AS userName
  FROM user_activity_logs a
  LEFT JOIN users u ON u.id = a.user_id
  ORDER BY a.created_at DESC
  LIMIT 5
`);
console.log("  Sample activity rows:", userActivitySample.rows.length, userActivitySample.rows.length ? "(has data)" : "(EMPTY - no rows!)");
if (userActivitySample.rows.length) {
  userActivitySample.rows.forEach(r => console.log(`    - [${r.eventType}] ${r.userName || 'unknown'}: ${r.description?.slice(0,60)}`));
}

// ── 2. ENROLLMENTS TAB ────────────────────────────────────────────────────────
console.log("\n── 2. ENROLLMENTS TAB ──");
const enrollCount = await q("Total enrollments", "SELECT COUNT(*) AS cnt FROM lms_enrollments");
console.log("  Total enrollments:", enrollCount.rows[0]?.cnt);

const enrollWithUser = await q("Enrollments with matched user", `
  SELECT COUNT(*) AS cnt FROM lms_enrollments e
  INNER JOIN users u ON u.id = e.user_id
`);
console.log("  Enrollments with matched user (INNER JOIN):", enrollWithUser.rows[0]?.cnt);

const enrollLeftJoin = await q("Enrollments with LEFT JOIN", `
  SELECT COUNT(*) AS cnt FROM lms_enrollments e
  LEFT JOIN users u ON u.id = e.user_id
`);
console.log("  Enrollments with LEFT JOIN:", enrollLeftJoin.rows[0]?.cnt);

// Check the actual enrollmentsList query
const enrollSample = await q("Sample enrollmentsList query", `
  SELECT
    e.id AS enrollmentId,
    e.user_id AS userId,
    COALESCE(u.name, u.email, CONCAT('User #', e.user_id)) AS userName,
    COALESCE(u.email, '') AS userEmail,
    e.course_id AS courseId,
    COALESCE(c.title, CONCAT('Course #', e.course_id)) AS courseTitle,
    COALESCE(c.type, 'course') AS courseType,
    e.progress_pct AS progressPct,
    e.enrolled_at AS enrolledAt,
    e.completed_at AS completedAt,
    e.enrollment_type AS enrollmentType
  FROM lms_enrollments e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN lms_courses c ON c.id = e.course_id
  LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
  GROUP BY e.id
  ORDER BY e.enrolled_at DESC
  LIMIT 5
`);
console.log("  Sample enrollmentsList rows:", enrollSample.rows.length, enrollSample.rows.length ? "(has data)" : "(EMPTY!)");
if (enrollSample.rows.length) {
  enrollSample.rows.forEach(r => console.log(`    - ${r.userName} → ${r.courseTitle} (${r.progressPct}%)`));
}

// ── 3. ACTIVITY TAB ───────────────────────────────────────────────────────────
console.log("\n── 3. ACTIVITY TAB (globalActivityLog) ──");
const globalActivity = await q("globalActivityLog query", `
  SELECT
    a.id, a.user_id AS userId, a.event_type AS eventType,
    a.description, a.created_at AS createdAt,
    COALESCE(u.name, u.email, CONCAT('User #', a.user_id)) AS userName,
    COALESCE(u.email, '') AS userEmail
  FROM user_activity_logs a
  LEFT JOIN users u ON u.id = a.user_id
  ORDER BY a.created_at DESC
  LIMIT 10
`);
console.log("  globalActivityLog rows:", globalActivity.rows.length, globalActivity.rows.length ? "(has data)" : "(EMPTY!)");
if (globalActivity.rows.length) {
  globalActivity.rows.slice(0,3).forEach(r => console.log(`    - [${r.eventType ?? 'null'}] ${r.userName}: ${r.description?.slice(0,60)}`));
}

// Check event types distribution
const eventTypes = await q("Event type distribution", `
  SELECT event_type, COUNT(*) AS cnt FROM user_activity_logs GROUP BY event_type ORDER BY cnt DESC LIMIT 10
`);
console.log("  Event types in DB:");
eventTypes.rows.forEach(r => console.log(`    - ${r.event_type}: ${r.cnt}`));

// ── 4. ACCESS/MEMBERS TAB ─────────────────────────────────────────────────────
console.log("\n── 4. ACCESS/MEMBERS TAB (userAnalytics) ──");
const userAnalyticsQuery = await q("userAnalytics main query", `
  SELECT
    u.id AS userId,
    COALESCE(u.name, u.email, CONCAT('User #', u.id)) AS name,
    u.email,
    u.isPremium,
    u.createdAt,
    u.lastSignedIn,
    COUNT(DISTINCT l.id) AS loginCount,
    COUNT(DISTINCT p.id) AS pageViewCount,
    COUNT(DISTINCT v.id) AS videoPlayCount,
    COUNT(DISTINCT qa.id) AS quizAttemptCount,
    COUNT(DISTINCT d.id) AS downloadCount,
    MAX(l.created_at) AS lastLogin
  FROM users u
  LEFT JOIN user_login_events l ON l.user_id = u.id
  LEFT JOIN user_page_view_events p ON p.user_id = u.id
  LEFT JOIN lms_video_events v ON v.user_id = u.id
  LEFT JOIN lms_quiz_attempts qa ON qa.user_id = u.id
  LEFT JOIN digital_download_events d ON d.user_id = u.id
  GROUP BY u.id
  ORDER BY lastLogin DESC
  LIMIT 5
`);
console.log("  userAnalytics rows:", userAnalyticsQuery.rows.length, userAnalyticsQuery.rows.length ? "(has data)" : "(EMPTY!)");
if (userAnalyticsQuery.rows.length) {
  userAnalyticsQuery.rows.forEach(r => console.log(`    - ${r.name} | logins:${r.loginCount} views:${r.pageViewCount} videos:${r.videoPlayCount}`));
}

// Check if the supporting tables have data
const loginEventsCount = await q("Login events count", "SELECT COUNT(*) AS cnt FROM user_login_events");
const pageViewCount = await q("Page view events count", "SELECT COUNT(*) AS cnt FROM user_page_view_events");
const videoEventsCount = await q("Video events count", "SELECT COUNT(*) AS cnt FROM lms_video_events");
console.log("  login_events:", loginEventsCount.rows[0]?.cnt);
console.log("  page_view_events:", pageViewCount.rows[0]?.cnt);
console.log("  video_events:", videoEventsCount.rows[0]?.cnt);

// ── 5. CHECK COLUMN NAMES ─────────────────────────────────────────────────────
console.log("\n── 5. COLUMN NAME AUDIT ──");
const userColumns = await q("users table columns", `
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('isPremium','is_premium','createdAt','created_at','lastSignedIn','last_signed_in','membership_tier')
`);
console.log("  users columns found:", userColumns.rows.map(r => r.COLUMN_NAME).join(', '));

const activityColumns = await q("user_activity_logs columns", `
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_activity_logs'
  AND COLUMN_NAME IN ('event_type','eventType','created_at','createdAt','user_id','userId')
`);
console.log("  user_activity_logs columns:", activityColumns.rows.map(r => r.COLUMN_NAME).join(', '));

const enrollColumns = await q("lms_enrollments columns", `
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lms_enrollments'
  ORDER BY ORDINAL_POSITION
`);
console.log("  lms_enrollments columns:", enrollColumns.rows.map(r => r.COLUMN_NAME).join(', '));

await conn.end();
console.log("\n=== Diagnostics complete ===\n");
