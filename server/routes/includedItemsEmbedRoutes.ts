/**
 * includedItemsEmbedRoutes.ts
 *
 * Public CORS-open endpoints for the embeddable "Included Items" widget.
 * Supports both membership plans and bundles as the data source.
 *
 * Routes:
 *   GET /api/included-items-embed/data?source=membership|bundle&id=<N>
 *       — JSON data for the items (used by the JS loader)
 *   GET /embed/included-items?source=membership|bundle&id=<N>[&columns=3][&layout=grid|list][&accent=#hex][&theme=light|dark][&headline=...][&ctaUrl=...][&ctaLabel=...]
 *       — Standalone iframe page
 *   GET /embed/included-items.js
 *       — JS loader script (drop a <div data-included-items-embed="membership:1"> on any page)
 */

import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import {
  membershipPlans,
  membershipPlanAccess,
  bundles,
  bundleItems,
  lmsCourses,
  digitalProducts,
  webinars,
  sonoQuizzes,
  communities,
} from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function setFrameable(res: Response) {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
}

function escHtml(s: string | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Item type labels & icons (inline SVG) ────────────────────────────────────

const ITEM_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  quiz: "Quiz",
  cohort: "Cohort",
  workshop: "Workshop",
  download: "Digital Download",
  webinar: "Webinar",
  community: "Community",
  ultrasoundassist_free: "UltrasoundAssist™",
  ultrasoundassist_premium: "UltrasoundAssist™",
  echoassist_free: "EchoAssist™",
  echoassist_premium: "EchoAssist™",
  all_courses: "All Courses",
  all_downloads: "All Downloads",
};

const AAUS_HERO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/ultrasound-hero-probe-3bWMAQMJw9YFHoPXwbt8bZ.webp";
const IHE_HERO  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function enrichItem(db: any, item: any) {
  const type = item.itemType as string;
  if (type === "all_courses") return { ...item, itemTitle: item.label ?? "All Courses", itemSlug: null, itemCoverImage: null };
  if (type === "all_downloads") return { ...item, itemTitle: item.label ?? "All Downloads", itemSlug: null, itemCoverImage: null };
  if (type === "ultrasoundassist_free" || type === "ultrasoundassist_premium")
    return { ...item, itemTitle: item.label ?? "UltrasoundAssist™", itemSlug: null, itemCoverImage: AAUS_HERO };
  if (type === "echoassist_free" || type === "echoassist_premium")
    return { ...item, itemTitle: item.label ?? "EchoAssist™", itemSlug: null, itemCoverImage: IHE_HERO };

  let itemTitle: string | null = null, itemSlug: string | null = null, itemCoverImage: string | null = null;
  try {
    if (type === "course" || type === "quiz" || type === "cohort" || type === "workshop") {
      const [c] = await db.select({ title: lmsCourses.title, slug: lmsCourses.slug, coverImageUrl: lmsCourses.coverImageUrl })
        .from(lmsCourses).where(eq(lmsCourses.id, item.itemId)).limit(1);
      itemTitle = c?.title ?? null; itemSlug = c?.slug ?? null; itemCoverImage = c?.coverImageUrl ?? null;
    } else if (type === "download") {
      const [d] = await db.select({ title: digitalProducts.title, slug: digitalProducts.slug, thumbnailUrl: digitalProducts.thumbnailUrl })
        .from(digitalProducts).where(eq(digitalProducts.id, item.itemId)).limit(1);
      itemTitle = d?.title ?? null; itemSlug = d?.slug ?? null; itemCoverImage = d?.thumbnailUrl ?? null;
    } else if (type === "webinar") {
      const [w] = await db.select({ title: webinars.title, slug: webinars.slug, coverImage: webinars.coverImage })
        .from(webinars).where(eq(webinars.id, item.itemId)).limit(1);
      itemTitle = w?.title ?? null; itemSlug = w?.slug ?? null; itemCoverImage = w?.coverImage ?? null;
    } else if (type === "community") {
      const [cm] = await db.select({ name: communities.name, slug: communities.slug, coverImage: communities.coverImage })
        .from(communities).where(eq(communities.id, item.itemId)).limit(1);
      itemTitle = cm?.name ?? null; itemSlug = cm?.slug ?? null; itemCoverImage = cm?.coverImage ?? null;
    }
  } catch {}
  return { ...item, itemTitle: item.label ?? itemTitle, itemSlug, itemCoverImage };
}

