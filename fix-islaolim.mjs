import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config({ path: '.env' });

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
const conn = await createConnection(url);

console.log('=== Finding islaolim@icloud.com accounts ===');
const [rows] = await conn.query(
  'SELECT id, email, name, created_at, is_pending FROM users WHERE email = ? ORDER BY id ASC',
  ['islaolim@icloud.com']
);
console.log('Accounts found:', rows.length);
for (const r of rows) {
  console.log(`  ID=${r.id} name=${r.name} is_pending=${r.is_pending} created=${r.created_at}`);
  
  const [enr] = await conn.query('SELECT COUNT(*) as cnt FROM lms_enrollments WHERE user_id = ?', [r.id]);
  const [subs] = await conn.query('SELECT COUNT(*) as cnt FROM membership_subscriptions WHERE user_id = ?', [r.id]);
  const [brand] = await conn.query('SELECT COUNT(*) as cnt FROM brand_memberships WHERE user_id = ?', [r.id]);
  console.log(`    enrollments=${enr[0].cnt} subscriptions=${subs[0].cnt} brand_memberships=${brand[0].cnt}`);
}

if (rows.length > 1) {
  // Keep the one with more data, or the first one if equal
  const keepId = rows[0].id;
  const deleteIds = rows.slice(1).map(r => r.id);
  
  for (const deleteId of deleteIds) {
    const [enr] = await conn.query('SELECT COUNT(*) as cnt FROM lms_enrollments WHERE user_id = ?', [deleteId]);
    const [subs] = await conn.query('SELECT COUNT(*) as cnt FROM membership_subscriptions WHERE user_id = ?', [deleteId]);
    
    if (enr[0].cnt === 0 && subs[0].cnt === 0) {
      // Safe to delete
      await conn.query('DELETE FROM users WHERE id = ?', [deleteId]);
      console.log(`\n✓ Deleted duplicate user ID ${deleteId} (no data)`);
    } else {
      // Move data to keepId first
      console.log(`\nMoving data from ID ${deleteId} to ID ${keepId}...`);
      await conn.query('UPDATE lms_enrollments SET user_id = ? WHERE user_id = ?', [keepId, deleteId]);
      await conn.query('UPDATE membership_subscriptions SET user_id = ? WHERE user_id = ?', [keepId, deleteId]);
      await conn.query('UPDATE brand_memberships SET user_id = ? WHERE user_id = ?', [keepId, deleteId]);
      await conn.query('DELETE FROM users WHERE id = ?', [deleteId]);
      console.log(`✓ Merged ID ${deleteId} into ID ${keepId} and deleted duplicate`);
    }
  }
}

// Verify final state
const [final] = await conn.query(
  'SELECT id, email, name, is_pending FROM users WHERE email = ? ORDER BY id ASC',
  ['islaolim@icloud.com']
);
console.log('\n=== Final state ===');
for (const r of final) {
  console.log(`  ID=${r.id} email=${r.email} is_pending=${r.is_pending}`);
}

await conn.end();
console.log('\nDone.');
