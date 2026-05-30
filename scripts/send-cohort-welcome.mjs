/**
 * send-cohort-welcome.mjs
 * Ensures each target student is:
 *  1. Enrolled in the LIVE Adult Echocardiography course
 *  2. Assigned to the June 2026 cohort group
 *  3. Sent a welcome email
 *
 * Usage: node scripts/send-cohort-welcome.mjs
 */
import mysql from "mysql2/promise";

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_EMAILS = [
  "chris.layman@ncch.com",
  "steph.fleury10@yahoo.com",
  "scullion@samsunghme.com",
  "msparks@samsunghme.com",
  "tratte@samsunghme.com",
];

const COURSE_SLUG = "live-adult-echocardiography-12-week-cross-training-course";
const COHORT_GROUP_NAME = "June 2026";

const DB_URL = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const LMS_FROM_EMAIL = process.env.LMS_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "learn@allaboutultrasound.com";
const LMS_FROM_NAME = process.env.LMS_FROM_NAME || process.env.SENDGRID_FROM_NAME || "All About Ultrasound™ Learning";

const brandColor = "#0d9488";
const brandDark = "#0e4a50";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAccessUrl(destination, accessToken) {
  if (!accessToken) return destination;
  return `https://learn.allaboutultrasound.com/auth/access?token=${accessToken}&next=${encodeURIComponent(destination)}`;
}

function emailWrapper(content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#0e4a50 0%,#0e4a50 60%,${brandColor} 100%);padding:28px 32px;text-align:center;">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp"
            alt="All About Ultrasound™" width="80" height="80" style="border-radius:50%;display:block;margin:0 auto 12px;"/>
          <div style="font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">All About Ultrasound™</div>
          <div style="font-size:12px;color:#4ad9e0;margin-top:4px;">General &amp; Vascular Ultrasound Clinical Intelligence</div>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="background:#f8fffe;border-top:1px solid #e5f7f8;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">© All About Ultrasound™ · <a href="https://www.allaboutultrasound.com" style="color:${brandColor};text-decoration:none;">www.allaboutultrasound.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmail({ to, subject, htmlBody }) {
  if (!SENDGRID_API_KEY) { console.warn("⚠️  SENDGRID_API_KEY not set"); return false; }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ name: to.name, email: to.email }] }],
      from: { email: LMS_FROM_EMAIL, name: LMS_FROM_NAME },
      subject,
      content: [{ type: "text/html", value: htmlBody }],
    }),
  });
  if (res.ok || res.status === 202) { console.log(`  ✅  Email sent to ${to.email}`); return true; }
  const text = await res.text();
  console.error(`  ❌  SendGrid ${res.status}: ${text}`);
  return false;
}

