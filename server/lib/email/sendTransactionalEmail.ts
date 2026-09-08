import { getEmailProviderId, isEmailProviderConfigured, resolveEmailSender } from "./providerConfig";
import { sendViaSendGrid } from "./providers/sendgrid";
import { sendViaSmtpCom } from "./providers/smtpcom";
import type { SendEmailOptions } from "./types";

export async function sendTransactionalEmail(opts: SendEmailOptions): Promise<boolean> {
  if (!isEmailProviderConfigured()) {
    const provider = getEmailProviderId();
    const hint =
      provider === "smtpcom"
        ? "SMTPCOM_API_KEY and SMTPCOM_CHANNEL"
        : "SENDGRID_API_KEY";
    console.warn(`[email] ${hint} not set — skipping email send (provider=${provider})`);
    return false;
  }

  const provider = getEmailProviderId();
  const sender = resolveEmailSender(opts);

  try {
    const result =
      provider === "smtpcom"
        ? await sendViaSmtpCom(opts, sender)
        : await sendViaSendGrid(opts, sender);

    if (!result.ok) {
      console.error(`[email] ${provider} send failed: ${result.error}`);
      return false;
    }

    console.log(
      `[email] Sent "${opts.subject}" to ${opts.to.email} via ${provider} [brand=${opts.brandMode || "aaus"}]`,
    );
    return true;
  } catch (err) {
    console.error(`[email] Failed to send email via ${provider}:`, err);
    return false;
  }
}
