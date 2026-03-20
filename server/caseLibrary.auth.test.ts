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

describe("Case Library Auth Gates (iHeartEcho model)", () => {
  it("listCases should be a public procedure (no auth required to browse)", async () => {
    // The listCases procedure uses publicProcedure — no UNAUTHORIZED thrown for unauthenticated users
    // We verify this by checking the router source doesn't have a premium gate
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // Should NOT contain the old FREE_CASE_LIMIT premium gate
    expect(source).not.toContain("FREE_CASE_LIMIT");
    expect(source).not.toContain("isPremiumUser");
    // listCases should use publicProcedure
    expect(source).toMatch(/listCases:\s*publicProcedure/);
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

  it("isPremiumGated should always be false in listCases response", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./routers/caseLibraryRouter.ts", import.meta.url).pathname,
      "utf-8"
    );
    // The return value should have isPremiumGated: false (hardcoded)
    expect(source).toContain("isPremiumGated: false");
    expect(source).toContain("freeCaseLimit: null");
  });
});
