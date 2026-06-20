/**
 * Form Builder Router
 * Platform-admin-only CRUD for accreditation review form templates.
 * Supports: templates, sections, items, options, branching rules.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserRoles } from "../db";
import { invokeLLM } from "../_core/llm";
import {
  listFormTemplates,
  getFormTemplateById,
  createFormTemplate,
  updateFormTemplate,
  deleteFormTemplate,
  getFullFormTemplate,
  createFormSection,
  updateFormSection,
  deleteFormSection,
  reorderFormSections,
  createFormItem,
  updateFormItem,
  deleteFormItem,
  reorderFormItems,
  createFormOption,
  updateFormOption,
  deleteFormOption,
  replaceFormOptions,
  createFormBranchRule,
  updateFormBranchRule,
  deleteFormBranchRule,
  getFormBranchRulesByTemplate,
  listDiyOrganizations,
  getOrgVisibilityRulesByTemplate,
  saveOrgVisibilityRules,
  deleteOrgVisibilityRule,
  getTemplateAssignments,
  getActiveFormMenuItems,
  upsertTemplateAssignment,
  deleteTemplateAssignment,
  createFormSubmission,
  getFormSubmissionById,
  getFormSubmissionsByUser,
  getFormSubmissionsByOrg,
  getFormSubmissionsByTemplate,
  updateFormSubmissionStatus,
  getActiveTemplateForFormType,
  getFormSubmissionsForLab,
  getFormSubmissionWithDetails,
  getFormSubmissionStatsForLab,
  getFormSubmissionStaffList,
  type FormSubmissionFilter,
  getDb,
} from "../db";
import { eq, sql, and, inArray, asc } from "drizzle-orm";
import { extractFormFromUrl } from "../lib/formHtmlExtractor";
import {
  accreditationFormTemplates,
  accreditationFormSections,
  accreditationFormItems,
  accreditationFormOptions,
  accreditationFormBranchRules,
  accreditationFormSubmissions,
  accreditationFormSuccessModules,
  accreditationFormSuccessRoutingRules,
  lmsCourses,
  digitalProducts,
  digitalBundles,
  physicalProducts,
} from "../../drizzle/schema";
import { getStripeClient } from "../lib/stripeClient";
import {
  ensureLegacyAccreditationSuccessModules,
  fetchAccreditationSuccessModules,
  fetchAccreditationSuccessRoutingRules,
  clearAccreditationDefaultIfDeleted,
  deleteAccreditationSuccessDataForForm,
  buildAccreditationModuleIdMapForDuplicate,
  copyAccreditationSuccessRoutingRulesForDuplicate,
} from "../lib/accreditationFormSuccessModulesDb";
import {
  selectSuccessModule,
  selectSuccessModuleWithRule,
  buildSuccessOutcome,
  extractSubmitterInfo,
  type FormSubmissionContext,
} from "../lib/formSuccessRouting";
import { createFormStripeCheckout } from "../lib/formStripeCheckout";
import { applyAccessGrantActions } from "../lib/formAccessGrant";

// ─── Guard helper ─────────────────────────────────────────────────────────────


// ─── Typeform helpers ─────────────────────────────────────────────────────────
function extractTypeformId_fb(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/to\/([A-Za-z0-9]+)/);
    if (m && u.hostname.endsWith('typeform.com')) return m[1];
  } catch {}
  return null;
}

// ─── Embedded form detector (DIY) ────────────────────────────────────────────
async function detectEmbeddedFormUrl_fb(pageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormImporter/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const tfWidget = html.match(/data-tf-(?:widget|live|popup|sidetab|slider)=["']([A-Za-z0-9]+)["']/i);
    if (tfWidget) return `https://form.typeform.com/to/${tfWidget[1]}`;
    const tfIframe = html.match(/src=["'][^"']*typeform\.com\/to\/([A-Za-z0-9]+)[^"']*["']/i);
    if (tfIframe) return `https://form.typeform.com/to/${tfIframe[1]}`;
    const jfAttr = html.match(/data-jotform-id=["']([0-9]+)["']/i);
    if (jfAttr) return `https://form.jotform.com/${jfAttr[1]}`;
    const jfIframe = html.match(/src=["'][^"']*jotform\.com\/(?:form\/)?([0-9]+)[^"']*["']/i);
    if (jfIframe) return `https://form.jotform.com/${jfIframe[1]}`;
    return null;
  } catch {
    return null;
  }
}

function tfTypeToItemType_fb(type: string): string {
  const map: Record<string, string> = {
    short_text: 'text', long_text: 'textarea', email: 'email', phone_number: 'text',
    number: 'text', multiple_choice: 'radio', picture_choice: 'radio', dropdown: 'select',
    date: 'text', file_upload: 'text', signature: 'text', opinion_scale: 'scale',
    rating: 'scale', yes_no: 'radio', statement: 'heading', group: 'heading',
    website: 'text', payment: 'text',
  };
  return map[type] || 'text';
}
function tfOpToOperator_fb(op: string): string {
  const map: Record<string, string> = {
    is: 'equals', is_not: 'not_equals', contains: 'contains', not_contains: 'not_contains',
    lower_than: 'less_than', greater_than: 'greater_than',
    lower_equal_than: 'less_than', greater_equal_than: 'greater_than',
    equal: 'equals', not_equal: 'not_equals', always: 'always',
  };
  return map[op] || 'equals';
}
async function fetchAndParseTypeform_fb(formId: string) {
  const resp = await fetch(`https://api.typeform.com/forms/${formId}`, {
    headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Typeform API returned ${resp.status}`);
  const tf = await resp.json() as any;
  const refToKey: Record<string, string> = {};
  const refToChoiceLabel: Record<string, string> = {};
  for (const f of (tf.fields ?? [])) {
    refToKey[f.ref] = f.ref;
    refToKey[f.id] = f.ref;
    for (const c of (f.properties?.choices ?? [])) refToChoiceLabel[c.ref] = c.label;
  }
  const items: any[] = [];
  for (const f of (tf.fields ?? [])) {
    const itemType = tfTypeToItemType_fb(f.type);
    const options = (f.properties?.choices ?? []).map((c: any) => ({ label: c.label, value: c.ref }));
    if (f.type === 'yes_no') { options.push({ label: 'Yes', value: 'yes' }); options.push({ label: 'No', value: 'no' }); }
    items.push({
      field_key: f.ref, itemType,
      label: f.title || f.ref,
      helpText: f.properties?.description || '',
      isRequired: f.validations?.required ?? false,
      scoreWeight: 0,
      extraConfig: '', emailRoutingRules: '',
      options,
    });
  }
  const vars = tf.variables ?? {};
  const varNames = Object.keys(vars);
  if (varNames.length > 0) {
    items.push({
      field_key: '__variables__', itemType: 'info',
      label: 'Score Variables',
      helpText: `Calculated variables: ${varNames.map((v: string) => `${v} (starts at ${vars[v]})`).join(', ')}`,
      isRequired: false, scoreWeight: 0, extraConfig: '', emailRoutingRules: '', options: [],
    });
  }
  const branchRules: any[] = [];
  for (const rule of (tf.logic ?? [])) {
    const sourceKey = refToKey[rule.ref];
    if (!sourceKey) continue;
    for (const action of (rule.actions ?? [])) {
      if (action.action !== 'jump') continue;
      const targetKey = refToKey[action.details?.to?.value] || action.details?.to?.value;
      if (!targetKey) continue;
      const cond = action.condition;
      const op = cond?.op || 'always';
      if (op === 'always') continue;
      const condVar = cond?.vars?.[0];
      const condVal = cond?.vars?.[1];
      const condFieldKey = refToKey[condVar?.value] || condVar?.value || sourceKey;
      let condValue = '';
      if (condVal?.type === 'choice') condValue = refToChoiceLabel[condVal.value] || condVal.value;
      else condValue = String(condVal?.value ?? '');
      branchRules.push({
        ruleLabel: `Show ${targetKey} if ${condFieldKey} ${op} ${condValue}`,
        targetFieldKey: targetKey,
        action: 'show',
        conditions: [{ conditionFieldKey: condFieldKey, operator: tfOpToOperator_fb(op), value: condValue }],
      });
    }
  }
  return { name: tf.title || 'Imported Form', sections: [{ title: 'Imported from Typeform', items }], branchRules, variables: vars };
}

async function requirePlatformAdmin(ctx: { user: { id: number; role: string } }) {
  const roles = await getUserRoles(ctx.user.id);
  if (ctx.user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const itemTypeEnum = z.enum(["text", "textarea", "email", "richtext", "radio", "checkbox", "select", "scale", "heading", "info"]);
const branchActionEnum = z.enum(["show", "hide", "require", "unrequire"]);

const optionSchema = z.object({
  id: z.number().optional(),
  label: z.string().min(1),
  value: z.string().min(1),
  sortOrder: z.number().default(0),
  qualityScore: z.number().min(0).max(100).default(0),
});

const branchConditionSchema = z.object({
  conditionItemId: z.number(),
  conditionValue: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"]).default("equals"),
});

const branchRuleSchema = z.object({
  id: z.number().optional(),
  ruleLabel: z.string().optional().default(""),
  targetItemId: z.number(),
  targetType: z.enum(["item", "section"]).default("item"),
  // Legacy single-condition (kept for backward compat, derived from conditions[0] when saving)
  conditionItemId: z.number(),
  conditionValue: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains", "is_empty", "is_not_empty"]).default("equals"),
  logicOperator: z.enum(["all", "any"]).default("all"),
  conditions: z.array(branchConditionSchema).optional(),
  action: branchActionEnum.default("show"),
  isEnabled: z.boolean().default(true),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const formBuilderRouter = router({
  // ── Templates ──────────────────────────────────────────────────────────────

  /** List all form templates */
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx);
    return listFormTemplates();
  }),

  /** Get a single template by ID (metadata only) */
  getTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const t = await getFormTemplateById(input.id);
      if (!t) throw new TRPCError({ code: "NOT_FOUND" });
      return t;
    }),

  /** Get a full form template with all sections, items, options, and branch rules */
  getFullTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const result = await getFullFormTemplate(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),

  /** Create a new form template */
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      formType: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const id = await createFormTemplate({
        name: input.name,
        description: input.description ?? null,
        formType: input.formType,
        version: 1,
        isActive: true,
        createdByUserId: ctx.user.id,
      });
      return { id };
    }),

  /** Update template metadata */
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      formType: z.string().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
      hostDomain: z.string().optional(),
      successMessage: z.string().optional(),
      successRedirectUrl: z.string().optional(),
      defaultSuccessModuleId: z.number().nullable().optional(),
      passingScorePercent: z.number().nullable().optional(),
      // Stripe checkout settings
      stripeEnabled: z.boolean().optional(),
      stripeCheckoutMode: z.enum(["payment", "subscription"]).optional(),
      stripePriceId: z.string().nullable().optional(),
      stripeAmount: z.number().nullable().optional(),
      stripeSuccessUrl: z.string().nullable().optional(),
      stripeCancelUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { id, defaultSuccessModuleId, passingScorePercent, stripeEnabled, stripeCheckoutMode, stripePriceId, stripeAmount, stripeSuccessUrl, stripeCancelUrl, ...data } = input;
      await updateFormTemplate(id, data);
      // Update success module + Stripe fields directly via Drizzle
      const successFields: Record<string, any> = {};
      if (defaultSuccessModuleId !== undefined) successFields.defaultSuccessModuleId = defaultSuccessModuleId;
      if (passingScorePercent !== undefined) successFields.passingScorePercent = passingScorePercent;
      if (stripeEnabled !== undefined) successFields.stripeEnabled = stripeEnabled;
      if (stripeCheckoutMode !== undefined) successFields.stripeCheckoutMode = stripeCheckoutMode;
      if (stripePriceId !== undefined) successFields.stripePriceId = stripePriceId;
      if (stripeAmount !== undefined) successFields.stripeAmount = stripeAmount;
      if (stripeSuccessUrl !== undefined) successFields.stripeSuccessUrl = stripeSuccessUrl;
      if (stripeCancelUrl !== undefined) successFields.stripeCancelUrl = stripeCancelUrl;
      if (Object.keys(successFields).length > 0) {
        await db.update(accreditationFormTemplates)
          .set({ ...successFields, updatedAt: new Date() })
          .where(eq(accreditationFormTemplates.id, id));
      }
      return { success: true };
    }),

  /** Delete a template and all its data */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (db) {
        await deleteAccreditationSuccessDataForForm(db, input.id);
      }
      await deleteFormTemplate(input.id);
      return { success: true };
    }),

  // ── Sections ───────────────────────────────────────────────────────────────

  /** Add a section to a template */
  createSection: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      sortOrder: z.number().default(0),
      isCollapsible: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const id = await createFormSection({
        templateId: input.templateId,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        isCollapsible: input.isCollapsible,
      });
      return { id };
    }),

  /** Update a section */
  updateSection: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
      isCollapsible: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const { id, ...data } = input;
      await updateFormSection(id, data);
      return { success: true };
    }),

  /** Delete a section (cascades to items and options) */
  deleteSection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await deleteFormSection(input.id);
      return { success: true };
    }),

  /** Reorder sections */
  reorderSections: protectedProcedure
    .input(z.object({
      orders: z.array(z.object({ id: z.number(), sortOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await reorderFormSections(input.orders);
      return { success: true };
    }),

  // ── Items ──────────────────────────────────────────────────────────────────

  /** Add an item to a section */
  createItem: protectedProcedure
    .input(z.object({
      sectionId: z.number(),
      templateId: z.number(),
      label: z.string().min(1),
      helpText: z.string().optional(),
      itemType: itemTypeEnum,
      isRequired: z.boolean().default(false),
      sortOrder: z.number().default(0),
      scaleMin: z.number().optional(),
      scaleMax: z.number().optional(),
      scaleMinLabel: z.string().optional(),
      scaleMaxLabel: z.string().optional(),
      scoreWeight: z.number().min(0).default(1),
      richTextContent: z.string().optional(),
      emailRoutingRules: z.string().optional(),
      placeholder: z.string().optional(),
      validationRegex: z.string().optional(),
      options: z.array(optionSchema).optional(),
      extraConfig: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const { options, ...itemData } = input;
      // Auto-assign sortOrder as max existing + 1 so new items always go to the bottom
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [maxRow] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(${accreditationFormItems.sortOrder}), -1)` })
        .from(accreditationFormItems)
        .where(eq(accreditationFormItems.sectionId, itemData.sectionId));
      const autoSortOrder = (maxRow?.maxOrder ?? -1) + 1;
      const itemId = await createFormItem({
        sectionId: itemData.sectionId,
        templateId: itemData.templateId,
        label: itemData.label,
        helpText: itemData.helpText ?? null,
        itemType: itemData.itemType,
        isRequired: itemData.isRequired,
        sortOrder: autoSortOrder,
        scaleMin: itemData.scaleMin ?? null,
        scaleMax: itemData.scaleMax ?? null,
        scaleMinLabel: itemData.scaleMinLabel ?? null,
        scaleMaxLabel: itemData.scaleMaxLabel ?? null,
        scoreWeight: itemData.scoreWeight,
        richTextContent: itemData.richTextContent ?? null,
        emailRoutingRules: itemData.emailRoutingRules ?? null,
        placeholder: itemData.placeholder ?? null,
        validationRegex: itemData.validationRegex ?? null,
        extraConfig: itemData.extraConfig ?? null,
      });
      if (options && options.length > 0) {
        await replaceFormOptions(itemId, options.map((o, i) => ({
          label: o.label,
          value: o.value,
          sortOrder: o.sortOrder ?? i,
          qualityScore: o.qualityScore ?? 0,
        })));
      }
      return { id: itemId };
    }),

  /** Update an item */
  updateItem: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).optional(),
      helpText: z.string().nullable().optional(),
      itemType: itemTypeEnum.optional(),
      isRequired: z.boolean().optional(),
      sortOrder: z.number().optional(),
      sectionId: z.number().optional(),
      scaleMin: z.number().nullable().optional(),
      scaleMax: z.number().nullable().optional(),
      scaleMinLabel: z.string().nullable().optional(),
      scaleMaxLabel: z.string().nullable().optional(),
      scoreWeight: z.number().min(0).optional(),
      richTextContent: z.string().nullable().optional(),
      emailRoutingRules: z.string().nullable().optional(),
      placeholder: z.string().nullable().optional(),
      validationRegex: z.string().nullable().optional(),
      extraConfig: z.string().nullable().optional(),
      options: z.array(optionSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const { id, options, ...data } = input;
      await updateFormItem(id, data as any);
      if (options !== undefined) {
        await replaceFormOptions(id, options.map((o, i) => ({
          label: o.label,
          value: o.value,
          sortOrder: o.sortOrder ?? i,
          qualityScore: o.qualityScore ?? 0,
        })));
      }
      return { success: true };
    }),

  /** Delete an item (cascades to options and removes related branch rules) */
  deleteItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await deleteFormItem(input.id);
      return { success: true };
    }),

  /** Reorder items (can also move between sections) */
  reorderItems: protectedProcedure
    .input(z.object({
      orders: z.array(z.object({ id: z.number(), sortOrder: z.number(), sectionId: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await reorderFormItems(input.orders);
      return { success: true };
    }),

  // ── Options ────────────────────────────────────────────────────────────────

  /** Replace all options for an item */
  replaceOptions: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      options: z.array(optionSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await replaceFormOptions(input.itemId, input.options.map((o, i) => ({
        label: o.label,
        value: o.value,
        sortOrder: o.sortOrder ?? i,
        qualityScore: o.qualityScore ?? 0,
      })));
      return { success: true };
    }),

  // ── Branch Rules ───────────────────────────────────────────────────────────

  /** Get all branch rules for a template */
  getBranchRules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      return getFormBranchRulesByTemplate(input.templateId);
    }),

  /** Create a branch rule */
  createBranchRule: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      targetItemId: z.number(),
      conditionItemId: z.number(),
      conditionValue: z.string(),
      action: branchActionEnum.default("show"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const id = await createFormBranchRule(input);
      return { id };
    }),

  /** Update a branch rule */
  updateBranchRule: protectedProcedure
    .input(z.object({
      id: z.number(),
      targetItemId: z.number().optional(),
      conditionItemId: z.number().optional(),
      conditionValue: z.string().optional(),
      action: branchActionEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const { id, ...data } = input;
      await updateFormBranchRule(id, data);
      return { success: true };
    }),

  /** Delete a branch rule */
  deleteBranchRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await deleteFormBranchRule(input.id);
      return { success: true };
    }),

  /** Save all branch rules for a template (replace-all approach) */
  saveBranchRules: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      rules: z.array(branchRuleSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      // Delete existing rules and re-insert
      const existing = await getFormBranchRulesByTemplate(input.templateId);
      for (const rule of existing) {
        await deleteFormBranchRule(rule.id);
      }
      for (const rule of input.rules) {
        // Derive legacy single-condition fields from conditions[0] for backward compat
        const primaryCond = (rule.conditions && rule.conditions.length > 0)
          ? rule.conditions[0]
          : { conditionItemId: rule.conditionItemId, conditionValue: rule.conditionValue, operator: rule.operator ?? "equals" };
        await createFormBranchRule({
          templateId: input.templateId,
          ruleLabel: rule.ruleLabel ?? "",
          targetItemId: rule.targetItemId,
          targetType: rule.targetType ?? "item",
          conditionItemId: primaryCond.conditionItemId,
          conditionValue: primaryCond.conditionValue,
          operator: primaryCond.operator ?? "equals",
          logicOperator: rule.logicOperator ?? "all",
          conditions: rule.conditions ? JSON.stringify(rule.conditions) : null,
          action: rule.action,
          isEnabled: rule.isEnabled ?? true,
        });
      }
      return { success: true };
    }),

  // ── Org Visibility Rules ───────────────────────────────────────────────────

  /** List all DIY organizations (for building org-based rules) */
  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx);
    return listDiyOrganizations();
  }),

  /** Get all org visibility rules for a template */
  getOrgVisibilityRules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      return getOrgVisibilityRulesByTemplate(input.templateId);
    }),

  /** Save all org visibility rules for a template (replace-all approach) */
  saveOrgVisibilityRules: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      rules: z.array(z.object({
        ruleType: z.enum(["item", "section"]),
        targetId: z.number(),
        action: z.enum(["show_only_for", "hide_for"]),
        orgIds: z.array(z.number()),
        label: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await saveOrgVisibilityRules(
        input.templateId,
        input.rules.map(r => ({
          templateId: input.templateId,
          ruleType: r.ruleType,
          targetId: r.targetId,
          action: r.action,
          orgIds: JSON.stringify(r.orgIds),
          label: r.label ?? null,
        }))
      );
      return { success: true };
    }),

  /** Delete a single org visibility rule */
  deleteOrgVisibilityRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await deleteOrgVisibilityRule(input.id);
      return { success: true };
    }),

  /**
   * Evaluate org visibility for a given org — returns which item/section IDs
   * should be visible for that org. Used by the form renderer.
   */
  evaluateOrgVisibility: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      orgId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const rules = await getOrgVisibilityRulesByTemplate(input.templateId);
      const hiddenItemIds: number[] = [];
      const hiddenSectionIds: number[] = [];

      for (const rule of rules) {
        const orgIds: number[] = JSON.parse(rule.orgIds || "[]");
        let isHidden = false;

        if (rule.action === "show_only_for") {
          // Hidden unless this org is in the list
          isHidden = orgIds.length === 0 || !orgIds.includes(input.orgId);
        } else if (rule.action === "hide_for") {
          // Hidden if this org is in the list
          isHidden = orgIds.includes(input.orgId);
        }

        if (isHidden) {
          if (rule.ruleType === "item") hiddenItemIds.push(rule.targetId);
          else if (rule.ruleType === "section") hiddenSectionIds.push(rule.targetId);
        }
      }

      return { hiddenItemIds, hiddenSectionIds };
    }),

  // ── Template Assignments ──────────────────────────────────────────────────────

  /** List all template assignments (admin) */
  listAssignments: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx);
    return getTemplateAssignments();
  }),

  /** Get the active form menu items for a given org (used by Lab Admin / DIY Portal) */
  getFormMenuItems: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }))
    .query(async ({ input }) => {
      return getActiveFormMenuItems(input.orgId);
    }),

  /** Assign a template to a form type (creates or replaces existing assignment) */
  assignTemplate: protectedProcedure
    .input(z.object({
      formType: z.string().min(1).max(100),
      templateId: z.number(),
      orgId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const id = await upsertTemplateAssignment({
        formType: input.formType,
        templateId: input.templateId,
        orgId: input.orgId ?? null,
        isActive: true,
      });
      return { id };
    }),

  /** Remove a template assignment */
  removeAssignment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await deleteTemplateAssignment(input.id);
      return { success: true };
    }),

  /** Get the active template + full form data for a given formType (used by dynamic form renderer) */
  getActiveFormForType: protectedProcedure
    .input(z.object({
      formType: z.string(),
      orgId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const assignment = await getActiveTemplateForFormType(input.formType, input.orgId);
      if (!assignment) return null;
      const template = await getFullFormTemplate(assignment.templateId);
      if (!template) return null;
      return { assignment, template };
    }),

  // ── Form Submissions ───────────────────────────────────────────────────────────

  /** Submit a completed dynamic form */
  submitForm: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      formType: z.string(),
      orgId: z.number().optional(),
      reviewTargetType: z.string().optional(),
      reviewTargetId: z.number().optional(),
      responses: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      qualityScore: z.number().min(0).max(100).default(0),
      maxPossibleScore: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Inject hidden field values server-side
      let finalResponses = { ...input.responses };
      try {
        const db = await getDb();
        if (db) {
          const allItems = await db.select().from(accreditationFormItems).where(eq(accreditationFormItems.templateId, input.templateId));
          const hiddenItems = allItems.filter((it: any) => it.itemType === "hidden");
          if (hiddenItems.length > 0) {
            const now = new Date();
            const req = (ctx as any).req;
            for (const hi of hiddenItems) {
              let val = "";
              try { val = JSON.parse(hi.extraConfig ?? "{}").hiddenValue ?? ""; } catch {}
              val = val
                .replace(/\{\{user_id\}\}/g, ctx.user.id.toString())
                .replace(/\{\{user_email\}\}/g, (ctx.user as any).email ?? "")
                .replace(/\{\{date\}\}/g, now.toISOString().split("T")[0])
                .replace(/\{\{form_id\}\}/g, input.templateId.toString())
                .replace(/\{\{source\}\}/g, req?.headers?.referer ?? "");
              finalResponses[hi.id.toString()] = val;
            }
          }
        }
      } catch (e: any) {
        console.error("[HiddenFields] Failed to inject hidden values:", e.message);
      }
      const id = await createFormSubmission({
        templateId: input.templateId,
        formType: input.formType,
        submittedByUserId: ctx.user.id,
        orgId: input.orgId ?? null,
        reviewTargetType: input.reviewTargetType ?? null,
        reviewTargetId: input.reviewTargetId ?? null,
        responses: JSON.stringify(finalResponses),
        qualityScore: input.qualityScore,
        maxPossibleScore: input.maxPossibleScore,
        status: 'submitted',
      });

      // ── Compute successOutcome + Stripe checkout + access grants ─────────────
      let successOutcome: ReturnType<typeof buildSuccessOutcome> | null = null;
      let checkoutUrl: string | null = null;
      try {
        const db2 = await getDb();
        if (db2) {
          const [template] = await db2.select().from(accreditationFormTemplates)
            .where(eq(accreditationFormTemplates.id, input.templateId)).limit(1);
          if (template) {
            const modules = await fetchAccreditationSuccessModules(db2, input.templateId);
            const rules = await fetchAccreditationSuccessRoutingRules(db2, input.templateId);
            const { name: submitterName, email: submitterEmail } = extractSubmitterInfo(finalResponses);
            const ctx2: FormSubmissionContext = {
              responses: finalResponses,
              score: input.qualityScore,
              maxScore: input.maxPossibleScore,
              passingScorePercent: template.passingScorePercent ?? null,
              submissionId: id,
              formName: template.name,
              submitterName,
              submitterEmail,
            };
            // Build optionsByItemId map for label-as-fallback matching in routing conditions
            const responseItemIds = Object.keys(finalResponses).map(k => parseInt(k)).filter(n => !isNaN(n));
            let optionsByItemId2: Record<string, Array<{ id: number; label: string; value: string }>> = {};
            if (responseItemIds.length > 0) {
              const allOpts2 = await db2.select({ id: accreditationFormOptions.id, itemId: accreditationFormOptions.itemId, label: accreditationFormOptions.label, value: accreditationFormOptions.value })
                .from(accreditationFormOptions)
                .where(inArray(accreditationFormOptions.itemId, responseItemIds));
              for (const opt of allOpts2) {
                const key = String(opt.itemId);
                if (!optionsByItemId2[key]) optionsByItemId2[key] = [];
                optionsByItemId2[key].push({ id: opt.id, label: opt.label, value: opt.value });
              }
            }
            const { module: selectedModule, matchedRule } = selectSuccessModuleWithRule(rules, modules as any, template.defaultSuccessModuleId ?? null, ctx2, optionsByItemId2);
            successOutcome = buildSuccessOutcome(selectedModule as any, template, ctx2);

            // Grant access if matched rule has grantAccessActions
            console.log(`[FormGrantAccess] DIY matchedRule=${matchedRule?.id ?? 'none'} grantAccessActions=${JSON.stringify(matchedRule?.grantAccessActions)} userId=${ctx.user.id}`);
            if (matchedRule?.grantAccessActions) {
              console.log(`[FormGrantAccess] DIY Applying access grant for user ${ctx.user.id}: ${matchedRule.grantAccessActions}`);
              applyAccessGrantActions(db2, matchedRule.grantAccessActions, ctx.user.id).catch((e: any) =>
                console.error("[FormGrantAccess] DIY form access grant failed:", e.message)
              );
            } else if (matchedRule && !matchedRule.grantAccessActions) {
              console.log(`[FormGrantAccess] DIY Rule ${matchedRule.id} matched but has no grantAccessActions configured`);
            }

            // Create Stripe checkout session — per-rule takes priority over template-level
            const ruleStripeEnabled = (matchedRule as any)?.stripeEnabled;
            if (ruleStripeEnabled || template.stripeEnabled) {
              const req = (ctx as any).req;
              const origin = req?.headers?.origin ?? req?.headers?.referer?.replace(/\/[^\/]*$/, "") ?? "";
              const stripeConfig = ruleStripeEnabled ? {
                stripeEnabled: true,
                stripeProductId: null,
                stripePriceId: (matchedRule as any).stripePriceId ?? null,
                stripeAmount: (matchedRule as any).stripeAmount ?? null,
                stripeCheckoutMode: (matchedRule as any).stripeCheckoutMode ?? "payment",
                stripeSuccessUrl: (matchedRule as any).stripeSuccessUrl ?? null,
                stripeCancelUrl: (matchedRule as any).stripeCancelUrl ?? null,
                formName: template.name,
                formId: template.id,
              } : {
                stripeEnabled: true,
                stripeProductId: template.stripeProductId ?? null,
                stripePriceId: template.stripePriceId ?? null,
                stripeAmount: template.stripeAmount ?? null,
                stripeCheckoutMode: template.stripeCheckoutMode ?? "payment",
                stripeSuccessUrl: template.stripeSuccessUrl ?? null,
                stripeCancelUrl: template.stripeCancelUrl ?? null,
                formName: template.name,
                formId: template.id,
              };
              checkoutUrl = await createFormStripeCheckout({
                config: stripeConfig,
                submissionId: id,
                userId: ctx.user.id,
                userEmail: (ctx.user as any).email ?? null,
                userName: (ctx.user as any).name ?? null,
                origin,
              }).catch((e: any) => {
                console.error("[FormStripe] DIY form checkout creation failed:", e.message);
                return null;
              });
            }
          }
        }
      } catch (e: any) {
        console.error("[SuccessOutcome] Failed to compute outcome:", e.message);
      }

      return { id, successOutcome, checkoutUrl };
    }),

  /** Get my own submissions */
  getMySubmissions: protectedProcedure
    .input(z.object({ formType: z.string().optional() }))
    .query(async ({ ctx }) => {
      const submissions = await getFormSubmissionsByUser(ctx.user.id);
      return submissions;
    }),

  /** Get submissions for an org (admin/org-admin view) */
  getOrgSubmissions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      formType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Allow platform admins or org admins
      const roles = await getUserRoles(ctx.user.id);
      const isAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin') || roles.includes('diy_admin');
      if (!isAdmin) throw new TRPCError({ code: 'FORBIDDEN' });
      return getFormSubmissionsByOrg(input.orgId, input.formType);
    }),

  /** Get submissions for a template (admin view) */
  getTemplateSubmissions: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      return getFormSubmissionsByTemplate(input.templateId);
    }),

  /** Get a single submission by ID */
  getSubmission: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const sub = await getFormSubmissionById(input.id);
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });
      // Only owner, org admin, or platform admin can view
      const roles = await getUserRoles(ctx.user.id);
      const isAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin') || roles.includes('diy_admin');
      if (sub.submittedByUserId !== ctx.user.id && !isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return { ...sub, responses: JSON.parse(sub.responses) as Record<string, string | string[]> };
    }),

  /** Update submission status (admin only) */
  updateSubmissionStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['draft', 'submitted', 'reviewed']),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      await updateFormSubmissionStatus(input.id, input.status);
      return { success: true };
    }),

  /** List submissions for a lab with filters (lab admin or platform admin) */
  listSubmissionsForLab: protectedProcedure
    .input(z.object({
      labId: z.number(),
      formType: z.string().optional(),
      templateId: z.number().optional(),
      submittedByUserId: z.number().optional(),
      status: z.enum(['draft', 'submitted', 'reviewed']).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const roles = await getUserRoles(ctx.user.id);
      const isPlatformAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin');
      const isLabAdmin = roles.includes('diy_admin');
      if (!isPlatformAdmin && !isLabAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Lab admin access required' });
      }
      const filter: FormSubmissionFilter = {
        labId: input.labId,
        formType: input.formType,
        templateId: input.templateId,
        submittedByUserId: input.submittedByUserId,
        status: input.status,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
      };
      return getFormSubmissionsForLab(filter);
    }),

  /** Get detailed submission with parsed responses */
  getSubmissionDetails: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const roles = await getUserRoles(ctx.user.id);
      const isAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin') || roles.includes('diy_admin');
      const sub = await getFormSubmissionWithDetails(input.id);
      if (!sub) throw new TRPCError({ code: 'NOT_FOUND' });
      if (sub.submittedByUserId !== ctx.user.id && !isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return { ...sub, responses: JSON.parse(sub.responses as unknown as string) as Record<string, string | string[]> };
    }),

  /** Get submission stats for a lab */
  getSubmissionStats: protectedProcedure
    .input(z.object({ labId: z.number() }))
    .query(async ({ ctx, input }) => {
      const roles = await getUserRoles(ctx.user.id);
      const isPlatformAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin');
      const isLabAdmin = roles.includes('diy_admin');
      if (!isPlatformAdmin && !isLabAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return getFormSubmissionStatsForLab(input.labId);
    }),

  /** Get list of staff who have submitted forms for a lab */
  getSubmissionStaffList: protectedProcedure
    .input(z.object({ labId: z.number() }))
    .query(async ({ ctx, input }) => {
      const roles = await getUserRoles(ctx.user.id);
      const isPlatformAdmin = ctx.user.role === 'admin' || roles.includes('platform_admin');
      const isLabAdmin = roles.includes('diy_admin');
      if (!isPlatformAdmin && !isLabAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return getFormSubmissionStaffList(input.labId);
    }),

  /** Import a new DIY form template from a URL using AI scaffolding */
  importFormByUrl: protectedProcedure
    .input(z.object({ url: z.string().url(), formName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // ── Embedded form detection ──────────────────────────────────────────────
      let resolvedUrl_fb = input.url;
      const embeddedUrl_fb = await detectEmbeddedFormUrl_fb(input.url);
      if (embeddedUrl_fb) resolvedUrl_fb = embeddedUrl_fb;

      // ── Typeform fast-path ────────────────────────────────────────────────────
      const tfId = extractTypeformId_fb(resolvedUrl_fb);
      if (tfId) {
        let tfParsed: Awaited<ReturnType<typeof fetchAndParseTypeform_fb>>;
        try { tfParsed = await fetchAndParseTypeform_fb(tfId); }
        catch (e: any) { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Typeform API error: ${(e as Error).message}` }); }
        const formName = input.formName || tfParsed.name;
        const [newForm] = await db.insert(accreditationFormTemplates).values({
          name: formName, description: '', status: 'draft', isPublic: false,
          scoreEnabled: Object.keys(tfParsed.variables).length > 0,
          createdByUserId: ctx.user.id,
        });
        const newId = (newForm as any).insertId;
        const fieldKeyToItemId: Record<string, number> = {};
        let sortOrder = 0;
        for (const section of tfParsed.sections) {
          const [ns] = await db.insert(accreditationFormSections).values({ templateId: newId, title: section.title, sortOrder: sortOrder++ });
          const sectionId = (ns as any).insertId;
          let itemOrder = 0;
          for (const item of section.items) {
            const [ni] = await db.insert(accreditationFormItems).values({
              templateId: newId, sectionId,
              itemType: item.itemType || 'text',
              label: item.label || 'Field',
              helpText: item.helpText || null,
              isRequired: item.isRequired ?? false,
              scoreWeight: item.scoreWeight ?? 0,
              sortOrder: itemOrder++,
            });
            const itemId = (ni as any).insertId;
            if (item.field_key) fieldKeyToItemId[item.field_key] = itemId;
            if (item.options?.length > 0) {
              let optOrder = 0;
              for (const opt of item.options) {
                await db.insert(accreditationFormOptions).values({ itemId, label: opt.label, value: opt.value, qualityScore: 0, sortOrder: optOrder++ });
              }
            }
          }
        }
        let branchOrder = 0;
        for (const rule of tfParsed.branchRules) {
          const targetId = fieldKeyToItemId[rule.targetFieldKey];
          if (!targetId) continue;
          const conditions = (rule.conditions ?? []).map((c: any) => ({ conditionItemId: fieldKeyToItemId[c.conditionFieldKey] ?? 0, operator: c.operator || 'equals', value: c.value || '' })).filter((c: any) => c.conditionItemId !== 0);
          if (conditions.length === 0) continue;
          await db.insert(accreditationFormBranchRules).values({ templateId: newId, ruleLabel: rule.ruleLabel || '', targetItemId: targetId, action: rule.action || 'show', logicOperator: 'any', conditions: JSON.stringify(conditions), sortOrder: branchOrder++, isEnabled: true });
        }
        return { id: newId, name: formName };
      }

            // ── Generic HTML scrape path ─────────────────────────────────────────────
      // Use structured HTML extractor for full multi-page support
      const extracted_fb = await extractFormFromUrl(resolvedUrl_fb);
      const pageText = extracted_fb.rawStructuredText || `Form from: ${resolvedUrl_fb}`;
      // AI scaffold with rich metadata + branching + calculations
      const diySystemPrompt = `You are a form builder assistant. Given a structured form description extracted from a web page, reconstruct ALL form fields, their types, options, placeholder text, help text, conditional/branching logic, scoring weights, and any calculated/computed fields. Return structured JSON exactly matching the schema provided.
IMPORTANT: The input includes VISIBLE FIELDS (current page) and HIDDEN FIELDS (from other pages). You MUST include fields from ALL pages — infer the labels and types of hidden fields from context (field numbering, scoring patterns, form topic).
For calculated fields: use itemType "info" and put the formula/description in richTextContent as HTML.
For score thresholds: use itemType "info" with richTextContent describing the scoring bands.
For images: use itemType "info" with richTextContent as <img src="URL" /> for each image found.
For email routing: if a field routes submissions to different emails, set emailRoutingRules as JSON array [{"label": string, "conditionItemId": 0, "conditionValue": string, "routeTo": string}].
For score weights: assign scoreWeight (0-100) to each scored field based on importance.`;
      const diyUserPrompt = `Create a complete form from this structured description. Include ALL fields from ALL pages. Return JSON:
{
  "name": string,
  "description": string,
  "sections": [{
    "title": string,
    "items": [{
      "field_key": string,
      "itemType": "text"|"textarea"|"email"|"radio"|"checkbox"|"select"|"scale"|"heading"|"info",
      "label": string,
      "placeholder": string,
      "helpText": string,
      "isRequired": boolean,
      "scoreWeight": number,
      "scaleMin": number|null,
      "scaleMax": number|null,
      "scaleMinLabel": string,
      "scaleMaxLabel": string,
      "richTextContent": string,
      "emailRoutingRules": string,
      "options": [{"label": string, "value": string, "qualityScore": number}]
    }]
  }],
  "branchRules": [{
    "targetFieldKey": string,
    "conditionFieldKey": string,
    "conditionValue": string,
    "action": "show"|"hide"
  }]
}
IMPORTANT:
- Include fields from ALL pages (visible + hidden).
- If the form has calculated outputs (total score, risk level, etc.), create an "info" item with richTextContent describing the calculation.
- If the form has score thresholds (e.g. 0-10=low risk, 11-20=high risk), add an "info" item with richTextContent listing the bands.
- Capture ALL conditional logic including skip patterns.
- Use scoreWeight on each field to reflect its relative importance in scoring.
Form description:
${pageText}`;
      const diyItemSchema = { type: 'object', properties: { field_key: { type: 'string' }, itemType: { type: 'string' }, label: { type: 'string' }, placeholder: { type: 'string' }, helpText: { type: 'string' }, isRequired: { type: 'boolean' }, scoreWeight: { type: 'number' }, scaleMin: { type: ['number', 'null'] }, scaleMax: { type: ['number', 'null'] }, scaleMinLabel: { type: 'string' }, scaleMaxLabel: { type: 'string' }, richTextContent: { type: 'string' }, emailRoutingRules: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, qualityScore: { type: 'number' } }, required: ['label', 'value', 'qualityScore'], additionalProperties: false } } }, required: ['field_key', 'itemType', 'label', 'placeholder', 'helpText', 'isRequired', 'scoreWeight', 'scaleMin', 'scaleMax', 'scaleMinLabel', 'scaleMaxLabel', 'richTextContent', 'emailRoutingRules', 'options'], additionalProperties: false };
      const diyAiSchema = { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, sections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, items: { type: 'array', items: diyItemSchema } }, required: ['title', 'items'], additionalProperties: false } }, branchRules: { type: 'array', items: { type: 'object', properties: { targetFieldKey: { type: 'string' }, conditionFieldKey: { type: 'string' }, conditionValue: { type: 'string' }, action: { type: 'string' } }, required: ['targetFieldKey', 'conditionFieldKey', 'conditionValue', 'action'], additionalProperties: false } } }, required: ['name', 'description', 'sections', 'branchRules'], additionalProperties: false };
      const aiResp = await invokeLLM({
        messages: [
          { role: 'system', content: diySystemPrompt },
          { role: 'user', content: diyUserPrompt },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'form_scaffold', strict: true, schema: diyAiSchema } },
      });
      let parsed: any;
      try { parsed = JSON.parse(aiResp.choices[0].message.content as string); }
      catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI failed to parse form structure. Please try again or use a different URL.' }); }
      const formName = input.formName || parsed.name || 'Imported Form';
      const [newTpl] = await db.insert(accreditationFormTemplates).values({
        name: formName, description: parsed.description ?? null, formType: 'general',
        version: 1, isActive: true, importedFromUrl: input.url, createdByUserId: ctx.user.id,
      });
      const newId = (newTpl as any).insertId;
      const diyFieldKeyToItemId: Record<string, number> = {};
      let sectionOrder = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(accreditationFormSections).values({ templateId: newId, title: section.title || 'Section', sortOrder: sectionOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          const [ni] = await db.insert(accreditationFormItems).values({
            templateId: newId,
            sectionId,
            itemType: item.itemType || 'text',
            label: item.label || 'Field',
            placeholder: item.placeholder || null,
            helpText: item.helpText || null,
            isRequired: item.isRequired ?? false,
            scoreWeight: item.scoreWeight ?? 1,
            scaleMin: item.scaleMin ?? null,
            scaleMax: item.scaleMax ?? null,
            scaleMinLabel: item.scaleMinLabel || null,
            scaleMaxLabel: item.scaleMaxLabel || null,
            richTextContent: item.richTextContent && item.richTextContent !== '' ? item.richTextContent : null,
            emailRoutingRules: item.emailRoutingRules && item.emailRoutingRules !== '' ? item.emailRoutingRules : null,
            sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.field_key) diyFieldKeyToItemId[item.field_key] = itemId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(accreditationFormOptions).values({ itemId, label: opt.label, value: opt.value, qualityScore: opt.qualityScore ?? 0, sortOrder: optOrder++ });
            }
          }
        }
      }
      // Insert branch rules
      for (const rule of (parsed.branchRules ?? [])) {
        const targetItemId = diyFieldKeyToItemId[rule.targetFieldKey];
        const conditionItemId = diyFieldKeyToItemId[rule.conditionFieldKey];
        if (!targetItemId || !conditionItemId) continue;
        await db.insert(accreditationFormBranchRules).values({
          templateId: newId,
          targetItemId,
          conditionItemId,
          conditionValue: rule.conditionValue || '',
          action: (rule.action === 'hide' ? 'hide' : 'show') as 'show' | 'hide',
        });
      }
      return { id: newId, name: formName };
    }),

  /** Append AI-scaffolded fields from a URL to an existing DIY form template */
  appendFieldsFromUrl: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive(), url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const extracted_append_fb = await extractFormFromUrl(input.url);
      const pageText = extracted_append_fb.rawStructuredText || `Form fields from: ${input.url}`;
      const appendDiyItemSchema = { type: 'object', properties: { field_key: { type: 'string' }, itemType: { type: 'string' }, label: { type: 'string' }, placeholder: { type: 'string' }, helpText: { type: 'string' }, isRequired: { type: 'boolean' }, scoreWeight: { type: 'number' }, scaleMin: { type: ['number', 'null'] }, scaleMax: { type: ['number', 'null'] }, scaleMinLabel: { type: 'string' }, scaleMaxLabel: { type: 'string' }, richTextContent: { type: 'string' }, emailRoutingRules: { type: 'string' }, options: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, qualityScore: { type: 'number' } }, required: ['label', 'value', 'qualityScore'], additionalProperties: false } } }, required: ['field_key', 'itemType', 'label', 'placeholder', 'helpText', 'isRequired', 'scoreWeight', 'scaleMin', 'scaleMax', 'scaleMinLabel', 'scaleMaxLabel', 'richTextContent', 'emailRoutingRules', 'options'], additionalProperties: false };
      const appendDiyBranchSchema = { type: 'object', properties: { targetFieldKey: { type: 'string' }, conditionFieldKey: { type: 'string' }, conditionValue: { type: 'string' }, action: { type: 'string' } }, required: ['targetFieldKey', 'conditionFieldKey', 'conditionValue', 'action'], additionalProperties: false };
      const appendDiyAiSchema = { type: 'object', properties: { sections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, items: { type: 'array', items: appendDiyItemSchema } }, required: ['title', 'items'], additionalProperties: false } }, branchRules: { type: 'array', items: appendDiyBranchSchema } }, required: ['sections', 'branchRules'], additionalProperties: false };
      const aiResp = await invokeLLM({
        messages: [
          { role: 'system', content: `You are a form builder assistant. Extract ALL form fields, their types, options, placeholder text, help text, conditional/branching logic, scoring weights, and any calculated/computed fields from the page. Return structured JSON exactly matching the schema provided.\n\nFor calculated fields: use itemType "info" and put the formula/description in richTextContent as HTML.\nFor score thresholds: use itemType "info" with richTextContent describing the scoring bands.\nFor email routing: set emailRoutingRules as JSON array [{"label": string, "conditionItemId": 0, "conditionValue": string, "routeTo": string}].` },
          { role: 'user', content: `Extract all form fields, logic, calculations, and scoring from this page. Return JSON with sections and branchRules.\n\nPage content:\n${pageText}` },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'form_fields', strict: true, schema: appendDiyAiSchema } },
      });
      let parsed: any;
      try { parsed = JSON.parse(aiResp.choices[0].message.content as string); }
      catch { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI failed to parse fields. Please try again.' }); }
      const [maxSec] = await db.select({ max: sql<number>`COALESCE(MAX(sortOrder), 0)` }).from(accreditationFormSections).where(eq(accreditationFormSections.templateId, input.templateId));
      let sectionSortOrder = (maxSec?.max ?? 0) + 1;
      const appendDiyFieldKeyToItemId: Record<string, number> = {};
      let itemCount = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(accreditationFormSections).values({ templateId: input.templateId, title: section.title || 'Imported Fields', sortOrder: sectionSortOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          const [ni] = await db.insert(accreditationFormItems).values({
            templateId: input.templateId, sectionId,
            itemType: item.itemType || 'text',
            label: item.label || 'Field',
            placeholder: item.placeholder || null,
            helpText: item.helpText || null,
            isRequired: item.isRequired ?? false,
            scoreWeight: item.scoreWeight ?? 1,
            scaleMin: item.scaleMin ?? null,
            scaleMax: item.scaleMax ?? null,
            scaleMinLabel: item.scaleMinLabel || null,
            scaleMaxLabel: item.scaleMaxLabel || null,
            richTextContent: item.richTextContent && item.richTextContent !== '' ? item.richTextContent : null,
            emailRoutingRules: item.emailRoutingRules && item.emailRoutingRules !== '' ? item.emailRoutingRules : null,
            sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.field_key) appendDiyFieldKeyToItemId[item.field_key] = itemId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(accreditationFormOptions).values({ itemId, label: opt.label, value: opt.value, qualityScore: opt.qualityScore ?? 0, sortOrder: optOrder++ });
            }
          }
          itemCount++;
        }
      }
      // Insert branch rules
      for (const rule of (parsed.branchRules ?? [])) {
        const targetItemId = appendDiyFieldKeyToItemId[rule.targetFieldKey];
        const conditionItemId = appendDiyFieldKeyToItemId[rule.conditionFieldKey];
        if (!targetItemId || !conditionItemId) continue;
        await db.insert(accreditationFormBranchRules).values({
          templateId: input.templateId,
          targetItemId,
          conditionItemId,
          conditionValue: rule.conditionValue || '',
          action: (rule.action === 'hide' ? 'hide' : 'show') as 'show' | 'hide',
        });
      }
      return { itemCount };
    }),

  /** Update theme/branding settings for a DIY form template */
  updateTheme: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive(), themeSettings: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(accreditationFormTemplates)
        .set({ themeSettings: input.themeSettings, updatedAt: new Date() })
        .where(eq(accreditationFormTemplates.id, input.templateId));
      return { success: true };
    }),

  // ── Success Modules (mirrors generalForm.*) ───────────────────────────────

  /** List success modules for a DIY form template */
  listSuccessModules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [template] = await db.select().from(accreditationFormTemplates)
        .where(eq(accreditationFormTemplates.id, input.templateId)).limit(1);
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });
      await ensureLegacyAccreditationSuccessModules(db, template);
      const modules = await fetchAccreditationSuccessModules(db, input.templateId);
      const [freshTemplate] = await db.select().from(accreditationFormTemplates)
        .where(eq(accreditationFormTemplates.id, input.templateId)).limit(1);
      return { modules, defaultSuccessModuleId: freshTemplate?.defaultSuccessModuleId ?? null };
    }),

  /** Create or update a success module */
  upsertSuccessModule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      templateId: z.number(),
      name: z.string().min(1).max(200),
      moduleType: z.enum(['inline_message', 'full_page', 'redirect_url']),
      inlineContent: z.string().optional(),
      pageContent: z.string().optional(),
      redirectUrl: z.string().optional(),
      isEnabled: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { id, templateId, ...rest } = input;
      const values = { ...rest, templateId, updatedAt: new Date() };
      if (id) {
        await db.update(accreditationFormSuccessModules).set(values)
          .where(eq(accreditationFormSuccessModules.id, id));
        return { id };
      }
      const [result] = await db.insert(accreditationFormSuccessModules).values(values);
      const newId = (result as any).insertId;
      const [tpl] = await db.select().from(accreditationFormTemplates)
        .where(eq(accreditationFormTemplates.id, templateId)).limit(1);
      if (tpl && !tpl.defaultSuccessModuleId) {
        await db.update(accreditationFormTemplates)
          .set({ defaultSuccessModuleId: newId })
          .where(eq(accreditationFormTemplates.id, templateId));
      }
      return { id: newId };
    }),

  /** Duplicate a success module */
  duplicateSuccessModule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [mod] = await db.select().from(accreditationFormSuccessModules)
        .where(eq(accreditationFormSuccessModules.id, input.id)).limit(1);
      if (!mod) throw new TRPCError({ code: 'NOT_FOUND' });
      const [result] = await db.insert(accreditationFormSuccessModules).values({
        templateId: mod.templateId,
        name: mod.name + ' (Copy)',
        moduleType: mod.moduleType,
        inlineContent: mod.inlineContent,
        pageContent: mod.pageContent,
        redirectUrl: mod.redirectUrl,
        isEnabled: mod.isEnabled,
        sortOrder: mod.sortOrder + 1,
      });
      return { id: (result as any).insertId };
    }),

  /** Delete a success module */
  deleteSuccessModule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [mod] = await db.select().from(accreditationFormSuccessModules)
        .where(eq(accreditationFormSuccessModules.id, input.id)).limit(1);
      if (!mod) throw new TRPCError({ code: 'NOT_FOUND' });
      await db.delete(accreditationFormSuccessRoutingRules)
        .where(eq(accreditationFormSuccessRoutingRules.successModuleId, input.id));
      await db.delete(accreditationFormSuccessModules)
        .where(eq(accreditationFormSuccessModules.id, input.id));
      await clearAccreditationDefaultIfDeleted(db, mod.templateId, input.id);
      return { success: true };
    }),

  /** Set the default success module for a template */
  setDefaultSuccessModule: protectedProcedure
    .input(z.object({ templateId: z.number(), moduleId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      if (input.moduleId != null) {
        const [mod] = await db.select().from(accreditationFormSuccessModules)
          .where(and(
            eq(accreditationFormSuccessModules.id, input.moduleId),
            eq(accreditationFormSuccessModules.templateId, input.templateId),
          )).limit(1);
        if (!mod) throw new TRPCError({ code: 'NOT_FOUND', message: 'Success module not found for this form.' });
      }
      await db.update(accreditationFormTemplates)
        .set({ defaultSuccessModuleId: input.moduleId })
        .where(eq(accreditationFormTemplates.id, input.templateId));
      return { success: true };
    }),

  /** List success routing rules for a template */
  listSuccessRoutingRules: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return fetchAccreditationSuccessRoutingRules(db, input.templateId);
    }),

  /** Create or update a success routing rule */
  upsertSuccessRoutingRule: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      templateId: z.number(),
      ruleLabel: z.string().default(''),
      successModuleId: z.number(),
      logicOperator: z.enum(['all', 'any']).default('all'),
      conditions: z.string(),
      grantAccessActions: z.string().optional(), // JSON array of {productType, productId}
      // Per-rule Stripe checkout action
      stripeEnabled: z.boolean().default(false),
      stripePriceId: z.string().optional(),
      stripeAmount: z.number().optional(),
      stripeCheckoutMode: z.string().default('payment'),
      stripeSuccessUrl: z.string().optional(),
      stripeCancelUrl: z.string().optional(),
      sortOrder: z.number().default(0),
      isEnabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const [mod] = await db.select().from(accreditationFormSuccessModules)
        .where(and(
          eq(accreditationFormSuccessModules.id, input.successModuleId),
          eq(accreditationFormSuccessModules.templateId, input.templateId),
        )).limit(1);
      if (!mod) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid success module for this form.' });
      const { id, ...rest } = input;
      if (id) {
        await db.update(accreditationFormSuccessRoutingRules).set(rest)
          .where(eq(accreditationFormSuccessRoutingRules.id, id));
        return { id };
      }
      const [result] = await db.insert(accreditationFormSuccessRoutingRules).values(rest);
      return { id: (result as any).insertId };
    }),

  /** Delete a success routing rule */
  deleteSuccessRoutingRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(accreditationFormSuccessRoutingRules)
        .where(eq(accreditationFormSuccessRoutingRules.id, input.id));
      return { success: true };
    }),

  // ── DIY Form Deep Analytics ────────────────────────────────────────────────
  getDIYDeepFieldAnalytics: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const items = await db
        .select({ id: accreditationFormItems.id, label: accreditationFormItems.label, itemType: accreditationFormItems.itemType, sortOrder: accreditationFormItems.sortOrder })
        .from(accreditationFormItems)
        .where(eq(accreditationFormItems.templateId, input.templateId))
        .orderBy(asc(accreditationFormItems.sortOrder));
      const itemIds = items.map(i => i.id);
      const options = itemIds.length > 0
        ? await db.select({ itemId: accreditationFormOptions.itemId, label: accreditationFormOptions.label, value: accreditationFormOptions.value, sortOrder: accreditationFormOptions.sortOrder })
            .from(accreditationFormOptions).where(inArray(accreditationFormOptions.itemId, itemIds)).orderBy(asc(accreditationFormOptions.sortOrder))
        : [];
      const rawSubs = await db
        .select({ id: accreditationFormSubmissions.id, responses: accreditationFormSubmissions.responses, submittedAt: accreditationFormSubmissions.submittedAt, score: accreditationFormSubmissions.qualityScore, status: accreditationFormSubmissions.status })
        .from(accreditationFormSubmissions)
        .where(eq(accreditationFormSubmissions.templateId, input.templateId));
      const { computeFieldAnalytics, parseSubmissions } = await import('../../shared/formAnalyticsUtils');
      const submissions = parseSubmissions(rawSubs.map(s => ({ ...s, score: s.score ?? null })));
      const fieldAnalytics = computeFieldAnalytics(items as any, options as any, submissions);
      return {
        totalSubmissions: rawSubs.length,
        items: items.map(i => ({ id: i.id, label: i.label, itemType: i.itemType })),
        fieldAnalytics,
      };
    }),

  getDIYDropOffAnalytics: protectedProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
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

  getDIYMultiCrossTab: protectedProcedure
    .input(z.object({
      templateId: z.number().int().positive(),
      rowFieldId: z.number().int().positive(),
      colFieldIds: z.array(z.number().int().positive()).min(1).max(10),
    }))
    .query(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const items = await db
        .select({ id: accreditationFormItems.id, label: accreditationFormItems.label, itemType: accreditationFormItems.itemType, sortOrder: accreditationFormItems.sortOrder })
        .from(accreditationFormItems)
        .where(eq(accreditationFormItems.templateId, input.templateId))
        .orderBy(asc(accreditationFormItems.sortOrder));
      const itemIds = items.map(i => i.id);
      const options = itemIds.length > 0
        ? await db.select({ itemId: accreditationFormOptions.itemId, label: accreditationFormOptions.label, value: accreditationFormOptions.value, sortOrder: accreditationFormOptions.sortOrder })
            .from(accreditationFormOptions).where(inArray(accreditationFormOptions.itemId, itemIds)).orderBy(asc(accreditationFormOptions.sortOrder))
        : [];
      const rawSubs = await db
        .select({ id: accreditationFormSubmissions.id, responses: accreditationFormSubmissions.responses, submittedAt: accreditationFormSubmissions.submittedAt, score: accreditationFormSubmissions.qualityScore, status: accreditationFormSubmissions.status })
        .from(accreditationFormSubmissions)
        .where(eq(accreditationFormSubmissions.templateId, input.templateId));
      const { computeMultiCrossTab, parseSubmissions } = await import('../../shared/formAnalyticsUtils');
      const submissions = parseSubmissions(rawSubs.map(s => ({ ...s, score: s.score ?? null })));
      return computeMultiCrossTab(items as any, options as any, submissions, input.rowFieldId, input.colFieldIds);
    }),

  /** List all grantable products (courses, downloads, bundles, physical) for the AccessGrantActionsEditor */
  listGrantableProducts: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    const [courses, downloads, bundles, physical] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, status: lmsCourses.status })
        .from(lmsCourses)
        .where(sql`${lmsCourses.status} != 'archived'`)
        .orderBy(asc(lmsCourses.title)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, status: digitalProducts.status })
        .from(digitalProducts)
        .where(sql`${digitalProducts.status} != 'archived'`)
        .orderBy(asc(digitalProducts.title)),
      db.select({ id: digitalBundles.id, title: digitalBundles.title })
        .from(digitalBundles)
        .orderBy(asc(digitalBundles.title)),
      db.select({ id: physicalProducts.id, title: physicalProducts.title, status: physicalProducts.status })
        .from(physicalProducts)
        .where(sql`${physicalProducts.status} != 'archived'`)
        .orderBy(asc(physicalProducts.title)),
    ]);
    return {
      courses: courses.map(c => ({ id: c.id, title: c.title, status: c.status })),
      downloads: downloads.map(d => ({ id: d.id, title: d.title, status: d.status })),
      bundles: bundles.map(b => ({ id: b.id, title: b.title })),
      physical: physical.map(p => ({ id: p.id, title: p.title, status: p.status })),
    };
  }),

  /** Create a Stripe product + one-time price and return the price ID */
  createStripeProduct: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      amountCents: z.number().int().min(50), // Stripe minimum $0.50
      currency: z.string().default('usd'),
      mode: z.enum(['payment', 'subscription']).default('payment'),
      interval: z.enum(['month', 'year']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const stripe = getStripeClient();
      const product = await stripe.products.create({
        name: input.name,
        description: input.description ?? undefined,
      });
      let price;
      if (input.mode === 'subscription' && input.interval) {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: input.amountCents,
          currency: input.currency,
          recurring: { interval: input.interval },
        });
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: input.amountCents,
          currency: input.currency,
        });
      }
      return { productId: product.id, priceId: price.id };
    }),
});
