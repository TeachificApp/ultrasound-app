import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check all Breast scenario questions
const [breastQs] = await conn.execute(
  "SELECT id, isActive, deletedAt, submissionStatus, LEFT(question,80) as q FROM quickfireQuestions WHERE category='Breast' AND type='scenario' ORDER BY createdAt DESC LIMIT 20"
);
console.log('Breast scenario questions:', JSON.stringify(breastQs, null, 2));

// Check all POCUS scenario questions
const [pocusQs] = await conn.execute(
  "SELECT id, isActive, deletedAt, submissionStatus, LEFT(question,80) as q FROM quickfireQuestions WHERE category='POCUS' AND type='scenario' ORDER BY createdAt DESC LIMIT 20"
);
console.log('POCUS scenario questions:', JSON.stringify(pocusQs, null, 2));

// Check which challenges use these question IDs
const breastIds = breastQs.map(q => q.id);
const pocusIds = pocusQs.map(q => q.id);
const allIds = [...breastIds, ...pocusIds];

if (allIds.length > 0) {
  const [challenges] = await conn.execute(
    "SELECT id, title, status, category, questionIds FROM quickfireChallenges WHERE status IN ('draft','scheduled','live')"
  );
  for (const ch of challenges) {
    const ids = JSON.parse(ch.questionIds || '[]');
    const conflict = ids.filter(id => allIds.includes(id));
    if (conflict.length > 0) {
      console.log(`Challenge ${ch.id} (${ch.status}) uses question IDs: ${conflict}`);
    }
  }
}

await conn.end();
