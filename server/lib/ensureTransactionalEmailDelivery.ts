import {
  getSendGridSuppressionStatus,
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
 * Auth emails (magic link, password reset) must deliver despite a marketing
 * opt-out. The SendGrid provider sends all non-marketing messages with
 * list-management bypass enabled, so this probe never clears a member's
 * promotional-email preference or provider suppression record.
 */
export async function ensureTransactionalEmailDelivery(
  deliveryEmail: string,
): Promise<TransactionalEmailDeliveryPrep> {
  if (!isSendGridProvider()) {
    const skipped = emptySuppressionStatus();
    return { deliveryEmail, before: skipped, cleared: false, after: skipped };
  }

  const before = await getSendGridSuppressionStatus(deliveryEmail);
  return { deliveryEmail, before, cleared: false, after: before };
}
