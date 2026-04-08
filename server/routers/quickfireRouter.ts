/**
 * quickfireRouter.ts
 * tRPC procedures for the Daily QuickFire engine.
 *
 * Procedures:
 *   getTodaySet       — returns today's question set (auto-generates if missing)
 *   getQuestion       — returns a single question by ID
 *   submitAnswer      — records a user's answer and returns correctness + explanation
 *   getUserStats      — streak, accuracy, total answered for the current user
 *   getLeaderboard    — top users by total correct answers (last 30 days)
 *
 * Admin-only:
 *   createQuestion    — add a new question
 *   updateQuestion    — edit an existing question
 *   deleteQuestion    — soft-delete (isActive = false)
 *   listAllQuestions  — paginated list for admin management
 *   generateDailySet  — manually regenerate today's set
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createPatchedFetch } from "../_core/patchedFetch";
import { ENV } from "../_core/env";
import {
  quickfireQuestions,
  quickfireDailySets,
  quickfireAttempts,
  quickfireChallenges,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte, count, inArray, isNull } from "drizzle-orm";
import { sendStreakReminders } from "../streakReminders";
import { runChallengeCron } from "../jobs/challengeCron";
import { notifyOwner } from "../_core/notification";
import { generateVirtualLeaderboard } from "../leaderboardSeed";
import { createHash } from "crypto";
import { flashcardGuestDailyUsage } from "../../drizzle/schema";

// ─── IP-based daily flashcard tracker (DB-backed, survives server restarts) ───────
/** Hash IP for privacy before storing in DB */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

async function getIpFlashcardCount(ip: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = todayDateStr();
  const ipHash = hashIp(ip);
  const rows = await db
    .select({ viewCount: flashcardGuestDailyUsage.viewCount })
    .from(flashcardGuestDailyUsage)
    .where(and(eq(flashcardGuestDailyUsage.ipHash, ipHash), eq(flashcardGuestDailyUsage.dateStr, today)))
    .limit(1);
  return rows[0]?.viewCount ?? 0;
}

async function incrementIpFlashcardCount(ip: string): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  const today = todayDateStr();
  const ipHash = hashIp(ip);
  await db.execute(
    sql`INSERT INTO flashcardGuestDailyUsage (ipHash, dateStr, viewCount, updatedAt)
        VALUES (${ipHash}, ${today}, 1, NOW())
        ON DUPLICATE KEY UPDATE viewCount = viewCount + 1, updatedAt = NOW()`
  );
  const rows = await db
    .select({ viewCount: flashcardGuestDailyUsage.viewCount })
    .from(flashcardGuestDailyUsage)
    .where(and(eq(flashcardGuestDailyUsage.ipHash, ipHash), eq(flashcardGuestDailyUsage.dateStr, today)))
    .limit(1);
  return rows[0]?.viewCount ?? 1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

/** Pick N random items from an array */
function sampleN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Deterministic shuffle seeded by a string (e.g. date + userId).
 * Uses a simple LCG so the same seed always produces the same order.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  // Convert seed string to a numeric seed
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Category keys used throughout the daily challenge system (AAUS categories)
export const CHALLENGE_CATEGORIES = [
  "Abdominal",
  "Small Parts",
  "Pelvic/Gyn",
  "OB 1st Trimester",
  "OB 2nd/3rd Trimester",
  "Fetal Echo",
  "Breast",
  "Vascular",
  "MSK",
  "POCUS",
  "Physics",
] as const;
export type ChallengeCategory = typeof CHALLENGE_CATEGORIES[number];
// Map category label -> JSON key used in questionIds object
const CAT_KEY: Record<ChallengeCategory, string> = {
  "Abdominal": "abdominal",
  "Small Parts": "smallParts",
  "Pelvic/Gyn": "pelvicGyn",
  "OB 1st Trimester": "ob1st",
  "OB 2nd/3rd Trimester": "ob2nd3rd",
  "Fetal Echo": "fetalEcho",
  "Breast": "breast",
  "Vascular": "vascular",
  "MSK": "msk",
  "POCUS": "pocus",
  "Physics": "physics",
};

/**
 * Parse questionIds from a daily set row.
 * Handles both the legacy array format [id] and the new object format
 * { acs: id|null, adultEcho: id|null, pediatricEcho: id|null, fetalEcho: id|null }.
 */
