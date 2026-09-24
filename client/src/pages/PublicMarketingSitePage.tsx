/**
 * PublicMarketingSitePage — renders the independently editable All About
 * Ultrasound and iHeartEcho public-site tenants on their own domains.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { Loader2, Menu, X, ArrowRight, CalendarDays } from "lucide-react";
import { getBrandDisplayConfig } from "@shared/brands";
import {
  getPublicSiteTenant,
  getPublicSiteTenantForHost,
  publicSiteOrigin,
  type PublicSiteTenantKey,
} from "@shared/publicSiteTenants";

function getTenantForBrowser(): ReturnType<typeof getPublicSiteTenant> {
  if (typeof window === "undefined") return getPublicSiteTenant("aaus-net");
  const query = new URLSearchParams(window.location.search).get("publicSite");
  if (query === "aaus-net" || query === "iheartecho-net") return getPublicSiteTenant(query);
  return getPublicSiteTenantForHost(window.location.hostname) ?? getPublicSiteTenant("aaus-net");
}

function MarketingNav({
  nav,
  siteName,
  accent,
}: {
  nav: Array<{ label: string; href: string }>;
  siteName: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-[#0e1e2e] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <a href="/" className="font-bold text-lg tracking-tight shrink-0">{siteName}</a>
        <button type="button" className="md:hidden p-2 rounded-md hover:bg-white/10" onClick={() => setOpen((value) => !value)} aria-label="Open site navigation">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`${open ? "flex" : "hidden"} md:flex flex-col md:flex-row md:items-center gap-1 md:gap-5 absolute md:relative top-full left-0 right-0 bg-[#0e1e2e] md:bg-transparent p-4 md:p-0 border-t md:border-0 border-white/10`}>
          {nav.slice(0, 12).map((item) => (
            <a
              key={`${item.href}-${item.label}`}
              href={item.href}
              className="text-sm py-2 md:py-0 transition-colors"
              style={{ color: open ? "#ffffff" : undefined }}
              onMouseEnter={(event) => { event.currentTarget.style.color = accent; }}
              onMouseLeave={(event) => { event.currentTarget.style.color = ""; }}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function BlogListing({ tenantKey, pathPrefix, accent }: { tenantKey: PublicSiteTenantKey; pathPrefix: string; accent: string }) {
  const { data, isLoading } = trpc.marketingSitePublic.listBlogPosts.useQuery({ tenantKey, limit: 100, offset: 0 });
  const archive = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("archive") : null;
  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" style={{ color: accent }} /></div>;
  if (!data?.posts.length) return null;
  const posts = archive ? data.posts.filter((post) => post.publishedAt && new Date(post.publishedAt).toISOString().slice(0, 7) === archive) : data.posts;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>Clinical perspectives</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{archive ? `Articles from ${new Date(`${archive}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}` : "Latest articles"}</h2>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {posts.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
            {post.image ? <img src={post.image} alt="" className="h-40 w-full object-cover" loading="lazy" /> : <div className="h-2" style={{ background: accent }} />}
            <div className="p-5 flex flex-col flex-1">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">
                {post.category && <span className="font-semibold" style={{ color: accent }}>{post.category}</span>}
                {post.publishedAt && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(post.publishedAt).toLocaleDateString()}</span>}
              </div>
              <h3 className="font-bold text-lg leading-snug text-slate-900">{post.title}</h3>
              {post.excerpt && <p className="text-sm leading-relaxed text-slate-600 mt-3 line-clamp-3">{post.excerpt}</p>}
              <a href={post.path} className="inline-flex items-center gap-1 text-sm font-semibold mt-5" style={{ color: accent }}>
                Read article <ArrowRight size={15} />
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="sr-only">Articles are published under {pathPrefix}</p>
    </section>
  );
}

function BlogSidebar({
  tenantKey,
  blogIndexPath,
  accent,
  blocks,
}: {
  tenantKey: PublicSiteTenantKey;
  blogIndexPath: string;
  accent: string;
  blocks: Block[];
}) {
  const { data, isLoading } = trpc.marketingSitePublic.listBlogPosts.useQuery({ tenantKey, limit: 100, offset: 0 });
  const posts = data?.posts ?? [];
  const archives = Array.from(new Map(posts.filter((post) => post.publishedAt).map((post) => {
    const key = new Date(post.publishedAt!).toISOString().slice(0, 7);
    return [key, new Date(`${key}-01T12:00:00`)];
  })).entries());

  return (
    <aside className="space-y-7">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>Blog archive</p>
        <div className="mt-3 space-y-2">
          <a href={blogIndexPath} className="block text-sm font-semibold text-slate-900 hover:underline">All articles</a>
          {archives.slice(0, 18).map(([key, date]) => <a key={key} href={`${blogIndexPath}?archive=${key}`} className="block text-sm text-slate-600 hover:text-slate-950 hover:underline">{date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</a>)}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>Recent posts</p>
        <div className="mt-3 space-y-3">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />}
          {posts.slice(0, 8).map((post) => <a key={post.id} href={post.path} className="block group"><p className="text-sm font-semibold leading-snug text-slate-900 group-hover:underline">{post.title}</p>{post.publishedAt && <p className="mt-1 text-xs text-slate-500">{new Date(post.publishedAt).toLocaleDateString()}</p>}</a>)}
        </div>
      </section>
      {blocks.map((block) => <div key={block.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><BlockPreview block={block} /></div>)}
    </aside>
  );
}

/**
 * A public domain must not display an application shell or a 404 merely because
 * its editable CMS copy has not been imported yet. This branded root is a
 * temporary, useful landing experience; an imported/published homepage always
 * replaces it automatically.
 */
