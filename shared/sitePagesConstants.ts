/**
 * Site Pages — multi-domain marketing/system page registry.
 */
import type { Brand } from "./brands";

export const SITE_PAGE_DOMAINS = [
  // ── All About Ultrasound ──────────────────────────────────────────────────
  { value: "learn.allaboutultrasound.com",   label: "Learn — allaboutultrasound.com",          brand: "aaus" as Brand },
  { value: "app.allaboutultrasound.com",     label: "App — allaboutultrasound.com",            brand: "aaus" as Brand },
  { value: "members.allaboutultrasound.com", label: "Members — allaboutultrasound.com",        brand: "aaus" as Brand },
  { value: "allaboutultrasound.com",         label: "Marketing root — allaboutultrasound.com", brand: "aaus" as Brand },
  // ── iHeartEcho ───────────────────────────────────────────────────────────
  { value: "app.iheartecho.com",             label: "App — iheartecho.com",                   brand: "iheartecho" as Brand },
  { value: "app.iheartecho.net",             label: "App — iheartecho.net (legacy)",           brand: "iheartecho" as Brand },
  { value: "accreditation.iheartecho.com",   label: "Accreditation — iheartecho.com",         brand: "iheartecho" as Brand },
] as const;

export type SitePageDomain = (typeof SITE_PAGE_DOMAINS)[number]["value"];

export const SITE_PAGE_KINDS = [
  "standard",
  "home",
  "legal_privacy",
  "legal_terms",
  "error_404",
  "login",
  "sales",
  "system",
] as const;

export type SitePageKind = (typeof SITE_PAGE_KINDS)[number];

export const SITE_NAV_MENU_KEYS = ["header", "sidebar", "profile", "footer"] as const;
export type SiteNavMenuKey = (typeof SITE_NAV_MENU_KEYS)[number];

export type SiteNavItem = {
  id: string;
  label: string;
  href?: string;
  sitePageId?: number;
  children?: SiteNavItem[];
  openInNewTab?: boolean;
  hidden?: boolean;
};

export type SitePageTreeNode = {
  id: string;
  label: string;
  slug: string | null;
  kind: "site" | "course" | "quiz" | "cohort" | "download" | "product" | "funnel" | "webinar" | "community" | "folder";
  sitePageId?: number;
  entityId?: number;
  subKind?: string;
  parentId: string | null;
  children: SitePageTreeNode[];
  editable: boolean;
  editorRoute: string | null;
  previewUrl: string | null;
  hiddenFromNav: boolean;
  showInHeaderNav: boolean;
  showInSidebarNav: boolean;
  showInProfileNav: boolean;
  status?: "draft" | "published";
};

/** Slugs reserved for app routing — cannot be used for custom site pages. */
export const RESERVED_SITE_SLUGS = new Set([
  "admin",
  "api",
  "media",
  "courses",
  "course",
  "checkout",
  "login",
  "register",
  "p",
  "funnel",
  "embed",
  "teach",
  "platform-admin",
  "instructor-portal",
  "sonoquiz",
  "reports",
  "forms",
  "404",
]);

export const DEFAULT_SYSTEM_PAGES: Array<{
  slug: string;
  title: string;
  pageKind: SitePageKind;
  defaultBlocks: unknown[];
}> = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    pageKind: "legal_privacy",
    defaultBlocks: [
      {
        id: "privacy-hero",
        type: "hero",
        data: {
          headline: "Privacy Policy",
          subheadline: "How we collect, use, and protect your information.",
          ctaText: "",
          ctaUrl: "",
          bgImage: "",
          align: "center",
        },
      },
      {
        id: "privacy-body",
        type: "text",
        data: {
          content:
            "<p>Edit this page to replace the default privacy policy content. You can import from your existing site or build sections with the block editor.</p>",
        },
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    pageKind: "legal_terms",
    defaultBlocks: [
      {
        id: "terms-hero",
        type: "hero",
        data: {
          headline: "Terms of Service",
          subheadline: "Terms governing use of this platform.",
          ctaText: "",
          ctaUrl: "",
          bgImage: "",
          align: "center",
        },
      },
      {
        id: "terms-body",
        type: "text",
        data: {
          content: "<p>Edit this page with your terms of service content.</p>",
        },
      },
    ],
  },
  {
    slug: "404",
    title: "Page Not Found",
    pageKind: "error_404",
    defaultBlocks: [
      {
        id: "404-hero",
        type: "hero",
        data: {
          headline: "Page not found",
          subheadline: "The page you are looking for does not exist or has moved.",
          ctaText: "Go home",
          ctaUrl: "/",
          bgImage: "",
          align: "center",
        },
      },
    ],
  },
  {
    slug: "login",
    title: "Login",
    pageKind: "login",
    defaultBlocks: [
      {
        id: "login-intro",
        type: "text",
        data: {
          content:
            "<p>Optional content shown above the login form. The sign-in form itself is provided by the app.</p>",
        },
      },
    ],
  },
];
