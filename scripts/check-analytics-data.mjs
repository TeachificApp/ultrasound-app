import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL;
const conn = await mysql.createConnection(url);

const queries = [
  ['Total users', 'SELECT COUNT(*) as c FROM users'],
  ['Users with lastSignedIn', 'SELECT COUNT(*) as c FROM users WHERE lastSignedIn IS NOT NULL'],
  ['Active (30d)', 'SELECT COUNT(*) as c FROM users WHERE lastSignedIn >= DATE_SUB(NOW(), INTERVAL 30 DAY)'],
  ['Enrollments', 'SELECT COUNT(*) as c FROM lms_enrollments'],
  ['Completions', 'SELECT COUNT(*) as c FROM lms_enrollments WHERE completed_at IS NOT NULL'],
  ['Paid orders', 'SELECT COUNT(*) as c FROM lms_orders WHERE status="paid"'],
  ['Revenue ($)', 'SELECT IFNULL(SUM(amount),0)/100 as c FROM lms_orders WHERE status="paid"'],
  ['Certificates', 'SELECT COUNT(*) as c FROM lms_certificates'],
  ['New this month', 'SELECT COUNT(*) as c FROM users WHERE created_at >= DATE_FORMAT(NOW(), \'%Y-%m-01\')'],
  ['Courses', 'SELECT COUNT(*) as c FROM lms_courses WHERE status="published"'],
];

for (const [label, q] of queries) {
  const [rows] = await conn.execute(q);
  console.log(`${label}: ${rows[0].c}`);
}

// Course breakdown
const [courseRows] = await conn.execute(`
  SELECT c.title, COUNT(e.id) as enrollments, 
    SUM(CASE WHEN e.completed_at IS NOT NULL THEN 1 ELSE 0 END) as completions,
    ROUND(AVG(e.progress_pct),1) as avg_progress
  FROM lms_courses c
  LEFT JOIN lms_enrollments e ON e.course_id = c.id
  WHERE c.status = 'published'
  GROUP BY c.id, c.title
  ORDER BY enrollments DESC
  LIMIT 10
`);
console.log('\nTop courses:');
for (const r of courseRows) {
  console.log(`  ${r.title}: ${r.enrollments} enrolled, ${r.completions} completed, ${r.avg_progress}% avg progress`);
}

await conn.end();
