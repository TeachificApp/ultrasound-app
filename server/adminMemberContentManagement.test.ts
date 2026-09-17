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

  it("protects question-by-question responses by member ownership across standalone, lesson, and inline attempts", () => {
    const router = readProjectFile("server/routers/adminUserRouter.ts");

    expect(router).toContain("getMemberQuizAttemptDetail");
    expect(router).toContain('kind: z.enum(["standalone", "lesson", "inline"])');
    expect(router).toContain("FROM standalone_quiz_attempt_answers");
    expect(router).toContain("FROM lms_quiz_attempt_answers");
    expect(router).toContain("FROM lms_inline_quiz_responses");
    expect(router).toContain("AND a.user_id = ${input.userId}");
    expect(router).toContain("AND a.completed_at IS NOT NULL");
    expect(router).toContain("parseBuilderConfig(attempt.builderConfig");
    expect(router).toContain("stableBuilderQuestionId(String(question.id))");
    expect(router).toContain("builderQuestion?.stem");
    expect(router).toContain("COALESCE(lq.options, qb.options) AS options");
  });

  it("shows protected result records and silent access controls in the administrator member profile", () => {
    const profile = readProjectFile("client/src/pages/admin/AdminUserDetailPage.tsx");
    const downloadCard = readProjectFile("client/src/components/admin/MemberDigitalDownloadPurchaseCard.tsx");

    expect(profile).toContain("Administrator quiz results");
    expect(profile).toContain("View responses");
    expect(profile).toContain("Question-by-question responses");
    expect(profile).toContain("parseStoredResponse");
    expect(profile).toContain("identifiedOption");
    expect(profile).toContain('"quizzes" | "mocks" | "lesson-surveys"');
    expect(profile).toContain("Mock Exams");
    expect(profile).toContain("Lesson / Survey");
    expect(profile).toContain("e.isQuiz || e.hasQuizContent");
    expect(profile).toContain("Course access with lesson quiz");
    expect(profile).toContain("Grant Download / Content Access");
    expect(profile).toContain("Access changes do not send email unless you explicitly use a resend action.");
    expect(downloadCard).toContain("Save access");
    expect(downloadCard).toContain("Access activity");
    expect(downloadCard).toContain("Changing access does not send email.");
  });

  it("returns mock exam attempts separately from standalone quiz attempts", () => {
    const router = readProjectFile("server/routers/adminUserRouter.ts");

    expect(router).toContain("q.type AS quizType");
    expect(router).toContain('String(r.quizType) === "mock_exam"');
  });

  it("uses stored purchase cents for download reporting and excludes zero-cost access grants from paid revenue", () => {
    const analyticsRouter = readProjectFile("server/routers/productAnalyticsRouter.ts");
    const downloadsRouter = readProjectFile("server/routers/downloadsRouter.ts");
    const adminDownloads = readProjectFile("client/src/pages/admin/DigitalDownloadsAdmin.tsx");

    expect(analyticsRouter).toContain("COALESCE(dp.amount, 0) AS amountPaid");
    expect(analyticsRouter).toContain("WHEN COALESCE(dp.amount, 0) = 0 THEN 'included'");
    expect(analyticsRouter).not.toContain("COALESCE(prod.price, 0) AS amountPaid");
    expect(analyticsRouter).toContain("totalPaid");
    expect(analyticsRouter).toContain("function extractExecuteRows(result: unknown)");
    expect(analyticsRouter).toContain("const rows = extractExecuteRows(await db.execute(queryStr));");
    expect(analyticsRouter).toContain("const revRows = extractExecuteRows(await db.execute(revenueQuery));");
    expect(downloadsRouter).toContain("COALESCE(${digitalPurchases.amount}, 0) > 0");
    expect(downloadsRouter).toContain("totalRevenue: Number(countResult[0]?.revenue ?? 0) / 100");
    expect(adminDownloads).toContain("formatCentsAsCurrency(totalRevenue)");
    expect(adminDownloads).toContain("Included access");
    expect(adminDownloads).toContain("const paidPurchasers = purchasers.filter");
    expect(adminDownloads).not.toContain("${Number(totalRevenue).toFixed(2)}");
  });
});
