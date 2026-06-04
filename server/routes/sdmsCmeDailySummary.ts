/**
 * sdmsCmeDailySummary.ts
 * 
 * Heartbeat handler: POST /api/scheduled/sdms-cme-daily-summary
 * 
 * Runs daily at 8:00 AM UTC. Queries the last 24 hours of SDMS CME submission logs,
 * builds a summary of successes and failures, and sends it to the project owner
 * via notifyOwner.
 */
import { Request, Response } from "express";
import { getDb } from "../db";
import { sdmsCmeSubmissionLogs, users } from "../../drizzle/schema";
import { gte, eq, and, desc } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function sdmsCmeDailySummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      res.json({ ok: true, skipped: "no-db" });
      return;
    }

    // Query last 24 hours of submission logs
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await db
      .select({
        id: sdmsCmeSubmissionLogs.id,
        userId: sdmsCmeSubmissionLogs.userId,
        activityType: sdmsCmeSubmissionLogs.activityType,
        activityId: sdmsCmeSubmissionLogs.activityId,
        approvalId: sdmsCmeSubmissionLogs.approvalId,
        status: sdmsCmeSubmissionLogs.status,
        responseCode: sdmsCmeSubmissionLogs.responseCode,
        errorMessage: sdmsCmeSubmissionLogs.errorMessage,
        triggeredBy: sdmsCmeSubmissionLogs.triggeredBy,
        retryCount: sdmsCmeSubmissionLogs.retryCount,
        resolved: sdmsCmeSubmissionLogs.resolved,
        createdAt: sdmsCmeSubmissionLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(sdmsCmeSubmissionLogs)
      .leftJoin(users, eq(sdmsCmeSubmissionLogs.userId, users.id))
      .where(gte(sdmsCmeSubmissionLogs.createdAt, since))
      .orderBy(desc(sdmsCmeSubmissionLogs.createdAt))
      .limit(500);

    // Build summary stats
    const totalCount = logs.length;
    const successCount = logs.filter(l => l.status === "success" || l.status === "simulated_success").length;
    const failedCount = logs.filter(l => l.status === "failed" || l.status === "timeout" || l.status === "validation_error" || l.status === "simulated_failure").length;
    const unresolvedCount = logs.filter(l => !l.resolved && (l.status === "failed" || l.status === "timeout" || l.status === "validation_error")).length;

    // If no activity, send a brief "all clear" notification
    if (totalCount === 0) {
      await notifyOwner({
        title: "📋 SDMS CME Daily Summary — No Activity",
        content: `No SDMS CME webhook submissions in the last 24 hours (since ${since.toISOString()}).`,
      });
      res.json({ ok: true, totalCount: 0, message: "No activity — summary sent" });
      return;
    }

    // Build detailed failure list (max 20)
    const failures = logs.filter(l => l.status === "failed" || l.status === "timeout" || l.status === "validation_error");
    let failureDetails = "";
    if (failures.length > 0) {
      failureDetails = "\n\n🚨 FAILURES:\n" + failures.slice(0, 20).map((f, i) => {
        const user = f.userName || f.userEmail || `User #${f.userId}`;
        const time = f.createdAt ? new Date(f.createdAt).toLocaleString("en-US", { timeZone: "America/New_York" }) : "?";
        return `${i + 1}. [${f.status.toUpperCase()}] ${user} — ${f.activityType} #${f.activityId} (Approval: ${f.approvalId || "N/A"}) at ${time}\n   Error: ${f.errorMessage || "No error message"}\n   Response: ${f.responseCode || "N/A"} | Retries: ${f.retryCount} | Resolved: ${f.resolved ? "Yes" : "No"}`;
      }).join("\n");
      if (failures.length > 20) {
        failureDetails += `\n\n... and ${failures.length - 20} more failures. View full list at /admin/sdms-cme-export`;
      }
    }

    // Build success summary
    let successDetails = "";
    if (successCount > 0) {
      const successLogs = logs.filter(l => l.status === "success" || l.status === "simulated_success");
      const uniqueUsers = new Set(successLogs.map(l => l.userId));
      const activityTypes = [...new Set(successLogs.map(l => l.activityType))];
      successDetails = `\n\n✅ SUCCESSES: ${successCount} credits pushed for ${uniqueUsers.size} unique learner(s)\n   Activity types: ${activityTypes.join(", ")}`;
    }

    const content = [
      `SDMS CME Daily Summary — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      `\nPeriod: Last 24 hours (since ${since.toLocaleString("en-US", { timeZone: "America/New_York" })} ET)`,
      `\n📊 TOTALS:`,
      `• Total submissions: ${totalCount}`,
      `• Successful: ${successCount}`,
      `• Failed: ${failedCount}`,
      `• Unresolved failures: ${unresolvedCount}`,
      successDetails,
      failureDetails,
      unresolvedCount > 0 ? `\n\n⚠️ ACTION REQUIRED: ${unresolvedCount} unresolved failure(s) need attention. Visit /admin/sdms-cme-export to review and resolve.` : "",
    ].filter(Boolean).join("\n");

    const title = failedCount > 0
      ? `⚠️ SDMS CME Daily: ${successCount} OK, ${failedCount} Failed`
      : `✅ SDMS CME Daily: ${successCount} Credits Pushed Successfully`;

    await notifyOwner({ title, content });

    res.json({
      ok: true,
      totalCount,
      successCount,
      failedCount,
      unresolvedCount,
      message: "Daily summary sent",
    });
  } catch (err: any) {
    console.error("[SDMS CME Daily Summary] Error:", err);
    res.status(500).json({
      error: err.message || "Unknown error",
      stack: err.stack,
      context: { url: req.url, taskUid: req.headers["x-manus-cron-task-uid"] },
      timestamp: new Date().toISOString(),
    });
  }
}
