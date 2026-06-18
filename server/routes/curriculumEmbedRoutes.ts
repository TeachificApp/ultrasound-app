/**
 * curriculumEmbedRoutes.ts
 *
 * Public CORS-open endpoints for embeddable course widgets.
 *
 * Routes:
 *   GET /api/curriculum-embed/data?courseSlug=<slug>   — JSON curriculum data
 *   GET /embed/curriculum/<slug>                        — curriculum accordion iframe page
 *   GET /embed/curriculum-cta/<slug>                    — CTA card iframe page (image + title + price + button)
 *   GET /embed/curriculum.js                            — JS loader (curriculum accordion)
 *   GET /embed/curriculum-cta.js                        — JS loader (CTA card)
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import {
  lmsCourses,
  lmsSections,
  lmsLessons,
  curriculumEmbedVisibility,
  workshops,
  digitalProducts,
  physicalProducts,
} from "../../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";

function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function setFrameable(res: Response) {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
}

/** Fetch curriculum data for a course by slug */
async function getCurriculumData(slug: string) {
  const db = await getDb();
  if (!db) return null;

  const [course] = await db
    .select({
      id: lmsCourses.id,
      title: lmsCourses.title,
      slug: lmsCourses.slug,
      subtitle: lmsCourses.subtitle,
      coverImageUrl: lmsCourses.coverImageUrl,
      status: lmsCourses.status,
      brand: lmsCourses.brand,
      price: lmsCourses.price,
      isFree: lmsCourses.isFree,
      pricingType: lmsCourses.pricingType,
    })
    .from(lmsCourses)
    .where(eq(lmsCourses.slug, slug))
    .limit(1);

  if (!course || !["public", "hidden"].includes(course.status)) return null;

  const sections = await db
    .select()
    .from(lmsSections)
    .where(eq(lmsSections.courseId, course.id))
    .orderBy(asc(lmsSections.position));

  const sectionsWithLessons = await Promise.all(
    sections.map(async (s) => {
      const lessons = await db
        .select({
          id: lmsLessons.id,
          title: lmsLessons.title,
          type: lmsLessons.type,
          position: lmsLessons.position,
          isPreview: lmsLessons.isPreview,
          previewMode: lmsLessons.previewMode,
          durationMinutes: lmsLessons.durationMinutes,
          lessonStatus: lmsLessons.lessonStatus,
        })
        .from(lmsLessons)
        .where(eq(lmsLessons.sectionId, s.id))
        .orderBy(asc(lmsLessons.position));

      const published = lessons.filter((l) => l.lessonStatus !== "draft");
      return { ...s, lessons: published };
    })
  );

  // Apply embed visibility filter — exclude hidden sections and lessons
  const visibilityRows = await db
    .select()
    .from(curriculumEmbedVisibility)
    .where(and(
      eq(curriculumEmbedVisibility.courseId, course.id),
      eq(curriculumEmbedVisibility.hidden, true)
    ));
  const hiddenSectionIds = new Set(
    visibilityRows.filter(r => r.itemType === "section").map(r => r.itemId)
  );
  const hiddenLessonIds = new Set(
    visibilityRows.filter(r => r.itemType === "lesson").map(r => r.itemId)
  );

  const visibleSections = sectionsWithLessons
    .filter(s => !hiddenSectionIds.has(s.id))
    .map(s => ({
      ...s,
      lessons: s.lessons.filter(l => !hiddenLessonIds.has(l.id)),
    }));

  const filteredSections = visibleSections.filter((s) => s.lessons.length > 0);

  const totalLessons = filteredSections.reduce((n, s) => n + s.lessons.length, 0);
  const totalMinutes = filteredSections.reduce(
    (n, s) => n + s.lessons.reduce((m, l) => m + (l.durationMinutes ?? 0), 0),
    0
  );

  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle ?? null,
    slug: course.slug,
    coverImageUrl: course.coverImageUrl ?? null,
    brand: course.brand,
    price: course.price,
    isFree: course.isFree,
    pricingType: course.pricingType,
    totalLessons,
    totalMinutes,
    sections: filteredSections,
  };
}

