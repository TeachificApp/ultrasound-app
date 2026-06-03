/**
 * formEmbedRoutes.ts — public CORS endpoints for embed.js on external sites.
 */
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import {
  generalFormEmbedWidgets,
  generalFormEmbedAnalytics,
  generalFormTemplates,
} from "../../drizzle/schema";
import { and, eq, sql, count } from "drizzle-orm";
import { isDomainAllowed, extractHostFromUrl, normalizeDomain } from "../lib/formEmbedDomainAllowlist";
import { parseAllowedDomains, parseEmbedSettings } from "@shared/formEmbedWidgetTypes";

function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function detectDeviceType(ua: string | undefined): string {
  if (!ua) return "unknown";
  if (/mobile|android|iphone|ipod/i.test(ua)) return "mobile";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export function registerFormEmbedRoutes(app: Express) {
  app.options("/api/form-embed/config", (_req, res) => {
    setCors(res);
    res.sendStatus(204);
  });

  app.options("/api/form-embed/event", (_req, res) => {
    setCors(res);
    res.sendStatus(204);
  });

  app.get("/api/form-embed/config", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const formId = parseInt(String(req.query.formId ?? ""), 10);
      const widgetKey = String(req.query.widgetId ?? req.query.widgetKey ?? "");
      const hostParam = String(req.query.host ?? "");
      const referrer = req.get("referer") ?? req.get("origin") ?? "";
      const host = hostParam || extractHostFromUrl(referrer);

      if (!formId || !widgetKey) {
        res.status(400).json({ allowed: false, error: "Missing formId or widgetId" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ allowed: false, error: "DB unavailable" });
        return;
      }

      const [widget] = await db.select().from(generalFormEmbedWidgets)
        .where(and(eq(generalFormEmbedWidgets.templateId, formId), eq(generalFormEmbedWidgets.widgetKey, widgetKey)))
        .limit(1);
      if (!widget || !widget.isEnabled) {
        res.status(403).json({ allowed: false, error: "Embed not enabled" });
        return;
      }

      const [template] = await db.select().from(generalFormTemplates)
        .where(eq(generalFormTemplates.id, formId)).limit(1);
      if (!template?.isPublic || !template.publicSlug) {
        res.status(403).json({ allowed: false, error: "Form not public" });
        return;
      }

      const allowedDomains = parseAllowedDomains(widget.allowedDomains);
      const domainOk = isDomainAllowed(host, widget.domainMode as "all" | "allowlist", allowedDomains);
      if (!domainOk) {
        res.status(403).json({ allowed: false, error: "Domain not authorized" });
        return;
      }

      const hostDomain = template.hostDomain ?? "app.allaboutultrasound.com";
      const protocol = req.protocol === "https" ? "https" : "https";
      const baseUrl = `${protocol}://${hostDomain}`;
      const embedUrl = `${baseUrl}/forms/${template.publicSlug}/embed?widget=${encodeURIComponent(widgetKey)}`;
      const settings = parseEmbedSettings(widget.settingsJson);

      if (settings.analytics.trackLoads) {
        await db.insert(generalFormEmbedAnalytics).values({
          templateId: formId,
          widgetId: widget.id,
          eventType: "widget_loaded",
          triggerSource: "config_fetch",
          deviceType: detectDeviceType(req.get("user-agent")),
          hostDomain: normalizeDomain(host),
          sessionKey: String(req.query.sessionKey ?? "").slice(0, 64) || null,
        });
      }

      res.json({
        allowed: true,
        formId,
        widgetId: widget.id,
        widgetKey: widget.widgetKey,
        formSlug: template.publicSlug,
        displayType: widget.displayType,
        settings,
        embedUrl,
        scriptBaseUrl: baseUrl,
        apiBaseUrl: baseUrl,
      });
    } catch (e: any) {
      res.status(500).json({ allowed: false, error: e.message ?? "Server error" });
    }
  });

  app.post("/api/form-embed/event", async (req: Request, res: Response) => {
    setCors(res);
    try {
      const {
        formId,
        widgetKey,
        eventType,
        triggerSource,
        sessionKey,
        host,
        metadata,
      } = req.body ?? {};

      if (!formId || !widgetKey || !eventType) {
        res.status(400).json({ ok: false, error: "Missing required fields" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(503).json({ ok: false });
        return;
      }

      const [widget] = await db.select().from(generalFormEmbedWidgets)
        .where(and(eq(generalFormEmbedWidgets.templateId, formId), eq(generalFormEmbedWidgets.widgetKey, widgetKey)))
        .limit(1);
      if (!widget?.isEnabled) {
        res.status(403).json({ ok: false });
        return;
      }

      const referrer = req.get("referer") ?? req.get("origin") ?? "";
      const hostDomain = normalizeDomain(host || extractHostFromUrl(referrer));
      const allowedDomains = parseAllowedDomains(widget.allowedDomains);
      if (!isDomainAllowed(hostDomain, widget.domainMode as "all" | "allowlist", allowedDomains)) {
        res.status(403).json({ ok: false });
        return;
      }

      await db.insert(generalFormEmbedAnalytics).values({
        templateId: formId,
        widgetId: widget.id,
        eventType: String(eventType).slice(0, 40),
        triggerSource: triggerSource ? String(triggerSource).slice(0, 80) : null,
        deviceType: detectDeviceType(req.get("user-agent")),
        hostDomain: hostDomain || null,
        sessionKey: sessionKey ? String(sessionKey).slice(0, 64) : null,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      });

      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });
}

export async function getEmbedAnalyticsSummary(db: any, templateId: number) {
  const rows = await db.execute(sql`
    SELECT eventType, COUNT(*) as cnt
    FROM generalFormEmbedAnalytics
    WHERE templateId = ${templateId}
    GROUP BY eventType
  `);
  const byEvent: Record<string, number> = {};
  for (const row of (rows[0] as unknown as any[]) ?? []) {
    byEvent[String(row.eventType)] = Number(row.cnt);
  }
  const loaded = byEvent.widget_loaded ?? 0;
  const viewed = byEvent.widget_viewed ?? 0;
  const opened = byEvent.widget_opened ?? 0;
  const started = byEvent.form_started ?? 0;
  const submitted = byEvent.form_submitted ?? 0;
  const conversionRate = opened > 0 ? Math.round((submitted / opened) * 100) : 0;

  const triggerRows = await db.execute(sql`
    SELECT triggerSource, COUNT(*) as cnt
    FROM generalFormEmbedAnalytics
    WHERE templateId = ${templateId} AND triggerSource IS NOT NULL
    GROUP BY triggerSource
    ORDER BY cnt DESC
    LIMIT 10
  `);

  const deviceRows = await db.execute(sql`
    SELECT deviceType, COUNT(*) as cnt
    FROM generalFormEmbedAnalytics
    WHERE templateId = ${templateId} AND deviceType IS NOT NULL
    GROUP BY deviceType
  `);

  return {
    byEvent,
    loaded,
    viewed,
    opened,
    closed: byEvent.widget_closed ?? 0,
    started,
    submitted,
    conversionRate,
    triggerSources: (triggerRows[0] as unknown as any[]) ?? [],
    deviceBreakdown: (deviceRows[0] as unknown as any[]) ?? [],
  };
}
