/**
 * SoundBytes™ Router
 * Premium micro-lesson video feature with category filtering and admin management.
 * DB table: soundbytes (lowercase), uses isActive boolean (not status enum).
 */
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { soundBytes, soundByteViews, soundByteDiscussions, soundByteDiscussionReplies } from "../../drizzle/schema";
import { users } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { storagePut } from "../storage";
import {
  publicProcedure,
  protectedProcedure,
  router,
} from "../_core/trpc";
import { TRPCError } from "@trpc/server";

/**
 * Returns a deterministic phantom view count for public display.
 * Each SoundByte gets a seeded number in the range [2351, 3092] derived from its ID.
 * Once real views exceed 3092, the real count is shown instead.
 */
function getPhantomViews(id: number, realViews: number): number {
  if (realViews > 3092) return realViews;
  const seed = ((id * 2654435761) >>> 0) % 742; // 0–741
  return 2351 + seed;
}

const CATEGORY_VALUES = [
  "abdominal", "pelvic_gyn", "obstetric_1st", "obstetric_2nd_3rd", "thyroid",
  "scrotum", "breast", "venous", "arterial", "abdominal_vascular",
  "extracranial_carotid", "intracranial_tcd", "msk", "pocus", "physics",
  "fetal_echo", "acs", "adult_echo", "pediatric_echo", "ecg", "general",
] as const;

