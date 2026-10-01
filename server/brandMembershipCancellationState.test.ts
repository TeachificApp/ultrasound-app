import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Brand Membership cancellation state", () => {
  it("persists Stripe cancel-at-period-end state in the schema and additive migration", () => {
    expect(read("drizzle/schema.ts")).toContain('cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false)');
    expect(read("drizzle/0089_brand_membership_cancellation_state.sql")).toContain('ADD COLUMN `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT FALSE');
  });

  it("keeps Premium access active through a scheduled cancellation", () => {
    const adminRouter = read("server/routers/adminUserRouter.ts");
    const dashboardRouter = read("server/routers/dashboardRouter.ts");
    const webhook = read("server/webhooks/stripe.ts");

    expect(adminRouter).toContain('cancelAtPeriodEnd: true');
    expect(adminRouter).toMatch(/status:\s*"active",\s*tier:\s*"premium",\s*cancelAtPeriodEnd:\s*true/);
    expect(dashboardRouter).toMatch(/tier:\s*"premium",\s*cancelAtPeriodEnd:\s*true/);
    expect(webhook).toContain('cancelAtPeriodEnd,');
  });

  it("refreshes the administrator membership view when Subscriptions opens", () => {
    const page = read("client/src/pages/admin/AdminUserDetailPage.tsx");
    expect(page).toContain('if (activeTab === "subscriptions") void refetch();');
    expect(page).toContain('> Refresh');
  });
});
