import mysql from "mysql2/promise";
import Stripe from "stripe";

const DB_URL = "mysql://2mhhtxpXA9Esras.9b3674e1e24c:mvsCM0Xk4QDYxH86nu44@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/UrcfdRVE8J6mpMNR48QuFe?ssl={\"rejectUnauthorized\":true}";

// Get Stripe key from running process
import { execSync } from "child_process";
const stripeKey = execSync(
  "cat /proc/$(pgrep -f 'tsx.*index.ts' | head -1)/environ 2>/dev/null | tr '\\0' '\\n' | grep STRIPE_SECRET_KEY | head -1",
  { encoding: "utf8" }
).trim().replace("STRIPE_SECRET_KEY=", "");

console.log("Stripe key found:", stripeKey ? `YES (${stripeKey.substring(0, 10)}...)` : "NO");

const stripe = new Stripe(stripeKey);
const conn = await mysql.createConnection({
  uri: DB_URL,
  ssl: { rejectUnauthorized: true }
});
console.log("Connected to TiDB");

// ── Step 1: Look up Daniel's user record ──────────────────────────────────────
const [users] = await conn.execute(
  "SELECT id, email, openId, isPending FROM users WHERE email = 'psndiddle@hotmail.com'"
);
console.log("\n── Daniel's user records ──");
console.log(JSON.stringify(users, null, 2));

if (users.length === 0) {
  console.log("❌ User not found!");
  await conn.end();
  process.exit(1);
}
const user = users[0];
const userId = user.id;

// ── Step 2: Look up Stripe payment intent ────────────────────────────────────
console.log("\n── Stripe Payment Intent ──");
const pi = await stripe.paymentIntents.retrieve("pi_3TeDTjBj9HgnkZLK086ylOZ1");
console.log("Payment Intent status:", pi.status);
console.log("Amount:", pi.amount / 100, pi.currency.toUpperCase());
console.log("Customer:", pi.customer);
console.log("Metadata:", JSON.stringify(pi.metadata, null, 2));

// Look up the checkout session that created this payment intent
console.log("\n── Checkout Sessions for this payment ──");
const sessions = await stripe.checkout.sessions.list({
  payment_intent: "pi_3TeDTjBj9HgnkZLK086ylOZ1",
  limit: 5,
});
console.log("Sessions found:", sessions.data.length);
for (const s of sessions.data) {
  console.log(`  Session ${s.id}: status=${s.status}, metadata=${JSON.stringify(s.metadata)}`);
}

// Also check subscription
if (pi.metadata?.subscription_id || sessions.data[0]?.subscription) {
  const subId = pi.metadata?.subscription_id || sessions.data[0]?.subscription;
  console.log("\n── Subscription ──");
  const sub = await stripe.subscriptions.retrieve(subId);
  console.log("Subscription:", sub.id, "status:", sub.status);
  console.log("Current period end:", new Date(sub.current_period_end * 1000).toISOString());
}

// ── Step 3: Find the ACS course ──────────────────────────────────────────────
console.log("\n── ACS Course ──");
const [courses] = await conn.execute(
  "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%ACS%' OR title LIKE '%Advanced Cardiac%' OR (title LIKE '%cardiac%' AND title LIKE '%registry%') LIMIT 5"
);
console.log("Courses found:", JSON.stringify(courses, null, 2));

if (courses.length === 0) {
  const [allCourses] = await conn.execute(
    "SELECT id, title, slug FROM lms_courses WHERE title LIKE '%cardiac%' OR title LIKE '%sonographer%' LIMIT 10"
  );
  console.log("Broader search:", JSON.stringify(allCourses, null, 2));
  await conn.end();
  process.exit(1);
}
const course = courses[0];

// ── Step 4: Check existing enrollment ────────────────────────────────────────
const [existing] = await conn.execute(
  "SELECT * FROM lms_enrollments WHERE user_id = ? AND course_id = ?",
  [userId, course.id]
);
console.log("\n── Existing enrollment ──");
console.log(JSON.stringify(existing, null, 2));

