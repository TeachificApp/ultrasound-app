import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL);

// First get column names for users table
const [cols] = await conn.execute("SHOW COLUMNS FROM users");
console.log("=== users columns ===");
console.log(cols.map(c => c.Field).join(', '));

// Find the user
const [users] = await conn.execute("SELECT * FROM users WHERE email = ? LIMIT 1", ['beltranamador@ymail.com']);
console.log("\n=== user record ===");
if (users[0]) {
  // Mask sensitive fields
  const u = {...users[0]};
  if (u.passwordHash) u.passwordHash = '[HASHED]';
  if (u.magicLinkToken) u.magicLinkToken = '[TOKEN]';
  console.log(JSON.stringify(u, null, 2));
} else {
  console.log('NOT FOUND');
}

if (users[0]) {
  const userId = users[0].id;
  
  // Check order-related tables
  const [allTables] = await conn.execute("SHOW TABLES");
  const tableNames = allTables.map(t => Object.values(t)[0]);
  const orderTables = tableNames.filter(t => t.includes('order') || t.includes('purchase') || t.includes('payment') || t.includes('digital'));
  console.log("\n=== relevant tables ===", orderTables);
  
  for (const tbl of orderTables) {
    try {
      const [tCols] = await conn.execute(`SHOW COLUMNS FROM \`${tbl}\``);
      const colNames = tCols.map(c => c.Field);
      const userCol = colNames.find(c => c.toLowerCase().includes('user'));
      if (userCol) {
        const [rows] = await conn.execute(`SELECT * FROM \`${tbl}\` WHERE \`${userCol}\` = ? LIMIT 5`, [userId]);
        if (rows.length > 0) {
          console.log(`\n=== ${tbl} (${rows.length} rows) ===`);
          console.log(JSON.stringify(rows, null, 2));
        }
      }
    } catch(e) { /* skip */ }
  }
  
  // Also check by email in case user_id isn't used
  for (const tbl of orderTables) {
    try {
      const [tCols] = await conn.execute(`SHOW COLUMNS FROM \`${tbl}\``);
      const colNames = tCols.map(c => c.Field);
      const emailCol = colNames.find(c => c.toLowerCase() === 'email');
      if (emailCol) {
        const [rows] = await conn.execute(`SELECT * FROM \`${tbl}\` WHERE \`${emailCol}\` = ? LIMIT 5`, ['beltranamador@ymail.com']);
        if (rows.length > 0) {
          console.log(`\n=== ${tbl} by email (${rows.length} rows) ===`);
          console.log(JSON.stringify(rows, null, 2));
        }
      }
    } catch(e) { /* skip */ }
  }
}

await conn.end();