async function getMembershipItems(planId: number) {
  const db = await getDb();
  if (!db) return null;
  const [plan] = await db.select({ id: membershipPlans.id, title: membershipPlans.title, slug: membershipPlans.slug })
    .from(membershipPlans).where(eq(membershipPlans.id, planId)).limit(1);
  if (!plan) return null;
  const rawItems = await db.select().from(membershipPlanAccess)
    .where(eq(membershipPlanAccess.planId, plan.id)).orderBy(asc(membershipPlanAccess.sortOrder));
  const items = await Promise.all(rawItems.map((item: any) => enrichItem(db, item)));
  return { source: "membership" as const, title: plan.title, slug: plan.slug, items };
}

async function getBundleItems(bundleId: number) {
  const db = await getDb();
  if (!db) return null;
  const [bundle] = await db.select({ id: bundles.id, title: bundles.title, slug: bundles.slug })
    .from(bundles).where(eq(bundles.id, bundleId)).limit(1);
  if (!bundle) return null;
  const rawItems = await db.select().from(bundleItems)
    .where(eq(bundleItems.bundleId, bundle.id)).orderBy(asc(bundleItems.sortOrder));
  const items = await Promise.all(rawItems.map((item: any) => enrichItem(db, item)));
  return { source: "bundle" as const, title: bundle.title, slug: bundle.slug, items };
}

// ─── Iframe HTML builder ──────────────────────────────────────────────────────

