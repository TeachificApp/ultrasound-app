import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { questionBank, standaloneQuizAttempts, standaloneQuizQuestions, standaloneQuizzes } from "../../drizzle/schema";

const router = Router();

const MEDIA_KINDS = new Set([
  "question-image",
  "question-video",
  "feedback-image",
  "feedback-video",
]);

type MediaKind = "question-image" | "question-video" | "feedback-image" | "feedback-video";

function mediaUrlFor(kind: MediaKind, question: {
  questionImageUrl: string | null;
  questionVideoUrl: string | null;
  feedbackImageUrl: string | null;
  feedbackVideoUrl: string | null;
}): string | null {
  switch (kind) {
    case "question-image": return question.questionImageUrl;
    case "question-video": return question.questionVideoUrl;
    case "feedback-image": return question.feedbackImageUrl;
    case "feedback-video": return question.feedbackVideoUrl;
  }
}

function rejectUnavailable(res: Response) {
  return res.status(404).json({ error: "This quiz media is unavailable." });
}

router.get("/api/standalone-quiz-media/:attemptId/:questionBankId/:kind", async (req: Request, res: Response) => {
  try {
    let user: { id: number } | null = null;
    try { user = await sdk.authenticateRequest(req) as { id: number }; } catch { /* handled below */ }
    if (!user) return res.status(401).json({ error: "Sign in to view quiz media." });

    const attemptId = Number(req.params.attemptId);
    const questionBankId = Number(req.params.questionBankId);
    const kind = String(req.params.kind ?? "");
    if (!Number.isSafeInteger(attemptId) || attemptId <= 0 || !Number.isSafeInteger(questionBankId) || questionBankId <= 0 || !MEDIA_KINDS.has(kind)) {
      return rejectUnavailable(res);
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Quiz media is temporarily unavailable." });

    const [media] = await db
      .select({
        quizType: standaloneQuizzes.type,
        showExplanations: standaloneQuizzes.showExplanations,
        questionImageUrl: questionBank.questionImageUrl,
        questionVideoUrl: questionBank.questionVideoUrl,
        feedbackImageUrl: questionBank.feedbackImageUrl,
        feedbackVideoUrl: questionBank.feedbackVideoUrl,
      })
      .from(standaloneQuizAttempts)
      .innerJoin(standaloneQuizzes, eq(standaloneQuizzes.id, standaloneQuizAttempts.quizId))
      .innerJoin(standaloneQuizQuestions, eq(standaloneQuizQuestions.quizId, standaloneQuizAttempts.quizId))
      .innerJoin(questionBank, eq(questionBank.id, standaloneQuizQuestions.questionBankId))
      .where(and(
        eq(standaloneQuizAttempts.id, attemptId),
        eq(standaloneQuizAttempts.userId, user.id),
        eq(questionBank.id, questionBankId),
      ))
      .limit(1);

    if (!media) return rejectUnavailable(res);
    const isFeedbackMedia = kind.startsWith("feedback-");
    if (isFeedbackMedia && (media.quizType !== "quiz" || !media.showExplanations)) return rejectUnavailable(res);

    const sourceUrl = mediaUrlFor(kind as MediaKind, media);
    if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) return rejectUnavailable(res);

    const requestHeaders: Record<string, string> = {};
    if (typeof req.headers.range === "string") requestHeaders.Range = req.headers.range;
    const upstream = await fetch(sourceUrl, { headers: requestHeaders, redirect: "follow" });
    if (!upstream.ok || !upstream.body) return rejectUnavailable(res);

    res.status(upstream.status);
    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    Readable.fromWeb(upstream.body as never).pipe(res);
  } catch (error) {
    console.error("[standalone-quiz-media] proxy failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) return res.status(502).json({ error: "Quiz media could not be loaded." });
    res.end();
  }
});

export function registerStandaloneQuizMediaRoute(app: import("express").Express) {
  app.use(router);
}
