import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

// Check webhookEvents structure
const [cols] = await conn.execute("SHOW COLUMNS FROM webhookEvents");
console.log("webhookEvents columns:", cols.map(c => c.Field).join(', '));

// Get recent events
const [rows] = await conn.execute("SELECT * FROM webhookEvents ORDER BY id DESC LIMIT 10");
console.log("\nRecent webhookEvents:");
for (const r of rows) {
  const keys = Object.keys(r);
  const summary = {};
  for (const k of keys) {
    if (k === 'payload' || k === 'body' || k === 'data') {
      const val = r[k] ? String(r[k]).substring(0, 200) : null;
      summary[k] = val;
    } else {
      summary[k] = r[k];
    }
  }
  console.log(JSON.stringify(summary));
}

// Search for beltran in all webhook payloads
console.log("\nSearching for beltran in webhook payloads...");
const payloadCol = cols.find(c => ['payload', 'body', 'data', 'raw_body'].includes(c.Field.toLowerCase()));
if (payloadCol) {
  const [found] = await conn.execute(`SELECT * FROM webhookEvents WHERE \`${payloadCol.Field}\` LIKE ? LIMIT 5`, ['%beltran%']);
  console.log("Found:", found.length, "events with beltran");
  for (const r of found) {
    console.log(JSON.stringify({...r, [payloadCol.Field]: String(r[payloadCol.Field]).substring(0, 500)}));
  }
}

// Also check digital_purchases more carefully - look for product_id=1 (the eBook)
console.log("\nAll digital_purchases for product_id=1 (eBook):");
const [ebookPurchases] = await conn.execute("SELECT dp.*, u.email, u.name FROM digital_purchases dp LEFT JOIN users u ON u.id = dp.user_id WHERE dp.product_id = 1 ORDER BY dp.id DESC LIMIT 10");
console.log(JSON.stringify(ebookPurchases, null, 2));

await conn.end();