async function getOrCreateAccessToken(conn, userId) {
  const [rows] = await conn.execute("SELECT accessToken FROM users WHERE id = ? LIMIT 1", [userId]);
  if (rows[0]?.accessToken) return rows[0].accessToken;
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await conn.execute("UPDATE users SET accessToken = ? WHERE id = ?", [token, userId]);
  return token;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!DB_URL) { console.error("No DATABASE_URL set"); process.exit(1); }
  const conn = await mysql.createConnection(DB_URL);

  // 1. Resolve course
  const [[course]] = await conn.execute(
    "SELECT id, title, slug FROM lms_courses WHERE slug = ? LIMIT 1",
    [COURSE_SLUG]
  );
  if (!course) { console.error(`Course not found: ${COURSE_SLUG}`); process.exit(1); }
  console.log(`\nCourse: ${course.title} (id=${course.id})`);

  // 2. Resolve cohort group
  const [[cohortGroup]] = await conn.execute(
    "SELECT id, name FROM lms_cohort_groups WHERE course_id = ? AND name = ? LIMIT 1",
    [course.id, COHORT_GROUP_NAME]
  );
  if (!cohortGroup) { console.error(`Cohort group "${COHORT_GROUP_NAME}" not found for course ${course.id}`); process.exit(1); }
  console.log(`Cohort Group: ${cohortGroup.name} (id=${cohortGroup.id})\n`);

  for (const email of TARGET_EMAILS) {
    console.log(`── Processing ${email} ──`);

    // 3. Find user
    const [[user]] = await conn.execute(
      "SELECT id, name, displayName, email FROM users WHERE LOWER(email) = ? LIMIT 1",
      [email.toLowerCase()]
    );
    if (!user) { console.warn(`  ⚠️  User not found: ${email}`); continue; }
    const displayName = user.displayName || user.name || email.split("@")[0];
    const firstName = displayName.split(" ")[0];
    console.log(`  User: ${displayName} (id=${user.id})`);

    // 4. Ensure enrolled in course
    const [[existingEnrollment]] = await conn.execute(
      "SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
      [user.id, course.id]
    );
    let enrollmentId;
    if (existingEnrollment) {
      enrollmentId = existingEnrollment.id;
      console.log(`  ✓ Already enrolled (enrollment_id=${enrollmentId})`);
    } else {
      const [result] = await conn.execute(
        "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at) VALUES (?, ?, NOW())",
        [user.id, course.id]
      );
      enrollmentId = result.insertId;
      console.log(`  ➕ Enrolled in course (enrollment_id=${enrollmentId})`);
    }

    // 5. Ensure assigned to June 2026 cohort group
    const [[existingCohort]] = await conn.execute(
      "SELECT id FROM lms_cohort_group_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
      [user.id, course.id]
    );
    if (existingCohort) {
      // Update to correct group if different
      await conn.execute(
        "UPDATE lms_cohort_group_enrollments SET cohort_group_id = ?, enrollment_id = ? WHERE user_id = ? AND course_id = ?",
        [cohortGroup.id, enrollmentId, user.id, course.id]
      );
      console.log(`  ✓ Assigned/updated to cohort group "${cohortGroup.name}"`);
    } else {
      await conn.execute(
        "INSERT INTO lms_cohort_group_enrollments (cohort_group_id, enrollment_id, user_id, course_id, joined_at) VALUES (?, ?, ?, ?, NOW())",
        [cohortGroup.id, enrollmentId, user.id, course.id]
      );
      console.log(`  ➕ Added to cohort group "${cohortGroup.name}"`);
    }

    // 6. Send welcome email
    const accessToken = await getOrCreateAccessToken(conn, user.id);
    const courseUrl = buildAccessUrl(`https://learn.allaboutultrasound.com/courses/${course.slug}`, accessToken);

    const htmlBody = emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:22px;color:${brandDark};font-family:Georgia,serif;">Welcome, ${firstName}! 🎉</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
        You've been successfully enrolled in <strong style="color:${brandDark};">${course.title}</strong>. We're excited to have you on board!
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#475569;">
        You've been placed in the <strong style="color:${brandDark};">${cohortGroup.name}</strong> cohort group.
      </p>
      <div style="background:#f0fbfc;border-left:3px solid ${brandColor};padding:14px 16px;border-radius:0 8px 8px 0;margin:0 0 24px;">
        <p style="margin:0;font-size:14px;color:#0e4a50;font-weight:600;">Getting started:</p>
        <ul style="margin:8px 0 0;padding-left:20px;font-size:14px;color:#475569;">
          <li style="margin:4px 0;">Click the button below — you'll be signed in automatically</li>
          <li style="margin:4px 0;">Track your progress and complete lessons at your own pace</li>
          <li style="margin:4px 0;">Earn a certificate of completion when you finish</li>
        </ul>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${courseUrl}" style="display:inline-block;background:linear-gradient(135deg,${brandColor},#4ad9e0);color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">
          Start Learning Now
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">If you have any questions, reply to this email or visit our help center.</p>
    `);

    await sendEmail({
      to: { name: displayName, email: user.email },
      subject: `Welcome to "${course.title}" 🎉`,
      htmlBody,
    });

    console.log();
  }

  await conn.end();
  console.log("Done.");
}

main().catch(e => { console.error(e.message); process.exit(1); });
