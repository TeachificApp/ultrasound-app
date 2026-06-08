/**
 * fix-islaolim-enrollment.mjs
 * 1. Add ACS course as access item to the ACS membership plan
 * 2. Enroll islaolim@icloud.com in the ACS course
 * 3. Create a transaction record for the $99.97 payment
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Find user
const [[user]] = await conn.query(
  "SELECT id, email FROM users WHERE email = ?",
  ["islaolim@icloud.com"]
);
if (!user) throw new Error("User not found");
console.log(`User: id=${user.id}, email=${user.email}`);

// 2. Find ACS Quiz course
const [[course]] = await conn.query(
  "SELECT id, title, stripe_price_id FROM lms_courses WHERE stripe_price_id = 'price_1Tf3BTBj9HgnkZLKkMRCrbOj' LIMIT 1"
);
if (!course) throw new Error("ACS Quiz course not found");
console.log(`Course: id=${course.id}, title="${course.title}"`);

// 3. Find the ACS membership plan
const [[plan]] = await conn.query(
  "SELECT id, title FROM membership_plans WHERE stripe_price_id = 'price_1Tf3BTBj9HgnkZLKkMRCrbOj' LIMIT 1"
);
if (!plan) throw new Error("ACS plan not found");
console.log(`Plan: id=${plan.id}, title="${plan.title}"`);

// 4. Check if course access item already exists for this plan
const [[existingItem]] = await conn.query(
  "SELECT id FROM membership_plan_access WHERE plan_id = ? AND item_type = 'course' AND item_id = ?",
  [plan.id, course.id]
);

if (!existingItem) {
  await conn.query(
    "INSERT INTO membership_plan_access (plan_id, item_type, item_id, label, sort_order) VALUES (?, 'course', ?, ?, 0)",
    [plan.id, course.id, course.title]
  );
  console.log(`✓ Added course access item to plan ${plan.id}`);
} else {
  console.log(`  Course access item already exists (id=${existingItem.id})`);
}

// 5. Check if enrollment already exists
const [[existingEnrollment]] = await conn.query(
  "SELECT id FROM lms_enrollments WHERE user_id = ? AND course_id = ?",
  [user.id, course.id]
);

if (!existingEnrollment) {
  await conn.query(
    "INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, enrollment_type) VALUES (?, ?, NOW(), 'full')",
    [user.id, course.id]
  );
  console.log(`✓ Enrolled user ${user.id} in course ${course.id}`);
} else {
  console.log(`  Enrollment already exists (id=${existingEnrollment.id})`);
}

// 6. Check if a transaction already exists
const [[existingTx]] = await conn.query(
  "SELECT id FROM lms_orders WHERE user_id = ? AND stripe_subscription_id = ?",
  [user.id, "sub_1Tg4osBj9HgnkZLKAF9B84xu"]
);

if (!existingTx) {
  await conn.query(
    "INSERT INTO lms_orders (user_id, course_id, amount, currency, status, stripe_subscription_id, created_at, updated_at) VALUES (?, ?, 9997, 'usd', 'paid', ?, NOW(), NOW())",
    [user.id, course.id, "sub_1Tg4osBj9HgnkZLKAF9B84xu"]
  );
  console.log(`✓ Created transaction record ($99.97)`);
} else {
  console.log(`  Transaction already exists (id=${existingTx.id})`);
}

await conn.end();
console.log("\nDone.");
