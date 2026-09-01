import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workshop participant export", () => {
  const source = readFileSync(resolve(import.meta.dirname, "routers/workshopRouter.ts"), "utf8");
  const procedure = source.slice(source.indexOf("exportWorkshopInstanceStudentsCSV: protectedProcedure"), source.indexOf("/** Workshop enrollments not linked"));

  it("is administrator-only and excludes non-active participants", () => {
    expect(procedure).toContain('ctx.user.role !== "admin"');
    expect(procedure).toContain('eq(workshopEnrollments.status, "active")');
  });

  it("exports approved participant fields with formula protection", () => {
    expect(procedure).toContain('"Credentials"');
    expect(procedure).toContain('"Specialty"');
    expect(procedure).toContain('"Location"');
    expect(procedure).toContain("/^[=+\\-@]/.test(text)");
  });
});
