import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { BlockPreview, type Block } from "@/components/BlockPreview";
import { DEFAULT_SYSTEM_PAGES, RESERVED_SITE_SLUGS } from "@shared/sitePagesConstants";
import NotFound from "@/pages/NotFound";

type Props = {
  slug: string;
  domain?: string;
};

function renderBlocks(blocks: Block[]) {
  return (
    <div className="min-h-screen bg-white">
      {blocks.map((block) => (
        <BlockPreview key={block.id} block={block} />
      ))}
    </div>
  );
}

export default function PublicSitePage({ slug, domain }: Props) {
  const resolvedDomain = domain ?? window.location.hostname.toLowerCase();

  const { data: page, isLoading, error } = trpc.sitePages.public.getBySlug.useQuery({
    domain: resolvedDomain,
    slug,
  });

  useEffect(() => {
    if (!page) return;
    if (page.seoTitle) document.title = page.seoTitle;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && page.seoDescription) desc.setAttribute("content", page.seoDescription);
  }, [page]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const fallbackDef = !page && !error ? DEFAULT_SYSTEM_PAGES.find((p) => p.slug === slug) : null;

  if (!page && !fallbackDef) return <NotFound />;

  let blocks: Block[] = [];
  try {
    const raw = page?.blocks ?? JSON.stringify(fallbackDef?.defaultBlocks ?? []);
    const parsed = raw ? JSON.parse(raw) : [];
    blocks = Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }

  if (page?.pageKind === "login" || slug === "login") {
    return (
      <div>
        {blocks.map((block) => (
          <BlockPreview key={block.id} block={block} />
        ))}
        <div className="max-w-md mx-auto p-6 text-center text-sm text-gray-500">
          Sign-in form is provided by the app login route.
        </div>
      </div>
    );
  }

  return renderBlocks(blocks);
}

/** Catch-all site page route — only renders CMS pages for non-reserved slugs. */
export function SitePageCatchRoute({ slug }: { slug: string }) {
  if (RESERVED_SITE_SLUGS.has(slug.toLowerCase())) return <NotFound />;
  return <PublicSitePage slug={slug} />;
}
