/**
 * Form Builder Router
 * Platform-admin-only CRUD for accreditation review form templates.
 * Supports: templates, sections, items, options, branching rules.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserRoles } from "../db";
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
} from "../db";

// ─── Guard helper ─────────────────────────────────────────────────────────────

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
      const itemId = await createFormItem({
        sectionId: itemData.sectionId,
        templateId: itemData.templateId,
        label: itemData.label,
        helpText: itemData.helpText ?? null,
        itemType: itemData.itemType,
        isRequired: itemData.isRequired,
        sortOrder: itemData.sortOrder,
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
});
