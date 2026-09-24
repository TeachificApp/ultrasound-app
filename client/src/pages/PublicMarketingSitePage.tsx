/**
 * PublicMarketingSitePage — independently editable All About Ultrasound and
 * iHeartEcho sites. Public navigation is generated from each tenant’s page tree.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Menu, X, ArrowRight, CalendarDays, ChevronDown, LockKeyhole } from "lucide-react";
import { getLoginUrl } from "@/const";
import { getBrandDisplayConfig } from "@shared/brands";
import { buildPublicSitePageTree, type PublicSitePageTreeNode } from "@shared/publicSitePageTree";
import {
  getPublicSiteTenant,
  getPublicSiteTenantForHost,
  type PublicSiteTenantKey,
} from "@shared/publicSiteTenants";

type NavItem = { id?: number; parentId?: number | null; label?: string; title?: string | null; href?: string; path?: string; sortOrder?: number | null; children?: NavItem[] };

function getTenantForBrowser(): ReturnType<typeof getPublicSiteTenant> {
  if (typeof window === "undefined") return getPublicSiteTenant("aaus-net");
  const query = new URLSearchParams(window.location.search).get("publicSite");
  if (query === "aaus-net" || query === "iheartecho-net") return getPublicSiteTenant(query);
  return getPublicSiteTenantForHost(window.location.hostname) ?? getPublicSiteTenant("aaus-net");
}

function navLabel(item: NavItem) { return item.title || item.label || item.path || item.href || "Page"; }
function navHref(item: NavItem) { return item.path || item.href || "/"; }

function MarketingNav({ nav, siteName, accent, headerType = "standard" }: { nav: NavItem[]; siteName: string; accent: string; headerType?: "standard" | "splash" | "no_header" }) {
  const [open, setOpen] = useState(false);
  const navigation = nav.slice(0, 12);
  return <header className={`bg-[#0e1e2e] text-white z-50 ${headerType === "splash" ? "relative border-b border-white/15" : "sticky top-0 shadow-md"}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4"><a href="/" className="font-bold text-lg tracking-tight shrink-0">{siteName}</a><button type="button" className="md:hidden p-2 rounded-md hover:bg-white/10" onClick={() => setOpen((value) => !value)} aria-label="Open site navigation">{open ? <X size={22} /> : <Menu size={22} />}</button>
      <nav className={`${open ? "flex" : "hidden"} md:flex flex-col md:flex-row md:items-center gap-1 md:gap-5 absolute md:relative top-full left-0 right-0 bg-[#0e1e2e] md:bg-transparent p-4 md:p-0 border-t md:border-0 border-white/10`}>
        {navigation.map((item) => item.children?.length ? <div key={`group-${navHref(item)}`} className="relative group"><a href={navHref(item)} onClick={() => setOpen(false)} className="flex items-center gap-1 text-sm py-2 md:py-0 hover:text-teal-200">{navLabel(item)} <ChevronDown className="w-3.5 h-3.5" /></a><div className="md:absolute md:hidden md:group-hover:block md:group-focus-within:block md:top-full md:left-0 md:min-w-52 md:pt-3"><div className="md:rounded-lg md:bg-white md:text-slate-900 md:shadow-lg md:ring-1 md:ring-black/5 md:p-1">{item.children.map((child) => <a key={navHref(child)} href={navHref(child)} onClick={() => setOpen(false)} className="block rounded px-3 py-2 text-sm hover:bg-teal-50 hover:text-teal-800">{navLabel(child)}</a>)}</div></div></div> : <a key={`${navHref(item)}-${navLabel(item)}`} href={navHref(item)} className="text-sm py-2 md:py-0 transition-colors" style={{ color: open ? "#ffffff" : undefined }} onMouseEnter={(event) => { event.currentTarget.style.color = accent; }} onMouseLeave={(event) => { event.currentTarget.style.color = ""; }} onClick={() => setOpen(false)}>{navLabel(item)}</a>)}
      </nav>
    </div>
  </header>;
}

function BlogListing({ tenantKey, pathPrefix, accent }: { tenantKey: PublicSiteTenantKey; pathPrefix: string; accent: string }) {
  const { data, isLoading } = trpc.marketingSitePublic.listBlogPosts.useQuery({ tenantKey, limit: 100, offset: 0 });
  const archive = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("archive") : null;
  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" style={{ color: accent }} /></div>;
  if (!data?.posts.length) return null;
  const posts = archive ? data.posts.filter((post) => post.publishedAt && new Date(post.publishedAt).toISOString().slice(0, 7) === archive) : data.posts;
  return <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-10"><div className="flex items-end justify-between gap-4 mb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>Clinical perspectives</p><h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">{archive ? `Articles from ${new Date(`${archive}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}` : "Latest articles"}</h2></div></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{posts.map((post) => <article key={post.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">{post.image ? <img src={post.image} alt="" className="h-40 w-full object-cover" loading="lazy" /> : <div className="h-2" style={{ background: accent }} />}<div className="p-5 flex flex-col flex-1"><div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">{post.category && <span className="font-semibold" style={{ color: accent }}>{post.category}</span>}{post.publishedAt && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(post.publishedAt).toLocaleDateString()}</span>}</div><h3 className="font-bold text-lg leading-snug text-slate-900">{post.title}</h3>{post.excerpt && <p className="text-sm leading-relaxed text-slate-600 mt-3 line-clamp-3">{post.excerpt}</p>}<a href={post.path} className="inline-flex items-center gap-1 text-sm font-semibold mt-5" style={{ color: accent }}>Read article <ArrowRight size={15} /></a></div></article>)}</div><p className="sr-only">Articles are published under {pathPrefix}</p></section>;
}

function BlogSidebar({ tenantKey, blogIndexPath, accent, blocks }: { tenantKey: PublicSiteTenantKey; blogIndexPath: string; accent: string; blocks: Block[] }) {
  const { data, isLoading } = trpc.marketingSitePublic.listBlogPosts.useQuery({ tenantKey, limit: 100, offset: 0 });
  const posts = data?.posts ?? [];
  const archives = Array.from(new Map(posts.filter((post) => post.publishedAt).map((post) => { const key = new Date(post.publishedAt!).toISOString().slice(0, 7); return [key, new Date(`${key}-01T12:00:00`)]; })).entries());
  return <aside className="space-y-7"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>Blog archive</p><div className="mt-3 space-y-2"><a href={blogIndexPath} className="block text-sm font-semibold text-slate-900 hover:underline">All articles</a>{archives.slice(0, 18).map(([key, date]) => <a key={key} href={`${blogIndexPath}?archive=${key}`} className="block text-sm text-slate-600 hover:text-slate-950 hover:underline">{date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</a>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>Recent posts</p><div className="mt-3 space-y-3">{isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />}{posts.slice(0, 8).map((post) => <a key={post.id} href={post.path} className="block group"><p className="text-sm font-semibold leading-snug text-slate-900 group-hover:underline">{post.title}</p>{post.publishedAt && <p className="mt-1 text-xs text-slate-500">{new Date(post.publishedAt).toLocaleDateString()}</p>}</a>)}</div></section>{blocks.map((block) => <div key={block.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><BlockPreview block={block} /></div>)}</aside>;
}

function PublicSiteRootFallback({ tenant, nav, accent }: { tenant: NonNullable<ReturnType<typeof getPublicSiteTenant>>; nav: NavItem[]; accent: string }) {
  const isEcho = tenant.brand === "iheartecho"; const appUrl = isEcho ? "https://app.iheartecho.com" : "https://app.allaboutultrasound.com";
  return <div className="min-h-screen bg-slate-50"><MarketingNav nav={nav} siteName={tenant.siteName} accent={accent} /><main><section className="bg-[#0e1e2e] text-white"><div className="max-w-7xl mx-auto px-5 sm:px-8 py-20 sm:py-28"><p className="text-xs sm:text-sm uppercase tracking-[0.22em] font-semibold" style={{ color: accent }}>{isEcho ? "Echocardiography education" : "Ultrasound education"}</p><h1 className="font-serif text-4xl sm:text-6xl font-bold leading-tight max-w-3xl mt-4">{isEcho ? "Learn echo with confidence." : "Education that moves ultrasound forward."}</h1><p className="text-lg leading-relaxed text-slate-200 max-w-2xl mt-6">{isEcho ? "Clinical education, CME, registry support, and practical resources for echocardiography professionals." : "Clinical training, CME, registry preparation, and practical resources for ultrasound professionals."}</p><div className="flex flex-wrap gap-3 mt-8"><a href="https://learn.allaboutultrasound.com" className="inline-flex items-center rounded-lg px-5 py-3 font-semibold text-slate-950" style={{ background: accent }}>Explore learning</a><a href={appUrl} className="inline-flex items-center rounded-lg border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10">Open the clinical app</a></div></div></section></main><footer className="bg-[#0e1e2e] text-white/75 text-center text-sm py-10 px-4"><p>© {new Date().getFullYear()} {tenant.siteName}. All rights reserved.</p></footer></div>;
}

function AccessGate({ mode, title, onPasswordAccepted }: { mode: "site_password" | "members_or_groups"; title?: string | null; onPasswordAccepted: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const tenant = getTenantForBrowser(); const tenantKey = (tenant?.key ?? "aaus-net") as PublicSiteTenantKey;
  const verify = trpc.marketingSitePublic.verifyPagePassword.useMutation({ onSuccess: () => { setError(""); onPasswordAccepted(); }, onError: (mutationError) => setError(mutationError.message) });
  const isPassword = mode === "site_password";
  return <div className="min-h-[55vh] flex items-center justify-center bg-slate-50 px-5"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><LockKeyhole className="h-6 w-6" /></div><h1 className="mt-4 text-2xl font-bold text-slate-900">{title || (isPassword ? "Protected page" : "Member access required")}</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">{isPassword ? "Enter the page password to continue." : "This page is available to signed-in platform members."}</p>{isPassword ? <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); setError(""); verify.mutate({ tenantKey, path: window.location.pathname, password }); }}><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Page password" autoComplete="current-password" /><Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={!password || verify.isPending}>{verify.isPending ? "Checking…" : "Unlock page"}</Button>{error && <p className="text-sm text-red-600">{error}</p>}</form> : <Button className="mt-5 w-full bg-teal-600 hover:bg-teal-700" onClick={() => { window.location.href = getLoginUrl(window.location.pathname); }}>Sign in to continue</Button>}</div></div>;
}

export default function PublicMarketingSitePage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const tenant = getTenantForBrowser(); const tenantKey = (tenant?.key ?? "aaus-net") as PublicSiteTenantKey;
  const [, navigate] = useLocation(); const [accessRefresh, setAccessRefresh] = useState(0);
  const { data: settings, isLoading: settingsLoading } = trpc.marketingSitePublic.getSettings.useQuery({ tenantKey });
  const { data: navigationPages = [] } = trpc.marketingSitePublic.listNavigation.useQuery({ tenantKey });
  const { data, isLoading, error, refetch } = trpc.marketingSitePublic.getPageByPath.useQuery({ path: pathname, tenantKey }, { retry: false });

  useEffect(() => { if (accessRefresh) void refetch(); }, [accessRefresh, refetch]);
  useEffect(() => { if (data?.redirectUrl) window.location.assign(data.redirectUrl); }, [data?.redirectUrl]);
  useEffect(() => {
    const title = data?.page?.seoTitle || data?.page?.title || settings?.tenant.siteName; if (title) document.title = title;
    const description = data?.page?.seoDescription; if (description) { let element = document.querySelector('meta[name="description"]'); if (!element) { element = document.createElement("meta"); element.setAttribute("name", "description"); document.head.appendChild(element); } element.setAttribute("content", description); }
    const canonical = settings?.tenant?.promotionOrigin && `${settings.tenant.promotionOrigin}${pathname === "/" ? "" : pathname}`; if (canonical) { let element = document.querySelector('link[rel="canonical"]'); if (!element) { element = document.createElement("link"); element.setAttribute("rel", "canonical"); document.head.appendChild(element); } element.setAttribute("href", canonical); }
  }, [data?.page?.seoDescription, data?.page?.seoTitle, data?.page?.title, pathname, settings?.tenant?.promotionOrigin, settings?.tenant?.siteName]);

  const blocks = useMemo(() => (data?.page?.blocks ?? []) as Block[], [data?.page?.blocks]);
  const nav = useMemo<NavItem[]>(() => {
    if (navigationPages.length) return buildPublicSitePageTree(navigationPages.map((page) => ({ ...page, title: page.title ?? page.path }))) as unknown as NavItem[];
    return (settings?.nav ?? []) as NavItem[];
  }, [navigationPages, settings?.nav]);
  const brand = getBrandDisplayConfig(settings?.tenant?.brand ?? tenant?.brand ?? "aaus"); const blogIndexPath = settings?.tenant?.blogIndexPath ?? tenant?.blogIndexPath;
  const showBlogListing = Boolean(blogIndexPath && pathname === blogIndexPath); const isBlogSurface = showBlogListing || data?.page?.pageType === "blog_post";
  const globalBlogSidebarBlocks = (settings?.blogSidebarBlocks ?? []) as Block[]; const articleBlogSidebarBlocks = (data?.page?.blogSidebarBlocks ?? []) as Block[];
  const blogSidebarBlocks = data?.page?.blogSidebarMode === "override" ? articleBlogSidebarBlocks : globalBlogSidebarBlocks;

  if (isLoading || settingsLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin" style={{ color: brand.primaryColor }} size={32} /></div>;
  if (data?.accessRequired) return <AccessGate mode={data.accessRequired} title={data.page?.title} onPasswordAccepted={() => setAccessRefresh((value) => value + 1)} />;
  if (error || !data?.page) { if (pathname === "/" && tenant) return <PublicSiteRootFallback tenant={tenant} nav={nav} accent={brand.primaryColor} />; return <div className="min-h-screen bg-slate-50"><MarketingNav nav={nav} siteName={settings?.tenant.siteName ?? brand.displayName} accent={brand.accentColor} /><main className="max-w-lg mx-auto py-28 text-center px-5"><p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: brand.primaryColor }}>404</p><h1 className="text-3xl font-bold text-slate-900 mt-3">Page not found</h1><p className="text-slate-600 mt-3">The requested page is not available on this site.</p><button type="button" onClick={() => navigate("/")} className="mt-7 font-semibold" style={{ color: brand.primaryColor }}>Return home</button></main></div>; }

  const showHeader = data.page.headerType !== "no_header";
  return <div className="min-h-screen bg-white">{settings?.globalCss && <style>{settings.globalCss}</style>}{showHeader && <MarketingNav nav={nav} siteName={settings?.tenant.siteName ?? brand.displayName} accent={brand.accentColor} headerType={data.page.headerType} />}<main>{isBlogSurface ? <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:py-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px]"><div className="min-w-0">{blocks.map((block) => <div key={block.id}><BlockPreview block={block} /></div>)}{blocks.length === 0 && !showBlogListing && <div className="py-24 text-center text-slate-500">This article is ready for content in the visual editor.</div>}{showBlogListing && <BlogListing tenantKey={tenantKey} pathPrefix={tenant?.blogPathPrefix ?? ""} accent={brand.primaryColor} />}</div>{blogIndexPath && <BlogSidebar tenantKey={tenantKey} blogIndexPath={blogIndexPath} accent={brand.primaryColor} blocks={blogSidebarBlocks} />}</div> : <>{blocks.map((block) => <div key={block.id}><BlockPreview block={block} /></div>)}{blocks.length === 0 && <div className="py-24 text-center text-slate-500">This page is ready for content in the visual editor.</div>}</>}</main><footer className="bg-[#0e1e2e] text-white/75 text-center text-sm py-10 px-4 mt-12"><p>© {new Date().getFullYear()} {settings?.tenant.siteName ?? brand.displayName}. All rights reserved.</p></footer></div>;
}

export function MarketingSiteCatchAll() { return <PublicMarketingSitePage />; }