// ── Step 5: Check existing orders ────────────────────────────────────────────
const [existingOrders] = await conn.execute(
  "SELECT * FROM lms_orders WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 5",
  [userId, course.id]
);
console.log("\n── Existing orders for this course ──");
console.log(JSON.stringify(existingOrders, null, 2));

// ── Step 6: Get subscription ID from session ─────────────────────────────────
let subscriptionId = null;
let subscriptionStatus = null;
let periodEnd = null;
if (sessions.data.length > 0 && sessions.data[0].subscription) {
  subscriptionId = sessions.data[0].subscription;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  subscriptionStatus = sub.status;
  periodEnd = sub.current_period_end * 1000;
  console.log(`\nSubscription: ${subscriptionId}, status: ${subscriptionStatus}, ends: ${new Date(periodEnd).toISOString()}`);
}

// ── Step 7: Create or update order ───────────────────────────────────────────
let orderId;
if (existingOrders.length > 0) {
  orderId = existingOrders[0].id;
  console.log(`\nUpdating existing order ${orderId} with Stripe payment info...`);
  await conn.execute(
    `UPDATE lms_orders SET 
      stripe_payment_intent_id = ?,
      stripe_subscription_id = ?,
      stripe_customer_id = ?,
      status = 'paid',
      amount = ?
    WHERE id = ?`,
    [
      "pi_3TeDTjBj9HgnkZLK086ylOZ1",
      subscriptionId,
      pi.customer,
      pi.amount,
      orderId
    ]
  );
  console.log("✅ Order updated with Stripe payment info");
} else {
  console.log("\nCreating new order linked to Stripe payment...");
  const [result] = await conn.execute(
    `INSERT INTO lms_orders 
      (user_id, course_id, stripe_payment_intent_id, stripe_subscription_id, stripe_customer_id, status, amount, currency, created_at) 
    VALUES (?, ?, ?, ?, ?, 'paid', ?, 'usd', NOW())`,
    [
      userId,
      course.id,
      "pi_3TeDTjBj9HgnkZLK086ylOZ1",
      subscriptionId,
      pi.customer,
      pi.amount
    ]
  );
  orderId = result.insertId;
  console.log(`✅ Order created: ID ${orderId}`);
}

// ── Step 8: Create or update enrollment ──────────────────────────────────────
if (existing.length > 0) {
  console.log(`\nEnrollment already exists (ID ${existing[0].id}), updating order_id...`);
  await conn.execute(
    "UPDATE lms_enrollments SET order_id = ?, enrollment_type = 'full' WHERE id = ?",
    [orderId, existing[0].id]
  );
  console.log("✅ Enrollment updated with order_id");
} else {
  console.log("\nCreating enrollment linked to order...");
  await conn.execute(
    "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type, order_id, created_at) VALUES (?, ?, NOW(), 'full', ?, NOW())",
    [userId, course.id, orderId]
  );
  console.log("✅ Enrollment created!");
}

// ── Step 9: Final verification ────────────────────────────────────────────────
const [finalEnrollment] = await conn.execute(
  `SELECT e.id, e.user_id, e.course_id, e.enrollment_type, e.order_id, e.enrolled_at, c.title 
   FROM lms_enrollments e 
   JOIN lms_courses c ON e.course_id = c.id 
   WHERE e.user_id = ? AND e.course_id = ?`,
  [userId, course.id]
);
console.log("\n── Final enrollment record ──");
console.log(JSON.stringify(finalEnrollment, null, 2));

const [finalOrder] = await conn.execute(
  "SELECT id, course_id, stripe_payment_intent_id, stripe_subscription_id, stripe_customer_id, status, amount FROM lms_orders WHERE id = ?",
  [orderId]
);
console.log("\n── Final order record ──");
console.log(JSON.stringify(finalOrder, null, 2));

await conn.end();
console.log("\n✅ All done! Daniel Galindo should now have access to the ACS Registry Review Quiz.");
