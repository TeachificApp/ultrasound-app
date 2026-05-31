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
} from "../../drizzle/schema";
import { eq, desc, asc, and, sql, like, count, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { addToEmailList, addToAllContacts } from "../lib/emailListHelper";

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
      await db.update(generalFormTemplates).set({ themeSettings: input.themeSettings, updatedAt: new Date() }).where(eq(generalFormTemplates.id, input.id));
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
      // Fetch page content
      let pageText = "";
      try {
        const res = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
        const html = await res.text();
        pageText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 4000);
      } catch {
        pageText = `Form from: ${input.url}`;
      }
      // AI scaffold
      const aiResp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a form builder assistant. Given a web page or form description, extract or infer the form fields and return structured JSON." },
          { role: "user", content: `Create a form based on this page content. Return JSON with: { "name": string, "description": string, "sections": [{ "title": string, "items": [{ "itemType": "text"|"textarea"|"email"|"phone"|"number"|"select"|"radio"|"checkbox"|"date"|"heading"|"paragraph", "label": string, "isRequired": boolean, "options": [{"label": string, "value": string}] }] }] }\n\nPage content:\n${pageText}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "form_scaffold", strict: true, schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: { type: "object", properties: { itemType: { type: "string" }, label: { type: "string" }, isRequired: { type: "boolean" }, options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"], additionalProperties: false } } }, required: ["itemType", "label", "isRequired", "options"], additionalProperties: false } } }, required: ["title", "items"], additionalProperties: false } } }, required: ["name", "description", "sections"], additionalProperties: false } } },
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
      let sortOrder = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(generalFormSections).values({ templateId: newId, title: section.title || "Section", sortOrder: sortOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          const [ni] = await db.insert(generalFormItems).values({
            templateId: newId, sectionId, itemType: item.itemType || "text", label: item.label || "Field", isRequired: item.isRequired ?? false, sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, sortOrder: optOrder++ });
            }
          }
        }
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
      // Fetch page content
      let pageText = "";
      try {
        const res = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
        const html = await res.text();
        // Better HTML extraction: strip scripts/styles first, then tags
        pageText = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .substring(0, 5000);
      } catch {
        pageText = `Form from: ${input.url}`;
      }
      // AI scaffold
      const aiResp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a form builder assistant. Extract form fields from a web page and return structured JSON. Focus on actual form questions, input fields, and survey items. Ignore navigation, ads, and boilerplate text." },
          { role: "user", content: `Extract form fields from this page and return JSON with: { "sections": [{ "title": string, "items": [{ "itemType": "short_text"|"long_text"|"email"|"phone"|"number"|"dropdown"|"radio"|"checkbox"|"date"|"heading"|"paragraph", "label": string, "isRequired": boolean, "options": [{"label": string, "value": string}] }] }] }\n\nPage content:\n${pageText}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "form_fields", strict: true, schema: { type: "object", properties: { sections: { type: "array", items: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: { type: "object", properties: { itemType: { type: "string" }, label: { type: "string" }, isRequired: { type: "boolean" }, options: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"], additionalProperties: false } } }, required: ["itemType", "label", "isRequired", "options"], additionalProperties: false } } }, required: ["title", "items"], additionalProperties: false } } }, required: ["sections"], additionalProperties: false } } },
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
      let addedCount = 0;
      for (const section of (parsed.sections ?? [])) {
        const [ns] = await db.insert(generalFormSections).values({ templateId: input.templateId, title: section.title || "Imported Section", sortOrder: sortOrder++ });
        const sectionId = (ns as any).insertId;
        let itemOrder = 0;
        for (const item of (section.items ?? [])) {
          const [ni] = await db.insert(generalFormItems).values({
            templateId: input.templateId, sectionId, itemType: item.itemType || "short_text", label: item.label || "Field", isRequired: item.isRequired ?? false, sortOrder: itemOrder++,
          });
          const itemId = (ni as any).insertId;
          if (item.options?.length > 0) {
            let optOrder = 0;
            for (const opt of item.options) {
              await db.insert(generalFormOptions).values({ itemId, label: opt.label, value: opt.value, sortOrder: optOrder++ });
            }
          }
          addedCount++;
        }
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
      const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, template.id)).orderBy(asc(generalFormItems.sortOrder));
      const options = items.length > 0
        ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id))).orderBy(asc(generalFormOptions.sortOrder))
        : [];
      const branchRules = await db.select().from(generalFormBranchRules).where(eq(generalFormBranchRules.templateId, template.id));
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
      const items = await db.select({ id: generalFormItems.id, label: generalFormItems.label, itemType: generalFormItems.itemType, sortOrder: generalFormItems.sortOrder })
        .from(generalFormItems)
        .where(eq(generalFormItems.templateId, input.templateId))
        .orderBy(asc(generalFormItems.sortOrder));
      return { submissions, total: total as number, items };
    }),

  // ── PUBLIC: Submit form ───────────────────────────────────────────────────
  submitForm: publicProcedure
    .input(z.object({
      templateId: z.number(),
      responses: z.string(), // JSON: Record<itemId, value>
      userId: z.number().optional(),
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
      // Calculate score if enabled
      let score = 0;
      let maxScore = 0;
      if (template.scoreEnabled) {
        const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, input.templateId));
        const options = items.length > 0
          ? await db.select().from(generalFormOptions).where(inArray(generalFormOptions.itemId, items.map((i: any) => i.id)))
          : [];
        const responses: Record<string, any> = JSON.parse(input.responses);
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
        responses: input.responses,
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
        const parsedResponses: Record<string, any> = JSON.parse(input.responses);
        syncSubmissionToSheets(input.templateId, parsedResponses, new Date()).catch((err: any) => {
          console.error("[GoogleSheets] Sync failed for form", input.templateId, err.message);
        });
      } catch {}
      // Fire-and-forget Email List subscription (non-blocking)
      const submissionId = (result as any).insertId;
      ;(async () => {
        try {
          // Extract submitter email from responses
          const parsedResponses: Record<string, any> = JSON.parse(input.responses);
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
          const [webhookRow] = await db.select().from(generalFormWebhooks)
            .where(eq(generalFormWebhooks.formId, input.templateId)).limit(1);
          if (webhookRow?.isEnabled && webhookRow.webhookUrl) {
            const payload = JSON.stringify({
              event: "submission",
              formId: input.templateId,
              submissionId,
              timestamp: new Date().toISOString(),
              responses: JSON.parse(input.responses),
              score: template.scoreEnabled ? { score, maxScore } : undefined,
            });
            let signature = "";
            if (webhookRow.secret) {
              const { createHmac } = await import("crypto");
              signature = createHmac("sha256", webhookRow.secret).update(payload).digest("hex");
            }
            const res = await fetch(webhookRow.webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(signature ? { "X-Signature-256": `sha256=${signature}` } : {}),
              },
              body: payload,
              signal: AbortSignal.timeout(15000),
            });
            const statusCode = res.status;
            await db.update(generalFormWebhooks).set({
              lastTriggeredAt: Date.now(),
              lastStatus: statusCode >= 200 && statusCode < 300 ? "success" : "error",
              lastStatusCode: statusCode,
            }).where(eq(generalFormWebhooks.id, webhookRow.id));
          }
        } catch (e: any) {
          console.error("[Webhook] Delivery failed for form", input.templateId, e.message);
        }
      })();
      return { id: submissionId, score, maxScore };
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
});
