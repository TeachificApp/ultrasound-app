import {
  clearSendGridSuppressionLists,
  getSendGridSuppressionStatus,
  isSendGridDeliveryBlocked,
  type SendGridSuppressionStatus,
} from "./sendgridSuppressions";

export type TransactionalEmailDeliveryPrep = {
  deliveryEmail: string;
  before: SendGridSuppressionStatus;
  cleared: boolean;
  after: SendGridSuppressionStatus;
};

/**
 * Auth emails (magic link, password reset) must deliver even if the address was
 * previously unsubscribed or bounced. Clear SendGrid suppressions when the user
 * explicitly requests a sign-in email.
 */
export async function ensureTransactionalEmailDelivery(
  deliveryEmail: string,
): Promise<TransactionalEmailDeliveryPrep> {
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
