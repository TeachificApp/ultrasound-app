import {
  clearSendGridSuppressionLists,
  getSendGridSuppressionStatus,
  isSendGridDeliveryBlocked,
  type SendGridSuppressionStatus,
} from "./sendgridSuppressions";
import { isSendGridProvider } from "./email/providerConfig";

export type TransactionalEmailDeliveryPrep = {
  deliveryEmail: string;
  before: SendGridSuppressionStatus;
  cleared: boolean;
  after: SendGridSuppressionStatus;
};

const emptySuppressionStatus = (): SendGridSuppressionStatus => ({
  global_unsubscribe: false,
  bounces: false,
  blocks: false,
  spam_reports: false,
  invalid_emails: false,
});

/**
 * Auth emails (magic link, password reset) must deliver even if the address was
 * previously unsubscribed or bounced. Clear SendGrid suppressions when the user
 * explicitly requests a sign-in email when SendGrid is the effective provider
 * (including SendGrid fallback when SMTP.com is preferred but not configured).
 */
export async function ensureTransactionalEmailDelivery(
  deliveryEmail: string,
): Promise<TransactionalEmailDeliveryPrep> {
  if (!isSendGridProvider()) {
    const skipped = emptySuppressionStatus();
    return { deliveryEmail, before: skipped, cleared: false, after: skipped };
  }

  const before = await getSendGridSuppressionStatus(deliveryEmail);
  if (!isSendGridDeliveryBlocked(before)) {
    return { deliveryEmail, before, cleared: false, after: before };
  }

  console.warn(
    `[auth-email] SendGrid suppressions blocked delivery to ${deliveryEmail}:`,
    before,
  );
  await clearSendGridSuppressionLists(deliveryEmail);
  const after = await getSendGridSuppressionStatus(deliveryEmail);
  return { deliveryEmail, before, cleared: true, after };
}
