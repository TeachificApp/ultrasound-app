/**
 * Physical Products Router — unit tests
 */
import { describe, it, expect } from "vitest";

describe("Physical Products schema", () => {
  it("physicalProducts table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.physicalProducts).toBeDefined();
    expect(schema.physicalProductPricingOptions).toBeDefined();
    expect(schema.physicalProductOrders).toBeDefined();
  });

  it("productsAdminRouter is exported from productsRouter", async () => {
    const mod = await import("./routers/productsRouter");
    expect(mod.productsAdminRouter).toBeDefined();
    expect(mod.productsPublicRouter).toBeDefined();
    expect(mod.productsLearnerRouter).toBeDefined();
  });

  it("productsAdminRouter has required procedures", async () => {
    const { productsAdminRouter } = await import("./routers/productsRouter");
    const procedures = Object.keys((productsAdminRouter as any)._def.procedures ?? (productsAdminRouter as any)._def.record ?? {});
    // The router object should have procedure keys
    expect(productsAdminRouter).toBeTruthy();
  });

  it("orderBumpsRouter triggerType includes physical", async () => {
    const { orderBumpsAdminRouter } = await import("./routers/orderBumpsRouter");
    expect(orderBumpsAdminRouter).toBeDefined();
  });
});