type CtaCardData = {
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  price: number;
  isFree: boolean;
  pricingType: "free" | "one_time" | "subscription" | "payment_plan" | "trial_then_subscription";
  totalLessons: number;
  totalMinutes: number;
  sections: { lessons: unknown[] }[];
};

/** CTA card data for workshops, downloads, and physical products */
async function getContentCtaData(
  entityType: "workshop" | "download" | "physical",
  slug: string,
): Promise<CtaCardData | null> {
  const db = await getDb();
  if (!db) return null;

  if (entityType === "workshop") {
    const [w] = await db
      .select({
        title: workshops.title,
        subtitle: workshops.subtitle,
        coverImageUrl: workshops.coverImageUrl,
        thumbnailUrl: workshops.thumbnailUrl,
        price: workshops.price,
        isFree: workshops.isFree,
        pricingType: workshops.pricingType,
        status: workshops.status,
      })
      .from(workshops)
      .where(eq(workshops.slug, slug))
      .limit(1);
    if (!w || !["public", "hidden"].includes(w.status)) return null;
    return {
      title: w.title,
      subtitle: w.subtitle ?? null,
      coverImageUrl: w.coverImageUrl ?? w.thumbnailUrl ?? null,
      price: (w.price ?? 0) / 100,
      isFree: w.isFree,
      pricingType: w.pricingType === "free" ? "free" : "one_time",
      totalLessons: 0,
      totalMinutes: 0,
      sections: [],
    };
  }

  if (entityType === "download") {
    const [p] = await db
      .select({
        title: digitalProducts.title,
        subtitle: digitalProducts.subtitle,
        thumbnailUrl: digitalProducts.thumbnailUrl,
        price: digitalProducts.price,
        isFree: digitalProducts.isFree,
        status: digitalProducts.status,
      })
      .from(digitalProducts)
      .where(eq(digitalProducts.slug, slug))
      .limit(1);
    if (!p || !["published", "hidden"].includes(p.status)) return null;
    return {
      title: p.title,
      subtitle: p.subtitle ?? null,
      coverImageUrl: p.thumbnailUrl ?? null,
      price: (p.price ?? 0) / 100,
      isFree: p.isFree,
      pricingType: "one_time",
      totalLessons: 0,
      totalMinutes: 0,
      sections: [],
    };
  }

  const [p] = await db
    .select({
      title: physicalProducts.title,
      subtitle: physicalProducts.subtitle,
      thumbnailUrl: physicalProducts.thumbnailUrl,
      price: physicalProducts.price,
      isFree: physicalProducts.isFree,
      status: physicalProducts.status,
    })
    .from(physicalProducts)
    .where(eq(physicalProducts.slug, slug))
    .limit(1);
  if (!p || !["published", "hidden"].includes(p.status)) return null;
  return {
    title: p.title,
    subtitle: p.subtitle ?? null,
    coverImageUrl: p.thumbnailUrl ?? null,
    price: (p.price ?? 0) / 100,
    isFree: p.isFree,
    pricingType: "one_time",
    totalLessons: 0,
    totalMinutes: 0,
    sections: [],
  };
}

