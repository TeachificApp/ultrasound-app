export const CAMPAIGN_DESTINATION_UNAVAILABLE = "Destination unavailable";

export type CampaignEventMetadata = {
  destinationUrl: string | null;
  variant: string | null;
  recipientEmail: string | null;
  provider: string | null;
  source: string | null;
};

export type CampaignDeliveryProviderId = "sendgrid" | "smtpcom" | "tracking" | "unknown";

const DELIVERY_EVENT_TYPES = new Set([
  "processed",
  "delivered",
  "deferred",
  "bounce",
  "blocked",
  "dropped",
  "spamreport",
]);

/**
 * Normalizes both current JSON tracking metadata and legacy plain-text data.
 * It never treats the recipient identity stored in event metadata as a link.
 */
export function parseCampaignEventMetadata(metadata: string | null | undefined): CampaignEventMetadata {
  const raw = metadata?.trim() ?? "";
  if (!raw) return { destinationUrl: null, variant: null, recipientEmail: null, provider: null, source: null };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { destinationUrl: null, variant: null, recipientEmail: null, provider: null, source: null };
    }

    const destination = [parsed.url, parsed.destinationUrl, parsed.linkUrl, parsed.link, parsed.href]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? null;
    const variant = typeof parsed.variant === "string" && parsed.variant.trim()
      ? parsed.variant.trim()
      : null;
    const recipientEmail = typeof parsed.recipient === "string" && parsed.recipient.trim()
      ? parsed.recipient.trim()
      : null;
    const provider = typeof parsed.provider === "string" && parsed.provider.trim()
      ? parsed.provider.trim().toLowerCase()
      : null;
    const source = typeof parsed.source === "string" && parsed.source.trim()
      ? parsed.source.trim()
      : null;
    return { destinationUrl: destination, variant, recipientEmail, provider, source };
  } catch {
    // Legacy events may have stored a plain destination URL rather than JSON.
    return { destinationUrl: raw, variant: null, recipientEmail: null, provider: null, source: null };
  }
}

/** Legacy SendGrid webhook rows omitted provider; delivery lifecycle events default to SendGrid. */
export function inferCampaignEventProvider(
  eventType: string,
  metadata: string | null | undefined,
): CampaignDeliveryProviderId {
  const parsed = parseCampaignEventMetadata(metadata);
  if (parsed.provider === "sendgrid" || parsed.provider === "smtpcom") {
    return parsed.provider;
  }
  if (eventType === "open" || eventType === "click" || eventType === "unsubscribe") {
    return "tracking";
  }
  if (DELIVERY_EVENT_TYPES.has(eventType)) {
    return "sendgrid";
  }
  return "unknown";
}

export type CampaignProviderDeliveryStats = {
  uniqueDelivered: number;
  totalDelivered: number;
  bounces: number;
  blocked: number;
  dropped: number;
  deferred: number;
};

export function summarizeCampaignDeliveryByProvider(
  events: Array<{ eventType: string; metadata: string | null; recipientKey?: string }>,
): Record<CampaignDeliveryProviderId, CampaignProviderDeliveryStats> {
  const empty = (): CampaignProviderDeliveryStats => ({
    uniqueDelivered: 0,
    totalDelivered: 0,
    bounces: 0,
    blocked: 0,
    dropped: 0,
    deferred: 0,
  });
  const stats: Record<CampaignDeliveryProviderId, CampaignProviderDeliveryStats> = {
    sendgrid: empty(),
    smtpcom: empty(),
    tracking: empty(),
    unknown: empty(),
  };
  const deliveredRecipients: Record<CampaignDeliveryProviderId, Set<string>> = {
    sendgrid: new Set(),
    smtpcom: new Set(),
    tracking: new Set(),
    unknown: new Set(),
  };

  for (const event of events) {
    const provider = inferCampaignEventProvider(event.eventType, event.metadata);
    const bucket = stats[provider];
    const recipientKey = event.recipientKey ?? parseCampaignEventMetadata(event.metadata).recipientEmail ?? "";
    switch (event.eventType) {
      case "delivered":
        bucket.totalDelivered += 1;
        if (recipientKey) deliveredRecipients[provider].add(recipientKey);
        break;
      case "bounce":
        bucket.bounces += 1;
        break;
      case "blocked":
        bucket.blocked += 1;
        break;
      case "dropped":
        bucket.dropped += 1;
        break;
      case "deferred":
        bucket.deferred += 1;
        break;
      default:
        break;
    }
  }

  for (const provider of Object.keys(deliveredRecipients) as CampaignDeliveryProviderId[]) {
    stats[provider].uniqueDelivered = deliveredRecipients[provider].size;
  }
  return stats;
}

export function campaignEventDestination(metadata: string | null | undefined): string {
  return parseCampaignEventMetadata(metadata).destinationUrl ?? CAMPAIGN_DESTINATION_UNAVAILABLE;
}

/** Prevent spreadsheet formula interpretation when the browser writes event CSV files. */
export function escapeCampaignCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  const formulaSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}
