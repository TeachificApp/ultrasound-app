/**
 * seed-archive.mjs
 * Marks all pre-seeded challenges (publishDate = null, status = scheduled)
 * as archived with synthetic publishedAt dates spread over the past 12 months.
 * This makes them appear in the challenge archive for users to browse and replay.
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Fetch all pre-seeded scheduled challenges (no publishDate = they were seeded, not queued by admin)
const [rows] = await conn.execute(
  `SELECT id, category, createdAt FROM quickfireChallenges
   WHERE status = 'scheduled' AND publishDate IS NULL
   ORDER BY category, id`
);

console.log(`Found ${rows.length} pre-seeded challenges to archive.`);

if (rows.length === 0) {
  console.log("Nothing to do.");
  await conn.end();
  process.exit(0);
}

// Spread publishedAt dates over the past 365 days, grouped by category
// so each category has a realistic history of past challenges
const now = Date.now();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_BACK = 365;

// Group by category
const byCategory = {};
for (const row of rows) {
  if (!byCategory[row.category]) byCategory[row.category] = [];
  byCategory[row.category].push(row);
}

const updates = [];
for (const [category, catRows] of Object.entries(byCategory)) {
  const count = catRows.length;
  catRows.forEach((row, i) => {
    // Spread evenly across past 365 days, most recent first
    const daysAgo = Math.round((DAYS_BACK / count) * (count - i));
    const publishedAt = new Date(now - daysAgo * ONE_DAY_MS);
    const archivedAt = new Date(publishedAt.getTime() + ONE_DAY_MS); // archived 1 day after publish
    updates.push({ id: row.id, publishedAt, archivedAt });
  });
}

console.log(`Updating ${updates.length} challenges to archived status...`);

// Batch update in groups of 50
const BATCH = 50;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  for (const u of batch) {
    await conn.execute(
      `UPDATE quickfireChallenges
       SET status = 'archived', publishedAt = ?, archivedAt = ?
       WHERE id = ?`,
      [u.publishedAt, u.archivedAt, u.id]
    );
  }
  console.log(`  Updated ${Math.min(i + BATCH, updates.length)} / ${updates.length}`);
}

// Verify
const [result] = await conn.execute(
  `SELECT status, COUNT(*) as cnt FROM quickfireChallenges GROUP BY status`
);
console.log("Final counts:", JSON.stringify(result));

await conn.end();
console.log("Done.");
