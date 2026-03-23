/**
 * thinkificMemberSync.ts — Daily Thinkific member import job
 *
 * Runs every 6 hours. Fetches all users from Thinkific and creates
 * pending UltrasoundAssist™ accounts for any not yet in the DB.
 *
 * Rules:
 * - NO welcome emails are sent — emails are only sent on first explicit login/registration.
 * - Existing users (pending or active) are skipped without modification.
 * - The job is idempotent: safe to run multiple times.
 */

import { getAllThinkificUsers } from "../thinkific";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/** How often to run the sync (every 6 hours) */
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Run one full Thinkific → DB member sync pass.
 * Returns counts of created, skipped, and errored users.
 */
export async function runThinkificMemberSync(): Promise<{
  total: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[ThinkificSync] DB unavailable — skipping sync");
    return { total: 0, created: 0, skipped: 0, errors: 0 };
  }

  console.log("[ThinkificSync] Starting Thinkific member sync…");
  let thinkificUsers: Awaited<ReturnType<typeof getAllThinkificUsers>> = [];

  try {
    thinkificUsers = await getAllThinkificUsers();
  } catch (err) {
    console.error("[ThinkificSync] Failed to fetch users from Thinkific API:", err);
    return { total: 0, created: 0, skipped: 0, errors: 1 };
  }

  let created = 0;
  let skipped = 0;
  let errors = 0;

  const { ensureUserRole } = await import("../db");

  for (const tUser of thinkificUsers) {
    if (!tUser.email) { errors++; continue; }
    const normalised = tUser.email.trim().toLowerCase();
    try {
      // Case-insensitive check: skip if a user with this email already exists (pending or active)
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${normalised}`)
        .limit(1);

      if (existing[0]) {
        skipped++;
        continue;
      }

      // Build a globally unique synthetic openId using email + timestamp + random suffix
      // Use crypto.randomUUID() for guaranteed uniqueness
      const { randomUUID } = await import("crypto");
      const syntheticOpenId = `pending_${randomUUID()}`;
      const firstName = tUser.first_name?.trim() ?? "";
      const lastName = tUser.last_name?.trim() ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || normalised;

      try {
        await db.insert(users).values({
          openId: syntheticOpenId,
          email: normalised,
          name: fullName,
          isPending: true,
          pendingCreatedAt: new Date(),
          lastSignedIn: new Date(),
        });
      } catch (insertErr: unknown) {
        // Duplicate email or openId — treat as skipped (race condition or case mismatch)
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
        if (msg.includes("Duplicate entry") || msg.includes("UNIQUE") || msg.includes("ER_DUP")) {
          skipped++;
          continue;
        }
        throw insertErr;
      }

      // Ensure base "user" role
      const newUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, syntheticOpenId))
        .limit(1);

      if (newUser[0]) {
        await ensureUserRole(newUser[0].id);
      }

      created++;
    } catch (err) {
      console.error(`[ThinkificSync] Error processing ${normalised}:`, err);
      errors++;
    }
  }

  console.log(
    `[ThinkificSync] Sync complete: ${created} created, ${skipped} skipped, ${errors} errors (${thinkificUsers.length} total Thinkific users)`
  );
  return { total: thinkificUsers.length, created, skipped, errors };
}

/**
 * Start the recurring Thinkific member sync job.
 * Runs immediately on startup, then every 6 hours.
 */
export function startThinkificMemberSync(): void {
  if (syncIntervalId) return; // Already running

  console.log("[ThinkificSync] Started — runs every 6 hours. First run in 2 minutes.");

  // Delay first run by 2 minutes to let the server fully boot
  setTimeout(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificSync] Initial sync failed:", err)
    );
  }, 2 * 60 * 1000);

  syncIntervalId = setInterval(() => {
    runThinkificMemberSync().catch(err =>
      console.error("[ThinkificSync] Periodic sync failed:", err)
    );
  }, SYNC_INTERVAL_MS);
}
