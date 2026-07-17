/**
 * Bulk subscription sync script.
 * Finds all lmsEnrollments, membershipSubscriptions, and brandMemberships
 * that are marked cancelled/expired but still have a stripeSubscriptionId,
 * then checks each against Stripe live status and restores active ones.
 *
 * Table naming note: lms_enrollments and membership_subscriptions use snake_case;
 * brandMemberships uses camelCase (as created by Drizzle).
 */
import mysql from "mysql2/promise";
import Stripe from "stripe";

const DB_URL = process.env.RAILWAY_MYSQL_URL;
// Use live key — test key cannot see live subscriptions
const STRIPE_KEY = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!DB_URL || !STRIPE_KEY) {
  console.error("Missing RAILWAY_MYSQL_URL or STRIPE_LIVE_SECRET_KEY env vars");
  process.exit(1);
}

console.log("Using Stripe key mode:", STRIPE_KEY.startsWith("sk_live") ? "LIVE" : "TEST");

const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-01-27.acacia" });
const conn = await mysql.createConnection(DB_URL);

const results = {
  checked: 0,
  restored: [],
  alreadyCancelled: [],
  errors: [],
};

// ── Discover actual column names ────────────────────────────────────────────
const [lmsCols] = await conn.execute("DESCRIBE lms_enrollments");
const lmsSubCol = lmsCols.map(c => c.Field).find(f => f.toLowerCase().includes("stripe") && f.toLowerCase().includes("sub"));
const lmsExpCol = lmsCols.map(c => c.Field).find(f => f.toLowerCase().includes("expir"));
console.log(`lms_enrollments: stripeSubCol=${lmsSubCol}, expiresCol=${lmsExpCol}`);

const [memCols] = await conn.execute("DESCRIBE membership_subscriptions");
const memSubCol = memCols.map(c => c.Field).find(f => f.toLowerCase().includes("stripe") && f.toLowerCase().includes("sub"));
const memStatusCol = memCols.map(c => c.Field).find(f => f === "status");
const memPeriodEndCol = memCols.map(c => c.Field).find(f => f.toLowerCase().includes("period") && f.toLowerCase().includes("end"));
const memCancelCol = memCols.map(c => c.Field).find(f => f.toLowerCase().includes("cancel") && f.toLowerCase().includes("period"));
console.log(`membership_subscriptions: stripeSubCol=${memSubCol}, statusCol=${memStatusCol}, periodEndCol=${memPeriodEndCol}, cancelAtPeriodEndCol=${memCancelCol}`);

const [brandCols] = await conn.execute("DESCRIBE brandMemberships");
const brandSubCol = brandCols.map(c => c.Field).find(f => f.toLowerCase().includes("stripe") && f.toLowerCase().includes("sub"));
const brandStatusCol = brandCols.map(c => c.Field).find(f => f === "status");
const brandUserCol = brandCols.map(c => c.Field).find(f => f.toLowerCase().includes("user"));
const brandTierCol = brandCols.map(c => c.Field).find(f => f.toLowerCase().includes("tier"));
console.log(`brandMemberships: stripeSubCol=${brandSubCol}, statusCol=${brandStatusCol}, userCol=${brandUserCol}, tierCol=${brandTierCol}`);

// ── 1. lmsEnrollments ──────────────────────────────────────────────────────
if (lmsSubCol && lmsExpCol) {
  const [lmsRows] = await conn.execute(
    `SELECT id, user_id, course_id, \`${lmsSubCol}\` AS sub_id, \`${lmsExpCol}\` AS expires_at
     FROM lms_enrollments
     WHERE \`${lmsSubCol}\` IS NOT NULL
       AND \`${lmsSubCol}\` != ''
       AND (\`${lmsExpCol}\` IS NULL OR \`${lmsExpCol}\` <= NOW())
     ORDER BY id`
  );

  console.log(`\nFound ${lmsRows.length} lmsEnrollments to check...`);

  for (const row of lmsRows) {
    results.checked++;
    let subId = row.sub_id;

    // Fix known typo: '0' (zero) → 'O' (capital O) at position 20
    // DB has: sub_1ThKcMBj9HgnkZLK0ZelVzOX
    // Stripe: sub_1ThKcMBj9HgnkZLKOZelVzOX
    if (subId === "sub_1ThKcMBj9HgnkZLK0ZelVzOX") {
      console.log(`  Fixing known typo in sub ID for enrollment #${row.id}: 0→O`);
      subId = "sub_1ThKcMBj9HgnkZLKOZelVzOX";
      await conn.execute(
        `UPDATE lms_enrollments SET \`${lmsSubCol}\` = ? WHERE id = ?`,
        [subId, row.id]
      );
    }

    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const isActive = sub.status === "active" || sub.status === "trialing";
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;

      if (isActive && currentPeriodEnd) {
        await conn.execute(
          `UPDATE lms_enrollments SET \`${lmsExpCol}\` = ? WHERE id = ?`,
          [currentPeriodEnd, row.id]
        );
        results.restored.push(
          `lmsEnrollment #${row.id} (userId=${row.user_id}, courseId=${row.course_id}): restored → expires ${currentPeriodEnd.toISOString()} [Stripe: ${sub.status}]`
        );
      } else {
        results.alreadyCancelled.push(
          `lmsEnrollment #${row.id} (userId=${row.user_id}): Stripe status=${sub.status} — no change`
        );
      }
    } catch (e) {
      results.errors.push(`lmsEnrollment #${row.id} sub=${subId}: ${e.message}`);
    }
  }
} else {
  console.warn("Could not find stripe subscription or expiry columns in lms_enrollments — skipping");
}

