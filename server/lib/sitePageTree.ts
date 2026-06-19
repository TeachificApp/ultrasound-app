/**
 * Site page seeding and page tree aggregation for Site Pages admin.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getDb } from "../db";
import {
  communities,
  digitalProducts,
  funnelPages,
  funnels,
  lmsCourses,
  sitePages,
  webinars,
} from "../../drizzle/schema";
import {
  DEFAULT_SYSTEM_PAGES,
  RESERVED_SITE_SLUGS,
  type SitePageTreeNode,
} from "../../shared/sitePagesConstants";

export async function ensureDefaultSitePages(domain: string, userId?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (const def of DEFAULT_SYSTEM_PAGES) {
    const [existing] = await db
      .select({ id: sitePages.id })
      .from(sitePages)
      .where(and(eq(sitePages.domain, domain), eq(sitePages.slug, def.slug)))
      .limit(1);
    if (existing) continue;

    await db.insert(sitePages).values({
      domain,
      slug: def.slug,
      title: def.title,
      pageKind: def.pageKind,
      status: "published",
      blocks: JSON.stringify(def.defaultBlocks),
      isHiddenFromNav: def.pageKind.startsWith("legal_") || def.pageKind === "error_404",
      showInHeaderNav: false,
      showInSidebarNav: false,
      showInProfileNav: def.pageKind.startsWith("legal_"),
      navSortOrder: 0,
      createdByUserId: userId ?? null,
    });
  }
}

function folderNode(
  id: string,
  label: string,
  children: SitePageTreeNode[],
): SitePageTreeNode {
  return {
    id,
    label,
    slug: null,
    kind: "folder",
    parentId: null,
    children,
    editable: false,
    editorRoute: null,
    previewUrl: null,
    hiddenFromNav: true,
    showInHeaderNav: false,
    showInSidebarNav: false,
    showInProfileNav: false,
  };
}

function siteRowToNode(row: typeof sitePages.$inferSelect, parentId: string | null): SitePageTreeNode {
  return {
    id: `site:${row.id}`,
    label: row.title,
    slug: row.slug,
    kind: "site",
    sitePageId: row.id,
    parentId,
    children: [],
    editable: true,
    editorRoute: `/admin/lms/site-pages?domain=${encodeURIComponent(row.domain)}&edit=${row.id}`,
    previewUrl: row.slug ? `/${row.slug}` : null,
    hiddenFromNav: row.isHiddenFromNav,
    showInHeaderNav: row.showInHeaderNav,
    showInSidebarNav: row.showInSidebarNav,
    showInProfileNav: row.showInProfileNav,
    status: row.status,
  };
}

export async function buildSitePageTree(domain: string, userId?: number): Promise<SitePageTreeNode[]> {
  await ensureDefaultSitePages(domain, userId);
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(sitePages)
    .where(eq(sitePages.domain, domain))
    .orderBy(asc(sitePages.navSortOrder), asc(sitePages.title));

  const siteNodes = rows.map((r) => siteRowToNode(r, null));
  const systemSlugs = new Set(DEFAULT_SYSTEM_PAGES.map((p) => p.slug));
  const systemNodes = siteNodes.filter((n) => n.slug && systemSlugs.has(n.slug));
  const customNodes = siteNodes.filter((n) => !n.slug || !systemSlugs.has(n.slug));

  const [courses, downloads, funnelList, webinarList, communityList] = await Promise.all([
    db
      .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, type: lmsCourses.type })
      .from(lmsCourses)
      .where(eq(lmsCourses.status, "public"))
      .orderBy(asc(lmsCourses.title)),
    db
      .select({ id: digitalProducts.id, title: digitalProducts.title, slug: digitalProducts.slug })
      .from(digitalProducts)
      .where(eq(digitalProducts.status, "published"))
      .orderBy(asc(digitalProducts.title)),
    db.select({ id: funnels.id, name: funnels.name, slug: funnels.slug }).from(funnels).orderBy(asc(funnels.name)),
    db
      .select({ id: webinars.id, title: webinars.title, slug: webinars.slug })
      .from(webinars)
      .where(eq(webinars.status, "published"))
      .orderBy(asc(webinars.title)),
    db
      .select({ id: communities.id, title: communities.title, slug: communities.slug })
      .from(communities)
      .where(eq(communities.status, "published"))
      .orderBy(asc(communities.title)),
  ]);

  const courseChildren: SitePageTreeNode[] = courses.map((c) => {
    const type = c.type === "quiz" ? "quiz" : c.type === "cohort" ? "cohort" : "course";
    return {
      id: `${type}:${c.id}:landing`,
      label: c.title,
      slug: c.slug,
      kind: type as SitePageTreeNode["kind"],
      entityId: c.id,
      subKind: "landing",
      parentId: "folder:courses",
      children: [],
      editable: true,
      editorRoute: `/admin/lms/${c.id}/landing-builder`,
      previewUrl: `/courses/${c.slug}`,
      hiddenFromNav: true,
      showInHeaderNav: false,
      showInSidebarNav: false,
      showInProfileNav: false,
    };
  });

  const downloadChildren: SitePageTreeNode[] = downloads.map((d) => ({
    id: `download:${d.id}:landing`,
    label: d.title,
    slug: d.slug,
    kind: "download",
    entityId: d.id,
    subKind: "landing",
    parentId: "folder:downloads",
    children: [],
    editable: true,
    editorRoute: `/admin/downloads/${d.id}/landing-builder`,
    previewUrl: `/downloads/${d.slug}`,
    hiddenFromNav: true,
    showInHeaderNav: false,
    showInSidebarNav: false,
    showInProfileNav: false,
  }));

  const funnelChildren: SitePageTreeNode[] = [];
  if (funnelList.length > 0) {
    const funnelIds = funnelList.map((f) => f.id);
    const pages = funnelIds.length
      ? await db
          .select({
            id: funnelPages.id,
            funnelId: funnelPages.funnelId,
            title: funnelPages.title,
            slug: funnelPages.slug,
          })
          .from(funnelPages)
          .where(inArray(funnelPages.funnelId, funnelIds))
          .orderBy(asc(funnelPages.sortOrder))
      : [];

    for (const f of funnelList) {
      const fPages = pages.filter((p) => p.funnelId === f.id);
      funnelChildren.push({
        id: `funnel:${f.id}`,
        label: f.name,
        slug: f.slug,
        kind: "funnel",
        entityId: f.id,
        parentId: "folder:funnels",
        children: fPages.map((p) => ({
          id: `funnel:${f.id}:page:${p.id}`,
          label: p.title,
          slug: p.slug,
          kind: "funnel",
          entityId: p.id,
          subKind: "page",
          parentId: `funnel:${f.id}`,
          children: [],
          editable: true,
          editorRoute: `/admin/funnels/${f.id}/pages/${p.id}`,
          previewUrl: `/p/${p.slug}`,
          hiddenFromNav: true,
          showInHeaderNav: false,
          showInSidebarNav: false,
          showInProfileNav: false,
        })),
        editable: true,
        editorRoute: `/admin/funnels/${f.id}`,
        previewUrl: `/${f.slug}`,
        hiddenFromNav: true,
        showInHeaderNav: false,
        showInSidebarNav: false,
        showInProfileNav: false,
      });
    }
  }

  const webinarChildren: SitePageTreeNode[] = webinars.map((w) => ({
    id: `webinar:${w.id}:landing`,
    label: w.title,
    slug: w.slug,
    kind: "webinar",
    entityId: w.id,
    subKind: "landing",
    parentId: "folder:webinars",
    children: [],
    editable: true,
    editorRoute: `/admin/lms?tab=webinars`,
    previewUrl: `/webinars/${w.slug}`,
    hiddenFromNav: true,
    showInHeaderNav: false,
    showInSidebarNav: false,
    showInProfileNav: false,
  }));

  const communityChildren: SitePageTreeNode[] = communityList.map((c) => ({
    id: `community:${c.id}:landing`,
    label: c.title,
    slug: c.slug,
    kind: "community",
    entityId: c.id,
    subKind: "landing",
    parentId: "folder:communities",
    children: [],
    editable: true,
    editorRoute: `/admin/lms?tab=communities&editCommunity=${c.id}&tab=page-editor`,
    previewUrl: `/community/${c.slug}`,
    hiddenFromNav: true,
    showInHeaderNav: false,
    showInSidebarNav: false,
    showInProfileNav: false,
  }));

  return [
    folderNode("folder:system", "System Pages", systemNodes),
    folderNode("folder:custom", "Site Pages", customNodes),
    folderNode("folder:courses", "Courses & Quizzes", courseChildren),
    folderNode("folder:downloads", "Downloads", downloadChildren),
    folderNode("folder:funnels", "Funnels", funnelChildren),
    folderNode("folder:webinars", "Webinars", webinarChildren),
    folderNode("folder:communities", "Communities", communityChildren),
  ];
}

export function validateSiteSlug(slug: string): string | null {
  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
  if (!normalized) return "Slug is required";
  if (RESERVED_SITE_SLUGS.has(normalized)) return `Slug "${normalized}" is reserved`;
  return null;
}

export function newNavItemId(): string {
  return `nav-${randomBytes(6).toString("hex")}`;
}
