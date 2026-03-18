/**
 * useScanCoachOverrides.ts
 * Fetches DB overrides for a ScanCoach module and provides a helper to merge
 * them over a static view object.  Any non-null override field replaces the
 * corresponding field on the static view.
 *
 * Usage:
 *   const { mergeView, isLoading } = useScanCoachOverrides("tte");
 *   const view = mergeView(staticViewObject);
 *
 * Fix (2026-03-09): mergeView is now wrapped in useCallback so its reference
 * only changes when overrideMap changes (i.e. when DB data loads). Previously
 * it was a plain function re-created every render, causing useMemo dependencies
 * to always be "new" and images to not appear until a forced re-render.
 */
import { useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { ScanCoachModule } from "@/lib/scanCoachRegistry";

type OverrideRow = {
  viewId: string;
  echoImageUrl: string | null;
  anatomyImageUrl: string | null;
  transducerImageUrl: string | null;
  description: string | null;
  howToGet: string | null;
  tips: string | null;
  pitfalls: string | null;
  structures: string | null;
  measurements: string | null;
  criticalFindings: string | null;
};

/** Parse a JSON-array field back to string[] (or return the original if already an array) */
function parseJsonArray(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    // plain text — split by newline
    return value.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return null;
}

/** Merge a single override row onto a static view object */
function applyOverride<T extends Record<string, unknown>>(view: T, override: OverrideRow | undefined): T {
  if (!override) return view;

  const merged: Record<string, unknown> = { ...view };

  // Image URL overrides — only replace if the override has a non-empty value
  if (override.echoImageUrl)       merged.echoImageUrl       = override.echoImageUrl;
  if (override.anatomyImageUrl)    merged.anatomyImageUrl    = override.anatomyImageUrl;
  if (override.transducerImageUrl) merged.transducerImageUrl = override.transducerImageUrl;

  // Text overrides
  if (override.description) merged.description = override.description;

  // Array overrides
  const howToGet = parseJsonArray(override.howToGet);
  if (howToGet) merged.howToGet = howToGet;

  const tips = parseJsonArray(override.tips);
  if (tips) merged.tips = tips;

  const pitfalls = parseJsonArray(override.pitfalls);
  if (pitfalls) merged.pitfalls = pitfalls;

  const structures = parseJsonArray(override.structures);
  if (structures) merged.structures = structures;

  const measurements = parseJsonArray(override.measurements);
  if (measurements) merged.measurements = measurements;

  const criticalFindings = parseJsonArray(override.criticalFindings);
  if (criticalFindings) merged.criticalFindings = criticalFindings;

  return merged as T;
}

export function useScanCoachOverrides(module: ScanCoachModule) {
  const { data: overrides = [], isLoading } = trpc.scanCoachAdmin.listOverrides.useQuery(
    { module },
    {
      // staleTime: 0 ensures the live view always fetches fresh data on mount
      // (important because the editor opens the live page in a new tab with a
      // separate React Query cache — without this, saved changes won't appear
      // until a hard refresh)
      staleTime: 0,
      // Re-fetch when the user switches back to the live-view tab after saving
      // in the editor tab
      refetchOnWindowFocus: true,
    }
  );

  // Build a lookup map: viewId → override row
  // This only recomputes when the DB data changes (not on every render)
  const overrideMap = useMemo(() => {
    const map = new Map<string, OverrideRow>();
    for (const row of overrides as OverrideRow[]) {
      map.set(row.viewId, row);
    }
    return map;
  }, [overrides]);

  /**
   * Merge DB overrides onto a static view object.
   * Wrapped in useCallback so the function reference is stable between renders —
   * it only changes when overrideMap changes (i.e. when DB data loads/updates).
   * This prevents useMemo dependencies in consumer components from always being
   * "new" and ensures images appear as soon as the query resolves.
   */
  const mergeView = useCallback(
    function mergeViewFn<T extends Record<string, unknown>>(view: T & { id: string }): T {
      return applyOverride(view, overrideMap.get(view.id));
    },
    [overrideMap]
  );

  /** Check if a specific view has any override */
  const hasOverride = useCallback(
    (viewId: string): boolean => overrideMap.has(viewId),
    [overrideMap]
  );

  return { mergeView, hasOverride, isLoading, overrideMap };
}
