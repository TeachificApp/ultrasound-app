/**
 * curriculumEmbedRoutes.ts
 *
 * Public CORS-open endpoints for the embeddable course curriculum widget.
 *
 * Routes:
 *   GET /api/curriculum-embed/data?courseSlug=<slug>   — JSON curriculum data
 *   GET /embed/curriculum/<slug>                        — self-contained iframe HTML page
 *   GET /embed/curriculum.js                            — JS loader snippet (optional script-tag approach)
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { lmsCourses, lmsSections, lmsLessons } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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

  // Drop sections with no published lessons
  const filteredSections = sectionsWithLessons.filter((s) => s.lessons.length > 0);

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

/** Build the self-contained iframe HTML */
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
  // Notify parent of height change for auto-resize
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'curriculum-resize', height: document.body.scrollHeight }, '*');
  }
}
// Auto-resize on load
window.addEventListener('load', function() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'curriculum-resize', height: document.body.scrollHeight }, '*');
  }
});
</script>
</body>
</html>`;
}

function escHtml(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escAttr(s: string | null | undefined): string {
  return (s ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function registerCurriculumEmbedRoutes(app: Express) {
  // CORS preflight
  app.options("/api/curriculum-embed/data", (_req, res) => { setCors(res); res.sendStatus(204); });
  app.options("/embed/curriculum/:slug", (_req, res) => { setCors(res); res.sendStatus(204); });

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

  // Self-contained iframe page
  app.get("/embed/curriculum/:slug", async (req: Request, res: Response) => {
    setCors(res);
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
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.send(html);
    } catch (e: any) {
      res.status(500).send(`<html><body>Error: ${escHtml(e.message)}</body></html>`);
    }
  });

  // JS loader snippet — auto-sizing iframe injector
  app.get("/embed/curriculum.js", (_req: Request, res: Response) => {
    setCors(res);
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(`
(function() {
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
})();
`);
  });
}
