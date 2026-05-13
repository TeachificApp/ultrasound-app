/**
 * useNavigatorProtocol — iHeartEcho™
 *
 * Returns the protocol sections for a given navigator module.
 *
 * MERGE STRATEGY (not replace):
 *   - Always starts with the full static protocol as the base.
 *   - For each DB override row, find the matching static section by sectionId
 *     and replace it with the DB version (title, probeNote, items).
 *   - Static sections with no DB override are kept as-is.
 *   - This means saving ONE section in the Navigator Editor only changes that
 *     one section — all others continue to show from the static defaults.
 *
 * FIELD MAPPING:
 *   - DB sectionTitle → section.view (or section.title if titleField="title" option is passed)
 *   - DB probeNote    → section.probe (and section.probeNote)
 *   - DB items        → section.items (label + detail + critical preserved)
 *
 * Usage:
 *   const { sections, isLoading } = useNavigatorProtocol("tte", tteProtocol);
 *   const { sections, isLoading } = useNavigatorProtocol("hocm", protocolSections, { titleField: "title" });
 *
 * The `staticProtocol` arg is the hardcoded array from the navigator page.
 * Each section must have at minimum: { id, items: { label, detail?, critical? }[] }
 * and either a `view` or `title` field for the section heading.
 * Navigator-specific extra fields (position, angle, depth, clinicalUse, window, tips,
 * pearls, normalFindings, abnormalFindings, etc.) are carried through transparently.
 */
import { trpc } from "@/lib/trpc";

export interface ChecklistItem {
  id?: string;
  label: string;
  detail?: string;
  critical?: boolean;
  // TEE-specific
  angle?: string;
  [key: string]: unknown;
}

export interface ProtocolSection {
  // Core fields (required)
  items: ChecklistItem[];
  // Section heading — one of these must be present
  view?: string;
  title?: string;
  // Probe/position note
  probe?: string;
  probeNote?: string;
  // Optional identifier (used as section key)
  id?: string;
  // TEE-specific
  position?: string;
  angle?: string;
  depth?: string;
  clinicalUse?: string;
  // UEA-specific
  window?: string;
  tips?: string[];
  normalFindings?: string[];
  abnormalFindings?: string[];
  // POCUS Cardiac-specific
  pearls?: string[];
  // Allow any additional navigator-specific fields
  [key: string]: unknown;
}

export interface UseNavigatorProtocolOptions {
  /** If the navigator uses `title` instead of `view` for the section heading, set this to "title" */
  titleField?: "view" | "title";
}

export function useNavigatorProtocol<T extends ProtocolSection>(
  module: string,
  staticProtocol: T[],
  options?: UseNavigatorProtocolOptions
): { sections: T[]; isLoading: boolean; isFromDb: boolean } {
  const titleField = options?.titleField ?? "view";
  const { data: dbSections, isLoading } = trpc.navigatorAdmin.getModuleSections.useQuery(
    { module },
    {
      staleTime: 0, // always refetch so Navigator Editor saves are reflected immediately
      retry: 1,
    }
  );

  // Always start with the full static protocol as the base.
  // Merge DB overrides on top: each DB row replaces the matching static section
  // by sectionId. Unmatched static sections are kept unchanged.
  if (!isLoading && dbSections && dbSections.length > 0) {
    // Build a lookup map of DB overrides keyed by sectionId
    const dbMap = new Map(dbSections.map((s) => [s.sectionId, s]));

    const merged = staticProtocol.map((staticSection) => {
      // The static section's id field is used as the sectionId key
      const sectionId = (staticSection as { id?: string }).id;
      if (sectionId && dbMap.has(sectionId)) {
        const dbRow = dbMap.get(sectionId)!;
        // Override title/view, probe, and items from DB — preserve all other
        // navigator-specific fields (position, angle, depth, tips, etc.) from static
        const overrides: Record<string, unknown> = { items: dbRow.items };
        if (titleField === "title") {
          overrides.title = dbRow.sectionTitle;
        } else {
          overrides.view = dbRow.sectionTitle;
        }
        if (dbRow.probeNote) {
          overrides.probe = dbRow.probeNote;
          overrides.probeNote = dbRow.probeNote;
        }
        return { ...staticSection, ...overrides } as T;
      }
      // No DB override for this section — use static as-is
      return staticSection;
    });

    return { sections: merged, isLoading: false, isFromDb: true };
  }

  return { sections: staticProtocol, isLoading, isFromDb: false };
}
