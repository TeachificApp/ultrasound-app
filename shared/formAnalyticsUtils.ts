/** Analytics engine for general form submissions — field stats, cross-tabs, reports */

import {
  applySavedFilter,
  type SavedResultsFilter,
  isInputItemType,
  isAdminOnlyItem,
} from "./formItemUtils";

export type FormFieldMeta = {
  id: number;
  label: string;
  itemType: string;
  sortOrder: number;
  extraConfig?: string | null;
};

export type FormOptionMeta = {
  itemId: number;
  label: string;
  value: string;
  sortOrder: number;
};

export type ParsedSubmission = {
  id: number;
  responses: Record<string, unknown>;
  submittedAt?: Date | string | null;
  score?: number | null;
  status?: string | null;
};

export type ValueCount = {
  value: string;
  label: string;
  count: number;
  percent: number;
};

export type NumericFieldStats = {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
  sum: number | null;
};

export type FieldAnalytics = {
  fieldId: number;
  label: string;
  itemType: string;
  responseCount: number;
  emptyCount: number;
  uniqueCount: number;
  distribution: ValueCount[];
  numericStats: NumericFieldStats | null;
  comparisonRank?: number;
};

export type CrossTabCell = {
  rowValue: string;
  colValue: string;
  count: number;
  percent: number;
};

export type CrossTabResult = {
  rowFieldId: number;
  rowLabel: string;
  colFieldId: number;
  colLabel: string;
  rowValues: string[];
  colValues: string[];
  cells: CrossTabCell[];
  total: number;
};

// ─── Multi-field Cross-Tabulation (1 row × N columns) ────────────────────────

export type MultiCrossTabResult = {
  rowFieldId: number;
  rowLabel: string;
  comparisons: CrossTabResult[];
};

export type AnalyticsReportConfig = {
  id: string;
  name: string;
  token: string;
  headerHtml?: string;
  passwordHash?: string;
  filterId?: string;
  visibleFieldIds?: number[];
  chartFieldIds?: number[];
  showTable: boolean;
  showCharts: boolean;
  crossTabRowFieldId?: number;
  crossTabColFieldId?: number;
  /** Multi-column cross-tab: compare rowField against multiple colFields */
  crossTabColFieldIds?: number[];
  createdAt: string;
  updatedAt: string;
};

export type AnalyticsDashboardWidget =
  | {
      id: string;
      type: "summary";
      formIds: number[];
    }
  | {
      id: string;
      type: "field_chart";
      formId: number;
      fieldId: number;
      filterId?: string;
    }
  | {
      id: string;
      type: "cross_tab";
      formId: number;
      rowFieldId: number;
      colFieldId: number;
      filterId?: string;
    }
  | {
      id: string;
      type: "multi_form_compare";
      formIds: number[];
      fieldLabel: string;
    };

export type AnalyticsDashboardConfig = {
  id: string;
  name: string;
  token: string;
  headerHtml?: string;
  passwordHash?: string;
  widgets: AnalyticsDashboardWidget[];
  createdAt: string;
  updatedAt: string;
};

export type FormAnalyticsSettings = {
  reports: AnalyticsReportConfig[];
};

export type GlobalAnalyticsSettings = {
  dashboards: AnalyticsDashboardConfig[];
  reportIndex: Record<string, { formId: number; reportId: string }>;
  dashboardIndex: Record<string, string>;
};

export const DEFAULT_FORM_ANALYTICS_SETTINGS: FormAnalyticsSettings = {
  reports: [],
};

export const DEFAULT_GLOBAL_ANALYTICS_SETTINGS: GlobalAnalyticsSettings = {
  dashboards: [],
  reportIndex: {},
  dashboardIndex: {},
};

const NUMERIC_TYPES = new Set(["number", "rating", "scale", "slider"]);
const CHOICE_TYPES = new Set([
  "radio",
  "select",
  "dropdown",
  "checkbox",
  "multi_select",
  "yes_no",
  "multiple_choice",
]);

export function parseFormAnalyticsSettings(
  themeSettings: string | null | undefined,
): FormAnalyticsSettings {
  if (!themeSettings) return { ...DEFAULT_FORM_ANALYTICS_SETTINGS };
  try {
    const parsed = JSON.parse(themeSettings) as { _analyticsSettings?: FormAnalyticsSettings };
    return {
      reports: parsed._analyticsSettings?.reports ?? [],
    };
  } catch {
    return { ...DEFAULT_FORM_ANALYTICS_SETTINGS };
  }
}

