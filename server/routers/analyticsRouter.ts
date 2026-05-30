/**
 * analyticsRouter.ts
 * Handles event ingestion (track*) and admin reporting queries.
 */
import { z } from "zod";
import { and, desc, eq, gte, lte, sql, count, avg, max, min, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  userLoginEvents,
  userPageViewEvents,
  userActivityLogs,
  lmsVideoEvents,
  lmsQuizAttempts,
  lmsLessonProgress,
  lmsEnrollments,
  lmsCourses,
  lmsLessons,
  lmsThinkificImports,
  digitalDownloadEvents,
  digitalProducts,
  digitalPurchases,
  users,
} from "../../drizzle/schema";

/** Helper to extract client IP from request */
function getClientIp(ctx: any): string | null {
  const req = ctx.req;
  if (!req) return null;
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
}

/** Helper to get user agent from request */
function getUserAgent(ctx: any): string | null {
  return ctx.req?.headers?.['user-agent'] ?? null;
}

/** Log to unified activity table (fire-and-forget) */
async function logActivity(db: any, params: {
  userId: number;
  eventType: string;
  description: string;
  path?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: any;
}) {
  try {
    await db.insert(userActivityLogs).values({
      userId: params.userId,
      eventType: params.eventType,
      description: params.description,
      path: params.path ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    // Don't let logging failures break the main flow
    console.error('[ActivityLog] Failed to log:', e);
  }
}

// ─── Public / Protected Tracking Router ────────────────────────────────────
export const analyticsTrackRouter = router({
  /** Called on every route change from the frontend */
  pageView: publicProcedure
    .input(z.object({
      path: z.string().max(512),
      referrer: z.string().max(512).optional(),
      sessionId: z.string().max(64).optional(),
      durationMs: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      const userId = (ctx as any).user?.id ?? null;
      const ip = getClientIp(ctx);
      await db.insert(userPageViewEvents).values({
        userId,
        sessionId: input.sessionId ?? null,
        path: input.path,
        referrer: input.referrer ?? null,
        ipAddress: ip,
        durationMs: input.durationMs ?? null,
      });
      // Log to unified activity table for authenticated users
      if (userId) {
        logActivity(db, {
          userId,
          eventType: 'page_view',
          description: `Viewed ${input.path}`,
          path: input.path,
          ipAddress: ip,
          userAgent: getUserAgent(ctx),
          metadata: { referrer: input.referrer, sessionId: input.sessionId },
        });
      }
      return { ok: true };
    }),

  /** Called when a video event fires (play, pause, complete, progress) */
  videoEvent: protectedProcedure
    .input(z.object({
      lessonId: z.number().int(),
      courseId: z.number().int(),
      eventType: z.enum(["play", "pause", "complete", "seek", "progress"]),
      positionSec: z.number().int().default(0),
      durationSec: z.number().int().default(0),
      percentWatched: z.number().int().min(0).max(100).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(lmsVideoEvents).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: input.courseId,
        eventType: input.eventType,
        positionSec: input.positionSec,
        durationSec: input.durationSec,
        percentWatched: input.percentWatched,
      });
      // Log to unified activity table
      if (input.eventType === 'play' || input.eventType === 'complete') {
        logActivity(db, {
          userId: ctx.user.id,
          eventType: input.eventType === 'play' ? 'video_play' : 'video_complete',
          description: `${input.eventType === 'play' ? 'Started' : 'Completed'} video (lesson ${input.lessonId}, course ${input.courseId})`,
          ipAddress: getClientIp(ctx),
          userAgent: getUserAgent(ctx),
          metadata: { lessonId: input.lessonId, courseId: input.courseId, percentWatched: input.percentWatched, positionSec: input.positionSec },
        });
      }
      return { ok: true };
    }),

  /** Self-service: returns the current user's own activity summary (no admin required) */
  myActivity: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const userId = ctx.user.id;
      // Login history (last 30)
      const logins = await db.select({
        id: userLoginEvents.id,
        ip: userLoginEvents.ipAddress,
        userAgent: userLoginEvents.userAgent,
        createdAt: userLoginEvents.createdAt,
      }).from(userLoginEvents)
        .where(eq(userLoginEvents.userId, userId))
        .orderBy(desc(userLoginEvents.createdAt))
        .limit(30);
      // Page views grouped by path (top 30)
      const pageViews = await db.select({
        path: userPageViewEvents.path,
        views: count(),
        lastViewed: max(userPageViewEvents.createdAt),
      }).from(userPageViewEvents)
        .where(eq(userPageViewEvents.userId, userId))
        .groupBy(userPageViewEvents.path)
        .orderBy(desc(count()))
        .limit(30);
      // Course enrollments with progress
      const enrollments = await db.execute(sql`
        SELECT
          e.id AS enrollmentId,
          e.enrolled_at AS enrolledAt,
          e.completed_at AS completedAt,
          e.progress_pct AS progressPct,
          c.id AS courseId,
          c.title AS courseTitle,
          (SELECT COUNT(*) FROM lms_video_events WHERE user_id = ${userId} AND course_id = c.id AND event_type = 'complete') AS videosCompleted,
          (SELECT COUNT(*) FROM lms_quiz_attempts WHERE user_id = ${userId} AND course_id = c.id) AS quizAttempts,
          (SELECT ROUND(AVG(score),1) FROM lms_quiz_attempts WHERE user_id = ${userId} AND course_id = c.id) AS avgQuizScore
        FROM lms_enrollments e
        JOIN lms_courses c ON c.id = e.course_id
        WHERE e.user_id = ${userId}
        ORDER BY e.enrolled_at DESC
      `);
      // Downloads (last 20)
      const downloads = await db.select({
        id: digitalDownloadEvents.id,
        productId: digitalDownloadEvents.productId,
        productTitle: digitalProducts.title,
        createdAt: digitalDownloadEvents.downloadedAt,
      }).from(digitalDownloadEvents)
        .leftJoin(digitalProducts, eq(digitalProducts.id, digitalDownloadEvents.productId))
        .where(eq(digitalDownloadEvents.userId, userId))
        .orderBy(desc(digitalDownloadEvents.downloadedAt))
        .limit(20);
      // Summary counts
      const [loginCount] = await db.select({ c: count() }).from(userLoginEvents).where(eq(userLoginEvents.userId, userId));
      const [pageViewCount] = await db.select({ c: count() }).from(userPageViewEvents).where(eq(userPageViewEvents.userId, userId));
      const [videoPlayCount] = await db.select({ c: count() }).from(lmsVideoEvents).where(and(eq(lmsVideoEvents.userId, userId), eq(lmsVideoEvents.eventType, "play")));
      const [quizCount] = await db.select({ c: count() }).from(lmsQuizAttempts).where(eq(lmsQuizAttempts.userId, userId));
      const [downloadCount] = await db.select({ c: count() }).from(digitalDownloadEvents).where(eq(digitalDownloadEvents.userId, userId));
      return {
        summary: {
          logins: loginCount?.c ?? 0,
          pageViews: pageViewCount?.c ?? 0,
          videoPlays: videoPlayCount?.c ?? 0,
          quizAttempts: quizCount?.c ?? 0,
          downloads: downloadCount?.c ?? 0,
        },
        logins,
        pageViews,
        enrollments: (enrollments as any).rows as any[],
        downloads,
      };
    }),

  /** Called when a quiz is submitted */
  quizAttempt: protectedProcedure
    .input(z.object({
      lessonId: z.number().int(),
      courseId: z.number().int(),
      score: z.number().int().min(0).max(100),
      passed: z.boolean(),
      totalQuestions: z.number().int(),
      correctAnswers: z.number().int(),
      timeTakenSec: z.number().int().optional(),
      answersJson: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(lmsQuizAttempts).values({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        courseId: input.courseId,
        score: input.score,
        passed: input.passed,
        totalQuestions: input.totalQuestions,
        correctAnswers: input.correctAnswers,
        timeTakenSec: input.timeTakenSec ?? null,
        answersJson: input.answersJson ?? null,
      });
      // Log to unified activity table
      logActivity(db, {
        userId: ctx.user.id,
        eventType: input.passed ? 'quiz_pass' : 'quiz_fail',
        description: `Quiz ${input.passed ? 'passed' : 'failed'} (${input.score}%, ${input.correctAnswers}/${input.totalQuestions}) - lesson ${input.lessonId}`,
        ipAddress: getClientIp(ctx),
        userAgent: getUserAgent(ctx),
        metadata: { lessonId: input.lessonId, courseId: input.courseId, score: input.score, passed: input.passed },
      });
      return { ok: true };
    }),
});

// ─── Admin Analytics Query Router ──────────────────────────────────────────
export const analyticsAdminRouter = router({
  /** Overview stats: logins, page views, video plays, quiz attempts, downloads in a date range */
  overview: protectedProcedure
    .input(z.object({
      from: z.string().optional(), // ISO date string
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400_000);
      const to = input.to ? new Date(input.to) : new Date();

      // Active users = users who signed in within the window (lastSignedIn is reliably updated on every login)
      const [activeUsersRow] = await db.select({ c: count() }).from(users)
        .where(and(gte(users.lastSignedIn, from), lte(users.lastSignedIn, to)));
      // Login count: prefer user_login_events if populated, otherwise fall back to active users
      const [loginEventRow] = await db.select({ c: count() }).from(userLoginEvents)
        .where(and(gte(userLoginEvents.createdAt, from), lte(userLoginEvents.createdAt, to)));
      const loginCount = loginEventRow.c > 0 ? loginEventRow.c : activeUsersRow.c;
      const [pageViewCount] = await db.select({ c: count() }).from(userPageViewEvents)
        .where(and(gte(userPageViewEvents.createdAt, from), lte(userPageViewEvents.createdAt, to)));
      const [videoPlayCount] = await db.select({ c: count() }).from(lmsVideoEvents)
        .where(and(eq(lmsVideoEvents.eventType, "play"), gte(lmsVideoEvents.createdAt, from), lte(lmsVideoEvents.createdAt, to)));
      const [videoCompleteCount] = await db.select({ c: count() }).from(lmsVideoEvents)
        .where(and(eq(lmsVideoEvents.eventType, "complete"), gte(lmsVideoEvents.createdAt, from), lte(lmsVideoEvents.createdAt, to)));
      const [quizCount] = await db.select({ c: count() }).from(lmsQuizAttempts)
        .where(and(gte(lmsQuizAttempts.createdAt, from), lte(lmsQuizAttempts.createdAt, to)));
      const [downloadCount] = await db.select({ c: count() }).from(digitalDownloadEvents)
        .where(and(gte(digitalDownloadEvents.downloadedAt, from), lte(digitalDownloadEvents.downloadedAt, to)));
      const [purchaseCount] = await db.select({ c: count() }).from(digitalPurchases)
        .where(and(gte(digitalPurchases.purchasedAt, from), lte(digitalPurchases.purchasedAt, to)));
      const [enrollmentCount] = await db.select({ c: count() }).from(lmsEnrollments)
        .where(and(gte(lmsEnrollments.enrolledAt, from), lte(lmsEnrollments.enrolledAt, to)));

      return {
        logins: loginCount,
        pageViews: pageViewCount.c,
        videoPlays: videoPlayCount.c,
        videoCompletes: videoCompleteCount.c,
        quizAttempts: quizCount.c,
        downloads: downloadCount.c,
        activeUsers: activeUsersRow.c,
        purchases: purchaseCount.c,
        enrollments: enrollmentCount.c,
      };
    }),

  /** Daily time-series for the overview chart */
  dailySeries: protectedProcedure
    .input(z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      metric: z.enum(["logins", "pageViews", "videoPlays", "quizAttempts", "downloads"]).default("logins"),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400_000);
      const to = input.to ? new Date(input.to) : new Date();

      let rows: { date: string; value: number }[] = [];

      if (input.metric === "logins") {
        // Use users.lastSignedIn for daily login trend (more reliable than user_login_events)
        const data = await db.select({
          date: sql<string>`DATE(lastSignedIn)`,
          value: count(),
        }).from(users)
          .where(and(gte(users.lastSignedIn, from), lte(users.lastSignedIn, to)))
          .groupBy(sql`DATE(lastSignedIn)`)
          .orderBy(sql`DATE(lastSignedIn)`);
        rows = data.map(r => ({ date: r.date, value: r.value }));
      } else if (input.metric === "pageViews") {
        const data = await db.select({
          date: sql<string>`DATE(created_at)`,
          value: count(),
        }).from(userPageViewEvents)
          .where(and(gte(userPageViewEvents.createdAt, from), lte(userPageViewEvents.createdAt, to)))
          .groupBy(sql`DATE(created_at)`)
          .orderBy(sql`DATE(created_at)`);
        rows = data.map(r => ({ date: r.date, value: r.value }));
      } else if (input.metric === "videoPlays") {
        const data = await db.select({
          date: sql<string>`DATE(created_at)`,
          value: count(),
        }).from(lmsVideoEvents)
          .where(and(eq(lmsVideoEvents.eventType, "play"), gte(lmsVideoEvents.createdAt, from), lte(lmsVideoEvents.createdAt, to)))
          .groupBy(sql`DATE(created_at)`)
          .orderBy(sql`DATE(created_at)`);
        rows = data.map(r => ({ date: r.date, value: r.value }));
      } else if (input.metric === "quizAttempts") {
        const data = await db.select({
          date: sql<string>`DATE(created_at)`,
          value: count(),
        }).from(lmsQuizAttempts)
          .where(and(gte(lmsQuizAttempts.createdAt, from), lte(lmsQuizAttempts.createdAt, to)))
          .groupBy(sql`DATE(created_at)`)
          .orderBy(sql`DATE(created_at)`);
        rows = data.map(r => ({ date: r.date, value: r.value }));
      } else if (input.metric === "downloads") {
        const data = await db.select({
          date: sql<string>`DATE(downloaded_at)`,
          value: count(),
        }).from(digitalDownloadEvents)
          .where(and(gte(digitalDownloadEvents.downloadedAt, from), lte(digitalDownloadEvents.downloadedAt, to)))
          .groupBy(sql`DATE(downloaded_at)`)
          .orderBy(sql`DATE(downloaded_at)`);
        rows = data.map(r => ({ date: r.date, value: r.value }));
      }

      return rows;
    }),

  /** Paginated user list with activity summary */
  userList: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(25),
      sortBy: z.enum(["lastLogin", "logins", "pageViews", "videoPlays", "quizAttempts", "downloads", "name"]).default("lastLogin"),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;

      // Build search condition
      const searchCond = input.search
        ? sql`(u.name LIKE ${`%${input.search}%`} OR u.email LIKE ${`%${input.search}%`})`
        : sql`1=1`;

      // Aggregate per-user stats in one query
      // NOTE: users.lastSignedIn is camelCase in the DB (Drizzle uses camelCase by default)
      // Sort by lastSignedIn DESC NULLS LAST so active users appear first
      const rows = await db.execute(sql`
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.createdAt AS joinedAt,
          u.lastSignedIn AS lastLogin,
          (SELECT COUNT(*) FROM user_login_events WHERE user_id = u.id) AS loginCount,
          (SELECT COUNT(*) FROM user_page_view_events WHERE user_id = u.id) AS pageViewCount,
          (SELECT COUNT(*) FROM lms_video_events WHERE user_id = u.id AND event_type = 'play') AS videoPlayCount,
          (SELECT COUNT(*) FROM lms_video_events WHERE user_id = u.id AND event_type = 'complete') AS videoCompleteCount,
          (SELECT COUNT(*) FROM lms_quiz_attempts WHERE user_id = u.id) AS quizAttemptCount,
          (SELECT ROUND(AVG(score),1) FROM lms_quiz_attempts WHERE user_id = u.id) AS avgQuizScore,
          (SELECT COUNT(*) FROM digital_download_events WHERE user_id = u.id) AS downloadCount,
          (SELECT COUNT(*) FROM lms_enrollments WHERE user_id = u.id) AS enrollmentCount,
          (SELECT COUNT(*) FROM lms_enrollments WHERE user_id = u.id AND completed_at IS NOT NULL) AS completedCourseCount
        FROM users u
        WHERE ${searchCond}
        ORDER BY ${
          input.sortBy === "lastLogin" ? sql`u.lastSignedIn DESC` :
          input.sortBy === "logins" ? sql`loginCount DESC` :
          input.sortBy === "pageViews" ? sql`pageViewCount DESC` :
          input.sortBy === "videoPlays" ? sql`videoPlayCount DESC` :
          input.sortBy === "quizAttempts" ? sql`quizAttemptCount DESC` :
          input.sortBy === "downloads" ? sql`downloadCount DESC` :
          sql`u.name ASC`
        }
        LIMIT ${input.pageSize} OFFSET ${offset}
      `);

      const [totalRow] = await db.execute(sql`
        SELECT COUNT(*) AS total FROM users u WHERE ${searchCond}
      `);

      return {
        users: (rows as any[]).map(r => ({
          id: r.id as number,
          name: r.name as string,
          email: r.email as string,
          role: r.role as string,
          joinedAt: r.joinedAt as Date | null,
          lastLogin: r.lastLogin as Date | null,
          loginCount: Number(r.loginCount ?? 0),
          pageViewCount: Number(r.pageViewCount ?? 0),
          videoPlayCount: Number(r.videoPlayCount ?? 0),
          videoCompleteCount: Number(r.videoCompleteCount ?? 0),
          quizAttemptCount: Number(r.quizAttemptCount ?? 0),
          avgQuizScore: r.avgQuizScore != null ? Number(r.avgQuizScore) : null,
          downloadCount: Number(r.downloadCount ?? 0),
          enrollmentCount: Number(r.enrollmentCount ?? 0),
          completedCourseCount: Number(r.completedCourseCount ?? 0),
        })),
        total: Number((totalRow as any).total ?? 0),
      };
    }),

  /** Full activity timeline for a single user */
  userDetail: protectedProcedure
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [userRow] = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!userRow) throw new TRPCError({ code: "NOT_FOUND" });

      // Login history (last 50)
      const logins = await db.select().from(userLoginEvents)
        .where(eq(userLoginEvents.userId, input.userId))
        .orderBy(desc(userLoginEvents.createdAt))
        .limit(50);

      // Page views (last 100, grouped by path)
      const pageViewsByPath = await db.select({
        path: userPageViewEvents.path,
        views: count(),
        lastViewed: max(userPageViewEvents.createdAt),
      }).from(userPageViewEvents)
        .where(eq(userPageViewEvents.userId, input.userId))
        .groupBy(userPageViewEvents.path)
        .orderBy(desc(sql`views`))
        .limit(50);

      // Course enrollments with progress
      const enrollments = await db.execute(sql`
        SELECT
          e.id AS enrollmentId,
          e.enrolled_at AS enrolledAt,
          e.completed_at AS completedAt,
          e.progress_pct AS progressPct,
          c.id AS courseId,
          c.title AS courseTitle,
          (SELECT COUNT(*) FROM lms_video_events WHERE user_id = ${input.userId} AND course_id = c.id AND event_type = 'complete') AS videosCompleted,
          (SELECT COUNT(*) FROM lms_quiz_attempts WHERE user_id = ${input.userId} AND course_id = c.id) AS quizAttempts,
          (SELECT ROUND(AVG(score),1) FROM lms_quiz_attempts WHERE user_id = ${input.userId} AND course_id = c.id) AS avgQuizScore
        FROM lms_enrollments e
        JOIN lms_courses c ON c.id = e.course_id
        WHERE e.user_id = ${input.userId}
        ORDER BY e.enrolled_at DESC
      `);

      // Quiz attempts (last 30)
      const quizAttempts = await db.execute(sql`
        SELECT
          qa.id,
          qa.score,
          qa.passed,
          qa.total_questions AS totalQuestions,
          qa.correct_answers AS correctAnswers,
          qa.time_taken_sec AS timeTakenSec,
          qa.created_at AS createdAt,
          l.title AS lessonTitle,
          c.title AS courseTitle
        FROM lms_quiz_attempts qa
        JOIN lms_lessons l ON l.id = qa.lesson_id
        JOIN lms_courses c ON c.id = qa.course_id
        WHERE qa.user_id = ${input.userId}
        ORDER BY qa.created_at DESC
        LIMIT 30
      `);

      // Video events summary per lesson
      const videoSummary = await db.execute(sql`
        SELECT
          lve.lesson_id AS lessonId,
          l.title AS lessonTitle,
          c.title AS courseTitle,
          MAX(lve.percent_watched) AS maxPctWatched,
          COUNT(CASE WHEN lve.event_type = 'play' THEN 1 END) AS playCount,
          MAX(CASE WHEN lve.event_type = 'complete' THEN 1 ELSE 0 END) AS completed,
          MAX(lve.created_at) AS lastWatched
        FROM lms_video_events lve
        JOIN lms_lessons l ON l.id = lve.lesson_id
        JOIN lms_courses c ON c.id = lve.course_id
        WHERE lve.user_id = ${input.userId}
        GROUP BY lve.lesson_id, l.title, c.title
        ORDER BY lastWatched DESC
        LIMIT 50
      `);

      // Download history
      const downloads = await db.execute(sql`
        SELECT
          dde.id,
          dde.downloaded_at AS downloadedAt,
          dp.title AS productTitle,
          dp.slug AS productSlug
        FROM digital_download_events dde
        JOIN digital_products dp ON dp.id = dde.product_id
        WHERE dde.user_id = ${input.userId}
        ORDER BY dde.downloaded_at DESC
        LIMIT 50
      `);

      return {
        user: userRow,
        logins: logins.map(l => ({ id: l.id, ipAddress: l.ipAddress, createdAt: l.createdAt })),
        pageViewsByPath: (pageViewsByPath as any[]).map(r => ({
          path: r.path as string,
          views: Number(r.views),
          lastViewed: r.lastViewed as Date | null,
        })),
        enrollments: (enrollments as any[]).map(r => ({
          enrollmentId: r.enrollmentId as number,
          enrolledAt: r.enrolledAt as Date,
          completedAt: r.completedAt as Date | null,
          progressPct: Number(r.progressPct ?? 0),
          courseId: r.courseId as number,
          courseTitle: r.courseTitle as string,
          videosCompleted: Number(r.videosCompleted ?? 0),
          quizAttempts: Number(r.quizAttempts ?? 0),
          avgQuizScore: r.avgQuizScore != null ? Number(r.avgQuizScore) : null,
        })),
        quizAttempts: (quizAttempts as any[]).map(r => ({
          id: r.id as number,
          score: Number(r.score),
          passed: Boolean(r.passed),
          totalQuestions: Number(r.totalQuestions),
          correctAnswers: Number(r.correctAnswers),
          timeTakenSec: r.timeTakenSec != null ? Number(r.timeTakenSec) : null,
          createdAt: r.createdAt as Date,
          lessonTitle: r.lessonTitle as string,
          courseTitle: r.courseTitle as string,
        })),
        videoSummary: (videoSummary as any[]).map(r => ({
          lessonId: r.lessonId as number,
          lessonTitle: r.lessonTitle as string,
          courseTitle: r.courseTitle as string,
          maxPctWatched: Number(r.maxPctWatched ?? 0),
          playCount: Number(r.playCount ?? 0),
          completed: Boolean(r.completed),
          lastWatched: r.lastWatched as Date | null,
        })),
        downloads: (downloads as any[]).map(r => ({
          id: r.id as number,
          downloadedAt: r.downloadedAt as Date,
          productTitle: r.productTitle as string,
          productSlug: r.productSlug as string,
        })),
      };
    }),

  /** Top pages by view count */
  topPages: protectedProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().int().default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400_000);
      const to = input.to ? new Date(input.to) : new Date();
      const rows = await db.select({
        path: userPageViewEvents.path,
        views: count(),
        uniqueUsers: sql<number>`COUNT(DISTINCT user_id)`,
      }).from(userPageViewEvents)
        .where(and(gte(userPageViewEvents.createdAt, from), lte(userPageViewEvents.createdAt, to)))
        .groupBy(userPageViewEvents.path)
        .orderBy(desc(sql`views`))
        .limit(input.limit);
      return rows.map(r => ({ path: r.path, views: Number(r.views), uniqueUsers: Number(r.uniqueUsers) }));
    }),

  /** Top courses by video completions and quiz attempts */
  topCourses: protectedProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional(), limit: z.number().int().default(10) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 86400_000);
      const to = input.to ? new Date(input.to) : new Date();
      const rows = await db.execute(sql`
        SELECT
          c.id AS courseId,
          c.title AS courseTitle,
          COUNT(DISTINCT e.user_id) AS enrolledUsers,
          COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.user_id END) AS completedUsers,
          COUNT(CASE WHEN lve.event_type = 'play' AND lve.created_at BETWEEN ${from} AND ${to} THEN 1 END) AS videoPlays,
          COUNT(CASE WHEN lve.event_type = 'complete' AND lve.created_at BETWEEN ${from} AND ${to} THEN 1 END) AS videoCompletes,
          COUNT(CASE WHEN qa.created_at BETWEEN ${from} AND ${to} THEN 1 END) AS quizAttempts,
          ROUND(AVG(CASE WHEN qa.created_at BETWEEN ${from} AND ${to} THEN qa.score END), 1) AS avgQuizScore
        FROM lms_courses c
        LEFT JOIN lms_enrollments e ON e.course_id = c.id
        LEFT JOIN lms_video_events lve ON lve.course_id = c.id
        LEFT JOIN lms_quiz_attempts qa ON qa.course_id = c.id
        GROUP BY c.id, c.title
        ORDER BY videoPlays DESC
        LIMIT ${input.limit}
      `);
      return (rows as any[]).map(r => ({
        courseId: r.courseId as number,
        courseTitle: r.courseTitle as string,
        enrolledUsers: Number(r.enrolledUsers ?? 0),
        completedUsers: Number(r.completedUsers ?? 0),
        videoPlays: Number(r.videoPlays ?? 0),
        videoCompletes: Number(r.videoCompletes ?? 0),
        quizAttempts: Number(r.quizAttempts ?? 0),
        avgQuizScore: r.avgQuizScore != null ? Number(r.avgQuizScore) : null,
      }));
    }),

  /** Full unified activity log for a user — paginated, filterable */
  userActivityLog: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(50),
      eventType: z.string().optional(), // filter by event type
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const offset = (input.page - 1) * input.pageSize;
      const conditions = [eq(userActivityLogs.userId, input.userId)];
      if (input.eventType) {
        conditions.push(eq(userActivityLogs.eventType, input.eventType));
      }

      const logs = await db.select().from(userActivityLogs)
        .where(and(...conditions))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [totalRow] = await db.select({ total: count() }).from(userActivityLogs)
        .where(and(...conditions));

      return {
        logs: logs.map(l => ({
          id: l.id,
          eventType: l.eventType,
          description: l.description,
          path: l.path,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          metadata: l.metadata,
          createdAt: l.createdAt,
        })),
        total: Number(totalRow?.total ?? 0),
      };
    }),

  /** Export user activity log as CSV data */
  exportUserActivityCsv: protectedProcedure
    .input(z.object({
      userId: z.number().int(),
      eventType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(userActivityLogs.userId, input.userId)];
      if (input.eventType) {
        conditions.push(eq(userActivityLogs.eventType, input.eventType));
      }

      const logs = await db.select().from(userActivityLogs)
        .where(and(...conditions))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(10000); // cap at 10k rows for export

      // Also include historical data from existing event tables
      const pageViews = await db.execute(sql`
        SELECT 'page_view' AS event_type, path AS description, ip_address, created_at
        FROM user_page_view_events
        WHERE user_id = ${input.userId}
        ORDER BY created_at DESC
        LIMIT 5000
      `);

      const logins = await db.execute(sql`
        SELECT 'login' AS event_type, CONCAT('Login from ', COALESCE(ip_address, 'unknown')) AS description, ip_address, user_agent, created_at
        FROM user_login_events
        WHERE user_id = ${input.userId}
        ORDER BY created_at DESC
        LIMIT 1000
      `);

      // Combine all sources
      const allRows = [
        ...logs.map(l => ({
          timestamp: l.createdAt,
          eventType: l.eventType,
          description: l.description,
          path: l.path ?? '',
          ipAddress: l.ipAddress ?? '',
          userAgent: l.userAgent ?? '',
          metadata: l.metadata ? JSON.stringify(l.metadata) : '',
        })),
        ...(pageViews as any[]).map(r => ({
          timestamp: r.created_at,
          eventType: 'page_view',
          description: r.description ?? '',
          path: r.description ?? '',
          ipAddress: r.ip_address ?? '',
          userAgent: '',
          metadata: '',
        })),
        ...(logins as any[]).map(r => ({
          timestamp: r.created_at,
          eventType: 'login',
          description: r.description ?? '',
          path: '',
          ipAddress: r.ip_address ?? '',
          userAgent: r.user_agent ?? '',
          metadata: '',
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Build CSV
      const header = 'Timestamp,Event Type,Description,Path,IP Address,User Agent,Metadata';
      const rows = allRows.map(r => {
        const ts = new Date(r.timestamp).toISOString();
        const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        return `${ts},${escape(r.eventType)},${escape(r.description)},${escape(r.path)},${escape(r.ipAddress)},${escape(r.userAgent)},${escape(r.metadata)}`;
      });

      return { csv: [header, ...rows].join('\n'), totalRows: allRows.length };
    }),

  /** Unified enrollments list across all courses */
  enrollmentsList: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      courseId: z.number().int().optional(),
      page: z.number().int().default(1),
      pageSize: z.number().int().default(50),
      status: z.enum(['all', 'active', 'completed']).default('all'),
      contentType: z.enum(['all', 'course', 'quiz', 'download']).default('all'),
      sortBy: z.enum(['enrolledAt', 'userName', 'courseTitle', 'progressPct', 'completedAt']).default('enrolledAt'),
      sortDir: z.enum(['asc', 'desc']).default('desc'),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const offset = (input.page - 1) * input.pageSize;
      // NOTE: lms_enrollments.course_id stores the thinkific_imports.lms_course_id value
      // (not lms_courses.id directly). We must join via thinkific_imports to get the course.
      const searchCond = input.search
        ? sql`AND (COALESCE(u.name, '') LIKE ${`%${input.search}%`} OR COALESCE(u.email, '') LIKE ${`%${input.search}%`} OR COALESCE(c.title, ti.thinkific_course_name, '') LIKE ${`%${input.search}%`})`
        : sql``;
      const courseCond = input.courseId ? sql`AND e.course_id = ${input.courseId}` : sql``;
      const statusCond = input.status === 'completed'
        ? sql`AND e.completed_at IS NOT NULL`
        : input.status === 'active'
        ? sql`AND e.completed_at IS NULL`
        : sql``;
      const contentTypeCond = input.contentType !== 'all'
        ? sql`AND COALESCE(c.type, 'course') = ${input.contentType}`
        : sql``;

      // Build ORDER BY clause safely
      const sortColMap: Record<string, string> = {
        enrolledAt: 'e.enrolled_at',
        userName: 'userName',
        courseTitle: 'courseTitle',
        progressPct: 'e.progress_pct',
        completedAt: 'e.completed_at',
      };
      const sortCol = sortColMap[input.sortBy] ?? 'e.enrolled_at';
      const sortDir = input.sortDir === 'asc' ? 'ASC' : 'DESC';

      // The JOIN chain:
      // e.course_id -> ti.lms_course_id (thinkific import maps enrollment's course_id to an lms_course)
      // ti.lms_course_id -> c.id (the actual lms_courses row)
      // This handles both direct lms enrollments (c.id = e.course_id) and thinkific-imported ones
      const rows = await db.execute(sql`
        SELECT
          e.id AS enrollmentId,
          e.user_id AS userId,
          COALESCE(u.name, u.email, CONCAT('User #', e.user_id)) AS userName,
          COALESCE(u.email, '') AS userEmail,
          u.membershipTier AS membershipTier, -- camelCase column in DB
          e.course_id AS courseId,
          COALESCE(c.title, ti.thinkific_course_name, CONCAT('Course #', e.course_id)) AS courseTitle,
          COALESCE(c.type, 'course') AS courseType,
          e.progress_pct AS progressPct,
          e.enrolled_at AS enrolledAt,
          e.completed_at AS completedAt,
          e.enrollment_type AS enrollmentType,
          CASE
            WHEN e.order_id IS NOT NULL THEN 'purchase'
            WHEN e.group_id IS NOT NULL THEN 'group'
            WHEN ti.id IS NOT NULL THEN 'thinkific_import'
            ELSE 'admin_grant'
          END AS enrollmentSource
        FROM lms_enrollments e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
        LEFT JOIN lms_courses c ON c.id = COALESCE(ti.lms_course_id, e.course_id)
        WHERE 1=1 ${searchCond} ${courseCond} ${statusCond} ${contentTypeCond}
        ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)}
        LIMIT ${input.pageSize} OFFSET ${offset}
      `);

      const [totalRow] = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM lms_enrollments e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
        LEFT JOIN lms_courses c ON c.id = COALESCE(ti.lms_course_id, e.course_id)
        WHERE 1=1 ${searchCond} ${courseCond} ${statusCond} ${contentTypeCond}
      `);

      return {
        enrollments: (rows as any[]).map(r => ({
          enrollmentId: Number(r.enrollmentId),
          userId: r.userId ? Number(r.userId) : null,
          userName: r.userName as string,
          userEmail: r.userEmail as string,
          membershipTier: (r.membershipTier as string) ?? null,
          courseId: Number(r.courseId),
          courseTitle: r.courseTitle as string,
          courseType: (r.courseType as string) ?? 'course',
          progressPct: Number(r.progressPct ?? 0),
          enrolledAt: r.enrolledAt as Date | null,
          completedAt: r.completedAt as Date | null,
          enrollmentType: r.enrollmentType as string | null,
          enrollmentSource: (r.enrollmentSource as string) ?? 'admin_grant',
        })),
        total: Number((totalRow as any).total ?? 0),
      };
    }),

  /** List all courses for the enrollment filter dropdown */
  courseListForFilter: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Enrollments reference courses via thinkific_imports.lms_course_id, not directly by lms_courses.id
      const rows = await db.execute(sql`
        SELECT c.id, c.title, c.type,
          COUNT(DISTINCT e.id) AS enrollmentCount
        FROM lms_courses c
        LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = c.id
        LEFT JOIN lms_enrollments e ON e.course_id = ti.lms_course_id
        WHERE c.status != 'archived'
        GROUP BY c.id
        ORDER BY c.title ASC
      `);
      return (rows as any[]).map(r => ({
        id: Number(r.id),
        title: r.title as string,
        type: (r.type as string) ?? 'course',
        enrollmentCount: Number(r.enrollmentCount ?? 0),
      }));
    }),

  /** Bulk grant enrollment: add selected users to a course */
  bulkGrantEnrollment: protectedProcedure
    .input(z.object({
      enrollmentIds: z.array(z.number().int()).min(1).max(500),
      courseId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Resolve user IDs from enrollment IDs
      const enrollRows = await db.execute(sql`
        SELECT DISTINCT user_id FROM lms_enrollments WHERE id IN (${sql.raw(input.enrollmentIds.join(','))})
        AND user_id IS NOT NULL
      `);
      const userIds = (enrollRows as any[]).map(r => Number(r.user_id)).filter(Boolean);
      if (!userIds.length) return { granted: 0, alreadyEnrolled: 0 };
      let granted = 0;
      let alreadyEnrolled = 0;
      for (const userId of userIds) {
        const [existing] = await db.execute(sql`
          SELECT id FROM lms_enrollments WHERE user_id = ${userId} AND course_id = ${input.courseId} LIMIT 1
        `);
        if (existing) { alreadyEnrolled++; continue; }
        await db.execute(sql`
          INSERT INTO lms_enrollments (user_id, course_id, enrolled_at, progress_pct, enrollment_type, created_at)
          VALUES (${userId}, ${input.courseId}, NOW(), 0, 'full', NOW())
        `);
        granted++;
      }
      return { granted, alreadyEnrolled };
    }),

  /** Bulk revoke enrollment: remove selected enrollments by their IDs */
  bulkRevokeEnrollment: protectedProcedure
    .input(z.object({
      enrollmentIds: z.array(z.number().int()).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.execute(sql`
        DELETE FROM lms_enrollments WHERE id IN (${sql.raw(input.enrollmentIds.join(','))})
      `);
      return { revoked: input.enrollmentIds.length };
    }),

    /** Global activity log across all users */
  globalActivityLog: protectedProcedure
    .input(z.object({
      page: z.number().int().default(1),
      pageSize: z.number().int().default(50),
      eventType: z.string().optional(),
      search: z.string().optional(), // search by user name/email
      dateFrom: z.string().optional(), // ISO date string
      dateTo: z.string().optional(),   // ISO date string
      userId: z.number().int().optional(), // filter by specific user
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const offset = (input.page - 1) * input.pageSize;
      const from = input.dateFrom ? new Date(input.dateFrom) : null;
      const to = input.dateTo ? new Date(input.dateTo) : null;
      const typeCond = input.eventType ? sql`AND a.event_type = ${input.eventType}` : sql``;
      const searchCond = input.search
        ? sql`AND (u.name LIKE ${`%${input.search}%`} OR u.email LIKE ${`%${input.search}%`})`
        : sql``;
      const userCond = input.userId ? sql`AND a.user_id = ${input.userId}` : sql``;
      const dateCond = from && to
        ? sql`AND a.created_at BETWEEN ${from} AND ${to}`
        : from ? sql`AND a.created_at >= ${from}`
        : to ? sql`AND a.created_at <= ${to}`
        : sql``;
      // Page view date/user conditions
      const pvDateCond = from && to
        ? sql`AND p.created_at BETWEEN ${from} AND ${to}`
        : from ? sql`AND p.created_at >= ${from}`
        : to ? sql`AND p.created_at <= ${to}`
        : sql``;
      const pvUserCond = input.userId ? sql`AND p.user_id = ${input.userId}` : sql``;
      // Login date/user conditions
      const lnDateCond = from && to
        ? sql`AND l.created_at BETWEEN ${from} AND ${to}`
        : from ? sql`AND l.created_at >= ${from}`
        : to ? sql`AND l.created_at <= ${to}`
        : sql``;
      const lnUserCond = input.userId ? sql`AND l.user_id = ${input.userId}` : sql``;
      // Only include page_view and login from UNION if no specific event type filter or if matching
      const includePv = !input.eventType || input.eventType === 'page_view';
      const includeLn = !input.eventType || input.eventType === 'login';
      // Use a UNION of activity_logs + page_view_events + login_events for a complete picture
      const pvUnion = includePv ? sql`
        UNION ALL
        SELECT
          p.id, p.user_id AS userId, u2.name AS userName, u2.email AS userEmail,
          'page_view' AS eventType, p.path AS description, p.path,
          NULL AS ipAddress, NULL AS userAgent,
          NULL AS metadata, p.created_at AS createdAt
        FROM user_page_view_events p
        LEFT JOIN users u2 ON u2.id = p.user_id
        WHERE 1=1 ${pvDateCond} ${pvUserCond}
          ${input.search ? sql`AND (u2.name LIKE ${`%${input.search}%`} OR u2.email LIKE ${`%${input.search}%`})` : sql``}
      ` : sql``;
      const lnUnion = includeLn ? sql`
        UNION ALL
        SELECT
          l.id, l.user_id AS userId, u3.name AS userName, u3.email AS userEmail,
          'login' AS eventType, 'User logged in' AS description, NULL AS path,
          NULL AS ipAddress, NULL AS userAgent,
          NULL AS metadata, l.created_at AS createdAt
        FROM user_login_events l
        LEFT JOIN users u3 ON u3.id = l.user_id
        WHERE 1=1 ${lnDateCond} ${lnUserCond}
          ${input.search ? sql`AND (u3.name LIKE ${`%${input.search}%`} OR u3.email LIKE ${`%${input.search}%`})` : sql``}
      ` : sql``;
      const rows = await db.execute(sql`
        SELECT * FROM (
          SELECT
            a.id, a.user_id AS userId, u.name AS userName, u.email AS userEmail,
            a.event_type AS eventType, a.description, a.path,
            a.ip_address AS ipAddress, a.user_agent AS userAgent,
            a.metadata, a.created_at AS createdAt
          FROM user_activity_logs a
          LEFT JOIN users u ON u.id = a.user_id
          WHERE 1=1 ${typeCond} ${searchCond} ${userCond} ${dateCond}
          ${pvUnion}
          ${lnUnion}
        ) AS combined
        ORDER BY createdAt DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `);
      // Count total
      const activityCount = await db.execute(sql`
        SELECT COUNT(*) AS c FROM user_activity_logs a LEFT JOIN users u ON u.id = a.user_id
        WHERE 1=1 ${typeCond} ${searchCond} ${userCond} ${dateCond}
      `);
      let total = Number((activityCount[0] as any)?.c ?? 0);
      if (includePv) {
        const pvCount = await db.execute(sql`
          SELECT COUNT(*) AS c FROM user_page_view_events p LEFT JOIN users u2 ON u2.id = p.user_id
          WHERE 1=1 ${pvDateCond} ${pvUserCond}
            ${input.search ? sql`AND (u2.name LIKE ${`%${input.search}%`} OR u2.email LIKE ${`%${input.search}%`})` : sql``}
        `);
        total += Number((pvCount[0] as any)?.c ?? 0);
      }
      if (includeLn) {
        const lnCount = await db.execute(sql`
          SELECT COUNT(*) AS c FROM user_login_events l LEFT JOIN users u3 ON u3.id = l.user_id
          WHERE 1=1 ${lnDateCond} ${lnUserCond}
            ${input.search ? sql`AND (u3.name LIKE ${`%${input.search}%`} OR u3.email LIKE ${`%${input.search}%`})` : sql``}
        `);
        total += Number((lnCount[0] as any)?.c ?? 0);
      }
      return {
        logs: (rows as any[]).map(r => ({
          id: Number(r.id),
          userId: r.userId ? Number(r.userId) : null,
          userName: (r.userName as string) ?? null,
          userEmail: (r.userEmail as string) ?? null,
          eventType: (r.eventType as string) ?? 'unknown',
          description: r.description as string,
          path: r.path as string | null,
          ipAddress: r.ipAddress as string | null,
          userAgent: r.userAgent as string | null,
          metadata: r.metadata,
          createdAt: r.createdAt as Date,
        })),
        total,
      };
    }),

  /** Export enrollments as CSV */
  exportEnrollmentsCsv: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      courseId: z.number().int().optional(),
      status: z.enum(['all', 'active', 'completed']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const searchCond = input.search
        ? sql`(u.name LIKE ${`%${input.search}%`} OR u.email LIKE ${`%${input.search}%`} OR c.title LIKE ${`%${input.search}%`})`
        : sql`1=1`;
      const courseCond = input.courseId ? sql`AND e.course_id = ${input.courseId}` : sql``;
      const statusCond = input.status === 'completed'
        ? sql`AND e.completed_at IS NOT NULL`
        : input.status === 'active'
        ? sql`AND e.completed_at IS NULL`
        : sql``;

      const rows = await db.execute(sql`
        SELECT
          COALESCE(u.name, u.email, CONCAT('User #', e.user_id)) AS name,
          COALESCE(u.email, '') AS email,
          COALESCE(c.title, ti.thinkific_course_name, CONCAT('Course #', e.course_id)) AS course,
          e.progress_pct, e.enrolled_at, e.completed_at, e.enrollment_type
        FROM lms_enrollments e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
        LEFT JOIN lms_courses c ON c.id = COALESCE(ti.lms_course_id, e.course_id)
        WHERE ${searchCond} ${courseCond} ${statusCond}
        ORDER BY e.enrolled_at DESC
        LIMIT 50000
      `);

      const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
      const header = 'Name,Email,Course,Progress %,Enrolled At,Completed At,Type';
      const lines = (rows as any[]).map(r =>
        [escape(r.name), escape(r.email), escape(r.course),
         r.progress_pct ?? 0,
         r.enrolled_at ? new Date(r.enrolled_at).toISOString() : '',
         r.completed_at ? new Date(r.completed_at).toISOString() : '',
         escape(r.enrollment_type ?? '')].join(',')
      );
      return { csv: [header, ...lines].join('\n'), totalRows: lines.length };
    }),

  /** Drill-down: all enrollments for a single user */
  userEnrollmentDetail: protectedProcedure
    .input(z.object({
      userId: z.number().int().optional(),
      userEmail: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      if (!input.userId && !input.userEmail) throw new TRPCError({ code: 'BAD_REQUEST', message: 'userId or userEmail required' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userCond = input.userId
        ? sql`e.user_id = ${input.userId}`
        : sql`(u.email = ${input.userEmail} OR e.thinkific_email = ${input.userEmail})`;

      const rows = await db.execute(sql`
        SELECT
          e.id AS enrollmentId,
          e.user_id AS userId,
          COALESCE(u.name, u.email, CONCAT('User #', e.user_id)) AS userName,
          COALESCE(u.email, e.thinkific_email, '') AS userEmail,
          u.isPremium AS isPremium,
          u.createdAt AS userCreatedAt,
          u.lastSignedIn AS lastSignedIn,
          e.course_id AS courseId,
          COALESCE(c.title, ti.thinkific_course_name, CONCAT('Course #', e.course_id)) AS courseTitle,
          COALESCE(c.type, 'course') AS courseType,
          c.slug AS courseSlug,
          e.progress_pct AS progressPct,
          e.enrolled_at AS enrolledAt,
          e.completed_at AS completedAt,
          e.enrollment_type AS enrollmentType
        FROM lms_enrollments e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN lms_thinkific_imports ti ON ti.lms_course_id = e.course_id
        LEFT JOIN lms_courses c ON c.id = COALESCE(ti.lms_course_id, e.course_id)
        WHERE ${userCond}
        ORDER BY e.enrolled_at DESC
      `);

      const enrollments = (rows as any[]).map(r => ({
        enrollmentId: Number(r.enrollmentId),
        courseId: Number(r.courseId),
        courseTitle: r.courseTitle as string,
        courseType: (r.courseType as string) ?? 'course',
        courseSlug: r.courseSlug as string | null,
        progressPct: Number(r.progressPct ?? 0),
        enrolledAt: r.enrolledAt as Date | null,
        completedAt: r.completedAt as Date | null,
        enrollmentType: r.enrollmentType as string | null,
      }));

      if (!enrollments.length) return null;

      const first = rows[0] as any;
      return {
        userId: first.userId ? Number(first.userId) : null,
        userName: first.userName as string,
        userEmail: first.userEmail as string,
        isPremium: Boolean(first.isPremium),
        userCreatedAt: first.userCreatedAt as Date | null,
        lastSignedIn: first.lastSignedIn as Date | null,
        enrollments,
        totalEnrollments: enrollments.length,
        completedCount: enrollments.filter(e => e.completedAt).length,
      };
    }),
});

