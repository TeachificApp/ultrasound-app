import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL);

function expandSessions(parent) {
  const allowedDays = parent.recurrence_days_of_week
    ? parent.recurrence_days_of_week.split(',').map(Number).filter(n => !isNaN(n))
    : [];
  const weekIntervalDays = parent.recurrence_rule === 'biweekly' ? 14 : 7;
  const parentDate = new Date(parent.session_date);
  const endDate = parent.recurrence_end_date ? new Date(parent.recurrence_end_date) : null;
  const maxCount = parent.recurrence_occurrence_count ?? 999;
  let occurrenceNum = 1;
  const instances = [];

  if (parent.recurrence_rule === 'monthly') {
    let current = new Date(parentDate);
    while (occurrenceNum < maxCount) {
      current = new Date(current);
      current.setMonth(current.getMonth() + 1);
      if (endDate && current > endDate) break;
      occurrenceNum++;
      instances.push({ ...baseFields(parent, occurrenceNum), session_date: new Date(current) });
    }
  } else if (allowedDays.length >= 1) {
    const parentDay = parentDate.getDay();
    const weekStart = new Date(parentDate);
    weekStart.setDate(weekStart.getDate() - parentDay);
    weekStart.setHours(0, 0, 0, 0);
    const parentTime = { h: parentDate.getHours(), m: parentDate.getMinutes(), s: parentDate.getSeconds() };
    const sortedDays = [...allowedDays].sort((a, b) => a - b);
    // +1 day to make end date inclusive (end date is midnight UTC, sessions are at a specific time)
    const inclusiveEndDate = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;
    let weekOffset = 0;
    let done = false;
    while (!done && occurrenceNum < maxCount) {
      for (const d of sortedDays) {
        const c = new Date(weekStart);
        c.setDate(c.getDate() + weekOffset * weekIntervalDays + d);
        c.setHours(parentTime.h, parentTime.m, parentTime.s, 0);
        if (c <= parentDate) continue;
        if (inclusiveEndDate && c >= inclusiveEndDate) { done = true; break; }
        if (occurrenceNum >= maxCount) { done = true; break; }
        occurrenceNum++;
        instances.push({ ...baseFields(parent, occurrenceNum), session_date: new Date(c) });
      }
      weekOffset++;
      if (weekOffset > 520) break;
    }
  } else {
    // No days specified — same day as parent
    let current = new Date(parentDate);
    while (occurrenceNum < maxCount) {
      current = new Date(current.getTime() + weekIntervalDays * 24 * 60 * 60 * 1000);
      if (endDate && current > endDate) break;
      occurrenceNum++;
      instances.push({ ...baseFields(parent, occurrenceNum), session_date: new Date(current) });
    }
  }
  return instances;
}

function baseFields(parent, num) {
  return {
    course_id: parent.course_id,
    cohort_group_id: parent.cohort_group_id,
    title: `${parent.title} (${num})`,
    description: parent.description,
    duration_minutes: parent.duration_minutes,
    meeting_url: parent.meeting_url,
    recording_url: null,
    status: parent.status,
    timezone: parent.timezone || 'America/New_York',
    recurrence_rule: null,
    recurrence_days_of_week: null,
    recurrence_interval: null,
    recurrence_end_date: null,
    recurrence_occurrence_count: null,
    parent_session_id: parent.id,
  };
}

async function run() {
  const conn = await pool.getConnection();
  try {
    // Get all recurring parent sessions
    const [parents] = await conn.query(
      'SELECT * FROM lms_cohort_sessions WHERE parent_session_id IS NULL AND recurrence_rule IS NOT NULL'
    );
    console.log(`Found ${parents.length} recurring parent sessions`);

    for (const parent of parents) {
      console.log(`\nProcessing parent ${parent.id}: "${parent.title}"`);
      console.log(`  Days: ${parent.recurrence_days_of_week}, End: ${parent.recurrence_end_date}`);

      // Delete existing children
      const [del] = await conn.query(
        'DELETE FROM lms_cohort_sessions WHERE parent_session_id = ?', [parent.id]
      );
      console.log(`  Deleted ${del.affectedRows} existing children`);

      // Generate new instances
      const instances = expandSessions(parent);
      console.log(`  Generating ${instances.length} new instances`);

      if (instances.length > 0) {
        for (const inst of instances) {
          await conn.query(
            `INSERT INTO lms_cohort_sessions 
             (course_id, cohort_group_id, title, description, session_date, duration_minutes, 
              meeting_url, recording_url, status, timezone, recurrence_rule, recurrence_days_of_week, 
              recurrence_interval, recurrence_end_date, recurrence_occurrence_count, parent_session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              inst.course_id, inst.cohort_group_id, inst.title, inst.description,
              inst.session_date, inst.duration_minutes, inst.meeting_url, inst.recording_url,
              inst.status, inst.timezone, inst.recurrence_rule, inst.recurrence_days_of_week,
              inst.recurrence_interval, inst.recurrence_end_date, inst.recurrence_occurrence_count,
              inst.parent_session_id
            ]
          );
        }
        console.log(`  ✅ Inserted ${instances.length} sessions`);
      }
    }

    // Final count
    const [total] = await conn.query('SELECT COUNT(*) as cnt FROM lms_cohort_sessions');
    console.log(`\nTotal sessions in DB: ${total[0].cnt}`);
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
