/**
 * seed-missing-plans.mjs
 * Creates membership plans for all LMS courses that have a stripe_price_id
 * but no corresponding membership_plan row.
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

// Get all courses with stripe_price_id
const [courses] = await conn.query(
  "SELECT id, title, stripe_price_id FROM lms_courses WHERE stripe_price_id IS NOT NULL AND stripe_price_id != ''"
);

console.log(`Found ${courses.length} courses with stripe_price_id`);

let created = 0;
let skipped = 0;

for (const course of courses) {
  // Check if plan already exists for this price ID
  const [existing] = await conn.query(
    "SELECT id, title FROM membership_plans WHERE stripe_price_id = ?",
    [course.stripe_price_id]
  );
  
  if (existing.length > 0) {
    console.log(`  SKIP: "${course.title}" → plan already exists (id=${existing[0].id})`);
    skipped++;
    continue;
  }

  // Create slug
  let slug = course.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  
  // Check slug conflict
  const [slugConflict] = await conn.query(
    "SELECT id FROM membership_plans WHERE slug = ?",
    [slug]
  );
  if (slugConflict.length > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  await conn.query(
    `INSERT INTO membership_plans 
      (title, slug, brand, status, billing_interval, price, stripe_price_id, trial_days, accent_color, created_at, updated_at)
     VALUES (?, ?, 'all_about_ultrasound', 'published', 'monthly', 0, ?, 0, '#189aa1', NOW(), NOW())`,
    [course.title, slug, course.stripe_price_id]
  );

  console.log(`  CREATE: "${course.title}" → stripe_price_id=${course.stripe_price_id}`);
  created++;
}

console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
await conn.end();