export function mergeFormAnalyticsIntoTheme(
  themeSettings: string | null | undefined,
  analyticsSettings: FormAnalyticsSettings,
): string {
  let parsed: Record<string, unknown> = {};
  if (themeSettings) {
    try {
      parsed = JSON.parse(themeSettings) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  parsed._analyticsSettings = analyticsSettings;
  return JSON.stringify(parsed);
}

export function parseGlobalAnalyticsSettings(
  themeSettings: string | null | undefined,
): GlobalAnalyticsSettings {
  if (!themeSettings) return { ...DEFAULT_GLOBAL_ANALYTICS_SETTINGS };
  try {
    const parsed = JSON.parse(themeSettings) as {
      _analyticsDashboards?: AnalyticsDashboardConfig[];
      _analyticsReportIndex?: Record<string, { formId: number; reportId: string }>;
      _analyticsDashboardIndex?: Record<string, string>;
    };
    return {
      dashboards: parsed._analyticsDashboards ?? [],
      reportIndex: parsed._analyticsReportIndex ?? {},
      dashboardIndex: parsed._analyticsDashboardIndex ?? {},
    };
  } catch {
    return { ...DEFAULT_GLOBAL_ANALYTICS_SETTINGS };
  }
}

export function mergeGlobalAnalyticsSettings(
  themeSettings: string | null | undefined,
  settings: GlobalAnalyticsSettings,
): string {
  let parsed: Record<string, unknown> = {};
  if (themeSettings) {
    try {
      parsed = JSON.parse(themeSettings) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  parsed._analyticsDashboards = settings.dashboards;
  parsed._analyticsReportIndex = settings.reportIndex;
  parsed._analyticsDashboardIndex = settings.dashboardIndex;
  return JSON.stringify(parsed);
}

export function parseSubmissions(
  rows: Array<{ id: number; responses: string; submittedAt?: Date | string | null; score?: number | null; status?: string | null }>,
): ParsedSubmission[] {
  return rows.map(row => {
    let responses: Record<string, unknown> = {};
    try {
      responses = JSON.parse(row.responses) as Record<string, unknown>;
    } catch {
      responses = {};
    }
    return {
      id: row.id,
      responses,
      submittedAt: row.submittedAt,
      score: row.score,
      status: row.status,
    };
  });
}

export function filterSubmissions(
  rows: Array<{ id: number; responses: string }>,
  filter?: SavedResultsFilter,
): Array<{ id: number; responses: string }> {
  if (!filter || filter.conditions.length === 0) return rows;
  return applySavedFilter(rows, filter);
}

function formatValue(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) return raw.map(v => String(v)).join(", ");
  return String(raw);
}

function optionLabelForValue(
  options: FormOptionMeta[],
  itemId: number,
  value: string,
): string {
  const opt = options.find(o => o.itemId === itemId && o.value === value);
  return opt?.label ?? value;
}

function expandValues(raw: unknown, itemType: string): string[] {
  if (raw === undefined || raw === null || raw === "") return [];
  if (Array.isArray(raw)) return raw.map(v => String(v)).filter(Boolean);
  if (itemType === "checkbox" || itemType === "multi_select") {
    const s = String(raw);
    if (s.includes(",")) return s.split(",").map(v => v.trim()).filter(Boolean);
  }
  return [String(raw)];
}

function computeNumericStats(values: number[]): NumericFieldStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round((sum / values.length) * 100) / 100,
    median: Math.round(median * 100) / 100,
    sum: Math.round(sum * 100) / 100,
  };
}

export function computeFieldAnalytics(
  items: FormFieldMeta[],
  options: FormOptionMeta[],
  submissions: ParsedSubmission[],
): FieldAnalytics[] {
  const inputItems = items.filter(
    i => isInputItemType(i.itemType) && !isAdminOnlyItem(i),
  );
  const total = submissions.length;

  return inputItems.map(item => {
    const values: string[] = [];
    const numericValues: number[] = [];
    let emptyCount = 0;

    for (const sub of submissions) {
      const raw = sub.responses[String(item.id)];
      const formatted = formatValue(raw);
      if (formatted === "") {
        emptyCount++;
        continue;
      }
      if (NUMERIC_TYPES.has(item.itemType)) {
        const n = parseFloat(formatted);
        if (!Number.isNaN(n)) numericValues.push(n);
      }
      if (CHOICE_TYPES.has(item.itemType)) {
        for (const v of expandValues(raw, item.itemType)) {
          values.push(v);
        }
      } else {
        values.push(formatted);
      }
    }

    const counts = new Map<string, number>();
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const responseDenom = CHOICE_TYPES.has(item.itemType) ? total : values.length;
    const distribution: ValueCount[] = [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: optionLabelForValue(options, item.id, value),
        count,
        percent: responseDenom > 0 ? Math.round((count / responseDenom) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      fieldId: item.id,
      label: item.label,
      itemType: item.itemType,
      responseCount: total - emptyCount,
      emptyCount,
      uniqueCount: counts.size,
      distribution: distribution.slice(0, 50),
      numericStats: computeNumericStats(numericValues),
    };
  });
}

export function computeCrossTab(
  items: FormFieldMeta[],
  options: FormOptionMeta[],
  submissions: ParsedSubmission[],
  rowFieldId: number,
  colFieldId: number,
): CrossTabResult | null {
  const rowItem = items.find(i => i.id === rowFieldId);
  const colItem = items.find(i => i.id === colFieldId);
  if (!rowItem || !colItem) return null;

  const cellMap = new Map<string, number>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  let total = 0;

  for (const sub of submissions) {
    const rowVals = expandValues(sub.responses[String(rowFieldId)], rowItem.itemType);
    const colVals = expandValues(sub.responses[String(colFieldId)], colItem.itemType);
    if (rowVals.length === 0 || colVals.length === 0) continue;
    for (const rv of rowVals) {
      for (const cv of colVals) {
        const key = `${rv}\0${cv}`;
        cellMap.set(key, (cellMap.get(key) ?? 0) + 1);
        rowSet.add(rv);
        colSet.add(cv);
        total++;
      }
    }
  }

  const rowValues = [...rowSet].sort();
  const colValues = [...colSet].sort();
  const cells: CrossTabCell[] = [];
  for (const rv of rowValues) {
    for (const cv of colValues) {
      const count = cellMap.get(`${rv}\0${cv}`) ?? 0;
      cells.push({
        rowValue: rv,
        colValue: cv,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      });
    }
  }

  return {
    rowFieldId,
    rowLabel: rowItem.label,
    colFieldId,
    colLabel: colItem.label,
    rowValues: rowValues.map(v => optionLabelForValue(options, rowFieldId, v)),
    colValues: colValues.map(v => optionLabelForValue(options, colFieldId, v)),
    cells: cells.map(c => ({
      ...c,
      rowValue: optionLabelForValue(options, rowFieldId, c.rowValue),
      colValue: optionLabelForValue(options, colFieldId, c.colValue),
    })),
    total,
  };
}

/**
 * Compute cross-tabulation for one row field against multiple column fields.
 * Returns a MultiCrossTabResult containing one CrossTabResult per colFieldId,
 * allowing the UI to render each comparison as a separate chart (bar, stacked
 * bar, pie, donut, heatmap).
 */
export function computeMultiCrossTab(
  items: FormFieldMeta[],
  options: FormOptionMeta[],
  submissions: ParsedSubmission[],
  rowFieldId: number,
  colFieldIds: number[],
): MultiCrossTabResult | null {
  const rowItem = items.find(i => i.id === rowFieldId);
  if (!rowItem) return null;
  const comparisons: CrossTabResult[] = [];
  for (const colFieldId of colFieldIds) {
    const result = computeCrossTab(items, options, submissions, rowFieldId, colFieldId);
    if (result) comparisons.push(result);
  }
  return {
    rowFieldId,
    rowLabel: rowItem.label,
    comparisons,
  };
}

export type MultiFormFieldCompare = {
  formId: number;
  formName: string;
  fieldId: number | null;
  fieldLabel: string;
  totalSubmissions: number;
  distribution: ValueCount[];
};

export function compareFieldAcrossForms(
  forms: Array<{
    formId: number;
    formName: string;
    items: FormFieldMeta[];
    options: FormOptionMeta[];
    submissions: ParsedSubmission[];
  }>,
  fieldLabel: string,
): MultiFormFieldCompare[] {
  const normalized = fieldLabel.trim().toLowerCase();
  return forms.map(form => {
    const item = form.items.find(i => i.label.trim().toLowerCase() === normalized);
    if (!item) {
      return {
        formId: form.formId,
        formName: form.formName,
        fieldId: null,
        fieldLabel,
        totalSubmissions: form.submissions.length,
        distribution: [],
      };
    }
    const analytics = computeFieldAnalytics([item], form.options, form.submissions);
    return {
      formId: form.formId,
      formName: form.formName,
      fieldId: item.id,
      fieldLabel: item.label,
      totalSubmissions: form.submissions.length,
      distribution: analytics[0]?.distribution ?? [],
    };
  });
}

export function buildReportPublicUrl(token: string, mode: "full" | "table" | "charts" | "embed" = "full"): string {
  const base = `/reports/analytics/${token}`;
  if (mode === "embed") return `${base}/embed`;
  if (mode === "table") return `${base}?view=table`;
  if (mode === "charts") return `${base}?view=charts`;
  return base;
}

export function buildDashboardPublicUrl(token: string, embed = false): string {
  return embed ? `/reports/dashboard/${token}/embed` : `/reports/dashboard/${token}`;
}
