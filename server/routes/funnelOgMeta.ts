/**
 * Funnel Page OG Meta Injection
 *
 * When a social media crawler (iMessage, WhatsApp, Twitter, Slack, etc.) fetches
 * a funnel page URL, this middleware intercepts the request and injects the
 * page-specific seoTitle / seoDescription / seoImage into the HTML <head>
 * so that link previews show the correct content.
 *
 * For real browsers the SPA loads normally — no change in behaviour.
 */

import type { Express } from "express";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { funnels, funnelPages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

/** User-agent substrings that identify social/link-preview crawlers */
const BOT_UA_PATTERNS = [
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "slackbot",
  "telegrambot",
  "discordbot",
  "applebot",
  "imessage",
  "iMessagePreview",
  "preview",
  "crawler",
  "bot/",
  "spider",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "okhttp",
];

function isBotRequest(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => ua.includes(p.toLowerCase()));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMetaTags(opts: {
  title: string;
  description: string;
  imageUrl?: string | null;
  pageUrl: string;
}): string {
  const { title, description, imageUrl, pageUrl } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = imageUrl ? escapeHtml(imageUrl) : "";

  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    img ? `<meta property="og:image" content="${img}" />` : "",
    img ? `<meta property="og:image:width" content="1200" />` : "",
    img ? `<meta property="og:image:height" content="630" />` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    img ? `<meta name="twitter:image" content="${img}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

async function getFunnelPageSeo(
  funnelSlug: string,
  pageSlug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [funnel] = await db
      .select({ id: funnels.id, title: funnels.title })
      .from(funnels)
      .where(eq(funnels.slug, funnelSlug))
      .limit(1);
    if (!funnel) return null;

    const [page] = await db
      .select({
        title: funnelPages.title,
        seoTitle: funnelPages.seoTitle,
        seoDescription: funnelPages.seoDescription,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(
        and(
          eq(funnelPages.funnelId, funnel.id),
          eq(funnelPages.slug, pageSlug)
        )
      )
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title || funnel.title,
      description: page.seoDescription || "",
      image: page.seoImage,
    };
  } catch {
    return null;
  }
}

async function getStandalonePageSeo(
  pageSlug: string
): Promise<{ title: string; description: string; image?: string | null } | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [page] = await db
      .select({
        title: funnelPages.title,
        seoTitle: funnelPages.seoTitle,
        seoDescription: funnelPages.seoDescription,
        seoImage: funnelPages.seoImage,
      })
      .from(funnelPages)
      .where(eq(funnelPages.slug, pageSlug))
      .limit(1);
    if (!page) return null;

    return {
      title: page.seoTitle || page.title,
      description: page.seoDescription || "",
      image: page.seoImage,
    };
  } catch {
    return null;
  }
}

function getIndexHtmlPath(): string {
  if (process.env.NODE_ENV === "development") {
    return path.resolve(process.cwd(), "client", "index.html");
  }
  return path.resolve(process.cwd(), "dist", "public", "index.html");
}

export function registerFunnelOgMetaRoutes(app: Express) {
  // Handle /f/:funnelSlug/:pageSlug
  app.get("/f/:funnelSlug/:pageSlug", async (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    // Always inject meta tags (both bots and real users benefit from correct title)
    const seo = await getFunnelPageSeo(req.params.funnelSlug, req.params.pageSlug);
    if (!seo) return next();

    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();

    let html = fs.readFileSync(indexPath, "utf-8");
    const pageUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const metaTags = buildMetaTags({
      title: seo.title,
      description: seo.description,
      imageUrl: seo.image,
      pageUrl,
    });

    // Replace existing <title> and inject OG tags
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
    html = html.replace(
      /<\/head>/,
      `    <!-- Funnel Page SEO -->\n    ${metaTags}\n  </head>`
    );

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });

  // Handle /p/:pageSlug (standalone landing pages)
  app.get("/p/:pageSlug", async (req, res, next) => {
    const seo = await getStandalonePageSeo(req.params.pageSlug);
    if (!seo) return next();

    const indexPath = getIndexHtmlPath();
    if (!fs.existsSync(indexPath)) return next();

    let html = fs.readFileSync(indexPath, "utf-8");
    const pageUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const metaTags = buildMetaTags({
      title: seo.title,
      description: seo.description,
      imageUrl: seo.image,
      pageUrl,
    });

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`);
    html = html.replace(
      /<\/head>/,
      `    <!-- Funnel Page SEO -->\n    ${metaTags}\n  </head>`
    );

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
