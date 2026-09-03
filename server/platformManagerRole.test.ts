import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasPlatformManagerAccess,
  hasPlatformManagerRole,
  isRestrictedPlatformManager,
} from "../shared/platformManagerAccess";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Platform Manager role boundaries", () => {
  it("recognizes the limited role without treating it as a full Platform Admin", () => {
    expect(hasPlatformManagerRole(["platform_manager"])).toBe(true);
    expect(hasPlatformManagerAccess("user", ["platform_manager"])).toBe(true);
    expect(isRestrictedPlatformManager("user", ["platform_manager"])).toBe(true);
    expect(isRestrictedPlatformManager("user", ["platform_manager", "platform_admin"])).toBe(false);
    expect(isRestrictedPlatformManager("admin", ["platform_manager"])).toBe(false);
  });

  it("records the role in the schema and makes it assignable only through the existing admin contracts", () => {
    const schema = projectFile("drizzle/schema.ts");
    const adminRouter = projectFile("server/routers/adminRouter.ts");
    const adminUi = projectFile("client/src/pages/PlatformAdmin.tsx");

    expect(schema).toContain('"platform_manager"');
    expect(adminRouter).toContain('"platform_manager"');
    expect(adminUi).toContain('label: "Platform Manager"');
  });

  it("keeps currency, revenue, purchase history, refunds, and non-free enrollment server-restricted", () => {
    const memberRouter = projectFile("server/routers/adminUserRouter.ts");

    expect(memberRouter).toContain("async function assertFinancialAdmin");
    expect(memberRouter).toMatch(/refundPayment:[\s\S]*?await assertFinancialAdmin\(ctx\)/);
    expect(memberRouter).toMatch(/listAllSales:[\s\S]*?await assertFinancialAdmin\(ctx\)/);
    expect(memberRouter).toMatch(/getSalesAnalytics:[\s\S]*?await assertFinancialAdmin\(ctx\)/);
    expect(memberRouter).toMatch(/getRevenueOverview:[\s\S]*?await assertFinancialAdmin\(ctx\)/);
    expect(memberRouter).toMatch(/getUserPurchases:[\s\S]*?await assertFinancialAdmin\(ctx\)/);
    expect(memberRouter).toContain('input.paymentMode !== "free"');
    expect(memberRouter).toContain("isRestrictedManager ? [] : funnelPurchaseList");
  });

  it("keeps approved Manager workspaces accessible while withholding manager deletion controls", () => {
    const app = projectFile("client/src/App.tsx");
    const emailUi = projectFile("client/src/pages/EmailCampaignDashboard.tsx");
    const lmsUi = projectFile("client/src/pages/admin/LMSAdmin.tsx");
    const mediaRouter = projectFile("server/routers/mediaRepoRouter.ts");
    const lmsRouter = projectFile("server/routers/lmsCourseBuilderRouter.ts");

    expect(app).toContain('roles={["platform_admin", "platform_manager"]}');
    expect(app).toContain("<PlatformAdminEntry />");
    expect(emailUi).toContain("hideFinancials={isRestrictedManager}");
    expect(emailUi).toContain("!isRestrictedManager && (");
    expect(lmsUi).toContain("onDelete={isRestrictedManager ? undefined");
    expect(lmsUi).toContain('new Set(["products", "memberships", "orderbumps", "discount_codes", "orders", "analytics", "affiliates", "trash"])');
    expect(mediaRouter).toMatch(/deleteAsset:[\s\S]*?assertPlatformAdmin\(ctx, false\)/);
    expect(lmsRouter).toMatch(/deleteCourse:[\s\S]*?await assertFullAdmin\(ctx\)/);
    expect(lmsRouter).toMatch(/deleteLesson:[\s\S]*?await assertFullAdmin\(ctx\)/);
    expect(lmsRouter).toContain("const responseCourse = isRestrictedManager");
    expect(lmsRouter).toContain("price: null, stripePriceId: null, subscriptionPrice: null, downPayment: null, installmentAmount: null");
  });
});