function buildIncludedItemsHtml(data: NonNullable<Awaited<ReturnType<typeof getMembershipItems>>>, opts: {
  columns: number;
  layout: "grid" | "list";
  accent: string;
  theme: "light" | "dark";
  headline: string;
  subtext: string;
  ctaUrl: string;
  ctaLabel: string;
  bgColor: string;
}) {
  const { columns, layout, accent, theme, headline, subtext, ctaUrl, ctaLabel, bgColor } = opts;
  const isDark = theme === "dark";
  const bg = bgColor || (isDark ? "#0f172a" : "#f9fafb");
  const cardBg = isDark ? "#1e293b" : "#ffffff";
  const text = isDark ? "#f1f5f9" : "#111827";
  const subCol = isDark ? "#94a3b8" : "#6b7280";
  const border = isDark ? "#334155" : "#e5e7eb";
  const accentSafe = escHtml(accent);

  const itemsHtml = data.items.map((item: any) => {
    const typeLabel = escHtml(ITEM_TYPE_LABELS[item.itemType] ?? item.itemType);
    const title = escHtml(item.itemTitle ?? item.label ?? `${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType} #${item.itemId}`);
    const img = item.itemCoverImage;
    const href = ctaUrl || "#";
    const btnLabel = escHtml(ctaLabel || "Explore");

    if (layout === "list") {
      return `<div class="list-row">
        <div class="list-thumb">
          ${img ? `<img src="${escHtml(img)}" alt="${title}" loading="lazy" />` : `<div class="list-thumb-placeholder"></div>`}
        </div>
        <div class="list-info">
          <span class="type-label" style="color:${accentSafe}">${typeLabel}</span>
          <span class="item-title">${title}</span>
        </div>
        ${href !== "#" ? `<a href="${escHtml(href)}" target="_blank" rel="noopener" class="explore-btn" style="background:${accentSafe}">${btnLabel}</a>` : `<span class="included-badge" style="color:${accentSafe}">✓ Included</span>`}
      </div>`;
    }

    // grid card
    return `<div class="grid-card" style="background:${cardBg};border-color:${border}">
      <div class="card-img">
        ${img ? `<img src="${escHtml(img)}" alt="${title}" loading="lazy" />` : `<div class="card-img-placeholder" style="background:${accentSafe}18"></div>`}
      </div>
      <div class="card-body">
        <span class="type-label" style="color:${accentSafe}">${typeLabel}</span>
        <p class="item-title" style="color:${text}">${title}</p>
        <div class="card-footer">
          <span class="included-badge" style="color:${accentSafe}">✓ Included</span>
          ${href !== "#" ? `<a href="${escHtml(href)}" target="_blank" rel="noopener" class="explore-btn" style="background:${accentSafe}">${btnLabel}</a>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  const cols = Math.min(Math.max(1, columns), 4);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(headline || data.title)} — Included Items</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;background:${bg};color:${text};line-height:1.5;overflow-x:hidden}
body{padding:16px}
.headline{font-size:20px;font-weight:700;text-align:center;margin-bottom:6px;color:${text}}
.subtext{font-size:13px;text-align:center;color:${subCol};margin-bottom:18px}
/* Grid layout */
.grid-wrap{display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px}
@media(max-width:640px){.grid-wrap{grid-template-columns:repeat(${Math.min(cols,2)},1fr)}}
@media(max-width:400px){.grid-wrap{grid-template-columns:1fr}}
.grid-card{border:1px solid ${border};border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.card-img{height:120px;overflow:hidden;position:relative;background:${isDark ? "#1e293b" : "#f1f5f9"}}
.card-img img{width:100%;height:100%;object-fit:cover}
.card-img-placeholder{width:100%;height:100%}
.card-body{padding:12px;display:flex;flex-direction:column;flex:1;gap:4px}
.card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:10px;border-top:1px solid ${border}}
/* List layout */
.list-wrap{display:flex;flex-direction:column;gap:8px}
.list-row{display:flex;align-items:center;gap:12px;padding:10px 12px;background:${cardBg};border:1px solid ${border};border-radius:10px}
.list-thumb{width:44px;height:44px;border-radius:8px;overflow:hidden;flex-shrink:0;background:${isDark ? "#1e293b" : "#f1f5f9"}}
.list-thumb img{width:100%;height:100%;object-fit:cover}
.list-thumb-placeholder{width:100%;height:100%}
.list-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
/* Shared */
.type-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.item-title{font-size:13px;font-weight:600;color:${text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.list-row .item-title{white-space:normal}
.included-badge{font-size:11px;font-weight:600}
.explore-btn{font-size:11px;font-weight:700;color:#fff;padding:5px 12px;border-radius:6px;text-decoration:none;white-space:nowrap;flex-shrink:0}
.explore-btn:hover{opacity:.88}
</style>
</head>
<body>
${headline ? `<div class="headline">${escHtml(headline)}</div>` : ""}
${subtext ? `<div class="subtext">${escHtml(subtext)}</div>` : ""}
<div class="${layout === "list" ? "list-wrap" : "grid-wrap"}">
${itemsHtml}
</div>
<script>
(function() {
  function sendHeight() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'included-items-resize', height: document.body.scrollHeight }, '*');
    }
  }
  window.addEventListener('load', sendHeight);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(sendHeight).observe(document.body);
  }
})();
</script>
</body>
</html>`;
}

// ─── JS Loader ────────────────────────────────────────────────────────────────

const INCLUDED_ITEMS_JS_LOADER = `(function() {
  var containers = document.querySelectorAll('[data-included-items-embed]');
  containers.forEach(function(el) {
    var raw = el.getAttribute('data-included-items-embed') || '';
    var parts = raw.split(':');
    if (parts.length < 2) return;
    var source = parts[0]; // 'membership' or 'bundle'
    var id = parts[1];
    var base = el.getAttribute('data-base-url') || 'https://app.allaboutultrasound.com';
    var accent = el.getAttribute('data-accent') || '#14b8a6';
    var theme = el.getAttribute('data-theme') || 'light';
    var layout = el.getAttribute('data-layout') || 'grid';
    var columns = el.getAttribute('data-columns') || '3';
    var headline = el.getAttribute('data-headline') || '';
    var subtext = el.getAttribute('data-subtext') || '';
    var ctaUrl = el.getAttribute('data-cta-url') || '';
    var ctaLabel = el.getAttribute('data-cta-label') || 'Explore';
    var bgColor = el.getAttribute('data-bg') || '';
    var src = base + '/embed/included-items'
      + '?source=' + encodeURIComponent(source)
      + '&id=' + encodeURIComponent(id)
      + '&accent=' + encodeURIComponent(accent)
      + '&theme=' + encodeURIComponent(theme)
      + '&layout=' + encodeURIComponent(layout)
      + '&columns=' + encodeURIComponent(columns)
      + '&headline=' + encodeURIComponent(headline)
      + '&subtext=' + encodeURIComponent(subtext)
      + '&ctaUrl=' + encodeURIComponent(ctaUrl)
      + '&ctaLabel=' + encodeURIComponent(ctaLabel)
      + '&bg=' + encodeURIComponent(bgColor);
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = 'width:100%;border:none;display:block;min-height:200px;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowtransparency', 'true');
    el.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'included-items-resize' && e.source === iframe.contentWindow) {
        iframe.style.height = (e.data.height + 8) + 'px';
      }
    });
  });
})();`;

// ─── Route registration ───────────────────────────────────────────────────────

export function registerIncludedItemsEmbedRoutes(app: Express) {
  // CORS preflight
  app.options("/api/included-items-embed/data", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/included-items", (_req, res) => { setCors(res); res.sendStatus(204); });

  // JSON data endpoint
  app.get("/api/included-items-embed/data", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const source = String(req.query.source ?? "").trim();
      const id = Number(req.query.id);
      if (!source || !id || isNaN(id)) { res.status(400).json({ error: "Missing source or id" }); return; }
      const data = source === "bundle" ? await getBundleItems(id) : await getMembershipItems(id);
      if (!data) { res.status(404).json({ error: "Not found" }); return; }
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Server error" });
    }
  });

  // Iframe page
  app.get("/embed/included-items", async (req: Request, res: Response) => {
    setCors(res);
    setFrameable(res);
    try {
      const source = String(req.query.source ?? "membership").trim();
      const id = Number(req.query.id);
      if (!id || isNaN(id)) {
        res.status(400).send("<html><body style='font-family:sans-serif;padding:20px;color:#64748b'>Missing id parameter.</body></html>");
        return;
      }
      const data = source === "bundle" ? await getBundleItems(id) : await getMembershipItems(id);
      if (!data) {
        res.status(404).send("<html><body style='font-family:sans-serif;padding:20px;color:#64748b'>Not found.</body></html>");
        return;
      }
      const html = buildIncludedItemsHtml(data, {
        columns: Math.min(Math.max(1, Number(req.query.columns ?? 3)), 4),
        layout: req.query.layout === "list" ? "list" : "grid",
        accent: String(req.query.accent ?? "#14b8a6"),
        theme: req.query.theme === "dark" ? "dark" : "light",
        headline: String(req.query.headline ?? ""),
        subtext: String(req.query.subtext ?? ""),
        ctaUrl: String(req.query.ctaUrl ?? ""),
        ctaLabel: String(req.query.ctaLabel ?? "Explore"),
        bgColor: String(req.query.bg ?? ""),
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e: any) {
      res.status(500).send(`<html><body>Error: ${escHtml(e.message)}</body></html>`);
    }
  });

  // JS loader
  app.get("/embed/included-items.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(INCLUDED_ITEMS_JS_LOADER);
  });
}
