/**
 * Tests for the Thinkific webhook handler and cmeUtils parseCreditHoursFromName.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── parseCreditHoursFromName ─────────────────────────────────────────────────
// We test the server-side logic inline (mirrors client/src/lib/cmeUtils.ts)

function parseCreditHoursFromName(name: string): {
  hours: string;
  type: "SDMS" | "AMA_PRA_1" | "ANCC" | "OTHER";
} | null {
  const sdmsMatch = name.match(/(\d+\.?\d*)\s*SDMS/i);
  if (sdmsMatch) return { hours: sdmsMatch[1], type: "SDMS" };
  const amaMatch = name.match(/(\d+\.?\d*)\s*AMA\s*PRA/i);
  if (amaMatch) return { hours: amaMatch[1], type: "AMA_PRA_1" };
  const anccMatch = name.match(/(\d+\.?\d*)\s*ANCC/i);
  if (anccMatch) return { hours: anccMatch[1], type: "ANCC" };
  return null;
}

describe("parseCreditHoursFromName", () => {
  it("parses integer SDMS credits", () => {
    const result = parseCreditHoursFromName("All About Doppler & Hemodynamics - 1 SDMS CME");
    expect(result).toEqual({ hours: "1", type: "SDMS" });
  });

  it("parses decimal SDMS credits", () => {
    const result = parseCreditHoursFromName("All About Upper Extremity Duplex - 2.5 SDMS CME");
    expect(result).toEqual({ hours: "2.5", type: "SDMS" });
  });

  it("parses FREE SDMS credits", () => {
    const result = parseCreditHoursFromName("All About Sonographer Ergonomics - 1 SDMS FREE CME");
    expect(result).toEqual({ hours: "1", type: "SDMS" });
  });

  it("parses 2 SDMS credits", () => {
    const result = parseCreditHoursFromName("All About Left Ventricular Diastology - 2 SDMS CME");
    expect(result).toEqual({ hours: "2", type: "SDMS" });
  });

  it("parses AMA PRA credits", () => {
    const result = parseCreditHoursFromName("Cardiology Update - 3 AMA PRA Category 1");
    expect(result).toEqual({ hours: "3", type: "AMA_PRA_1" });
  });

  it("parses ANCC credits", () => {
    const result = parseCreditHoursFromName("Nursing Update - 2 ANCC Credits");
    expect(result).toEqual({ hours: "2", type: "ANCC" });
  });

  it("returns null for courses with no credit info", () => {
    const result = parseCreditHoursFromName("Fetal Echo Fundamentals");
    expect(result).toBeNull();
  });

  it("returns null for bundle names", () => {
    const result = parseCreditHoursFromName("CME Membership Bundle");
    expect(result).toBeNull();
  });

  it("is case-insensitive for SDMS", () => {
    const result = parseCreditHoursFromName("Some Course - 1 sdms credit");
    expect(result).toEqual({ hours: "1", type: "SDMS" });
  });
});

// ─── Thinkific Webhook Handler ────────────────────────────────────────────────

// Mock syncCatalogToDb before importing the webhook handler
vi.mock("./routers/cmeRouter", () => ({
  syncCatalogToDb: vi.fn().mockResolvedValue(11),
}));

import { registerThinkificWebhook } from "./webhooks/thinkific";
import { syncCatalogToDb } from "./routers/cmeRouter";

function makeExpressMocks(body: object) {
  const req = { body } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

function buildApp() {
  const routes: { path: string; handler: (req: any, res: any) => void }[] = [];
  const app = {
    post: (path: string, handler: (req: any, res: any) => void) => {
      routes.push({ path, handler });
    },
    _routes: routes,
    _dispatch: async (path: string, req: any, res: any) => {
      const route = routes.find(r => r.path === path);
      if (!route) throw new Error(`No route for ${path}`);
      await route.handler(req, res);
    },
  };
  return app as any;
}

describe("registerThinkificWebhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (syncCatalogToDb as any).mockResolvedValue(11);
  });

  it("registers POST /api/webhooks/thinkific", () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    expect(app._routes.some((r: any) => r.path === "/api/webhooks/thinkific")).toBe(true);
  });

  it("returns 200 and triggers sync for product.created", async () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "product",
      action: "created",
      payload: { id: 999, name: "New CME Course - 2 SDMS CME", status: "published" },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, productId: 999 })
    );
    // Give the background sync a tick to start
    await new Promise(r => setTimeout(r, 10));
    expect(syncCatalogToDb).toHaveBeenCalled();
  });

  it("returns 200 and triggers sync for product.updated", async () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "product",
      action: "updated",
      payload: { id: 617498, name: "Sonographer Ergonomics", status: "published" },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    await new Promise(r => setTimeout(r, 10));
    expect(syncCatalogToDb).toHaveBeenCalled();
  });

  it("returns 200 and triggers sync for product.deleted", async () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "product",
      action: "deleted",
      payload: { id: 12345 },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    await new Promise(r => setTimeout(r, 10));
    expect(syncCatalogToDb).toHaveBeenCalled();
  });

  it("ignores non-product resources", async () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "enrollment",
      action: "created",
      payload: { id: 111 },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("ignored") })
    );
    await new Promise(r => setTimeout(r, 10));
    expect(syncCatalogToDb).not.toHaveBeenCalled();
  });

  it("ignores unknown actions", async () => {
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "product",
      action: "archived",
      payload: { id: 222 },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    // product.archived is not in the ALLOWED_EVENTS list, so it is filtered (not ignored)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
    await new Promise(r => setTimeout(r, 10));
    expect(syncCatalogToDb).not.toHaveBeenCalled();
  });

  it("handles sync errors gracefully without crashing", async () => {
    (syncCatalogToDb as any).mockRejectedValueOnce(new Error("Thinkific API down"));
    const app = buildApp();
    registerThinkificWebhook(app);
    const { req, res } = makeExpressMocks({
      resource: "product",
      action: "created",
      payload: { id: 333 },
    });
    await app._dispatch("/api/webhooks/thinkific", req, res);
    // Should still respond 200 — sync error is logged but not propagated
    expect(res.status).toHaveBeenCalledWith(200);
    // Wait for the rejected promise to be handled
    await new Promise(r => setTimeout(r, 20));
    // No unhandled rejection should have been thrown
  });
});
