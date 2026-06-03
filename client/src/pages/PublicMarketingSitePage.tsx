/**
 * PublicMarketingSitePage — renders imported marketing pages on site.allaboutultrasound.com
 */
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { Loader2, Menu, X } from "lucide-react";
import { useState } from "react";

function StagingBanner({ text }: { text: string }) {
  return (
    <div className="bg-amber-500 text-amber-950 text-center text-xs sm:text-sm py-2 px-4 font-semibold z-[100] relative">
      ⚠ {text} — <span className="font-normal">www.allaboutultrasound.com is unchanged</span>
    </div>
  );
}

function MarketingNav({ nav, siteName }: { nav: Array<{ label: string; href: string }>; siteName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-[#0e1e2e] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <a href="/" className="font-bold text-lg tracking-tight shrink-0">{siteName}</a>
        <button type="button" className="md:hidden p-2" onClick={() => setOpen(v => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`${open ? "flex" : "hidden"} md:flex flex-col md:flex-row md:items-center gap-1 md:gap-4 absolute md:relative top-full left-0 right-0 bg-[#0e1e2e] md:bg-transparent p-4 md:p-0 border-t md:border-0 border-white/10`}>
          {nav.slice(0, 12).map(item => (
            <a
              key={item.href + item.label}
              href={item.href}
              className="text-sm py-2 md:py-0 hover:text-teal-300 transition-colors"
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

export default function PublicMarketingSitePage() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const [, navigate] = useLocation();

  const { data: settings } = trpc.marketingSitePublic.getSettings.useQuery();
  const { data, isLoading, error } = trpc.marketingSitePublic.getPageByPath.useQuery(
    { path: pathname },
    { retry: false },
  );

  useEffect(() => {
    if (data?.redirectUrl) {
      window.location.href = data.redirectUrl;
    }
  }, [data?.redirectUrl]);

  useEffect(() => {
    const t = data?.page?.seoTitle || data?.page?.title;
    if (t) document.title = t;
  }, [data?.page?.seoTitle, data?.page?.title]);

  const blocks = useMemo(() => (data?.page?.blocks ?? []) as Block[], [data?.page?.blocks]);
  const nav = (settings?.nav ?? []) as Array<{ label: string; href: string }>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    );
  }

  if (error || !data?.page) {
    return (
      <div className="min-h-screen bg-gray-50">
        {settings?.isStaging && <StagingBanner text={settings.stagingBannerText ?? "Staging Preview"} />}
        <MarketingNav nav={nav} siteName={settings?.siteName ?? "All About Ultrasound"} />
        <div className="max-w-lg mx-auto mt-24 text-center px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Page not imported yet</h1>
          <p className="text-gray-500 mb-6">Path: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{pathname}</code></p>
          <a href="/" className="text-teal-600 underline">Go to homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {settings?.isStaging && <StagingBanner text={settings.stagingBannerText ?? "Staging Preview"} />}
      <MarketingNav nav={nav} siteName={settings?.siteName ?? "All About Ultrasound"} />
      <main>
        {blocks.map(block => (
          <div key={block.id}>
            <BlockPreview block={block} />
          </div>
        ))}
        {blocks.length === 0 && (
          <div className="py-24 text-center text-gray-400">This page has no content blocks yet.</div>
        )}
      </main>
      <footer className="bg-[#0e1e2e] text-white/70 text-center text-xs py-8 px-4 mt-12">
        <p>© {new Date().getFullYear()} All About Ultrasound™ — Staging environment</p>
        <p className="mt-1">Live site: <a href="https://www.allaboutultrasound.com" className="underline text-teal-300">www.allaboutultrasound.com</a></p>
      </footer>
    </div>
  );
}

/** Catch-all route handler — reads window.location.pathname */
export function MarketingSiteCatchAll() {
  return <PublicMarketingSitePage />;
}
