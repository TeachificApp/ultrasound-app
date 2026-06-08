import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config({ path: '.env' });

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await createConnection(url);

// Find all islaolim accounts
const [rows] = await conn.query(
  'SELECT id, email, name, created_at, is_pending FROM users WHERE email = ? ORDER BY id ASC',
  ['islaolim@icloud.com']
);
console.log('Found accounts:', JSON.stringify(rows, null, 2));

// If there are duplicates, delete the higher ID one (keep the lower/first one)
if (rows.length > 1) {
  const keepId = rows[0].id;
  const deleteIds = rows.slice(1).map(r => r.id);
  console.log(`Keeping ID ${keepId}, deleting IDs: ${deleteIds.join(', ')}`);
  
  for (const deleteId of deleteIds) {
    // Check if the account to delete has any enrollments/subscriptions
    const [enrollments] = await conn.query('SELECT COUNT(*) as cnt FROM enrollments WHERE user_id = ?', [deleteId]);
    const [subs] = await conn.query('SELECT COUNT(*) as cnt FROM membership_subscriptions WHERE user_id = ?', [deleteId]);
    console.log(`ID ${deleteId}: ${enrollments[0].cnt} enrollments, ${subs[0].cnt} subscriptions`);
    
    if (enrollments[0].cnt === 0 && subs[0].cnt === 0) {
      await conn.query('DELETE FROM users WHERE id = ?', [deleteId]);
      console.log(`Deleted duplicate user ID ${deleteId}`);
    } else {
      console.log(`ID ${deleteId} has data — skipping delete, needs manual merge`);
    }
  }
}

await conn.end();
