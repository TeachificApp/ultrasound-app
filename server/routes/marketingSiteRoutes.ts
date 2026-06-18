/**
 * marketingSiteRoutes.ts — staging robots.txt, noindex injection, path aliases.
 */
import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { marketingSitePages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { MARKETING_SITE_KEY, MARKETING_STAGING_HOST, isMarketingStagingHost } from "@shared/marketingSiteConstants";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizePath(raw: string): string {
  let p = raw.split("?")[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
  if (p === "/index.html" || p === "/home.html") p = "/";
  return p;
}

const STAGING_ROBOTS = `User-agent: *
Disallow: /
`;

const NOINDEX_TAG = '<meta name="robots" content="noindex, nofollow">';

export function registerMarketingSiteRoutes(app: Express) {
  app.get("/robots.txt", (req: Request, res: Response, next) => {
    const host = (req.get("host") ?? "").toLowerCase();
    if (!isMarketingStagingHost(host)) return next();
    res.type("text/plain").send(STAGING_ROBOTS);
  });

  /** Legacy .html aliases without extension for convenience during review */
  app.get(["/index.html", "/home.html"], (req: Request, res: Response, next) => {
    const host = req.get("host") ?? "";
    if (!isMarketingStagingHost(host)) return next();
    res.redirect(301, "/");
  });
}

export function registerMarketingSiteOgMeta(app: Express) {
  const getIndexHtmlPath = () => {
    if (process.env.NODE_ENV === "development") {
      return path.resolve(process.cwd(), "client", "index.html");
    }
    return path.resolve(process.cwd(), "dist", "public", "index.html");
  };
  app.get("*", async (req: Request, res: Response, next) => {
    const host = (req.get("host") ?? "").toLowerCase();
    if (!isMarketingStagingHost(host)) return next();
    if (req.path.startsWith("/api/") || req.path.startsWith("/trpc") || req.path.includes(".")) return next();

    const accept = req.get("accept") ?? "";
    if (!accept.includes("text/html")) return next();

    let html: string;
    try {
      html = fs.readFileSync(getIndexHtmlPath(), "utf-8");
    } catch {
      return next();
    }

    const pagePath = normalizePath(req.path);
    let title = "All About Ultrasound — Staging Preview";
    let description = "Staging copy for review. Not the live website.";
    let ogImage = "";

    try {
      const db = await getDb();
      if (db) {
        const [page] = await db.select().from(marketingSitePages)
          .where(and(
            eq(marketingSitePages.siteKey, MARKETING_SITE_KEY),
            eq(marketingSitePages.path, pagePath),
          ))
          .limit(1);
        if (page?.seoTitle) title = page.seoTitle;
        if (page?.seoDescription) description = page.seoDescription;
        if (page?.seoImage) ogImage = page.seoImage;
      }
    } catch { /* ignore */ }

    const stagingUrl = `https://${MARKETING_STAGING_HOST}${pagePath === "/" ? "" : pagePath}`;
    const meta = [
      NOINDEX_TAG,
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(stagingUrl)}" />`,
      ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : "",
      `<link rel="canonical" href="${escapeHtml(stagingUrl)}" />`,
    ].filter(Boolean).join("\n    ");

    html = html.replace(/<title>[^<]*<\/title>/i, "").replace("</head>", `    ${meta}\n  </head>`);
    if (!html.includes("noindex")) {
      html = html.replace("<head>", `<head>\n    ${NOINDEX_TAG}`);
    }

    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.send(html);
  });
}
