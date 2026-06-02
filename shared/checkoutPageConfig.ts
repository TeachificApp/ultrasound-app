/**
 * shared/checkoutPageConfig.ts
 *
 * Type definitions for the configurable checkout page section system.
 * Used by both the server (routers) and the client (editor + renderer).
 *
 * Sections fall into two categories:
 *   1. Checkout-native sections (trust_seals, guarantee, testimonials, faq, custom_html, course_includes)
 *   2. Landing-page content blocks (any BlockType from BlockPreview.tsx) wrapped in a ContentBlockSection
 *
 * Saved blocks from the block library (blockTemplates) are also supported as ContentBlockSection.
 */

// ─── Trust Seal ──────────────────────────────────────────────────────────────

export type PresetSealId =
  | "stripe_secure"
  | "ssl_encrypted"
  | "money_back_30"
  | "money_back_14"
  | "satisfaction_guaranteed"
  | "hipaa_compliant"
  | "accredited_cme"
  | "secure_payment"
  | "privacy_protected";

export interface TrustSeal {
  id: string;                   // preset id or "custom_<uuid>"
  preset?: PresetSealId;        // if preset, the preset id
  label: string;                // display text, e.g. "30-Day Money-Back Guarantee"
  icon?: string;                // lucide icon name for presets; data URL for custom
  enabled: boolean;
}

// ─── Testimonial ─────────────────────────────────────────────────────────────

export interface Testimonial {
  id: string;
  name: string;
  role?: string;                // e.g. "Registered Nurse, ICU"
  avatarUrl?: string;
  quote: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  enabled: boolean;
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
}

// ─── Checkout-Native Section Types ───────────────────────────────────────────

export interface TrustSealsSection {
  type: "trust_seals";
  enabled: boolean;
  order: number;
  layout: "row" | "grid";       // row = horizontal strip, grid = 2-col grid
  seals: TrustSeal[];
}

export interface GuaranteeSection {
  type: "guarantee";
  enabled: boolean;
  order: number;
  icon: string;                 // lucide icon name
  headline: string;
  body: string;
  badgeLabel?: string;          // e.g. "30-Day Guarantee"
}

export interface TestimonialsSection {
  type: "testimonials";
  enabled: boolean;
  order: number;
  headline?: string;
  testimonials: Testimonial[];
}

export interface FaqSection {
  type: "faq";
  enabled: boolean;
  order: number;
  headline?: string;
  items: FaqItem[];
}

export interface CustomHtmlSection {
  type: "custom_html";
  enabled: boolean;
  order: number;
  html: string;
}

export interface CourseIncludesSection {
  type: "course_includes";
  enabled: boolean;
  order: number;
  headline?: string;
  // null = auto-populate from course data; array = manual override
  items?: Array<{ icon: string; text: string }>;
}

// ─── Content Block Section (wraps any landing-page block type) ────────────────
//
// This allows any block from the BLOCK_CATALOG (text, image, video, hero, CTA,
// testimonial, divider, spacer, etc.) or a saved block template to be added
// to the checkout page as a section.

export interface ContentBlockSection {
  type: "content_block";
  enabled: boolean;
  order: number;
  /** The landing-page block type (e.g. "text", "image", "video", "hero", etc.) */
  blockType: string;
  /** The block's data payload — same shape as Block.data in BlockPreview.tsx */
  blockData: Record<string, any>;
  /** Optional: if this was inserted from a saved block template, store the template id */
  savedBlockTemplateId?: number;
  /** Human-readable label shown in the editor section list */
  label?: string;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type CheckoutSection =
  | TrustSealsSection
  | GuaranteeSection
  | TestimonialsSection
  | FaqSection
  | CustomHtmlSection
  | CourseIncludesSection
  | ContentBlockSection;

export type CheckoutSectionType = CheckoutSection["type"];

// ─── Full Page Config ─────────────────────────────────────────────────────────

export interface CheckoutPageConfig {
  sections: CheckoutSection[];
}

// ─── Default Config ───────────────────────────────────────────────────────────

export function defaultCheckoutPageConfig(): CheckoutPageConfig {
  return {
    sections: [
      {
        type: "trust_seals",
        enabled: false,
        order: 0,
        layout: "row",
        seals: [
          { id: "stripe_secure", preset: "stripe_secure", label: "Secure Payment", enabled: true },
          { id: "ssl_encrypted", preset: "ssl_encrypted", label: "SSL Encrypted", enabled: true },
          { id: "money_back_30", preset: "money_back_30", label: "30-Day Money-Back", enabled: true },
          { id: "satisfaction_guaranteed", preset: "satisfaction_guaranteed", label: "Satisfaction Guaranteed", enabled: true },
        ],
      },
      {
        type: "course_includes",
        enabled: false,
        order: 1,
        headline: "What's included",
      },
      {
        type: "guarantee",
        enabled: false,
        order: 2,
        icon: "ShieldCheck",
        headline: "30-Day Money-Back Guarantee",
        body: "If you're not completely satisfied within 30 days of purchase, we'll refund your payment in full — no questions asked.",
        badgeLabel: "30-Day Guarantee",
      },
      {
        type: "testimonials",
        enabled: false,
        order: 3,
        headline: "What our students say",
        testimonials: [],
      },
      {
        type: "faq",
        enabled: false,
        order: 4,
        headline: "Frequently asked questions",
        items: [
          {
            id: "faq_1",
            question: "How long do I have access to the course?",
            answer: "You have lifetime access to all course materials once enrolled.",
            enabled: true,
          },
          {
            id: "faq_2",
            question: "Can I get a refund?",
            answer: "Yes — we offer a 30-day money-back guarantee. Contact us within 30 days of purchase for a full refund.",
            enabled: true,
          },
        ],
      },
      {
        type: "custom_html",
        enabled: false,
        order: 5,
        html: "",
      },
    ],
  };
}

/** Parse stored JSON config, falling back to defaults if null/invalid */
export function parseCheckoutPageConfig(raw: string | null | undefined): CheckoutPageConfig {
  if (!raw) return defaultCheckoutPageConfig();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sections)) return parsed as CheckoutPageConfig;
    return defaultCheckoutPageConfig();
  } catch {
    return defaultCheckoutPageConfig();
  }
}
