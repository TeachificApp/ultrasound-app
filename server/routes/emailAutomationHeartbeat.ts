import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { processDueEmailAutomationDeliveries } from "../lib/emailAutomation";

/** Heartbeat endpoint for durable email campaign automation deliveries. */
export async function emailAutomationHeartbeatHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await processDueEmailAutomationDeliveries(150);
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation delivery error";
    console.error("[EmailAutomationHeartbeat]", error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { taskUid: "unavailable" } });
  }
}
