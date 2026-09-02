import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("past closed offering lifecycle visibility", () => {
  it("removes ended workshop instances from public enrollment choices", () => {
    const router = source("server/routers/workshopRouter.ts");
    expect(router).toContain("const visibleInstances = allInstances.filter");
    expect(router).toContain("const end = instance.endDate ?? instance.startDate");
    expect(router).toContain("allInstances: visibleInstances");
  });

  it("marks ended closed cohort groups archived in public availability", () => {
    const router = source("server/routers/lmsRouter.ts");
    expect(router).toContain("status: lmsCohortGroups.status, endDate: lmsCohortGroups.endDate");
    expect(router).toContain("const isArchived = Boolean(group.endDate");
    expect(router).toContain("lifecycleStatus: isArchived ? \"archived\" : group.status");
  });
});
