/**
 * Tests for physicianOverRead.getMonthlySummary procedure
 * Verifies that the new procedure is registered in the router and returns
 * the correct shape (array of monthly summary objects).
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
  return { ctx };
}

describe("physicianOverRead.getMonthlySummary", () => {
  it("procedure is registered in the router", () => {
    // Verify the procedure exists on the router
    expect(appRouter._def.procedures["physicianOverRead.getMonthlySummary"]).toBeDefined();
  });

  it("returns an array when no DB is available", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // When DB is unavailable (test env), should return empty array gracefully
    const result = await caller.physicianOverRead.getMonthlySummary();
    expect(Array.isArray(result)).toBe(true);
  });

  it("physicianPeerReview.getMonthlySummary is also registered", () => {
    expect(appRouter._def.procedures["physicianPeerReview.getMonthlySummary"]).toBeDefined();
  });

  it("physicianPeerReview.getMonthlySummary accepts examType filter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Should accept examType without throwing a validation error
    const result = await caller.physicianPeerReview.getMonthlySummary({ examType: "AETTE" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("physicianPeerReview.getMonthlySummary works without examType", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.physicianPeerReview.getMonthlySummary();
    expect(Array.isArray(result)).toBe(true);
  });
});
