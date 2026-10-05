#!/usr/bin/env npx tsx
/**
 * Read-only live dashboard contract audit.
 *
 * Selects anonymous eligible records, invokes the same dashboard procedure as a
 * signed-in learner, and reports only aggregate assertions. It never writes to
 * MySQL, Stripe, or learner records and never prints identities.
 */
import mysql from "mysql2/promise";
import { dashboardRouter } from "../server/routers/dashboardRouter";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the learner dashboard audit.");

const connection = await mysql.createConnection(databaseUrl);

type CandidateRow = { userId: number };

const [[quizCandidate]] = await connection.query<CandidateRow[]>(`
  SELECT e.user_id AS userId
  FROM lms_enrollments e
  INNER JOIN lms_courses c ON c.id = e.course_id
  WHERE c.status = 'public'
    AND c.type = 'quiz'
    AND (e.access_expires_at IS NULL OR e.access_expires_at > NOW())
  LIMIT 1
`);

const [[brandCandidate]] = await connection.query<CandidateRow[]>(`
  SELECT userId
  FROM brandMemberships
  WHERE status IN ('active', 'trialing')
    AND brand IN ('aaus', 'iheartecho')
  GROUP BY userId
  HAVING COUNT(DISTINCT brand) = 2
  LIMIT 1
`);

async function getMyContent(userId: number) {
  const caller = dashboardRouter.createCaller({
    user: { id: userId, role: "user" },
    req: {},
    res: {},
  } as any);
  return caller.getMyContent();
}

const report: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  writesPerformed: false,
};

if (quizCandidate?.userId) {
  const content = await getMyContent(quizCandidate.userId);
  const quizCourses = content.quizzes.filter((item: any) => item.courseType === "quiz");
  report.quizCourseContract = {
    candidateFound: true,
    displayedQuizCourseCount: quizCourses.length,
    hasVisibleQuizCourse: quizCourses.length > 0,
  };
} else {
  report.quizCourseContract = { candidateFound: false, hasVisibleQuizCourse: false };
}

if (brandCandidate?.userId) {
  const content = await getMyContent(brandCandidate.userId);
  const cards = content.memberships.filter((item: any) => item.type === "brand");
  const coverByBrand = new Map(cards.map((card: any) => [card.brand, card.coverImage]));
  report.brandCardContract = {
    candidateFound: true,
    hasUltrasoundAssistCover: typeof coverByBrand.get("aaus") === "string" && coverByBrand.get("aaus").length > 0,
    hasEchoAssistCover: typeof coverByBrand.get("iheartecho") === "string" && coverByBrand.get("iheartecho").length > 0,
  };
} else {
  report.brandCardContract = {
    candidateFound: false,
    hasUltrasoundAssistCover: false,
    hasEchoAssistCover: false,
  };
}

await connection.end();
console.log(JSON.stringify(report, null, 2));

const quizOk = (report.quizCourseContract as any)?.hasVisibleQuizCourse === true;
const cardsOk = (report.brandCardContract as any)?.hasUltrasoundAssistCover === true
  && (report.brandCardContract as any)?.hasEchoAssistCover === true;
// Importing the app router initializes background helpers, so terminate once the
// read-only audit has closed its own connection rather than leaving CI hanging.
process.exit(quizOk && cardsOk ? 0 : 2);
