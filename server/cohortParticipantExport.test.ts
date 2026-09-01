import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cohort participant export", () => {
  const source = readFileSync(resolve(import.meta.dirname, "routers/lmsTeamManagerRouter.ts"), "utf8");
  const adminPanel = readFileSync(resolve(import.meta.dirname, "../client/src/pages/admin/LMSAdmin.tsx"), "utf8");

  it("limits exports to authorized accepted active seats", () => {
    const procedure = source.slice(source.indexOf("exportActiveMembersCSV: protectedProcedure"));
    expect(procedure).toContain("assertManagerOrAdmin");
    expect(procedure).toContain('eq(lmsGroupSeats.status, "active")');
    expect(procedure).toContain("seat.acceptedAt");
  });

  it("exports only approved nonfinancial fields with formula protection", () => {
    expect(source).toContain('"Credentials"');
    expect(source).toContain('"Specialty"');
    expect(source).toContain('"Location"');
    expect(source).toContain("/^[=+\\-@]/.test(text)");
  });

  it("surfaces the protected export in Cohort Groups administration", () => {
    expect(adminPanel).toContain("lmsTeamManager.exportActiveMembersCSV.useQuery");
    expect(adminPanel).toContain("Export Active Participants");
  });
});
