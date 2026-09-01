import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CME Management reporting router", () => {
  const source = readFileSync(resolve(import.meta.dirname, "routers/cmeManagementRouter.ts"), "utf8");

  it("gates every activity-reporting procedure behind administrator authorization", () => {
    expect(source.match(/await assertAdmin\(ctx\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("listCmeManagementActivities");
    expect(source).toContain("getCmeManagementActivityReport");
    expect(source).toContain("exportCmeManagementActivityCsv");
  });

  it("combines completion, certificates, standard quiz attempts, and inline survey responses", () => {
    expect(source).toContain("lmsEnrollments");
    expect(source).toContain("lmsCertificates");
    expect(source).toContain("lmsQuizAttempts");
    expect(source).toContain("lmsInlineQuizResponses");
    expect(source).toContain("buildCmeActivityCsv");
  });

  it("pages the administrative drill-down while retaining a complete CSV export", () => {
    expect(source).toContain("pageSize: z.number().int().min(1).max(100).default(50)");
    expect(source).toContain(".limit(pageSize)");
    expect(source).toContain("{ includeAll: true }");
  });

  it("protects CME survey result rows and CSV exports with validated platform-date filters", () => {
    expect(source).toContain("getCmeSurveyResults: protectedProcedure");
    expect(source).toContain("exportCmeSurveyResultsCsv: protectedProcedure");
    expect(source.match(/await assertAdmin\(ctx\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source).toContain("platformCalendarDayBoundaryToUtc(options.startDate, \"start\")");
    expect(source).toContain("platformCalendarDayBoundaryToUtc(options.endDate, \"end\")");
    expect(source).toContain("The start date must be on or before the end date");
    expect(source).toContain("buildCmeSurveyResultsCsv(report.rows)");
    expect(source).toContain("const text = /^[=+\\-@]/.test(rawText) ? `'${rawText}` : rawText;");
  });

  it("includes only recorded responses from blocks configured as CME surveys", () => {
    expect(source).toContain('block?.data?.isSurvey === true || block?.data?.requireSurveyCompletion === true');
    expect(source).toContain("String(block.id) === attempt.quizBlockId");
    expect(source).toContain("lmsInlineQuizResponses.answerValue");
  });
});
