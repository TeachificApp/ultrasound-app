import { getMessageEmailProvider, isSendGridConfigured, isSmtpComConfigured, resolveEmailSender } from "./providerConfig";
import { sendViaSendGrid } from "./providers/sendgrid";
import { sendViaSmtpCom } from "./providers/smtpcom";
import type { SendEmailOptions } from "./types";

/** Legacy entry point for both classes; campaigns never silently fall back to the transactional provider. */
export async function sendTransactionalEmail(opts: SendEmailOptions): Promise<boolean> {
  const provider = getMessageEmailProvider(opts);
  const configured = provider === "smtpcom" ? isSmtpComConfigured() : isSendGridConfigured();
  if (!configured) {
    console.warn(`[email] ${provider} is not configured for this delivery class — skipping send (no cross-provider fallback).`);
    return false;
  }
  const sender = resolveEmailSender({ ...opts, provider });
  try {
    const result = provider === "smtpcom" ? await sendViaSmtpCom(opts, sender) : await sendViaSendGrid(opts, sender);
    if (!result.ok) {
      console.error(`[email] ${provider} send failed: ${result.error}`);
      return false;
    }
    const messageId = "messageId" in result && typeof result.messageId === "string" ? result.messageId : undefined;
    // A logging hook must never make an accepted send look failed (and invite a duplicate retry).
    try { opts.onProviderAccepted?.({ provider, messageId, ...(provider === "smtpcom" ? { channel: process.env.SMTPCOM_CHANNEL?.trim() } : {}) }); }
    catch { console.warn("[email] Provider acceptance logging hook failed; message was accepted."); }
    console.log(`[email] Message accepted via ${provider} [brand=${opts.brandMode || "aaus"}]`);
    return true;
  } catch {
    console.error(`[email] Failed to send email via ${provider}.`);
    return false;
  }
}
