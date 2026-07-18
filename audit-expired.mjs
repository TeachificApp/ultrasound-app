import mysql from 'mysql2/promise';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_LIVE_SECRET_KEY, { apiVersion: '2024-06-20' });

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Find enrollments that expired in the past 90 days and have a stripe sub ID
  const [rows] = await conn.execute(`
    SELECT e.id, e.user_id, e.course_id, e.access_expires_at, e.stripe_subscription_id,
           u.email, u.name, c.title as course_title, c.type as course_type
    FROM lms_enrollments e
    JOIN users u ON u.id = e.user_id
    JOIN lms_courses c ON c.id = e.course_id
    WHERE e.access_expires_at IS NOT NULL
      AND e.access_expires_at < NOW()
      AND e.stripe_subscription_id IS NOT NULL
      AND e.stripe_subscription_id != ''
    ORDER BY e.access_expires_at DESC
    LIMIT 50
  `);

  console.log(`Found ${rows.length} expired enrollments with Stripe sub IDs`);
  
  const toRestore = [];
  
  for (const row of rows) {
    const subId = row.stripe_subscription_id;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      if (sub.status === 'active' || sub.status === 'trialing') {
        const currentPeriodEnd = new Date(sub.current_period_end * 1000);
        toRestore.push({
          enrollmentId: row.id,
          userId: row.user_id,
          email: row.email,
          name: row.name,
          courseTitle: row.course_title,
          courseType: row.course_type,
          subId,
          stripeStatus: sub.status,
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          dbExpiry: row.access_expires_at,
        });
        console.log(`  ACTIVE: enrollment ${row.id} for ${row.email} (${row.course_title}) — Stripe active until ${currentPeriodEnd.toISOString()}`);
      } else {
        console.log(`  cancelled: enrollment ${row.id} for ${row.email} — Stripe status: ${sub.status}`);
      }
    } catch (err) {
      console.log(`  ERROR: enrollment ${row.id} sub ${subId}: ${err.message}`);
    }
  }
  
  if (toRestore.length === 0) {
    console.log('\nNo enrollments need restoring.');
    await conn.end();
    return;
  }
  
  console.log(`\n=== Restoring ${toRestore.length} enrollments ===`);
  for (const r of toRestore) {
    const newExpiry = new Date(r.currentPeriodEnd);
    await conn.execute(
      `UPDATE lms_enrollments SET access_expires_at = ? WHERE id = ?`,
      [newExpiry, r.enrollmentId]
    );
    console.log(`  Restored enrollment ${r.enrollmentId} for ${r.email} — new expiry: ${newExpiry.toISOString()}`);
  }
  
  console.log('\nDone.');
  await conn.end();
}

main().catch(console.error);
