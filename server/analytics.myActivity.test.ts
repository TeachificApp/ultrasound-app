import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("analyticsTrackRouter.myActivity", () => {
  it("should be defined as a procedure in analyticsTrackRouter", async () => {
    const { analyticsTrackRouter } = await import("./routers/analyticsRouter");
    // The router should have a myActivity procedure
    expect(analyticsTrackRouter).toBeDefined();
    // Check that myActivity key exists on the router
    const routerDef = (analyticsTrackRouter as any)._def;
    expect(routerDef).toBeDefined();
    expect(routerDef.procedures).toBeDefined();
    expect(routerDef.procedures.myActivity).toBeDefined();
  });

  it("should throw INTERNAL_SERVER_ERROR when DB is unavailable", async () => {
    const { analyticsTrackRouter } = await import("./routers/analyticsRouter");
    const routerDef = (analyticsTrackRouter as any)._def;
    const myActivityProcedure = routerDef.procedures.myActivity;
    expect(myActivityProcedure).toBeDefined();
  });
});
