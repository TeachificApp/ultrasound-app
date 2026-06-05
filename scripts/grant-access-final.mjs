/**
 * Manually grants agonxxa125@gmail.com access to the Breast Ultrasound Registry Review Quiz (course ID 390001).
 * Creates account if not exists, creates a paid lms_order, and enrolls them.
 */
import mysql from "mysql2/promise";
import crypto from "crypto";

const COURSE_ID = 390001;
const EMAIL = "agonxxa125@gmail.com";
const FIRST_NAME = ""; // unknown
const LAST_NAME = "";

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL);

try {
  // 1. Find or create user
  const [existingUsers] = await conn.execute(
    `SELECT id, email, firstName, lastName FROM users WHERE email = ? LIMIT 1`,
    [EMAIL]
  );

  let userId;
  let isNew = false;

  if (existingUsers.length > 0) {
    userId = existingUsers[0].id;
    console.log(`✅ Found existing user: id=${userId}`);
  } else {
    // Create user with a password reset token so they can set their password
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const now = new Date();

    const [result] = await conn.execute(
      `INSERT INTO users (email, firstName, lastName, name, role, loginMethod, createdAt, updatedAt, passwordResetToken, passwordResetExpiry, emailVerified)
       VALUES (?, ?, ?, ?, 'user', 'email', ?, ?, ?, ?, 1)`,
      [EMAIL, FIRST_NAME || null, LAST_NAME || null, EMAIL, now, now, resetToken, resetExpiry]
    );
    userId = result.insertId;
    isNew = true;
    console.log(`✅ Created new user: id=${userId}, resetToken=${resetToken}`);
  }

  // 2. Check if already enrolled
  const [existingEnrollment] = await conn.execute(
    `SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ? LIMIT 1`,
    [userId, COURSE_ID]
  );

  if (existingEnrollment.length > 0) {
    console.log(`✅ User already enrolled in course ${COURSE_ID}`);
  } else {
    // 3. Create a paid lms_order
    const [lmsOrderCols] = await conn.execute(`DESCRIBE lms_orders`);
    console.log("lms_orders columns:", lmsOrderCols.map(c => c.Field).join(", "));

    const now = new Date();
    const [orderResult] = await conn.execute(
      `INSERT INTO lms_orders (user_id, course_id, status, amount, currency, created_at, updated_at)
       VALUES (?, ?, 'paid', 0, 'usd', ?, ?)`,
      [userId, COURSE_ID, now, now]
    );
    const orderId = orderResult.insertId;
    console.log(`✅ Created lms_order: id=${orderId}`);

    // 4. Enroll the user
    await conn.execute(
      `INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, order_id, enrollment_type, created_at)
       VALUES (?, ?, ?, ?, 'full', ?)`,
      [userId, COURSE_ID, now, orderId, now]
    );
    console.log(`✅ Enrolled user ${userId} in course ${COURSE_ID}`);
  }

  // 5. Verify enrollment
  const [enrollment] = await conn.execute(
    `SELECT e.id, e.enrolled_at, e.enrollment_type, c.title
     FROM lms_enrollments e
     JOIN lms_courses c ON c.id = e.course_id
     WHERE e.user_id = ? AND e.course_id = ?`,
    [userId, COURSE_ID]
  );
  console.log("=== Enrollment record ===");
  console.log(JSON.stringify(enrollment, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`User ID: ${userId}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`New account: ${isNew}`);
  console.log(`Course: Breast Ultrasound - Registry Review Quiz (ID ${COURSE_ID})`);
  console.log(`Status: Enrolled ✅`);

} finally {
  await conn.end();
}
