/**
 * generalFormRouter.ts
 * General-purpose Form Builder — completely separate from the DIY Accreditation formBuilderRouter.
 *
 * Admin procedures (protectedProcedure + admin guard):
 *   listForms, getForm, createForm, updateForm, deleteForm, duplicateForm
 *   importFormByUrl (AI-scaffolds questions from a URL)
 *   updateSlug, updateTheme, updateSettings
 *   sections: createSection, updateSection, deleteSection, reorderSections
 *   items: createItem, updateItem, deleteItem, reorderItems
 *   options: replaceOptions
 *   branchRules: saveBranchRules
 *   analytics: getFormAnalytics
 *   submissions: listSubmissions, getSubmission, updateSubmissionStatus, deleteSubmission, exportSubmissions
 *
 * Public procedures (publicProcedure — no auth):
 *   getPublicForm (by slug)
 *   submitForm
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  generalFormTemplates,
  generalFormSections,
  generalFormItems,
  generalFormOptions,
  generalFormBranchRules,
  generalFormSubmissions,
  globalFormTheme,
  googleFormIntegrations,
    generalFormWebhooks,
  users,
  generalFormSuccessModules,
  generalFormSuccessRoutingRules,
  generalFormEmbedWidgets,
  generalFormEmbedAnalytics,
  generalFormProgressEvents,
} from "../../drizzle/schema";
import { eq, desc, asc, and, sql, like, count, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { addToEmailList, addToAllContacts } from "../lib/emailListHelper";
import { sendEmail } from "../_core/email";
import {
  ensureLegacySuccessModules,
  fetchSuccessModules,
  fetchSuccessRoutingRules,
  clearDefaultIfDeleted,
  deleteSuccessDataForForm,
  copySuccessModulesForDuplicate,
  copySuccessRoutingRulesForDuplicate,
  buildModuleIdMapForDuplicate,
} from "../lib/formSuccessModulesDb";
import {
  selectSuccessModule,
  selectSuccessModuleWithRule,
  buildSuccessOutcome,
  extractSubmitterInfo,
  type FormSubmissionContext,
} from "../lib/formSuccessRouting";
import { ensureEmbedWidget, deleteEmbedDataForForm, parseAllowedDomains } from "../lib/formEmbedWidgetDb";
import { parseEmbedSettings } from "@shared/formEmbedWidgetTypes";
import { getEmbedAnalyticsSummary } from "../routes/formEmbedRoutes";
import {
  isAdminOnlyItem,
  parseResultsSettings,
  mergeResultsSettingsIntoTheme,
  type FormResultsSettings,
} from "../../shared/formItemUtils";
import {
  parseFormAnalyticsSettings,
  mergeFormAnalyticsIntoTheme,
  type AnalyticsReportConfig,
  type AnalyticsDashboardConfig,
} from "../../shared/formAnalyticsUtils";
import {
  loadFormAnalyticsBundle,
  buildDeepAnalyticsPayload,
  getGlobalAnalyticsSettings,
  persistGlobalAnalyticsSettings,
  resolveReportByToken,
  resolveDashboardByToken,
  loadMultiFormCompare,
  rebuildReportIndexForForm,
  syncDashboardIndex,
} from "../lib/formAnalyticsEngine";
import { randomBytes } from "crypto";
import {
  fireFormWebhook,
  fireConfiguredFormActions,
  sendFormNotifyEmail,
} from "../lib/generalFormActions";
import { createFormStripeCheckout } from "../lib/formStripeCheckout";
import { applyAccessGrantActions } from "../lib/formAccessGrant";

type DbConn = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function stripAdminOnlyFromResponses(
  db: DbConn,
  templateId: number,
  responsesJson: string,
): Promise<string> {
  const items = await db
    .select({ id: generalFormItems.id, extraConfig: generalFormItems.extraConfig })
    .from(generalFormItems)
    .where(eq(generalFormItems.templateId, templateId));
  const adminIds = new Set(items.filter(isAdminOnlyItem).map(i => i.id.toString()));
  if (adminIds.size === 0) return responsesJson;
  const responses = JSON.parse(responsesJson) as Record<string, unknown>;
  for (const id of adminIds) delete responses[id];
  return JSON.stringify(responses);
}

// ─── Guard ────────────────────────────────────────────────────────────────────
async function requireAdmin(ctx: any) {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ─── Slug generator ───────────────────────────────────────────────────────────
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80)
    + "-" + Math.random().toString(36).substring(2, 7);
}

// ─── Embedded form detector ─────────────────────────────────────────────────
/**
 * Fetches the raw HTML of a page and looks for embedded form widgets.
 * Returns the canonical form URL if an embedded form is detected.
 * Supports: Typeform (data-tf-widget, iframe), JotForm (data-jotform-id, iframe),
 * Cognito Forms (iframe), Wufoo (iframe), Formstack (iframe), Gravity Forms (native HTML).
 */
