export const DEFAULT_CAMPAIGN_TEST_SUBJECT = "Campaign preview";

/**
 * Preview emails must be deliverable before an admin has finalized the live
 * campaign's required subject line. This fallback is limited to the one-off
 * test-send flow; scheduled and live campaign sends still require a subject.
 */
export function resolveCampaignTestSubject(subject?: string | null): string {
  const normalized = subject?.trim();
  return normalized || DEFAULT_CAMPAIGN_TEST_SUBJECT;
}
