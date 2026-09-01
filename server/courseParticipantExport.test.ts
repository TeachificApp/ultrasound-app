import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("course participant export", () => {
  const source = readFileSync(resolve(import.meta.dirname, "routers/lmsEnrollmentAdminRouter.ts"), "utf8");

  it("exports approved profile fields but excludes payment and session identifiers", () => {
    const procedure = source.slice(source.indexOf("exportEnrollmentsCSV: protectedProcedure"), source.indexOf("// ─── Affiliate Course Settings"));
    expect(procedure).toContain('"Credentials"');
    expect(procedure).toContain('"Specialty"');
    expect(procedure).toContain('"Location"');
    expect(procedure).not.toContain('"Stripe Session ID"');
    expect(procedure).not.toContain('"Order Amount ($)"');
  });

  it("protects exported cell values from spreadsheet formula evaluation", () => {
    expect(source).toContain("/^[=+\\-@]/.test(value)");
  });
});
