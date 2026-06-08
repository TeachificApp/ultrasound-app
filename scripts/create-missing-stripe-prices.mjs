/**
 * Creates Stripe products + prices for all courses/quizzes/cohorts
 * that have a price set in the DB but no stripe_price_id yet.
 * Then runs syncPlanForCourse to create the membership plan + access item.
 *
 * Courses to process:
 *   [1]      Ultrasound Physics SPI Review Quiz         $39.97/month
 *   [60001]  From Sonographer to CEO                    $97 one-time  (user confirmed $97)
 *   [300001] Fetal Echocardiography - Registry Review Quiz $49.97/month
 *   [330001] Abdomen Ultrasound - Registry Review Quiz  $39.97/month
 *   [360001] OB-GYN Ultrasound - Registry Review Quiz   $39.97/month
 *   [420002] Vascular Ultrasound - Registry Review Quiz $39.97/month
 *   [480002] LIVE Adult Echo - 12 Week Cross Training   $1997 one-time
 *   [540001] ACS Mastery Course                         $1497 one-time
 */

import Stripe from "stripe";
import mysql from "mysql2/promise";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = await mysql.createConnection(process.env.DATABASE_URL);

const COURSES = [
  { id: 1,      name: "Ultrasound Physics SPI Review Quiz",                    amountCents: 3997,  interval: "month",  type: "quiz"   },
  { id: 60001,  name: "From Sonographer to CEO",                               amountCents: 9700,  interval: null,     type: "course" },
  { id: 300001, name: "Fetal Echocardiography - Registry Review Quiz",         amountCents: 4997,  interval: "month",  type: "quiz"   },
  { id: 330001, name: "Abdomen Ultrasound - Registry Review Quiz",             amountCents: 3997,  interval: "month",  type: "quiz"   },
  { id: 360001, name: "OB-GYN Ultrasound - Registry Review Quiz",              amountCents: 3997,  interval: "month",  type: "quiz"   },
  { id: 420002, name: "Vascular Ultrasound - Registry Review Quiz",            amountCents: 3997,  interval: "month",  type: "quiz"   },
  { id: 480002, name: "LIVE Adult Echocardiography - 12 Week Cross Training",  amountCents: 199700, interval: null,    type: "cohort" },
  { id: 540001, name: "Advanced Cardiac Sonographer (ACS) - Mastery Course",  amountCents: 149700, interval: null,    type: "course" },
];

console.log("=== Create Missing Stripe Prices ===\n");

let created = 0;
let skipped = 0;

for (const course of COURSES) {
  // Check if already has a stripe_price_id
  const [rows] = await db.execute(
    "SELECT id, title, stripe_price_id FROM lms_courses WHERE id = ?",
    [course.id]
  );
  const row = rows[0];
  if (!row) { console.log(`  [SKIP] Course ${course.id} not found`); skipped++; continue; }
  if (row.stripe_price_id) {
    console.log(`  [SKIP] [${course.id}] ${row.title} — already has price ${row.stripe_price_id}`);
    skipped++;
    continue;
  }

  console.log(`  [CREATE] [${course.id}] ${course.name}`);

  // Create Stripe product
  const stripeProduct = await stripe.products.create({
    name: course.name,
    metadata: { course_id: String(course.id), course_type: course.type, platform: "allaboutultrasound" },
  });

  // Create Stripe price
  const priceParams = {
    product: stripeProduct.id,
    unit_amount: course.amountCents,
    currency: "usd",
    metadata: { course_id: String(course.id) },
  };
  if (course.interval) {
    priceParams.recurring = { interval: course.interval };
  }
  const stripePrice = await stripe.prices.create(priceParams);

  console.log(`    → product: ${stripeProduct.id}`);
  console.log(`    → price:   ${stripePrice.id} ($${(course.amountCents/100).toFixed(2)}${course.interval ? '/'+course.interval : ' one-time'})`);

  // Write stripe IDs back to lms_courses
  await db.execute(
    "UPDATE lms_courses SET stripe_price_id = ? WHERE id = ?",
    [stripePrice.id, course.id]
  );

  // Create membership plan + access item
  const slug = course.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const billingInterval = course.interval === "month" ? "monthly" : "one_time";
  const priceDisplay = course.amountCents / 100;

  // Check if plan already exists for this price
  const [existingPlans] = await db.execute(
    "SELECT id FROM membership_plans WHERE stripe_price_id = ?",
    [stripePrice.id]
  );

  let planId;
  if (existingPlans.length > 0) {
    planId = existingPlans[0].id;
    console.log(`    → plan already exists: id=${planId}`);
  } else {
    const [planResult] = await db.execute(
      `INSERT INTO membership_plans
        (title, slug, status, billing_interval, price, currency, stripe_price_id, sort_order)
       VALUES (?, ?, 'published', ?, ?, 'usd', ?, 0)`,
      [course.name, slug, billingInterval, priceDisplay, stripePrice.id]
    );
    planId = planResult.insertId;
    console.log(`    → plan created: id=${planId}`);
  }

  // Add course as access item (item_type based on course type)
  const itemType = course.type === "quiz" ? "quiz" : course.type === "cohort" ? "cohort" : "course";
  const [existingAccess] = await db.execute(
    "SELECT id FROM membership_plan_access WHERE plan_id = ? AND item_type = ? AND item_id = ?",
    [planId, itemType, course.id]
  );
  if (existingAccess.length === 0) {
    await db.execute(
      "INSERT INTO membership_plan_access (plan_id, item_type, item_id, label, sort_order) VALUES (?, ?, ?, ?, 0)",
      [planId, itemType, course.id, course.name]
    );
    console.log(`    → access item added: ${itemType} id=${course.id}`);
  } else {
    console.log(`    → access item already exists`);
  }

  created++;
}

console.log(`\n=== Summary ===`);
console.log(`  Created: ${created}`);
console.log(`  Skipped: ${skipped}`);

await db.end();
console.log("\nDone.");
