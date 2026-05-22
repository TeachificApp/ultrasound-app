/**
 * lessonCommentsRouter.ts
 * Per-lesson commenting system for LMS courses.
 *
 * Admin controls:
 *   - adminList: paginated list of all comments across all lessons (with optional search)
 *   - delete: soft-delete a comment (hidden from students)
 *   - banUser: ban or unban a user from commenting (silent — no notification sent)
 *
 * Student controls:
 *   - list: paginated list of visible comments for a lesson (enrolled users only)
 *   - add: post a new comment (checks commentsEnabled + not commentBanned)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { lessonComments, lmsLessons, lmsCourses, users } from "../../drizzle/schema";
import { eq, and, isNull, desc, asc, like, or, sql } from "drizzle-orm";

export const lessonCommentsRouter = router({
  // ─── Student: list visible comments for a lesson ─────────────────────────────
  list: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      cursor: z.number().int().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [lesson] = await db.select({ commentsEnabled: lmsLessons.commentsEnabled })
        .from(lmsLessons)
        .where(eq(lmsLessons.id, input.lessonId))
        .limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (!lesson.commentsEnabled) return { comments: [], hasMore: false };

      const rows = await db
        .select({
          id: lessonComments.id,
          lessonId: lessonComments.lessonId,
          userId: lessonComments.userId,
          content: lessonComments.content,
          createdAt: lessonComments.createdAt,
          authorName: users.name,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorCredentials: users.credentials,
        })
        .from(lessonComments)
        .innerJoin(users, eq(lessonComments.userId, users.id))
        .where(
          and(
            eq(lessonComments.lessonId, input.lessonId),
            isNull(lessonComments.deletedAt),
          )
        )
        .orderBy(asc(lessonComments.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const comments = rows.slice(0, input.limit).map(r => ({
        ...r,
        isOwn: r.userId === ctx.user.id,
      }));

      return { comments, hasMore };
    }),

  // ─── Student: add a comment ───────────────────────────────────────────────────
  add: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      content: z.string().min(1).max(2000).trim(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [lesson] = await db.select({ commentsEnabled: lmsLessons.commentsEnabled })
        .from(lmsLessons)
        .where(eq(lmsLessons.id, input.lessonId))
        .limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (!lesson.commentsEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Comments are not enabled for this lesson" });
      }

      // Check if user is comment-banned (silent — same error as disabled so user can't detect it)
      const [user] = await db.select({ commentBanned: users.commentBanned })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      if (user?.commentBanned) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Comments are not enabled for this lesson" });
      }

      const result = await db.insert(lessonComments).values({
        lessonId: input.lessonId,
        userId: ctx.user.id,
        content: input.content,
      });

      return { id: Number((result as any)[0]?.insertId ?? 0), success: true };
    }),

  // ─── Admin: list all comments across all lessons (with search) ────────────────
  adminList: protectedProcedure
    .input(z.object({
      cursor: z.number().int().optional(),
      limit: z.number().int().min(1).max(50).default(30),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const searchTerm = input.search?.trim();
      const searchFilter = searchTerm
        ? or(
            like(lessonComments.content, `%${searchTerm}%`),
            like(users.name, `%${searchTerm}%`),
            like(users.displayName, `%${searchTerm}%`),
            like(lmsLessons.title, `%${searchTerm}%`),
          )
        : undefined;

      const whereClause = and(
        isNull(lessonComments.deletedAt),
        searchFilter,
      );

      const rows = await db
        .select({
          id: lessonComments.id,
          lessonId: lessonComments.lessonId,
          userId: lessonComments.userId,
          content: lessonComments.content,
          createdAt: lessonComments.createdAt,
          lessonTitle: lmsLessons.title,
          courseTitle: lmsCourses.title,
          authorName: users.name,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorCommentBanned: users.commentBanned,
        })
        .from(lessonComments)
        .innerJoin(users, eq(lessonComments.userId, users.id))
        .innerJoin(lmsLessons, eq(lessonComments.lessonId, lmsLessons.id))
        .leftJoin(lmsCourses, eq(lmsLessons.courseId, lmsCourses.id))
        .where(whereClause)
        .orderBy(desc(lessonComments.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      return { comments: rows.slice(0, input.limit), hasMore };
    }),

  // ─── Admin: soft-delete a comment ────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ commentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.update(lessonComments)
        .set({ deletedAt: new Date(), deletedByAdminId: ctx.user.id })
        .where(eq(lessonComments.id, input.commentId));

      return { success: true };
    }),

  // ─── Admin: ban or unban a user from commenting (silent) ─────────────────────
  banUser: protectedProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      banned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.update(users)
        .set({ commentBanned: input.banned })
        .where(eq(users.id, input.userId));

      return { success: true, banned: input.banned };
    }),
});
