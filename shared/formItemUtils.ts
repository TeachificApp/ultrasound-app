/** Shared helpers for general form item extraConfig (admin-only fields, etc.) */

export function parseItemExtraConfig(extraConfig: string | null | undefined): Record<string, unknown> {
  if (!extraConfig) return {};
  try {
    return JSON.parse(extraConfig) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isAdminOnlyItem(item: { extraConfig?: string | null }): boolean {
  return parseItemExtraConfig(item.extraConfig).adminOnly === true;
}

export function mergeExtraConfig(
  existing: string | null | undefined,
  patch: Record<string, unknown>,
): string {
  return JSON.stringify({ ...parseItemExtraConfig(existing), ...patch });
}

export const DISPLAY_ONLY_ITEM_TYPES = new Set([
  "heading",
  "paragraph",
  "section_break",
  "rich_text",
]);

export function isInputItemType(itemType: string): boolean {
  return !DISPLAY_ONLY_ITEM_TYPES.has(itemType) && itemType !== "payment";
}

export type ResultsFilterCondition = {
  fieldId: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "is_empty"
    | "is_not_empty"
    | "greater_than"
    | "less_than";
  value: string;
};

export type SavedResultsFilter = {
  id: string;
  name: string;
  logic: "AND" | "OR";
  conditions: ResultsFilterCondition[];
};

export type FormActionConfig = {
  id: string;
  name: string;
  event: "on_submit" | "on_update";
  type: "email" | "webhook";
  enabled: boolean;
  emailTo?: string;
  emailSubject?: string;
};

export type FormResultsSettings = {
  savedFilters: SavedResultsFilter[];
  actions: FormActionConfig[];
};

export const DEFAULT_RESULTS_SETTINGS: FormResultsSettings = {
  savedFilters: [],
  actions: [],
};

export function parseResultsSettings(themeSettings: string | null | undefined): FormResultsSettings {
  if (!themeSettings) return { ...DEFAULT_RESULTS_SETTINGS };
  try {
    const parsed = JSON.parse(themeSettings) as { _resultsSettings?: FormResultsSettings };
    const rs = parsed._resultsSettings;
    return {
      savedFilters: rs?.savedFilters ?? [],
      actions: rs?.actions ?? [],
    };
  } catch {
    return { ...DEFAULT_RESULTS_SETTINGS };
  }
}

export function mergeResultsSettingsIntoTheme(
  themeSettings: string | null | undefined,
  resultsSettings: FormResultsSettings,
): string {
  let parsed: Record<string, unknown> = {};
  if (themeSettings) {
    try {
      parsed = JSON.parse(themeSettings) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  parsed._resultsSettings = resultsSettings;
  return JSON.stringify(parsed);
}

export function evalFilterCondition(
  responses: Record<string, unknown>,
  cond: ResultsFilterCondition,
): boolean {
  const raw = responses[cond.fieldId];
  const fieldVal = Array.isArray(raw)
    ? raw.join(", ")
    : raw === undefined || raw === null
      ? ""
      : String(raw);
  const condVal = cond.value.toLowerCase();
  const fv = fieldVal.toLowerCase();
  switch (cond.operator) {
    case "equals":
      return fv === condVal;
    case "not_equals":
      return fv !== condVal;
    case "contains":
      return fv.includes(condVal);
    case "not_contains":
      return !fv.includes(condVal);
    case "starts_with":
      return fv.startsWith(condVal);
    case "is_empty":
      return fieldVal === "";
    case "is_not_empty":
      return fieldVal !== "";
    case "greater_than":
      return parseFloat(fieldVal) > parseFloat(cond.value);
    case "less_than":
      return parseFloat(fieldVal) < parseFloat(cond.value);
    default:
      return true;
  }
}

export function applySavedFilter(
  submissions: Array<{ responses: string }>,
  filter: SavedResultsFilter,
): Array<{ responses: string }> {
  return submissions.filter(sub => {
    let responses: Record<string, unknown> = {};
    try {
      responses = JSON.parse(sub.responses);
    } catch {
      responses = {};
    }
    const results = filter.conditions.map(c => evalFilterCondition(responses, c));
    if (filter.conditions.length === 0) return true;
    return filter.logic === "AND" ? results.every(Boolean) : results.some(Boolean);
  });
}
