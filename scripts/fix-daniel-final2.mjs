/**
 * Links Daniel Galindo's existing enrollment (ID 480002) to a proper order
 * with the confirmed Stripe payment pi_3TeDTjBj9HgnkZLK086ylOZ1
 */
import mysql from "mysql2/promise";

const DB_URL = "mysql://2mhhtxpXA9Esras.9b3674e1e24c:mvsCM0Xk4QDYxH86nu44@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/UrcfdRVE8J6mpMNR48QuFe";

const conn = await mysql.createConnection({
  uri: DB_URL,
  ssl: { rejectUnauthorized: true }
});
console.log("✅ Connected to TiDB");

const userId = 30462;
const courseId = 180001;
const enrollmentId = 480002;

// Check if order already exists for this payment intent
const [existingByPI] = await conn.execute(
  "SELECT * FROM lms_orders WHERE stripe_payment_intent_id = 'pi_3TeDTjBj9HgnkZLK086ylOZ1'"
);
console.log("Existing orders for payment intent:", JSON.stringify(existingByPI, null, 2));

let orderId;
if (existingByPI.length > 0) {
  orderId = existingByPI[0].id;
  console.log(`Using existing order ${orderId}`);
} else {
  // Create the order
  const [result] = await conn.execute(
    `INSERT INTO lms_orders 
      (user_id, course_id, stripe_payment_intent_id, status, amount, currency, created_at, updated_at) 
    VALUES (?, ?, 'pi_3TeDTjBj9HgnkZLK086ylOZ1', 'paid', 9997, 'usd', NOW(), NOW())`,
    [userId, courseId]
  );
  orderId = result.insertId;
  console.log(`✅ Created order ID: ${orderId}`);
}

// Link enrollment to order
await conn.execute(
  "UPDATE lms_enrollments SET order_id = ? WHERE id = ?",
  [orderId, enrollmentId]
);
console.log(`✅ Linked enrollment ${enrollmentId} to order ${orderId}`);

// Also fix isPending — user should not be pending if they've paid
const [userCheck] = await conn.execute(
  "SELECT id, email, isPending FROM users WHERE id = ?",
  [userId]
);
console.log("User status:", JSON.stringify(userCheck, null, 2));

if (userCheck.length > 0 && userCheck[0].isPending) {
  console.log("⚠️  User is still marked as pending — they need to complete registration to log in");
  console.log("   The enrollment is created but they need to sign up with this email to access it");
}

// Final verification
const [final] = await conn.execute(
  `SELECT e.id, e.user_id, e.course_id, e.enrollment_type, e.order_id, e.enrolled_at, 
          c.title, o.stripe_payment_intent_id, o.status as order_status, o.amount
   FROM lms_enrollments e 
   JOIN lms_courses c ON e.course_id = c.id 
   LEFT JOIN lms_orders o ON e.order_id = o.id
   WHERE e.id = ?`,
  [enrollmentId]
);
console.log("\n═══════════════════════════════════════");
console.log("FINAL STATE:");
console.log(JSON.stringify(final, null, 2));
console.log("═══════════════════════════════════════");

await conn.end();
