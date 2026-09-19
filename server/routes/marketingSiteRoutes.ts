/**
 * Public-site SEO routes — robots, legacy URL aliases, and page-level metadata
 * for the two independently editable brand sites.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { marketingSitePages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  getPublicSiteTenantForHost,
  isPublicSiteHost,
  isPublicSiteStagingHost,
  publicSiteOrigin,
} from "@shared/publicSiteTenants";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizePath(raw: string): string {
  let value = raw.split("?")[0] || "/";
  if (!value.startsWith("/")) value = `/${value}`;
  if (value !== "/" && value.endsWith("/")) value = value.slice(0, -1);
  if (value === "/index.html" || value === "/home.html") value = "/";
  return value;
}

function isPublicHtmlRequest(req: Request): boolean {
  if (req.path.startsWith("/api/") || req.path.startsWith("/trpc")) return false;
  if (req.path === "/robots.txt" || req.path === "/sitemap.xml") return false;
  // .html source paths are public CMS pages; static file extensions are not.
  return !/\.(?:js|mjs|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|pdf|mp4|webm)$/i.test(req.path);
}

export function registerMarketingSiteRoutes(app: Express) {
  app.get("/robots.txt", (req: Request, res: Response, next) => {
    const host = req.get("host") ?? "";
    if (!isPublicSiteHost(host)) return next();
    if (isPublicSiteStagingHost(host)) {
      res.type("text/plain").send("User-agent: *\nDisallow: /\n");
      return;
    }
    res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: https://" + host.split(":")[0] + "/sitemap.xml\n");
  });

  app.get(["/index.html", "/home.html"], (req: Request, res: Response, next) => {
    const tenant = getPublicSiteTenantForHost(req.get("host") ?? "");
    if (!tenant) return next();
    res.redirect(301, "/");
  });
}

export function registerMarketingSiteOgMeta(app: Express) {
  const getIndexHtmlPath = () => process.env.NODE_ENV === "development"
    ? path.resolve(process.cwd(), "client", "index.html")
    : path.resolve(process.cwd(), "dist", "public", "index.html");

  app.get("*", async (req: Request, res: Response, next) => {
    const tenant = getPublicSiteTenantForHost(req.get("host") ?? "");
    if (!tenant || !isPublicHtmlRequest(req)) return next();
    const accept = req.get("accept") ?? "";
    if (!accept.includes("text/html")) return next();

    let html: string;
    try { html = fs.readFileSync(getIndexHtmlPath(), "utf-8"); } catch { return next(); }
    const pagePath = normalizePath(req.path);
    let title = `${tenant.siteName} — Clinical Education`;
    let description = tenant.brand === "iheartecho"
      ? "Echocardiography clinical education, tools, and resources from iHeartEcho."
      : "Ultrasound education, clinical training, and resources from All About Ultrasound.";
    let image = "";
    let structuredData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": pagePath === "/" ? "WebSite" : "WebPage",
      name: tenant.siteName,
      url: `${publicSiteOrigin(tenant, "promotion")}${pagePath === "/" ? "/" : pagePath}`,
    };

    try {
      const db = await getDb();
      if (db) {
        const [page] = await db.select().from(marketingSitePages).where(and(
          eq(marketingSitePages.siteKey, tenant.key),
          eq(marketingSitePages.path, pagePath),
          eq(marketingSitePages.isPublished, true),
        )).limit(1);
        if (page?.seoTitle) title = page.seoTitle;
        if (page?.seoDescription) description = page.seoDescription;
        if (page?.seoImage) image = page.seoImage;
        if (page?.pageType === "blog_post") {
          structuredData = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: page.title ?? title,
            description,
            image: image || undefined,
            author: page.blogAuthor ? { "@type": "Person", name: page.blogAuthor } : undefined,
            articleSection: page.blogCategory || undefined,
            datePublished: page.blogPublishedAt ? new Date(page.blogPublishedAt).toISOString() : undefined,
            dateModified: page.updatedAt ? new Date(page.updatedAt).toISOString() : undefined,
            mainEntityOfPage: `${publicSiteOrigin(tenant, "promotion")}${pagePath}`,
            publisher: { "@type": "Organization", name: tenant.siteName },
          };
        }
      }
    } catch {
      // Public rendering continues with safe tenant defaults if the CMS query fails.
    }

    const requestOrigin = `https://${(req.get("host") ?? tenant.currentHost).split(":")[0]}`;
    const canonical = `${publicSiteOrigin(tenant, "promotion")}${pagePath === "/" ? "" : pagePath}`;
    const noindex = isPublicSiteStagingHost(req.get("host") ?? "");
    const meta = [
      noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">',
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(`${requestOrigin}${pagePath === "/" ? "" : pagePath}`)}" />`,
      image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "",
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
      `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`,
    ].filter(Boolean).join("\n    ");

    html = html.replace(/<title>[^<]*<\/title>/i, "").replace("</head>", `    ${meta}\n  </head>`);
    res.setHeader("Content-Type", "text/html");
    if (noindex) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.send(html);
  });
}
