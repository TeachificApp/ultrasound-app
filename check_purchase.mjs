import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

const email = 'beltranamador@ymail.com';

// List all tables
const [allTables] = await conn.execute("SHOW TABLES");
const tableNames = allTables.map(t => Object.values(t)[0]);
console.log("All tables:", tableNames.join(', '));

// Search every table that might have email or stripe data
const relevantTables = tableNames.filter(t => 
  t.includes('order') || t.includes('purchase') || t.includes('payment') || 
  t.includes('digital') || t.includes('stripe') || t.includes('checkout') ||
  t.includes('lead') || t.includes('guest') || t.includes('transaction')
);
console.log("\nRelevant tables:", relevantTables.join(', '));

for (const tbl of relevantTables) {
  try {
    const [tCols] = await conn.execute(`SHOW COLUMNS FROM \`${tbl}\``);
    const colNames = tCols.map(c => c.Field);
    console.log(`\n--- ${tbl} columns: ${colNames.join(', ')}`);
    
    // Search by email if column exists
    const emailCol = colNames.find(c => c.toLowerCase() === 'email' || c.toLowerCase() === 'customer_email');
    if (emailCol) {
      const [rows] = await conn.execute(`SELECT * FROM \`${tbl}\` WHERE \`${emailCol}\` = ? LIMIT 5`, [email]);
      if (rows.length > 0) {
        console.log(`FOUND in ${tbl}:`, JSON.stringify(rows, null, 2));
      }
    }
    
    // Also show recent rows to understand structure
    const [recent] = await conn.execute(`SELECT * FROM \`${tbl}\` ORDER BY id DESC LIMIT 3`);
    if (recent.length > 0) {
      console.log(`Recent rows in ${tbl}:`, JSON.stringify(recent, null, 2));
    }
  } catch(e) { console.log(`Error on ${tbl}:`, e.message); }
}

// Also check stripe_events or webhook logs
try {
  const [logs] = await conn.execute("SELECT * FROM stripe_events ORDER BY id DESC LIMIT 5");
  console.log("\nRecent stripe_events:", JSON.stringify(logs, null, 2));
} catch(e) { console.log("No stripe_events table:", e.message); }

await conn.end();
