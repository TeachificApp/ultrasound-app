import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
const conn = await mysql.createConnection(url);

// Step 1: Find ALL duplicate emails (not just pending)
const [dupes] = await conn.execute(
  `SELECT MIN(email) as email, COUNT(*) as cnt, MIN(id) as keep_id, GROUP_CONCAT(id ORDER BY id ASC) as all_ids
   FROM users 
   WHERE email IS NOT NULL AND email != ''
   GROUP BY LOWER(email) 
   HAVING cnt > 1
   ORDER BY cnt DESC`
);
console.log(`Found ${dupes.length} duplicate email groups`);
console.log(JSON.stringify(dupes, null, 2));

// Step 2: For each duplicate group, keep the lowest ID and delete the rest
let totalDeleted = 0;
for (const dupe of dupes) {
  const allIds = dupe.all_ids.split(',').map(Number);
  const keepId = dupe.keep_id;
  const deleteIds = allIds.filter(id => id !== keepId);
  
  console.log(`\nEmail: ${dupe.email} — keeping id=${keepId}, deleting ids=${deleteIds.join(',')}`);
  
  for (const deleteId of deleteIds) {
    // Check if the account to delete has any enrollments, orders, or other data
    const [enrollments] = await conn.execute('SELECT COUNT(*) as cnt FROM lms_enrollments WHERE user_id = ?', [deleteId]);
    const [orders] = await conn.execute('SELECT COUNT(*) as cnt FROM lms_orders WHERE user_id = ?', [deleteId]);
    
    if (enrollments[0].cnt > 0 || orders[0].cnt > 0) {
      // Reassign data to the kept account before deleting
      console.log(`  Reassigning ${enrollments[0].cnt} enrollments and ${orders[0].cnt} orders from id=${deleteId} to id=${keepId}`);
      await conn.execute('UPDATE lms_enrollments SET user_id = ? WHERE user_id = ? AND course_id NOT IN (SELECT course_id FROM lms_enrollments WHERE user_id = ?)', [keepId, deleteId, keepId]);
      await conn.execute('UPDATE lms_orders SET user_id = ? WHERE user_id = ?', [keepId, deleteId]);
    }
    
    await conn.execute('DELETE FROM users WHERE id = ?', [deleteId]);
    console.log(`  Deleted user id=${deleteId}`);
    totalDeleted++;
  }
}

console.log(`\nTotal deleted: ${totalDeleted}`);

// Step 3: Verify
const [remaining] = await conn.execute(
  "SELECT MIN(email) as email, COUNT(*) as cnt FROM users WHERE email IS NOT NULL AND email != '' GROUP BY LOWER(email) HAVING cnt > 1"
);
console.log(`Remaining duplicates: ${remaining.length}`);
if (remaining.length > 0) {
  console.log(JSON.stringify(remaining, null, 2));
}

await conn.end();
console.log('Done!');
