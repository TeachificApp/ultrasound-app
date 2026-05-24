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
  lmsVideoEvents,
  lmsQuizAttempts,
  lmsLessonProgress,
  lmsEnrollments,
  lmsCourses,
  lmsLessons,
  digitalDownloadEvents,
  digitalProducts,
  digitalPurchases,
  users,
} from "../../drizzle/schema";

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
      await db.insert(userPageViewEvents).values({
        userId,
        sessionId: input.sessionId ?? null,
        path: input.path,
        referrer: input.referrer ?? null,
        durationMs: input.durationMs ?? null,
      });
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
      const rows = await db.execute(sql`
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.created_at AS joinedAt,
          u.lastSignedIn AS lastLogin,
          CASE WHEN u.lastSignedIn IS NOT NULL THEN 1 ELSE 0 END AS loginCount,
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
          input.sortBy === "lastLogin" ? sql`lastLogin DESC` :
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
});