async function detectEmbeddedFormUrl(pageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormImporter/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Typeform: data-tf-widget="FORMID" or data-tf-live="FORMID" or iframe src containing typeform.com/to/
    const tfWidget = html.match(/data-tf-(?:widget|live|popup|sidetab|slider)=["']([A-Za-z0-9]+)["']/i);
    if (tfWidget) return `https://form.typeform.com/to/${tfWidget[1]}`;
    const tfIframe = html.match(/src=["'][^"']*typeform\.com\/to\/([A-Za-z0-9]+)[^"']*["']/i);
    if (tfIframe) return `https://form.typeform.com/to/${tfIframe[1]}`;

    // JotForm: data-jotform-id or iframe src
    const jfAttr = html.match(/data-jotform-id=["']([0-9]+)["']/i);
    if (jfAttr) return `https://form.jotform.com/${jfAttr[1]}`;
    const jfIframe = html.match(/src=["'][^"']*jotform\.com\/(?:form\/)?([0-9]+)[^"']*["']/i);
    if (jfIframe) return `https://form.jotform.com/${jfIframe[1]}`;

    // Cognito Forms: iframe src containing cognitoforms.com
    const cogIframe = html.match(/src=["']([^"']*cognitoforms\.com[^"']*)["']/i);
    if (cogIframe) return cogIframe[1];

    // Wufoo: iframe src containing wufoo.com
    const wufooIframe = html.match(/src=["']([^"']*wufoo\.com\/forms\/[^"']+)["']/i);
    if (wufooIframe) return wufooIframe[1];

    // Formstack: iframe src containing formstack.com
    const fsIframe = html.match(/src=["']([^"']*formstack\.com\/forms[^"']+)["']/i);
    if (fsIframe) return fsIframe[1];

    // Gravity Forms / native HTML form on the same page — return null to use HTML scraping
    return null;
  } catch {
    return null;
  }
}

// ─── Typeform URL detector & API importer ────────────────────────────────────
function extractTypeformId(url: string): string | null {
  try {
    const u = new URL(url);
    // Matches: typeform.com/to/FORMID or *.typeform.com/to/FORMID
    const m = u.pathname.match(/\/to\/([A-Za-z0-9]+)/);
    if (m && (u.hostname.endsWith('typeform.com'))) return m[1];
  } catch {}
  return null;
}

/** Map Typeform field type → internal itemType */
function tfTypeToItemType(type: string): string {
  const map: Record<string, string> = {
    short_text: 'short_text', long_text: 'long_text', email: 'email', phone_number: 'phone',
    number: 'number', multiple_choice: 'radio', picture_choice: 'radio', dropdown: 'dropdown',
    date: 'date', file_upload: 'file', signature: 'signature', opinion_scale: 'scale',
    rating: 'scale', yes_no: 'radio', statement: 'heading', group: 'heading',
    website: 'short_text', payment: 'number',
  };
  return map[type] || 'short_text';
}

/** Map Typeform op → internal operator */
function tfOpToOperator(op: string): string {
  const map: Record<string, string> = {
    is: 'equals', is_not: 'not_equals', contains: 'contains', not_contains: 'not_contains',
    lower_than: 'less_than', greater_than: 'greater_than',
    lower_equal_than: 'less_than', greater_equal_than: 'greater_than',
    equal: 'equals', not_equal: 'not_equals', always: 'always',
  };
  return map[op] || 'equals';
}

interface TFParsed {
  name: string;
  description: string;
  sections: Array<{ title: string; items: any[] }>;
  branchRules: any[];
  variables: Record<string, number>;
}

async function fetchAndParseTypeform(formId: string): Promise<TFParsed> {
  const resp = await fetch(`https://api.typeform.com/forms/${formId}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Typeform API returned ${resp.status}`);
  const tf = await resp.json() as any;

  // Build a ref→field_key map (use ref as field_key)
  const refToKey: Record<string, string> = {};
  const refToChoiceLabel: Record<string, string> = {};
  for (const f of (tf.fields ?? [])) {
    refToKey[f.ref] = f.ref;
    refToKey[f.id] = f.ref; // also map by id
    for (const c of (f.properties?.choices ?? [])) {
      refToChoiceLabel[c.ref] = c.label;
    }
  }

  // Convert fields to items
  const items: any[] = [];
  for (const f of (tf.fields ?? [])) {
    const itemType = tfTypeToItemType(f.type);
    const options = (f.properties?.choices ?? []).map((c: any) => ({
      label: c.label, value: c.ref, scoreValue: 0,
    }));
    // yes_no special case
    if (f.type === 'yes_no') {
      options.push({ label: 'Yes', value: 'yes', scoreValue: 0 });
      options.push({ label: 'No', value: 'no', scoreValue: 0 });
    }
    items.push({
      field_key: f.ref,
      itemType,
      label: f.title || f.ref,
      placeholder: f.properties?.placeholder || '',
      helpText: f.properties?.description || '',
      isRequired: f.validations?.required ?? false,
      scoreWeight: 0,
      minValue: f.validations?.min_value ?? null,
      maxValue: f.validations?.max_value ?? null,
      extraConfig: '',
      emailRoutingRules: '',
      options,
    });
  }

  // Add variable summary as a paragraph block if variables exist
  const vars = tf.variables ?? {};
  const varNames = Object.keys(vars);
  if (varNames.length > 0) {
    const formulaDesc = varNames.map(v => `${v} (starts at ${vars[v]})`).join(', ');
    items.push({
      field_key: '__variables__',
      itemType: 'paragraph',
      label: 'Score Variables',
      placeholder: '', helpText: '', isRequired: false, scoreWeight: 0, minValue: null, maxValue: null,
      extraConfig: JSON.stringify({ formula: varNames.join(' + '), description: `Calculated variables: ${formulaDesc}` }),
      emailRoutingRules: '',
      options: [],
    });
  }

  // Convert logic to branchRules
  const branchRules: any[] = [];
  for (const rule of (tf.logic ?? [])) {
    const sourceKey = refToKey[rule.ref];
    if (!sourceKey) continue;
    for (const action of (rule.actions ?? [])) {
      if (action.action === 'jump') {
        const targetKey = refToKey[action.details?.to?.value] || action.details?.to?.value;
        if (!targetKey) continue;
        const cond = action.condition;
        const op = cond?.op || 'always';
        if (op === 'always') {
          // unconditional jump — skip_to with no condition (use a dummy always condition)
          branchRules.push({
            ruleLabel: `Skip from ${sourceKey} to ${targetKey}`,
            targetFieldKey: targetKey,
            targetType: 'item',
            action: 'skip_to',
            setValue: '',
            logicOperator: 'any',
            conditions: [{ conditionFieldKey: sourceKey, operator: 'is_not_empty', value: '' }],
          });
        } else {
          const condVar = cond?.vars?.[0];
          const condVal = cond?.vars?.[1];
          const condFieldKey = refToKey[condVar?.value] || condVar?.value || sourceKey;
          let condValue = '';
          if (condVal?.type === 'choice') condValue = refToChoiceLabel[condVal.value] || condVal.value;
          else if (condVal?.type === 'constant') condValue = String(condVal.value);
          else condValue = String(condVal?.value ?? '');
          branchRules.push({
            ruleLabel: `Jump to ${targetKey} if ${condFieldKey} ${op} ${condValue}`,
            targetFieldKey: targetKey,
            targetType: 'item',
            action: 'skip_to',
            setValue: '',
            logicOperator: 'any',
            conditions: [{ conditionFieldKey: condFieldKey, operator: tfOpToOperator(op), value: condValue }],
          });
        }
      } else if (['add', 'subtract', 'multiply', 'divide', 'set'].includes(action.action)) {
        // Calculator action — store as extraConfig on a variable paragraph item
        const targetVar = action.details?.target?.value;
        const valType = action.details?.value?.type;
        const valVal = action.details?.value?.value;
        const valFieldKey = valType === 'field' ? (refToKey[valVal] || valVal) : null;
        const formulaStr = valType === 'constant' ? `${action.action}(${targetVar}, ${valVal})` : `${action.action}(${targetVar}, field:${valFieldKey})`;
        // Find or create a paragraph item for this variable
        const existingVarItem = items.find(i => i.field_key === `__calc_${targetVar}__`);
        if (existingVarItem) {
          try {
            const ec = JSON.parse(existingVarItem.extraConfig || '{}');
            ec.formula = (ec.formula ? ec.formula + '; ' : '') + formulaStr;
            existingVarItem.extraConfig = JSON.stringify(ec);
          } catch {}
        } else {
          items.push({
            field_key: `__calc_${targetVar}__`,
            itemType: 'paragraph',
            label: `Calculation: ${targetVar}`,
            placeholder: '', helpText: '', isRequired: false, scoreWeight: 0, minValue: null, maxValue: null,
            extraConfig: JSON.stringify({ formula: formulaStr, description: `Variable ${targetVar} calculation` }),
            emailRoutingRules: '',
            options: [],
          });
        }
      }
    }
  }

  return {
    name: tf.title || 'Imported Form',
    description: tf.settings?.meta?.description || '',
    sections: [{ title: 'Imported from Typeform', items }],
    branchRules,
    variables: vars,
  };
}

// ─── Full form fetch helper ───────────────────────────────────────────────────
async function getFullForm(db: any, templateId: number) {
  const [template] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, templateId)).limit(1);
  if (!template) return null;
  const sections = await db.select().from(generalFormSections).where(eq(generalFormSections.templateId, templateId)).orderBy(asc(generalFormSections.sortOrder));
  const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, templateId)).orderBy(asc(generalFormItems.sortOrder));
  const _ids = items.map((i: any) => i.id);
  const options = _ids.length > 0
    ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, _ids)).orderBy(asc(generalFormOptions.sortOrder))
    : [];
  const branchRules = await db.select().from(generalFormBranchRules).where(eq(generalFormBranchRules.templateId, templateId));
  return { template, sections, items, options, branchRules };
}

export const generalFormRouter = router({
  // ── List ──────────────────────────────────────────────────────────────────
  listForms: protectedProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(["open", "closed", "draft", "all"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [];
      if (input.search) conditions.push(like(generalFormTemplates.name, `%${input.search}%`));
      if (input.status !== "all") conditions.push(eq(generalFormTemplates.status, input.status as any));
      const baseQuery = conditions.length > 0
        ? db.select().from(generalFormTemplates).where(and(...conditions))
        : db.select().from(generalFormTemplates);
      const [forms, [{ total }]] = await Promise.all([
        baseQuery.orderBy(desc(generalFormTemplates.updatedAt)).limit(input.pageSize).offset(offset),
        (conditions.length > 0 ? db.select({ total: count() }).from(generalFormTemplates).where(and(...conditions)) : db.select({ total: count() }).from(generalFormTemplates)),
      ]);
      // Fetch submission counts for each form
      const formIds = forms.map(f => f.id);
      let submissionCounts: Record<number, number> = {};
      if (formIds.length > 0) {
        const counts = await db.select({
          templateId: generalFormSubmissions.templateId,
          cnt: count(),
        }).from(generalFormSubmissions).where(inArray(generalFormSubmissions.templateId, formIds)).groupBy(generalFormSubmissions.templateId);
        for (const row of counts) submissionCounts[row.templateId] = Number(row.cnt);
      }
      const formsWithCounts = forms.map(f => ({ ...f, submissionCount: submissionCounts[f.id] ?? 0 }));
      return { forms: formsWithCounts, total: total as number };
    }),

  // ── Get full form ─────────────────────────────────────────────────────────
  getForm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const form = await getFullForm(db, input.id);
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      return form;
    }),

  // ── Create ────────────────────────────────────────────────────────────────
  createForm: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      formType: z.string().default("general"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const slug = generateSlug(input.name);
      const [result] = await db.insert(generalFormTemplates).values({
        name: input.name,
        description: input.description ?? null,
        formType: input.formType,
        status: "draft",
        publicSlug: slug,
        isPublic: false,
        scoreEnabled: false,
        createdByUserId: ctx.user.id,
      });
      const id = (result as any).insertId;
      // Create a default section
      await db.insert(generalFormSections).values({
        templateId: id,
        title: "Section 1",
        sortOrder: 0,
      });
      return { id };
    }),

  // ── Update ────────────────────────────────────────────────────────────────
  updateForm: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      formType: z.string().optional(),
      status: z.enum(["open", "closed", "draft"]).optional(),
      isPublic: z.boolean().optional(),
      scoreEnabled: z.boolean().optional(),
      scoreLabel: z.string().optional(),
      successMessage: z.string().optional(),
      successRedirectUrl: z.string().optional(),
      notifyEmail: z.string().optional(),
      maxSubmissions: z.number().optional(),
      openAt: z.string().optional(),
      closeAt: z.string().optional(),
      hostDomain: z.string().optional(),
      displayMode: z.enum(["classic", "typeform", "paginated", "inline"]).optional(),
      welcomeTitle: z.string().optional(),
      welcomeSubtitle: z.string().optional(),
      welcomeButtonText: z.string().optional(),
      welcomeImageUrl: z.string().optional(),
      submitButtonText: z.string().optional(),
      emailListId: z.number().nullable().optional(),
      // Stripe checkout settings
      stripeEnabled: z.boolean().optional(),
      stripeCheckoutMode: z.enum(["payment", "subscription"]).optional(),
      stripePriceId: z.string().nullable().optional(),
      stripeAmount: z.number().nullable().optional(),
      stripeSuccessUrl: z.string().nullable().optional(),
      stripeCancelUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, openAt, closeAt, ...rest } = input;
      const updates: any = { ...rest, updatedAt: new Date() };
      if (openAt !== undefined) updates.openAt = openAt ? new Date(openAt) : null;
      if (closeAt !== undefined) updates.closeAt = closeAt ? new Date(closeAt) : null;
      await db.update(generalFormTemplates).set(updates).where(eq(generalFormTemplates.id, id));
      return { success: true };
    }),

  // ── Update slug ───────────────────────────────────────────────────────────
  updateSlug: protectedProcedure
    .input(z.object({
      id: z.number(),
      slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check uniqueness
      const [existing] = await db.select({ id: generalFormTemplates.id }).from(generalFormTemplates)
        .where(and(eq(generalFormTemplates.publicSlug, input.slug), sql`${generalFormTemplates.id} != ${input.id}`)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "This slug is already in use by another form." });
      await db.update(generalFormTemplates).set({ publicSlug: input.slug, updatedAt: new Date() }).where(eq(generalFormTemplates.id, input.id));
      return { success: true };
    }),

  // ── Update theme ──────────────────────────────────────────────────────────
  updateTheme: protectedProcedure
    .input(z.object({
      id: z.number(),
      themeSettings: z.string(), // JSON string
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db
        .select({ themeSettings: generalFormTemplates.themeSettings })
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, input.id))
        .limit(1);
      const preserved = parseResultsSettings(existing?.themeSettings ?? null);
      const merged = mergeResultsSettingsIntoTheme(input.themeSettings, preserved);
      await db
        .update(generalFormTemplates)
        .set({ themeSettings: merged, updatedAt: new Date() })
        .where(eq(generalFormTemplates.id, input.id));
      return { success: true };
    }),

  // ── Delete ────────────────────────────────────────────────────────────────
  deleteForm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Cascade delete
      const items = await db.select({ id: generalFormItems.id }).from(generalFormItems).where(eq(generalFormItems.templateId, input.id));
      if (items.length > 0) {
        await db.delete(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id)));
      }
      await db.delete(generalFormItems).where(eq(generalFormItems.templateId, input.id));
      await db.delete(generalFormSections).where(eq(generalFormSections.templateId, input.id));
      await db.delete(generalFormBranchRules).where(eq(generalFormBranchRules.templateId, input.id));
      await db.delete(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, input.id));
      await deleteEmbedDataForForm(db, input.id);
      await deleteSuccessDataForForm(db, input.id);
      await db.delete(generalFormTemplates).where(eq(generalFormTemplates.id, input.id));
      return { success: true };
    }),

  // ── Duplicate ─────────────────────────────────────────────────────────────
  duplicateForm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const form = await getFullForm(db, input.id);
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      const slug = generateSlug(form.template.name + " copy");
      const [newTpl] = await db.insert(generalFormTemplates).values({
        ...form.template, id: undefined as any, name: form.template.name + " (Copy)", publicSlug: slug, status: "draft", createdAt: undefined as any, updatedAt: undefined as any, createdByUserId: ctx.user.id,
      });
      const newId = (newTpl as any).insertId;
      const sectionIdMap: Record<number, number> = {};
      for (const s of form.sections) {
        const [ns] = await db.insert(generalFormSections).values({ ...s, id: undefined as any, templateId: newId, createdAt: undefined as any });
        sectionIdMap[s.id] = (ns as any).insertId;
      }
      const itemIdMap: Record<number, number> = {};
      for (const item of form.items) {
        const [ni] = await db.insert(generalFormItems).values({ ...item, id: undefined as any, templateId: newId, sectionId: sectionIdMap[item.sectionId] ?? item.sectionId, createdAt: undefined as any });
        itemIdMap[item.id] = (ni as any).insertId;
      }
      for (const opt of form.options) {
        await db.insert(generalFormOptions).values({ ...opt, id: undefined as any, itemId: itemIdMap[opt.itemId] ?? opt.itemId, createdAt: undefined as any });
      }
      const [embedWidget] = await db.select().from(generalFormEmbedWidgets).where(eq(generalFormEmbedWidgets.templateId, input.id)).limit(1);
      if (embedWidget) {
        const { randomUUID } = await import("crypto");
        await db.insert(generalFormEmbedWidgets).values({
          templateId: newId,
          widgetKey: randomUUID().replace(/-/g, ""),
          name: embedWidget.name,
          isEnabled: embedWidget.isEnabled,
          displayType: embedWidget.displayType,
          settingsJson: embedWidget.settingsJson,
          domainMode: embedWidget.domainMode,
          allowedDomains: embedWidget.allowedDomains,
        });
      }
      // Copy success modules and routing rules
      const moduleIdMap = await buildModuleIdMapForDuplicate(db, input.id, newId);
      await copySuccessRoutingRulesForDuplicate(db, input.id, newId, moduleIdMap);
      return { id: newId };
    }),

  // ── Import by URL (AI scaffold) ───────────────────────────────────────────
  importFormByUrl: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      formName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // ── Embedded form detection: resolve the actual form URL if page embeds a widget ──
      let resolvedUrl = input.url;
      const embeddedUrl = await detectEmbeddedFormUrl(input.url);
      if (embeddedUrl) resolvedUrl = embeddedUrl;

      // ── Typeform fast-path: use public API instead of scraping ──────────────
      const typeformId = extractTypeformId(resolvedUrl);
      if (typeformId) {
        let tfParsed: TFParsed;
        try {
          tfParsed = await fetchAndParseTypeform(typeformId);
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Typeform API error: ${e.message}` });
        }
        const formName = input.formName || tfParsed.name;
        const slug = generateSlug(formName);
        const [newTpl] = await db.insert(generalFormTemplates).values({
          name: formName, description: tfParsed.description ?? null, formType: "general", status: "draft",
          publicSlug: slug, isPublic: false, scoreEnabled: Object.keys(tfParsed.variables).length > 0,
          importedFromUrl: input.url, createdByUserId: ctx.user.id,
        });
        const newId = (newTpl as any).insertId;
        const fieldKeyToItemId: Record<string, number> = {};
        let sortOrder = 0;
        for (const section of tfParsed.sections) {
          const [ns] = await db.insert(generalFormSections).values({ templateId: newId, title: section.title, sortOrder: sortOrder++ });
          const sectionId = (ns as any).insertId;
          let itemOrder = 0;
          for (const item of section.items) {
            const [ni] = await db.insert(generalFormItems).values({
              templateId: newId, sectionId,
              itemType: item.itemType || "short_text",
              label: item.label || "Field",
              placeholder: item.placeholder || null,
              helpText: item.helpText || null,
              isRequired: item.isRequired ?? false,
              scoreWeight: item.scoreWeight ?? 0,
              minValue: item.minValue ?? null,
              maxValue: item.maxValue ?? null,
              extraConfig: item.extraConfig && item.extraConfig !== "" ? item.extraConfig : null,
              richTextContent: item.itemType === "paragraph" && item.extraConfig
                ? `<p><em>${(() => { try { const ec = JSON.parse(item.extraConfig); return ec.description || ec.formula || ""; } catch { return ""; } })()}</em></p>`
                : null,
              sortOrder: itemOrder++,
            });
            const itemId = (ni as any).insertId;
            if (item.field_key) fieldKeyToItemId[item.field_key] = itemId;
            if (item.options?.length > 0) {
              let optOrder = 0;
              for (const opt of item.options) {
                await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, scoreValue: opt.scoreValue ?? 0, sortOrder: optOrder++ });
              }
            }
          }
        }
        // Insert branch rules
        let branchOrder = 0;
        for (const rule of tfParsed.branchRules) {
          const targetId = fieldKeyToItemId[rule.targetFieldKey];
          if (!targetId) continue;
          const conditions = (rule.conditions ?? []).map((c: any) => ({
            fieldId: String(fieldKeyToItemId[c.conditionFieldKey] ?? 0),
            operator: c.operator || "equals",
            value: c.value || "",
          })).filter((c: any) => c.fieldId !== "0");
          if (conditions.length === 0) continue;
          await db.insert(generalFormBranchRules).values({
            templateId: newId, ruleLabel: rule.ruleLabel || "",
            targetType: "item", targetId,
            action: rule.action || "skip_to",
            setValue: rule.setValue || "",
            logicOperator: rule.logicOperator || "any",
            conditions: JSON.stringify(conditions),
            sortOrder: branchOrder++, isEnabled: true,
          });
        }
        return { id: newId, name: formName };
      }

      // ── Generic HTML scrape path ─────────────────────────────────────────────
      // Fetch page content — preserve structural HTML hints before stripping
      let pageText = "";
      try {
        const res = await fetch(resolvedUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FormImporter/1.0)" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
        const html = await res.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<(label|legend|h[1-6]|p|li|option|th|td)[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/\s+/g, " ").trim().substring(0, 6000);
      } catch {
        pageText = `Form from: ${resolvedUrl}`;
      }
      // AI scaffold with rich field metadata + branching + calculations
      const systemPrompt = `You are a form builder assistant. Given a web page or form description, extract or infer ALL form fields, their types, options, conditional/branching logic, scoring, and any calculated/computed fields. Return structured JSON exactly matching the schema provided.

For branching rules: reference fields by their field_key.
For calculated fields: use itemType "paragraph" and put the formula in extraConfig as JSON {"formula": "expression using field_key names", "description": "what it calculates"}.
For score weights: assign scoreWeight (0-100) to each scored field based on importance.
For email routing: if a field routes submissions to different emails based on answer, set emailRoutingRules as JSON array [{"label": string, "conditionFieldKey": string, "conditionValue": string, "routeTo": string}].`;
      const userPrompt = `Create a complete form from this page. Extract ALL fields, logic, calculations, and scoring. Return JSON:
{
  "name": string,
  "description": string,
  "sections": [{
    "title": string,
    "items": [{
      "field_key": string,
      "itemType": "short_text"|"long_text"|"email"|"phone"|"number"|"dropdown"|"radio"|"checkbox"|"date"|"file"|"signature"|"heading"|"paragraph"|"scale",
      "label": string,
      "placeholder": string,
      "helpText": string,
      "isRequired": boolean,
      "scoreWeight": number,
      "minValue": number|null,
      "maxValue": number|null,
      "extraConfig": string,
      "emailRoutingRules": string,
      "options": [{"label": string, "value": string, "scoreValue": number}]
    }]
  }],
  "branchRules": [{
    "ruleLabel": string,
    "targetFieldKey": string,
    "targetType": "item",
    "action": "show"|"hide"|"skip_to"|"require"|"unrequire"|"set_value",
    "setValue": string,
    "logicOperator": "any"|"all",
    "conditions": [{"conditionFieldKey": string, "operator": "equals"|"not_equals"|"contains"|"not_contains"|"greater_than"|"less_than"|"is_empty"|"is_not_empty", "value": string}]
  }]
}

IMPORTANT:
- If the form has calculated outputs (BMI, total score, risk level, etc.), create a "paragraph" item with extraConfig={"formula":"expression","description":"what it computes"}.
- If the form has score thresholds (e.g. score 0-10=low risk, 11-20=high risk), add a "paragraph" item with extraConfig={"scoreThresholds":[{"min":0,"max":10,"label":"Low Risk","description":"..."},...]}.
- Capture ALL conditional logic including skip patterns, required-if rules, and value-setting rules.
- Use scoreWeight on each field to reflect its relative importance in scoring.

Page content:
${pageText}`;
      const itemSchema = { type: "object", properties: { field_key: { type: "string" }, itemType: { type: "string" }, label: { type: "string" }, placeholder: { type: "string" }, helpText: { type: "string" }, isRequired: { type: "boolean" }, scoreWeight: { type: "number" }, minValue: { type: ["number", "null"] }, maxValue: { type: ["number", "null"] }, extraConfig: { type: "string" }, emailRoutingRules: { type: "string" }, options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, scoreValue: { type: "number" } }, required: ["label", "value", "scoreValue"], additionalProperties: false } } }, required: ["field_key", "itemType", "label", "placeholder", "helpText", "isRequired", "scoreWeight", "minValue", "maxValue", "extraConfig", "emailRoutingRules", "options"], additionalProperties: false };
      const branchSchema = { type: "object", properties: { ruleLabel: { type: "string" }, targetFieldKey: { type: "string" }, targetType: { type: "string" }, action: { type: "string" }, setValue: { type: "string" }, logicOperator: { type: "string" }, conditions: { type: "array", items: { type: "object", properties: { conditionFieldKey: { type: "string" }, operator: { type: "string" }, value: { type: "string" } }, required: ["conditionFieldKey", "operator", "value"], additionalProperties: false } } }, required: ["ruleLabel", "targetFieldKey", "targetType", "action", "setValue", "logicOperator", "conditions"], additionalProperties: false };
      const aiSchema = { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: itemSchema } }, required: ["title", "items"], additionalProperties: false } }, branchRules: { type: "array", items: branchSchema } }, required: ["name", "description", "sections", "branchRules"], additionalProperties: false };
      const aiResp = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "form_scaffold", strict: true, schema: aiSchema } },
      });
      let parsed: any;
      try {
        parsed = JSON.parse(aiResp.choices[0].message.content as string);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI failed to parse form structure" });
      }
      const formName = input.formName || parsed.name || "Imported Form";
      const slug = generateSlug(formName);
      const [newTpl] = await db.insert(generalFormTemplates).values({
        name: formName, description: parsed.description ?? null, formType: "general", status: "draft", publicSlug: slug, isPublic: false, scoreEnabled: false, importedFromUrl: input.url, createdByUserId: ctx.user.id,
      });
      const newId = (newTpl as any).insertId;
      // Track field_key → DB item ID for branch rule wiring
      const fieldKeyToItemId: Record<string, number> = {};
      let sortOrder = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(generalFormSections).values({ templateId: newId, title: section.title || "Section", sortOrder: sortOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          // Resolve emailRoutingRules: replace conditionFieldKey with real item IDs (post-insert pass below)
          const [ni] = await db.insert(generalFormItems).values({
            templateId: newId,
            sectionId,
            itemType: item.itemType || "short_text",
            label: item.label || "Field",
            placeholder: item.placeholder || null,
            helpText: item.helpText || null,
            isRequired: item.isRequired ?? false,
            scoreWeight: item.scoreWeight ?? 0,
            minValue: item.minValue ?? null,
            maxValue: item.maxValue ?? null,
            extraConfig: item.extraConfig && item.extraConfig !== "" ? item.extraConfig : null,
            richTextContent: item.itemType === "paragraph" && item.extraConfig ? `<p><em>${(() => { try { const ec = JSON.parse(item.extraConfig); return ec.description || ec.formula || ""; } catch { return ""; } })()}</em></p>` : null,
            sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.field_key) fieldKeyToItemId[item.field_key] = itemId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, scoreValue: opt.scoreValue ?? 0, sortOrder: optOrder++ });
            }
          }
          // Resolve emailRoutingRules conditionFieldKey → conditionItemId after all items inserted
          if (item.emailRoutingRules && item.emailRoutingRules !== "") {
            try {
              const rules = JSON.parse(item.emailRoutingRules);
              // Store raw for now; will be resolved in a second pass if needed
              // For now store as-is (field keys will be resolved post-loop)
            } catch {}
          }
        }
      }
      // Insert branch rules now that we have real item IDs
      let branchOrder = 0;
      for (const rule of (parsed.branchRules ?? [])) {
        const targetId = fieldKeyToItemId[rule.targetFieldKey];
        if (!targetId) continue;
        const conditions = (rule.conditions ?? []).map((c: any) => ({
          fieldId: String(fieldKeyToItemId[c.conditionFieldKey] ?? 0),
          operator: c.operator || "equals",
          value: c.value || "",
        })).filter((c: any) => c.fieldId !== "0");
        if (conditions.length === 0) continue;
        await db.insert(generalFormBranchRules).values({
          templateId: newId,
          ruleLabel: rule.ruleLabel || "",
          targetType: rule.targetType || "item",
          targetId,
          action: rule.action || "show",
          setValue: rule.setValue || "",
          logicOperator: rule.logicOperator || "any",
          conditions: JSON.stringify(conditions),
          sortOrder: branchOrder++,
          isEnabled: true,
        });
      }
      return { id: newId, name: formName };
    }),

  // ── Append fields from URL (AI scaffold into existing form) ──────────────
  appendFieldsFromUrl: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      url: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // ── Embedded form detection ─────────────────────────────────────────────────────
      let resolvedUrlAppend = input.url;
      const embeddedUrlAppend = await detectEmbeddedFormUrl(input.url);
      if (embeddedUrlAppend) resolvedUrlAppend = embeddedUrlAppend;

      // ── Typeform fast-path ─────────────────────────────────────────────────────
      const typeformIdAppend = extractTypeformId(resolvedUrlAppend);
      if (typeformIdAppend) {
        let tfParsed: TFParsed;
        try { tfParsed = await fetchAndParseTypeform(typeformIdAppend); }
        catch (e: any) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Typeform API error: ${e.message}` }); }
        const fieldKeyToItemId: Record<string, number> = {};
        let sortOrder = 0;
        for (const section of tfParsed.sections) {
          const [ns] = await db.insert(generalFormSections).values({ templateId: input.templateId, title: section.title, sortOrder: sortOrder++ });
          const sectionId = (ns as any).insertId;
          let itemOrder = 0;
          for (const item of section.items) {
            const [ni] = await db.insert(generalFormItems).values({
              templateId: input.templateId, sectionId,
              itemType: item.itemType || "short_text",
              label: item.label || "Field",
              placeholder: item.placeholder || null,
              helpText: item.helpText || null,
              isRequired: item.isRequired ?? false,
              scoreWeight: item.scoreWeight ?? 0,
              minValue: item.minValue ?? null, maxValue: item.maxValue ?? null,
              extraConfig: item.extraConfig && item.extraConfig !== "" ? item.extraConfig : null,
              richTextContent: item.itemType === "paragraph" && item.extraConfig
                ? `<p><em>${(() => { try { const ec = JSON.parse(item.extraConfig); return ec.description || ec.formula || ""; } catch { return ""; } })()}</em></p>` : null,
              sortOrder: itemOrder++,
            });
            const itemId = (ni as any).insertId;
            if (item.field_key) fieldKeyToItemId[item.field_key] = itemId;
            if (item.options?.length > 0) {
              let optOrder = 0;
              for (const opt of item.options) {
                await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, scoreValue: opt.scoreValue ?? 0, sortOrder: optOrder++ });
              }
            }
          }
        }
        let branchOrder = 0;
        for (const rule of tfParsed.branchRules) {
          const targetId = fieldKeyToItemId[rule.targetFieldKey];
          if (!targetId) continue;
          const conditions = (rule.conditions ?? []).map((c: any) => ({ fieldId: String(fieldKeyToItemId[c.conditionFieldKey] ?? 0), operator: c.operator || "equals", value: c.value || "" })).filter((c: any) => c.fieldId !== "0");
          if (conditions.length === 0) continue;
          await db.insert(generalFormBranchRules).values({ templateId: input.templateId, ruleLabel: rule.ruleLabel || "", targetType: "item", targetId, action: rule.action || "skip_to", setValue: rule.setValue || "", logicOperator: rule.logicOperator || "any", conditions: JSON.stringify(conditions), sortOrder: branchOrder++, isEnabled: true });
        }
        return { added: tfParsed.sections.reduce((acc, s) => acc + s.items.length, 0) };
      }

      // ── Generic HTML scrape path ────────────────────────────────────────────────
      // Fetch page content — preserve structural hints
      let pageText = "";
      try {
        const res = await fetch(resolvedUrlAppend, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FormImporter/1.0)" }, signal: AbortSignal.timeout(12000), redirect: "follow" });
        const html = await res.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<(label|legend|h[1-6]|p|li|option|th|td)[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/\s+/g, " ").trim().substring(0, 6000);
      } catch {
        pageText = `Form from: ${resolvedUrlAppend}`;
      }
      // AI scaffold with rich metadata + branching + calculations
      const systemPrompt = `You are a form builder assistant. Extract ALL form fields, their types, options, placeholder text, help text, conditional/branching logic, scoring weights, and any calculated/computed fields from the page. Return structured JSON exactly matching the schema provided.

For calculated fields: use itemType "paragraph" and put the formula in extraConfig as JSON {"formula": "expression using field_key names", "description": "what it calculates"}.
For score thresholds: add a "paragraph" item with extraConfig={"scoreThresholds":[{"min":0,"max":10,"label":"Low Risk","description":"..."},...]}.
For email routing: if a field routes submissions to different emails, set emailRoutingRules as JSON array [{"label": string, "conditionFieldKey": string, "conditionValue": string, "routeTo": string}].`;
      const userPrompt = `Extract all form fields, logic, calculations, and scoring from this page. Return JSON:
{
  "sections": [{
    "title": string,
    "items": [{
      "field_key": string,
      "itemType": "short_text"|"long_text"|"email"|"phone"|"number"|"dropdown"|"radio"|"checkbox"|"date"|"file"|"signature"|"heading"|"paragraph"|"scale",
      "label": string,
      "placeholder": string,
      "helpText": string,
      "isRequired": boolean,
      "scoreWeight": number,
      "minValue": number|null,
      "maxValue": number|null,
      "extraConfig": string,
      "emailRoutingRules": string,
      "options": [{"label": string, "value": string, "scoreValue": number}]
    }]
  }],
  "branchRules": [{
    "ruleLabel": string,
    "targetFieldKey": string,
    "targetType": "item",
    "action": "show"|"hide"|"skip_to"|"require"|"unrequire"|"set_value",
    "setValue": string,
    "logicOperator": "any"|"all",
    "conditions": [{"conditionFieldKey": string, "operator": "equals"|"not_equals"|"contains"|"not_contains"|"greater_than"|"less_than"|"is_empty"|"is_not_empty", "value": string}]
  }]
}

Page content:
${pageText}`;
      const appendItemSchema = { type: "object", properties: { field_key: { type: "string" }, itemType: { type: "string" }, label: { type: "string" }, placeholder: { type: "string" }, helpText: { type: "string" }, isRequired: { type: "boolean" }, scoreWeight: { type: "number" }, minValue: { type: ["number", "null"] }, maxValue: { type: ["number", "null"] }, extraConfig: { type: "string" }, emailRoutingRules: { type: "string" }, options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" }, scoreValue: { type: "number" } }, required: ["label", "value", "scoreValue"], additionalProperties: false } } }, required: ["field_key", "itemType", "label", "placeholder", "helpText", "isRequired", "scoreWeight", "minValue", "maxValue", "extraConfig", "emailRoutingRules", "options"], additionalProperties: false };
      const appendBranchSchema = { type: "object", properties: { ruleLabel: { type: "string" }, targetFieldKey: { type: "string" }, targetType: { type: "string" }, action: { type: "string" }, setValue: { type: "string" }, logicOperator: { type: "string" }, conditions: { type: "array", items: { type: "object", properties: { conditionFieldKey: { type: "string" }, operator: { type: "string" }, value: { type: "string" } }, required: ["conditionFieldKey", "operator", "value"], additionalProperties: false } } }, required: ["ruleLabel", "targetFieldKey", "targetType", "action", "setValue", "logicOperator", "conditions"], additionalProperties: false };
      const aiSchema = { type: "object", properties: { sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: appendItemSchema } }, required: ["title", "items"], additionalProperties: false } }, branchRules: { type: "array", items: appendBranchSchema } }, required: ["sections", "branchRules"], additionalProperties: false };
      const aiResp = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "form_fields", strict: true, schema: aiSchema } },
      });
      let parsed: any;
      try {
        parsed = JSON.parse(aiResp.choices[0].message.content as string);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI failed to parse form structure" });
      }
      // Get current max sort order for sections
      const [maxSec] = await db.select({ max: sql<number>`COALESCE(MAX(sortOrder),0)` }).from(generalFormSections).where(eq(generalFormSections.templateId, input.templateId));
      let sortOrder = (maxSec?.max ?? 0) + 1;
      const fieldKeyToItemId: Record<string, number> = {};
      let addedCount = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(generalFormSections).values({ templateId: input.templateId, title: section.title || "Imported Section", sortOrder: sortOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          const [ni] = await db.insert(generalFormItems).values({
            templateId: input.templateId,
            sectionId,
            itemType: item.itemType || "short_text",
            label: item.label || "Field",
            placeholder: item.placeholder || null,
            helpText: item.helpText || null,
            isRequired: item.isRequired ?? false,
            scoreWeight: item.scoreWeight ?? 0,
            minValue: item.minValue ?? null,
            maxValue: item.maxValue ?? null,
            extraConfig: item.extraConfig && item.extraConfig !== "" ? item.extraConfig : null,
            richTextContent: item.itemType === "paragraph" && item.extraConfig ? `<p><em>${(() => { try { const ec = JSON.parse(item.extraConfig); return ec.description || ec.formula || ""; } catch { return ""; } })()}</em></p>` : null,
            sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.field_key) fieldKeyToItemId[item.field_key] = itemId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, scoreValue: opt.scoreValue ?? 0, sortOrder: optOrder++ });
            }
          }
          addedCount++;
        }
      }
      // Insert branch rules
      let branchOrder = 0;
      for (const rule of (parsed.branchRules ?? [])) {
        const targetId = fieldKeyToItemId[rule.targetFieldKey];
        if (!targetId) continue;
        const conditions = (rule.conditions ?? []).map((c: any) => ({
          fieldId: String(fieldKeyToItemId[c.conditionFieldKey] ?? 0),
          operator: c.operator || "equals",
          value: c.value || "",
        })).filter((c: any) => c.fieldId !== "0");
        if (conditions.length === 0) continue;
        await db.insert(generalFormBranchRules).values({
          templateId: input.templateId,
          ruleLabel: rule.ruleLabel || "",
          targetType: rule.targetType || "item",
          targetId,
          action: rule.action || "show",
          setValue: rule.setValue || "",
          logicOperator: rule.logicOperator || "any",
          conditions: JSON.stringify(conditions),
          sortOrder: branchOrder++,
          isEnabled: true,
        });
      }
      return { addedCount };
    }),

  // ── Sections ──────────────────────────────────────────────────────────────
  createSection: protectedProcedure
    .input(z.object({ templateId: z.number(), title: z.string().default("New Section"), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sortOrder),0)` }).from(generalFormSections).where(eq(generalFormSections.templateId, input.templateId));
      const [result] = await db.insert(generalFormSections).values({ templateId: input.templateId, title: input.title, description: input.description ?? null, sortOrder: (maxOrder?.max ?? 0) + 1 });
      return { id: (result as any).insertId };
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), isCollapsible: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      await db.update(generalFormSections).set(rest).where(eq(generalFormSections.id, id));
      return { success: true };
    }),

  deleteSection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const items = await db.select({ id: generalFormItems.id }).from(generalFormItems).where(eq(generalFormItems.sectionId, input.id));
      if (items.length > 0) {
        await db.delete(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id)));
        await db.delete(generalFormItems).where(eq(generalFormItems.sectionId, input.id));
      }
      await db.delete(generalFormSections).where(eq(generalFormSections.id, input.id));
      return { success: true };
    }),

  reorderSections: protectedProcedure
    .input(z.object({ templateId: z.number(), orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(generalFormSections).set({ sortOrder: i }).where(eq(generalFormSections.id, input.orderedIds[i]));
      }
      return { success: true };
    }),

  // ── Items ─────────────────────────────────────────────────────────────────
  createItem: protectedProcedure
    .input(z.object({
      templateId: z.number(), sectionId: z.number(),
      itemType: z.string().default("text"), label: z.string().default("New Question"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [maxOrder] = await db.select({ max: sql<number>`COALESCE(MAX(sortOrder),0)` }).from(generalFormItems).where(eq(generalFormItems.sectionId, input.sectionId));
      const [result] = await db.insert(generalFormItems).values({ templateId: input.templateId, sectionId: input.sectionId, itemType: input.itemType, label: input.label, sortOrder: (maxOrder?.max ?? 0) + 1 });
      return { id: (result as any).insertId };
    }),

  updateItem: protectedProcedure
    .input(z.object({
      id: z.number(), label: z.string().optional(), helpText: z.string().optional(),
      placeholder: z.string().optional(), isRequired: z.boolean().optional(),
      scoreWeight: z.number().optional(), richTextContent: z.string().optional(),
      validationRegex: z.string().optional(), minValue: z.number().optional(),
      maxValue: z.number().optional(), extraConfig: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      const updates = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (Object.keys(updates).length > 0) await db.update(generalFormItems).set(updates).where(eq(generalFormItems.id, id));
      return { success: true };
    }),

  deleteItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormOptions).where(eq(generalFormOptions.itemId, input.id));
      await db.delete(generalFormItems).where(eq(generalFormItems.id, input.id));
      return { success: true };
    }),

  reorderItems: protectedProcedure
    .input(z.object({ sectionId: z.number(), orderedIds: z.array(z.number()), templateId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(generalFormItems).set({ sortOrder: i }).where(eq(generalFormItems.id, input.orderedIds[i]));
      }
      return { success: true };
    }),

  // ── Options ───────────────────────────────────────────────────────────────
  replaceOptions: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      options: z.array(z.object({ label: z.string(), value: z.string(), scoreValue: z.number().default(0) })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormOptions).where(eq(generalFormOptions.itemId, input.itemId));
      if (input.options.length > 0) {
        await db.insert(generalFormOptions).values(input.options.map((o, i) => ({ itemId: input.itemId, label: o.label, value: o.value, scoreValue: o.scoreValue, sortOrder: i })));
      }
      return { success: true };
    }),

  // ── Branch rules ──────────────────────────────────────────────────────────
  saveBranchRules: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      rules: z.array(z.object({
        id: z.number().optional(),
        targetType: z.string().default("item"),
        targetId: z.number(),
        action: z.string().default("show"),
        logicOperator: z.string().default("any"),
        conditions: z.string(), // JSON
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormBranchRules).where(eq(generalFormBranchRules.templateId, input.templateId));
      if (input.rules.length > 0) {
        await db.insert(generalFormBranchRules).values(input.rules.map(r => ({
          templateId: input.templateId, targetType: r.targetType, targetId: r.targetId,
          action: r.action, logicOperator: r.logicOperator, conditions: r.conditions,
        })));
      }
      return { success: true };
    }),

  getBranchRules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(generalFormBranchRules)
        .where(eq(generalFormBranchRules.templateId, input.templateId))
        .orderBy(asc(generalFormBranchRules.sortOrder));
    }),

  upsertBranchRule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      templateId: z.number(),
      ruleLabel: z.string().default(""),
      targetType: z.enum(["item", "section"]).default("item"),
      targetId: z.number(),
      action: z.enum(["show", "hide", "require", "unrequire"]).default("show"),
      logicOperator: z.enum(["all", "any"]).default("all"),
      conditions: z.string(), // JSON array of {fieldId, operator, value}
      sortOrder: z.number().default(0),
      isEnabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...rest } = input;
      if (id) {
        await db.update(generalFormBranchRules).set(rest).where(eq(generalFormBranchRules.id, id));
        return { id };
      } else {
        const [result] = await db.insert(generalFormBranchRules).values(rest);
        return { id: (result as any).insertId };
      }
    }),

  deleteBranchRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormBranchRules).where(eq(generalFormBranchRules.id, input.id));
      return { success: true };
    }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  getFormAnalytics: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [{ total }] = await db.select({ total: count() }).from(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, input.id));
      const [{ avgScore }] = await db.select({ avgScore: sql<number>`AVG(score)` }).from(generalFormSubmissions).where(and(eq(generalFormSubmissions.templateId, input.id), sql`maxScore > 0`));
      const recentSubmissions = await db.select().from(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, input.id)).orderBy(desc(generalFormSubmissions.submittedAt)).limit(10);
      // Daily counts for last 30 days
      const dailyCounts = await db.execute(sql`
        SELECT DATE(submittedAt) as date, COUNT(*) as count
        FROM generalFormSubmissions
        WHERE templateId = ${input.id} AND submittedAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(submittedAt)
        ORDER BY date ASC
      `);
      return {
        totalSubmissions: total as number,
        avgScore: avgScore ? Math.round(avgScore) : null,
        recentSubmissions,
        dailyCounts: (dailyCounts[0] as unknown as any[]) ?? [],
        embed: await getEmbedAnalyticsSummary(db, input.id),
      };
    }),

  getDeepFieldAnalytics: protectedProcedure
    .input(
      z.object({
        formId: z.number(),
        filterId: z.string().optional(),
        crossTabRowFieldId: z.number().optional(),
        crossTabColFieldId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const bundle = await loadFormAnalyticsBundle(db, input.formId, input.filterId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const payload = buildDeepAnalyticsPayload(
        bundle.items,
        bundle.options,
        bundle.submissions,
        input.crossTabRowFieldId,
        input.crossTabColFieldId,
      );
      return {
        formName: bundle.template.name,
        filterId: input.filterId ?? null,
        savedFilters: bundle.resultsSettings.savedFilters,
        items: bundle.items.map(i => ({ id: i.id, label: i.label, itemType: i.itemType })),
        ...payload,
      };
    }),

  listAnalyticsReports: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const bundle = await loadFormAnalyticsBundle(db, input.formId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      return bundle.analyticsSettings.reports;
    }),

  saveAnalyticsReport: protectedProcedure
    .input(
      z.object({
        formId: z.number(),
        report: z.object({
          id: z.string().optional(),
          name: z.string().min(1),
          headerHtml: z.string().optional(),
          password: z.string().optional(),
          filterId: z.string().optional(),
          visibleFieldIds: z.array(z.number()).optional(),
          chartFieldIds: z.array(z.number()).optional(),
          showTable: z.boolean().default(true),
          showCharts: z.boolean().default(true),
          crossTabRowFieldId: z.number().optional(),
          crossTabColFieldId: z.number().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const bundle = await loadFormAnalyticsBundle(db, input.formId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });

      const now = new Date().toISOString();
      const reports = [...bundle.analyticsSettings.reports];
      const existingIdx = input.report.id ? reports.findIndex(r => r.id === input.report.id) : -1;
      let passwordHash: string | undefined =
        existingIdx >= 0 ? reports[existingIdx].passwordHash : undefined;
      if (input.report.password === "") {
        passwordHash = undefined;
      } else if (input.report.password) {
        const bcrypt = await import("bcryptjs");
        passwordHash = await bcrypt.hash(input.report.password, 10);
      }

      const report: AnalyticsReportConfig = {
        id: input.report.id ?? `rpt_${randomBytes(8).toString("hex")}`,
        name: input.report.name,
        token:
          existingIdx >= 0
            ? reports[existingIdx].token
            : randomBytes(24).toString("base64url"),
        headerHtml: input.report.headerHtml,
        passwordHash,
        filterId: input.report.filterId,
        visibleFieldIds: input.report.visibleFieldIds,
        chartFieldIds: input.report.chartFieldIds,
        showTable: input.report.showTable,
        showCharts: input.report.showCharts,
        crossTabRowFieldId: input.report.crossTabRowFieldId,
        crossTabColFieldId: input.report.crossTabColFieldId,
        createdAt: existingIdx >= 0 ? reports[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) reports[existingIdx] = report;
      else reports.push(report);

      const themeMerged = mergeFormAnalyticsIntoTheme(bundle.template.themeSettings, { reports });
      await db
        .update(generalFormTemplates)
        .set({ themeSettings: themeMerged, updatedAt: new Date() })
        .where(eq(generalFormTemplates.id, input.formId));

      const global = await rebuildReportIndexForForm(db, input.formId, reports);
      await persistGlobalAnalyticsSettings(db, global);

      return { report };
    }),

  deleteAnalyticsReport: protectedProcedure
    .input(z.object({ formId: z.number(), reportId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const bundle = await loadFormAnalyticsBundle(db, input.formId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const reports = bundle.analyticsSettings.reports.filter(r => r.id !== input.reportId);
      const themeMerged = mergeFormAnalyticsIntoTheme(bundle.template.themeSettings, { reports });
      await db
        .update(generalFormTemplates)
        .set({ themeSettings: themeMerged, updatedAt: new Date() })
        .where(eq(generalFormTemplates.id, input.formId));
      const global = await rebuildReportIndexForForm(db, input.formId, reports);
      await persistGlobalAnalyticsSettings(db, global);
      return { success: true };
    }),

  listAnalyticsDashboards: protectedProcedure.query(async ({ ctx }) => {
    await requireAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const global = await getGlobalAnalyticsSettings(db);
    return global.dashboards;
  }),

  saveAnalyticsDashboard: protectedProcedure
    .input(
      z.object({
        dashboard: z.object({
          id: z.string().optional(),
          name: z.string().min(1),
          headerHtml: z.string().optional(),
          password: z.string().optional(),
          widgets: z.array(
            z.union([
              z.object({ id: z.string(), type: z.literal("summary"), formIds: z.array(z.number()) }),
              z.object({
                id: z.string(),
                type: z.literal("field_chart"),
                formId: z.number(),
                fieldId: z.number(),
                filterId: z.string().optional(),
              }),
              z.object({
                id: z.string(),
                type: z.literal("cross_tab"),
                formId: z.number(),
                rowFieldId: z.number(),
                colFieldId: z.number(),
                filterId: z.string().optional(),
              }),
              z.object({
                id: z.string(),
                type: z.literal("multi_form_compare"),
                formIds: z.array(z.number()),
                fieldLabel: z.string(),
              }),
            ]),
          ),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const global = await getGlobalAnalyticsSettings(db);
      const now = new Date().toISOString();
      const dashboards = [...global.dashboards];
      const idx = input.dashboard.id ? dashboards.findIndex(d => d.id === input.dashboard.id) : -1;
      let passwordHash: string | undefined = idx >= 0 ? dashboards[idx].passwordHash : undefined;
      if (input.dashboard.password === "") passwordHash = undefined;
      else if (input.dashboard.password) {
        const bcrypt = await import("bcryptjs");
        passwordHash = await bcrypt.hash(input.dashboard.password, 10);
      }

      const dashboard: AnalyticsDashboardConfig = {
        id: input.dashboard.id ?? `dash_${randomBytes(8).toString("hex")}`,
        name: input.dashboard.name,
        token: idx >= 0 ? dashboards[idx].token : randomBytes(24).toString("base64url"),
        headerHtml: input.dashboard.headerHtml,
        passwordHash,
        widgets: input.dashboard.widgets as AnalyticsDashboardConfig["widgets"],
        createdAt: idx >= 0 ? dashboards[idx].createdAt : now,
        updatedAt: now,
      };

      if (idx >= 0) dashboards[idx] = dashboard;
      else dashboards.push(dashboard);

      await persistGlobalAnalyticsSettings(db, {
        ...global,
        dashboards,
        dashboardIndex: syncDashboardIndex(dashboards),
      });
      return { dashboard };
    }),

  deleteAnalyticsDashboard: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const global = await getGlobalAnalyticsSettings(db);
      const dashboards = global.dashboards.filter(d => d.id !== input.dashboardId);
      await persistGlobalAnalyticsSettings(db, {
        ...global,
        dashboards,
        dashboardIndex: syncDashboardIndex(dashboards),
      });
      return { success: true };
    }),

  getDashboardAnalytics: protectedProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const global = await getGlobalAnalyticsSettings(db);
      const dashboard = global.dashboards.find(d => d.id === input.dashboardId);
      if (!dashboard) throw new TRPCError({ code: "NOT_FOUND" });

      const widgetData = await Promise.all(
        dashboard.widgets.map(async widget => {
          if (widget.type === "summary") {
            const summaries = await Promise.all(
              widget.formIds.map(async formId => {
                const bundle = await loadFormAnalyticsBundle(db, formId);
                return bundle
                  ? { formId, formName: bundle.template.name, total: bundle.submissions.length }
                  : null;
              }),
            );
            return { widget, data: summaries.filter(Boolean) };
          }
          if (widget.type === "field_chart") {
            const bundle = await loadFormAnalyticsBundle(db, widget.formId, widget.filterId);
            if (!bundle) return { widget, data: null };
            const payload = buildDeepAnalyticsPayload(bundle.items, bundle.options, bundle.submissions);
            const field = payload.fieldAnalytics.find(f => f.fieldId === widget.fieldId);
            return { widget, data: field ?? null };
          }
          if (widget.type === "cross_tab") {
            const bundle = await loadFormAnalyticsBundle(db, widget.formId, widget.filterId);
            if (!bundle) return { widget, data: null };
            const payload = buildDeepAnalyticsPayload(
              bundle.items,
              bundle.options,
              bundle.submissions,
              widget.rowFieldId,
              widget.colFieldId,
            );
            return { widget, data: payload.crossTab };
          }
          if (widget.type === "multi_form_compare") {
            const compare = await loadMultiFormCompare(db, widget.formIds, widget.fieldLabel);
            return { widget, data: compare };
          }
          return { widget, data: null };
        }),
      );

      return { dashboard, widgetData };
    }),

  compareFormsByField: protectedProcedure
    .input(z.object({ formIds: z.array(z.number()).min(1), fieldLabel: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return loadMultiFormCompare(db, input.formIds, input.fieldLabel);
    }),

  getPublicAnalyticsReport: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const resolved = await resolveReportByToken(db, input.token);
      if (!resolved) throw new TRPCError({ code: "NOT_FOUND" });

      if (resolved.report.passwordHash) {
        if (!input.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Password required" });
        }
        const bcrypt = await import("bcryptjs");
        const ok = await bcrypt.compare(input.password, resolved.report.passwordHash);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
      }

      const payload = buildDeepAnalyticsPayload(
        resolved.items,
        resolved.options,
        resolved.submissions,
        resolved.report.crossTabRowFieldId,
        resolved.report.crossTabColFieldId,
      );

      const visibleItems = resolved.report.visibleFieldIds?.length
        ? resolved.items.filter(i => resolved.report.visibleFieldIds!.includes(i.id))
        : resolved.items;

      const chartFields = resolved.report.chartFieldIds?.length
        ? payload.fieldAnalytics.filter(f => resolved.report.chartFieldIds!.includes(f.fieldId))
        : payload.fieldAnalytics.filter(f => f.distribution.length > 0 || f.numericStats);

      return {
        report: {
          id: resolved.report.id,
          name: resolved.report.name,
          headerHtml: resolved.report.headerHtml,
          showTable: resolved.report.showTable,
          showCharts: resolved.report.showCharts,
          requiresPassword: !!resolved.report.passwordHash,
        },
        formName: resolved.template.name,
        items: visibleItems.map(i => ({ id: i.id, label: i.label, itemType: i.itemType })),
        submissions: resolved.report.showTable
          ? resolved.submissions.map(s => ({
              id: s.id,
              submittedAt: s.submittedAt,
              responses: Object.fromEntries(
                visibleItems.map(i => [String(i.id), s.responses[String(i.id)] ?? ""]),
              ),
            }))
          : [],
        fieldAnalytics: resolved.report.showCharts ? chartFields : [],
        crossTab: payload.crossTab,
        totalSubmissions: payload.totalSubmissions,
      };
    }),

  getPublicAnalyticsDashboard: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const dashboard = await resolveDashboardByToken(db, input.token);
      if (!dashboard) throw new TRPCError({ code: "NOT_FOUND" });

      if (dashboard.passwordHash) {
        if (!input.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Password required" });
        }
        const bcrypt = await import("bcryptjs");
        const ok = await bcrypt.compare(input.password, dashboard.passwordHash);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
      }

      const widgetData = await Promise.all(
        dashboard.widgets.map(async widget => {
          if (widget.type === "summary") {
            const summaries = await Promise.all(
              widget.formIds.map(async formId => {
                const bundle = await loadFormAnalyticsBundle(db, formId);
                return bundle
                  ? { formId, formName: bundle.template.name, total: bundle.submissions.length }
                  : null;
              }),
            );
            return { widget, data: summaries.filter(Boolean) };
          }
          if (widget.type === "field_chart") {
            const bundle = await loadFormAnalyticsBundle(db, widget.formId, widget.filterId);
            if (!bundle) return { widget, data: null };
            const payload = buildDeepAnalyticsPayload(bundle.items, bundle.options, bundle.submissions);
            return {
              widget,
              data: payload.fieldAnalytics.find(f => f.fieldId === widget.fieldId) ?? null,
            };
          }
          if (widget.type === "cross_tab") {
            const bundle = await loadFormAnalyticsBundle(db, widget.formId, widget.filterId);
            if (!bundle) return { widget, data: null };
            const payload = buildDeepAnalyticsPayload(
              bundle.items,
              bundle.options,
              bundle.submissions,
              widget.rowFieldId,
              widget.colFieldId,
            );
            return { widget, data: payload.crossTab };
          }
          if (widget.type === "multi_form_compare") {
            return {
              widget,
              data: await loadMultiFormCompare(db, widget.formIds, widget.fieldLabel),
            };
          }
          return { widget, data: null };
        }),
      );

      return {
        dashboard: {
          id: dashboard.id,
          name: dashboard.name,
          headerHtml: dashboard.headerHtml,
          requiresPassword: !!dashboard.passwordHash,
        },
        widgetData,
      };
    }),

  // ── Submissions ───────────────────────────────────────────────────────────
  listSubmissions: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.enum(["submitted", "reviewed", "draft", "all"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [eq(generalFormSubmissions.templateId, input.templateId)];
      if (input.status !== "all") conditions.push(eq(generalFormSubmissions.status, input.status as any));
      const [submissions, [{ total }]] = await Promise.all([
        db.select().from(generalFormSubmissions).where(and(...conditions)).orderBy(desc(generalFormSubmissions.submittedAt)).limit(input.pageSize).offset(offset),
        db.select({ total: count() }).from(generalFormSubmissions).where(and(...conditions)),
      ]);
      return { submissions, total: total as number };
    }),

  getSubmission: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sub] = await db.select().from(generalFormSubmissions).where(eq(generalFormSubmissions.id, input.id)).limit(1);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
      return sub;
    }),

  updateSubmissionStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["submitted", "reviewed", "draft"]) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(generalFormSubmissions).set({ status: input.status, updatedAt: new Date() }).where(eq(generalFormSubmissions.id, input.id));
      return { success: true };
    }),

  deleteSubmission: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormSubmissions).where(eq(generalFormSubmissions.id, input.id));
      return { success: true };
    }),

  bulkDeleteSubmissions: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormSubmissions).where(inArray(generalFormSubmissions.id, input.ids));
      return { success: true, deleted: input.ids.length };
    }),

  updateSubmissionResponses: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        fieldUpdates: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sub] = await db
        .select()
        .from(generalFormSubmissions)
        .where(eq(generalFormSubmissions.id, input.id))
        .limit(1);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND" });
      const [template] = await db
        .select()
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, sub.templateId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      let responses: Record<string, unknown> = {};
      try {
        responses = JSON.parse(sub.responses);
      } catch {
        responses = {};
      }
      const changedFields: string[] = [];
      for (const [fieldId, value] of Object.entries(input.fieldUpdates)) {
        responses[fieldId] = value;
        changedFields.push(fieldId);
      }

      await db
        .update(generalFormSubmissions)
        .set({ responses: JSON.stringify(responses), updatedAt: new Date() })
        .where(eq(generalFormSubmissions.id, input.id));

      const resultsSettings = parseResultsSettings(template.themeSettings);
      await fireConfiguredFormActions(db, sub.templateId, "on_update", resultsSettings.actions, {
        formName: template.name,
        submissionId: input.id,
        responses,
        changedFields,
      });

      try {
        await fireFormWebhook(db, sub.templateId, "update", {
          submissionId: input.id,
          responses,
          changedFields,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Webhook] Update delivery failed:", msg);
      }

      if (template.notifyEmail) {
        try {
          await sendFormNotifyEmail(
            template.notifyEmail,
            `Submission updated: ${template.name} #${input.id}`,
            `Submission #${input.id} was updated.\nChanged fields: ${changedFields.join(", ")}`,
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[NotifyEmail] Update notification failed:", msg);
        }
      }

      return { success: true };
    }),

  bulkUpdateSubmissions: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1),
        fieldUpdates: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const subs = await db
        .select()
        .from(generalFormSubmissions)
        .where(inArray(generalFormSubmissions.id, input.ids));
      if (subs.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      const templateId = subs[0].templateId;
      const [template] = await db
        .select()
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, templateId))
        .limit(1);
      const resultsSettings = template ? parseResultsSettings(template.themeSettings) : { savedFilters: [], actions: [] };

      for (const sub of subs) {
        let responses: Record<string, unknown> = {};
        try {
          responses = JSON.parse(sub.responses);
        } catch {
          responses = {};
        }
        for (const [fieldId, value] of Object.entries(input.fieldUpdates)) {
          responses[fieldId] = value;
        }
        await db
          .update(generalFormSubmissions)
          .set({ responses: JSON.stringify(responses), updatedAt: new Date() })
          .where(eq(generalFormSubmissions.id, sub.id));

        if (template) {
          await fireConfiguredFormActions(db, templateId, "on_update", resultsSettings.actions, {
            formName: template.name,
            submissionId: sub.id,
            responses,
            changedFields: Object.keys(input.fieldUpdates),
          });
        }
      }

      return { success: true, updated: subs.length };
    }),

  getResultsSettings: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db
        .select({ themeSettings: generalFormTemplates.themeSettings })
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, input.formId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      return parseResultsSettings(template.themeSettings);
    }),

  saveResultsSettings: protectedProcedure
    .input(
      z.object({
        formId: z.number(),
        settings: z.object({
          savedFilters: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              logic: z.enum(["AND", "OR"]),
              conditions: z.array(
                z.object({
                  fieldId: z.string(),
                  operator: z.string(),
                  value: z.string(),
                }),
              ),
            }),
          ),
          actions: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              event: z.enum(["on_submit", "on_update"]),
              type: z.enum(["email", "webhook"]),
              enabled: z.boolean(),
              emailTo: z.string().optional(),
              emailSubject: z.string().optional(),
            }),
          ),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db
        .select({ themeSettings: generalFormTemplates.themeSettings })
        .from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, input.formId))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      const merged = mergeResultsSettingsIntoTheme(
        template.themeSettings,
        input.settings as FormResultsSettings,
      );
      await db
        .update(generalFormTemplates)
        .set({ themeSettings: merged, updatedAt: new Date() })
        .where(eq(generalFormTemplates.id, input.formId));
      return { success: true };
    }),

  // ── PUBLIC: Get form by slug ───────────────────────────────────────────────
  getPublicForm: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(generalFormTemplates)
        .where(and(eq(generalFormTemplates.publicSlug, input.slug), eq(generalFormTemplates.isPublic, true)))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or not publicly available." });
      if (template.status === "closed") throw new TRPCError({ code: "FORBIDDEN", message: "This form is closed." });
      if (template.closeAt && new Date(template.closeAt) < new Date()) throw new TRPCError({ code: "FORBIDDEN", message: "This form has expired." });
      if (template.openAt && new Date(template.openAt) > new Date()) throw new TRPCError({ code: "FORBIDDEN", message: "This form is not open yet." });
      const sections = await db.select().from(generalFormSections).where(eq(generalFormSections.templateId, template.id)).orderBy(asc(generalFormSections.sortOrder));
      const allItems = await db
        .select()
        .from(generalFormItems)
        .where(eq(generalFormItems.templateId, template.id))
        .orderBy(asc(generalFormItems.sortOrder));
      const items = allItems.filter(i => !isAdminOnlyItem(i));
      const options =
        items.length > 0
          ? await db
              .select()
              .from(generalFormOptions)
              .where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id)))
              .orderBy(asc(generalFormOptions.sortOrder))
          : [];
      const branchRules = await db
        .select()
        .from(generalFormBranchRules)
        .where(eq(generalFormBranchRules.templateId, template.id));
      return { template, sections, items, options, branchRules };
    }),

  // ── ADMIN PREVIEW: Get form by slug (no isPublic check) ──────────────────
  getFormPreview: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(generalFormTemplates)
        .where(eq(generalFormTemplates.publicSlug, input.slug))
        .limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
      const sections = await db.select().from(generalFormSections).where(eq(generalFormSections.templateId, template.id)).orderBy(asc(generalFormSections.sortOrder));
      const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, template.id)).orderBy(asc(generalFormItems.sortOrder));
      const options = items.length > 0
        ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id))).orderBy(asc(generalFormOptions.sortOrder))
        : [];
      const branchRules = await db.select().from(generalFormBranchRules).where(eq(generalFormBranchRules.templateId, template.id));
      return { template, sections, items, options, branchRules };
    }),

  // ── Save draft (auto-save partial attempt) ──────────────────────────────
  saveFormDraft: publicProcedure
    .input(z.object({
      templateId: z.number(),
      responses: z.string(), // JSON: Record<itemId, value>
      userId: z.number().optional(),
      draftId: z.number().optional(), // if updating existing draft
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const req = (ctx as any).req;
      const ip = req?.ip?.substring(0, 64) ?? null;
      const ua = req?.headers?.["user-agent"]?.substring(0, 500) ?? null;
      const ref = req?.headers?.referer?.substring(0, 500) ?? null;
      if (input.draftId) {
        // Update existing draft
        await db.update(generalFormSubmissions)
          .set({ responses: input.responses, updatedAt: new Date() })
          .where(and(
            eq(generalFormSubmissions.id, input.draftId),
            eq(generalFormSubmissions.status, "draft"),
          ));
        return { id: input.draftId };
      }
      // Create new draft row
      const [result] = await db.insert(generalFormSubmissions).values({
        templateId: input.templateId,
        submittedByUserId: input.userId ?? null,
        responses: input.responses,
        score: 0,
        maxScore: 0,
        status: "draft",
        ipAddress: ip,
        userAgent: ua,
        referrer: ref,
      });
      return { id: (result as any).insertId as number };
    }),

  // ── Get all results (admin) — complete + incomplete ───────────────────────
  getFormResults: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      status: z.enum(["all", "submitted", "reviewed", "draft"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const offset = (input.page - 1) * input.pageSize;
      const conditions: any[] = [eq(generalFormSubmissions.templateId, input.templateId)];
      if (input.status !== "all") conditions.push(eq(generalFormSubmissions.status, input.status as any));
      const [submissions, [{ total }]] = await Promise.all([
        db.select({
          id: generalFormSubmissions.id,
          templateId: generalFormSubmissions.templateId,
          submittedByUserId: generalFormSubmissions.submittedByUserId,
          responses: generalFormSubmissions.responses,
          score: generalFormSubmissions.score,
          maxScore: generalFormSubmissions.maxScore,
          status: generalFormSubmissions.status,
          ipAddress: generalFormSubmissions.ipAddress,
          userAgent: generalFormSubmissions.userAgent,
          referrer: generalFormSubmissions.referrer,
          submittedAt: generalFormSubmissions.submittedAt,
          updatedAt: generalFormSubmissions.updatedAt,
          userName: users.name,
          userEmail: users.email,
          userDisplayName: users.displayName,
        })
          .from(generalFormSubmissions)
          .leftJoin(users, eq(generalFormSubmissions.submittedByUserId, users.id))
          .where(and(...conditions))
          .orderBy(desc(generalFormSubmissions.updatedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ total: count() }).from(generalFormSubmissions).where(and(...conditions)),
      ]);
      const items = await db
        .select({
          id: generalFormItems.id,
          label: generalFormItems.label,
          itemType: generalFormItems.itemType,
          sortOrder: generalFormItems.sortOrder,
          extraConfig: generalFormItems.extraConfig,
          isRequired: generalFormItems.isRequired,
        })
        .from(generalFormItems)
        .where(eq(generalFormItems.templateId, input.templateId))
        .orderBy(asc(generalFormItems.sortOrder));
      const itemIds = items.map(i => i.id);
      const options =
        itemIds.length > 0
          ? await db
              .select()
              .from(generalFormOptions)
              .where(inArray(generalFormOptions.itemId, itemIds))
              .orderBy(asc(generalFormOptions.sortOrder))
          : [];
      const resultsSettings = parseResultsSettings(
        (
          await db
            .select({ themeSettings: generalFormTemplates.themeSettings })
            .from(generalFormTemplates)
            .where(eq(generalFormTemplates.id, input.templateId))
            .limit(1)
        )[0]?.themeSettings ?? null,
      );
      return { submissions, total: total as number, items, options, resultsSettings };
    }),

  // ── PUBLIC: Submit form ───────────────────────────────────────────────────
  submitForm: publicProcedure
    .input(z.object({
      templateId: z.number(),
      responses: z.string(), // JSON: Record<itemId, value>
      userId: z.number().optional(),
      email: z.string().optional(), // submitter email for Stripe checkout prefill
      origin: z.string().optional(), // frontend origin for Stripe redirect URLs
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      if (template.status === "closed") throw new TRPCError({ code: "FORBIDDEN", message: "This form is closed." });
      // Check max submissions
      if (template.maxSubmissions) {
        const [{ total }] = await db.select({ total: count() }).from(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, input.templateId));
        if ((total as number) >= template.maxSubmissions) throw new TRPCError({ code: "FORBIDDEN", message: "This form has reached its maximum number of submissions." });
      }
      const sanitizedResponses = await stripAdminOnlyFromResponses(db, input.templateId, input.responses);
      // Calculate score if enabled
      let score = 0;
      let maxScore = 0;
      if (template.scoreEnabled) {
        const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, input.templateId));
        const options = items.length > 0
          ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id)))
          : [];
        const responses: Record<string, any> = JSON.parse(sanitizedResponses);
        for (const item of items) {
          if (item.scoreWeight > 0) {
            maxScore += item.scoreWeight;
            const answer = responses[item.id.toString()];
            const matchingOption = options.find((o: any) => o.itemId === item.id && (o.value === answer || (Array.isArray(answer) && answer.includes(o.value))));
            if (matchingOption) score += matchingOption.scoreValue;
          }
        }
      }
      const req = (ctx as any).req;
      const [result] = await db.insert(generalFormSubmissions).values({
        templateId: input.templateId,
        submittedByUserId: input.userId ?? null,
        responses: sanitizedResponses,
        score,
        maxScore,
        status: "submitted",
        ipAddress: req?.ip?.substring(0, 64) ?? null,
        userAgent: req?.headers?.["user-agent"]?.substring(0, 500) ?? null,
        referrer: req?.headers?.referer?.substring(0, 500) ?? null,
      });
      // Fire-and-forget Google Sheets sync (non-blocking)
      try {
        const { syncSubmissionToSheets } = await import("../lib/googleSheets");
        const parsedResponses: Record<string, any> = JSON.parse(sanitizedResponses);
        syncSubmissionToSheets(input.templateId, parsedResponses, new Date()).catch((err: any) => {
          console.error("[GoogleSheets] Sync failed for form", input.templateId, err.message);
        });
      } catch {}
      // Fire-and-forget Email List subscription (non-blocking)
      const submissionId = (result as any).insertId;
      ;(async () => {
        try {
          // Extract submitter email from responses
          const parsedResponses: Record<string, any> = JSON.parse(sanitizedResponses);
          let submitterEmail: string | null = null;
          let submitterName: string | null = null;
          for (const [, val] of Object.entries(parsedResponses)) {
            if (typeof val === 'string' && val.includes('@') && val.includes('.')) {
              submitterEmail = val.trim().toLowerCase();
            }
            if (typeof val === 'string' && !val.includes('@') && val.trim().length > 1 && !submitterName) {
              submitterName = val.trim();
            }
          }
          if (!submitterEmail && input.userId) {
            const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
            if (u?.email) { submitterEmail = u.email; submitterName = submitterName || u.name; }
          }
          if (submitterEmail) {
            // Always add to All Contacts
            await addToAllContacts(submitterEmail, submitterName, { userId: input.userId, source: 'form', sourceId: String(input.templateId) });
            // Add to form-specific list if configured
            if (template.emailListId) {
              await addToEmailList(template.emailListId, submitterEmail, submitterName, { userId: input.userId, source: 'form', sourceId: String(input.templateId) });
            }
          }
        } catch (e: any) {
          console.error('[EmailList] Form subscription failed for form', input.templateId, e.message);
        }
      })();
      // Fire-and-forget Webhook delivery (non-blocking)
      ;(async () => {
        try {
          const parsedResponses: Record<string, any> = JSON.parse(sanitizedResponses);
          await fireFormWebhook(db, input.templateId, "submission", {
            submissionId,
            responses: parsedResponses,
            score: template.scoreEnabled ? { score, maxScore } : undefined,
          });
        } catch (e: any) {
          console.error("[Webhook] Delivery failed for form", input.templateId, e.message);
        }
      })();
      // Fire-and-forget configured form actions + notify email (non-blocking)
      ;(async () => {
        try {
          const parsedResponses: Record<string, any> = JSON.parse(sanitizedResponses);
          const resultsSettings = parseResultsSettings(template.themeSettings);
          await fireConfiguredFormActions(db, input.templateId, "on_submit", resultsSettings.actions, {
            formName: template.name,
            submissionId,
            responses: parsedResponses,
          });
          if (template.notifyEmail) {
            await sendFormNotifyEmail(
              template.notifyEmail,
              `New submission: ${template.name}`,
              `A new submission (#${submissionId}) was received for ${template.name}.`,
            );
          }
        } catch (e: any) {
          console.error("[FormActions] Submit actions failed for form", input.templateId, e.message);
        }
      })();
      // Build success outcome
      let successOutcome = null;
      let matchedRule: any = null;
      try {
        await ensureLegacySuccessModules(db, template);
        const modules = await fetchSuccessModules(db, input.templateId);
        const rulesRaw = await fetchSuccessRoutingRules(db, input.templateId);
        const parsedResponses: Record<string, any> = JSON.parse(sanitizedResponses);
        const submitter = extractSubmitterInfo(parsedResponses);
        // Build optionsByItemId map for label-as-fallback matching in routing conditions
        const allItemIds = Object.keys(parsedResponses).map(k => parseInt(k)).filter(n => !isNaN(n));
        let optionsByItemId: Record<string, Array<{ id: number; label: string; value: string }>> = {};
        if (allItemIds.length > 0) {
          const allOpts = await db.select({ id: generalFormOptions.id, itemId: generalFormOptions.itemId, label: generalFormOptions.label, value: generalFormOptions.value })
            .from(generalFormOptions)
            .where(inArray(generalFormOptions.itemId, allItemIds));
          for (const opt of allOpts) {
            const key = String(opt.itemId);
            if (!optionsByItemId[key]) optionsByItemId[key] = [];
            optionsByItemId[key].push({ id: opt.id, label: opt.label, value: opt.value });
          }
        }
        const submissionCtx: FormSubmissionContext = {
          responses: parsedResponses,
          score,
          maxScore,
          passingScorePercent: (template as any).passingScorePercent ?? null,
          submissionId,
          formName: template.name,
          paymentStatus: null,
          submitterName: submitter.name,
          submitterEmail: submitter.email,
        };
        const { module: selected, matchedRule: mr } = selectSuccessModuleWithRule(
          rulesRaw,
          modules,
          (template as any).defaultSuccessModuleId ?? null,
          submissionCtx,
          optionsByItemId,
        );
        matchedRule = mr;
        successOutcome = buildSuccessOutcome(selected, template, submissionCtx);
        // Grant access to products if the matched rule has grantAccessActions.
        // Works for both logged-in users (input.userId) and guests (resolve by email from responses).
        if (matchedRule?.grantAccessActions) {
          let grantUserId: number | null = input.userId ?? null;
          // If no userId (guest submission), resolve user by email from responses
          if (!grantUserId) {
            const parsedForGrant: Record<string, any> = JSON.parse(sanitizedResponses);
            let guestEmail: string | null = null;
            for (const val of Object.values(parsedForGrant)) {
              if (typeof val === 'string' && val.includes('@') && val.includes('.')) {
                guestEmail = val.trim().toLowerCase();
                break;
              }
            }
            if (guestEmail) {
              try {
                const { getOrCreateUserByEmail } = await import('../db');
                const { user: resolvedUser, isNew } = await getOrCreateUserByEmail({ email: guestEmail, name: submitter.name || undefined });
                grantUserId = resolvedUser.id;
                console.log(`[FormGrantAccess] Resolved guest email ${guestEmail} to userId=${grantUserId} (isNew=${isNew})`);
              } catch (e: any) {
                console.error('[FormGrantAccess] Failed to resolve guest user by email:', e.message);
              }
            }
          }
          console.log(`[FormGrantAccess] matchedRule=${matchedRule?.id ?? 'none'} grantAccessActions=${JSON.stringify(matchedRule?.grantAccessActions)} grantUserId=${grantUserId}`);
          if (grantUserId) {
            console.log(`[FormGrantAccess] Applying access grant for user ${grantUserId}: ${matchedRule.grantAccessActions}`);
            applyAccessGrantActions(db, matchedRule.grantAccessActions, grantUserId).catch((e: any) =>
              console.error("[FormGrantAccess] General form access grant failed:", e.message)
            );
          } else {
            console.warn(`[FormGrantAccess] Rule has grantAccessActions but could not resolve a userId — no email found in responses`);
          }
        } else if (matchedRule && !matchedRule.grantAccessActions) {
          console.log(`[FormGrantAccess] Rule ${matchedRule.id} matched but has no grantAccessActions — configure it in the routing rule dialog`);
        }
      } catch (e: any) {
        console.error("[SuccessModules] Failed to build success outcome:", e.message);
      }
      // Create Stripe checkout session if configured
      // Per-rule Stripe takes priority over template-level Stripe
      let checkoutUrl: string | null = null;
      try {
        const req = (ctx as any).req;
        const origin = input.origin ?? req?.headers?.origin ?? req?.headers?.referer?.replace(/\/[^\/]*$/, "") ?? "";
        const ruleStripeEnabled = (matchedRule as any)?.stripeEnabled;
        const templateStripeEnabled = (template as any).stripeEnabled;
        if (ruleStripeEnabled) {
          // Per-rule Stripe checkout
          checkoutUrl = await createFormStripeCheckout({
            config: {
              stripeEnabled: true,
              stripeProductId: null,
              stripePriceId: (matchedRule as any).stripePriceId ?? null,
              stripeAmount: (matchedRule as any).stripeAmount ?? null,
              stripeCheckoutMode: (matchedRule as any).stripeCheckoutMode ?? "payment",
              stripeSuccessUrl: (matchedRule as any).stripeSuccessUrl ?? null,
              stripeCancelUrl: (matchedRule as any).stripeCancelUrl ?? null,
              formName: (template as any).name,
              formId: (template as any).id,
            },
            submissionId,
            userId: input.userId ?? 0,
            userEmail: input.email ?? null,
            userName: null,
            origin,
          }).catch((e: any) => {
            console.error("[FormStripe] Per-rule checkout creation failed:", e.message);
            return null;
          });
        } else if (templateStripeEnabled) {
          // Template-level Stripe checkout (fallback)
          checkoutUrl = await createFormStripeCheckout({
            config: {
              stripeEnabled: true,
              stripeProductId: (template as any).stripeProductId ?? null,
              stripePriceId: (template as any).stripePriceId ?? null,
              stripeAmount: (template as any).stripeAmount ?? null,
              stripeCheckoutMode: (template as any).stripeCheckoutMode ?? "payment",
              stripeSuccessUrl: (template as any).stripeSuccessUrl ?? null,
              stripeCancelUrl: (template as any).stripeCancelUrl ?? null,
              formName: (template as any).name,
              formId: (template as any).id,
            },
            submissionId,
            userId: input.userId ?? 0,
            userEmail: input.email ?? null,
            userName: null,
            origin,
          }).catch((e: any) => {
            console.error("[FormStripe] Template-level checkout creation failed:", e.message);
            return null;
          });
        }
      } catch (e: any) {
        console.error("[FormStripe] General form checkout error:", e.message);
      }
      return { id: submissionId, score, maxScore, successOutcome, checkoutUrl };
    }),

    // ── ADMIN: Export form results as CSV-ready data ───────────────────────────
  exportFormResults: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      status: z.enum(["all", "submitted", "draft", "reviewed"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions: any[] = [eq(generalFormSubmissions.templateId, input.templateId)];
      if (input.status !== "all") conditions.push(eq(generalFormSubmissions.status, input.status as any));
      const [submissions, items] = await Promise.all([
        db.select().from(generalFormSubmissions).where(and(...conditions)).orderBy(desc(generalFormSubmissions.submittedAt)),
        db.select().from(generalFormItems).where(eq(generalFormItems.templateId, input.templateId)).orderBy(asc(generalFormItems.sortOrder)),
      ]);
      const userIds = submissions.map((s: any) => s.submittedByUserId).filter(Boolean);
      const userMap: Record<number, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const userRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds));
        for (const u of userRows) userMap[u.id] = { name: u.name, email: u.email };
      }
      return { submissions, items, userMap };
    }),

  // ── Global Form Theme ─────────────────────────────────────────────────────
  getGlobalTheme: protectedProcedure
    .query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(globalFormTheme).limit(1);
      return rows[0] ?? null;
    }),

  saveGlobalTheme: protectedProcedure
    .input(z.object({ themeSettings: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select({ id: globalFormTheme.id }).from(globalFormTheme).limit(1);
      if (rows.length > 0) {
        await db.update(globalFormTheme)
          .set({ themeSettings: input.themeSettings })
          .where(eq(globalFormTheme.id, rows[0].id));
      } else {
        await db.insert(globalFormTheme).values({ themeSettings: input.themeSettings });
      }
      return { ok: true };
    }),

  // ── Google Sheets Integration (per-form) ──────────────────────────────────
  getGoogleIntegration: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(googleFormIntegrations).where(eq(googleFormIntegrations.formId, input.formId));
      if (!row) return null;
      // Never expose tokens to the client
      return {
        id: row.id,
        formId: row.formId,
        googleClientId: row.googleClientId,
        // Mask client secret — only show if set
        hasClientSecret: !!row.googleClientSecret,
        connectedEmail: row.connectedEmail,
        spreadsheetId: row.spreadsheetId,
        spreadsheetName: row.spreadsheetName,
        sheetTabName: row.sheetTabName,
        isEnabled: row.isEnabled,
        headersInitialised: row.headersInitialised,
        isConnected: !!(row.accessToken && row.connectedEmail),
      };
    }),

  saveGoogleIntegrationConfig: protectedProcedure
    .input(z.object({
      formId: z.number(),
      googleClientId: z.string().optional(),
      googleClientSecret: z.string().optional(),
      spreadsheetName: z.string().optional(),
      sheetTabName: z.string().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [existing] = await db.select({ id: googleFormIntegrations.id }).from(googleFormIntegrations).where(eq(googleFormIntegrations.formId, input.formId));
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (input.googleClientId !== undefined) updates.googleClientId = input.googleClientId;
      if (input.googleClientSecret !== undefined) updates.googleClientSecret = input.googleClientSecret;
      if (input.spreadsheetName !== undefined) updates.spreadsheetName = input.spreadsheetName;
      if (input.sheetTabName !== undefined) updates.sheetTabName = input.sheetTabName;
      if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
      if (existing) {
        await db.update(googleFormIntegrations).set(updates).where(eq(googleFormIntegrations.formId, input.formId));
      } else {
        await db.insert(googleFormIntegrations).values({ formId: input.formId, ...updates });
      }
      return { ok: true };
    }),

  disconnectGoogleIntegration: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(googleFormIntegrations).set({
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        connectedEmail: null,
        isEnabled: false,
        headersInitialised: false,
        updatedAt: new Date(),
      }).where(eq(googleFormIntegrations.formId, input.formId));
      return { ok: true };
    }),

  // ─── Webhook Integration ──────────────────────────────────────────────────
  getWebhookConfig: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(generalFormWebhooks)
        .where(eq(generalFormWebhooks.formId, input.formId)).limit(1);
      return row ?? null;
    }),

  saveWebhookConfig: protectedProcedure
    .input(z.object({
      formId: z.number(),
      webhookUrl: z.string().optional(),
      secret: z.string().optional(),
      events: z.string().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db.select({ id: generalFormWebhooks.id })
        .from(generalFormWebhooks).where(eq(generalFormWebhooks.formId, input.formId)).limit(1);
      const updates: any = {};
      if (input.webhookUrl !== undefined) updates.webhookUrl = input.webhookUrl;
      if (input.secret !== undefined) updates.secret = input.secret;
      if (input.events !== undefined) updates.events = input.events;
      if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
      if (existing) {
        await db.update(generalFormWebhooks).set(updates).where(eq(generalFormWebhooks.id, existing.id));
      } else {
        await db.insert(generalFormWebhooks).values({ formId: input.formId, ...updates });
      }
      return { ok: true };
    }),

  testWebhook: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(generalFormWebhooks)
        .where(eq(generalFormWebhooks.formId, input.formId)).limit(1);
      if (!row?.webhookUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No webhook URL configured" });
      const payload = JSON.stringify({
        event: "test",
        formId: input.formId,
        timestamp: new Date().toISOString(),
        submission: { id: 0, answers: { example_field: "test value" } },
      });
      let signature = "";
      if (row.secret) {
        const { createHmac } = await import("crypto");
        signature = createHmac("sha256", row.secret).update(payload).digest("hex");
      }
      try {
        const res = await fetch(row.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(signature ? { "X-Signature-256": `sha256=${signature}` } : {}),
          },
          body: payload,
          signal: AbortSignal.timeout(10000),
        });
        const status = res.status;
        await db.update(generalFormWebhooks).set({
          lastTriggeredAt: Date.now(),
          lastStatus: status >= 200 && status < 300 ? "success" : "error",
          lastStatusCode: status,
        }).where(eq(generalFormWebhooks.id, row.id));
        return { ok: status >= 200 && status < 300, statusCode: status };
      } catch (e: any) {
        await db.update(generalFormWebhooks).set({
          lastTriggeredAt: Date.now(),
          lastStatus: "error",
          lastStatusCode: 0,
        }).where(eq(generalFormWebhooks.id, row.id));
        return { ok: false, statusCode: 0, error: e.message };
      }
    }),

  // ─── API Token ────────────────────────────────────────────────────────────
  getApiToken: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select({ apiToken: generalFormTemplates.apiToken })
        .from(generalFormTemplates).where(eq(generalFormTemplates.id, input.formId)).limit(1);
      return { apiToken: row?.apiToken ?? null };
    }),

  regenerateApiToken: protectedProcedure
    .input(z.object({ formId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { randomUUID } = await import("crypto");
      const token = randomUUID().replace(/-/g, "");
      await db.update(generalFormTemplates).set({ apiToken: token })
        .where(eq(generalFormTemplates.id, input.formId));
      return { apiToken: token };
    }),

  listSuccessModules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [template] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      await ensureLegacySuccessModules(db, template);
      const modules = await fetchSuccessModules(db, input.templateId);
      const [freshTemplate] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, input.templateId)).limit(1);
      return { modules, defaultSuccessModuleId: freshTemplate?.defaultSuccessModuleId ?? null };
    }),

  upsertSuccessModule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      templateId: z.number(),
      name: z.string().min(1).max(200),
      moduleType: z.enum(["inline_message", "full_page", "redirect_url"]),
      inlineContent: z.string().optional(),
      pageContent: z.string().optional(),
      redirectUrl: z.string().optional(),
      isEnabled: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, templateId, ...rest } = input;
      const values = { ...rest, templateId, updatedAt: new Date() };
      if (id) {
        await db.update(generalFormSuccessModules).set(values).where(eq(generalFormSuccessModules.id, id));
        return { id };
      }
      const [result] = await db.insert(generalFormSuccessModules).values(values);
      const newId = (result as any).insertId;
      const [tpl] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, templateId)).limit(1);
      if (tpl && !tpl.defaultSuccessModuleId) {
        await db.update(generalFormTemplates).set({ defaultSuccessModuleId: newId }).where(eq(generalFormTemplates.id, templateId));
      }
      return { id: newId };
    }),

  duplicateSuccessModule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [mod] = await db.select().from(generalFormSuccessModules).where(eq(generalFormSuccessModules.id, input.id)).limit(1);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });
      const [result] = await db.insert(generalFormSuccessModules).values({
        templateId: mod.templateId,
        name: mod.name + " (Copy)",
        moduleType: mod.moduleType,
        inlineContent: mod.inlineContent,
        pageContent: mod.pageContent,
        redirectUrl: mod.redirectUrl,
        isEnabled: mod.isEnabled,
        sortOrder: mod.sortOrder + 1,
      });
      return { id: (result as any).insertId };
    }),

  deleteSuccessModule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [mod] = await db.select().from(generalFormSuccessModules).where(eq(generalFormSuccessModules.id, input.id)).limit(1);
      if (!mod) throw new TRPCError({ code: "NOT_FOUND" });
      await db.delete(generalFormSuccessRoutingRules).where(eq(generalFormSuccessRoutingRules.successModuleId, input.id));
      await db.delete(generalFormSuccessModules).where(eq(generalFormSuccessModules.id, input.id));
      await clearDefaultIfDeleted(db, mod.templateId, input.id);
      return { success: true };
    }),

  setDefaultSuccessModule: protectedProcedure
    .input(z.object({ templateId: z.number(), moduleId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      if (input.moduleId != null) {
        const [mod] = await db.select().from(generalFormSuccessModules)
          .where(and(eq(generalFormSuccessModules.id, input.moduleId), eq(generalFormSuccessModules.templateId, input.templateId)))
          .limit(1);
        if (!mod) throw new TRPCError({ code: "NOT_FOUND", message: "Success module not found for this form." });
      }
      await db.update(generalFormTemplates).set({ defaultSuccessModuleId: input.moduleId }).where(eq(generalFormTemplates.id, input.templateId));
      return { success: true };
    }),

  listSuccessRoutingRules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return fetchSuccessRoutingRules(db, input.templateId);
    }),

  upsertSuccessRoutingRule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      templateId: z.number(),
      ruleLabel: z.string().default(""),
      successModuleId: z.number(),
      logicOperator: z.enum(["all", "any"]).default("all"),
      conditions: z.string(),
      grantAccessActions: z.string().optional(), // JSON array of {productType, productId}
      // Per-rule Stripe checkout action
      stripeEnabled: z.boolean().default(false),
      stripePriceId: z.string().optional(),
      stripeAmount: z.number().optional(),
      stripeCheckoutMode: z.string().default("payment"),
      stripeSuccessUrl: z.string().optional(),
      stripeCancelUrl: z.string().optional(),
      sortOrder: z.number().default(0),
      isEnabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [mod] = await db.select().from(generalFormSuccessModules)
        .where(and(eq(generalFormSuccessModules.id, input.successModuleId), eq(generalFormSuccessModules.templateId, input.templateId)))
        .limit(1);
      if (!mod) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid success module for this form." });
      const { id, ...rest } = input;
      if (id) {
        await db.update(generalFormSuccessRoutingRules).set(rest).where(eq(generalFormSuccessRoutingRules.id, id));
        return { id };
      }
      const [result] = await db.insert(generalFormSuccessRoutingRules).values(rest);
      return { id: (result as any).insertId };
    }),

  deleteSuccessRoutingRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(generalFormSuccessRoutingRules).where(eq(generalFormSuccessRoutingRules.id, input.id));
      return { success: true };
    }),

  getEmbedWidget: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const widget = await ensureEmbedWidget(db, input.templateId);
      const [template] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, input.templateId)).limit(1);
      return {
        widget,
        settings: parseEmbedSettings(widget.settingsJson),
        allowedDomains: parseAllowedDomains(widget.allowedDomains),
        hostDomain: template?.hostDomain ?? "app.allaboutultrasound.com",
        publicSlug: template?.publicSlug ?? null,
      };
    }),

  saveEmbedWidget: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      name: z.string().min(1).max(200),
      isEnabled: z.boolean(),
      displayType: z.enum(["inline", "popup", "slide_in"]),
      settingsJson: z.string(),
      domainMode: z.enum(["all", "allowlist"]),
      allowedDomains: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const widget = await ensureEmbedWidget(db, input.templateId);
      await db.update(generalFormEmbedWidgets).set({
        name: input.name,
        isEnabled: input.isEnabled,
        displayType: input.displayType,
        settingsJson: input.settingsJson,
        domainMode: input.domainMode,
        allowedDomains: JSON.stringify(input.allowedDomains),
        updatedAt: new Date(),
      }).where(eq(generalFormEmbedWidgets.id, widget.id));
      return { success: true, widgetKey: widget.widgetKey };
    }),

  // ── Multi-field Cross-Tabulation ───────────────────────────────────────────
  getMultiCrossTab: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      rowFieldId: z.number().int().positive(),
      colFieldIds: z.array(z.number().int().positive()).min(1).max(10),
      filterId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const bundle = await loadFormAnalyticsBundle(db, input.templateId, input.filterId);
      if (!bundle) throw new TRPCError({ code: "NOT_FOUND" });
      const { computeMultiCrossTab } = await import("../../shared/formAnalyticsUtils");
      const result = computeMultiCrossTab(
        bundle.items,
        bundle.options,
        bundle.submissions,
        input.rowFieldId,
        input.colFieldIds,
      );
      return result;
    }),

  // ── Drop-off / Progress Tracking ──────────────────────────────────────────
  trackProgress: publicProcedure
    .input(z.object({
      sessionId: z.string().max(64),
      templateId: z.number().int().positive(),
      userId: z.number().int().positive().nullable().optional(),
      fieldId: z.number().int().positive().nullable().optional(),
      pageIndex: z.number().int().min(0).default(0),
      eventType: z.enum(["session_start", "field_view", "field_answer", "page_advance", "form_submit", "form_abandon"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(generalFormProgressEvents).values({
        sessionId: input.sessionId,
        templateId: input.templateId,
        userId: input.userId ?? null,
        fieldId: input.fieldId ?? null,
        pageIndex: input.pageIndex,
        eventType: input.eventType,
        createdAt: Date.now(),
      });
      return { ok: true };
    }),

  getDropOffAnalytics: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sessionsRows] = await db.execute(
        sql`SELECT COUNT(DISTINCT session_id) as total FROM general_form_progress_events WHERE template_id = ${input.templateId} AND event_type = 'session_start'`
      ) as any;
      const totalSessions = Number((sessionsRows as any[])[0]?.total ?? 0);
      const [submitRows] = await db.execute(
        sql`SELECT COUNT(DISTINCT session_id) as total FROM general_form_progress_events WHERE template_id = ${input.templateId} AND event_type = 'form_submit'`
      ) as any;
      const totalSubmits = Number((submitRows as any[])[0]?.total ?? 0);
      const [pageRows] = await db.execute(
        sql`SELECT page_index, COUNT(DISTINCT session_id) as sessions FROM general_form_progress_events WHERE template_id = ${input.templateId} AND event_type IN ('session_start','page_advance','form_submit') GROUP BY page_index ORDER BY page_index ASC`
      ) as any;
      const [fieldViewRows] = await db.execute(
        sql`SELECT field_id, COUNT(DISTINCT session_id) as views FROM general_form_progress_events WHERE template_id = ${input.templateId} AND event_type = 'field_view' AND field_id IS NOT NULL GROUP BY field_id`
      ) as any;
      const [fieldAnswerRows] = await db.execute(
        sql`SELECT field_id, COUNT(DISTINCT session_id) as answers FROM general_form_progress_events WHERE template_id = ${input.templateId} AND event_type = 'field_answer' AND field_id IS NOT NULL GROUP BY field_id`
      ) as any;
      const viewMap: Record<number, number> = {};
      for (const r of (fieldViewRows as any[])) viewMap[Number(r.field_id)] = Number(r.views);
      const answerMap: Record<number, number> = {};
      for (const r of (fieldAnswerRows as any[])) answerMap[Number(r.field_id)] = Number(r.answers);
      const fieldStats = Object.keys({ ...viewMap, ...answerMap }).map(id => ({
        fieldId: Number(id),
        views: viewMap[Number(id)] ?? 0,
        answers: answerMap[Number(id)] ?? 0,
        dropOffRate: viewMap[Number(id)] ? Math.round((1 - (answerMap[Number(id)] ?? 0) / viewMap[Number(id)]) * 100) : 0,
      }));
      return {
        totalSessions,
        totalSubmits,
        overallCompletionRate: totalSessions > 0 ? Math.round((totalSubmits / totalSessions) * 100) : 0,
        pageFunnel: (pageRows as any[]).map((r: any) => ({ pageIndex: Number(r.page_index), sessions: Number(r.sessions) })),
                fieldStats,
      };
    }),

  /**
   * getDropOffAbandonerEmails
   * Returns a list of users who started the form but never submitted,
   * with their email addresses (logged-in users only).
   */
  getDropOffAbandonerEmails: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      /** Only include sessions that answered at least this many fields (default 1) */
      minFieldAnswers: z.number().int().min(0).default(1),
    }))
    .query(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Step 1: Find all sessions that started but never submitted
      const [abandonedRows] = await db.execute(
        sql`
          SELECT DISTINCT s.session_id, s.user_id
          FROM general_form_progress_events s
          WHERE s.template_id = ${input.templateId}
            AND s.event_type = 'session_start'
            AND s.session_id NOT IN (
              SELECT session_id FROM general_form_progress_events
              WHERE template_id = ${input.templateId} AND event_type = 'form_submit'
            )
        `
      ) as any;
      const abandonedSessions = (abandonedRows as any[]) as Array<{ session_id: string; user_id: number | null }>;
      if (abandonedSessions.length === 0) {
        return { totalAbandoned: 0, previousSubmitters: [], anonymousAbandonerCount: 0 };
      }

      // Step 2: Filter by minFieldAnswers
      let qualifiedSessions = abandonedSessions;
      if (input.minFieldAnswers > 0 && abandonedSessions.length > 0) {
        const sessionIdList = abandonedSessions.map(s => `'${s.session_id.replace(/'/g, "''")}'`).join(',');
        const [answerCountRows] = await db.execute(
          sql`
            SELECT session_id, COUNT(*) as answer_count
            FROM general_form_progress_events
            WHERE template_id = ${input.templateId}
              AND event_type = 'field_answer'
              AND session_id IN (${sql.raw(sessionIdList)})
            GROUP BY session_id
            HAVING COUNT(*) >= ${input.minFieldAnswers}
          `
        ) as any;
        const qualifiedSet = new Set((answerCountRows as any[]).map((r: any) => r.session_id as string));
        qualifiedSessions = abandonedSessions.filter(s => qualifiedSet.has(s.session_id));
      }

      const totalAbandoned = qualifiedSessions.length;

      // Step 3: Identify logged-in abandoners via the user_id stored in progress events
      const loggedInUserIds = [...new Set(
        qualifiedSessions.map(s => s.user_id).filter((id): id is number => id != null && id > 0)
      )];

      let identifiedUsers: Array<{ userId: number; email: string; name: string }> = [];
      if (loggedInUserIds.length > 0) {
        const userIdList = loggedInUserIds.join(',');
        const [userRows] = await db.execute(
          sql`
            SELECT id, email, name
            FROM users
            WHERE id IN (${sql.raw(userIdList)})
              AND email IS NOT NULL AND email != ''
              AND unsubscribedAt IS NULL
          `
        ) as any;
        identifiedUsers = (userRows as any[]).map((r: any) => ({
          userId: Number(r.id),
          email: r.email as string,
          name: r.name as string,
        }));
      }

      const anonymousAbandonerCount = totalAbandoned - loggedInUserIds.length;

      return {
        totalAbandoned,
        previousSubmitters: identifiedUsers,
        anonymousAbandonerCount: Math.max(0, anonymousAbandonerCount),
      };
    }),

  /**
   * sendDropOffFollowUp
   * Sends a custom follow-up email to a list of user IDs (form abandoners).
   */
  sendDropOffFollowUp: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      subject: z.string().min(1).max(200),
      htmlBody: z.string().min(1),
      recipientUserIds: z.array(z.number().int().positive()).min(1).max(500),
      brandMode: z.enum(["aaus", "ihe"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch recipient details
      const recipients = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, input.recipientUserIds));

      let sent = 0;
      let failed = 0;
      for (const recipient of recipients) {
        if (!recipient.email) { failed++; continue; }
        const ok = await sendEmail({
          to: { email: recipient.email, name: recipient.name ?? "" },
          subject: input.subject,
          htmlBody: input.htmlBody,
          brandMode: (input.brandMode as any) ?? "aaus",
        });
        if (ok) sent++; else failed++;
      }

      return { sent, failed, total: recipients.length };
    }),

});
