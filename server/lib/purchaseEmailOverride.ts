import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "../../drizzle/schema";
import { purchaseEmailOverrides } from "../../drizzle/schema";
import { TRANSACTIONAL_EMAIL_DEEP_TEAL } from "../../shared/transactionalEmailPalette";

/** Content scopes supported by the centralized purchase-email editor. */
export const PURCHASE_EMAIL_CONTENT_TYPES = [
  "course",
  "quiz",
  "cohort",
  "download",
  "bundle",
  "webinar",
  "workshop",
  "workshop_instance",
  "physical_product",
  "membership",
] as const;

export type PurchaseEmailContentType = typeof PURCHASE_EMAIL_CONTENT_TYPES[number];

export type PurchaseEmailOverride = {
  contentType: PurchaseEmailContentType;
  contentId: number;
  enabled: boolean;
  subject: string | null;
  heading: string | null;
  intro: string | null;
  detailsHtml: string | null;
};

export type PurchaseEmailCopy = {
  subject: string;
  heading: string;
  intro: string;
  detailsHtml?: string | null;
};

function meaningful(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Gets one enabled content-level override.  A disabled override is deliberately
 * ignored so normal, dynamically generated purchase details remain active.
 */
export async function getPurchaseEmailOverride(
  db: MySql2Database<typeof schema>,
  contentType: PurchaseEmailContentType,
  contentId: number,
): Promise<PurchaseEmailOverride | null> {
  const [override] = await db
    .select({
      contentType: purchaseEmailOverrides.contentType,
      contentId: purchaseEmailOverrides.contentId,
      enabled: purchaseEmailOverrides.enabled,
      subject: purchaseEmailOverrides.subject,
      heading: purchaseEmailOverrides.heading,
      intro: purchaseEmailOverrides.intro,
      detailsHtml: purchaseEmailOverrides.detailsHtml,
    })
    .from(purchaseEmailOverrides)
    .where(and(
      eq(purchaseEmailOverrides.contentType, contentType),
      eq(purchaseEmailOverrides.contentId, contentId),
    ))
    .limit(1);

  if (!override?.enabled) return null;
  return override as PurchaseEmailOverride;
}

/**
 * Resolves the most specific enabled copy.  Workshop-instance copy takes
 * precedence over a workshop-level override, while every other content type
 * receives its own item-level row.
 */
export async function getEffectivePurchaseEmailOverride(
  db: MySql2Database<typeof schema>,
  candidates: Array<{ contentType: PurchaseEmailContentType; contentId: number | null | undefined }>,
): Promise<PurchaseEmailOverride | null> {
  for (const candidate of candidates) {
    if (!candidate.contentId || candidate.contentId <= 0) continue;
    const override = await getPurchaseEmailOverride(db, candidate.contentType, candidate.contentId);
    if (override) return override;
  }
  return null;
}

/** Applies populated fields without ever replacing a required dynamic default. */
export function applyPurchaseEmailOverride(
  defaults: PurchaseEmailCopy,
  override?: PurchaseEmailOverride | null,
): PurchaseEmailCopy {
  if (!override) return defaults;
  return {
    subject: meaningful(override.subject) ?? defaults.subject,
    heading: meaningful(override.heading) ?? defaults.heading,
    intro: meaningful(override.intro) ?? defaults.intro,
    detailsHtml: meaningful(override.detailsHtml) ?? defaults.detailsHtml ?? null,
  };
}

/** Renders only override copy for template families that own their legacy markup. */
export function renderPurchaseEmailOverrideBlock(override?: PurchaseEmailOverride | null): string {
  if (!override) return "";
  const heading = meaningful(override.heading);
  const intro = meaningful(override.intro);
  const details = meaningful(override.detailsHtml);
  if (!heading && !intro && !details) return "";
  return `
    <section style="margin:0 0 20px;">
      ${heading ? `<h2 style="margin:0 0 8px;font-size:22px;color:${TRANSACTIONAL_EMAIL_DEEP_TEAL};font-family:Georgia,serif;">${heading}</h2>` : ""}
      ${intro ? `<div style="margin:0 0 14px;font-size:15px;color:#475569;line-height:1.6;">${intro}</div>` : ""}
      ${details ? `<div style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">${details}</div>` : ""}
    </section>`;
}
