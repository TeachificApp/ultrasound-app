/**
 * hourlyBackupHandler.ts
 * Heartbeat-driven hourly backup:
 *   1. git archive HEAD → in-memory ZIP of the project source
 *   2. Upload to R2 via storagePutLarge
 *   3. Send a download-link email to the site owner via SendGrid
 *
 * Route: POST /api/scheduled/hourly-backup
 * Cron:  0 0 * * * *  (every hour, on the hour, UTC)
 */
import { execSync } from "child_process";
import path from "path";
import type { Request, Response } from "express";
import { storagePutLarge } from "../storage";
import { sendEmail } from "../_core/email";

const PROJECT_ROOT = path.resolve(process.cwd());

export async function hourlyBackupHandler(req: Request, res: Response) {
  const startedAt = new Date();
  const label = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19); // e.g. 2026-06-02T08-00-00
  const key = `backups/ultrasound-assist-${label}.zip`;

  try {
    // ── 1. Create ZIP via git archive ─────────────────────────────────────────
    let zipBuffer: Buffer;
    try {
      zipBuffer = execSync(`git -C "${PROJECT_ROOT}" archive --format=zip HEAD`, {
        maxBuffer: 200 * 1024 * 1024, // 200 MB
        timeout: 60_000,
      });
    } catch (gitErr: any) {
      console.error("[HourlyBackup] git archive failed:", gitErr.message);
      return res.status(500).json({ error: "git archive failed", detail: gitErr.message });
    }

    const sizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[HourlyBackup] ZIP created: ${sizeMB} MB`);

    // ── 2. Upload to R2 ───────────────────────────────────────────────────────
    const { url } = await storagePutLarge(key, zipBuffer, "application/zip");
    console.log(`[HourlyBackup] Uploaded to R2: ${url}`);

    // ── 3. Email the owner ────────────────────────────────────────────────────
    const ownerEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@allaboutultrasound.com";
    const ownerName = process.env.LMS_FROM_NAME || "All About Ultrasound";

    const htmlBody = `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
        <h2 style="color:#179ca3;margin-bottom:8px;">&#128230; Hourly Backup Ready</h2>
        <p style="color:#6b7280;font-size:14px;margin-bottom:16px;">
          Your UltrasoundAssist™ project was automatically backed up at <strong>${startedAt.toUTCString()}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr>
            <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:120px;">File</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${key}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Size</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${sizeMB} MB</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Timestamp</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${startedAt.toUTCString()}</td>
          </tr>
        </table>
        <a href="${url}" style="display:inline-block;background:#179ca3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          &#11015; Download ZIP
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          This backup contains source code only. Database is mirrored separately to Railway every 6 hours via MirrorSync.
          Backups are stored in Cloudflare R2 and accessible via the link above.
        </p>
      </div>
    `;

    await sendEmail({
      to: { name: ownerName, email: ownerEmail },
      subject: `[UltrasoundAssist™] Hourly Backup — ${label}`,
      htmlBody,
      brandMode: "aaus",
    });

    console.log(`[HourlyBackup] Email sent to ${ownerEmail}`);

    return res.json({
      ok: true,
      key,
      url,
      sizeMB,
      timestamp: startedAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[HourlyBackup] Unexpected error:", err);
    return res.status(500).json({
      error: err.message ?? "Unknown error",
      timestamp: startedAt.toISOString(),
    });
  }
}
