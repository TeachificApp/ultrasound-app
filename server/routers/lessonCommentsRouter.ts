/**
 * lessonCommentsRouter.ts
 * Per-lesson commenting system for LMS courses with reply threading.
 *
 * Admin controls:
 *   - adminList: paginated list of all comments across all lessons (with optional search)
 *   - delete: soft-delete a comment (hidden from students)
 *   - banUser: ban or unban a user from commenting (silent — no notification sent)
 *
 * Student controls:
 *   - list: paginated list of visible top-level comments for a lesson, each with nested replies
 *   - add: post a new comment or reply (checks commentsEnabled + not commentBanned)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { lessonComments, lmsLessons, lmsCourses, users } from "../../drizzle/schema";
import { eq, and, isNull, desc, asc, like, or, inArray, sql } from "drizzle-orm";

export const lessonCommentsRouter = router({
  // ─── Student: list visible comments for a lesson (top-level + replies) ────────
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

      // Fetch all non-deleted comments for this lesson (top-level and replies)
      const allRows = await db
        .select({
          id: lessonComments.id,
          lessonId: lessonComments.lessonId,
          userId: lessonComments.userId,
          content: lessonComments.content,
          parentId: lessonComments.parentId,
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
        .orderBy(asc(lessonComments.createdAt));

      // Separate top-level and replies
      const topLevel = allRows.filter(r => !r.parentId);
      const replies = allRows.filter(r => !!r.parentId);

      // Paginate top-level comments
      const paginated = topLevel.slice(0, input.limit + 1);
      const hasMore = paginated.length > input.limit;
      const pageComments = paginated.slice(0, input.limit);

      // Attach replies to their parent
      const comments = pageComments.map(c => ({
        ...c,
        isOwn: c.userId === ctx.user.id,
        replies: replies
          .filter(r => r.parentId === c.id)
          .map(r => ({ ...r, isOwn: r.userId === ctx.user.id })),
      }));

      return { comments, hasMore };
    }),

  // ─── Student: add a comment or reply ─────────────────────────────────────────
  add: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      content: z.string().min(1).max(2000).trim(),
      parentId: z.number().int().positive().optional(), // omit for top-level
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

      // If replying, verify parent exists and belongs to the same lesson
      if (input.parentId) {
        const [parent] = await db.select({ id: lessonComments.id, parentId: lessonComments.parentId })
          .from(lessonComments)
          .where(and(eq(lessonComments.id, input.parentId), eq(lessonComments.lessonId, input.lessonId), isNull(lessonComments.deletedAt)))
          .limit(1);
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent comment not found" });
        // Prevent nested replies (only 1 level deep)
        if (parent.parentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reply to a reply" });
      }

      const result = await db.insert(lessonComments).values({
        lessonId: input.lessonId,
        userId: ctx.user.id,
        content: input.content,
        parentId: input.parentId ?? null,
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
        isNull(lessonComments.parentId), // top-level only
        searchFilter,
      );

      const rows = await db
        .select({
          id: lessonComments.id,
          lessonId: lessonComments.lessonId,
          userId: lessonComments.userId,
          content: lessonComments.content,
          parentId: lessonComments.parentId,
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
      const pageRows = rows.slice(0, input.limit);

      // Fetch reply counts for returned top-level comments
      const parentIds = pageRows.map(r => r.id);
      const replyCounts: Record<number, number> = {};
      if (parentIds.length > 0) {
        const countRows = await db
          .select({
            parentId: lessonComments.parentId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(lessonComments)
          .where(and(inArray(lessonComments.parentId, parentIds), isNull(lessonComments.deletedAt)))
          .groupBy(lessonComments.parentId);
        for (const row of countRows) {
          if (row.parentId != null) replyCounts[row.parentId] = Number(row.count);
        }
      }

      return {
        comments: pageRows.map(r => ({ ...r, replyCount: replyCounts[r.id] ?? 0 })),
        hasMore,
      };
    }),

  // ─── Admin: list replies for a specific top-level comment ───────────────────────
  adminListReplies: protectedProcedure
    .input(z.object({ parentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select({
          id: lessonComments.id,
          userId: lessonComments.userId,
          content: lessonComments.content,
          parentId: lessonComments.parentId,
          createdAt: lessonComments.createdAt,
          authorName: users.name,
          authorDisplayName: users.displayName,
          authorAvatarUrl: users.avatarUrl,
          authorCommentBanned: users.commentBanned,
        })
        .from(lessonComments)
        .innerJoin(users, eq(lessonComments.userId, users.id))
        .where(
          and(
            eq(lessonComments.parentId, input.parentId),
            isNull(lessonComments.deletedAt),
          )
        )
        .orderBy(asc(lessonComments.createdAt));

      return { replies: rows };
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
