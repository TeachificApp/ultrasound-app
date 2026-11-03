export const SMTP_CAMPAIGN_ANALYTICS_EFFECTIVE_AT = Date.parse("2026-11-03T05:00:00Z");

/** Historical SendGrid events remain available; the requested switch starts Nov 3, 2026 (Eastern). */
export function usesSmtpCampaignAnalytics(campaign: { sentAt?: Date | string | null; createdAt?: Date | string | null }): boolean {
  const date = campaign.sentAt ?? campaign.createdAt;
  return date != null && new Date(date).getTime() >= SMTP_CAMPAIGN_ANALYTICS_EFFECTIVE_AT;
}

export type SmtpReportCounts = {
  accepted: number | null;
  delivered: number | null;
  failed: number | null;
  queued: number | null;
  opened: number | null;
  clicked: number | null;
  unsubscribed: number | null;
  complained: number | null;
};

export type SmtpCampaignReport = {
  status: "ready" | "unconfigured" | "error";
  checkedAt: number;
  notice: string;
  period: "this_day" | "this_week";
  channel: { counts: SmtpReportCounts } | null;
  campaign: {
    counts: SmtpReportCounts;
    matchedMessages: number;
    uniqueOpenRecipients: number | null;
    uniqueClickRecipients: number | null;
    partial: boolean;
  } | null;
  campaignNotice: string;
};
