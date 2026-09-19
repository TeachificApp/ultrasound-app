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
  const { data, isLoading } = trpc.marketingSitePublic.listBlogPosts.useQuery({ tenantKey, limit: 24, offset: 0 });
  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" style={{ color: accent }} /></div>;
  if (!data?.posts.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>Clinical perspectives</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Latest articles</h2>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.posts.map((post) => (
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

  if (isLoading || settingsLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin" style={{ color: brand.primaryColor }} size={32} /></div>;
  }

  if (error || !data?.page) {
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
        {blocks.map((block) => <div key={block.id}><BlockPreview block={block} /></div>)}
        {blocks.length === 0 && <div className="py-24 text-center text-slate-500">This page is ready for content in the visual editor.</div>}
        {showBlogListing && <BlogListing tenantKey={tenantKey} pathPrefix={tenant?.blogPathPrefix ?? ""} accent={brand.primaryColor} />}
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
