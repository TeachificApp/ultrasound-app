import { getDb } from "./server/db";
import { users, lmsEnrollments, membershipSubscriptions, brandMemberships } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  console.log("=== Finding islaolim@icloud.com accounts ===");

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, isPending: users.isPending, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, "islaolim@icloud.com"))
    .orderBy(users.id);

  console.log(`Found ${rows.length} account(s):`);
  for (const r of rows) {
    const enr = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments).where(eq(lmsEnrollments.userId, r.id));
    const subs = await db.select({ id: membershipSubscriptions.id }).from(membershipSubscriptions).where(eq(membershipSubscriptions.userId, r.id));
    const brand = await db.select({ id: brandMemberships.id }).from(brandMemberships).where(eq(brandMemberships.userId, r.id));
    console.log(`  ID=${r.id} name=${r.name} isPending=${r.isPending} created=${r.createdAt}`);
    console.log(`    enrollments=${enr.length} subscriptions=${subs.length} brand_memberships=${brand.length}`);
  }

  if (rows.length > 1) {
    const keepId = rows[0].id;
    const deleteRows = rows.slice(1);

    for (const del of deleteRows) {
      const enr = await db.select({ id: lmsEnrollments.id }).from(lmsEnrollments).where(eq(lmsEnrollments.userId, del.id));
      const subs = await db.select({ id: membershipSubscriptions.id }).from(membershipSubscriptions).where(eq(membershipSubscriptions.userId, del.id));

      if (enr.length === 0 && subs.length === 0) {
        await db.delete(users).where(eq(users.id, del.id));
        console.log(`\n✓ Deleted duplicate user ID ${del.id} (no data)`);
      } else {
        console.log(`\nID ${del.id} has data — moving to ID ${keepId}...`);
        // Move enrollments
        for (const e of enr) {
          await db.update(lmsEnrollments).set({ userId: keepId }).where(eq(lmsEnrollments.id, e.id));
        }
        // Move subscriptions
        for (const s of subs) {
          await db.update(membershipSubscriptions).set({ userId: keepId }).where(eq(membershipSubscriptions.id, s.id));
        }
        await db.delete(users).where(eq(users.id, del.id));
        console.log(`✓ Merged ID ${del.id} into ID ${keepId}`);
      }
    }
  }

  const final = await db.select({ id: users.id, email: users.email, isPending: users.isPending }).from(users).where(eq(users.email, "islaolim@icloud.com"));
  console.log("\n=== Final state ===");
  for (const r of final) {
    console.log(`  ID=${r.id} email=${r.email} isPending=${r.isPending}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
