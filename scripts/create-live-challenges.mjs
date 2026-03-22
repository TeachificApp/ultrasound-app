import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all question IDs already used in active challenges
const [activeChallenges] = await conn.execute(
  "SELECT questionIds FROM quickfireChallenges WHERE status IN ('draft','scheduled','live')"
);
const usedIds = new Set();
for (const ch of activeChallenges) {
  try { JSON.parse(ch.questionIds || '[]').forEach(id => usedIds.add(id)); } catch {}
}

// Find available Breast scenario questions
const [breastQs] = await conn.execute(
  "SELECT id, LEFT(question,100) as q FROM quickfireQuestions WHERE category='Breast' AND type='scenario' AND isActive=1 AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 10"
);
const breastAvail = breastQs.filter(q => !usedIds.has(q.id));

// Find available POCUS scenario questions
const [pocusQs] = await conn.execute(
  "SELECT id, LEFT(question,100) as q FROM quickfireQuestions WHERE category='POCUS' AND type='scenario' AND isActive=1 AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 10"
);
const pocusAvail = pocusQs.filter(q => !usedIds.has(q.id));

console.log('Breast available:', JSON.stringify(breastAvail, null, 2));
console.log('POCUS available:', JSON.stringify(pocusAvail, null, 2));

// Create live challenges if questions are available
const today = new Date().toISOString().split('T')[0];

if (breastAvail.length > 0) {
  const q = breastAvail[0];
  await conn.execute(
    "INSERT INTO quickfireChallenges (title, description, questionIds, priority, category, status, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'live', NOW(), NOW(), NOW())",
    [`Breast Daily Challenge — ${today}`, 'Daily breast ultrasound challenge', JSON.stringify([q.id]), 100, 'Breast']
  );
  console.log(`Created live Breast challenge with question ID ${q.id}`);
} else {
  console.log('No available Breast scenario questions — skipping');
}

if (pocusAvail.length > 0) {
  const q = pocusAvail[0];
  await conn.execute(
    "INSERT INTO quickfireChallenges (title, description, questionIds, priority, category, status, publishedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'live', NOW(), NOW(), NOW())",
    [`POCUS Daily Challenge — ${today}`, 'Daily POCUS challenge', JSON.stringify([q.id]), 100, 'POCUS']
  );
  console.log(`Created live POCUS challenge with question ID ${q.id}`);
} else {
  console.log('No available POCUS scenario questions — skipping');
}

// Verify live challenges
const [liveChallenges] = await conn.execute(
  "SELECT id, title, category, status FROM quickfireChallenges WHERE status='live' ORDER BY category"
);
console.log('\nAll live challenges:', JSON.stringify(liveChallenges, null, 2));

await conn.end();
