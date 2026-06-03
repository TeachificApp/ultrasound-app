/**
 * formSuccessModulesDb.ts — DB helpers for success module CRUD and legacy migration.
 */
import {
  generalFormTemplates,
  generalFormSuccessModules,
  generalFormSuccessRoutingRules,
} from "../../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";

export async function createDefaultSuccessModule(
  db: any,
  templateId: number,
  opts?: { inlineContent?: string; redirectUrl?: string; name?: string },
) {
  const hasRedirect = !!opts?.redirectUrl;
  const [result] = await db.insert(generalFormSuccessModules).values({
    templateId,
    name: opts?.name ?? (hasRedirect ? "Default Redirect" : "Default Thank You"),
    moduleType: hasRedirect ? "redirect_url" : "inline_message",
    inlineContent: hasRedirect ? null : (opts?.inlineContent ?? "Thank you for your submission!"),
    redirectUrl: hasRedirect ? opts!.redirectUrl : null,
    sortOrder: 0,
  });
  const moduleId = (result as any).insertId;
  await db.update(generalFormTemplates).set({ defaultSuccessModuleId: moduleId }).where(eq(generalFormTemplates.id, templateId));
  return moduleId;
}

export async function ensureLegacySuccessModules(db: any, template: typeof generalFormTemplates.$inferSelect) {
  const existing = await db.select().from(generalFormSuccessModules)
    .where(eq(generalFormSuccessModules.templateId, template.id))
    .orderBy(asc(generalFormSuccessModules.sortOrder));
  if (existing.length > 0) return existing;

  await createDefaultSuccessModule(db, template.id, {
    inlineContent: template.successMessage ?? "Thank you for your submission!",
    redirectUrl: template.successRedirectUrl ?? undefined,
    name: template.successRedirectUrl ? "Default Redirect" : "Default Thank You",
  });

  return db.select().from(generalFormSuccessModules)
    .where(eq(generalFormSuccessModules.templateId, template.id))
    .orderBy(asc(generalFormSuccessModules.sortOrder));
}

export async function fetchSuccessModules(db: any, templateId: number) {
  return db.select().from(generalFormSuccessModules)
    .where(eq(generalFormSuccessModules.templateId, templateId))
    .orderBy(asc(generalFormSuccessModules.sortOrder));
}

export async function fetchSuccessRoutingRules(db: any, templateId: number) {
  return db.select().from(generalFormSuccessRoutingRules)
    .where(eq(generalFormSuccessRoutingRules.templateId, templateId))
    .orderBy(asc(generalFormSuccessRoutingRules.sortOrder));
}

export async function copySuccessModulesForDuplicate(
  db: any,
  sourceTemplateId: number,
  newTemplateId: number,
  oldDefaultModuleId: number | null,
): Promise<number | null> {
  const modules = await fetchSuccessModules(db, sourceTemplateId);
  const moduleIdMap: Record<number, number> = {};
  for (const mod of modules) {
    const [nm] = await db.insert(generalFormSuccessModules).values({
      ...mod,
      id: undefined as any,
      templateId: newTemplateId,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    });
    moduleIdMap[mod.id] = (nm as any).insertId;
  }
  if (oldDefaultModuleId && moduleIdMap[oldDefaultModuleId]) {
    await db.update(generalFormTemplates).set({
      defaultSuccessModuleId: moduleIdMap[oldDefaultModuleId],
    }).where(eq(generalFormTemplates.id, newTemplateId));
    return moduleIdMap[oldDefaultModuleId];
  }
  return null;
}

export async function copySuccessRoutingRulesForDuplicate(
  db: any,
  sourceTemplateId: number,
  newTemplateId: number,
  moduleIdMap: Record<number, number>,
) {
  const rules = await fetchSuccessRoutingRules(db, sourceTemplateId);
  for (const rule of rules) {
    const mappedModuleId = moduleIdMap[rule.successModuleId];
    if (!mappedModuleId) continue;
    await db.insert(generalFormSuccessRoutingRules).values({
      ...rule,
      id: undefined as any,
      templateId: newTemplateId,
      successModuleId: mappedModuleId,
      createdAt: undefined as any,
    });
  }
}

export async function deleteSuccessDataForForm(db: any, templateId: number) {
  const modules = await db.select({ id: generalFormSuccessModules.id }).from(generalFormSuccessModules)
    .where(eq(generalFormSuccessModules.templateId, templateId));
  for (const m of modules) {
    await db.delete(generalFormSuccessRoutingRules).where(eq(generalFormSuccessRoutingRules.successModuleId, m.id));
  }
  await db.delete(generalFormSuccessRoutingRules).where(eq(generalFormSuccessRoutingRules.templateId, templateId));
  await db.delete(generalFormSuccessModules).where(eq(generalFormSuccessModules.templateId, templateId));
}

export async function buildModuleIdMapForDuplicate(db: any, sourceTemplateId: number, newTemplateId: number) {
  const modules = await fetchSuccessModules(db, sourceTemplateId);
  const moduleIdMap: Record<number, number> = {};
  for (const mod of modules) {
    const [nm] = await db.insert(generalFormSuccessModules).values({
      ...mod,
      id: undefined as any,
      templateId: newTemplateId,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    });
    moduleIdMap[mod.id] = (nm as any).insertId;
  }
  return moduleIdMap;
}

export async function clearDefaultIfDeleted(db: any, templateId: number, deletedModuleId: number) {
  const [tpl] = await db.select().from(generalFormTemplates).where(eq(generalFormTemplates.id, templateId)).limit(1);
  if (tpl?.defaultSuccessModuleId !== deletedModuleId) return;
  const [remaining] = await db.select().from(generalFormSuccessModules)
    .where(and(eq(generalFormSuccessModules.templateId, templateId), eq(generalFormSuccessModules.isEnabled, true)))
    .orderBy(asc(generalFormSuccessModules.sortOrder))
    .limit(1);
  await db.update(generalFormTemplates).set({ defaultSuccessModuleId: remaining?.id ?? null }).where(eq(generalFormTemplates.id, templateId));
}
