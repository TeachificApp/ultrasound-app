import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("learner enrollment privacy", () => {
  const workshop = readFileSync(resolve(import.meta.dirname, "routers/workshopRouter.ts"), "utf8");
  const lms = readFileSync(resolve(import.meta.dirname, "routers/lmsRouter.ts"), "utf8");
  const block = readFileSync(resolve(import.meta.dirname, "../client/src/components/RemainingSeatsBlock.tsx"), "utf8");

  it("does not return numeric enrollment data through public availability routes", () => {
    const publicWorkshop = workshop.slice(workshop.indexOf("getInstancesByIds: publicProcedure"), workshop.indexOf("// ─── Learner Router"));
    const publicCohort = lms.slice(lms.indexOf("getCohortSeatAvailability: publicProcedure"), lms.indexOf("getCohortGroupSessions: publicProcedure"));
    expect(publicWorkshop).not.toContain("remaining,");
    expect(publicWorkshop).not.toContain("enrolled,");
    expect(publicCohort).not.toContain("capacity,");
    expect(publicCohort).not.toContain("enrolled,");
  });

  it("renders a non-numeric learner enrollment message", () => {
    expect(block).toContain("Learners will not see attendance, capacity, or seat-count information.");
    expect(block).not.toContain("getSeatAvailability.useQuery");
    expect(block).not.toContain("of {capacity} seats filled");
  });
});
