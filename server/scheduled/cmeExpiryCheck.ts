/**
 * cmeExpiryCheck.ts
 * Heartbeat handler — runs daily to find CME courses whose CardioServ approval
 * will expire within 90 days and sends an owner notification.
 *
 * Route: POST /api/scheduled/cme-expiry-check
 * Cron:  0 0 9 * * *  (daily at 09:00 UTC)
 */
import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { cmeActivityForms, lmsCourses } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { eq, and, isNotNull, lt, gt } from "drizzle-orm";
import { formatInTimeZone, PLATFORM_TIMEZONE } from "../../shared/platformTime";

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function cmeExpiryCheckHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) return res.json({ ok: true, skipped: "no-db" });

    const now = Date.now();
    const expiryWindowStart = now;
    const expiryWindowEnd = now + NINETY_DAYS_MS;

    // Find approved courses whose approval expires within the next 90 days
    // approvedAt + TWO_YEARS_MS is in the window [now, now + 90 days]
    // i.e. approvedAt is in [now - 2yr, now - 2yr + 90 days]
    const windowLow = now - TWO_YEARS_MS;
    const windowHigh = now - TWO_YEARS_MS + NINETY_DAYS_MS;

    const forms = await db
      .select({
        courseId: cmeActivityForms.courseId,
        approvedAt: cmeActivityForms.approvedAt,
        courseTitle: lmsCourses.title,
      })
      .from(cmeActivityForms)
      .leftJoin(lmsCourses, eq(lmsCourses.id, cmeActivityForms.courseId))
      .where(
        and(
          eq(cmeActivityForms.cmeStatus as any, "approved"),
          isNotNull(cmeActivityForms.approvedAt),
          gt(cmeActivityForms.approvedAt as any, windowLow),
          lt(cmeActivityForms.approvedAt as any, windowHigh)
        )
      );

    if (forms.length === 0) {
      console.log("[CmeExpiryCheck] No courses expiring within 90 days.");
      return res.json({ ok: true, checked: 0 });
    }

    const lines = forms.map(f => {
      const expiresAt = (f.approvedAt ?? 0) + TWO_YEARS_MS;
      const daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
      return `• ${f.courseTitle ?? `Course #${f.courseId}`} — expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} (${formatInTimeZone(expiresAt, { year: "numeric", month: "long", day: "numeric" }, PLATFORM_TIMEZONE)})`;
    });

    const title = `⚠️ CME Renewal Reminder: ${forms.length} course${forms.length !== 1 ? "s" : ""} expiring within 90 days`;
    const content = `The following CME course${forms.length !== 1 ? "s" : ""} will lose CardioServ accreditation within the next 90 days. Please initiate renewal submissions to CardioServ.\n\n${lines.join("\n")}\n\nLog in to the LMS Admin → CME Forms to manage renewals.`;

    await notifyOwner({ title, content });
    console.log(`[CmeExpiryCheck] Notified owner about ${forms.length} expiring course(s).`);

    return res.json({ ok: true, checked: forms.length, notified: forms.map(f => f.courseTitle) });
  } catch (err: any) {
    console.error("[CmeExpiryCheck] Error:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
