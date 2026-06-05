/**
 * Fire form actions (webhooks, notification emails) on submit or results-table update.
 */
import type { FormActionConfig } from "../../shared/formItemUtils";

type Db = Awaited<ReturnType<typeof import("../db").getDb>>;

export async function fireFormWebhook(
  db: NonNullable<Db>,
  formId: number,
  event: "submission" | "update" | "test",
  payload: Record<string, unknown>,
): Promise<void> {
  const { generalFormWebhooks } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [webhookRow] = await db
    .select()
    .from(generalFormWebhooks)
    .where(eq(generalFormWebhooks.formId, formId))
    .limit(1);

  if (!webhookRow?.isEnabled || !webhookRow.webhookUrl) return;

  const events = (webhookRow.events ?? "submission").split(",").map(e => e.trim());
  const eventKey = event === "update" ? "update" : "submission";
  if (event !== "test" && !events.includes(eventKey)) return;

  const body = JSON.stringify({ event: eventKey, formId, timestamp: new Date().toISOString(), ...payload });
  let signature = "";
  if (webhookRow.secret) {
    const { createHmac } = await import("crypto");
    signature = createHmac("sha256", webhookRow.secret).update(body).digest("hex");
  }

  const res = await fetch(webhookRow.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "X-Signature-256": `sha256=${signature}` } : {}),
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  const statusCode = res.status;
  await db
    .update(generalFormWebhooks)
    .set({
      lastTriggeredAt: Date.now(),
      lastStatus: statusCode >= 200 && statusCode < 300 ? "success" : "error",
      lastStatusCode: statusCode,
    })
    .where(eq(generalFormWebhooks.id, webhookRow.id));
}

export async function sendFormNotifyEmail(
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const { sendEmail } = await import("../_core/email");
  await sendEmail({ to, subject, html: body.replace(/\n/g, "<br>"), text: body });
}

export async function fireConfiguredFormActions(
  db: NonNullable<Db>,
  formId: number,
  event: "on_submit" | "on_update",
  actions: FormActionConfig[],
  context: {
    formName: string;
    submissionId: number;
    responses: Record<string, unknown>;
    changedFields?: string[];
  },
): Promise<void> {
  const matching = actions.filter(a => a.enabled && a.event === event);
  for (const action of matching) {
    try {
      if (action.type === "email" && action.emailTo) {
        const subject =
          action.emailSubject ??
          (event === "on_submit"
            ? `New submission: ${context.formName}`
            : `Submission updated: ${context.formName} #${context.submissionId}`);
        const lines = [
          `Form: ${context.formName}`,
          `Submission ID: ${context.submissionId}`,
          event === "on_update" && context.changedFields?.length
            ? `Updated fields: ${context.changedFields.join(", ")}`
            : "",
          "",
          "Responses:",
          ...Object.entries(context.responses).map(([k, v]) => {
            const val = Array.isArray(v) ? v.join(", ") : String(v ?? "");
            return `  ${k}: ${val}`;
          }),
        ].filter(Boolean);
        await sendFormNotifyEmail(action.emailTo, subject, lines.join("\n"));
      }
      if (action.type === "webhook") {
        await fireFormWebhook(db, formId, event === "on_submit" ? "submission" : "update", {
          submissionId: context.submissionId,
          responses: context.responses,
          changedFields: context.changedFields,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FormActions] Failed action ${action.id} (${action.name}):`, msg);
    }
  }
}
