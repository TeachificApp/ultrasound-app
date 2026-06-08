import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL;
const conn = await createConnection(url);

// Find lesson blocks that reference pediatric echo SCORM
const [rows] = await conn.execute(`
  SELECT lb.id, lb.lessonId, lb.blockType, lb.content, l.title as lessonTitle
  FROM lmsLessonBlocks lb
  JOIN lmsLessons l ON l.id = lb.lessonId
  WHERE lb.content LIKE '%pediatric-echo%' OR lb.content LIKE '%unlimited-registry%'
  LIMIT 20
`);

console.log(`Found ${rows.length} blocks`);
for (const r of rows) {
  console.log(`\nBlock ${r.id} (lesson: ${r.lessonTitle})`);
  console.log(`  Type: ${r.blockType}`);
  // Parse content to find the embed URL
  try {
    const content = JSON.parse(r.content);
    console.log(`  Content:`, JSON.stringify(content).substring(0, 300));
  } catch {
    console.log(`  Raw:`, String(r.content).substring(0, 300));
  }
}

await conn.end();
