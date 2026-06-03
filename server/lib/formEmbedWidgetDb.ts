import { randomUUID } from "crypto";
import {
  generalFormEmbedWidgets,
  generalFormEmbedAnalytics,
} from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { defaultEmbedWidgetSettings, parseAllowedDomains } from "@shared/formEmbedWidgetTypes";

export async function ensureEmbedWidget(db: any, templateId: number) {
  const rows = await db.select().from(generalFormEmbedWidgets)
    .where(eq(generalFormEmbedWidgets.templateId, templateId))
    .orderBy(asc(generalFormEmbedWidgets.id))
    .limit(1);
  if (rows[0]) return rows[0];

  const widgetKey = randomUUID().replace(/-/g, "");
  const [result] = await db.insert(generalFormEmbedWidgets).values({
    templateId,
    widgetKey,
    name: "Default Widget",
    isEnabled: false,
    displayType: "inline",
    settingsJson: JSON.stringify(defaultEmbedWidgetSettings()),
    domainMode: "all",
    allowedDomains: JSON.stringify([]),
  });
  const id = (result as any).insertId;
  const [created] = await db.select().from(generalFormEmbedWidgets).where(eq(generalFormEmbedWidgets.id, id)).limit(1);
  return created!;
}

export async function deleteEmbedDataForForm(db: any, templateId: number) {
  await db.delete(generalFormEmbedAnalytics).where(eq(generalFormEmbedAnalytics.templateId, templateId));
  await db.delete(generalFormEmbedWidgets).where(eq(generalFormEmbedWidgets.templateId, templateId));
}

export { parseAllowedDomains };
