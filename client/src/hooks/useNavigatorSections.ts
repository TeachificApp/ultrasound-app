/**
 * useNavigatorSections.ts
 *
 * Fetches navigator protocol sections for a given module key from the database
 * via `trpc.navigatorAdmin.listSections`. Falls back to the embedded static
 * seed data when the DB returns no rows (i.e. the module hasn't been seeded yet).
 *
 * The returned `sections` array shape:
 *   { sectionName, view (alias for sectionName), probe, items: [{ id, label, detail, critical }] }
 *
 * Usage:
 *   const { sections, isLoading } = useNavigatorSections("abdominal");
 *   // sections[i].view === sections[i].sectionName (both available)
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { STATIC_NAVIGATOR_DATA } from "@/lib/navigatorStaticData";
import type { NavigatorSection } from "@/lib/navigatorStaticData";

/** A clinical image attached to a navigator section */
export interface NavigatorSectionImage {
  url: string;
  fileKey: string;
  caption: string;
  sortOrder: number;
}

/** NavigatorSection with a `view` alias for sectionName — used by legacy navigator pages */
export type NavigatorSectionWithView = NavigatorSection & {
  view: string;
  images: NavigatorSectionImage[];
};

export function useNavigatorSections(moduleKey: string): {
  sections: NavigatorSectionWithView[];
  isLoading: boolean;
  fromDb: boolean;
} {
  const { data: dbSections = [], isLoading } = trpc.navigatorAdmin.listSections.useQuery(
    { module: moduleKey },
    {
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );

  const sections = useMemo<NavigatorSection[]>(() => {
    // If DB has rows for this module, use them (admin edits are live)
    if (dbSections.length > 0) {
      return dbSections.map((row) => ({
        sectionName: row.sectionName,
        probe: row.probe ?? "",
        items: (row.items ?? []).map((item: { id: string; label: string; detail?: string; critical?: boolean }) => ({
          id: item.id,
          label: item.label,
          detail: item.detail ?? "",
          critical: item.critical ?? false,
        })),
        images: ((row as any).images ?? []).map((img: any, i: number) => ({
          url: img.url ?? "",
          fileKey: img.fileKey ?? "",
          caption: img.caption ?? "",
          sortOrder: img.sortOrder ?? i,
        })) as NavigatorSectionImage[],
      }));
    }
    // Otherwise fall back to embedded static data
    return STATIC_NAVIGATOR_DATA[moduleKey] ?? [];
  }, [dbSections, moduleKey]);

  const sectionsWithView = useMemo<NavigatorSectionWithView[]>(
    () => sections.map((s) => ({ ...s, view: s.sectionName, images: (s as any).images ?? [] })),
    [sections]
  );

  return {
    sections: sectionsWithView,
    isLoading,
    fromDb: dbSections.length > 0,
  };
}
