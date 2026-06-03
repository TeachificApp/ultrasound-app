/**
 * accreditationFormSuccessModulesDb.ts
 * DB helpers for accreditation/DIY form success module CRUD and lifecycle.
 * Mirrors formSuccessModulesDb.ts but uses accreditationForm* tables.
 */
import {
  accreditationFormTemplates,
  accreditationFormSuccessModules,
  accreditationFormSuccessRoutingRules,
} from "../../drizzle/schema";
import { eq, asc, and } from "drizzle-orm";

export async function createDefaultAccreditationSuccessModule(
  db: any,
  templateId: number,
  opts?: { inlineContent?: string; redirectUrl?: string; name?: string },
) {
  const hasRedirect = !!opts?.redirectUrl;
  const [result] = await db.insert(accreditationFormSuccessModules).values({
    templateId,
    name: opts?.name ?? (hasRedirect ? "Default Redirect" : "Default Thank You"),
    moduleType: hasRedirect ? "redirect_url" : "inline_message",
    inlineContent: hasRedirect ? null : (opts?.inlineContent ?? "Thank you for your submission!"),
    redirectUrl: hasRedirect ? opts!.redirectUrl : null,
    sortOrder: 0,
  });
  const moduleId = (result as any).insertId;
  await db.update(accreditationFormTemplates)
    .set({ defaultSuccessModuleId: moduleId })
    .where(eq(accreditationFormTemplates.id, templateId));
  return moduleId;
}

export async function ensureLegacyAccreditationSuccessModules(
  db: any,
  template: typeof accreditationFormTemplates.$inferSelect,
) {
  const existing = await db.select().from(accreditationFormSuccessModules)
    .where(eq(accreditationFormSuccessModules.templateId, template.id))
    .orderBy(asc(accreditationFormSuccessModules.sortOrder));
  if (existing.length > 0) return existing;

  await createDefaultAccreditationSuccessModule(db, template.id, {
    inlineContent: template.successMessage ?? "Thank you for your submission!",
    redirectUrl: template.successRedirectUrl ?? undefined,
    name: template.successRedirectUrl ? "Default Redirect" : "Default Thank You",
  });

  return db.select().from(accreditationFormSuccessModules)
    .where(eq(accreditationFormSuccessModules.templateId, template.id))
    .orderBy(asc(accreditationFormSuccessModules.sortOrder));
}

export async function fetchAccreditationSuccessModules(db: any, templateId: number) {
  return db.select().from(accreditationFormSuccessModules)
    .where(eq(accreditationFormSuccessModules.templateId, templateId))
    .orderBy(asc(accreditationFormSuccessModules.sortOrder));
}

export async function fetchAccreditationSuccessRoutingRules(db: any, templateId: number) {
  return db.select().from(accreditationFormSuccessRoutingRules)
    .where(eq(accreditationFormSuccessRoutingRules.templateId, templateId))
    .orderBy(asc(accreditationFormSuccessRoutingRules.sortOrder));
}

export async function copyAccreditationSuccessModulesForDuplicate(
  db: any,
  sourceTemplateId: number,
  newTemplateId: number,
  oldDefaultModuleId: number | null,
): Promise<number | null> {
  const modules = await fetchAccreditationSuccessModules(db, sourceTemplateId);
  const moduleIdMap: Record<number, number> = {};
  for (const mod of modules) {
    const [nm] = await db.insert(accreditationFormSuccessModules).values({
      ...mod,
      id: undefined as any,
      templateId: newTemplateId,
      createdAt: undefined as any,
      updatedAt: undefined as any,
    });
    moduleIdMap[mod.id] = (nm as any).insertId;
  }
  if (oldDefaultModuleId && moduleIdMap[oldDefaultModuleId]) {
    await db.update(accreditationFormTemplates).set({
      defaultSuccessModuleId: moduleIdMap[oldDefaultModuleId],
    }).where(eq(accreditationFormTemplates.id, newTemplateId));
    return moduleIdMap[oldDefaultModuleId];
  }
  return null;
}

export async function copyAccreditationSuccessRoutingRulesForDuplicate(
  db: any,
  sourceTemplateId: number,
  newTemplateId: number,
  moduleIdMap: Record<number, number>,
) {
  const rules = await fetchAccreditationSuccessRoutingRules(db, sourceTemplateId);
  for (const rule of rules) {
    const mappedModuleId = moduleIdMap[rule.successModuleId];
    if (!mappedModuleId) continue;
    await db.insert(accreditationFormSuccessRoutingRules).values({
      ...rule,
      id: undefined as any,
      templateId: newTemplateId,
      successModuleId: mappedModuleId,
      createdAt: undefined as any,
    });
  }
}

export async function deleteAccreditationSuccessDataForForm(db: any, templateId: number) {
  const modules = await db.select({ id: accreditationFormSuccessModules.id })
    .from(accreditationFormSuccessModules)
    .where(eq(accreditationFormSuccessModules.templateId, templateId));
  for (const m of modules) {
    await db.delete(accreditationFormSuccessRoutingRules)
      .where(eq(accreditationFormSuccessRoutingRules.successModuleId, m.id));
  }
  await db.delete(accreditationFormSuccessRoutingRules)
    .where(eq(accreditationFormSuccessRoutingRules.templateId, templateId));
  await db.delete(accreditationFormSuccessModules)
    .where(eq(accreditationFormSuccessModules.templateId, templateId));
}

export async function buildAccreditationModuleIdMapForDuplicate(
  db: any,
  sourceTemplateId: number,
  newTemplateId: number,
) {
  const modules = await fetchAccreditationSuccessModules(db, sourceTemplateId);
  const moduleIdMap: Record<number, number> = {};
  for (const mod of modules) {
    const [nm] = await db.insert(accreditationFormSuccessModules).values({
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

export async function clearAccreditationDefaultIfDeleted(
  db: any,
  templateId: number,
  deletedModuleId: number,
) {
  const [tpl] = await db.select().from(accreditationFormTemplates)
    .where(eq(accreditationFormTemplates.id, templateId))
    .limit(1);
  if (tpl?.defaultSuccessModuleId !== deletedModuleId) return;
  const [remaining] = await db.select().from(accreditationFormSuccessModules)
    .where(and(
      eq(accreditationFormSuccessModules.templateId, templateId),
      eq(accreditationFormSuccessModules.isEnabled, true),
    ))
    .orderBy(asc(accreditationFormSuccessModules.sortOrder))
    .limit(1);
  await db.update(accreditationFormTemplates)
    .set({ defaultSuccessModuleId: remaining?.id ?? null })
    .where(eq(accreditationFormTemplates.id, templateId));
}
