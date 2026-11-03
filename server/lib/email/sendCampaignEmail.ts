import {
  isCampaignEmailConfigured,
  resolveEffectiveCampaignProvider,
  resolveEmailSender,
  getCampaignEmailProviderId,
} from "./providerConfig";
import { sendViaSendGrid } from "./providers/sendgrid";
import { sendViaSmtpCom } from "./providers/smtpcom";
import type { SendEmailOptions } from "./types";

/** Platform campaigns, newsletters, and other marketing mail (SMTP.com by default). */
export async function sendCampaignEmail(opts: SendEmailOptions): Promise<boolean> {
  const preferred = getCampaignEmailProviderId();
  const provider = resolveEffectiveCampaignProvider();

  if (!isCampaignEmailConfigured() || !provider) {
    const hint =
      preferred === "smtpcom"
        ? "SMTPCOM_API_KEY and SMTPCOM_CHANNEL (or SENDGRID_API_KEY fallback)"
        : "SENDGRID_API_KEY (or SMTPCOM credentials fallback)";
    console.warn(`[email] No campaign email provider configured — skipping send (preferred=${preferred})`);
    console.warn(`[email] Set ${hint}`);
    return false;
  }

  if (provider !== preferred) {
    console.warn(
      `[email] Preferred campaign provider "${preferred}" is not fully configured — falling back to "${provider}"`,
    );
  }

  const sender = resolveEmailSender({ ...opts, provider });

  try {
    const result =
      provider === "smtpcom"
        ? await sendViaSmtpCom(opts, sender)
        : await sendViaSendGrid(opts, sender);

    if (!result.ok) {
      console.error(`[email] campaign ${provider} send failed: ${result.error}`);
      return false;
    }

    console.log(
      `[email] Sent campaign "${opts.subject}" to ${opts.to.email} via ${provider} [brand=${opts.brandMode || "aaus"}]`,
    );
    return true;
  } catch (err) {
    console.error(`[email] Failed to send campaign email via ${provider}:`, err);
    return false;
  }
}
