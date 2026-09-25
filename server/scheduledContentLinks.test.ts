import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

describe("scheduled content links", () => {
  it("keeps the link schema additive and scoped to a scheduled source", async () => {
    const schema = await source("../drizzle/schema.ts");
    expect(schema).toContain('mysqlTable("scheduled_content_links"');
    expect(schema).toContain('sourceType: mysqlEnum("source_type", ["cohort_group", "workshop_instance"])');
    expect(schema).toContain('targetType: mysqlEnum("target_type", ["course", "download", "webinar", "workshop_instance"])');
  });

  it("grants linked access idempotently without sending entitlement emails", async () => {
    const grants = await source("./lib/scheduledContentLinks.ts");
    expect(grants).toContain("export async function grantScheduledContentAccess");
    expect(grants).toContain('source: "scheduled_link"');
    expect(grants).toContain("digitalPurchases");
    expect(grants).toContain("webinarRegistrations");
    expect(grants).toContain("workshopEnrollments");
    expect(grants).not.toContain("sendEmail");
  });

  it("copies run configuration but never copies learners or submissions", async () => {
    const cohort = await source("./routers/lmsCohortAdminRouter.ts");
    const workshop = await source("./routers/workshopRouter.ts");
    expect(cohort).toContain("duplicateCohortGroup");
    expect(cohort).toContain("cloneScheduledContentLinks");
    expect(cohort).toContain("includeRecordings");
    expect(cohort).not.toMatch(/duplicateCohortGroup[\s\S]{0,10000}insert\(lmsCohortGroupEnrollments\)/);
    expect(workshop).toContain("duplicateInstance");
    expect(workshop).toContain("cloneScheduledContentLinks");
    expect(workshop).not.toMatch(/duplicateInstance[\s\S]{0,8000}insert\(workshopEnrollments\)/);
  });

  it("surfaces real admin controls in both cohort and workshop editors", async () => {
    const cohortUi = await source("../client/src/pages/admin/LMSAdmin.tsx");
    const workshopUi = await source("../client/src/pages/admin/WorkshopsAdmin.tsx");
    expect(cohortUi).toContain("ScheduledContentLinksPanel");
    expect(cohortUi).toContain("duplicateCohortGroup");
    expect(workshopUi).toContain("ScheduledContentLinksPanel");
    expect(workshopUi).toContain("duplicateInstance");
  });

  it("fulfills linked workshop access for both direct and Stripe enrollment paths", async () => {
    const workshop = await source("./routers/workshopRouter.ts");
    const stripe = await source("./webhooks/stripe.ts");
    expect(workshop).toContain('sourceType: "workshop_instance"');
    expect(stripe).toContain("grantScheduledContentAccess");
  });
});
