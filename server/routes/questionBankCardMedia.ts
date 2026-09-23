import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { getDb } from "../db";
import { questionBank } from "../../drizzle/schema";
import { authenticatePlatformMediaAdmin } from "../lib/platformMediaAuth";

const router = Router();

const MEDIA_KINDS = new Set([
  "question-image",
  "question-video",
  "option-image",
  "option-video",
]);

type CardMediaKind = "question-image" | "question-video" | "option-image" | "option-video";
type QuestionOption = { imageUrl?: unknown; videoUrl?: unknown };

function validHttpsUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || !/^https:\/\//i.test(raw)) return null;
  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
}

function optionMediaUrl(options: unknown, key: "imageUrl" | "videoUrl"): string | null {
  if (!Array.isArray(options)) return null;
  for (const option of options as QuestionOption[]) {
    const url = validHttpsUrl(option?.[key]);
    if (url) return url;
  }
  return null;
}

function sourceUrlFor(kind: CardMediaKind, question: {
  questionImageUrl: string | null;
  questionVideoUrl: string | null;
  options: unknown;
}): string | null {
  switch (kind) {
    case "question-image": return validHttpsUrl(question.questionImageUrl);
    case "question-video": return validHttpsUrl(question.questionVideoUrl);
    case "option-image": return optionMediaUrl(question.options, "imageUrl");
    case "option-video": return optionMediaUrl(question.options, "videoUrl");
  }
}

function unavailable(res: Response) {
  return res.status(404).json({ error: "Question media is unavailable." });
}

/**
 * The Quiz Card Generator needs same-origin media so browser canvas exports are
 * never tainted by the private Question Bank / Media Repository object origin.
 * This route remains Platform-Admin-only and only proxies a stored URL belonging
 * to the selected Question Bank record.
 */
router.get("/api/question-bank-card-media/:questionId/:kind", async (req: Request, res: Response) => {
  const user = await authenticatePlatformMediaAdmin(req);
  if (!user) return res.status(401).json({ error: "Platform admin authentication is required." });

  const questionId = Number(req.params.questionId);
  const kind = String(req.params.kind ?? "");
  if (!Number.isSafeInteger(questionId) || questionId <= 0 || !MEDIA_KINDS.has(kind)) {
    return unavailable(res);
  }

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Question media is temporarily unavailable." });

    const [question] = await db
      .select({
        questionImageUrl: questionBank.questionImageUrl,
        questionVideoUrl: questionBank.questionVideoUrl,
        options: questionBank.options,
      })
      .from(questionBank)
      .where(eq(questionBank.id, questionId))
      .limit(1);
    if (!question) return unavailable(res);

    const sourceUrl = sourceUrlFor(kind as CardMediaKind, question);
    if (!sourceUrl) return unavailable(res);

    const headers: Record<string, string> = {};
    if (typeof req.headers.range === "string") headers.Range = req.headers.range;
    const upstream = await fetch(sourceUrl, { headers, redirect: "follow" });
    if (!upstream.ok || !upstream.body) return unavailable(res);

    res.status(upstream.status);
    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    Readable.fromWeb(upstream.body as never).pipe(res);
  } catch (error) {
    console.error("[question-bank-card-media] proxy failed", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(502).json({ error: "Question media could not be loaded." });
    else res.end();
  }
});

export function registerQuestionBankCardMediaRoute(app: import("express").Application) {
  app.use(router);
}
