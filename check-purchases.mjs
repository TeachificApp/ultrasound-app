import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

// List all tables
const [tables] = await conn.execute('SHOW TABLES');
const tableNames = tables.map(t => Object.values(t)[0]);
console.log('Tables with "purchase" or "order" or "webhook":', tableNames.filter(t => /purchase|order|webhook|funnel/i.test(t)).join(', '));

// Check funnel_purchases columns
if (tableNames.includes('funnel_purchases')) {
  const [cols] = await conn.execute('SHOW COLUMNS FROM funnel_purchases');
  console.log('\nfunnel_purchases columns:', cols.map(c => c.Field).join(', '));
  const [fp] = await conn.execute('SELECT * FROM funnel_purchases ORDER BY id DESC LIMIT 3');
  console.log('Recent funnel purchases:');
  for (const r of fp) console.log(JSON.stringify(r));
}

// Check digital_purchases
if (tableNames.includes('digital_purchases')) {
  const [dp] = await conn.execute('SELECT dp.*, u.email, p.title FROM digital_purchases dp JOIN users u ON dp.user_id = u.id JOIN digital_products p ON dp.product_id = p.id ORDER BY dp.id DESC LIMIT 5');
  console.log('\nRecent digital purchases:');
  for (const r of dp) console.log(JSON.stringify(r));
}

// Check lms_orders
if (tableNames.includes('lms_orders')) {
  const [lo] = await conn.execute('SELECT lo.*, u.email FROM lms_orders lo JOIN users u ON lo.user_id = u.id ORDER BY lo.id DESC LIMIT 5');
  console.log('\nRecent LMS orders:');
  for (const r of lo) console.log(JSON.stringify(r));
}

await conn.end();
