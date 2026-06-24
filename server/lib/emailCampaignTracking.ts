/**
 * First-party email campaign open/click tracking helpers.
 * Tracking URLs must hit the app server (VITE_APP_URL), not the SEO root domain.
 */
import { and, eq } from "drizzle-orm";
import { emailCampaignEvents } from "../../drizzle/schema";
import { parseRecipientTrackingKey } from "../../shared/emailCampaignAudience";
import type { getDb } from "../db";

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type CampaignEventType = "open" | "click" | "unsubscribe";

/** App origin used in tracking pixel and click-wrap URLs (must include https://). */
export function getEmailCampaignAppUrl(): string {
  const fromEnv = process.env.VITE_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const canonical = process.env.CANONICAL_ROOT_DOMAIN?.trim();
  if (canonical) {
    if (canonical.startsWith("http://") || canonical.startsWith("https://")) {
      return canonical.replace(/\/$/, "");
    }
    return `https://${canonical.replace(/\/$/, "")}`;
  }
  return "https://app.allaboutultrasound.com";
}

function buildClickTrackingUrl(
  appUrl: string,
  campaignId: number,
  recipientKey: string,
  destinationUrl: string,
  variant?: string,
): string {
  const vq = variant ? `&v=${encodeURIComponent(variant)}` : "";
  const encoded = encodeURIComponent(destinationUrl);
  return `${appUrl}/api/email/track/click/${campaignId}/${recipientKey}?url=${encoded}${vq}`;
}

function shouldSkipLinkWrap(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return (
    lower.startsWith("mailto:")
    || lower.startsWith("tel:")
    || lower.startsWith("#")
    || lower.includes("/api/email/track/")
    || lower.includes("/unsubscribe")
  );
}

/** Resolve relative paths to absolute URLs for click tracking. */
export function resolveTrackableHref(href: string, appUrl: string): string | null {
  const url = href.trim();
  if (!url || shouldSkipLinkWrap(url)) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${appUrl}${url}`;
  return null;
}

/** Inject a 1x1 tracking pixel into an HTML email body. */
export function injectTrackingPixel(
  html: string,
  campaignId: number,
  recipientKey: string,
  variant?: string,
): string {
  const appUrl = getEmailCampaignAppUrl();
  const vq = variant ? `?v=${encodeURIComponent(variant)}` : "";
  const pixelUrl = `${appUrl}/api/email/track/open/${campaignId}/${recipientKey}.gif${vq}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  if (html.includes("</body>")) return html.replace("</body>", `${pixel}</body>`);
  return html + pixel;
}

/** Wrap trackable links with click-tracking redirects. */
export function wrapLinksForTracking(
  html: string,
  campaignId: number,
  recipientKey: string,
  variant?: string,
): string {
  const appUrl = getEmailCampaignAppUrl();
  const hrefPattern = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  return html.replace(hrefPattern, (match, dbl: string | undefined, sgl: string | undefined) => {
    const href = (dbl ?? sgl ?? "").trim();
    const absolute = resolveTrackableHref(href, appUrl);
    if (!absolute) return match;
    const quote = match.includes("'") && !match.includes('"') ? "'" : '"';
    const tracked = buildClickTrackingUrl(appUrl, campaignId, recipientKey, absolute, variant);
    return `href=${quote}${tracked}${quote}`;
  });
}

export type RecordCampaignEventInput = {
  campaignId: number;
  recipientKey: string;
  eventType: CampaignEventType;
  metadata?: Record<string, unknown>;
};

function parseRecipientFromKey(recipientKey: string) {
  const { userId, email } = parseRecipientTrackingKey(recipientKey);
  return { userId, email };
}

/** Persist a campaign engagement event. Opens are deduped per recipient per campaign. */
export async function recordEmailCampaignEvent(
  db: DbClient,
  input: RecordCampaignEventInput,
): Promise<void> {
  const { userId, email } = parseRecipientFromKey(input.recipientKey);
  const metadata = JSON.stringify({
    recipient: email ?? input.recipientKey,
    ...input.metadata,
  });

  if (input.eventType === "open") {
    const [existing] = await db
      .select({ id: emailCampaignEvents.id })
      .from(emailCampaignEvents)
      .where(
        and(
          eq(emailCampaignEvents.campaignId, input.campaignId),
          eq(emailCampaignEvents.recipientKey, input.recipientKey),
          eq(emailCampaignEvents.eventType, "open"),
        ),
      )
      .limit(1);
    if (existing) return;
  }

  await db.insert(emailCampaignEvents).values({
    campaignId: input.campaignId,
    userId,
    recipientKey: input.recipientKey,
    eventType: input.eventType,
    metadata,
  });
}

export const TRACKING_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);
