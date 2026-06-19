import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import type { SiteNavItem, SiteNavMenuKey } from "@shared/sitePagesConstants";
import { getSitePageDomain } from "@/lib/sitePageDomain";

export type SiteNavLinkItem = {
  label: string;
  href: string;
  external?: boolean;
  openInNewTab?: boolean;
  children?: SiteNavLinkItem[];
};

function mapNavItem(item: SiteNavItem): SiteNavLinkItem {
  const href = item.href ?? "/";
  const external = /^https?:\/\//i.test(href);
  return {
    label: item.label,
    href,
    external,
    openInNewTab: item.openInNewTab,
    children: item.children?.map(mapNavItem),
  };
}

/**
 * Loads CMS navigation for a menu slot. Falls back to `defaultItems` when no custom menu is saved.
 */
export function useSiteNavMenu(
  menuKey: SiteNavMenuKey,
  defaultItems: SiteNavLinkItem[] = [],
): { items: SiteNavLinkItem[]; isLoading: boolean; isCustom: boolean } {
  const domain = useMemo(() => getSitePageDomain(), []);

  const { data, isLoading } = trpc.sitePages.public.getNavMenu.useQuery(
    { domain, menuKey },
    { staleTime: 5 * 60_000, retry: false },
  );

  const items = useMemo(() => {
    const cms = data?.items ?? [];
    if (cms.length === 0) return defaultItems;
    return cms.map(mapNavItem);
  }, [data?.items, defaultItems]);

  return {
    items,
    isLoading,
    isCustom: (data?.items?.length ?? 0) > 0,
  };
}
