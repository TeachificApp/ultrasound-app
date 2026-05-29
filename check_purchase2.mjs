import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

const email = 'beltranamador@ymail.com';

// Check digital_purchases table
try {
  const [cols] = await conn.execute("SHOW COLUMNS FROM digital_purchases");
  console.log("digital_purchases columns:", cols.map(c => c.Field).join(', '));
  
  // Check by email
  const emailCol = cols.find(c => c.Field.toLowerCase() === 'email' || c.Field.toLowerCase() === 'customer_email');
  if (emailCol) {
    const [rows] = await conn.execute(`SELECT * FROM digital_purchases WHERE \`${emailCol.Field}\` = ? LIMIT 5`, [email]);
    console.log("digital_purchases by email:", JSON.stringify(rows, null, 2));
  }
  
  // Show recent rows
  const [recent] = await conn.execute("SELECT * FROM digital_purchases ORDER BY id DESC LIMIT 5");
  console.log("Recent digital_purchases:", JSON.stringify(recent, null, 2));
} catch(e) { console.log("digital_purchases error:", e.message); }

// Check lms_orders table
try {
  const [cols] = await conn.execute("SHOW COLUMNS FROM lms_orders");
  console.log("\nlms_orders columns:", cols.map(c => c.Field).join(', '));
  
  const emailCol = cols.find(c => c.Field.toLowerCase() === 'email' || c.Field.toLowerCase() === 'customer_email');
  if (emailCol) {
    const [rows] = await conn.execute(`SELECT * FROM lms_orders WHERE \`${emailCol.Field}\` = ? LIMIT 5`, [email]);
    console.log("lms_orders by email:", JSON.stringify(rows, null, 2));
  }
  
  const [recent] = await conn.execute("SELECT * FROM lms_orders ORDER BY id DESC LIMIT 5");
  console.log("Recent lms_orders:", JSON.stringify(recent, null, 2));
} catch(e) { console.log("lms_orders error:", e.message); }

// Check Stripe webhook events for this email
try {
  const [cols] = await conn.execute("SHOW COLUMNS FROM webhookEvents");
  console.log("\nwebhookEvents columns:", cols.map(c => c.Field).join(', '));
  const [recent] = await conn.execute("SELECT * FROM webhookEvents ORDER BY id DESC LIMIT 5");
  console.log("Recent webhookEvents:", JSON.stringify(recent.map(r => ({...r, payload: r.payload ? r.payload.substring(0, 200) : null})), null, 2));
} catch(e) { console.log("webhookEvents error:", e.message); }

// Check thinkificWebhookEvents
try {
  const [recent] = await conn.execute("SELECT * FROM thinkificWebhookEvents ORDER BY id DESC LIMIT 3");
  console.log("\nRecent thinkificWebhookEvents:", JSON.stringify(recent.map(r => ({...r, payload: r.payload ? r.payload.substring(0, 200) : null})), null, 2));
} catch(e) { console.log("thinkificWebhookEvents error:", e.message); }

await conn.end();
