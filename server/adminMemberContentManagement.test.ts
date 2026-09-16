import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("administrator member content management", () => {
  it("returns standalone, lesson, and inline survey results only through the protected member-detail contract", () => {
    const router = readProjectFile("server/routers/adminUserRouter.ts");

    expect(router).toContain("const [standaloneQuizResultList]");
    expect(router).toContain("FROM standalone_quiz_attempts");
    expect(router).toContain("const [lessonQuizResultList]");
    expect(router).toContain("FROM lms_quiz_attempts");
    expect(router).toContain("const [inlineQuizResultList]");
    expect(router).toContain("FROM lms_inline_quiz_attempts");
    expect(router).toContain("quizResults: {");
  });

  it("shows protected result records and silent access controls in the administrator member profile", () => {
    const profile = readProjectFile("client/src/pages/admin/AdminUserDetailPage.tsx");
    const downloadCard = readProjectFile("client/src/components/admin/MemberDigitalDownloadPurchaseCard.tsx");

    expect(profile).toContain("Administrator quiz results");
    expect(profile).toContain("Grant Download / Content Access");
    expect(profile).toContain("Access changes do not send email unless you explicitly use a resend action.");
    expect(downloadCard).toContain("Save access");
    expect(downloadCard).toContain("Access activity");
    expect(downloadCard).toContain("Changing access does not send email.");
  });

  it("uses stored purchase cents for download reporting and excludes zero-cost access grants from paid revenue", () => {
    const analyticsRouter = readProjectFile("server/routers/productAnalyticsRouter.ts");
    const downloadsRouter = readProjectFile("server/routers/downloadsRouter.ts");
    const adminDownloads = readProjectFile("client/src/pages/admin/DigitalDownloadsAdmin.tsx");

    expect(analyticsRouter).toContain("COALESCE(dp.amount, 0) AS amountPaid");
    expect(analyticsRouter).not.toContain("COALESCE(prod.price, 0) AS amountPaid");
    expect(analyticsRouter).toContain("totalPaid");
    expect(downloadsRouter).toContain("COALESCE(${digitalPurchases.amount}, 0) > 0");
    expect(downloadsRouter).toContain("totalRevenue: Number(countResult[0]?.revenue ?? 0) / 100");
    expect(adminDownloads).toContain("formatCentsAsCurrency(totalRevenue)");
    expect(adminDownloads).not.toContain("${Number(totalRevenue).toFixed(2)}");
  });
});
