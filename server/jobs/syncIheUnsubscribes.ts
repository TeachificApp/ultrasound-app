/**
 * syncIheUnsubscribes.ts
 *
 * Syncs opt-out records from the iHeartEcho database into UltrasoundAssist
 * so users who unsubscribed from iHeartEcho emails are not emailed here either.
 *
 * Called by challengeCron.ts just before sending daily challenge notifications.
 *
 * A user is considered opted-out in iHeartEcho if:
 *   - unsubscribedAt IS NOT NULL, OR
 *   - notificationPrefs contains { dailyChallenge: false }
 *
 * Requires: IHE_DATABASE_URL env var pointing to the iHeartEcho MySQL/TiDB database.
 * If the env var is not set, the sync is skipped silently (non-blocking).
 */

import mysql from "mysql2/promise";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const IHE_DATABASE_URL = process.env.IHE_DATABASE_URL ?? "";

export async function syncIheUnsubscribes(): Promise<{
  synced: number;
  alreadyDone: number;
  notFound: number;
  skipped: boolean;
}> {
  if (!IHE_DATABASE_URL) {
    console.log("[IheSync] IHE_DATABASE_URL not set — skipping iHeartEcho unsubscribe sync.");
    return { synced: 0, alreadyDone: 0, notFound: 0, skipped: true };
  }

  const aausDb = await getDb();
  if (!aausDb) {
    console.warn("[IheSync] AAUS DB unavailable — skipping sync.");
    return { synced: 0, alreadyDone: 0, notFound: 0, skipped: true };
  }

  let iheConn: mysql.Connection | null = null;
  try {
    iheConn = await mysql.createConnection(IHE_DATABASE_URL);

    // Fetch all opted-out emails from iHeartEcho
    const [iheRows] = await iheConn.execute<mysql.RowDataPacket[]>(`
      SELECT LOWER(TRIM(email)) AS email
      FROM users
      WHERE email IS NOT NULL AND email != ''
        AND (
          unsubscribedAt IS NOT NULL
          OR (
            notificationPrefs IS NOT NULL
            AND JSON_VALID(notificationPrefs)
            AND JSON_EXTRACT(notificationPrefs, '$.dailyChallenge') = false
          )
        )
    `);

    if (iheRows.length === 0) {
      console.log("[IheSync] No opted-out users found in iHeartEcho.");
      return { synced: 0, alreadyDone: 0, notFound: 0, skipped: false };
    }

    console.log(`[IheSync] Found ${iheRows.length} opted-out user(s) in iHeartEcho. Applying to AAUS...`);

    let synced = 0;
    let alreadyDone = 0;
    let notFound = 0;

    for (const row of iheRows) {
      const email = (row.email as string).toLowerCase().trim();

      // Look up user in AAUS by email
      const [existing] = await aausDb
        .select({
          id: users.id,
          unsubscribedAt: users.unsubscribedAt,
          notificationPrefs: users.notificationPrefs,
        })
        .from(users)
        .where(sql`LOWER(TRIM(${users.email})) = ${email}`)
        .limit(1);

      if (!existing) {
        notFound++;
        continue;
      }

      // Already unsubscribed in AAUS — skip
      if (existing.unsubscribedAt) {
        alreadyDone++;
        continue;
      }

      // Apply unsubscribe: set unsubscribedAt + disable dailyChallenge pref
      let prefs: Record<string, unknown> = {};
      try {
        prefs = existing.notificationPrefs
          ? JSON.parse(existing.notificationPrefs as string)
          : {};
      } catch {
        prefs = {};
      }
      prefs.dailyChallenge = false;

      await aausDb
        .update(users)
        .set({
          unsubscribedAt: new Date(),
          notificationPrefs: JSON.stringify(prefs),
        })
        .where(eq(users.id, existing.id));

      synced++;
      console.log(`[IheSync]   Unsubscribed: ${email} (AAUS user #${existing.id})`);
    }

    console.log(
      `[IheSync] Sync complete: ${synced} newly unsubscribed, ${alreadyDone} already done, ${notFound} not found in AAUS.`
    );
    return { synced, alreadyDone, notFound, skipped: false };
  } catch (err) {
    console.error("[IheSync] Error during sync:", err);
    return { synced: 0, alreadyDone: 0, notFound: 0, skipped: true };
  } finally {
    if (iheConn) {
      try { await iheConn.end(); } catch { /* ignore */ }
    }
  }
}
