export type CmeLearnerReport = {
  learnerName: string;
  learnerEmail: string;
  enrolledAt: Date | string | null;
  completedAt: Date | string | null;
  progressPct: number;
  certificateIssuedAt: Date | string | null;
  quizAttempts: Array<{
    kind: "standard" | "inline";
    lessonTitle: string;
    score: number;
    passed: boolean;
    submittedAt: Date | string | null;
    responses: Array<{ questionText: string; questionType: string; answerValue: string | null }>;
  }>;
};

export type CmeActivityReportForCsv = {
  activityTitle: string;
  courseId: number;
  creditHours: string | null;
  learners: CmeLearnerReport[];
};

function toIso(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Produces a row-per-result/response audit export without suppressing learner baseline records. */
export function buildCmeActivityCsv(report: CmeActivityReportForCsv): string {
  const headers = [
    "CME Activity", "Course ID", "Credit Hours", "Learner Name", "Learner Email",
    "Enrollment Date", "Completion Date", "Completion Progress (%)", "Certificate Issued", "Certificate Issued Date",
    "Quiz Type", "Lesson", "Quiz Score (%)", "Quiz Passed", "Quiz Submitted Date",
    "Survey Question", "Survey Response Type", "Survey Response",
  ];
  const rows = [headers.map(escapeCsv).join(",")];

  report.learners.forEach(learner => {
    const base = [
      report.activityTitle, report.courseId, report.creditHours ?? "", learner.learnerName, learner.learnerEmail,
      toIso(learner.enrolledAt), toIso(learner.completedAt), learner.progressPct,
      learner.certificateIssuedAt ? "Yes" : "No", toIso(learner.certificateIssuedAt),
    ];
    const attempts = learner.quizAttempts.length > 0 ? learner.quizAttempts : [null];
    attempts.forEach(attempt => {
      const results = attempt?.responses?.length ? attempt.responses : [null];
      results.forEach(response => {
        rows.push([
          ...base,
          attempt?.kind ?? "", attempt?.lessonTitle ?? "", attempt?.score ?? "", attempt ? (attempt.passed ? "Yes" : "No") : "", toIso(attempt?.submittedAt ?? null),
          response?.questionText ?? "", response?.questionType ?? "", response?.answerValue ?? "",
        ].map(escapeCsv).join(","));
      });
    });
  });
  return rows.join("\n");
}
