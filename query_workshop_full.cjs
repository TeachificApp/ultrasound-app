const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL);
  const [rows] = await conn.execute(
    'SELECT landing_blocks FROM physical_products WHERE id = 30001'
  );
  fs.writeFileSync('/home/ubuntu/workshop_landing_blocks.json', rows[0].landing_blocks || '[]');
  console.log('Done, length:', (rows[0].landing_blocks || '').length);
  await conn.end();
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