// ── 2. membershipSubscriptions ─────────────────────────────────────────────
if (memSubCol && memStatusCol) {
  const [memRows] = await conn.execute(
    `SELECT id, user_id, plan_id, \`${memSubCol}\` AS sub_id, status
     FROM membership_subscriptions
     WHERE \`${memSubCol}\` IS NOT NULL
       AND \`${memSubCol}\` != ''
       AND status IN ('cancelled', 'expired', 'past_due')
     ORDER BY id`
  );

  console.log(`Found ${memRows.length} membershipSubscriptions to check...`);

  for (const row of memRows) {
    results.checked++;
    const subId = row.sub_id;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const isActive = sub.status === "active" || sub.status === "trialing";
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : null;
      const cancelAtPeriodEnd = sub.cancel_at_period_end;

      if (isActive) {
        const setClauses = [`status = 'active'`];
        const params = [];
        if (memCancelCol) { setClauses.push(`\`${memCancelCol}\` = ?`); params.push(cancelAtPeriodEnd ? 1 : 0); }
        if (memPeriodEndCol && currentPeriodEnd) { setClauses.push(`\`${memPeriodEndCol}\` = ?`); params.push(currentPeriodEnd); }
        params.push(row.id);
        await conn.execute(
          `UPDATE membership_subscriptions SET ${setClauses.join(", ")} WHERE id = ?`,
          params
        );
        results.restored.push(
          `membershipSubscription #${row.id} (userId=${row.user_id}): restored → active [Stripe: ${sub.status}, cancelAtPeriodEnd=${cancelAtPeriodEnd}]`
        );
      } else {
        results.alreadyCancelled.push(
          `membershipSubscription #${row.id} (userId=${row.user_id}): Stripe status=${sub.status} — no change`
        );
      }
    } catch (e) {
      results.errors.push(`membershipSubscription #${row.id} sub=${subId}: ${e.message}`);
    }
  }
} else {
  console.warn("Could not find stripe subscription or status columns in membership_subscriptions — skipping");
}

// ── 3. brandMemberships ────────────────────────────────────────────────────
if (brandSubCol && brandStatusCol) {
  const [brandRows] = await conn.execute(
    `SELECT id, \`${brandUserCol}\` AS user_id, brand, \`${brandSubCol}\` AS sub_id, status
     FROM brandMemberships
     WHERE \`${brandSubCol}\` IS NOT NULL
       AND \`${brandSubCol}\` != ''
       AND status IN ('cancelled', 'expired', 'past_due')
     ORDER BY id`
  );

  console.log(`Found ${brandRows.length} brandMemberships to check...`);

  for (const row of brandRows) {
    results.checked++;
    const subId = row.sub_id;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const isActive = sub.status === "active" || sub.status === "trialing";

      if (isActive) {
        const setClauses = [`status = 'active'`];
        const params = [];
        if (brandTierCol) { setClauses.push(`\`${brandTierCol}\` = 'premium'`); }
        params.push(row.id);
        await conn.execute(
          `UPDATE brandMemberships SET ${setClauses.join(", ")} WHERE id = ?`,
          params
        );
        results.restored.push(
          `brandMembership #${row.id} (userId=${row.user_id}, brand=${row.brand}): restored → active/premium [Stripe: ${sub.status}]`
        );
      } else {
        results.alreadyCancelled.push(
          `brandMembership #${row.id} (userId=${row.user_id}, brand=${row.brand}): Stripe status=${sub.status} — no change`
        );
      }
    } catch (e) {
      results.errors.push(`brandMembership #${row.id} sub=${subId}: ${e.message}`);
    }
  }
} else {
  console.warn("Could not find stripe subscription or status columns in brandMemberships — skipping");
}

await conn.end();

// ── Report ─────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`BULK SYNC COMPLETE — checked ${results.checked} subscriptions`);
console.log("═══════════════════════════════════════════════════════════");

if (results.restored.length > 0) {
  console.log(`\n✅ RESTORED (${results.restored.length}):`);
  results.restored.forEach((r) => console.log("  " + r));
} else {
  console.log("\n✅ No subscriptions needed restoring.");
}

if (results.alreadyCancelled.length > 0) {
  console.log(`\n⚪ Confirmed cancelled in Stripe (${results.alreadyCancelled.length}):`);
  results.alreadyCancelled.forEach((r) => console.log("  " + r));
}

if (results.errors.length > 0) {
  console.log(`\n❌ ERRORS (${results.errors.length}):`);
  results.errors.forEach((r) => console.log("  " + r));
}
