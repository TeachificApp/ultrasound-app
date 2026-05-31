/**
 * thinkificCommunitySyncHandler.ts
 *
 * Heartbeat callback handler for /api/scheduled/thinkific-community-sync
 * Triggered every 6 hours by the Manus Heartbeat cron platform.
 *
 * Runs a full sync of all Thinkific community posts/replies into local DB.
 */

import type { Request, Response } from "express";
import { syncAllThinkificCommunities } from "../services/thinkificCommunitySync";

export async function thinkificCommunitySyncHandler(req: Request, res: Response) {
  // Allow both cron platform calls and manual admin triggers
  const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
  console.log(`[CommunitySyncHandler] Triggered. taskUid=${taskUid ?? "manual"}`);

  try {
    const result = await syncAllThinkificCommunities();
    console.log("[CommunitySyncHandler] Sync complete:", result);
    return res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[CommunitySyncHandler] Sync failed:", err);
    return res.status(500).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      context: { taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
