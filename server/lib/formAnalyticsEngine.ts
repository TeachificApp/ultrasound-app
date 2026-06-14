/**
 * Server-side helpers to load form data and run analytics aggregations.
 */
import {
  generalFormTemplates,
  generalFormItems,
  generalFormOptions,
  generalFormSubmissions,
  globalFormTheme,
} from "../../drizzle/schema";
import { eq, asc, inArray } from "drizzle-orm";
import {
  parseResultsSettings,
  type SavedResultsFilter,
} from "../../shared/formItemUtils";
import {
  parseFormAnalyticsSettings,
  parseGlobalAnalyticsSettings,
  mergeGlobalAnalyticsSettings,
  parseSubmissions,
  filterSubmissions,
  computeFieldAnalytics,
  computeCrossTab,
  computeMultiCrossTab,
  compareFieldAcrossForms,
  type FormFieldMeta,
  type FormOptionMeta,
  type AnalyticsReportConfig,
  type AnalyticsDashboardConfig,
  type GlobalAnalyticsSettings,
} from "../../shared/formAnalyticsUtils";

type DbConn = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export async function loadFormAnalyticsBundle(
  db: DbConn,
  templateId: number,
  filterId?: string,
) {
  const [template] = await db
    .select()
    .from(generalFormTemplates)
    .where(eq(generalFormTemplates.id, templateId))
    .limit(1);
  if (!template) return null;

  const items = await db
    .select({
      id: generalFormItems.id,
      label: generalFormItems.label,
      itemType: generalFormItems.itemType,
      sortOrder: generalFormItems.sortOrder,
      extraConfig: generalFormItems.extraConfig,
    })
    .from(generalFormItems)
    .where(eq(generalFormItems.templateId, templateId))
    .orderBy(asc(generalFormItems.sortOrder));

  const itemIds = items.map(i => i.id);
  const options =
    itemIds.length > 0
      ? await db
          .select({
            itemId: generalFormOptions.itemId,
            label: generalFormOptions.label,
            value: generalFormOptions.value,
            sortOrder: generalFormOptions.sortOrder,
          })
          .from(generalFormOptions)
          .where(inArray(generalFormOptions.itemId, itemIds))
          .orderBy(asc(generalFormOptions.sortOrder))
      : [];

  const rawSubs = await db
    .select({
      id: generalFormSubmissions.id,
      responses: generalFormSubmissions.responses,
      submittedAt: generalFormSubmissions.submittedAt,
      score: generalFormSubmissions.score,
      status: generalFormSubmissions.status,
    })
    .from(generalFormSubmissions)
    .where(eq(generalFormSubmissions.templateId, templateId));

  const resultsSettings = parseResultsSettings(template.themeSettings);
  const filter: SavedResultsFilter | undefined = filterId
    ? resultsSettings.savedFilters.find(f => f.id === filterId)
    : undefined;

  const filteredRows = filterSubmissions(rawSubs, filter);
  const submissions = parseSubmissions(filteredRows);

  return {
    template,
    items: items as FormFieldMeta[],
    options: options as FormOptionMeta[],
    submissions,
    resultsSettings,
    analyticsSettings: parseFormAnalyticsSettings(template.themeSettings),
  };
}

export async function getGlobalAnalyticsSettings(db: DbConn): Promise<GlobalAnalyticsSettings> {
  const rows = await db.select().from(globalFormTheme).limit(1);
  return parseGlobalAnalyticsSettings(rows[0]?.themeSettings ?? null);
}

export async function persistGlobalAnalyticsSettings(
  db: DbConn,
  settings: GlobalAnalyticsSettings,
): Promise<void> {
  const rows = await db.select().from(globalFormTheme).limit(1);
  const themeJson = mergeGlobalAnalyticsSettings(rows[0]?.themeSettings ?? null, settings);
  if (rows[0]) {
    await db
      .update(globalFormTheme)
      .set({ themeSettings: themeJson })
      .where(eq(globalFormTheme.id, rows[0].id));
  } else {
    await db.insert(globalFormTheme).values({ themeSettings: themeJson });
  }
}

export async function resolveReportByToken(db: DbConn, token: string) {
  const global = await getGlobalAnalyticsSettings(db);
  const entry = global.reportIndex[token];
  if (!entry) return null;

  const reportFilterId = (await loadFormAnalyticsBundle(db, entry.formId))?.analyticsSettings.reports.find(
    r => r.id === entry.reportId,
  )?.filterId;

  const bundle = await loadFormAnalyticsBundle(db, entry.formId, reportFilterId);
  if (!bundle) return null;

  const report = bundle.analyticsSettings.reports.find(r => r.id === entry.reportId);
  if (!report) return null;

  return { report, ...bundle };
}

export async function resolveDashboardByToken(db: DbConn, token: string) {
  const global = await getGlobalAnalyticsSettings(db);
  const dashboardId = global.dashboardIndex[token];
  if (!dashboardId) return null;
  return global.dashboards.find(d => d.id === dashboardId) ?? null;
}

export function buildDeepAnalyticsPayload(
  items: FormFieldMeta[],
  options: FormOptionMeta[],
  submissions: ReturnType<typeof parseSubmissions>,
  crossTabRowFieldId?: number,
  crossTabColFieldId?: number,
  crossTabColFieldIds?: number[],
) {
  const fieldAnalytics = computeFieldAnalytics(items, options, submissions);
  const crossTab =
    crossTabRowFieldId && crossTabColFieldId
      ? computeCrossTab(items, options, submissions, crossTabRowFieldId, crossTabColFieldId)
      : null;
  const multiCrossTab =
    crossTabRowFieldId && crossTabColFieldIds && crossTabColFieldIds.length > 0
      ? computeMultiCrossTab(items, options, submissions, crossTabRowFieldId, crossTabColFieldIds)
      : null;

  return {
    totalSubmissions: submissions.length,
    fieldAnalytics,
    crossTab,
    multiCrossTab,
  };
}

export async function loadMultiFormCompare(
  db: DbConn,
  formIds: number[],
  fieldLabel: string,
) {
  const forms = await Promise.all(
    formIds.map(async formId => {
      const bundle = await loadFormAnalyticsBundle(db, formId);
      if (!bundle) return null;
      return {
        formId,
        formName: bundle.template.name,
        items: bundle.items,
        options: bundle.options,
        submissions: bundle.submissions,
      };
    }),
  );
  return compareFieldAcrossForms(
    forms.filter((f): f is NonNullable<typeof f> => f !== null),
    fieldLabel,
  );
}

export async function rebuildReportIndexForForm(
  db: DbConn,
  formId: number,
  reports: AnalyticsReportConfig[],
): Promise<GlobalAnalyticsSettings> {
  const global = await getGlobalAnalyticsSettings(db);
  const nextIndex = { ...global.reportIndex };
  for (const [key, val] of Object.entries(nextIndex)) {
    if (val.formId === formId) delete nextIndex[key];
  }
  for (const report of reports) {
    nextIndex[report.token] = { formId, reportId: report.id };
  }
  return { ...global, reportIndex: nextIndex };
}

export function syncDashboardIndex(
  dashboards: AnalyticsDashboardConfig[],
): Record<string, string> {
  const index: Record<string, string> = {};
  for (const d of dashboards) {
    index[d.token] = d.id;
  }
  return index;
}
