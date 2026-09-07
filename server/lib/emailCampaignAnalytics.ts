export const CAMPAIGN_DESTINATION_UNAVAILABLE = "Destination unavailable";

export type CampaignEventMetadata = {
  destinationUrl: string | null;
  variant: string | null;
  recipientEmail: string | null;
};

/**
 * Normalizes both current JSON tracking metadata and legacy plain-text data.
 * It never treats the recipient identity stored in event metadata as a link.
 */
export function parseCampaignEventMetadata(metadata: string | null | undefined): CampaignEventMetadata {
  const raw = metadata?.trim() ?? "";
  if (!raw) return { destinationUrl: null, variant: null, recipientEmail: null };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { destinationUrl: null, variant: null, recipientEmail: null };
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
    return { destinationUrl: destination, variant, recipientEmail };
  } catch {
    // Legacy events may have stored a plain destination URL rather than JSON.
    return { destinationUrl: raw, variant: null, recipientEmail: null };
  }
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
