/**
 * Backfill script: Add course access items to membership plans that were
 * created from courses but have no access items yet.
 *
 * For each membership_plan that has a stripe_price_id, find the matching
 * lms_course by stripe_price_id, and insert a membership_plan_access row
 * (item_type='course', item_id=course.id) if one doesn't already exist.
 */

import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

console.log("=== Backfill Plan Access Items ===\n");

// Get all plans that have a stripe_price_id
const [plans] = await db.execute(
  "SELECT id, title, stripe_price_id FROM membership_plans WHERE stripe_price_id IS NOT NULL ORDER BY id"
);

console.log(`Found ${plans.length} plans with Stripe price IDs:\n`);

let created = 0;
let skipped = 0;
let notFound = 0;

for (const plan of plans) {
  // Find the matching course
  const [courses] = await db.execute(
    "SELECT id, title FROM lms_courses WHERE stripe_price_id = ? LIMIT 1",
    [plan.stripe_price_id]
  );

  if (courses.length === 0) {
    console.log(`  [NOT FOUND] Plan ${plan.id} "${plan.title}" — no course found for price ${plan.stripe_price_id}`);
    notFound++;
    continue;
  }

  const course = courses[0];

  // Check if access item already exists
  const [existing] = await db.execute(
    "SELECT id FROM membership_plan_access WHERE plan_id = ? AND item_type = 'course' AND item_id = ?",
    [plan.id, course.id]
  );

  if (existing.length > 0) {
    console.log(`  [SKIP] Plan ${plan.id} "${plan.title}" → Course ${course.id} "${course.title}" (already exists)`);
    skipped++;
    continue;
  }

  // Insert the access item
  await db.execute(
    "INSERT INTO membership_plan_access (plan_id, item_type, item_id, label, sort_order) VALUES (?, 'course', ?, ?, 0)",
    [plan.id, course.id, course.title]
  );

  console.log(`  [CREATED] Plan ${plan.id} "${plan.title}" → Course ${course.id} "${course.title}"`);
  created++;
}

console.log(`\n=== Summary ===`);
console.log(`  Created: ${created}`);
console.log(`  Skipped (already existed): ${skipped}`);
console.log(`  Not found (no matching course): ${notFound}`);

await db.end();
console.log("\nDone.");