function PublicSiteRootFallback({
  tenant,
  nav,
  accent,
}: {
  tenant: NonNullable<ReturnType<typeof getPublicSiteTenant>>;
  nav: Array<{ label: string; href: string }>;
  accent: string;
}) {
  const isEcho = tenant.brand === "iheartecho";
  const appUrl = isEcho ? "https://app.iheartecho.com" : "https://app.allaboutultrasound.com";
  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav nav={nav} siteName={tenant.siteName} accent={accent} />
      <main>
        <section className="bg-[#0e1e2e] text-white">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
            <p className="text-xs sm:text-sm uppercase tracking-[0.22em] font-semibold" style={{ color: accent }}>
              {isEcho ? "Echocardiography education" : "Ultrasound education"}
            </p>
            <h1 className="font-serif text-4xl sm:text-6xl font-bold leading-tight max-w-3xl mt-4">
              {isEcho ? "Learn echo with confidence." : "Education that moves ultrasound forward."}
            </h1>
            <p className="text-lg leading-relaxed text-slate-200 max-w-2xl mt-6">
              {isEcho
                ? "Clinical education, CME, registry support, and practical resources for echocardiography professionals."
                : "Clinical training, CME, registry preparation, and practical resources for ultrasound professionals."}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="https://learn.allaboutultrasound.com" className="inline-flex items-center rounded-lg px-5 py-3 font-semibold text-slate-950" style={{ background: accent }}>
                Explore learning
              </a>
              <a href={appUrl} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10">
                Open the clinical app
              </a>
            </div>
          </div>
        </section>
        <section className="max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20 grid gap-5 md:grid-cols-3">
          {[
            ["CME & courses", "Learn on your schedule with focused clinical education and continuing education."],
            ["Clinical tools", "Use practical resources built to support scanning, interpretation, and confidence."],
            ["Professional growth", "Explore registry preparation, workshops, and guidance for the next stage of practice."],
          ].map(([title, copy]) => (
            <article key={title} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="h-1 w-12 rounded-full" style={{ background: accent }} />
              <h2 className="text-xl font-bold text-slate-900 mt-5">{title}</h2>
              <p className="text-slate-600 leading-relaxed mt-3">{copy}</p>
            </article>
          ))}
        </section>
      </main>
      <footer className="bg-[#0e1e2e] text-white/75 text-center text-sm py-10 px-4">
        <p>© {new Date().getFullYear()} {tenant.siteName}. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function PublicMarketingSitePage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const tenant = getTenantForBrowser();
  const tenantKey = (tenant?.key ?? "aaus-net") as PublicSiteTenantKey;
  const [, navigate] = useLocation();
  const { data: settings, isLoading: settingsLoading } = trpc.marketingSitePublic.getSettings.useQuery({ tenantKey });
  const { data, isLoading, error } = trpc.marketingSitePublic.getPageByPath.useQuery({ path: pathname, tenantKey }, { retry: false });

  useEffect(() => {
    if (data?.redirectUrl) window.location.assign(data.redirectUrl);
  }, [data?.redirectUrl]);

  useEffect(() => {
    const title = data?.page?.seoTitle || data?.page?.title || settings?.tenant.siteName;
    if (title) document.title = title;
    const description = data?.page?.seoDescription;
    if (description) {
      let element = document.querySelector('meta[name="description"]');
      if (!element) { element = document.createElement("meta"); element.setAttribute("name", "description"); document.head.appendChild(element); }
      element.setAttribute("content", description);
    }
    const canonical = settings?.tenant?.promotionOrigin && `${settings.tenant.promotionOrigin}${pathname === "/" ? "" : pathname}`;
    if (canonical) {
      let element = document.querySelector('link[rel="canonical"]');
      if (!element) { element = document.createElement("link"); element.setAttribute("rel", "canonical"); document.head.appendChild(element); }
      element.setAttribute("href", canonical);
    }
  }, [data?.page?.seoDescription, data?.page?.seoTitle, data?.page?.title, pathname, settings?.tenant?.promotionOrigin, settings?.tenant?.siteName]);

  const blocks = useMemo(() => (data?.page?.blocks ?? []) as Block[], [data?.page?.blocks]);
  const nav = (settings?.nav ?? []) as Array<{ label: string; href: string }>;
  const brand = getBrandDisplayConfig(settings?.tenant?.brand ?? tenant?.brand ?? "aaus");
  const blogIndexPath = settings?.tenant?.blogIndexPath ?? tenant?.blogIndexPath;
  const showBlogListing = Boolean(blogIndexPath && pathname === blogIndexPath);
  const isBlogSurface = showBlogListing || data?.page?.pageType === "blog_post";
  const globalBlogSidebarBlocks = (settings?.blogSidebarBlocks ?? []) as Block[];
  const articleBlogSidebarBlocks = (data?.page?.blogSidebarBlocks ?? []) as Block[];
  const blogSidebarBlocks = data?.page?.blogSidebarMode === "override" ? articleBlogSidebarBlocks : globalBlogSidebarBlocks;

  if (isLoading || settingsLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin" style={{ color: brand.primaryColor }} size={32} /></div>;
  }

  if (error || !data?.page) {
    if (pathname === "/" && tenant) {
      return <PublicSiteRootFallback tenant={tenant} nav={nav} accent={brand.primaryColor} />;
    }
    return (
      <div className="min-h-screen bg-slate-50">
        <MarketingNav nav={nav} siteName={settings?.tenant.siteName ?? brand.displayName} accent={brand.accentColor} />
        <main className="max-w-lg mx-auto py-28 text-center px-5">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: brand.primaryColor }}>404</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-3">Page not found</h1>
          <p className="text-slate-600 mt-3">The requested page is not available on this site.</p>
          <button type="button" onClick={() => navigate("/")} className="mt-7 font-semibold" style={{ color: brand.primaryColor }}>Return home</button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {settings?.globalCss && <style>{settings.globalCss}</style>}
      <MarketingNav nav={nav} siteName={settings?.tenant.siteName ?? brand.displayName} accent={brand.accentColor} />
      <main>
        {isBlogSurface ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px]">
            <div className="min-w-0">
              {blocks.map((block) => <div key={block.id}><BlockPreview block={block} /></div>)}
              {blocks.length === 0 && !showBlogListing && <div className="py-24 text-center text-slate-500">This article is ready for content in the visual editor.</div>}
              {showBlogListing && <BlogListing tenantKey={tenantKey} pathPrefix={tenant?.blogPathPrefix ?? ""} accent={brand.primaryColor} />}
            </div>
            {blogIndexPath && <BlogSidebar tenantKey={tenantKey} blogIndexPath={blogIndexPath} accent={brand.primaryColor} blocks={blogSidebarBlocks} />}
          </div>
        ) : <>
          {blocks.map((block) => <div key={block.id}><BlockPreview block={block} /></div>)}
          {blocks.length === 0 && <div className="py-24 text-center text-slate-500">This page is ready for content in the visual editor.</div>}
        </>}
      </main>
      <footer className="bg-[#0e1e2e] text-white/75 text-center text-sm py-10 px-4 mt-12">
        <p>© {new Date().getFullYear()} {settings?.tenant.siteName ?? brand.displayName}. All rights reserved.</p>
      </footer>
    </div>
  );
}

export function MarketingSiteCatchAll() {
  return <PublicMarketingSitePage />;
}
