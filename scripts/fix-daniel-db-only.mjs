/**
 * Enrolls Daniel Galindo (psndiddle@hotmail.com) in the ACS Registry Review Quiz
 * Links the enrollment to his confirmed Stripe payment pi_3TeDTjBj9HgnkZLK086ylOZ1
 * Customer: cus_UdUS3LhynjS70l, Amount: $99.97
 */
import mysql from "mysql2/promise";

const DB_URL = "mysql://2mhhtxpXA9Esras.9b3674e1e24c:mvsCM0Xk4QDYxH86nu44@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/UrcfdRVE8J6mpMNR48QuFe";

const conn = await mysql.createConnection({
  uri: DB_URL,
  ssl: { rejectUnauthorized: true }
});
console.log("✅ Connected to TiDB");

// Step 1: Find Daniel's user
const [users] = await conn.execute(
  "SELECT id, email, openId, isPending FROM users WHERE email = 'psndiddle@hotmail.com'"
);
console.log("\nDaniel's user records:", JSON.stringify(users, null, 2));

if (users.length === 0) {
  console.log("❌ User not found!");
  await conn.end();
  process.exit(1);
}
const userId = users[0].id;
console.log("User ID:", userId);

// Step 2: Find the ACS course
const [courses] = await conn.execute(
  "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%ACS%' OR title LIKE '%Advanced Cardiac%' OR (title LIKE '%cardiac%' AND title LIKE '%registry%') LIMIT 5"
);
console.log("\nACS courses:", JSON.stringify(courses, null, 2));

if (courses.length === 0) {
  // Try broader
  const [broader] = await conn.execute(
    "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%cardiac%' OR title LIKE '%sonographer%' LIMIT 10"
  );
  console.log("Broader search:", JSON.stringify(broader, null, 2));
  await conn.end();
  process.exit(1);
}
const course = courses[0];
console.log(`\nTarget course: ${course.title} (ID: ${course.id})`);

// Step 3: Check for existing order linked to this payment
const [existingOrders] = await conn.execute(
  "SELECT * FROM lms_orders WHERE stripe_payment_intent_id = 'pi_3TeDTjBj9HgnkZLK086ylOZ1'"
);
console.log("\nExisting orders for this payment:", JSON.stringify(existingOrders, null, 2));

// Step 4: Check for existing enrollment
const [existingEnrollment] = await conn.execute(
  "SELECT * FROM lms_enrollments WHERE user_id = ? AND course_id = ?",
  [userId, course.id]
);
console.log("\nExisting enrollment:", JSON.stringify(existingEnrollment, null, 2));

// Step 5: Create or update order
let orderId;
if (existingOrders.length > 0) {
  orderId = existingOrders[0].id;
  // Update to make sure it's linked to correct user/course
  await conn.execute(
    "UPDATE lms_orders SET user_id = ?, course_id = ?, status = 'paid', stripe_customer_id = ? WHERE id = ?",
    [userId, course.id, "cus_UdUS3LhynjS70l", orderId]
  );
  console.log(`\n✅ Updated existing order ${orderId}`);
} else {
  // Check if there's an order for this user+course already
  const [userCourseOrders] = await conn.execute(
    "SELECT * FROM lms_orders WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 3",
    [userId, course.id]
  );
  
  if (userCourseOrders.length > 0) {
    orderId = userCourseOrders[0].id;
    await conn.execute(
      "UPDATE lms_orders SET stripe_payment_intent_id = 'pi_3TeDTjBj9HgnkZLK086ylOZ1', stripe_customer_id = 'cus_UdUS3LhynjS70l', status = 'paid', amount = 9997 WHERE id = ?",
      [orderId]
    );
    console.log(`\n✅ Updated existing user+course order ${orderId} with payment info`);
  } else {
    // Create new order
    const [result] = await conn.execute(
      `INSERT INTO lms_orders 
        (user_id, course_id, stripe_payment_intent_id, stripe_customer_id, status, amount, currency, created_at) 
      VALUES (?, ?, 'pi_3TeDTjBj9HgnkZLK086ylOZ1', 'cus_UdUS3LhynjS70l', 'paid', 9997, 'usd', NOW())`,
      [userId, course.id]
    );
    orderId = result.insertId;
    console.log(`\n✅ Created new order: ID ${orderId}`);
  }
}

// Step 6: Create or update enrollment
if (existingEnrollment.length > 0) {
  await conn.execute(
    "UPDATE lms_enrollments SET order_id = ?, enrollment_type = 'full' WHERE id = ?",
    [orderId, existingEnrollment[0].id]
  );
  console.log(`\n✅ Updated existing enrollment ${existingEnrollment[0].id} with order_id ${orderId}`);
} else {
  await conn.execute(
    "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type, order_id, created_at) VALUES (?, ?, NOW(), 'full', ?, NOW())",
    [userId, course.id, orderId]
  );
  console.log(`\n✅ Created new enrollment for user ${userId} in course ${course.id}`);
}

// Step 7: Final verification
const [finalEnrollment] = await conn.execute(
  `SELECT e.id, e.user_id, e.course_id, e.enrollment_type, e.order_id, e.enrolled_at, c.title 
   FROM lms_enrollments e 
   JOIN lms_courses c ON e.course_id = c.id 
   WHERE e.user_id = ? AND e.course_id = ?`,
  [userId, course.id]
);
const [finalOrder] = await conn.execute(
  "SELECT id, course_id, stripe_payment_intent_id, stripe_customer_id, status, amount FROM lms_orders WHERE id = ?",
  [orderId]
);

console.log("\n═══════════════════════════════════════");
console.log("FINAL STATE:");
console.log("Enrollment:", JSON.stringify(finalEnrollment, null, 2));
console.log("Order:", JSON.stringify(finalOrder, null, 2));
console.log("═══════════════════════════════════════");
console.log("\n✅ Daniel Galindo now has access to:", course.title);
console.log("   Payment: pi_3TeDTjBj9HgnkZLK086ylOZ1 ($99.97)");
console.log("   Customer: cus_UdUS3LhynjS70l");
console.log("\nNOTE: To link the subscription ID, go to Stripe Dashboard → find customer");
console.log("cus_UdUS3LhynjS70l → copy the subscription ID → run:");
console.log("UPDATE lms_orders SET stripe_subscription_id = 'sub_xxx' WHERE id =", orderId, ";");

await conn.end();
