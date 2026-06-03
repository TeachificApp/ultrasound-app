import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
const conn = await mysql.createConnection(url);

// Step 1: Find all duplicate emails
const [dupes] = await conn.execute(
  "SELECT email, COUNT(*) as cnt, MIN(id) as keep_id, MAX(id) as delete_id FROM users WHERE isPending = 1 GROUP BY email HAVING cnt > 1"
);
console.log('Duplicates to clean:', JSON.stringify(dupes, null, 2));

// Step 2: Delete the higher-ID duplicate (keep the lower ID)
for (const dupe of dupes) {
  console.log(`Deleting duplicate user id=${dupe.delete_id} (email=${dupe.email}), keeping id=${dupe.keep_id}`);
  await conn.execute('DELETE FROM users WHERE id = ?', [dupe.delete_id]);
}

// Step 3: Verify no more duplicates
const [remaining] = await conn.execute(
  "SELECT email, COUNT(*) as cnt FROM users GROUP BY email HAVING cnt > 1"
);
console.log('Remaining duplicates after cleanup:', JSON.stringify(remaining, null, 2));

// Step 4: Add unique index on email (if not already exists)
try {
  await conn.execute('ALTER TABLE users ADD UNIQUE INDEX users_email_unique (email)');
  console.log('Added unique index on users.email');
} catch (err) {
  if (err.code === 'ER_DUP_KEYNAME' || err.sqlMessage?.includes('Duplicate key name')) {
    console.log('Unique index on email already exists');
  } else {
    console.error('Failed to add unique index:', err.message);
  }
}

await conn.end();
console.log('Done!');
