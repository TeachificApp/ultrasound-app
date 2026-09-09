import {
  getEmailProviderId,
  isEmailProviderConfigured,
  resolveEffectiveEmailProvider,
  resolveEmailSender,
} from "./providerConfig";
import { sendViaSendGrid } from "./providers/sendgrid";
import { sendViaSmtpCom } from "./providers/smtpcom";
import type { SendEmailOptions } from "./types";

export async function sendTransactionalEmail(opts: SendEmailOptions): Promise<boolean> {
  const preferred = getEmailProviderId();
  const provider = resolveEffectiveEmailProvider();

  if (!isEmailProviderConfigured() || !provider) {
    const hint =
      preferred === "smtpcom"
        ? "SMTPCOM_API_KEY and SMTPCOM_CHANNEL (or SENDGRID_API_KEY fallback)"
        : "SENDGRID_API_KEY (or SMTPCOM credentials fallback)";
    console.warn(`[email] No email provider configured — skipping send (preferred=${preferred})`);
    console.warn(`[email] Set ${hint}`);
    return false;
  }

  if (provider !== preferred) {
    console.warn(
      `[email] Preferred provider "${preferred}" is not fully configured — falling back to "${provider}"`,
    );
  }

  const sender = resolveEmailSender({ ...opts, provider });

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
