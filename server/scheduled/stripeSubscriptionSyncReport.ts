export type RevokedStripeAccessAccount = {
  userId: number;
  displayName: string;
  courseTitle: string;
  reason: string;
};

export function isAccountAddedSincePreviousSync({ hasPreviousSync, wasPreviouslyObserved }: { hasPreviousSync: boolean; wasPreviouslyObserved: boolean }) {
  return hasPreviousSync && !wasPreviouslyObserved;
}

export function formatStripeSubscriptionSyncReport({
  totalSubscriptions,
  accountsAdded,
  accessRevoked,
  revokedAccounts,
  warningEmailsSent,
  errors,
}: {
  totalSubscriptions: number;
  accountsAdded: number;
  accessRevoked: number;
  revokedAccounts: RevokedStripeAccessAccount[];
  warningEmailsSent: number;
  errors: number;
}) {
  const lines = [
    `Daily sync completed. Total subscriptions checked: ${totalSubscriptions}.`,
    `Accounts added since the previous sync: ${accountsAdded}.`,
    warningEmailsSent > 0 ? `Payment warning emails sent: ${warningEmailsSent} (grace period started).` : null,
    accessRevoked > 0 ? `Access removed: ${accessRevoked} enrollment(s).` : null,
    ...revokedAccounts.map((account) => `• ${account.displayName} (Account ${account.userId}) — ${account.courseTitle}: ${account.reason}.`),
    errors > 0 ? `Errors: ${errors} (check server logs).` : null,
  ];
  return lines.filter(Boolean).join("\n");
}
