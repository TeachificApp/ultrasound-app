import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  emailAutomationDeliveries,
  emailAutomationWorkflows,
  emailSenderProfiles,
  emailTemplates,
  users,
} from "../../drizzle/schema";
import type { EmailAutomationScope, EmailAutomationTrigger } from "../../shared/emailAutomation";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";

export type EmailAutomationEvent = {
  type: EmailAutomationTrigger;
  scope: EmailAutomationScope;
  userId?: number | null;
  email?: string | null;
  name?: string | null;
  targetId?: number | null;
  eventName?: string | null;
  contentName?: string | null;
  sourceKey: string;
};

function render(value: string, event: EmailAutomationEvent) {
  const fullName = event.name?.trim() || "there";
  const firstName = fullName === "there" ? "there" : fullName.split(/\s+/)[0] || fullName;
  return value
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", fullName)
    .replaceAll("{{email}}", event.email ?? "")
    .replaceAll("{{event_name}}", event.eventName ?? "")
    .replaceAll("{{content_name}}", event.contentName ?? event.eventName ?? "")
    .replaceAll("{{platform_area}}", event.scope === "expo" ? "UltrasoundExpo™" : event.scope === "apps" ? "Apps" : "Learn");
}

async function resolveRecipient(event: EmailAutomationEvent) {
  if (event.email?.trim()) return { email: event.email.trim().toLowerCase(), name: event.name?.trim() || "Member", userId: event.userId ?? null };
  if (!event.userId) return null;
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ email: users.email, name: users.name, displayName: users.displayName })
    .from(users).where(eq(users.id, event.userId)).limit(1);
  if (!user?.email) return null;
  return { email: user.email.trim().toLowerCase(), name: user.displayName || user.name || "Member", userId: event.userId };
}

/** Adds matching enabled workflow deliveries. Safe to call from fulfillment paths and retries. */
export async function fireEmailAutomationEvent(event: EmailAutomationEvent): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const recipient = await resolveRecipient(event);
    if (!recipient) return;
    const rules = await db.select().from(emailAutomationWorkflows).where(and(
      eq(emailAutomationWorkflows.isActive, true),
      eq(emailAutomationWorkflows.scope, event.scope),
      eq(emailAutomationWorkflows.triggerType, event.type),
    ));
    for (const rule of rules) {
      if (rule.targetId !== null && rule.targetId !== event.targetId) continue;
      const uniqueSourceKey = `${event.sourceKey}:workflow:${rule.id}`;
      const [exists] = await db.select({ id: emailAutomationDeliveries.id })
        .from(emailAutomationDeliveries)
        .where(and(eq(emailAutomationDeliveries.workflowId, rule.id), eq(emailAutomationDeliveries.sourceKey, uniqueSourceKey)))
        .limit(1);
      if (exists) continue;
      const scheduledFor = new Date(Date.now() + Math.max(0, rule.delayMinutes) * 60_000);
      await db.insert(emailAutomationDeliveries).values({
        workflowId: rule.id,
        sourceKey: uniqueSourceKey,
        userId: recipient.userId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject: render(rule.subject, event),
        htmlBody: render(rule.htmlBody, event),
        status: "queued",
        attempts: 0,
        scheduledFor,
      });
    }
    await processDueEmailAutomationDeliveries();
  } catch (error) {
    console.error("[EmailAutomation] Event dispatch failed", error);
  }
}

/** Sends queued workflow email deliveries. Idempotent at the queue-row level. */
export async function processDueEmailAutomationDeliveries(limit = 100): Promise<{ sent: number; failed: number; retried: number }> {
  const result = { sent: 0, failed: 0, retried: 0 };
  const db = await getDb();
  if (!db) return result;
  const due = await db.select().from(emailAutomationDeliveries)
    .where(and(eq(emailAutomationDeliveries.status, "queued"), lte(emailAutomationDeliveries.scheduledFor, new Date())))
    .orderBy(asc(emailAutomationDeliveries.scheduledFor)).limit(limit);
  for (const delivery of due) {
    const claimed = await db.update(emailAutomationDeliveries)
      .set({ status: "sending", attempts: sql`${emailAutomationDeliveries.attempts} + 1` })
      .where(and(eq(emailAutomationDeliveries.id, delivery.id), eq(emailAutomationDeliveries.status, "queued")));
    if ((claimed as any)[0]?.affectedRows === 0 && (claimed as any).rowsAffected === 0) continue;
    let fromName: string | undefined;
    let fromEmail: string | undefined;
    if (delivery.senderProfileId) {
      const [sender] = await db.select().from(emailSenderProfiles).where(eq(emailSenderProfiles.id, delivery.senderProfileId)).limit(1);
      fromName = sender?.name;
      fromEmail = sender?.email;
    }
    try {
      const sent = await sendEmail({
        to: { email: delivery.recipientEmail, name: delivery.recipientName || "Member" },
        subject: delivery.subject,
        htmlBody: delivery.htmlBody,
        fromName,
        fromEmail,
      });
      if (sent) {
        result.sent++;
        await db.update(emailAutomationDeliveries).set({ status: "sent", sentAt: new Date(), lastError: null }).where(eq(emailAutomationDeliveries.id, delivery.id));
        await db.update(emailAutomationWorkflows).set({ lastTriggeredAt: new Date(), lastStatus: "sent", updatedAt: new Date() }).where(eq(emailAutomationWorkflows.id, delivery.workflowId));
      } else {
        const nextAttempts = delivery.attempts + 1;
        if (nextAttempts >= 3) {
          result.failed++;
          await db.update(emailAutomationDeliveries).set({ status: "failed", lastError: "The configured email provider did not accept the delivery." }).where(eq(emailAutomationDeliveries.id, delivery.id));
        } else {
          result.retried++;
          await db.update(emailAutomationDeliveries).set({ status: "queued", scheduledFor: new Date(Date.now() + nextAttempts * 5 * 60_000), lastError: "Delivery deferred; retry queued." }).where(eq(emailAutomationDeliveries.id, delivery.id));
        }
        await db.update(emailAutomationWorkflows).set({ lastTriggeredAt: new Date(), lastStatus: "delivery_failed", updatedAt: new Date() }).where(eq(emailAutomationWorkflows.id, delivery.workflowId));
      }
    } catch (error) {
      const nextAttempts = delivery.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed.";
      if (nextAttempts >= 3) {
        result.failed++;
        await db.update(emailAutomationDeliveries).set({ status: "failed", lastError: message }).where(eq(emailAutomationDeliveries.id, delivery.id));
      } else {
        result.retried++;
        await db.update(emailAutomationDeliveries).set({ status: "queued", scheduledFor: new Date(Date.now() + nextAttempts * 5 * 60_000), lastError: message }).where(eq(emailAutomationDeliveries.id, delivery.id));
      }
      await db.update(emailAutomationWorkflows).set({ lastTriggeredAt: new Date(), lastStatus: "delivery_failed", updatedAt: new Date() }).where(eq(emailAutomationWorkflows.id, delivery.workflowId));
    }
  }
  return result;
}
