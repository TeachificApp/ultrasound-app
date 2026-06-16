const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL);
  const [rows] = await conn.execute(
    'SELECT id, slug, title, subtitle, thumbnail_url, price, compare_at_price, is_free, currency, status, landing_headline, LEFT(landing_blocks, 200) as lb_preview, meta_title, meta_description, publish_domain FROM physical_products WHERE id = 30001'
  );
  fs.writeFileSync('/home/ubuntu/workshop_product.json', JSON.stringify(rows[0], null, 2));
  console.log('Done');
  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
