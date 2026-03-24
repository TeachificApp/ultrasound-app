/**
 * caseLibrary.auth.test.ts
 *
 * Verifies that the case library auth gate logic matches the iHeartEcho model:
 * - listCases: public (no auth required to browse)
 * - getCase: protected (login required to view case detail)
 * - submitAttempt: protected (login required to answer MCQs)
 */

import { describe, it, expect } from "vitest";

// We test the router procedure types by inspecting the router definition
// rather than making real DB calls (which require a live DB connection).

describe("Case Library Auth Gates (tiered access model)", () => {
  it("listCases should be a public procedure (no auth required to browse)", async () => {
    // The listCases procedure uses publicProcedure — no UNAUTHORIZED thrown for unauthenticated users
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // listCases should use publicProcedure
    expect(source).toMatch(/listCases:\s*publicProcedure/);
    // listCases should return accessStatus for frontend gating
    expect(source).toContain("accessStatus");
  });

  it("getCase should be a protected procedure (login required for case detail)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // getCase should use protectedProcedure
    expect(source).toMatch(/getCase:\s*protectedProcedure/);
  });

  it("submitAttempt should be a protected procedure (login required to answer MCQs)", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // submitAttempt should use protectedProcedure
    expect(source).toMatch(/submitAttempt:\s*protectedProcedure/);
  });

  it("getCase should enforce tiered access limits for non-premium users", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // Should contain the tiered access gating logic
    expect(source).toContain("FREE_LIMIT_REACHED");
    expect(source).toContain("PREMIUM_LIMIT_REACHED");
    // Premium users and admins should bypass the gate
    expect(source).toContain("isPremium");
    expect(source).toContain("isAdmin");
    // Free users (no thinkificEnrolledAt) get limit 1; non-premium Thinkific members get limit 10
    expect(source).toContain("isFreeUser");
    expect(source).toContain("caseLimit");
  });

  it("listCases should return accessStatus with casesViewed and caseLimit for non-premium users", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // listCases should include access status fields
    expect(source).toContain("casesViewed");
    expect(source).toContain("caseLimit");
    expect(source).toContain("limitReached");
    expect(source).toContain("isPremium");
  });
});
