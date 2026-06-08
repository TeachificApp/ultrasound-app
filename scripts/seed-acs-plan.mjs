/**
 * One-time script: create the ACS Registry Review Quiz+ membership plan
 * with the correct Stripe price ID so reconciliation works.
 * Run: node scripts/seed-acs-plan.mjs
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
if (!url) { console.error('No DB URL found in environment'); process.exit(1); }

const conn = await mysql.createConnection(url);

// Check if plan already exists
const [existing] = await conn.execute(
  "SELECT id, title, stripe_price_id FROM membership_plans WHERE stripe_price_id = ? OR slug = ?",
  ['price_1Tf3BTBj9HgnkZLKkMRCrbOj', 'acs-registry-review-quiz-plus']
);

if (existing.length > 0) {
  console.log('Plan already exists:', JSON.stringify(existing[0]));
  // Update stripe_price_id if missing
  if (!existing[0].stripe_price_id) {
    await conn.execute(
      "UPDATE membership_plans SET stripe_price_id = ? WHERE id = ?",
      ['price_1Tf3BTBj9HgnkZLKkMRCrbOj', existing[0].id]
    );
    console.log('Updated stripe_price_id on existing plan ID:', existing[0].id);
  }
  await conn.end();
  process.exit(0);
}

// Insert the plan
const [result] = await conn.execute(
  `INSERT INTO membership_plans 
   (title, slug, brand, description, status, billing_interval, price, currency, stripe_price_id, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    'Advanced Cardiac Sonographer (ACS) Registry Review Quiz+',
    'acs-registry-review-quiz-plus',
    'all_about_ultrasound',
    'Advanced Cardiac Sonographer Registry Review Quiz+ membership providing access to ACS exam preparation materials.',
    'published',
    'monthly',
    9997,
    'usd',
    'price_1Tf3BTBj9HgnkZLKkMRCrbOj',
    10
  ]
);

console.log('Created ACS plan with ID:', result.insertId);

// Show all plans now
const [plans] = await conn.execute("SELECT id, title, status, stripe_price_id FROM membership_plans ORDER BY id");
console.log('\nAll membership plans:');
console.table(plans);

await conn.end();
