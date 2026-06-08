/**
 * Audit script: find all stripe_price_id fields across relevant tables
 * and compare with existing membership plans.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

const tablesToCheck = [
  'lms_courses',
  'lms_pricing_options', 
  'lms_orders',
  'digital_products',
  'digital_bundles',
  'bundles',
  'funnels',
  'funnel_pages',
  'funnel_purchases',
  'physical_products',
  'physical_product_pricing_options',
  'membership_plans',
];

for (const table of tablesToCheck) {
  try {
    const [cols] = await conn.execute(`SHOW COLUMNS FROM ${table}`);
    const colNames = cols.map(c => c.Field);
    const stripeFields = colNames.filter(c => c.toLowerCase().includes('stripe') || c.toLowerCase().includes('price_id') || c.toLowerCase().includes('product_id'));
    if (stripeFields.length > 0) {
      console.log(`\n=== ${table} ===`);
      console.log('Stripe-related columns:', stripeFields.join(', '));
      // Sample a few rows
      const [rows] = await conn.execute(
        `SELECT ${['id', 'title', 'name', 'slug', 'status', ...stripeFields].filter(f => colNames.includes(f)).join(', ')} FROM ${table} LIMIT 10`
      );
      console.table(rows);
    }
  } catch(e) {
    // table doesn't exist, skip
  }
}

// Also check lms_pricing_options specifically
try {
  const [cols] = await conn.execute('SHOW COLUMNS FROM lms_pricing_options');
  console.log('\n=== lms_pricing_options COLUMNS ===');
  console.log(cols.map(c => `${c.Field} (${c.Type})`).join('\n'));
  const [rows] = await conn.execute('SELECT * FROM lms_pricing_options LIMIT 10');
  console.table(rows);
} catch(e) {
  console.log('lms_pricing_options error:', e.message);
}

await conn.end();
