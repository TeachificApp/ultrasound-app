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
import { eq, sql, and } from "drizzle-orm";
import {
  accreditationFormTemplates,
  accreditationFormSections,
  accreditationFormItems,
  accreditationFormOptions,
  accreditationFormBranchRules,
} from "../../drizzle/schema";

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
const branchActionEnum = z.enum(["show", "hide"]);

const optionSchema = z.object({
  id: z.number().optional(),
  label: z.string().min(1),
  value: z.string().min(1),
  sortOrder: z.number().default(0),
  qualityScore: z.number().min(0).max(100).default(0),
});

const branchRuleSchema = z.object({
  id: z.number().optional(),
  targetItemId: z.number(),
  conditionItemId: z.number(),
  conditionValue: z.string(),
  action: branchActionEnum.default("show"),
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
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
      const { id, ...data } = input;
      await updateFormTemplate(id, data);
      return { success: true };
    }),

  /** Delete a template and all its data */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx);
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
        await createFormBranchRule({
          templateId: input.templateId,
          targetItemId: rule.targetItemId,
          conditionItemId: rule.conditionItemId,
          conditionValue: rule.conditionValue,
          action: rule.action,
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
      const id = await createFormSubmission({
        templateId: input.templateId,
        formType: input.formType,
        submittedByUserId: ctx.user.id,
        orgId: input.orgId ?? null,
        reviewTargetType: input.reviewTargetType ?? null,
        reviewTargetId: input.reviewTargetId ?? null,
        responses: JSON.stringify(input.responses),
        qualityScore: input.qualityScore,
        maxPossibleScore: input.maxPossibleScore,
        status: 'submitted',
      });
      return { id };
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
      let pageText = '';
      try {
        const res = await fetch(input.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormImporter/1.0)' },
          signal: AbortSignal.timeout(12000),
          redirect: 'follow',
        });
        const html = await res.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ').trim().substring(0, 5000);
      } catch (err: any) {
        console.error('[importFormByUrl] fetch error:', err?.message);
        pageText = `Form from: ${input.url}`;
      }
      // AI scaffold with rich metadata + branching + calculations
      const diySystemPrompt = `You are a form builder assistant. Given a web page or form description, extract or infer ALL form fields, their types, options, placeholder text, help text, conditional/branching logic, scoring weights, and any calculated/computed fields. Return structured JSON exactly matching the schema provided.

For calculated fields: use itemType "info" and put the formula/description in richTextContent as HTML.
For score thresholds: use itemType "info" with richTextContent describing the scoring bands.
For email routing: if a field routes submissions to different emails, set emailRoutingRules as JSON array [{"label": string, "conditionItemId": 0, "conditionValue": string, "routeTo": string}].
For score weights: assign scoreWeight (0-100) to each scored field based on importance.`;
      const diyUserPrompt = `Create a complete form from this page. Extract ALL fields, logic, calculations, and scoring. Return JSON:
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
- If the form has calculated outputs (total score, risk level, etc.), create an "info" item with richTextContent describing the calculation.
- If the form has score thresholds (e.g. 0-10=low risk, 11-20=high risk), add an "info" item with richTextContent listing the bands.
- Capture ALL conditional logic including skip patterns.
- Use scoreWeight on each field to reflect its relative importance in scoring.

Page content:
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
      let pageText = '';
      try {
        const res = await fetch(input.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormImporter/1.0)' },
          signal: AbortSignal.timeout(12000), redirect: 'follow',
        });
        const html = await res.text();
        pageText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000);
      } catch (err: any) {
        console.error('[appendFieldsFromUrl] fetch error:', err?.message);
        pageText = `Form fields from: ${input.url}`;
      }
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
});