function escHtml(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escAttr(s: string | null | undefined): string {
  return (s ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ─── Curriculum Accordion iframe ─────────────────────────────────────────────

function buildIframeHtml(data: NonNullable<Awaited<ReturnType<typeof getCurriculumData>>>, opts: {
  accentColor: string;
  ctaUrl: string;
  ctaLabel: string;
  showCta: boolean;
  theme: "light" | "dark";
}) {
  const { accentColor, ctaUrl, ctaLabel, showCta, theme } = opts;

  const isDark = theme === "dark";
  const bg = isDark ? "#0f172a" : "#ffffff";
  const cardBg = isDark ? "#1e293b" : "#f8fafc";
  const headerBg = isDark ? "#1e293b" : "#f1f5f9";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#1e293b";
  const subtext = isDark ? "#94a3b8" : "#64748b";
  const lessonText = isDark ? "#cbd5e1" : "#374151";
  const previewColor = accentColor;

  const totalHours = data.totalMinutes >= 60
    ? `${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60}m`
    : data.totalMinutes > 0 ? `${data.totalMinutes}m` : null;

  const sectionsHtml = data.sections.map((section, si) => {
    const lessonCount = section.lessons.length;
    const sectionMinutes = section.lessons.reduce((m, l) => m + (l.durationMinutes ?? 0), 0);
    const sectionDur = sectionMinutes >= 60
      ? `${Math.floor(sectionMinutes / 60)}h ${sectionMinutes % 60}m`
      : sectionMinutes > 0 ? `${sectionMinutes}m` : null;

    const lessonsHtml = section.lessons.map((lesson) => {
      const pm = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
      const isFreePreview = pm === "preview";
      const dur = lesson.durationMinutes ? `${lesson.durationMinutes}m` : "";

      const icon = isFreePreview
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${previewColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${subtext}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

      const previewBadge = isFreePreview
        ? `<span class="preview-badge">Preview</span>`
        : "";

      return `<li class="lesson-item">
        <span class="lesson-icon">${icon}</span>
        <span class="lesson-title" style="color:${isFreePreview ? previewColor : lessonText};font-weight:${isFreePreview ? "500" : "400"}">${escHtml(lesson.title)}</span>
        ${previewBadge}
        ${dur ? `<span class="lesson-dur">${dur}</span>` : ""}
      </li>`;
    }).join("");

    return `<div class="section" data-idx="${si}">
      <button class="section-header" onclick="toggleSection(this)" aria-expanded="${si === 0 ? "true" : "false"}">
        <span class="section-chevron" style="transform:rotate(${si === 0 ? "90deg" : "0deg"})">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
        <span class="section-title">${escHtml(section.title)}</span>
        <span class="section-meta">${lessonCount} lesson${lessonCount !== 1 ? "s" : ""}${sectionDur ? ` · ${sectionDur}` : ""}</span>
      </button>
      <ul class="lesson-list" style="display:${si === 0 ? "block" : "none"}">
        ${lessonsHtml}
      </ul>
    </div>`;
  }).join("");

  const ctaHtml = showCta && ctaUrl
    ? `<div class="cta-wrap">
        <a href="${escAttr(ctaUrl)}" target="_blank" rel="noopener" class="cta-btn" style="background:${accentColor}">
          ${escHtml(ctaLabel || "Enroll Now")}
        </a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(data.title)} — Curriculum</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;background:${bg};color:${text};line-height:1.5}
body{padding:0;overflow-x:hidden}
.widget{max-width:100%;padding:16px}
.course-header{margin-bottom:14px}
.course-title{font-size:16px;font-weight:700;color:${text};margin-bottom:4px}
.course-subtitle{font-size:13px;color:${subtext};margin-bottom:8px}
.course-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:${subtext}}
.course-meta span{display:flex;align-items:center;gap:4px}
.sections{border:1px solid ${border};border-radius:8px;overflow:hidden;background:${cardBg}}
.section{border-bottom:1px solid ${border}}
.section:last-child{border-bottom:none}
.section-header{width:100%;display:flex;align-items:center;gap:8px;padding:12px 14px;background:${headerBg};border:none;cursor:pointer;text-align:left;color:${text};transition:background 0.15s}
.section-header:hover{background:${isDark ? "#263548" : "#e8edf3"}}
.section-chevron{display:flex;align-items:center;color:${subtext};transition:transform 0.2s;flex-shrink:0}
.section-title{flex:1;font-weight:600;font-size:13px;color:${text}}
.section-meta{font-size:11px;color:${subtext};white-space:nowrap;flex-shrink:0}
.lesson-list{list-style:none;padding:4px 0}
.lesson-item{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid ${isDark ? "#1e293b" : "#f1f5f9"}}
.lesson-item:last-child{border-bottom:none}
.lesson-icon{display:flex;align-items:center;flex-shrink:0}
.lesson-title{flex:1;font-size:13px}
.preview-badge{font-size:10px;font-weight:600;color:${previewColor};border:1px solid ${previewColor};border-radius:4px;padding:1px 5px;white-space:nowrap;flex-shrink:0}
.lesson-dur{font-size:11px;color:${subtext};white-space:nowrap;flex-shrink:0}
.cta-wrap{margin-top:14px;text-align:center}
.cta-btn{display:inline-block;padding:10px 28px;border-radius:6px;color:#fff;font-weight:600;font-size:14px;text-decoration:none;transition:opacity 0.15s}
.cta-btn:hover{opacity:0.88}
</style>
</head>
<body>
<div class="widget">
  <div class="course-header">
    <div class="course-title">${escHtml(data.title)}</div>
    ${data.subtitle ? `<div class="course-subtitle">${escHtml(data.subtitle)}</div>` : ""}
    <div class="course-meta">
      <span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        ${data.totalLessons} lesson${data.totalLessons !== 1 ? "s" : ""}
      </span>
      ${totalHours ? `<span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${totalHours}
      </span>` : ""}
      <span>${data.sections.length} section${data.sections.length !== 1 ? "s" : ""}</span>
    </div>
  </div>
  <div class="sections">
    ${sectionsHtml}
  </div>
  ${ctaHtml}
</div>
<script>
function toggleSection(btn) {
  var list = btn.nextElementSibling;
  var chevron = btn.querySelector('.section-chevron');
  var isOpen = btn.getAttribute('aria-expanded') === 'true';
  if (isOpen) {
    list.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
    btn.setAttribute('aria-expanded', 'false');
  } else {
    list.style.display = 'block';
    chevron.style.transform = 'rotate(90deg)';
    btn.setAttribute('aria-expanded', 'true');
  }
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'curriculum-resize', height: document.body.scrollHeight }, '*');
  }
}
window.addEventListener('load', function() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'curriculum-resize', height: document.body.scrollHeight }, '*');
  }
});
</script>
</body>
</html>`;
}

// ─── CTA Card iframe ──────────────────────────────────────────────────────────

function buildCtaCardHtml(data: CtaCardData, opts: {
  accentColor: string;
  ctaUrl: string;
  ctaLabel: string;
  showImage: boolean;
  showPrice: boolean;
  showMeta: boolean;
  customTitle: string;
  customSubtitle: string;
  theme: "light" | "dark";
  layout: "horizontal" | "vertical";
  imageUrl: string; // override image URL (empty = use course cover)
}) {
  const { accentColor, ctaUrl, ctaLabel, showImage, showPrice, showMeta, customTitle, customSubtitle, theme, layout, imageUrl } = opts;

  const isDark = theme === "dark";
  const bg = isDark ? "#0f172a" : "#ffffff";
  const cardBg = isDark ? "#1e293b" : "#f8fafc";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#1e293b";
  const subtext = isDark ? "#94a3b8" : "#64748b";

  const displayTitle = customTitle || data.title;
  const displaySubtitle = customSubtitle || data.subtitle || "";

  const resolvedImageUrl = imageUrl || data.coverImageUrl || "";

  const priceStr = data.isFree
    ? "Free"
    : data.pricingType === "subscription"
      ? `$${Number(data.price ?? 0).toFixed(2)}/mo`
      : `$${Number(data.price ?? 0).toFixed(2)}`;

  const totalHours = data.totalMinutes >= 60
    ? `${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60}m`
    : data.totalMinutes > 0 ? `${data.totalMinutes}m` : null;

  const metaHtml = showMeta ? `
    <div class="meta">
      <span class="meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        ${data.totalLessons} lesson${data.totalLessons !== 1 ? "s" : ""}
      </span>
      ${totalHours ? `<span class="meta-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${totalHours}
      </span>` : ""}
      <span class="meta-item">${data.sections.length} section${data.sections.length !== 1 ? "s" : ""}</span>
    </div>` : "";

  const priceHtml = showPrice ? `<div class="price">${escHtml(priceStr)}</div>` : "";

  const imageHtml = showImage && resolvedImageUrl
    ? `<div class="img-wrap"><img src="${escAttr(resolvedImageUrl)}" alt="${escAttr(displayTitle)}" class="course-img" /></div>`
    : "";

  const isHorizontal = layout === "horizontal";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(displayTitle)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;background:transparent;color:${text};line-height:1.5}
body{padding:12px;overflow-x:hidden;display:flex;justify-content:flex-start}
.card{background:${cardBg};border:1px solid ${border};border-radius:12px;overflow:hidden;display:${isHorizontal ? "flex" : "block"};align-items:stretch;gap:0;max-width:${isHorizontal ? "480" : "320"}px;width:100%}
.img-wrap{${isHorizontal ? "width:200px;flex-shrink:0;" : "width:100%;"}overflow:hidden}
.course-img{width:100%;height:${isHorizontal ? "100%" : "200px"};object-fit:cover;display:block}
.body{padding:18px;flex:1;display:flex;flex-direction:column;gap:10px}
.title{font-size:${isHorizontal ? "16px" : "18px"};font-weight:700;color:${text};line-height:1.3}
.subtitle{font-size:13px;color:${subtext};line-height:1.5}
.meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:${subtext}}
.meta-item{display:flex;align-items:center;gap:4px}
.price{font-size:${isHorizontal ? "18px" : "22px"};font-weight:800;color:${accentColor}}
.cta-btn{display:inline-block;padding:${isHorizontal ? "9px 20px" : "12px 28px"};border-radius:7px;background:${accentColor};color:#fff;font-weight:600;font-size:${isHorizontal ? "13px" : "15px"};text-decoration:none;text-align:center;transition:opacity 0.15s;width:${isHorizontal ? "auto" : "100%"}}
.cta-btn:hover{opacity:0.88}
.bottom-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:auto}
</style>
</head>
<body>
<div class="card">
  ${imageHtml}
  <div class="body">
    <div class="title">${escHtml(displayTitle)}</div>
    ${displaySubtitle ? `<div class="subtitle">${escHtml(displaySubtitle)}</div>` : ""}
    ${metaHtml}
    <div class="bottom-row">
      ${priceHtml}
      ${ctaUrl ? `<a href="${escAttr(ctaUrl)}" target="_blank" rel="noopener" class="cta-btn">${escHtml(ctaLabel || "Enroll Now")}</a>` : ""}
    </div>
  </div>
</div>
<script>
window.addEventListener('load', function() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'cta-card-resize', height: document.body.scrollHeight }, '*');
  }
});
</script>
</body>
</html>`;
}

// ─── JS loaders ──────────────────────────────────────────────────────────────

const CURRICULUM_JS_LOADER = `(function() {
  var containers = document.querySelectorAll('[data-curriculum-embed]');
  containers.forEach(function(el) {
    var slug = el.getAttribute('data-curriculum-embed');
    var accent = el.getAttribute('data-accent') || '#14b8a6';
    var theme = el.getAttribute('data-theme') || 'light';
    var ctaUrl = el.getAttribute('data-cta-url') || '';
    var ctaLabel = el.getAttribute('data-cta-label') || 'Enroll Now';
    var cta = el.getAttribute('data-cta') !== '0' ? '1' : '0';
    var base = el.getAttribute('data-base-url') || 'https://app.allaboutultrasound.com';
    var src = base + '/embed/curriculum/' + encodeURIComponent(slug)
      + '?accent=' + encodeURIComponent(accent)
      + '&theme=' + encodeURIComponent(theme)
      + '&ctaUrl=' + encodeURIComponent(ctaUrl)
      + '&ctaLabel=' + encodeURIComponent(ctaLabel)
      + '&cta=' + cta;
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = 'width:100%;border:none;display:block;min-height:300px;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowtransparency', 'true');
    el.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'curriculum-resize' && e.source === iframe.contentWindow) {
        iframe.style.height = (e.data.height + 8) + 'px';
      }
    });
  });
})();`;

const CTA_CARD_JS_LOADER = `(function() {
  var containers = document.querySelectorAll('[data-cta-card-embed]');
  containers.forEach(function(el) {
    var slug = el.getAttribute('data-cta-card-embed');
    var accent = el.getAttribute('data-accent') || '#14b8a6';
    var theme = el.getAttribute('data-theme') || 'light';
    var ctaUrl = el.getAttribute('data-cta-url') || '';
    var ctaLabel = el.getAttribute('data-cta-label') || 'Enroll Now';
    var layout = el.getAttribute('data-layout') || 'vertical';
    var showImage = el.getAttribute('data-show-image') !== '0' ? '1' : '0';
    var showPrice = el.getAttribute('data-show-price') !== '0' ? '1' : '0';
    var showMeta = el.getAttribute('data-show-meta') !== '0' ? '1' : '0';
    var imageUrl = el.getAttribute('data-image-url') || '';
    var customTitle = el.getAttribute('data-title') || '';
    var customSubtitle = el.getAttribute('data-subtitle') || '';
    var base = el.getAttribute('data-base-url') || 'https://app.allaboutultrasound.com';
    var src = base + '/embed/curriculum-cta/' + encodeURIComponent(slug)
      + '?accent=' + encodeURIComponent(accent)
      + '&theme=' + encodeURIComponent(theme)
      + '&ctaUrl=' + encodeURIComponent(ctaUrl)
      + '&ctaLabel=' + encodeURIComponent(ctaLabel)
      + '&layout=' + encodeURIComponent(layout)
      + '&showImage=' + showImage
      + '&showPrice=' + showPrice
      + '&showMeta=' + showMeta
      + '&imageUrl=' + encodeURIComponent(imageUrl)
      + '&title=' + encodeURIComponent(customTitle)
      + '&subtitle=' + encodeURIComponent(customSubtitle);
    var iframe = document.createElement('iframe');
    iframe.src = src;
    var maxW = layout === 'horizontal' ? '480px' : '320px';
    iframe.style.cssText = 'width:100%;max-width:' + maxW + ';border:none;display:block;min-height:120px;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowtransparency', 'true');
    el.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'cta-card-resize' && e.source === iframe.contentWindow) {
        iframe.style.height = (e.data.height + 8) + 'px';
      }
    });
  });
})();`;

const CONTENT_CTA_JS_LOADER = `(function() {
  var containers = document.querySelectorAll('[data-content-cta-embed]');
  containers.forEach(function(el) {
    var slug = el.getAttribute('data-content-cta-embed');
    var entityType = el.getAttribute('data-entity-type') || 'workshop';
    var accent = el.getAttribute('data-accent') || '#14b8a6';
    var theme = el.getAttribute('data-theme') || 'light';
    var ctaUrl = el.getAttribute('data-cta-url') || '';
    var ctaLabel = el.getAttribute('data-cta-label') || 'Enroll Now';
    var layout = el.getAttribute('data-layout') || 'vertical';
    var showImage = el.getAttribute('data-show-image') !== '0' ? '1' : '0';
    var showPrice = el.getAttribute('data-show-price') !== '0' ? '1' : '0';
    var showMeta = el.getAttribute('data-show-meta') !== '0' ? '1' : '0';
    var imageUrl = el.getAttribute('data-image-url') || '';
    var customTitle = el.getAttribute('data-title') || '';
    var customSubtitle = el.getAttribute('data-subtitle') || '';
    var base = el.getAttribute('data-base-url') || 'https://app.allaboutultrasound.com';
    var src = base + '/embed/content-cta/' + encodeURIComponent(entityType) + '/' + encodeURIComponent(slug)
      + '?accent=' + encodeURIComponent(accent)
      + '&theme=' + encodeURIComponent(theme)
      + '&ctaUrl=' + encodeURIComponent(ctaUrl)
      + '&ctaLabel=' + encodeURIComponent(ctaLabel)
      + '&layout=' + encodeURIComponent(layout)
      + '&showImage=' + showImage
      + '&showPrice=' + showPrice
      + '&showMeta=' + showMeta
      + '&imageUrl=' + encodeURIComponent(imageUrl)
      + '&title=' + encodeURIComponent(customTitle)
      + '&subtitle=' + encodeURIComponent(customSubtitle);
    var iframe = document.createElement('iframe');
    iframe.src = src;
    var maxW = layout === 'horizontal' ? '480px' : '320px';
    iframe.style.cssText = 'width:100%;max-width:' + maxW + ';border:none;display:block;min-height:120px;';
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowtransparency', 'true');
    el.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'cta-card-resize' && e.source === iframe.contentWindow) {
        iframe.style.height = (e.data.height + 8) + 'px';
      }
    });
  });
})();`;

const INSTANCE_JS_LOADER = `(function() {
  var containers = document.querySelectorAll('[data-instance-embed]');
  containers.forEach(function(el) {
    var raw = el.getAttribute('data-instance-embed') || '';
    var parts = raw.split(':');
    if (parts.length < 2) return;
    var kind = parts[0];
    var id = parts[1];
    var base = el.getAttribute('data-base-url') || 'https://app.allaboutultrasound.com';
    var src = base + '/embed/instance/' + kind + '/' + encodeURIComponent(id);
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = 'width:100%;border:none;display:block;min-height:400px;';
    iframe.setAttribute('scrolling', 'yes');
    iframe.setAttribute('frameborder', '0');
    el.appendChild(iframe);
  });
})();`;

// ─── Route registration ───────────────────────────────────────────────────────

export function registerCurriculumEmbedRoutes(app: Express) {
  // CORS preflight
  app.options("/api/curriculum-embed/data", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/curriculum/:slug", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/curriculum-cta/:slug", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/content-cta/:entityType/:slug", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/instance/:kind/:id", (_req, res) => { setCors(res); res.sendStatus(204); });

  // Allow SPA instance embed pages to be framed
  app.use("/embed/instance", (_req, res, next) => {
    setFrameable(res);
    next();
  });

  // JSON data endpoint
  app.get("/api/curriculum-embed/data", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const slug = String(req.query.courseSlug ?? "").trim();
      if (!slug) { res.status(400).json({ error: "Missing courseSlug" }); return; }
      const data = await getCurriculumData(slug);
      if (!data) { res.status(404).json({ error: "Course not found or not public" }); return; }
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? "Server error" });
    }
  });

  // Curriculum accordion iframe page
  app.get("/embed/curriculum/:slug", async (req: Request, res: Response) => {
    setCors(res);
    setFrameable(res);
    try {
      const slug = req.params.slug;
      const accentColor = String(req.query.accent ?? "#14b8a6");
      const ctaUrl = String(req.query.ctaUrl ?? "");
      const ctaLabel = String(req.query.ctaLabel ?? "Enroll Now");
      const showCta = req.query.cta !== "0" && req.query.cta !== "false";
      const theme = req.query.theme === "dark" ? "dark" : "light";

      const data = await getCurriculumData(slug);
      if (!data) {
        res.status(404).send("<html><body style='font-family:sans-serif;padding:20px;color:#64748b'>Course not found.</body></html>");
        return;
      }

      const html = buildIframeHtml(data, { accentColor, ctaUrl, ctaLabel, showCta, theme });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e: any) {
      res.status(500).send(`<html><body>Error: ${escHtml(e.message)}</body></html>`);
    }
  });

  // CTA card iframe page
  app.get("/embed/curriculum-cta/:slug", async (req: Request, res: Response) => {
    setCors(res);
    setFrameable(res);
    try {
      const slug = req.params.slug;
      const accentColor = String(req.query.accent ?? "#14b8a6");
      const ctaUrl = String(req.query.ctaUrl ?? "");
      const ctaLabel = String(req.query.ctaLabel ?? "Enroll Now");
      const theme = req.query.theme === "dark" ? "dark" : "light";
      const layout = req.query.layout === "horizontal" ? "horizontal" : "vertical";
      const showImage = req.query.showImage !== "0";
      const showPrice = req.query.showPrice !== "0";
      const showMeta = req.query.showMeta !== "0";
      const imageUrl = String(req.query.imageUrl ?? "");
      const customTitle = String(req.query.title ?? "");
      const customSubtitle = String(req.query.subtitle ?? "");

      const data = await getCurriculumData(slug);
      if (!data) {
        res.status(404).send("<html><body style='font-family:sans-serif;padding:20px;color:#64748b'>Course not found.</body></html>");
        return;
      }

      const html = buildCtaCardHtml(data, { accentColor, ctaUrl, ctaLabel, showImage, showPrice, showMeta, customTitle, customSubtitle, theme, layout, imageUrl });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e: any) {
      res.status(500).send(`<html><body>Error: ${escHtml(e.message)}</body></html>`);
    }
  });

  // JS loaders
  app.get("/embed/curriculum.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(CURRICULUM_JS_LOADER);
  });

  app.get("/embed/curriculum-cta.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(CTA_CARD_JS_LOADER);
  });

  // Content CTA card (workshop, download, physical)
  app.get("/embed/content-cta/:entityType/:slug", async (req: Request, res: Response) => {
    setCors(res);
    setFrameable(res);
    try {
      const entityType = req.params.entityType;
      if (!["workshop", "download", "physical"].includes(entityType)) {
        res.status(400).send("<html><body>Invalid entity type.</body></html>");
        return;
      }
      const slug = req.params.slug;
      const accentColor = String(req.query.accent ?? "#14b8a6");
      const ctaUrl = String(req.query.ctaUrl ?? "");
      const ctaLabel = String(req.query.ctaLabel ?? "Enroll Now");
      const theme = req.query.theme === "dark" ? "dark" : "light";
      const layout = req.query.layout === "horizontal" ? "horizontal" : "vertical";
      const showImage = req.query.showImage !== "0";
      const showPrice = req.query.showPrice !== "0";
      const showMeta = req.query.showMeta !== "0";
      const imageUrl = String(req.query.imageUrl ?? "");
      const customTitle = String(req.query.title ?? "");
      const customSubtitle = String(req.query.subtitle ?? "");

      const data = await getContentCtaData(entityType as "workshop" | "download" | "physical", slug);
      if (!data) {
        res.status(404).send("<html><body style='font-family:sans-serif;padding:20px;color:#64748b'>Content not found.</body></html>");
        return;
      }

      const html = buildCtaCardHtml(data, {
        accentColor, ctaUrl, ctaLabel, showImage, showPrice, showMeta,
        customTitle, customSubtitle, theme, layout, imageUrl,
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e: any) {
      res.status(500).send(`<html><body>Error: ${escHtml(e.message)}</body></html>`);
    }
  });

  app.get("/embed/content-cta.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(CONTENT_CTA_JS_LOADER);
  });

  app.get("/embed/instance.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(INSTANCE_JS_LOADER);
  });
}
