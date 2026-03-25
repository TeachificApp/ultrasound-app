/**
 * backfill-sendgrid-unsubscribes.mjs
 *
 * One-time script: reads all users with unsubscribedAt set in the DB
 * and adds them to SendGrid's Global Unsubscribe list.
 *
 * Run from project root:
 *   node scripts/backfill-sendgrid-unsubscribes.mjs
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
if (!SENDGRID_API_KEY) { console.error("SENDGRID_API_KEY not set"); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL);
const [rows] = await conn.execute(
  "SELECT email FROM users WHERE unsubscribedAt IS NOT NULL AND email IS NOT NULL AND email != ''"
);
await conn.end();

const emails = rows.map(r => r.email.toLowerCase().trim()).filter(Boolean);
console.log(`Found ${emails.length} unsubscribed user(s) in DB.`);

if (emails.length === 0) {
  console.log("Nothing to backfill.");
  process.exit(0);
}

// SendGrid allows up to 1000 per request
const BATCH_SIZE = 1000;
let totalAdded = 0;

for (let i = 0; i < emails.length; i += BATCH_SIZE) {
  const batch = emails.slice(i, i + BATCH_SIZE);
  const res = await fetch("https://api.sendgrid.com/v3/asm/suppressions/global", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_emails: batch }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Batch ${i / BATCH_SIZE + 1} failed: HTTP ${res.status} — ${body}`);
  } else {
    totalAdded += batch.length;
    console.log(`Batch ${i / BATCH_SIZE + 1}: added ${batch.length} email(s).`);
    batch.forEach(e => console.log(`  ✓ ${e}`));
  }
}

console.log(`\nBackfill complete: ${totalAdded} / ${emails.length} email(s) added to SendGrid global unsubscribes.`);
