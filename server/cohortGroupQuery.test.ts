import { describe, expect, it } from "vitest";
import {
  cohortGroupAdminListSelect,
  cohortGroupBaseSelect,
  cohortGroupMirrorGapSelect,
  cohortGroupPublicSelect,
} from "./lib/cohortGroupQuery";

describe("cohortGroupQuery", () => {
  it("defines tiered selects for mirror-gap resilience", () => {
    expect(cohortGroupBaseSelect).toHaveProperty("id");
    expect(cohortGroupBaseSelect).toHaveProperty("slug");
    expect(cohortGroupPublicSelect).toHaveProperty("waitlistEnabled");
    expect(cohortGroupMirrorGapSelect).toHaveProperty("landingBlocks");
    expect(cohortGroupAdminListSelect).toHaveProperty("landingBlocks");
  });

  it("listCohortGroups uses resilient helper", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("listCohortGroupsForAdmin");
    expect(source).not.toMatch(/listCohortGroups:[\s\S]*?\.select\(\)\s*\.from\(lmsCohortGroups\)/);
  });

  it("getCohortGroupPage uses resilient helper", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("getCohortGroupById");
    expect(source).toContain("getCohortGroupLandingBlocks");
  });
});
