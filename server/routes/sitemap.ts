/**
 * sitemap.ts
 * Dynamic XML sitemap for SEO — includes all public courses, downloads, webinars,
 * bundles, communities, and standalone funnel pages.
 */
import type { Express } from "express";
import { getDb } from "../db";
import { lmsCourses, digitalProducts, webinars, bundles, communities, funnelPages } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const CANONICAL_DOMAIN = process.env.CANONICAL_ROOT_DOMAIN ?? "https://learn.allaboutultrasound.com";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function urlEntry(loc: string, priority = "0.7", changefreq = "weekly", lastmod?: string): string {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

export function registerSitemapRoute(app: Express) {
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const origin = CANONICAL_DOMAIN.replace(/\/$/, "");
      const entries: string[] = [];

      // Static pages
      entries.push(urlEntry(`${origin}/`, "1.0", "daily"));
      entries.push(urlEntry(`${origin}/education-library`, "0.9", "daily"));
      entries.push(urlEntry(`${origin}/community`, "0.8", "weekly"));

      // Courses
      const courses = await db.select({ slug: lmsCourses.slug, updatedAt: lmsCourses.updatedAt })
        .from(lmsCourses)
        .where(eq(lmsCourses.status, "public"));
      for (const c of courses) {
        if (c.slug) {
          const lastmod = c.updatedAt ? new Date(c.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/courses/${c.slug}`, "0.8", "weekly", lastmod));
        }
      }

      // Downloads (digital products)
      const downloads = await db.select({ slug: digitalProducts.slug, updatedAt: digitalProducts.updatedAt })
        .from(digitalProducts)
        .where(eq(digitalProducts.status, "published"));
      for (const d of downloads) {
        if (d.slug) {
          const lastmod = d.updatedAt ? new Date(d.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/downloads/${d.slug}`, "0.7", "weekly", lastmod));
        }
      }

      // Webinars
      const webinarRows = await db.select({ slug: webinars.slug, updatedAt: webinars.updatedAt })
        .from(webinars)
        .where(eq(webinars.status, "published"));
      for (const w of webinarRows) {
        if (w.slug) {
          const lastmod = w.updatedAt ? new Date(w.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/webinars/${w.slug}`, "0.7", "weekly", lastmod));
        }
      }

      // Bundles
      const bundleRows = await db.select({ slug: bundles.slug, updatedAt: bundles.updatedAt })
        .from(bundles)
        .where(eq(bundles.status, "published"));
      for (const b of bundleRows) {
        if (b.slug) {
          const lastmod = b.updatedAt ? new Date(b.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/bundles/${b.slug}`, "0.7", "weekly", lastmod));
        }
      }

      // Communities
      const communityRows = await db.select({ slug: communities.slug, updatedAt: communities.updatedAt })
        .from(communities)
        .where(eq(communities.status, "published"));
      for (const c of communityRows) {
        if (c.slug) {
          const lastmod = c.updatedAt ? new Date(c.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/community/${c.slug}`, "0.6", "weekly", lastmod));
        }
      }

      // Standalone funnel pages
      const funnelPageRows = await db.select({ slug: funnelPages.slug, updatedAt: funnelPages.updatedAt })
        .from(funnelPages)
        .where(and(eq(funnelPages.isStandaloneLanding, true), eq(funnelPages.isActive, true)));
      for (const fp of funnelPageRows) {
        if (fp.slug) {
          const lastmod = fp.updatedAt ? new Date(fp.updatedAt).toISOString().split("T")[0] : undefined;
          entries.push(urlEntry(`${origin}/p/${fp.slug}`, "0.7", "monthly", lastmod));
        }
      }

      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...entries,
        "</urlset>",
      ].join("\n");

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      console.error("[sitemap] error:", err);
      res.status(500).send("Sitemap generation failed");
    }
  });

  // robots.txt
  app.get("/robots.txt", (req, res) => {
    const origin = CANONICAL_DOMAIN.replace(/\/$/, "");
    const txt = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /my-",
      "Disallow: /checkout",
      "Disallow: /course-player",
      "Disallow: /quiz/",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
    ].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(txt);
  });
}
