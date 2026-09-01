import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LMS course CME Survey Results tab", () => {
  const source = readFileSync(resolve(import.meta.dirname, "LMSAdmin.tsx"), "utf8");

  it("is visible only for courses with an existing CME activity", () => {
    expect(source).toContain('course.hasCmeActivity && <TabsTrigger value="cme-survey-results"');
    expect(source).toContain('<CmeSurveyResultsPanel courseId={courseId} />');
  });

  it("filters detailed response rows by date and exports the same current query", () => {
    expect(source).toContain("const reportInput = { courseId, ...appliedDates };");
    expect(source).toContain("getCmeSurveyResults.useQuery(reportInput)");
    expect(source).toContain("exportResults.mutate(reportInput)");
    expect(source).toContain("The start date must be on or before the end date");
    expect(source).toContain("Export filtered CSV");
  });

  it("imports every card component used by the Course Settings participant communication card", () => {
    expect(source).toContain('import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";');
    expect(source).toContain("<CardHeader className=\"pb-2\"><CardTitle className=\"text-base\">Participant Communications</CardTitle></CardHeader>");
  });
});