function parseDailySetIds(raw: string): Record<string, number | null> {
  const defaults: Record<string, number | null> = {
    abdominal: null, smallParts: null, pelvicGyn: null, ob1st: null,
    ob2nd3rd: null, fetalEcho: null, breast: null, vascular: null, msk: null, pocus: null, physics: null,
  };
  try {
    const parsed = JSON.parse(raw || "{}");
    if (Array.isArray(parsed)) {
      // Legacy: single-question array — treat as Abdominal
      return { ...defaults, abdominal: parsed[0] ?? null };
    }
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

/**
 * Ensure a daily set exists for the given date.
 * Stores one question per category:
   *   questionIds = JSON object: { abdominal: id|null, vascular: id|null, ob2nd3rd: id|null, pocus: id|null }
 *
 * Priority order per category:
 *   1. Next queued challenge with matching category (draft/scheduled)
 *   2. Fallback: random active non-flashcard question from that category
 */
async function ensureTodaySet(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, date: string) {
  const existing = await db
    .select()
    .from(quickfireDailySets)
    .where(eq(quickfireDailySets.setDate, date))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const questionMap: Record<string, number | null> = {
    abdominal: null, smallParts: null, pelvicGyn: null, ob1st: null,
    ob2nd3rd: null, fetalEcho: null, breast: null, vascular: null, msk: null, pocus: null, physics: null,
  };

  // 0. First, map any already-live challenges for today into the category map
  const liveChallenges = await db
    .select()
    .from(quickfireChallenges)
    .where(eq(quickfireChallenges.status, "live" as any));

  for (const liveC of liveChallenges) {
    if (!liveC.category) continue;
    const key = CAT_KEY[liveC.category as ChallengeCategory];
    if (!key) continue;
    const ids: number[] = JSON.parse(liveC.questionIds || "[]");
    if (ids.length > 0 && questionMap[key] === null) {
      questionMap[key] = ids[0];
    }
  }

  // 1. Check for queued challenges per category (publish next in queue for categories not yet covered)
  const queuedChallenges = await db
    .select()
    .from(quickfireChallenges)
    .where(inArray(quickfireChallenges.status, ["draft", "scheduled"] as any[]))
    .orderBy(quickfireChallenges.priority, quickfireChallenges.createdAt)
    .limit(50);

  const usedChallengeIds: number[] = [];

  for (const cat of CHALLENGE_CATEGORIES) {
    const key = CAT_KEY[cat];
    // Skip if already covered by a live challenge
    if (questionMap[key] !== null) continue;
    const match = queuedChallenges.find(
      (c) =>
        !usedChallengeIds.includes(c.id) &&
        (c.category === cat || (!c.category && cat === "Abdominal")) &&
        (!c.publishDate || c.publishDate <= date)
    );
    if (match) {
      const ids: number[] = JSON.parse(match.questionIds || "[]");
      if (ids.length > 0) {
        questionMap[key] = ids[0];
        usedChallengeIds.push(match.id);
        await db
          .update(quickfireChallenges)
          .set({ status: "live", publishDate: match.publishDate ?? date, publishedAt: new Date(), archivedAt: null })
          .where(eq(quickfireChallenges.id, match.id));
      }
    }
  }

  // Archive previously live challenges that were replaced today (same category, not re-used)
  // Only archive live challenges for categories that got a new challenge today
  const categoriesPublishedToday = queuedChallenges
    .filter((c) => usedChallengeIds.includes(c.id))
    .map((c) => c.category)
    .filter(Boolean) as string[];

  if (categoriesPublishedToday.length > 0) {
    const liveRows = await db
      .select({ id: quickfireChallenges.id, category: quickfireChallenges.category })
      .from(quickfireChallenges)
      .where(eq(quickfireChallenges.status, "live"));
    for (const row of liveRows) {
      // Archive only if: this category got a new challenge today AND this row wasn't the one just published
      if (!usedChallengeIds.includes(row.id) && row.category && categoriesPublishedToday.includes(row.category)) {
        await db
          .update(quickfireChallenges)
          .set({ status: "archived", archivedAt: new Date() })
          .where(eq(quickfireChallenges.id, row.id));
      }
    }
  }

  // 2. Fallback: for any category still null, pick a random active question
  // Exclude questions already used in archived/live challenges for the same category (no repeats)
  // Collect recently used question IDs per category from the last 90 days of archived challenges
  const recentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentArchived = await db
    .select({ category: quickfireChallenges.category, questionIds: quickfireChallenges.questionIds })
    .from(quickfireChallenges)
    .where(and(
      inArray(quickfireChallenges.status, ["archived", "live"] as any[]),
      sql`${quickfireChallenges.publishedAt} >= ${recentCutoff}` as any
    ));

  const usedIdsByCategory: Record<string, Set<number>> = {};
  for (const row of recentArchived) {
    const catKey = row.category ?? "";
    if (!usedIdsByCategory[catKey]) usedIdsByCategory[catKey] = new Set();
    try {
      const ids: number[] = JSON.parse(row.questionIds || "[]");
      for (const id of ids) usedIdsByCategory[catKey].add(id);
    } catch { /* ignore */ }
  }

  const VASCULAR_CATS = ["Vascular"];
  // Track which categories need a fallback live challenge row created
  const fallbackLiveNeeded: { cat: ChallengeCategory; questionId: number }[] = [];

  for (const cat of CHALLENGE_CATEGORIES) {
    const key = CAT_KEY[cat];
    if (questionMap[key] !== null) continue;
    const usedIds = Array.from(usedIdsByCategory[cat] ?? new Set<number>());
    const catFilter = cat === "Vascular"
      ? sql`${quickfireQuestions.category} IN (${sql.join(VASCULAR_CATS.map(c => sql`${c}`), sql`, `)})` as any
      : sql`${quickfireQuestions.category} = ${cat}` as any;

    // Try scenario questions first (preferred for challenges)
    const scenarioPool = await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(and(
        eq(quickfireQuestions.isActive, true),
        sql`${quickfireQuestions.type} != 'quickReview'` as any,
        catFilter,
        ...(usedIds.length > 0 ? [sql`${quickfireQuestions.id} NOT IN (${sql.join(usedIds.map(id => sql`${id}`), sql`, `)})` as any] : [])
      ));

    // Fallback 1: scenario pool without dedup exclusion (cycle reset)
    const scenarioFull = scenarioPool.length > 0 ? scenarioPool : await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(and(
        eq(quickfireQuestions.isActive, true),
        sql`${quickfireQuestions.type} != 'quickReview'` as any,
        catFilter
      ));

    if (scenarioFull.length > 0) {
      const picked = sampleN(scenarioFull, 1)[0].id;
      questionMap[key] = picked;
      fallbackLiveNeeded.push({ cat, questionId: picked });
      continue;
    }

    // Fallback 2: if no scenario questions at all, use quickReview questions
    const reviewPool = await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(and(
        eq(quickfireQuestions.isActive, true),
        catFilter,
        ...(usedIds.length > 0 ? [sql`${quickfireQuestions.id} NOT IN (${sql.join(usedIds.map(id => sql`${id}`), sql`, `)})` as any] : [])
      ));

    const reviewFull = reviewPool.length > 0 ? reviewPool : await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(and(
        eq(quickfireQuestions.isActive, true),
        catFilter
      ));

    if (reviewFull.length > 0) {
      const picked = sampleN(reviewFull, 1)[0].id;
      questionMap[key] = picked;
      fallbackLiveNeeded.push({ cat, questionId: picked });
    }
  }

  // Alert admin if any category has no questions at all
  const emptyCats = CHALLENGE_CATEGORIES.filter(cat => questionMap[CAT_KEY[cat]] === null);
  if (emptyCats.length > 0) {
    notifyOwner({
      title: `⚠️ Daily Challenge: ${emptyCats.length} categor${emptyCats.length === 1 ? 'y has' : 'ies have'} no available questions`,
      content: `The following categories had no active questions available for today's (${date}) daily challenge and will show no question card:\n\n${emptyCats.map(c => `• ${c}`).join('\n')}\n\nPlease add active questions for these categories in the admin panel.`,
    }).catch(() => { /* non-blocking */ });
  }

  // Create live quickfireChallenges rows for fallback categories (so admin queue shows all 11)
  for (const { cat, questionId } of fallbackLiveNeeded) {
    // Archive any existing live challenge for this category first
    await db
      .update(quickfireChallenges)
      .set({ status: "archived", archivedAt: new Date() })
      .where(and(
        eq(quickfireChallenges.status, "live" as any),
        eq(quickfireChallenges.category, cat as any)
      ));
    // Create a new live challenge row for this category
    await db.insert(quickfireChallenges).values({
      title: `${cat} Daily Challenge — ${date}`,
      description: "",
      category: cat as any,
      questionIds: JSON.stringify([questionId]),
      status: "live" as any,
      priority: 100,
      publishDate: date,
      publishedAt: new Date(),
    });
  }

  const questionIds = JSON.stringify(questionMap);
  await db.insert(quickfireDailySets).values({ setDate: date, questionIds });
  return { setDate: date, questionIds };
}

// ─── Admin guard ─────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Router ──────────────────────────────────────────────────────────────────

export const quickfireRouter = router({
  /** Returns today's question set with full question data, grouped by category */
   getTodaySet: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const date = todayDateStr();
    const set = await ensureTodaySet(db, date);
    const questionMap = parseDailySetIds(set.questionIds);
    // Always sync questionMap from current live challenges — overrides stale stored IDs.
    // This ensures mid-day challenge swaps (trash/promote) are immediately reflected.
    const liveChallengesNow = await db
      .select({ category: quickfireChallenges.category, questionIds: quickfireChallenges.questionIds })
      .from(quickfireChallenges)
      .where(eq(quickfireChallenges.status, "live" as any));
    let mapChanged = false;
    // Build a set of keys that have a live challenge
    const liveKeys = new Set<string>();
    for (const lc of liveChallengesNow) {
      if (!lc.category) continue;
      const key = CAT_KEY[lc.category as ChallengeCategory];
      if (!key) continue;
      liveKeys.add(key);
      const ids: number[] = JSON.parse(lc.questionIds || "[]");
      if (ids.length > 0 && questionMap[key] !== ids[0]) {
        questionMap[key] = ids[0];
        mapChanged = true;
      }
    }
    // Clear categories that no longer have a live challenge
    for (const key of Object.keys(questionMap)) {
      if (!liveKeys.has(key) && questionMap[key] !== null) {
        questionMap[key] = null;
        mapChanged = true;
      }
    }
    // Persist the updated map back to the daily set row if it changed
    if (mapChanged) {
      await db
        .update(quickfireDailySets)
        .set({ questionIds: JSON.stringify(questionMap) })
        .where(eq(quickfireDailySets.setDate, date))
        .catch(() => { /* non-blocking — stale row is fine */ });
    }
    // Determine which categories the user has opted into (default: all)
    let enabledCats: Set<string> = new Set(["abdominal", "smallParts", "pelvicGyn", "ob1st", "ob2nd3rd", "fetalEcho", "breast", "vascular", "msk", "pocus", "physics"]);
    if (ctx.user) {
      const [userRow] = await db
        .select({ challengeCategoryPrefs: users.challengeCategoryPrefs })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      if (userRow?.challengeCategoryPrefs) {
        try {
          const prefs = JSON.parse(userRow.challengeCategoryPrefs);
          // prefs: { abdominal: bool, vascular: bool, ob2nd3rd: bool, pocus: bool }
          // false = opted out
          enabledCats = new Set(
            Object.entries(prefs)
              .filter(([, v]) => v !== false)
              .map(([k]) => k)
          );
          // If user opted out of everything, show all anyway
          if (enabledCats.size === 0) enabledCats = new Set(["abdominal", "smallParts", "pelvicGyn", "ob1st", "ob2nd3rd", "fetalEcho", "breast", "vascular", "msk", "pocus", "physics"]);
        } catch { /* ignore parse errors */ }
      }
    }

    // Collect all question IDs for enabled categories
    const allIds: number[] = Object.entries(questionMap)
      .filter(([key, id]) => enabledCats.has(key) && id !== null)
      .map(([, id]) => id as number);

    if (allIds.length === 0) {
      return { setDate: date, questions: [], userAttempts: {}, categoryMap: questionMap };
    }

    // Fetch by ID only — isActive was already enforced when the daily set was built
    const questions = await db
      .select()
      .from(quickfireQuestions)
      .where(inArray(quickfireQuestions.id, allIds));

    const catOrder = ["abdominal", "smallParts", "pelvicGyn", "ob1st", "ob2nd3rd", "fetalEcho", "breast", "vascular", "msk", "pocus", "physics"];
    const orderedQuestions = catOrder
      .filter((key) => enabledCats.has(key) && questionMap[key] !== null)
      .map((key) => questions.find((q) => q.id === questionMap[key]))
      .filter(Boolean) as typeof questions;

    // If user is authenticated, fetch their attempts for today
    let userAttempts: Record<number, { selectedAnswer: number | null; selfMarkedCorrect: boolean | null; isCorrect: boolean | null }> = {};
    if (ctx.user && db) {
      const attempts = await db
        .select()
        .from(quickfireAttempts)
        .where(
          and(
            eq(quickfireAttempts.userId, ctx.user.id),
            eq(quickfireAttempts.setDate, date)
          )
        );
      for (const a of attempts) {
        userAttempts[a.questionId] = {
          selectedAnswer: a.selectedAnswer,
          selfMarkedCorrect: a.selfMarkedCorrect,
          isCorrect: a.isCorrect,
        };
      }
    }

    // Strip correct answers from response (don't reveal until answered)
    const sanitized = orderedQuestions.map((q) => {
      const attempted = userAttempts[q.id];
      return {
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        tags: q.tags ? JSON.parse(q.tags) : [],
        pairs: q.pairs ? JSON.parse(q.pairs) : null,
        markers: q.markers ? JSON.parse(q.markers) : null,
        orderedItems: q.orderedItems ? JSON.parse(q.orderedItems) : null,
        // Only reveal correct answer if user has already attempted
        correctAnswer: attempted ? q.correctAnswer : null,
        explanation: attempted ? q.explanation : null,
        reviewAnswer: attempted ? q.reviewAnswer : null,
      };
    });

    return { setDate: date, questions: sanitized, userAttempts, categoryMap: questionMap };
  }),

  /** Submit an answer for a question in today's set */
  submitAnswer: protectedProcedure
    .input(
      z.object({
        questionId: z.number().int().positive(),
        selectedAnswer: z.number().int().min(0).optional(), // MCQ index
        selfMarkedCorrect: z.boolean().optional(), // quickReview self-assessment
        timeMs: z.number().int().min(0).max(300000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const date = todayDateStr();

      // Verify question exists
      const [question] = await db
        .select()
        .from(quickfireQuestions)
        .where(eq(quickfireQuestions.id, input.questionId))
        .limit(1);

      if (!question) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }

      // Prevent double-submission
      const [existing] = await db
        .select()
        .from(quickfireAttempts)
        .where(
          and(
            eq(quickfireAttempts.userId, ctx.user.id),
            eq(quickfireAttempts.questionId, input.questionId),
            eq(quickfireAttempts.setDate, date)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Already answered this question today",
        });
      }

      // Determine correctness
      let isCorrect: boolean | null = null;
      if (question.type === "quickReview") {
        isCorrect = input.selfMarkedCorrect ?? null;
      } else if (input.selectedAnswer !== undefined && question.correctAnswer !== null) {
        isCorrect = input.selectedAnswer === question.correctAnswer;
      }

      await db.insert(quickfireAttempts).values({
        userId: ctx.user.id,
        questionId: input.questionId,
        setDate: date,
        selectedAnswer: input.selectedAnswer ?? null,
        selfMarkedCorrect: input.selfMarkedCorrect ?? null,
        isCorrect,
        timeMs: input.timeMs ?? null,
      });

      return {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        reviewAnswer: question.reviewAnswer,
      };
    }),

  /** Get the current user's QuickFire stats */
getUserStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const userId = ctx.user.id;
    const allAttempts = await db
      .select()
      .from(quickfireAttempts)
      .where(eq(quickfireAttempts.userId, userId))
      .orderBy(desc(quickfireAttempts.setDate));
    const total = allAttempts.length;
    const correct = allAttempts.filter((a) => a.isCorrect === true).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    // Calculate current streak
    const dates = Array.from(new Set(allAttempts.map((a) => a.setDate))).sort().reverse();
    let streak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const today = todayDateStr();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      if (dates[i] === expectedStr) { streak++; } else { break; }
    }
    // Best streak
    const sortedDates = [...dates].sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) { tempStreak = 1; }
      else {
        const prev = new Date(sortedDates[i - 1]);
        prev.setDate(prev.getDate() + 1);
        if (prev.toISOString().slice(0, 10) === sortedDates[i]) { tempStreak++; }
        else { tempStreak = 1; }
      }
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    }
    // Per-category accuracy + per-category streak tracking
    const questionIds = Array.from(new Set(allAttempts.map((a) => a.questionId)));
    const categoryStats: Record<string, { correct: number; total: number; streak: number; bestStreak: number }> = {};
    if (questionIds.length > 0) {
      const qs = await db
        .select({ id: quickfireQuestions.id, category: quickfireQuestions.category })
        .from(quickfireQuestions)
        .where(inArray(quickfireQuestions.id, questionIds));
      const catMap = new Map(qs.map((q) => [q.id, q.category ?? "Abdominal"]));
      // Build per-category date sets for streak calculation
      const catDateSets: Record<string, Set<string>> = {};
      for (const attempt of allAttempts) {
        const cat = catMap.get(attempt.questionId) ?? "Abdominal";
        if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0, streak: 0, bestStreak: 0 };
        categoryStats[cat].total++;
        if (attempt.isCorrect) categoryStats[cat].correct++;
        if (!catDateSets[cat]) catDateSets[cat] = new Set();
        catDateSets[cat].add(attempt.setDate);
      }
      // Calculate per-category streaks
      const todayStr = todayDateStr();
      for (const [cat, dateSet] of Object.entries(catDateSets)) {
        const sortedCatDates = Array.from(dateSet).sort().reverse();
        let catStreak = 0;
        let catBestStreak = 0;
        let catTempStreak = 0;
        for (let i = 0; i < sortedCatDates.length; i++) {
          const expected = new Date(todayStr);
          expected.setDate(expected.getDate() - i);
          if (sortedCatDates[i] === expected.toISOString().slice(0, 10)) { catStreak++; } else { break; }
        }
        const sortedCatAsc = Array.from(dateSet).sort();
        for (let i = 0; i < sortedCatAsc.length; i++) {
          if (i === 0) { catTempStreak = 1; }
          else {
            const prev = new Date(sortedCatAsc[i - 1]);
            prev.setDate(prev.getDate() + 1);
            if (prev.toISOString().slice(0, 10) === sortedCatAsc[i]) { catTempStreak++; } else { catTempStreak = 1; }
          }
          if (catTempStreak > catBestStreak) catBestStreak = catTempStreak;
        }
        if (categoryStats[cat]) {
          categoryStats[cat].streak = catStreak;
          categoryStats[cat].bestStreak = catBestStreak;
        }
      }
    }
    // Recent 14-day history
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const cutoff14 = fourteenDaysAgo.toISOString().slice(0, 10);
    const recentAttempts = allAttempts.filter((a) => a.setDate >= cutoff14);
    const byDate: Record<string, { correct: number; total: number }> = {};
    for (const a of recentAttempts) {
      if (!byDate[a.setDate]) byDate[a.setDate] = { correct: 0, total: 0 };
      byDate[a.setDate].total++;
      if (a.isCorrect) byDate[a.setDate].correct++;
    }
    const recentHistory = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, s]) => ({ date, correct: s.correct, total: s.total, accuracy: Math.round((s.correct / s.total) * 100) }));
    // Bonus XP: 50 points per approved submission
    const approvedSubmissions = await db
      .select({ id: quickfireQuestions.id })
      .from(quickfireQuestions)
      .where(
        and(
          eq(quickfireQuestions.submittedByUserId, userId),
          eq(quickfireQuestions.submissionStatus, "approved")
        )
      );
    const bonusPoints = approvedSubmissions.length * 50;
    const approvedSubmissionCount = approvedSubmissions.length;
    return { total, correct, accuracy, streak, bestStreak, categoryStats, recentHistory, bonusPoints, approvedSubmissionCount };
  }),

  /** Leaderboard with period filter and current user rank */
  getLeaderboard: protectedProcedure
    .input(z.object({ period: z.enum(["7d", "30d", "allTime"]).default("30d") }).optional())
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const period = input?.period ?? "30d";
    let cutoff: string | null = null;
    if (period === "7d") { const d = new Date(); d.setDate(d.getDate() - 7); cutoff = d.toISOString().slice(0, 10); }
    else if (period === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); cutoff = d.toISOString().slice(0, 10); }
    const whereClause = cutoff ? gte(quickfireAttempts.setDate, cutoff) : undefined;
    const results = await db
      .select({
        userId: quickfireAttempts.userId,
        correct: sql<number>`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`,
        total: count(quickfireAttempts.id),
      })
      .from(quickfireAttempts)
      .where(whereClause)
      .groupBy(quickfireAttempts.userId)
      .orderBy(desc(sql`SUM(CASE WHEN ${quickfireAttempts.isCorrect} = 1 THEN 1 ELSE 0 END)`))
      .limit(50);
    const userIds = results.map((r) => r.userId);
    // NOTE: Do NOT early-return when userIds is empty — virtual entries must still be shown
    const userList = userIds.length > 0 ? await db
      .select({ id: users.id, displayName: users.displayName, name: users.name, avatarUrl: users.avatarUrl, openId: users.openId })
      .from(users)
      .where(inArray(users.id, userIds)) : [];
    const currentUserId = ctx.user.id;
    const allEntries = results.map((r, i) => {
      const u = userList.find((u) => u.id === r.userId);
      const rawName = u?.displayName || u?.name || "Anonymous";
      const maskedName = (u?.openId && ENV.ownerOpenId && u.openId === ENV.ownerOpenId)
        ? "All About Ultrasound"
        : rawName;
      return {
        rank: i + 1,
        userId: r.userId,
        displayName: maskedName,
        avatarUrl: u?.avatarUrl ?? null,
        correct: Number(r.correct),
        total: Number(r.total),
        accuracy: r.total > 0 ? Math.round((Number(r.correct) / Number(r.total)) * 100) : 0,
        isCurrentUser: r.userId === currentUserId,
      };
    });
    // Merge real users with virtual seeded entries
    const virtualEntries = generateVirtualLeaderboard(1200, period);
    // Convert real entries to same shape as virtual
    type LeaderEntry = {
      rank: number;
      userId: string | number;
      displayName: string;
      avatarUrl: string | null;
      correct: number;
      total: number;
      accuracy: number;
      isCurrentUser: boolean;
      isVirtual?: boolean;
      city?: string;
    };
    const realMapped: LeaderEntry[] = allEntries.map((e) => ({ ...e, isVirtual: false }));
    // Combine and sort by correct desc
    const combined: LeaderEntry[] = [...realMapped, ...virtualEntries]
      .sort((a, b) => b.correct - a.correct || b.accuracy - a.accuracy);
    // Assign ranks
    combined.forEach((e, i) => { e.rank = i + 1; });
    // Find current user
    const currentUserEntry = combined.find((e) => e.userId === currentUserId || String(e.userId) === String(currentUserId)) ?? null;
    const currentUserRank = currentUserEntry?.rank ?? null;
    // Return top 50 + current user if outside top 50
    const top50 = combined.slice(0, 50);
    const entries = [...top50];
    if (currentUserEntry && currentUserRank && currentUserRank > 50) entries.push(currentUserEntry);
    return { entries, currentUserRank, currentUserEntry };
  }),

    // ─── Admin procedures ───────────────────────────────────────────────────────

  createQuestion: adminProcedure
    .input(
      z.object({
        type: z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]),
        question: z.string().min(5).max(10000),
        options: z.array(z.string().min(1)).min(2).max(6).optional(),
        correctAnswer: z.number().int().min(0).optional(),
        explanation: z.string().max(50000).optional(),
        reviewAnswer: z.string().max(50000).optional(),
        imageUrl: z.string().url().optional(),
        videoUrl: z.string().url().optional(),
        // connect: array of {left, right} pairs
        pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
        // identifier: array of {x, y, label, radius?} markers on an image
        markers: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().min(1), radius: z.number().optional() })).optional(),
        // order: array of strings in the correct order
        orderedItems: z.array(z.string().min(1)).min(2).max(10).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        tags: z.array(z.string()).default([]),
        echoCategory: z.enum(["abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo", "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd", "pocus", "physics", "thyroid", "scrotum", "breast", "msk"]).default("abdominal"),
        category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(quickfireQuestions).values({
        type: input.type,
        question: input.question,
        options: input.options ? JSON.stringify(input.options) : null,
        correctAnswer: input.correctAnswer ?? null,
        explanation: input.explanation ?? null,
        reviewAnswer: input.reviewAnswer ?? null,
        imageUrl: input.imageUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        pairs: input.pairs ? JSON.stringify(input.pairs) : null,
        markers: input.markers ? JSON.stringify(input.markers) : null,
        orderedItems: input.orderedItems ? JSON.stringify(input.orderedItems) : null,
        difficulty: input.difficulty,
        tags: JSON.stringify(input.tags),
        echoCategory: input.echoCategory,
        category: input.category as any,
        isActive: true,
        createdByUserId: ctx.user.id,
      });
      const newId = (result as any).insertId as number;
      // Auto-assign QID: QID-XXXX (zero-padded to 4 digits, grows beyond 4 digits for large IDs)
      const qid = `QID-${String(newId).padStart(4, '0')}`;
      await db.update(quickfireQuestions).set({ qid }).where(eq(quickfireQuestions.id, newId));
      return { id: newId, qid };
    }),

  updateQuestion: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        type: z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]).optional(),
        question: z.string().min(5).max(10000).optional(),
        options: z.array(z.string().min(1)).min(2).max(6).optional(),
        correctAnswer: z.number().int().min(0).optional(),
        explanation: z.string().max(50000).optional(),
        reviewAnswer: z.string().max(50000).optional(),
        imageUrl: z.string().url().optional().nullable(),
        videoUrl: z.string().url().optional().nullable(),
        pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().nullable(),
        markers: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().min(1), radius: z.number().optional() })).optional().nullable(),
        orderedItems: z.array(z.string().min(1)).min(2).max(10).optional().nullable(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        tags: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        echoCategory: z.enum(["abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo", "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd", "pocus", "physics", "thyroid", "scrotum", "breast", "msk"]).optional(),
        category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, options, tags, pairs, markers, orderedItems, ...rest } = input;
      await db
        .update(quickfireQuestions)
        .set({
          ...rest,
          ...(options !== undefined ? { options: options ? JSON.stringify(options) : null } : {}),
          ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
          ...(pairs !== undefined ? { pairs: pairs ? JSON.stringify(pairs) : null } : {}),
          ...(markers !== undefined ? { markers: markers ? JSON.stringify(markers) : null } : {}),
          ...(orderedItems !== undefined ? { orderedItems: orderedItems ? JSON.stringify(orderedItems) : null } : {}),
        })
        .where(eq(quickfireQuestions.id, id));
      return { success: true };
    }),

  /**
   * Duplicate a question: creates a copy with a new unique QID and "[Copy]" prefix.
   * The copy starts as active so it appears in the question bank immediately.
   */
  duplicateQuestion: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [original] = await db.select().from(quickfireQuestions)
        .where(eq(quickfireQuestions.id, input.id)).limit(1);
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });
      const [result] = await db.insert(quickfireQuestions).values({
        type: original.type,
        question: `[Copy] ${original.question}`,
        options: original.options,
        correctAnswer: original.correctAnswer,
        explanation: original.explanation,
        reviewAnswer: original.reviewAnswer,
        imageUrl: original.imageUrl,
        videoUrl: original.videoUrl,
        pairs: original.pairs,
        markers: original.markers,
        orderedItems: original.orderedItems,
        difficulty: original.difficulty,
        tags: original.tags,
        echoCategory: original.echoCategory,
        category: original.category,
        isActive: true,
        deletedAt: null,
        createdByUserId: ctx.user.id,
      });
      const newId = (result as any).insertId as number;
      const qid = `QID-${String(newId).padStart(4, '0')}`;
      await db.update(quickfireQuestions).set({ qid }).where(eq(quickfireQuestions.id, newId));
      return { id: newId, qid };
    }),

  /**
   * Soft-delete a question: moves it to the trash (sets deletedAt + isActive=false).
   * Permanently purged after 30 days via the trash purge procedure.
   */
  deleteQuestion: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(quickfireQuestions)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(quickfireQuestions.id, input.id));
      return { success: true };
    }),

  /**
   * Bulk soft-delete multiple questions by ID — moves them to trash.
   */
  bulkDeleteQuestions: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(quickfireQuestions)
        .set({ isActive: false, deletedAt: new Date() })
        .where(inArray(quickfireQuestions.id, input.ids));
      return { deleted: input.ids.length };
    }),

  /** List trashed questions (deletedAt is set, not yet permanently purged). */
  listTrashedQuestions: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select()
        .from(quickfireQuestions)
        .where(sql`${quickfireQuestions.deletedAt} IS NOT NULL`)
        .orderBy(desc(quickfireQuestions.deletedAt));
      return rows.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        tags: q.tags ? JSON.parse(q.tags) : [],
        daysUntilPurge: Math.max(0, 30 - Math.floor((Date.now() - new Date(q.deletedAt!).getTime()) / 86_400_000)),
      }));
    }),

  /** Restore a trashed question back to the active bank. */
  restoreQuestion: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(quickfireQuestions)
        .set({ isActive: true, deletedAt: null })
        .where(eq(quickfireQuestions.id, input.id));
      return { success: true };
    }),

  /** Permanently delete a single trashed question immediately. */
  purgeQuestion: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Only allow purging trashed questions
      const [q] = await db.select({ deletedAt: quickfireQuestions.deletedAt })
        .from(quickfireQuestions).where(eq(quickfireQuestions.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      if (!q.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Question is not in trash" });
      await db.delete(quickfireQuestions).where(eq(quickfireQuestions.id, input.id));
      return { success: true };
    }),

  /** Auto-purge questions that have been in trash for more than 30 days. Called by cron or manually. */
  purgeExpiredTrash: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Purge trashed questions older than 30 days
      const expiredQuestions = await db
        .select({ id: quickfireQuestions.id })
        .from(quickfireQuestions)
        .where(sql`${quickfireQuestions.deletedAt} IS NOT NULL AND ${quickfireQuestions.deletedAt} <= ${cutoff}`);
      if (expiredQuestions.length > 0) {
        await db.delete(quickfireQuestions)
          .where(inArray(quickfireQuestions.id, expiredQuestions.map((q) => q.id)));
      }
      // Purge trashed challenges older than 30 days
      const expiredChallenges = await db
        .select({ id: quickfireChallenges.id })
        .from(quickfireChallenges)
        .where(sql`${quickfireChallenges.status} = 'trash' AND ${quickfireChallenges.trashedAt} IS NOT NULL AND ${quickfireChallenges.trashedAt} <= ${cutoff}`);
      if (expiredChallenges.length > 0) {
        await db.delete(quickfireChallenges)
          .where(inArray(quickfireChallenges.id, expiredChallenges.map((c) => c.id)));
      }
      const purged = expiredQuestions.length + expiredChallenges.length;
      return { purged, purgedQuestions: expiredQuestions.length, purgedChallenges: expiredChallenges.length };
    }),

  listAllQuestions: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        type: z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]).optional(),
        includeInactive: z.boolean().default(false),
        search: z.string().max(200).optional(),
        echoCategory: z.enum(["abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo", "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd", "pocus", "physics", "thyroid", "scrotum", "breast", "msk"]).optional(),
        category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).optional(),
        ids: z.array(z.number().int().positive()).max(50).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const offset = (input.page - 1) * input.limit;

      const conditions: any[] = [];
      // Always exclude trashed questions from the bank (they live in the Trash tab only)
      conditions.push(sql`${quickfireQuestions.deletedAt} IS NULL`);
      // When fetching by specific IDs, skip the active filter so inactive questions are included
      if (!input.includeInactive && !input.ids?.length) {
        conditions.push(eq(quickfireQuestions.isActive, true));
      }
      if (input.ids?.length) {
        conditions.push(inArray(quickfireQuestions.id, input.ids));
      }
      if (input.type) {
        conditions.push(eq(quickfireQuestions.type, input.type));
      } else {
        // Exclude quickReview (flashcard) type from the Question Bank — they live in Flashcard Management only
        conditions.push(sql`${quickfireQuestions.type} != 'quickReview'`);
      }
      if (input.echoCategory) {
        conditions.push(eq(quickfireQuestions.echoCategory, input.echoCategory));
      }
      if (input.category) {
        conditions.push(sql`${quickfireQuestions.category} = ${input.category}` as any);
      }
      if (input.search) {
        const term = `%${input.search.toLowerCase()}%`;
        conditions.push(sql`(LOWER(${quickfireQuestions.question}) LIKE ${term} OR LOWER(${quickfireQuestions.reviewAnswer}) LIKE ${term} OR LOWER(${quickfireQuestions.explanation}) LIKE ${term})`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [questions, totalResult] = await Promise.all([
        db
          .select()
          .from(quickfireQuestions)
          .where(whereClause)
          .orderBy(desc(quickfireQuestions.createdAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: count(quickfireQuestions.id) })
          .from(quickfireQuestions)
          .where(whereClause),
      ]);

      return {
        questions: questions.map((q) => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : null,
          tags: q.tags ? JSON.parse(q.tags) : [],
          pairs: q.pairs ? JSON.parse(q.pairs) : null,
          markers: q.markers ? JSON.parse(q.markers) : null,
          orderedItems: q.orderedItems ? JSON.parse(q.orderedItems) : null,
        })),
        total: totalResult[0]?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  /**
   * AI-powered bulk question generator.
   * Generates N questions for a given topic and inserts them into the DB.
   * Returns the generated questions and their new IDs for preview.
   */
  aiGenerateQuestions: adminProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        type: z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]).default("scenario"),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        count: z.number().int().min(1).max(20).default(5),
        insertImmediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ENV.forgeApiKey || !ENV.forgeApiUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI service not configured. Missing Forge API credentials.",
        });
      }

      const forgeBaseUrl = (ENV.forgeApiUrl ?? "").replace(/\/+$/, "");
      const forgeApiKey = ENV.forgeApiKey ?? "";

      let typeInstructions: string;
      let jsonFormatInstructions: string;

      if (input.type === "quickReview") {
        typeInstructions = `Each item is a flashcard: a short clinical question or fact prompt in 'question', and the concise answer in 'reviewAnswer'. Do NOT include options or correctAnswer.`;
        jsonFormatInstructions = `{"questions":[{"question":"...","reviewAnswer":"...","tags":["...","..."]}]}`;
      } else if (input.type === "connect") {
        typeInstructions = `Each item is a matching/connect question. The 'question' field describes what to match. The 'pairs' field is an array of exactly 4 objects, each with 'left' and 'right' string properties representing matching pairs. Include an 'explanation' describing why each pair matches. Do NOT include options or correctAnswer.`;
          jsonFormatInstructions = `{"questions":[{"question":"Match each ultrasound finding with its associated condition:","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}],"explanation":"...","tags":["...","..."]}]}`;
      } else if (input.type === "order") {
        typeInstructions = `Each item is an ordering/sequencing question. The 'question' field describes what to arrange. The 'orderedItems' field is an array of 4-6 strings listed in the CORRECT order. Include an 'explanation' describing why this order is correct. Do NOT include options or correctAnswer.`;
        jsonFormatInstructions = `{"questions":[{"question":"Arrange the following in the correct order:","orderedItems":["First item","Second item","Third item","Fourth item"],"explanation":"...","tags":["...","..."]}]}`;
      } else {
        // scenario, image, identifier
        typeInstructions = `Each item is a multiple-choice question with exactly 4 options in 'options', a 0-indexed correctAnswer as a number (0, 1, 2, or 3), and a clear explanation. Do NOT include reviewAnswer.`;
        jsonFormatInstructions = `{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","tags":["...","..."]}]}`;
      }

      const promptText = `You are an expert ultrasound educator creating ${input.count} ${input.difficulty} ${input.type} questions about: "${input.topic}".

${typeInstructions}

Guidelines:
- Use accurate, up-to-date AIUM/SVU/ACR/ARDMS guidelines where applicable
- Questions should be clinically relevant and educational
- For MCQ: distractors should be plausible but clearly distinguishable from the correct answer
- Tags: 2-4 specific clinical terms (e.g. "hepatic veins", "AIUM 2023", "Doppler")
- Difficulty: ${input.difficulty} (beginner=basic concepts, intermediate=clinical application, advanced=complex interpretation)

Return exactly ${input.count} questions as a valid JSON object matching this format:
${jsonFormatInstructions}

Return ONLY the JSON object, no markdown, no explanation, no code fences.`;

      // Fetch existing question texts for deduplication — pass to AI so it avoids repeating topics
      let existingQuestionSummaries: string[] = [];
      try {
        const db = await getDb();
        if (db) {
          const existing = await db
            .select({ question: quickfireQuestions.question })
            .from(quickfireQuestions)
            .where(sql`${quickfireQuestions.deletedAt} IS NULL AND ${quickfireQuestions.type} = ${input.type}`)
            .orderBy(desc(quickfireQuestions.id))
            .limit(100);
          existingQuestionSummaries = existing.map((q) => {
            // Strip HTML and truncate to first 120 chars for the prompt
            const plain = q.question.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
            return plain.length > 120 ? plain.slice(0, 117) + "..." : plain;
          });
        }
      } catch { /* non-fatal — proceed without dedup context */ }

      const dedupInstruction = existingQuestionSummaries.length > 0
        ? `\nIMPORTANT — Do NOT repeat or closely paraphrase any of the following ${existingQuestionSummaries.length} existing questions already in the database. Each new question must cover a DISTINCT clinical scenario, value, or concept:\n${existingQuestionSummaries.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`
        : "";

      // Batch into groups of 5 to avoid JSON truncation on large requests
      const BATCH_SIZE = 5;
      const totalCount = input.count;
      const batches: number[] = [];
      let remaining = totalCount;
      while (remaining > 0) {
        const batchCount = Math.min(BATCH_SIZE, remaining);
        batches.push(batchCount);
        remaining -= batchCount;
      }

      const allTexts: string[] = [];

      for (const batchCount of batches) {
        const batchPrompt = `You are an expert ultrasound educator creating ${batchCount} ${input.difficulty} ${input.type} questions about: "${input.topic}".

${typeInstructions}
${dedupInstruction}
Guidelines:
- Use accurate, up-to-date AIUM/SVU/ACR/ARDMS guidelines where applicable
- Questions should be clinically relevant and educational
- For MCQ: distractors should be plausible but clearly distinguishable from the correct answer
- Tags: 2-4 specific clinical terms (e.g. "hepatic veins", "AIUM 2023", "Doppler")
- Difficulty: ${input.difficulty} (beginner=basic concepts, intermediate=clinical application, advanced=complex interpretation)
- Each question MUST be unique — different clinical scenario, different patient presentation, different values

Return exactly ${batchCount} questions as a valid JSON object matching this format:
${jsonFormatInstructions}

Return ONLY the JSON object, no markdown, no explanation, no code fences.`;

        let batchText: string;
        try {
          const aiResp = await fetch(`${forgeBaseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${forgeApiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{ role: "user", content: batchPrompt }],
              temperature: 0.7,
              max_tokens: 8000, // ample for 5 questions, prevents truncation
              response_format: { type: "json_object" },
            }),
          });
          if (!aiResp.ok) {
            const errBody = await aiResp.text();
            throw new Error(`Forge API returned ${aiResp.status}: ${errBody.substring(0, 200)}`);
          }
          const aiData = await aiResp.json() as {
            choices?: { message?: { content?: string } }[];
            error?: { message?: string };
          };
          if (aiData.error) {
            throw new Error(`Forge API error: ${aiData.error.message ?? JSON.stringify(aiData.error)}`);
          }
          batchText = aiData.choices?.[0]?.message?.content ?? "";
          if (!batchText) throw new Error("Forge API returned empty content");
          allTexts.push(batchText);
        } catch (aiErr) {
          const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AI generation failed: ${errMsg.substring(0, 300)}`,
          });
        }
      }

      // Combine all batch texts into one for unified parsing below
      const text = allTexts.length === 1
        ? allTexts[0]
        : JSON.stringify({ questions: allTexts.flatMap(t => {
            try {
              let c = t.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();
              const r = JSON.parse(c);
              return Array.isArray(r) ? r : (Array.isArray(r.questions) ? r.questions : []);
            } catch { return []; }
          }) });

      // Parse the JSON response — handle multiple formats the model may return:
      // 1. {"questions":[...]}  (ideal)
      // 2. [{...},{...}]        (root array — model ignores wrapper instruction)
      // 3. ```json\n{...}\n```  (markdown fenced)
      let parsedResult: { questions: Array<{
        question: string;
        options?: string[];
        correctAnswer?: number;
        explanation?: string;
        reviewAnswer?: string;
        tags: string[];
      }> };
      try {
        // Step 1: strip markdown code fences
        let cleaned = text
          .replace(/^```(?:json)?\s*/im, "")
          .replace(/\s*```\s*$/im, "")
          .trim();

        // Step 2: extract the outermost balanced JSON object or array
        // (avoids greedy regex capturing trailing prose after the JSON)
        const extractOutermostJson = (s: string): string => {
          const startObj = s.indexOf('{');
          const startArr = s.indexOf('[');
          if (startObj === -1 && startArr === -1) return s;
          const start = (startObj === -1) ? startArr : (startArr === -1) ? startObj : Math.min(startObj, startArr);
          const openChar = s[start];
          const closeChar = openChar === '{' ? '}' : ']';
          let depth = 0;
          let inString = false;
          let escape = false;
          for (let i = start; i < s.length; i++) {
            const c = s[i];
            if (escape) { escape = false; continue; }
            if (c === '\\' && inString) { escape = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c === openChar) depth++;
            else if (c === closeChar) { depth--; if (depth === 0) return s.slice(start, i + 1); }
          }
          return s.slice(start); // fallback: return from start to end
        };
        cleaned = extractOutermostJson(cleaned);

        const raw = JSON.parse(cleaned);

        // Step 3: normalize — accept both {questions:[]} and a root array
        if (Array.isArray(raw)) {
          parsedResult = { questions: raw };
        } else if (raw && Array.isArray(raw.questions)) {
          parsedResult = raw;
        } else {
          throw new Error("Response is not a questions array or {questions:[]} object");
        }

        if (parsedResult.questions.length === 0) {
          throw new Error("AI returned an empty questions array");
        }
      } catch (parseErr) {
        // Surface the raw text in the error so admins can debug
        const preview = text?.substring(0, 300) ?? "(empty)";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)} | Raw preview: ${preview}`,
        });
      }

      const object = parsedResult;

      // If insertImmediately is true, bulk-insert the generated questions
      const insertedIds: number[] = [];
      if (input.insertImmediately) {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        for (const q of (object.questions as any[])) {
          const [result] = await db.insert(quickfireQuestions).values({
            type: input.type,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer ?? null,
            explanation: q.explanation ?? null,
            reviewAnswer: q.reviewAnswer ?? null,
            pairs: q.pairs ? JSON.stringify(q.pairs) : null,
            orderedItems: q.orderedItems ? JSON.stringify(q.orderedItems) : null,
            imageUrl: null,
            difficulty: input.difficulty,
            tags: JSON.stringify(q.tags),
            isActive: true,
            createdByUserId: ctx.user.id,
          });
          insertedIds.push((result as any).insertId);
        }
      }

      return {
        questions: object.questions,
        insertedIds,
        inserted: insertedIds.length,
      };
    }),

  aiGenerateMixed: adminProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        typeCounts: z.record(
          z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]),
          z.number().int().min(0).max(20)
        ),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        insertImmediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ENV.forgeApiKey || !ENV.forgeApiUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI service not configured. Missing Forge API credentials.",
        });
      }

      const forgeBaseUrl = (ENV.forgeApiUrl ?? "").replace(/\/+$/, "");
      const forgeApiKey = ENV.forgeApiKey ?? "";

      // Filter to only types with count > 0
      const activeTypes = Object.entries(input.typeCounts).filter(([, count]) => count > 0) as [string, number][];
      if (activeTypes.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "At least one question type must have a count greater than 0." });
      }

      const totalCount = activeTypes.reduce((sum, [, c]) => sum + c, 0);
      if (totalCount > 40) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Total question count cannot exceed 40 per generation run." });
      }

      // Helper: build prompt for a given type
      function buildPrompt(type: string, count: number, difficulty: string, topic: string): string {
        let typeInstructions: string;
        let jsonFormatInstructions: string;

        if (type === "quickReview") {
          typeInstructions = `Each item is a flashcard: a short clinical question or fact prompt in 'question', and the concise answer in 'reviewAnswer'. Do NOT include options or correctAnswer.`;
          jsonFormatInstructions = `{"questions":[{"question":"...","reviewAnswer":"...","tags":["...","..."]}]}`;
        } else if (type === "connect") {
          typeInstructions = `Each item is a matching/connect question. The 'question' field describes what to match. The 'pairs' field is an array of exactly 4 objects, each with 'left' and 'right' string properties representing matching pairs. Include an 'explanation'. Do NOT include options or correctAnswer.`;
          jsonFormatInstructions = `{"questions":[{"question":"Match each finding with its condition:","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}],"explanation":"...","tags":["...","..."]}]}`;
        } else if (type === "order") {
          typeInstructions = `Each item is an ordering/sequencing question. The 'question' field describes what to arrange. The 'orderedItems' field is an array of 4-6 strings in the CORRECT order. Include an 'explanation'. Do NOT include options or correctAnswer.`;
          jsonFormatInstructions = `{"questions":[{"question":"Arrange in the correct order:","orderedItems":["First","Second","Third","Fourth"],"explanation":"...","tags":["...","..."]}]}`;
        } else if (type === "identifier") {
          typeInstructions = `Each item is an anatomy hotspot/identifier question. The 'question' field asks the user to identify a specific anatomical structure on an ultrasound image. The 'imageDescription' field describes the ultrasound view and image that should be used (e.g. "Transverse view of the right upper quadrant showing the liver and gallbladder"). The 'targetStructure' field names the exact anatomical structure the user must identify (e.g. "Common bile duct"). The 'suggestedImageSearch' field provides a search query an admin can use to find an appropriate ultrasound image. Include an 'explanation' describing how to identify the structure and its clinical significance. Do NOT include options, correctAnswer, or reviewAnswer. NOTE: Marker coordinates (x, y) cannot be set by AI and must be placed manually by the admin on the actual image.`;
          jsonFormatInstructions = `{"questions":[{"question":"Identify the common bile duct on this transverse RUQ view.","imageDescription":"Transverse view of the right upper quadrant showing the liver, portal triad, and gallbladder","targetStructure":"Common bile duct","suggestedImageSearch":"abdominal ultrasound RUQ common bile duct transverse","explanation":"The common bile duct is seen in the portal triad alongside the portal vein and hepatic artery, typically anterior to the portal vein on transverse imaging.","tags":["common bile duct","RUQ","anatomy"]}]}`;
        } else {
          // scenario, image
          typeInstructions = `Each item is a multiple-choice question with exactly 4 options in 'options', a 0-indexed correctAnswer as a number (0, 1, 2, or 3), and a clear explanation. Do NOT include reviewAnswer.`;
          jsonFormatInstructions = `{"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","tags":["...","..."]}]}`;
        }

        return `You are an expert ultrasound educator creating ${count} ${difficulty} ${type} questions about: "${topic}".

${typeInstructions}

Guidelines:
- Use accurate, up-to-date AIUM/SVU/ACR/ARDMS guidelines where applicable
- Questions should be clinically relevant and educational
- For MCQ: distractors should be plausible but clearly distinguishable from the correct answer
- Tags: 2-4 specific clinical terms (e.g. "hepatic veins", "AIUM 2023", "Doppler")
- Difficulty: ${difficulty} (beginner=basic concepts, intermediate=clinical application, advanced=complex interpretation)

Return exactly ${count} questions as a valid JSON object:
${jsonFormatInstructions}

Return ONLY the JSON object, no markdown, no explanation, no code fences.`;
      }

      // Helper: call Forge API and parse response
      async function callForge(prompt: string): Promise<any[]> {
        const aiResp = await fetch(`${forgeBaseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${forgeApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" },
          }),
        });
        if (!aiResp.ok) {
          const errBody = await aiResp.text();
          throw new Error(`Forge API returned ${aiResp.status}: ${errBody.substring(0, 200)}`);
        }
        const aiData = await aiResp.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
        if (aiData.error) throw new Error(`Forge API error: ${aiData.error.message}`);
        const text = aiData.choices?.[0]?.message?.content ?? "";
        if (!text) throw new Error("Forge API returned empty content");

        // Parse JSON — strip fences, extract outermost object
        let cleaned = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();
        const startObj = cleaned.indexOf('{');
        const startArr = cleaned.indexOf('[');
        if (startObj !== -1 || startArr !== -1) {
          const start = (startObj === -1) ? startArr : (startArr === -1) ? startObj : Math.min(startObj, startArr);
          const openChar = cleaned[start];
          const closeChar = openChar === '{' ? '}' : ']';
          let depth = 0, inString = false, escape = false;
          for (let i = start; i < cleaned.length; i++) {
            const c = cleaned[i];
            if (escape) { escape = false; continue; }
            if (c === '\\' && inString) { escape = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c === openChar) depth++;
            else if (c === closeChar) { depth--; if (depth === 0) { cleaned = cleaned.slice(start, i + 1); break; } }
          }
        }
        const raw = JSON.parse(cleaned);
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray(raw.questions)) return raw.questions;
        throw new Error("Response is not a questions array");
      }

      // Run all type generations in parallel
      let allResults: Array<{ type: string; question: any }>;
      try {
        const results = await Promise.all(
          activeTypes.map(async ([type, count]) => {
            const prompt = buildPrompt(type, count, input.difficulty, input.topic);
            const questions = await callForge(prompt);
            return questions.map((q: any) => ({ type, question: q }));
          })
        );
        allResults = results.flat();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI generation failed: ${errMsg.substring(0, 300)}`,
        });
      }

      // If insertImmediately, bulk-insert all
      const insertedIds: number[] = [];
      if (input.insertImmediately) {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        for (const { type, question: q } of allResults) {
          const [result] = await db.insert(quickfireQuestions).values({
            type: type as any,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer ?? null,
            explanation: q.explanation ?? null,
            reviewAnswer: q.reviewAnswer ?? null,
            pairs: q.pairs ? JSON.stringify(q.pairs) : null,
            orderedItems: q.orderedItems ? JSON.stringify(q.orderedItems) : null,
            imageUrl: null,
            difficulty: input.difficulty,
            tags: JSON.stringify(q.tags ?? []),
            isActive: true,
            createdByUserId: ctx.user.id,
          });
          insertedIds.push((result as any).insertId);
        }
      }

      return {
        questions: allResults,
        insertedIds,
        inserted: insertedIds.length,
      };
    }),

  bulkImportQuestions: adminProcedure
    .input(
      z.object({
        questions: z
          .array(
            z.object({
              type: z.enum(["scenario", "image", "quickReview"]),
              question: z.string().min(5).max(10000),
              options: z.array(z.string().min(1)).min(2).max(6).optional(),
              correctAnswer: z.number().int().min(0).optional(),
              explanation: z.string().max(50000).optional(),
              reviewAnswer: z.string().max(50000).optional(),
              imageUrl: z.string().url().optional(),
              difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
              tags: z.array(z.string()).default([]),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = input.questions.map((q) => ({
        type: q.type,
        question: q.question,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer ?? null,
        explanation: q.explanation ?? null,
        reviewAnswer: q.reviewAnswer ?? null,
        imageUrl: q.imageUrl ?? null,
        difficulty: q.difficulty,
        tags: JSON.stringify(q.tags),
        isActive: true,
        createdByUserId: ctx.user.id,
      }));
      // Insert in batches of 50 to avoid hitting DB limits
      const BATCH = 50;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(quickfireQuestions).values(rows.slice(i, i + BATCH));
        inserted += Math.min(BATCH, rows.length - i);
      }
      return { inserted };
    }),

  generateDailySet: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const date = input.date ?? todayDateStr();

      // Delete existing set for this date if any
      await db
        .delete(quickfireDailySets)
        .where(eq(quickfireDailySets.setDate, date));

      const set = await ensureTodaySet(db, date);
      const ids: number[] = JSON.parse(set.questionIds || "[]");
      return { date, questionCount: ids.length };
    }),

  // ─── Streak Reminders ────────────────────────────────────────────────────────

  /** Admin: trigger streak reminder emails to all users who haven't completed today's set */
  triggerStreakReminders: adminProcedure
    .input(z.object({ appUrl: z.string().url().optional() }))
    .mutation(async ({ input }) => {
      const appUrl = input.appUrl ?? process.env.VITE_APP_URL ?? "https://app.allaboutultrasound.com";
      const summary = await sendStreakReminders(appUrl);
      return summary;
    }),

  // ─── Notification Preferences ────────────────────────────────────────────────

  /** Get the current user's notification preferences */
  getNotificationPrefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [userRow] = await db
      .select({ notificationPrefs: users.notificationPrefs, timezone: users.timezone })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    if (!userRow) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    try {
      const prefs = userRow.notificationPrefs ? JSON.parse(userRow.notificationPrefs) : {};
      return {
        quickfireReminder: prefs.quickfireReminder !== false,
        reminderTime: typeof prefs.reminderTime === "string" ? prefs.reminderTime : "09:00",
        timezone: userRow.timezone ?? "America/New_York",
      };
    } catch {
      return { quickfireReminder: true, reminderTime: "09:00", timezone: userRow.timezone ?? "America/New_York" };
    }
  }),

  /** Update the current user's notification preferences */
  updateNotificationPrefs: protectedProcedure
    .input(
      z.object({
        quickfireReminder: z.boolean(),
        reminderTime: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "Must be HH:MM format")
          .default("09:00"),
        timezone: z.string().max(64).default("America/New_York"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { timezone, ...prefsWithoutTimezone } = input;
      await db
        .update(users)
        .set({
          notificationPrefs: JSON.stringify(prefsWithoutTimezone),
          timezone,
        })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

   // ─── Category Preferences ─────────────────────────────────────────────────────
  /** Get the current user's daily challenge category preferences */
  getCategoryPrefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [userRow] = await db
      .select({ challengeCategoryPrefs: users.challengeCategoryPrefs })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
     const defaults = { abdominal: true, smallParts: true, pelvicGyn: true, ob1st: true, ob2nd3rd: true, fetalEcho: true, breast: true, vascular: true, msk: true, pocus: true, physics: true };
    if (!userRow?.challengeCategoryPrefs) return defaults;
    try {
      return { ...defaults, ...JSON.parse(userRow.challengeCategoryPrefs) };
    } catch {
      return defaults;
    }
  }),
  /** Update the current user's daily challenge category preferences */
  updateCategoryPrefs: protectedProcedure
    .input(
      z.object({
        abdominal: z.boolean().default(true),
        smallParts: z.boolean().default(true),
        pelvicGyn: z.boolean().default(true),
        ob1st: z.boolean().default(true),
        ob2nd3rd: z.boolean().default(true),
        fetalEcho: z.boolean().default(true),
        breast: z.boolean().default(true),
        vascular: z.boolean().default(true),
        msk: z.boolean().default(true),
        pocus: z.boolean().default(true),
        physics: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db
        .update(users)
        .set({ challengeCategoryPrefs: JSON.stringify(input) })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // ─── Challenge Queue ─────────────────────────────────────────────────────────
  /**
   * Get all currently live challenges (one per category) with full question data.
   * Returns an array — one entry per category that has a live challenge today.
   */
  getLiveChallenge: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Fetch ALL live challenges (one per category)
    const liveChallenges = await db
      .select()
      .from(quickfireChallenges)
      .where(eq(quickfireChallenges.status, "live"))
      .orderBy(quickfireChallenges.category, desc(quickfireChallenges.publishedAt));

    if (liveChallenges.length === 0) return null;

    // De-duplicate: keep only the most-recently published challenge per category
    const latestPerCategory = new Map<string, typeof liveChallenges[0]>();
    for (const ch of liveChallenges) {
      const key = ch.category ?? "Uncategorized";
      if (!latestPerCategory.has(key)) latestPerCategory.set(key, ch);
    }
    const deduped = Array.from(latestPerCategory.values());

    // Collect all question IDs across all live challenges
    const allIds = Array.from(new Set(
      deduped.flatMap((ch) => JSON.parse(ch.questionIds || "[]") as number[])
    ));

    const allQ = allIds.length > 0
      ? await db.select().from(quickfireQuestions).where(and(eq(quickfireQuestions.isActive, true), inArray(quickfireQuestions.id, allIds)))
      : [];

    // Fetch user attempts for all live challenge setDates
    let userAttempts: Record<number, { selectedAnswer: number | null; selfMarkedCorrect: boolean | null; isCorrect: boolean | null }> = {};
    if (ctx.user) {
      const setDates = Array.from(new Set(
        deduped.map((ch) => ch.publishDate ?? ch.publishedAt?.toISOString().slice(0, 10) ?? "")
          .filter(Boolean)
      ));
      if (setDates.length > 0) {
        const attempts = await db
          .select()
          .from(quickfireAttempts)
          .where(and(
            eq(quickfireAttempts.userId, ctx.user.id),
            inArray(quickfireAttempts.setDate, setDates)
          ));
        for (const a of attempts) {
          userAttempts[a.questionId] = { selectedAnswer: a.selectedAnswer, selfMarkedCorrect: a.selfMarkedCorrect, isCorrect: a.isCorrect };
        }
      }
    }

    // Build enriched challenge objects
    const enriched = deduped.map((challenge) => {
      const ids: number[] = JSON.parse(challenge.questionIds || "[]");
      const orderedQuestions = ids.map((id) => allQ.find((q) => q.id === id)).filter(Boolean) as typeof allQ;
      const setDate = challenge.publishDate ?? challenge.publishedAt?.toISOString().slice(0, 10) ?? "";
      const publishedAt = challenge.publishedAt ? new Date(challenge.publishedAt).getTime() : null;
      const expiresAt = publishedAt ? publishedAt + 24 * 60 * 60 * 1000 : null;
      const msRemaining = expiresAt ? Math.max(0, expiresAt - Date.now()) : null;

      const sanitized = orderedQuestions.map((q) => {
        const attempted = userAttempts[q.id];
        return {
          ...q,
          options: q.options ? JSON.parse(q.options) : null,
          tags: q.tags ? JSON.parse(q.tags) : [],
          pairs: q.pairs ? JSON.parse(q.pairs) : null,
          markers: q.markers ? JSON.parse(q.markers) : null,
          orderedItems: q.orderedItems ? JSON.parse(q.orderedItems) : null,
          correctAnswer: attempted ? q.correctAnswer : null,
          explanation: attempted ? q.explanation : null,
          reviewAnswer: attempted ? q.reviewAnswer : null,
        };
      });

      return { ...challenge, questions: sanitized, userAttempts, setDate, msRemaining };
    });

    // Always return an array — frontend handles per-category rendering
    return enriched;
  }),

  /** Get the challenge archive — premium members only; free users get no archive access */
  getChallengeArchive: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(20).default(10),
      category: z.string().optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      dateFrom: z.string().optional(), // YYYY-MM-DD
      dateTo: z.string().optional(),   // YYYY-MM-DD
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const isPremium = (ctx.user as any)?.isPremium === true || (ctx.user as any)?.role === "admin";
      // Free users have no archive access — return empty with flag so UI can show upgrade prompt
      if (!isPremium) {
        return { challenges: [], total: 0, isPremium: false, page: input.page, limit: input.limit };
      }
      const offset = (input.page - 1) * input.limit;
      const conditions: any[] = [eq(quickfireChallenges.status, "archived")];
      // Category filter
      if (input.category) {
        conditions.push(eq(quickfireChallenges.category, input.category as any));
      }
      // Difficulty filter
      if (input.difficulty) {
        conditions.push(eq(quickfireChallenges.difficulty, input.difficulty));
      }
      // Date range filters — use publishedAt timestamp (covers both seeded and admin-published challenges)
      if (input.dateFrom) {
        conditions.push(gte(quickfireChallenges.publishedAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        // Include the full dateTo day by adding 1 day
        const toDate = new Date(input.dateTo);
        toDate.setDate(toDate.getDate() + 1);
        conditions.push(lte(quickfireChallenges.publishedAt, toDate));
      }
      const [rows, totalResult] = await Promise.all([
        db.select({ id: quickfireChallenges.id, title: quickfireChallenges.title, description: quickfireChallenges.description,
          category: quickfireChallenges.category, difficulty: quickfireChallenges.difficulty,
          publishDate: quickfireChallenges.publishDate,
          publishedAt: quickfireChallenges.publishedAt, archivedAt: quickfireChallenges.archivedAt,
          questionIds: quickfireChallenges.questionIds })
          .from(quickfireChallenges).where(and(...conditions))
          .orderBy(desc(quickfireChallenges.publishedAt)).limit(input.limit).offset(offset),
        db.select({ count: count(quickfireChallenges.id) }).from(quickfireChallenges).where(and(...conditions)),
      ]);
      return { challenges: rows, total: totalResult[0]?.count ?? 0, isPremium: true, page: input.page, limit: input.limit };
    }),

  /** Get a single archived challenge with full questions (for replay) */
  getArchivedChallenge: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [challenge] = await db.select().from(quickfireChallenges)
        .where(and(eq(quickfireChallenges.id, input.id), eq(quickfireChallenges.status, "archived"))).limit(1);
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found" });

      // Access gate: archive is premium-only; free users cannot replay any archived challenge
      const isPremium = (ctx.user as any)?.isPremium === true || (ctx.user as any)?.role === "admin";
      if (!isPremium) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Premium access required to replay archived challenges" });
      }

      const ids: number[] = JSON.parse(challenge.questionIds || "[]");
      const allQ = await db.select().from(quickfireQuestions).where(eq(quickfireQuestions.isActive, true));
      const questions = ids.map((id) => allQ.find((q) => q.id === id)).filter(Boolean) as typeof allQ;

      // For archived challenges, always reveal answers
      const withAnswers = questions.map((q) => ({
        ...q,
        options: q.options ? JSON.parse(q.options) : null,
        tags: q.tags ? JSON.parse(q.tags) : [],
        pairs: q.pairs ? JSON.parse(q.pairs) : null,
        markers: q.markers ? JSON.parse(q.markers) : null,
        orderedItems: q.orderedItems ? JSON.parse(q.orderedItems) : null,
      }));
      return { ...challenge, questions: withAnswers };
    }),

  // ─── Admin: Challenge Queue Management ──────────────────────────────────────

  /** List all challenges in the queue (draft + scheduled + live) */
  adminListChallenges: adminProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const statuses = input.includeArchived
        ? ["draft", "scheduled", "live", "archived"]
        : ["draft", "scheduled", "live"];

      const rows = await db.select().from(quickfireChallenges)
        .where(inArray(quickfireChallenges.status, statuses as any[]))
        .orderBy(quickfireChallenges.priority, desc(quickfireChallenges.createdAt));

      // Enrich with linked question difficulty
      const parsed = rows.map((r) => ({ ...r, questionIds: JSON.parse(r.questionIds || "[]") as number[] }));
      const allQIds = Array.from(new Set(parsed.flatMap((r) => r.questionIds)));
      const questionMeta = allQIds.length > 0
        ? await db.select({ id: quickfireQuestions.id, difficulty: quickfireQuestions.difficulty, type: quickfireQuestions.type })
            .from(quickfireQuestions).where(inArray(quickfireQuestions.id, allQIds))
        : [];
      const qMetaMap = new Map(questionMeta.map((q) => [q.id, q]));
      return parsed.map((r) => ({
        ...r,
        questionDifficulty: r.questionIds[0] != null ? (qMetaMap.get(r.questionIds[0])?.difficulty ?? null) : null,
        questionType: r.questionIds[0] != null ? (qMetaMap.get(r.questionIds[0])?.type ?? null) : null,
      }));
    }),

  /** Create a new challenge in the queue */
  adminCreateChallenge: adminProcedure
    .input(z.object({
      title: z.string().min(3).max(300),
      description: z.string().max(2000).optional(),
      questionIds: z.array(z.number().int().positive()).min(1).max(1),  // exactly 1 question per challenge
      priority: z.number().int().min(1).default(100),
      category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).optional(),
      queuePosition: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Duplicate prevention: check if any active/scheduled/draft challenge already uses these question IDs
      const activeChallenges = await db
        .select({ id: quickfireChallenges.id, questionIds: quickfireChallenges.questionIds, title: quickfireChallenges.title })
        .from(quickfireChallenges)
        .where(inArray(quickfireChallenges.status, ["draft", "scheduled", "live"] as any[]));
      for (const ch of activeChallenges) {
        const existingIds: number[] = JSON.parse(ch.questionIds || "[]");
        const conflict = input.questionIds.find((qid) => existingIds.includes(qid));
        if (conflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Question is already used in challenge "${ch.title}" (ID #${ch.id}). Each question can only appear once in the active queue.`,
          });
        }
      }
      const [result] = await db.insert(quickfireChallenges).values({
        title: input.title,
        description: input.description ?? null,
        questionIds: JSON.stringify(input.questionIds),
        priority: input.priority,
        category: (input.category as any) ?? "Abdominal",
        status: "scheduled",
        queuePosition: input.queuePosition ?? null,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId };
    }),
  /** Update a challenge (title, description, questions, priority, category, publishDate) */
  adminUpdateChallenge: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(3).max(300).optional(),
      description: z.string().max(2000).optional().nullable(),
      questionIds: z.array(z.number().int().positive()).min(1).max(1).optional(),  // exactly 1 question per challenge
      priority: z.number().int().min(1).optional(),
      category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).optional(),
      queuePosition: z.number().int().min(1).optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, questionIds, ...rest } = input;
      // Duplicate prevention: if questionIds are being changed, ensure no other active challenge uses them
      if (questionIds && questionIds.length > 0) {
        const activeChallenges = await db
          .select({ id: quickfireChallenges.id, questionIds: quickfireChallenges.questionIds, title: quickfireChallenges.title })
          .from(quickfireChallenges)
          .where(inArray(quickfireChallenges.status, ["draft", "scheduled", "live"] as any[]));
        for (const ch of activeChallenges) {
          if (ch.id === id) continue; // skip self
          const existingIds: number[] = JSON.parse(ch.questionIds || "[]");
          const conflict = questionIds.find((qid) => existingIds.includes(qid));
          if (conflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Question is already used in challenge "${ch.title}" (ID #${ch.id}). Each question can only appear once in the active queue.`,
            });
          }
        }
      }
      await db.update(quickfireChallenges).set({
        ...rest,
        ...(questionIds !== undefined ? { questionIds: JSON.stringify(questionIds) } : {}),
      }).where(eq(quickfireChallenges.id, id));
      return { success: true };
    }),

  /**
   * Soft-delete a challenge — moves it to Trash (status='trash', trashedAt=now).
   * Works for any status including live. When a live challenge is trashed, the next
   * queued challenge for the same category is auto-promoted to live.
   * Items are permanently purged after 30 days via purgeExpiredTrash.
   */
  adminDeleteChallenge: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [ch] = await db
        .select()
        .from(quickfireChallenges)
        .where(eq(quickfireChallenges.id, input.id))
        .limit(1);
      if (!ch) throw new TRPCError({ code: "NOT_FOUND" });
      if ((ch.status as string) === "trash") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge is already in Trash" });
      }
      const wasLive = (ch.status as string) === "live";
      const category = ch.category;
      // Soft-delete: move to trash
      await db
        .update(quickfireChallenges)
        .set({ status: "trash" as any, trashedAt: new Date() })
        .where(eq(quickfireChallenges.id, input.id));
      // If the deleted challenge was live, auto-promote the next queued challenge for this category
      let promoted: { id: number; title: string } | null = null;
      if (wasLive && category) {
        const [next] = await db
          .select()
          .from(quickfireChallenges)
          .where(
            and(
              inArray(quickfireChallenges.status, ["queued", "scheduled", "draft"] as any[]),
              eq(quickfireChallenges.category, category as any)
            )
          )
          .orderBy(quickfireChallenges.priority, quickfireChallenges.createdAt)
          .limit(1);
        if (next) {
          const now = new Date();
          const today = now.toISOString().slice(0, 10);
          await db
            .update(quickfireChallenges)
            .set({ status: "live" as any, publishedAt: now, publishDate: today })
            .where(eq(quickfireChallenges.id, next.id));
          promoted = { id: next.id, title: next.title };
        }
      }
      return { success: true, promoted };
    }),
  /** List all trashed challenges (status='trash', not yet permanently purged). */
  listTrashedChallenges: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const rows = await db
      .select()
      .from(quickfireChallenges)
      .where(sql`${quickfireChallenges.status} = 'trash'`)
      .orderBy(desc(quickfireChallenges.trashedAt));
    return rows.map((r) => ({
      ...r,
      questionIds: JSON.parse(r.questionIds || "[]") as number[],
      daysUntilPurge: r.trashedAt
        ? Math.max(0, 30 - Math.floor((Date.now() - new Date(r.trashedAt).getTime()) / 86_400_000))
        : 30,
    }));
  }),
  /** Restore a trashed challenge back to scheduled status. */
  restoreTrashedChallenge: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [ch] = await db
        .select({ status: quickfireChallenges.status })
        .from(quickfireChallenges)
        .where(eq(quickfireChallenges.id, input.id))
        .limit(1);
      if (!ch) throw new TRPCError({ code: "NOT_FOUND" });
      if ((ch.status as string) !== "trash") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge is not in Trash" });
      }
      await db
        .update(quickfireChallenges)
        .set({ status: "scheduled" as any, trashedAt: null })
        .where(eq(quickfireChallenges.id, input.id));
      return { success: true };
    }),
  /** Permanently delete a single trashed challenge immediately. */
  purgeTrashedChallenge: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [ch] = await db
        .select({ status: quickfireChallenges.status })
        .from(quickfireChallenges)
        .where(eq(quickfireChallenges.id, input.id))
        .limit(1);
      if (!ch) throw new TRPCError({ code: "NOT_FOUND" });
      if ((ch.status as string) !== "trash") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge is not in Trash" });
      }
      await db.delete(quickfireChallenges).where(eq(quickfireChallenges.id, input.id));
      return { success: true };
    }),

  /** Reorder challenge priorities — accepts an ordered array of IDs */
  adminReorderChallenges: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number().int().positive()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db.update(quickfireChallenges).set({ priority: i + 1 }).where(eq(quickfireChallenges.id, input.orderedIds[i]));
      }
      return { success: true };
    }),

  /**
   * Publish the next scheduled/draft challenge immediately (or auto-publish on cron).
   * Picks the highest-priority draft/scheduled challenge and makes it live.
   * Archives any currently live challenge first.
   */
  adminPublishNextChallenge: adminProcedure
    .input(z.object({ sendNotification: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      // 1. Pick next queued challenge (prefer scheduled with publishDate <= today, then draft)
      const candidates = await db.select().from(quickfireChallenges)
        .where(inArray(quickfireChallenges.status, ['draft', 'scheduled'] as any[]))
        .orderBy(quickfireChallenges.priority, quickfireChallenges.createdAt)
        .limit(50);

      const next = candidates.find((c) => !c.publishDate || c.publishDate <= today) ?? candidates[0];
      if (!next) return { published: false, message: "No challenges in queue" };

      // 2. Archive any existing live challenge for the SAME category only
      //    (one live per category — other categories keep their own live challenge)
      if (next.category) {
        await db.update(quickfireChallenges)
          .set({ status: "archived", archivedAt: now })
          .where(and(
            eq(quickfireChallenges.status, "live"),
            eq(quickfireChallenges.category, next.category)
          ));
      }

      // 3. Publish the next challenge
      await db.update(quickfireChallenges).set({
        status: "live",
        publishDate: next.publishDate ?? today,
        publishedAt: now,
        archivedAt: null,
      }).where(eq(quickfireChallenges.id, next.id));

      return { published: true, challengeId: next.id, title: next.title, category: next.category, publishDate: next.publishDate ?? today };
    }),

  /**
   * Force-trigger the daily challenge publish cron immediately.
   * Useful when the 6 AM ET window was missed (e.g. server restart).
   * Idempotent: if today's challenges are already live, this is a no-op.
   */
  adminTriggerDailyChallenges: adminProcedure
    .mutation(async () => {
      await runChallengeCron();
      return { triggered: true };
    }),

  /** Manually archive the currently live challenge */
  adminArchiveChallenge: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(quickfireChallenges).set({ status: "archived", archivedAt: new Date() })
        .where(and(eq(quickfireChallenges.id, input.id), eq(quickfireChallenges.status, "live")));
      return { success: true };
    }),

  /**
   * Edit an archived challenge's metadata (title, description, category, difficulty).
   * Preserves the `archived` status — does NOT re-schedule the challenge.
   * Also allows replacing the linked question (questionIds).
   */
  adminUpdateArchivedChallenge: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(3).max(300).optional(),
      description: z.string().max(5000).optional().nullable(),
      category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
      questionIds: z.array(z.number().int().positive()).min(1).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [ch] = await db.select({ status: quickfireChallenges.status })
        .from(quickfireChallenges).where(eq(quickfireChallenges.id, input.id)).limit(1);
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found" });
      if (ch.status !== "archived") throw new TRPCError({ code: "BAD_REQUEST", message: "Only archived challenges can be edited via this endpoint" });
      const { id, questionIds, ...rest } = input;
      await db.update(quickfireChallenges).set({
        ...rest,
        ...(questionIds !== undefined ? { questionIds: JSON.stringify(questionIds) } : {}),
        // Explicitly keep status as archived — never change it here
      }).where(eq(quickfireChallenges.id, id));
      return { success: true };
    }),

  /**
   * Edit a question that belongs to an archived challenge.
   * Allows updating all rich-text fields (question, explanation, options, reviewAnswer, etc.).
   */
  adminUpdateArchivedQuestion: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      question: z.string().min(1).max(5000).optional(),
      options: z.array(z.string().min(1)).min(2).max(6).optional().nullable(),
      correctAnswer: z.number().int().min(0).optional().nullable(),
      explanation: z.string().max(50000).optional().nullable(),
      reviewAnswer: z.string().max(50000).optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      videoUrl: z.string().url().optional().nullable(),
      pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional().nullable(),
      markers: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().min(1), radius: z.number().optional() })).optional().nullable(),
      orderedItems: z.array(z.string().min(1)).min(2).max(10).optional().nullable(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [q] = await db.select({ id: quickfireQuestions.id })
        .from(quickfireQuestions).where(eq(quickfireQuestions.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      const { id, options, tags, pairs, markers, orderedItems, ...rest } = input;
      await db.update(quickfireQuestions).set({
        ...rest,
        ...(options !== undefined ? { options: options ? JSON.stringify(options) : null } : {}),
        ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
        ...(pairs !== undefined ? { pairs: pairs ? JSON.stringify(pairs) : null } : {}),
        ...(markers !== undefined ? { markers: markers ? JSON.stringify(markers) : null } : {}),
        ...(orderedItems !== undefined ? { orderedItems: orderedItems ? JSON.stringify(orderedItems) : null } : {}),
      }).where(eq(quickfireQuestions.id, id));
      return { success: true };
    }),

  // ─── Flashcard Deck ───────────────────────────────────────────────────────────────────────────────────────

  /**
   * Returns all active quickReview-type flashcards, ordered by spaced-repetition priority.  * Cards the user has missed most recently appear first.
   * Unauthenticated users get a random order.
   */
  getFlashcardDeck: publicProcedure
    .input(z.object({
      topic: z.string().optional(),
      echoCategory: z.enum(["abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "fetal_echo", "venous", "arterial", "abdominal_vascular", "extracranial_carotid", "intracranial_tcd", "pocus", "physics", "thyroid", "scrotum", "breast", "msk"]).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Build conditions
      const conditions: any[] = [
        eq(quickfireQuestions.isActive, true),
        eq(quickfireQuestions.type, "quickReview"),
      ];
      if (input.echoCategory) {
        conditions.push(eq(quickfireQuestions.echoCategory, input.echoCategory));
      }

      // Fetch all active flashcard questions
      const allCards = await db
        .select()
        .from(quickfireQuestions)
        .where(and(...conditions))
        .limit(input.limit);

      if (allCards.length === 0) return { cards: [], totalCards: 0, userStats: null, dailyLimit: null, dailySeenCount: 0 };

      // Filter by topic if provided (legacy support)
      const filtered = input.topic
        ? allCards.filter((c) => {
            const tags: string[] = c.tags ? JSON.parse(c.tags) : [];
            return tags.some((t) => t.toLowerCase().includes(input.topic!.toLowerCase()));
          })
        : allCards;

      // Determine premium status
      const FREE_DAILY_LIMIT = 10;
      const isPremium = ctx.user
        ? ((ctx.user as any).isPremium === true || (ctx.user as any).role === "admin")
        : false;
      const dailyLimit = isPremium ? null : FREE_DAILY_LIMIT;

      // If user is authenticated, fetch their attempt history for spaced repetition
      if (ctx.user) {
        const today = todayDateStr();
        const deckSetDate = `deck-${today}`;
        const cardIds = filtered.map((c) => c.id);

        // Fetch all-time attempts for spaced repetition stats
        const attempts = cardIds.length > 0
          ? await db
              .select({
                questionId: quickfireAttempts.questionId,
                selfMarkedCorrect: quickfireAttempts.selfMarkedCorrect,
                createdAt: quickfireAttempts.createdAt,
                setDate: quickfireAttempts.setDate,
              })
              .from(quickfireAttempts)
              .where(and(
                eq(quickfireAttempts.userId, ctx.user.id),
                inArray(quickfireAttempts.questionId, cardIds),
              ))
          : [];

        // Count how many distinct flashcards the user has reviewed TODAY — GLOBAL across ALL categories.
        // We query without the cardIds filter so switching categories does not reset the visible count.
        const globalTodayRows = await db
          .select({ questionId: quickfireAttempts.questionId })
          .from(quickfireAttempts)
          .where(and(
            eq(quickfireAttempts.userId, ctx.user.id),
            eq(quickfireAttempts.setDate, deckSetDate),
          ));
        const dailySeenCount = new Set(globalTodayRows.map((r) => r.questionId)).size;

        // Build per-card stats
        const statsMap: Record<number, { gotIt: number; missed: number; lastSeen: Date | null; lastResult: boolean | null }> = {};
        for (const a of attempts) {
          if (!statsMap[a.questionId]) {
            statsMap[a.questionId] = { gotIt: 0, missed: 0, lastSeen: null, lastResult: null };
          }
          const s = statsMap[a.questionId];
          if (a.selfMarkedCorrect === true) s.gotIt++;
          else if (a.selfMarkedCorrect === false) s.missed++;
          if (!s.lastSeen || a.createdAt > s.lastSeen) {
            s.lastSeen = a.createdAt;
            s.lastResult = a.selfMarkedCorrect;
          }
        }

        // Determine which cards have been seen in the current cycle
        // A "cycle" = all cards in this category seen at least once since the last reset
        // We track seen cards via deck attempts (setDate starts with 'deck-')
        const deckAttempts = attempts.filter((a) => a.setDate?.startsWith('deck-'));
        const seenInCurrentCycle = new Set(deckAttempts.map((a) => a.questionId));
        const unseenCards = filtered.filter((c) => !seenInCurrentCycle.has(c.id));
        const seenCards = filtered.filter((c) => seenInCurrentCycle.has(c.id));
        // If all cards have been seen, cycle resets — treat all as unseen again
        const cycleReset = unseenCards.length === 0;
        const priorityCards = cycleReset ? filtered : unseenCards;
        const deprioritizedCards = cycleReset ? [] : seenCards;

        let orderedCards: typeof filtered;
        if (isPremium) {
          // Premium: unseen cards first (spaced-rep sorted), then seen cards (spaced-rep sorted)
          const sortBySpacedRep = (cards: typeof filtered) => {
            const scored = cards.map((card) => {
              const s = statsMap[card.id];
              let score = 0;
              if (!s || s.gotIt + s.missed === 0) {
                score = 0;
              } else if (s.lastResult === false) {
                score = 1;
              } else {
                score = 2;
              }
              return { card, score, lastSeen: s?.lastSeen ?? null };
            });
            scored.sort((a, b) => {
              if (a.score !== b.score) return a.score - b.score;
              if (!a.lastSeen && !b.lastSeen) return 0;
              if (!a.lastSeen) return -1;
              if (!b.lastSeen) return 1;
              return a.lastSeen.getTime() - b.lastSeen.getTime();
            });
            return scored.map(({ card }) => card);
          };
          orderedCards = [...sortBySpacedRep(priorityCards), ...sortBySpacedRep(deprioritizedCards)];
        } else {
          // Free: unseen cards first (shuffled), then seen cards (shuffled)
          const seed = `${today}-${ctx.user.id}`;
          orderedCards = [
            ...seededShuffle(priorityCards, seed),
            ...seededShuffle(deprioritizedCards, seed + "-seen"),
          ];
        }

        const cards = orderedCards.map((card) => {
          const stats = statsMap[card.id] ?? { gotIt: 0, missed: 0, lastSeen: null, lastResult: null };
          return {
            ...card,
            tags: card.tags ? JSON.parse(card.tags) : [],
            gotIt: stats.gotIt,
            missed: stats.missed,
            lastSeen: stats.lastSeen,
            lastResult: stats.lastResult,
          };
        });

        // Aggregate user stats
        const totalAttempts = attempts.length;
        const totalGotIt = attempts.filter((a) => a.selfMarkedCorrect === true).length;
        const totalMissed = attempts.filter((a) => a.selfMarkedCorrect === false).length;

        return {
          cards,
          totalCards: filtered.length,
          unseenCount: cycleReset ? filtered.length : unseenCards.length,
          cycleReset,
          userStats: { totalAttempts, totalGotIt, totalMissed, accuracy: totalAttempts > 0 ? Math.round((totalGotIt / totalAttempts) * 100) : null },
          dailyLimit,
          dailySeenCount,
        };
      }

      // Unauthenticated: date-seeded daily shuffle + IP-based daily count
      const clientIp = (ctx as any).req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim()
        ?? (ctx as any).req?.socket?.remoteAddress
        ?? "unknown";
      const anonSeed = todayDateStr();
      const shuffled = seededShuffle(filtered, anonSeed);
      const dailySeenCount = await getIpFlashcardCount(clientIp);
      return {
        cards: shuffled.map((c) => ({ ...c, tags: c.tags ? JSON.parse(c.tags) : [], gotIt: 0, missed: 0, lastSeen: null, lastResult: null })),
        totalCards: filtered.length,
        userStats: null,
        dailyLimit: FREE_DAILY_LIMIT,
        dailySeenCount,
      };
    }),

  /**
   * Record a flashcard deck self-assessment (Got it / Missed it).
   * Uses a special setDate of 'deck-YYYY-MM-DD' to distinguish from daily challenge attempts.
   */
  submitFlashcardReview: protectedProcedure
    .input(z.object({
      questionId: z.number().int().positive(),
      gotIt: z.boolean(),
      timeMs: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify the question exists and is a quickReview type
      const [q] = await db
        .select({ id: quickfireQuestions.id, type: quickfireQuestions.type })
        .from(quickfireQuestions)
        .where(and(eq(quickfireQuestions.id, input.questionId), eq(quickfireQuestions.isActive, true)))
        .limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });

      const setDate = `deck-${todayDateStr()}`;
      await db.insert(quickfireAttempts).values({
        userId: ctx.user.id,
        questionId: input.questionId,
        setDate,
        selectedAnswer: null,
        selfMarkedCorrect: input.gotIt,
        isCorrect: input.gotIt,
        timeMs: input.timeMs ?? null,
      });

      return { success: true };
    }),

  /**
   * Record that an unauthenticated user viewed a flashcard (IP-based daily limit tracking).
   * For authenticated users this is a no-op (their limit is tracked via submitFlashcardReview).
   */
  recordFlashcardView: publicProcedure
    .input(z.object({ count: z.number().int().min(1).max(1).default(1) }))
    .mutation(async ({ ctx }) => {
      // Only track unauthenticated users via IP
      if (ctx.user) return { dailySeenCount: null }; // authenticated users tracked via DB
      const clientIp = (ctx as any).req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim()
        ?? (ctx as any).req?.socket?.remoteAddress
        ?? "unknown";
      const FREE_DAILY_LIMIT = 10;
      const current = await getIpFlashcardCount(clientIp);
      if (current >= FREE_DAILY_LIMIT) {
        return { dailySeenCount: current, limitReached: true };
      }
      const next = await incrementIpFlashcardCount(clientIp);
      return { dailySeenCount: next, limitReached: next >= FREE_DAILY_LIMIT };
    }),

  /** Clone an archived challenge back into the queue (push-to-queue) */
  adminCloneChallenge: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [original] = await db.select().from(quickfireChallenges).where(eq(quickfireChallenges.id, input.id)).limit(1);
      if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Challenge not found" });
      await db.insert(quickfireChallenges).values({
        title: original.title,
        description: original.description,
        questionIds: original.questionIds,
        priority: 100,
        category: original.category,
        status: "scheduled",  // Always scheduled — ready for auto-publication in queue order
        publishDate: null,
        publishedAt: null,
        archivedAt: null,
      });
      return { success: true };
    }),

  /**
   * Approve a single question to the daily challenge queue.
   * Creates a single-question challenge entry with an auto-generated title.
   * This replaces the old "create challenge group" workflow.
   */
  adminApproveQuestionToQueue: adminProcedure
    .input(
      z.object({
        questionId: z.number().int().positive(),
        publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Fetch the question to auto-generate a title
      const [q] = await db
        .select()
        .from(quickfireQuestions)
        .where(eq(quickfireQuestions.id, input.questionId))
        .limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      // Strip HTML tags from question text for the challenge title
      const rawTitle = q.question.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      const autoTitle = rawTitle.length > 60 ? rawTitle.slice(0, 57) + "..." : rawTitle;
      // Map question category to challenge category
      // Use the question's existing category directly for the challenge
      const challengeCategory = (q.category ?? "Abdominal") as any;
      const [result] = await db.insert(quickfireChallenges).values({
        title: autoTitle,
        description: null,
        questionIds: JSON.stringify([input.questionId]),
        priority: 100,
        category: challengeCategory,
        status: "scheduled",
        publishDate: input.publishDate ?? null,
        createdByUserId: ctx.user.id,
      });
      // Remove from question bank — mark inactive so it no longer appears in the bank
      await db
        .update(quickfireQuestions)
        .set({ isActive: false })
        .where(eq(quickfireQuestions.id, input.questionId));
      return { id: (result as any).insertId };
    }),

  /**
   * Batch-approve multiple questions to the daily challenge queue.
   * Each question becomes its own challenge entry (one per day).
   * Optionally accepts a startDate to auto-schedule them on consecutive days.
   */
  adminBatchApproveToQueue: adminProcedure
    .input(
      z.object({
        questionIds: z.array(z.number().int().positive()).min(1).max(500),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Duplicate prevention: check if any active/scheduled/draft/live challenge already uses these question IDs
      const activeChallenges = await db
        .select({ id: quickfireChallenges.id, questionIds: quickfireChallenges.questionIds, title: quickfireChallenges.title })
        .from(quickfireChallenges)
        .where(inArray(quickfireChallenges.status, ["draft", "scheduled", "live"] as any[]));
      const allUsedIds = new Set<number>();
      for (const ch of activeChallenges) {
        const ids: number[] = JSON.parse(ch.questionIds || "[]");
        ids.forEach((id) => allUsedIds.add(id));
      }
      const conflicts = input.questionIds.filter((qid) => allUsedIds.has(qid));
      if (conflicts.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${conflicts.length} question(s) are already in the active challenge queue. Remove duplicates and try again. Conflicting IDs: ${conflicts.join(", ")}`,
        });
      }

      // Fetch all requested questions
      const qs = await db
        .select()
        .from(quickfireQuestions)
        .where(inArray(quickfireQuestions.id, input.questionIds));

      if (qs.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No valid questions found" });

      // Preserve the order the admin selected them in
      const ordered = input.questionIds
        .map((id) => qs.find((q) => q.id === id))
        .filter(Boolean) as typeof qs;

      const results: number[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const q = ordered[i];
        // Strip HTML tags from question text for the challenge title
        const rawTitle = q.question.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
        const autoTitle = rawTitle.length > 60 ? rawTitle.slice(0, 57) + "..." : rawTitle;
        let publishDate: string | null = null;
        if (input.startDate) {
          const d = new Date(input.startDate);
          d.setDate(d.getDate() + i);
          publishDate = d.toISOString().slice(0, 10);
        }
        const [result] = await db.insert(quickfireChallenges).values({
          title: autoTitle,
          description: null,
          questionIds: JSON.stringify([q.id]),
          priority: 100,
          category: (q.category as any) ?? "Abdominal",
         status: "scheduled",
          publishDate: publishDate ?? null,
          createdByUserId: ctx.user.id,
        });
        results.push((result as any).insertId);
      }

      // Remove all pushed questions from the question bank
      if (ordered.length > 0) {
        await db
          .update(quickfireQuestions)
          .set({ isActive: false })
          .where(inArray(quickfireQuestions.id, ordered.map((q) => q.id)));
      }

      return { added: results.length, ids: results };
    }),

  /**
   * Reorder the queue by updating priority values.
   * Accepts an ordered array of challenge IDs; assigns priority 1, 2, 3... in that order.
   * Only operates on scheduled/draft challenges — live/archived are ignored.
   */
  adminReorderQueue: adminProcedure
    .input(
      z.object({
        orderedIds: z.array(z.number().int().positive()).min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Update each challenge's priority based on its position in the ordered array
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db
          .update(quickfireChallenges)
          .set({ priority: i + 1 })
          .where(
            and(
              eq(quickfireChallenges.id, input.orderedIds[i]),
              inArray(quickfireChallenges.status, ["scheduled", "draft"] as any[])
            )
          );
      }
      return { success: true, updated: input.orderedIds.length };
    }),

  /** List only archived challenges for the archive tab */
  adminListArchivedChallenges: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(quickfireChallenges)
        .where(eq(quickfireChallenges.status, "archived"))
        .orderBy(desc(quickfireChallenges.archivedAt));
      const parsed = rows.map((r) => ({ ...r, questionIds: JSON.parse(r.questionIds || "[]") as number[] }));
      const allQIds = Array.from(new Set(parsed.flatMap((r) => r.questionIds)));
      const questionMeta = allQIds.length > 0
        ? await db.select({ id: quickfireQuestions.id, difficulty: quickfireQuestions.difficulty, type: quickfireQuestions.type })
            .from(quickfireQuestions).where(inArray(quickfireQuestions.id, allQIds))
        : [];
      const qMetaMap = new Map(questionMeta.map((q) => [q.id, q]));
      return parsed.map((r) => ({
        ...r,
        questionDifficulty: r.questionIds[0] != null ? (qMetaMap.get(r.questionIds[0])?.difficulty ?? null) : null,
        questionType: r.questionIds[0] != null ? (qMetaMap.get(r.questionIds[0])?.type ?? null) : null,
      }));
    }),

  // ─── User Question Submission ─────────────────────────────────────────────
  /**
   * Any authenticated user can submit a question for admin review.
   * Saved with submissionStatus = 'pending_review' and isActive = false
   * until an admin approves it. Approving awards 50 bonus XP points.
   */
  submitUserQuestion: protectedProcedure
    .input(
      z.object({
        type: z.enum(["scenario", "image", "quickReview", "connect", "identifier", "order"]),
        question: z.string().min(5).max(10000),
        options: z.array(z.string().min(1)).min(2).max(6).optional(),
        correctAnswer: z.number().int().min(0).optional(),
        explanation: z.string().max(50000).optional(),
        reviewAnswer: z.string().max(50000).optional(),
        imageUrl: z.string().url().optional(),
        pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
        markers: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().min(1), radius: z.number().optional() })).optional(),
        orderedItems: z.array(z.string().min(1)).min(2).max(10).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
        tags: z.array(z.string()).default([]),
      category: z.enum(["Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester", "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular", "MSK", "POCUS", "Physics"]).default("Abdominal"),
      submitterName: z.string().max(200).optional(),
        submitterLinkedIn: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(quickfireQuestions).values({
        type: input.type,
        question: input.question,
        options: input.options ? JSON.stringify(input.options) : null,
        correctAnswer: input.correctAnswer ?? null,
        explanation: input.explanation ?? null,
        reviewAnswer: input.reviewAnswer ?? null,
        imageUrl: input.imageUrl ?? null,
        pairs: input.pairs ? JSON.stringify(input.pairs) : null,
        markers: input.markers ? JSON.stringify(input.markers) : null,
        orderedItems: input.orderedItems ? JSON.stringify(input.orderedItems) : null,
        difficulty: input.difficulty,
        tags: JSON.stringify(input.tags),
        category: input.category as any,
        isActive: false,
        submittedByUserId: ctx.user.id,
        submitterName: input.submitterName ?? null,
        submitterLinkedIn: input.submitterLinkedIn ?? null,
        submissionStatus: "pending_review",
        submissionPointsAwarded: false,
      });
      const newId = (result as any).insertId as number;
      const qid = `QID-${String(newId).padStart(4, "0")}`;
      await db.update(quickfireQuestions).set({ qid }).where(eq(quickfireQuestions.id, newId));
      return { id: newId, qid };
    }),

  /** Returns the current user's own submitted questions with their review status */
  getMySubmissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const rows = await db
      .select()
      .from(quickfireQuestions)
      .where(
        and(
          eq(quickfireQuestions.submittedByUserId, ctx.user.id),
          sql`${quickfireQuestions.submissionStatus} != 'draft'`
        )
      )
      .orderBy(desc(quickfireQuestions.createdAt));
    return rows.map((r) => ({
      ...r,
      options: r.options ? JSON.parse(r.options) : null,
      tags: r.tags ? JSON.parse(r.tags) : [],
    }));
  }),

  /** Admin: list all questions pending review, with submitter info */
  adminGetPendingSubmissions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const rows = await db
      .select({
        q: quickfireQuestions,
        submitterEmail: users.email,
        submitterDisplayName: users.displayName,
      })
      .from(quickfireQuestions)
      .leftJoin(users, eq(quickfireQuestions.submittedByUserId, users.id))
      .where(eq(quickfireQuestions.submissionStatus, "pending_review"))
      .orderBy(desc(quickfireQuestions.createdAt));
    return rows.map(({ q, submitterEmail, submitterDisplayName }) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      tags: q.tags ? JSON.parse(q.tags) : [],
      submitterEmail,
      submitterDisplayName,
    }));
  }),

  /**
   * Admin: approve a user-submitted question.
   * Sets isActive = true, submissionStatus = 'approved', and marks points as awarded.
   * The 50 bonus XP points are calculated at query time in getUserStats.
   */
  adminApproveSubmission: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [q] = await db.select().from(quickfireQuestions).where(eq(quickfireQuestions.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      if (q.submissionStatus !== "pending_review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Question is not pending review" });
      }
      await db.update(quickfireQuestions)
        .set({ submissionStatus: "approved", isActive: true, submissionPointsAwarded: true })
        .where(eq(quickfireQuestions.id, input.id));
      return { success: true, submittedByUserId: q.submittedByUserId };
    }),

  /** Admin: reject a user-submitted question with an optional reason */
  adminRejectSubmission: adminProcedure
    .input(z.object({ id: z.number().int().positive(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [q] = await db.select().from(quickfireQuestions).where(eq(quickfireQuestions.id, input.id)).limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      await db.update(quickfireQuestions)
        .set({ submissionStatus: "rejected", rejectionReason: input.reason ?? null })
        .where(eq(quickfireQuestions.id, input.id));
      return { success: true };
    }),

  /** Admin: get next queued challenge + questions per category for card generator */
  adminGetCardGeneratorData: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const results = await Promise.all(
      (CHALLENGE_CATEGORIES as readonly string[]).map(async (cat) => {
        const [challenge] = await db
          .select()
          .from(quickfireChallenges)
          .where(
            and(
              eq(quickfireChallenges.category, cat as any),
              inArray(quickfireChallenges.status, ["queued", "scheduled", "live", "draft"] as any[])
            )
          )
          .orderBy(quickfireChallenges.queuePosition, quickfireChallenges.priority)
          .limit(1);

        if (!challenge) return { category: cat, challenge: null, questions: [] };

        const questionIds: number[] = JSON.parse(challenge.questionIds || "[]");
        if (questionIds.length === 0) return { category: cat, challenge, questions: [] };

        const questions = await db
          .select({
            id: quickfireQuestions.id,
            qid: quickfireQuestions.qid,
            type: quickfireQuestions.type,
            question: quickfireQuestions.question,
            options: quickfireQuestions.options,
            correctAnswer: quickfireQuestions.correctAnswer,
            explanation: quickfireQuestions.explanation,
            reviewAnswer: quickfireQuestions.reviewAnswer,
            imageUrl: quickfireQuestions.imageUrl,
            difficulty: quickfireQuestions.difficulty,
            category: quickfireQuestions.category,
          })
          .from(quickfireQuestions)
          .where(inArray(quickfireQuestions.id, questionIds));

        const qMap = new Map(questions.map((q) => [q.id, q]));
        const orderedQuestions = questionIds
          .map((id) => qMap.get(id))
          .filter((q): q is NonNullable<typeof q> => q !== undefined);

        return { category: cat, challenge, questions: orderedQuestions };
      })
    );

    return results.filter((r) => r.challenge !== null);
  }),

  /**
   * Admin: get challenge + questions per category for a specific date's daily set.
   * Uses the daily set row if it exists; falls back to challenges published on that date.
   */
  adminGetCardGeneratorForDate: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { date } = input;

      // Helper: fetch full question rows by IDs
      async function fetchQuestions(ids: number[]) {
        if (ids.length === 0) return [];
        return db!.select({
          id: quickfireQuestions.id,
          qid: quickfireQuestions.qid,
          type: quickfireQuestions.type,
          question: quickfireQuestions.question,
          options: quickfireQuestions.options,
          correctAnswer: quickfireQuestions.correctAnswer,
          explanation: quickfireQuestions.explanation,
          reviewAnswer: quickfireQuestions.reviewAnswer,
          imageUrl: quickfireQuestions.imageUrl,
          difficulty: quickfireQuestions.difficulty,
          category: quickfireQuestions.category,
        }).from(quickfireQuestions).where(inArray(quickfireQuestions.id, ids));
      }

      // 1. Try the daily set row for this date
      const [setRow] = await db
        .select()
        .from(quickfireDailySets)
        .where(eq(quickfireDailySets.setDate, date))
        .limit(1);

      // 2. Get challenges published on this date for titles
      const publishedChallenges = await db
        .select()
        .from(quickfireChallenges)
        .where(
          and(
            eq(quickfireChallenges.publishDate, date),
            inArray(quickfireChallenges.status, ["live", "archived"] as any[])
          )
        );
      const challengeByCategory = new Map(publishedChallenges.map((c) => [c.category as string, c]));

      if (setRow) {
        const questionMap = parseDailySetIds(setRow.questionIds);
        const allIds = Object.values(questionMap).filter((id): id is number => id !== null);
        const allQuestions = await fetchQuestions(allIds);
        const qMap = new Map(allQuestions.map((q) => [q.id, q]));

        const results = (CHALLENGE_CATEGORIES as readonly string[]).map((cat) => {
          const key = CAT_KEY[cat as ChallengeCategory] ?? cat.toLowerCase();
          const qId = questionMap[key] ?? null;
          const q = qId !== null ? qMap.get(qId) : undefined;
          const challenge = challengeByCategory.get(cat) ?? null;
          return {
            category: cat,
            challenge: challenge
              ? { title: challenge.title, status: challenge.status, category: challenge.category }
              : (q ? { title: `${cat} — ${date}`, status: "archived", category: cat } : null),
            questions: q ? [q] : [],
          };
        });
        return { date, results: results.filter((r) => r.questions.length > 0) };
      }

      // 3. No daily set row — use published challenges directly
      if (publishedChallenges.length === 0) return { date, results: [] };

      const allQIds = Array.from(
        new Set(publishedChallenges.flatMap((c) => JSON.parse(c.questionIds || "[]") as number[]))
      );
      const allQuestions = await fetchQuestions(allQIds);
      const qMap = new Map(allQuestions.map((q) => [q.id, q]));

      const results = publishedChallenges.map((challenge) => {
        const qIds: number[] = JSON.parse(challenge.questionIds || "[]");
        const questions = qIds.map((id) => qMap.get(id)).filter((q): q is NonNullable<typeof q> => q !== undefined);
        return {
          category: challenge.category as string,
          challenge: { title: challenge.title, status: challenge.status, category: challenge.category as string },
          questions,
        };
      });

      return { date, results: results.filter((r) => r.questions.length > 0) };
    }),

  /**
   * Admin: list dates that have daily sets or published challenges, up to 30 days back.
   * Returns array of YYYY-MM-DD strings in descending order (newest first).
   */
  adminListCardGeneratorDates: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const today = todayDateStr();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 29);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const [setRows, challengeRows] = await Promise.all([
      db.select({ setDate: quickfireDailySets.setDate })
        .from(quickfireDailySets)
        .where(and(gte(quickfireDailySets.setDate, cutoff), lte(quickfireDailySets.setDate, today))),
      db.select({ publishDate: quickfireChallenges.publishDate })
        .from(quickfireChallenges)
        .where(
          and(
            inArray(quickfireChallenges.status, ["live", "archived"] as any[]),
            gte(quickfireChallenges.publishDate, cutoff),
            lte(quickfireChallenges.publishDate, today)
          )
        ),
    ]);

    const allDates = new Set<string>([today]);
    for (const r of setRows) allDates.add(r.setDate);
    for (const r of challengeRows) if (r.publishDate) allDates.add(r.publishDate);

    return Array.from(allDates).sort().reverse().slice(0, 30);
  }),

  /** Get flashcard (quickReview) counts grouped by echoCategory for admin stats */
  adminGetFlashcardCategoryStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select({
          echoCategory: quickfireQuestions.echoCategory,
          total: sql<number>`COUNT(*)`,
          active: sql<number>`SUM(CASE WHEN ${quickfireQuestions.isActive} = 1 THEN 1 ELSE 0 END)`,
        })
        .from(quickfireQuestions)
        .where(
          and(
            eq(quickfireQuestions.type, "quickReview"),
            isNull(quickfireQuestions.deletedAt)
          )
        )
        .groupBy(quickfireQuestions.echoCategory)
        .orderBy(quickfireQuestions.echoCategory);
      // Also get total across all categories
      const grandTotal = rows.reduce((acc, r) => acc + Number(r.total), 0);
      return { byCategory: rows, grandTotal };
    }),
});
