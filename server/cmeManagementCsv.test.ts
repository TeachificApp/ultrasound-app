import { describe, expect, it } from "vitest";
import { buildCmeActivityCsv } from "./lib/cmeManagementCsv";

describe("buildCmeActivityCsv", () => {
  it("exports learner baseline, certificate, quiz, and recorded survey-response fields", () => {
    const csv = buildCmeActivityCsv({
      activityTitle: "Echo CME Activity",
      courseId: 42,
      creditHours: "1.5",
      learners: [{
        learnerName: "Taylor Clinician",
        learnerEmail: "taylor@example.org",
        enrolledAt: new Date("2026-08-01T00:00:00.000Z"),
        completedAt: new Date("2026-08-03T00:00:00.000Z"),
        progressPct: 100,
        certificateIssuedAt: new Date("2026-08-04T00:00:00.000Z"),
        quizAttempts: [{
          kind: "inline",
          lessonTitle: "Activity Evaluation",
          score: 100,
          passed: true,
          submittedAt: new Date("2026-08-03T00:00:00.000Z"),
          responses: [{ questionText: "Would you recommend this activity?", questionType: "survey_choice", answerValue: "Yes" }],
        }],
      }],
    });

    expect(csv).toContain('"Learner Name"');
    expect(csv).toContain('"Certificate Issued Date"');
    expect(csv).toContain('"Survey Response"');
    expect(csv).toContain('"Taylor Clinician"');
    expect(csv).toContain('"Yes"');
  });

  it("keeps an enrolled learner in the export when no quiz result exists", () => {
    const csv = buildCmeActivityCsv({
      activityTitle: "CME", courseId: 1, creditHours: null,
      learners: [{ learnerName: "Pending Learner", learnerEmail: "pending@example.org", enrolledAt: null, completedAt: null, progressPct: 0, certificateIssuedAt: null, quizAttempts: [] }],
    });
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain('"Pending Learner"');
    expect(csv).toContain('"No"');
  });
});