export const soundBytesRouter = router({
  // ── Public / Member ──────────────────────────────────────────────────────────

  /** List active SoundBytes, optionally filtered by category */
  list: publicProcedure
    .input(
      z.object({
        category: z.enum(CATEGORY_VALUES).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: ReturnType<typeof eq>[] = [
        eq(soundBytes.isActive, true),
        eq(soundBytes.brand, ctx.brand as "aaus" | "iheartecho"),
      ];
      if (input.category) {
        conditions.push(eq(soundBytes.category, input.category));
      }
      const rows = await db
        .select({
          id: soundBytes.id,
          title: soundBytes.title,
          description: soundBytes.description,
          thumbnailUrl: soundBytes.thumbnailUrl,
          videoUrl: soundBytes.videoUrl,
          category: soundBytes.category,
          sortOrder: soundBytes.sortOrder,
          durationSeconds: soundBytes.durationSeconds,
          createdAt: soundBytes.createdAt,
        })
        .from(soundBytes)
        .where(and(...conditions))
        .orderBy(soundBytes.sortOrder, desc(soundBytes.createdAt));

      // Fetch real view counts for phantom calculation
      const viewCounts = await db
        .select({
          soundByteId: soundByteViews.soundByteId,
          total: sql<number>`COUNT(*)`.as("total"),
        })
        .from(soundByteViews)
        .groupBy(soundByteViews.soundByteId);
      const viewMap = new Map(viewCounts.map((v) => [v.soundByteId, v.total]));

      // Tag the FIRST item in each category as free-tier (1 free video per category).
      const seenCategories = new Set<string>();
      return rows.map((r) => {
        const isFirstInCategory = !seenCategories.has(r.category);
        seenCategories.add(r.category);
        return {
          ...r,
          phantomViews: getPhantomViews(r.id, viewMap.get(r.id) ?? 0),
          isFree: isFirstInCategory,
        };
      });
    }),

  /** Get a single active SoundByte by ID (includes description + videoUrl) */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const brand = ctx.brand as "aaus" | "iheartecho";
      const [row] = await db
        .select()
        .from(soundBytes)
        .where(and(eq(soundBytes.id, input.id), eq(soundBytes.isActive, true), eq(soundBytes.brand, brand)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "SoundByte not found" });

      // Determine if this item is in the free-tier (first 4 by sort order)
      const FREE_ITEM_COUNT = 4;
      const allActive = await db
        .select({ id: soundBytes.id })
        .from(soundBytes)
        .where(and(eq(soundBytes.isActive, true), eq(soundBytes.brand, brand)))
        .orderBy(soundBytes.sortOrder, desc(soundBytes.createdAt));
      const freeIds = new Set(allActive.slice(0, FREE_ITEM_COUNT).map((r) => r.id));
      const isFree = freeIds.has(row.id);

      // Compute real view count for phantom calculation
      const [viewRow] = await db
        .select({ total: sql<number>`COUNT(*)`.as("total") })
        .from(soundByteViews)
        .where(eq(soundByteViews.soundByteId, input.id));
      const realViews = viewRow?.total ?? 0;

      return { ...row, phantomViews: getPhantomViews(row.id, realViews), isFree };
    }),

  /** Record a view event for a SoundByte (premium users only) */
  recordView: protectedProcedure
    .input(
      z.object({
        soundByteId: z.number(),
        watchedSeconds: z.number().int().min(0).default(0),
        completed: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      // Upsert: one view record per user per SoundByte
      const [existing] = await db
        .select({ id: soundByteViews.id })
        .from(soundByteViews)
        .where(
          and(
            eq(soundByteViews.soundByteId, input.soundByteId),
            eq(soundByteViews.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(soundByteViews)
          .set({
            watchedSeconds: input.watchedSeconds,
            completed: input.completed,
          })
          .where(eq(soundByteViews.id, existing.id));
      } else {
        await db.insert(soundByteViews).values({
          soundByteId: input.soundByteId,
          userId: ctx.user.id,
          watchedSeconds: input.watchedSeconds,
          completed: input.completed,
        });
      }
      return { ok: true };
    }),

  // ── Admin ─────────────────────────────────────────────────────────────────────

  /** Admin: list all SoundBytes (all active states) with view analytics */
  adminList: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) return [];
    const brand = ctx.brand as "aaus" | "iheartecho";
    const rows = await db
      .select({
        id: soundBytes.id,
        title: soundBytes.title,
        description: soundBytes.description,
        category: soundBytes.category,
        isActive: soundBytes.isActive,
        sortOrder: soundBytes.sortOrder,
        durationSeconds: soundBytes.durationSeconds,
        videoUrl: soundBytes.videoUrl,
        thumbnailUrl: soundBytes.thumbnailUrl,
        createdAt: soundBytes.createdAt,
      })
      .from(soundBytes)
      .where(eq(soundBytes.brand, brand))
      .orderBy(soundBytes.sortOrder, desc(soundBytes.createdAt));

    // Attach true view counts from soundByteViews
    const viewCounts = await db
      .select({
        soundByteId: soundByteViews.soundByteId,
        totalViews: sql<number>`COUNT(*)`.as("totalViews"),
        completions: sql<number>`SUM(CASE WHEN ${soundByteViews.completed} = 1 THEN 1 ELSE 0 END)`.as("completions"),
      })
      .from(soundByteViews)
      .groupBy(soundByteViews.soundByteId);

    const viewMap = new Map(viewCounts.map((v) => [v.soundByteId, v]));

    return rows.map((r) => ({
      ...r,
      trueViews: viewMap.get(r.id)?.totalViews ?? 0,
      completions: viewMap.get(r.id)?.completions ?? 0,
    }));
  }),

  /** Admin: get a single SoundByte for editing */
  adminGetById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db
        .select()
        .from(soundBytes)
        .where(eq(soundBytes.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  /** Admin: create a new SoundByte */
  adminCreate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().default(""),
        videoUrl: z.string().min(1),
        thumbnailUrl: z.string().min(1).optional(),
        category: z.enum(CATEGORY_VALUES),
        sortOrder: z.number().int().default(0),
        durationSeconds: z.number().int().min(0).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const brand = ctx.brand as "aaus" | "iheartecho";
      const [result] = await db.insert(soundBytes).values({
        title: input.title,
        description: input.description || null,
        videoUrl: input.videoUrl,
        thumbnailUrl: input.thumbnailUrl ?? null,
        category: input.category,
        sortOrder: input.sortOrder,
        durationSeconds: input.durationSeconds ?? null,
        isActive: input.isActive,
        brand,
      });
      return { id: (result as any).insertId as number };
    }),

  /** Admin: update an existing SoundByte */
  adminUpdate: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        videoUrl: z.string().min(1).optional(),
        thumbnailUrl: z.string().min(1).nullable().optional(),
        category: z.enum(CATEGORY_VALUES).optional(),
        sortOrder: z.number().int().optional(),
        durationSeconds: z.number().int().min(0).nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...fields } = input;
      await db.update(soundBytes).set(fields as Record<string, unknown>).where(eq(soundBytes.id, id));
      return { ok: true };
    }),

  /** Admin: delete a SoundByte */
  adminDelete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(soundByteViews).where(eq(soundByteViews.soundByteId, input.id));
      await db.delete(soundBytes).where(eq(soundBytes.id, input.id));
      return { ok: true };
    }),

  /** Admin: get per-viewer analytics for a specific SoundByte */
  adminViewerStats: protectedProcedure
    .input(z.object({ soundByteId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: soundByteViews.id,
          userId: soundByteViews.userId,
          watchedSeconds: soundByteViews.watchedSeconds,
          completed: soundByteViews.completed,
          createdAt: soundByteViews.createdAt,
          updatedAt: soundByteViews.updatedAt,
        })
        .from(soundByteViews)
        .where(eq(soundByteViews.soundByteId, input.soundByteId))
        .orderBy(desc(soundByteViews.updatedAt));
    }),

  // ── Discussions ───────────────────────────────────────────────────────────────

  /** Submit a discussion comment (premium users only — goes to pending queue) */
  submitDiscussion: protectedProcedure
    .input(
      z.object({
        soundByteId: z.number(),
        body: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      await db.insert(soundByteDiscussions).values({
        soundByteId: input.soundByteId,
        userId: ctx.user.id,
        body: input.body,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      // Notify admin of new discussion awaiting approval
      try {
        const [sb] = await db
          .select({ title: soundBytes.title })
          .from(soundBytes)
          .where(eq(soundBytes.id, input.soundByteId))
          .limit(1);
        const userName = ctx.user.displayName || ctx.user.name || "A member";
        await notifyOwner({
          title: "New SoundBytes™ Discussion Awaiting Approval",
          content: `${userName} posted a comment on "${sb?.title ?? "a SoundByte"}" and it is waiting for your review in the admin approval queue.`,
        });
      } catch (_) {
        // Non-critical — don't fail the submission if notification fails
      }
      return { ok: true };
    }),

  /** List approved discussions for a SoundByte (public — premium gate enforced on client) */
  listDiscussions: publicProcedure
    .input(z.object({ soundByteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: soundByteDiscussions.id,
          body: soundByteDiscussions.body,
          createdAt: soundByteDiscussions.createdAt,
          userId: soundByteDiscussions.userId,
          userName: users.name,
          userDisplayName: users.displayName,
          userCredentials: users.credentials,
          userAvatarUrl: users.avatarUrl,
        })
        .from(soundByteDiscussions)
        .leftJoin(users, eq(soundByteDiscussions.userId, users.id))
        .where(
          and(
            eq(soundByteDiscussions.soundByteId, input.soundByteId),
            eq(soundByteDiscussions.status, "approved")
          )
        )
        .orderBy(desc(soundByteDiscussions.createdAt));
      return rows;
    }),

  /** Admin: list all pending discussions across all SoundBytes */
  adminListPendingDiscussions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: soundByteDiscussions.id,
        soundByteId: soundByteDiscussions.soundByteId,
        body: soundByteDiscussions.body,
        status: soundByteDiscussions.status,
        createdAt: soundByteDiscussions.createdAt,
        userId: soundByteDiscussions.userId,
        userName: users.name,
        userDisplayName: users.displayName,
        userCredentials: users.credentials,
        soundByteTitle: soundBytes.title,
      })
      .from(soundByteDiscussions)
      .leftJoin(users, eq(soundByteDiscussions.userId, users.id))
      .leftJoin(soundBytes, eq(soundByteDiscussions.soundByteId, soundBytes.id))
      .where(eq(soundByteDiscussions.status, "pending"))
      .orderBy(desc(soundByteDiscussions.createdAt));
  }),

  /** Admin: list ALL discussions (all statuses) for the full moderation queue */
  adminListAllDiscussions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: soundByteDiscussions.id,
        soundByteId: soundByteDiscussions.soundByteId,
        body: soundByteDiscussions.body,
        status: soundByteDiscussions.status,
        createdAt: soundByteDiscussions.createdAt,
        userId: soundByteDiscussions.userId,
        userName: users.name,
        userDisplayName: users.displayName,
        userCredentials: users.credentials,
        soundByteTitle: soundBytes.title,
      })
      .from(soundByteDiscussions)
      .leftJoin(users, eq(soundByteDiscussions.userId, users.id))
      .leftJoin(soundBytes, eq(soundByteDiscussions.soundByteId, soundBytes.id))
      .orderBy(desc(soundByteDiscussions.createdAt));
  }),

  /** Admin: approve a discussion */
  adminApproveDiscussion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(soundByteDiscussions)
        .set({ status: "approved", updatedAt: Date.now() })
        .where(eq(soundByteDiscussions.id, input.id));
      return { ok: true };
    }),

  /** Admin: reject a discussion */
  adminRejectDiscussion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(soundByteDiscussions)
        .set({ status: "rejected", updatedAt: Date.now() })
        .where(eq(soundByteDiscussions.id, input.id));
      return { ok: true };
    }),

  /** Admin: permanently delete a discussion */
  adminDeleteDiscussion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(soundByteDiscussions).where(eq(soundByteDiscussions.id, input.id));
      return { ok: true };
    }),

  // ── Discussion Replies ────────────────────────────────────────────────────────

  /** List all replies for an approved discussion */
  listReplies: publicProcedure
    .input(z.object({ discussionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(soundByteDiscussionReplies)
        .where(eq(soundByteDiscussionReplies.discussionId, input.discussionId))
        .orderBy(soundByteDiscussionReplies.createdAt);
    }),

  /** Admin: post a reply to an approved discussion */
  adminSubmitReply: protectedProcedure
    .input(
      z.object({
        discussionId: z.number(),
        body: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const replyId = crypto.randomUUID();
      const userName = ctx.user.displayName || ctx.user.name || "Admin";
      await db.insert(soundByteDiscussionReplies).values({
        id: replyId,
        discussionId: input.discussionId,
        userId: ctx.user.id,
        userName,
        body: input.body,
        createdAt: Date.now(),
      });
      return { ok: true, id: replyId };
    }),

  /** Admin: delete a reply */
  adminDeleteReply: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(soundByteDiscussionReplies)
        .where(eq(soundByteDiscussionReplies.id, input.id));
      return { ok: true };
    }),

  // ── Media Upload ─────────────────────────────────────────────────────────────

  /**
   * Admin: upload a video or thumbnail file for a SoundByte.
   * Accepts base64-encoded file data, uploads to S3, returns the public URL.
   * fileType: "video" | "thumbnail"
   */
  adminUploadMedia: protectedProcedure
    .input(
      z.object({
        base64Data: z.string().min(1),
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
        fileType: z.enum(["video", "thumbnail"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const MIME_TO_EXT: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/ogg": "ogv",
        "video/quicktime": "mov",
        "video/x-ms-wmv": "wmv",
        "video/x-msvideo": "avi",
        "video/avi": "avi",
      };

      const ext = MIME_TO_EXT[input.mimeType] ?? input.mimeType.split("/")[1] ?? "bin";
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `soundbytes/${input.fileType}/${safeName}-${randomSuffix}.${ext}`;

      const buffer = Buffer.from(input.base64Data, "base64");
      const { url } = await storagePut(key, buffer, input.mimeType);

      return { url, key };
    }),

  /** Admin: count pending discussions (for badge) */
  adminPendingDiscussionCount: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return { count: 0 };
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(soundByteDiscussions)
      .where(eq(soundByteDiscussions.status, "pending"));
    return { count: row?.count ?? 0 };
  }),
});
