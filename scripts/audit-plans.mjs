import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
if (!url) { console.error('No DB URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

// 1. Existing membership plans
const [plans] = await conn.execute(
  'SELECT id, title, slug, status, stripe_price_id, brand FROM membership_plans ORDER BY id'
);
console.log('\n=== MEMBERSHIP PLANS ===');
console.log(JSON.stringify(plans, null, 2));

// 2. Published courses (from thinkific_courses or lms_courses table)
try {
  const [courses] = await conn.execute(
    "SELECT id, title, slug, status, stripe_price_id FROM lms_courses WHERE status = 'published' ORDER BY id LIMIT 50"
  );
  console.log('\n=== PUBLISHED LMS COURSES ===');
  console.log(JSON.stringify(courses, null, 2));
} catch(e) {
  console.log('\n=== PUBLISHED LMS COURSES === (table not found:', e.message, ')');
}

// 3. Funnel flows
try {
  const [funnels] = await conn.execute(
    "SELECT id, title, slug, status, stripe_price_id FROM funnel_flows ORDER BY id LIMIT 50"
  );
  console.log('\n=== FUNNEL FLOWS ===');
  console.log(JSON.stringify(funnels, null, 2));
} catch(e) {
  console.log('\n=== FUNNEL FLOWS === (table not found:', e.message, ')');
}

// 4. All tables in DB to understand schema
const [tables] = await conn.execute("SHOW TABLES");
console.log('\n=== ALL TABLES ===');
console.log(tables.map(r => Object.values(r)[0]).join('\n'));

await conn.end();
