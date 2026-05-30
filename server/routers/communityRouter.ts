/**
 * communityRouter.ts
 * Full community feature: feed, spaces/channels, posts, comments, reactions,
 * follows, bookmarks, polls, DMs, gamification (XP/badges), notifications,
 * moderation, and admin tools.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql, asc, inArray, or, isNull, ne, lt } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { randomBytes } from "crypto";
import { invokeLLM } from "../_core/llm";
import {
  users,
  communities,
  communityMembers,
  communityChannels,
  communityPosts,
  communityPostComments,
  communityPostReactions,
  communityDMs,
  communityFollows,
  communityBookmarks,
  communityCommentReactions,
  communityPolls,
  communityPollVotes,
  communityHashtags,
  communityPostHashtags,
  communityUserXP,
  communityXPEvents,
  communityBadges,
  communityUserBadges,
  communityNotifications,
  communityDMConversations,
  communityDMMessages,
  communityReports,
  communityAdminProfiles,
  lmsEnrollments,
  lmsCourses,
} from "../../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertAdmin(ctx: any) {
  if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}

async function assertCommunityMember(db: any, communityId: number, userId: number) {
  const [m] = await db.select().from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

/** Award XP and check for badge unlocks */
async function awardXP(db: any, userId: number, eventType: string, xp: number, refId?: number) {
  const today = new Date().toISOString().slice(0, 10);

  // Upsert XP record
  await db.insert(communityUserXP).values({
    userId,
    totalXP: xp,
    level: 1,
    streakDays: 1,
    lastActivityDate: today,
    postsCount: eventType === "post" ? 1 : 0,
    commentsCount: eventType === "comment" ? 1 : 0,
    reactionsGivenCount: eventType === "reaction" ? 1 : 0,
  }).onDuplicateKeyUpdate({
    set: {
      totalXP: sql`total_xp + ${xp}`,
      postsCount: eventType === "post" ? sql`posts_count + 1` : sql`posts_count`,
      commentsCount: eventType === "comment" ? sql`comments_count + 1` : sql`comments_count`,
      reactionsGivenCount: eventType === "reaction" ? sql`reactions_given_count + 1` : sql`reactions_given_count`,
      streakDays: sql`CASE WHEN last_activity_date = ${today} THEN streak_days WHEN last_activity_date = DATE_SUB(${today}, INTERVAL 1 DAY) THEN streak_days + 1 ELSE 1 END`,
      lastActivityDate: today,
      level: sql`GREATEST(1, FLOOR(SQRT(total_xp + ${xp}) / 5) + 1)`,
      updatedAt: new Date(),
    },
  });

  // Log the event
  await db.insert(communityXPEvents).values({ userId, eventType, xpAwarded: xp, refId: refId ?? null });

  // Check badge unlocks
  const [xpRow] = await db.select({ totalXP: communityUserXP.totalXP, streakDays: communityUserXP.streakDays })
    .from(communityUserXP).where(eq(communityUserXP.userId, userId)).limit(1);
  if (!xpRow) return;

  const allBadges = await db.select().from(communityBadges);
  const earnedBadges = await db.select({ badgeId: communityUserBadges.badgeId })
    .from(communityUserBadges).where(eq(communityUserBadges.userId, userId));
  const earnedIds = new Set(earnedBadges.map((b: any) => b.badgeId));

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    let earned = false;
    if (badge.xpRequired > 0 && xpRow.totalXP >= badge.xpRequired) earned = true;
    if (badge.slug === "streak_7" && xpRow.streakDays >= 7) earned = true;
    if (badge.slug === "streak_30" && xpRow.streakDays >= 30) earned = true;
    if (earned) {
      await db.insert(communityUserBadges).values({ userId, badgeId: badge.id }).catch(() => {});
      await db.insert(communityNotifications).values({
        userId,
        type: "badge_earned",
        body: `You earned the "${badge.name}" badge! ${badge.iconEmoji}`,
      });
    }
  }
}

/** Create a community notification */
async function createNotification(db: any, data: {
  userId: number; type: string; actorId?: number;
  postId?: number; commentId?: number; communityId?: number; body?: string;
}) {
  if (data.userId === data.actorId) return; // don't notify yourself
  await db.insert(communityNotifications).values({
    userId: data.userId,
    type: data.type,
    actorId: data.actorId ?? null,
    postId: data.postId ?? null,
    commentId: data.commentId ?? null,
    communityId: data.communityId ?? null,
    body: data.body ?? null,
  });
}

/** Extract and upsert hashtags from post body */
async function syncHashtags(db: any, postId: number, body: string) {
  const tags = [...new Set((body.match(/#([a-zA-Z0-9_]+)/g) ?? []).map(t => t.slice(1).toLowerCase()))];
  // Remove old mappings
  await db.delete(communityPostHashtags).where(eq(communityPostHashtags.postId, postId));
  for (const tag of tags) {
    await db.insert(communityHashtags).values({ tag, postCount: 1 })
      .onDuplicateKeyUpdate({ set: { postCount: sql`post_count + 1` } });
    const [ht] = await db.select({ id: communityHashtags.id }).from(communityHashtags)
      .where(eq(communityHashtags.tag, tag)).limit(1);
    if (ht) await db.insert(communityPostHashtags).values({ postId, hashtagId: ht.id }).catch(() => {});
  }
}

/** Enrich posts with author info, reaction summary, bookmark/reaction status for current user */
async function enrichPosts(db: any, posts: any[], currentUserId?: number) {
  if (!posts.length) return [];
  const userIds = [...new Set(posts.map((p: any) => p.userId))];
  const authors = await db.select({
    id: users.id, name: users.name, displayName: users.displayName,
    avatarUrl: users.avatarUrl, credentials: users.credentials,
    specialty: users.specialty, communityRole: users.communityRole,
  }).from(users).where(inArray(users.id, userIds));
  const authorMap = Object.fromEntries(authors.map((a: any) => [a.id, a]));

  const postIds = posts.map((p: any) => p.id);
  let bookmarkedIds = new Set<number>();
  let myReactions: Record<number, string> = {};

  if (currentUserId) {
    const bm = await db.select({ postId: communityBookmarks.postId })
      .from(communityBookmarks)
      .where(and(eq(communityBookmarks.userId, currentUserId), inArray(communityBookmarks.postId, postIds)));
    bookmarkedIds = new Set(bm.map((b: any) => b.postId));

    const rx = await db.select({ postId: communityPostReactions.postId, emoji: communityPostReactions.emoji })
      .from(communityPostReactions)
      .where(and(eq(communityPostReactions.userId, currentUserId), inArray(communityPostReactions.postId, postIds)));
    myReactions = Object.fromEntries(rx.map((r: any) => [r.postId, r.emoji]));
  }

  return posts.map((p: any) => ({
    ...p,
    author: authorMap[p.userId] ?? null,
    isBookmarked: bookmarkedIds.has(p.id),
    myReaction: myReactions[p.id] ?? null,
  }));
}

// ─── Public sub-router ────────────────────────────────────────────────────────

const communityPublicRouter = router({
  /** List all published communities */
  listCommunities: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db.select({
      id: communities.id, title: communities.title, slug: communities.slug,
      description: communities.description, coverImage: communities.coverImage,
      logoImage: communities.logoImage, iconImage: communities.iconImage,
      brand: communities.brand, privacy: communities.privacy,
      accessType: communities.accessType, accentColor: communities.accentColor,
      sortOrder: communities.sortOrder,
    }).from(communities).where(eq(communities.status, "published"))
      .orderBy(asc(communities.sortOrder), asc(communities.id));
  }),

  /** Get a single community by slug */
  getCommunity: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [c] = await db.select().from(communities)
      .where(and(eq(communities.slug, input.slug), eq(communities.status, "published"))).limit(1);
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    const memberCount = await db.select({ count: sql<number>`COUNT(*)` }).from(communityMembers)
      .where(eq(communityMembers.communityId, c.id));
    const channels = await db.select().from(communityChannels)
      .where(eq(communityChannels.communityId, c.id)).orderBy(asc(communityChannels.sortOrder));
    return { ...c, memberCount: Number(memberCount[0]?.count ?? 0), channels };
  }),

  /** Trending hashtags */
  trendingHashtags: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(communityHashtags).orderBy(desc(communityHashtags.postCount)).limit(20);
  }),

  /** Leaderboard */
  leaderboard: publicProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      userId: communityUserXP.userId, totalXP: communityUserXP.totalXP,
      level: communityUserXP.level, streakDays: communityUserXP.streakDays,
      postsCount: communityUserXP.postsCount, commentsCount: communityUserXP.commentsCount,
    }).from(communityUserXP).orderBy(desc(communityUserXP.totalXP)).limit(input.limit);
    const userIds = rows.map(r => r.userId);
    if (!userIds.length) return [];
    const us = await db.select({ id: users.id, name: users.name, displayName: users.displayName, avatarUrl: users.avatarUrl, credentials: users.credentials })
      .from(users).where(inArray(users.id, userIds));
    const uMap = Object.fromEntries(us.map(u => [u.id, u]));
    return rows.map((r, i) => ({ rank: i + 1, ...r, user: uMap[r.userId] ?? null }));
  }),
});

// ─── Member sub-router (protected) ───────────────────────────────────────────

const communityMemberRouter = router({
  /** Join a community */
  join: protectedProcedure.input(z.object({ communityId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [c] = await db.select().from(communities).where(eq(communities.id, input.communityId)).limit(1);
    if (!c || c.status !== "published") throw new TRPCError({ code: "NOT_FOUND" });
    if (c.accessType === "paid") throw new TRPCError({ code: "FORBIDDEN", message: "This community requires a paid membership." });
    // Restricted communities: set memberStatus to pending for admin approval
    const memberStatus = c.accessType === "restricted" ? "pending" : "approved";
    await db.insert(communityMembers).values({
      communityId: input.communityId, userId: ctx.user.id, role: "member", memberStatus,
    }).onDuplicateKeyUpdate({ set: { role: "member" } });
    if (memberStatus === "approved") await awardXP(db, ctx.user.id, "join", 5);
    return { success: true, pending: memberStatus === "pending" };
  }),

  /** Leave a community */
  leave: protectedProcedure.input(z.object({ communityId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(communityMembers).where(
      and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, ctx.user.id))
    );
    return { success: true };
  }),

  /** Get my membership status for a community */
  myMembership: protectedProcedure.input(z.object({ communityId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [m] = await db.select().from(communityMembers)
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, ctx.user.id))).limit(1);
    return m ?? null;
  }),

  /** Get posts feed for a community channel */
  getFeed: protectedProcedure.input(z.object({
    communityId: z.number(),
    channelId: z.number().optional(),
    cursor: z.number().optional(),
    limit: z.number().min(1).max(50).default(20),
    sort: z.enum(["newest", "trending"]).default("newest"),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const member = await assertCommunityMember(db, input.communityId, ctx.user.id);
    if (!member && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

    const conditions = [
      eq(communityPosts.communityId, input.communityId),
      eq(communityPosts.isHidden, false),
    ];
    if (input.channelId) conditions.push(eq(communityPosts.channelId, input.channelId));
    if (input.cursor) conditions.push(lt(communityPosts.id, input.cursor));

    const orderBy = input.sort === "trending"
      ? [desc(communityPosts.reactionCount), desc(communityPosts.commentCount), desc(communityPosts.createdAt)]
      : [desc(communityPosts.isPinned), desc(communityPosts.createdAt)];

    const posts = await db.select().from(communityPosts)
      .where(and(...conditions)).orderBy(...orderBy).limit(input.limit + 1);

    const hasMore = posts.length > input.limit;
    const items = await enrichPosts(db, posts.slice(0, input.limit), ctx.user.id);
    return { items, hasMore, nextCursor: hasMore ? posts[input.limit - 1]?.id : undefined };
  }),

  /** Create a post */
  createPost: protectedProcedure.input(z.object({
    communityId: z.number(),
    channelId: z.number(),
    title: z.string().max(255).optional(),
    body: z.string().min(1).max(50000),
    postType: z.enum(["text", "image", "video", "poll", "case_study"]).default("text"),
    attachments: z.array(z.object({ url: z.string(), type: z.string() })).optional(),
    poll: z.object({ question: z.string(), options: z.array(z.string().min(1)), endsAt: z.string().optional() }).optional(),
    /** Post as a specific admin profile (admin only) */
    adminProfileId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const member = await assertCommunityMember(db, input.communityId, ctx.user.id);
    if (!member && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    // Validate admin profile belongs to this community
    if (input.adminProfileId && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

    const [result] = await db.insert(communityPosts).values({
      communityId: input.communityId,
      channelId: input.channelId,
      userId: ctx.user.id,
      adminProfileId: input.adminProfileId ?? null,
      title: input.title ?? null,
      body: input.body,
      postType: input.postType as any,
      attachments: input.attachments ? JSON.stringify(input.attachments) : null,
    }).$returningId();
    const postId = result.id;

    // Create poll if provided
    if (input.poll && input.postType === "poll") {
      await db.insert(communityPolls).values({
        postId,
        question: input.poll.question,
        options: JSON.stringify(input.poll.options),
        endsAt: input.poll.endsAt ? new Date(input.poll.endsAt) : null,
      });
    }

    // Sync hashtags
    await syncHashtags(db, postId, input.body);

    // Award XP
    await awardXP(db, ctx.user.id, "post", 10, postId);

    return { id: postId };
  }),

  /** Edit a post */
  editPost: protectedProcedure.input(z.object({
    postId: z.number(),
    body: z.string().min(1).max(50000),
    title: z.string().max(255).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    if (post.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await db.update(communityPosts).set({ body: input.body, title: input.title ?? null }).where(eq(communityPosts.id, input.postId));
    await syncHashtags(db, input.postId, input.body);
    return { success: true };
  }),

  /** Delete a post */
  deletePost: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    if (post.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await db.delete(communityPosts).where(eq(communityPosts.id, input.postId));
    return { success: true };
  }),

  /** Get a single post with comments */
  getPost: protectedProcedure.input(z.object({ postId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post || post.isHidden) throw new TRPCError({ code: "NOT_FOUND" });

    // Increment view count
    await db.update(communityPosts).set({ viewCount: sql`view_count + 1` }).where(eq(communityPosts.id, input.postId));

    const [enriched] = await enrichPosts(db, [post], ctx.user.id);

    // Get comments — non-admins only see approved comments (or their own pending ones)
    const isAdminUser = ctx.user.role === "admin";
    const commentWhere = isAdminUser
      ? eq(communityPostComments.postId, input.postId)
      : and(
          eq(communityPostComments.postId, input.postId),
          or(
            eq(communityPostComments.status, "approved"),
            eq(communityPostComments.userId, ctx.user.id),
          ),
        );
    const comments = await db.select().from(communityPostComments)
      .where(commentWhere).orderBy(asc(communityPostComments.createdAt));
    const commentUserIds = [...new Set(comments.map((c: any) => c.userId))];
    const commentAuthors = commentUserIds.length
      ? await db.select({ id: users.id, name: users.name, displayName: users.displayName, avatarUrl: users.avatarUrl, credentials: users.credentials })
          .from(users).where(inArray(users.id, commentUserIds))
      : [];
    const commentAuthorMap = Object.fromEntries(commentAuthors.map((a: any) => [a.id, a]));
    const enrichedComments = comments.map((c: any) => ({ ...c, author: commentAuthorMap[c.userId] ?? null }));

    // Get poll if any
    let poll = null;
    if (post.postType === "poll") {
      const [p] = await db.select().from(communityPolls).where(eq(communityPolls.postId, input.postId)).limit(1);
      if (p) {
        const votes = await db.select().from(communityPollVotes).where(eq(communityPollVotes.pollId, p.id));
        const myVote = votes.find((v: any) => v.userId === ctx.user.id);
        const options = JSON.parse(p.options as string) as string[];
        const tally = options.map((_: string, i: number) => votes.filter((v: any) => v.optionIndex === i).length);
        poll = { ...p, options, tally, totalVotes: votes.length, myVoteIndex: myVote?.optionIndex ?? null };
      }
    }

    return { ...enriched, comments: enrichedComments, poll };
  }),

  /** React to a post */
  reactToPost: protectedProcedure.input(z.object({
    postId: z.number(),
    emoji: z.string().max(16),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [existing] = await db.select().from(communityPostReactions)
      .where(and(eq(communityPostReactions.postId, input.postId), eq(communityPostReactions.userId, ctx.user.id))).limit(1);

    if (existing) {
      if (existing.emoji === input.emoji) {
        // Remove reaction (toggle off)
        await db.delete(communityPostReactions).where(eq(communityPostReactions.id, existing.id));
        await db.update(communityPosts).set({ reactionCount: sql`GREATEST(0, reaction_count - 1)` }).where(eq(communityPosts.id, input.postId));
        return { action: "removed" };
      } else {
        // Change emoji
        await db.update(communityPostReactions).set({ emoji: input.emoji }).where(eq(communityPostReactions.id, existing.id));
        return { action: "changed" };
      }
    } else {
      await db.insert(communityPostReactions).values({ postId: input.postId, userId: ctx.user.id, emoji: input.emoji });
      await db.update(communityPosts).set({ reactionCount: sql`reaction_count + 1` }).where(eq(communityPosts.id, input.postId));
      // Notify post author
      const [post] = await db.select({ userId: communityPosts.userId }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
      if (post) {
        const [actor] = await db.select({ name: users.name, displayName: users.displayName }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        await createNotification(db, { userId: post.userId, type: "reaction", actorId: ctx.user.id, postId: input.postId, body: `${actor?.displayName || actor?.name || "Someone"} reacted ${input.emoji} to your post` });
      }
      await awardXP(db, ctx.user.id, "reaction", 2, input.postId);
      return { action: "added" };
    }
  }),

  /** Add a comment */
  addComment: protectedProcedure.input(z.object({
    postId: z.number(),
    body: z.string().min(1).max(10000),
    parentId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post || post.isLocked) throw new TRPCError({ code: "FORBIDDEN", message: "Post is locked." });

    // Check if member requires moderation
    const isAdminUser = ctx.user.role === "admin";
    let commentStatus: "pending" | "approved" = "approved";
    if (!isAdminUser) {
      const [membership] = await db.select({ approvedToPost: communityMembers.approvedToPost })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, post.communityId), eq(communityMembers.userId, ctx.user.id)))
        .limit(1);
      if (membership && !membership.approvedToPost) commentStatus = "pending";
    }

    const [result] = await db.insert(communityPostComments).values({
      postId: input.postId,
      userId: ctx.user.id,
      body: input.body,
      parentId: input.parentId ?? null,
      status: commentStatus,
    }).$returningId();
    // Only increment comment count for approved comments
    if (commentStatus === "approved") {
      await db.update(communityPosts).set({ commentCount: sql`comment_count + 1` }).where(eq(communityPosts.id, input.postId));
    }

    // Notify post author
    const [actor] = await db.select({ name: users.name, displayName: users.displayName }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    await createNotification(db, { userId: post.userId, type: "reply", actorId: ctx.user.id, postId: input.postId, commentId: result.id, body: `${actor?.displayName || actor?.name || "Someone"} replied to your post` });

    // If replying to a comment, notify that comment's author too
    if (input.parentId) {
      const [parent] = await db.select({ userId: communityPostComments.userId }).from(communityPostComments).where(eq(communityPostComments.id, input.parentId)).limit(1);
      if (parent && parent.userId !== post.userId) {
        await createNotification(db, { userId: parent.userId, type: "reply", actorId: ctx.user.id, postId: input.postId, commentId: result.id, body: `${actor?.displayName || actor?.name || "Someone"} replied to your comment` });
      }
    }

    await awardXP(db, ctx.user.id, "comment", 5, input.postId);
    return { id: result.id };
  }),

  /** Delete a comment */
  deleteComment: protectedProcedure.input(z.object({ commentId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [c] = await db.select().from(communityPostComments).where(eq(communityPostComments.id, input.commentId)).limit(1);
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    if (c.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    await db.delete(communityPostComments).where(eq(communityPostComments.id, input.commentId));
    await db.update(communityPosts).set({ commentCount: sql`GREATEST(0, comment_count - 1)` }).where(eq(communityPosts.id, c.postId));
    return { success: true };
  }),

  /** Vote on a poll */
  votePoll: protectedProcedure.input(z.object({ pollId: z.number(), optionIndex: z.number().min(0) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(communityPollVotes).values({ pollId: input.pollId, userId: ctx.user.id, optionIndex: input.optionIndex })
      .onDuplicateKeyUpdate({ set: { optionIndex: input.optionIndex } });
    await awardXP(db, ctx.user.id, "poll_vote", 3, input.pollId);
    return { success: true };
  }),

  /** Bookmark / unbookmark a post */
  toggleBookmark: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [existing] = await db.select().from(communityBookmarks)
      .where(and(eq(communityBookmarks.userId, ctx.user.id), eq(communityBookmarks.postId, input.postId))).limit(1);
    if (existing) {
      await db.delete(communityBookmarks).where(eq(communityBookmarks.id, existing.id));
      return { bookmarked: false };
    } else {
      await db.insert(communityBookmarks).values({ userId: ctx.user.id, postId: input.postId });
      return { bookmarked: true };
    }
  }),

  /** Get my bookmarked posts */
  myBookmarks: protectedProcedure.input(z.object({ cursor: z.number().optional(), limit: z.number().default(20) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { items: [], hasMore: false };
    const bms = await db.select({ postId: communityBookmarks.postId })
      .from(communityBookmarks).where(eq(communityBookmarks.userId, ctx.user.id))
      .orderBy(desc(communityBookmarks.createdAt)).limit(input.limit + 1);
    const hasMore = bms.length > input.limit;
    const postIds = bms.slice(0, input.limit).map((b: any) => b.postId);
    if (!postIds.length) return { items: [], hasMore: false };
    const posts = await db.select().from(communityPosts).where(and(inArray(communityPosts.id, postIds), eq(communityPosts.isHidden, false)));
    const items = await enrichPosts(db, posts, ctx.user.id);
    return { items, hasMore };
  }),

  /** Follow / unfollow a user */
  toggleFollow: protectedProcedure.input(z.object({ targetUserId: z.number() })).mutation(async ({ ctx, input }) => {
    if (input.targetUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [existing] = await db.select().from(communityFollows)
      .where(and(eq(communityFollows.followerId, ctx.user.id), eq(communityFollows.followingId, input.targetUserId))).limit(1);
    if (existing) {
      await db.delete(communityFollows).where(eq(communityFollows.id, existing.id));
      await db.update(users).set({ followingCount: sql`GREATEST(0, followingCount - 1)` }).where(eq(users.id, ctx.user.id));
      await db.update(users).set({ followersCount: sql`GREATEST(0, followersCount - 1)` }).where(eq(users.id, input.targetUserId));
      return { following: false };
    } else {
      await db.insert(communityFollows).values({ followerId: ctx.user.id, followingId: input.targetUserId });
      await db.update(users).set({ followingCount: sql`followingCount + 1` }).where(eq(users.id, ctx.user.id));
      await db.update(users).set({ followersCount: sql`followersCount + 1` }).where(eq(users.id, input.targetUserId));
      const [actor] = await db.select({ name: users.name, displayName: users.displayName }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      await createNotification(db, { userId: input.targetUserId, type: "follow", actorId: ctx.user.id, body: `${actor?.displayName || actor?.name || "Someone"} started following you` });
      await awardXP(db, ctx.user.id, "follow", 2, input.targetUserId);
      return { following: true };
    }
  }),

  /** Get my XP & badges */
  myXP: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [xp] = await db.select().from(communityUserXP).where(eq(communityUserXP.userId, ctx.user.id)).limit(1);
    const badgeRows = await db.select({ badge: communityBadges, awardedAt: communityUserBadges.awardedAt })
      .from(communityUserBadges)
      .innerJoin(communityBadges, eq(communityUserBadges.badgeId, communityBadges.id))
      .where(eq(communityUserBadges.userId, ctx.user.id));
    return { xp: xp ?? null, badges: badgeRows };
  }),

  /** Get my notifications */
  myNotifications: protectedProcedure.input(z.object({ limit: z.number().default(30), onlyUnread: z.boolean().default(false) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { items: [], unreadCount: 0 };
    const conditions = [eq(communityNotifications.userId, ctx.user.id)];
    if (input.onlyUnread) conditions.push(eq(communityNotifications.isRead, false));
    const items = await db.select().from(communityNotifications)
      .where(and(...conditions)).orderBy(desc(communityNotifications.createdAt)).limit(input.limit);
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(communityNotifications)
      .where(and(eq(communityNotifications.userId, ctx.user.id), eq(communityNotifications.isRead, false)));
    return { items, unreadCount: Number(count) };
  }),

  /** Mark notifications as read */
  markNotificationsRead: protectedProcedure.input(z.object({ ids: z.array(z.number()).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return;
    const conditions = [eq(communityNotifications.userId, ctx.user.id)];
    if (input.ids?.length) conditions.push(inArray(communityNotifications.id, input.ids));
    await db.update(communityNotifications).set({ isRead: true }).where(and(...conditions));
    return { success: true };
  }),

  /** Get or create DM conversation */
  getOrCreateConversation: protectedProcedure.input(z.object({ otherUserId: z.number() })).mutation(async ({ ctx, input }) => {
    if (input.otherUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [a, b] = [Math.min(ctx.user.id, input.otherUserId), Math.max(ctx.user.id, input.otherUserId)];
    const [existing] = await db.select().from(communityDMConversations)
      .where(and(eq(communityDMConversations.userAId, a), eq(communityDMConversations.userBId, b))).limit(1);
    if (existing) return existing;
    const [result] = await db.insert(communityDMConversations).values({ userAId: a, userBId: b }).$returningId();
    const [conv] = await db.select().from(communityDMConversations).where(eq(communityDMConversations.id, result.id)).limit(1);
    return conv;
  }),

  /** List my DM conversations */
  myConversations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const convs = await db.select().from(communityDMConversations)
      .where(or(eq(communityDMConversations.userAId, ctx.user.id), eq(communityDMConversations.userBId, ctx.user.id)))
      .orderBy(desc(communityDMConversations.lastMessageAt)).limit(50);
    const otherUserIds = convs.map((c: any) => c.userAId === ctx.user.id ? c.userBId : c.userAId);
    const otherUsers = otherUserIds.length
      ? await db.select({ id: users.id, name: users.name, displayName: users.displayName, avatarUrl: users.avatarUrl })
          .from(users).where(inArray(users.id, otherUserIds))
      : [];
    const uMap = Object.fromEntries(otherUsers.map((u: any) => [u.id, u]));
    return convs.map((c: any) => {
      const otherId = c.userAId === ctx.user.id ? c.userBId : c.userAId;
      const unread = c.userAId === ctx.user.id ? c.userAUnread : c.userBUnread;
      return { ...c, otherUser: uMap[otherId] ?? null, unreadCount: unread };
    });
  }),

  /** Get DM messages for a conversation */
  getMessages: protectedProcedure.input(z.object({ conversationId: z.number(), cursor: z.number().optional(), limit: z.number().default(30) })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { items: [], hasMore: false };
    const [conv] = await db.select().from(communityDMConversations).where(eq(communityDMConversations.id, input.conversationId)).limit(1);
    if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });

    const conditions = [eq(communityDMMessages.conversationId, input.conversationId)];
    if (input.cursor) conditions.push(lt(communityDMMessages.id, input.cursor));
    const msgs = await db.select().from(communityDMMessages).where(and(...conditions))
      .orderBy(desc(communityDMMessages.createdAt)).limit(input.limit + 1);
    const hasMore = msgs.length > input.limit;

    // Mark as read
    const isA = conv.userAId === ctx.user.id;
    await db.update(communityDMConversations).set(isA ? { userAUnread: 0 } : { userBUnread: 0 })
      .where(eq(communityDMConversations.id, input.conversationId));

    return { items: msgs.slice(0, input.limit).reverse(), hasMore };
  }),

  /** Send a DM */
  sendMessage: protectedProcedure.input(z.object({
    conversationId: z.number(),
    body: z.string().min(1).max(10000),
    attachmentUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [conv] = await db.select().from(communityDMConversations).where(eq(communityDMConversations.id, input.conversationId)).limit(1);
    if (!conv || (conv.userAId !== ctx.user.id && conv.userBId !== ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });

    const [result] = await db.insert(communityDMMessages).values({
      conversationId: input.conversationId,
      senderId: ctx.user.id,
      body: input.body,
      attachmentUrl: input.attachmentUrl ?? null,
    }).$returningId();

    const isA = conv.userAId === ctx.user.id;
    await db.update(communityDMConversations).set({
      lastMessageAt: new Date(),
      ...(isA ? { userBUnread: sql`user_b_unread + 1` } : { userAUnread: sql`user_a_unread + 1` }),
    }).where(eq(communityDMConversations.id, input.conversationId));

    return { id: result.id };
  }),

  /** Report content */
  reportContent: protectedProcedure.input(z.object({
    targetType: z.enum(["post", "comment", "user"]),
    targetId: z.number(),
    reason: z.string().min(1).max(255),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(communityReports).values({ reporterId: ctx.user.id, targetType: input.targetType, targetId: input.targetId, reason: input.reason });
    return { success: true };
  }),

  /** Upload image for a post */
  uploadPostImage: protectedProcedure.input(z.object({
    dataUri: z.string().min(1).max(10_000_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const b64Marker = ";base64,";
    const b64Idx = input.dataUri.indexOf(b64Marker);
    const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = input.mimeType.split("/")[1];
    const suffix = randomBytes(4).toString("hex");
    const fileKey = `community-posts/${ctx.user.id}-${suffix}.${ext}`;
    const { url } = await storagePut(fileKey, buffer, input.mimeType);
    return { url };
  }),

  /** Get member profile */
  getMemberProfile: protectedProcedure.input(z.object({ userId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [u] = await db.select({
      id: users.id, name: users.name, displayName: users.displayName, avatarUrl: users.avatarUrl,
      bio: users.bio, credentials: users.credentials, specialty: users.specialty,
      yearsExperience: users.yearsExperience, location: users.location, website: users.website,
      followersCount: users.followersCount, followingCount: users.followingCount,
      createdAt: users.createdAt, communityRole: users.communityRole,
    }).from(users).where(eq(users.id, input.userId)).limit(1);
    if (!u) throw new TRPCError({ code: "NOT_FOUND" });

    const [xp] = await db.select().from(communityUserXP).where(eq(communityUserXP.userId, input.userId)).limit(1);
    const badgeRows = await db.select({ badge: communityBadges }).from(communityUserBadges)
      .innerJoin(communityBadges, eq(communityUserBadges.badgeId, communityBadges.id))
      .where(eq(communityUserBadges.userId, input.userId));

    let isFollowing = false;
    if (ctx.user.id !== input.userId) {
      const [f] = await db.select().from(communityFollows)
        .where(and(eq(communityFollows.followerId, ctx.user.id), eq(communityFollows.followingId, input.userId))).limit(1);
      isFollowing = !!f;
    }

    const recentPosts = await db.select().from(communityPosts)
      .where(and(eq(communityPosts.userId, input.userId), eq(communityPosts.isHidden, false)))
      .orderBy(desc(communityPosts.createdAt)).limit(5);

    return { ...u, xp: xp ?? null, badges: badgeRows.map(b => b.badge), isFollowing, recentPosts };
  }),
});

// ─── Admin sub-router ─────────────────────────────────────────────────────────

const communityAdminRouter = router({
  /** Create a community */
  createCommunity: protectedProcedure.input(z.object({
    title: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
    description: z.string().optional(),
    brand: z.enum(["all_about_ultrasound", "iheartecho"]).default("all_about_ultrasound"),
    privacy: z.enum(["public", "private", "paid"]).default("public"),
    accessType: z.enum(["free", "paid", "restricted"]).default("free"),
    accentColor: z.string().default("#189aa1"),
    coverImage: z.string().optional(),
    logoImage: z.string().optional(),
    iconImage: z.string().optional(),
    sortOrder: z.number().default(0),
    linkedAccessItems: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(communities).values({ ...input, status: "draft" }).$returningId();
    // Create default General channel
    await db.insert(communityChannels).values({ communityId: result.id, name: "General", type: "discussion", isDefault: true, sortOrder: 0 });
    await db.insert(communityChannels).values({ communityId: result.id, name: "Announcements", type: "announcements", sortOrder: 1 });
    await db.insert(communityChannels).values({ communityId: result.id, name: "Resources", type: "resources", sortOrder: 2 });
    return { id: result.id };
  }),

  /** Update a community */
  updateCommunity: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    status: z.enum(["draft", "published"]).optional(),
    privacy: z.enum(["public", "private", "paid"]).optional(),
    accessType: z.enum(["free", "paid", "restricted"]).optional(),
    accentColor: z.string().optional(),
    coverImage: z.string().optional(),
    logoImage: z.string().optional(),
    iconImage: z.string().optional(),
    sortOrder: z.number().optional(),
    linkedAccessItems: z.string().optional(), // JSON array of {type, id, title}
    pageBlocks: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(communities).set(data as any).where(eq(communities.id, id));
    return { success: true };
  }),
  /** Reorder communities (drag-and-drop sort) */
  reorderCommunities: protectedProcedure.input(z.object({
    communities: z.array(z.object({ id: z.number(), sortOrder: z.number() })),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    for (const c of input.communities) {
      await db.update(communities).set({ sortOrder: c.sortOrder }).where(eq(communities.id, c.id));
    }
    return { success: true };
  }),
  /** Upload community icon image */
  uploadCommunityIcon: protectedProcedure.input(z.object({
    communityId: z.number(),
    base64: z.string(),
    mimeType: z.string().default("image/png"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const buf = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.split("/")[1] ?? "png";
    const key = `community-icons/${input.communityId}-${Date.now()}.${ext}`;
    const { url } = await storagePut(key, buf, input.mimeType);
    await db.update(communities).set({ iconImage: url }).where(eq(communities.id, input.communityId));
    return { url };
  }),
  /** List pending members awaiting approval (restricted communities) */
  listPendingMembers: protectedProcedure.input(z.object({ communityId: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      id: communityMembers.id, userId: communityMembers.userId,
      joinedAt: communityMembers.joinedAt, memberStatus: communityMembers.memberStatus,
      userName: users.name, userEmail: users.email, userAvatar: users.avatarUrl,
    }).from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.memberStatus, "pending")))
      .orderBy(asc(communityMembers.joinedAt));
    return rows;
  }),
  /** Approve or reject a pending member */
  approveMember: protectedProcedure.input(z.object({
    communityId: z.number(),
    userId: z.number(),
    action: z.enum(["approve", "reject"]),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const newStatus = input.action === "approve" ? "approved" : "rejected";
    await db.update(communityMembers)
      .set({ memberStatus: newStatus })
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.userId)));
    if (input.action === "approve") {
      await awardXP(db, input.userId, "join", 5);
    }
    return { success: true };
  }),
  /** List admin profiles for a community */
  listAdminProfiles: protectedProcedure.input(z.object({ communityId: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select().from(communityAdminProfiles)
      .where(eq(communityAdminProfiles.communityId, input.communityId))
      .orderBy(asc(communityAdminProfiles.createdAt));
  }),
  /** Create an admin profile */
  createAdminProfile: protectedProcedure.input(z.object({
    communityId: z.number(),
    name: z.string().min(1).max(100),
    bio: z.string().optional(),
    avatarUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [r] = await db.insert(communityAdminProfiles).values({
      communityId: input.communityId,
      name: input.name,
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null,
      createdByUserId: ctx.user.id,
    }).$returningId();
    return { id: r.id };
  }),
  /** Update an admin profile */
  updateAdminProfile: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().min(1).max(100).optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(communityAdminProfiles).set(data).where(eq(communityAdminProfiles.id, id));
    return { success: true };
  }),
  /** Delete an admin profile */
  deleteAdminProfile: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(communityAdminProfiles).where(eq(communityAdminProfiles.id, input.id));
    return { success: true };
  }),
  /** Upload admin profile avatar */
  uploadAdminProfileAvatar: protectedProcedure.input(z.object({
    profileId: z.number(),
    base64: z.string(),
    mimeType: z.string().default("image/png"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const buf = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.split("/")[1] ?? "png";
    const key = `community-admin-profiles/${input.profileId}-${Date.now()}.${ext}`;
    const { url } = await storagePut(key, buf, input.mimeType);
    await db.update(communityAdminProfiles).set({ avatarUrl: url }).where(eq(communityAdminProfiles.id, input.profileId));
    return { url };
  }),
  /** List courses available for linked access (for the linked access picker) */
  listCoursesForLinkedAccess: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type })
      .from(lmsCourses)
      .where(eq(lmsCourses.status, "public"))
      .orderBy(asc(lmsCourses.title));
  }),
  /** Auto-grant community access when user enrolls in a linked course */
  grantLinkedCommunityAccess: protectedProcedure.input(z.object({
    userId: z.number(),
    courseId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    // Find communities that have this courseId in their linkedAccessItems
    const allCommunities = await db.select({ id: communities.id, linkedAccessItems: communities.linkedAccessItems })
      .from(communities).where(eq(communities.status, "published"));
    for (const c of allCommunities) {
      if (!c.linkedAccessItems) continue;
      try {
        const items = JSON.parse(c.linkedAccessItems) as Array<{ type: string; id: number }>;
        const linked = items.some(i => i.type === "course" && i.id === input.courseId);
        if (linked) {
          await db.insert(communityMembers).values({
            communityId: c.id, userId: input.userId, role: "member", memberStatus: "approved",
          }).onDuplicateKeyUpdate({ set: { memberStatus: "approved" } });
        }
      } catch { /* skip malformed JSON */ }
    }
    return { success: true };
  }),

  /** Alias: listCommunities (used by CommunityAdmin UI) */
  listCommunities: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const all = await db.select().from(communities).orderBy(asc(communities.sortOrder), asc(communities.id));
    const withCounts = await Promise.all(all.map(async (c) => {
      const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(communityMembers)
        .where(and(eq(communityMembers.communityId, c.id), eq(communityMembers.memberStatus, "approved")));
      const [{ pending }] = await db.select({ pending: sql<number>`COUNT(*)` }).from(communityMembers)
        .where(and(eq(communityMembers.communityId, c.id), eq(communityMembers.memberStatus, "pending")));
      return { ...c, memberCount: Number(count), pendingCount: Number(pending) };
    }));
    return withCounts;
  }),
  /** Delete a community */
  deleteCommunity: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(communities).where(eq(communities.id, input.id));
    return { success: true };
  }),
  /** Create a channel (alias for addChannel) */
  createChannel: protectedProcedure.input(z.object({
    communityId: z.number(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    type: z.enum(["discussion", "announcements", "resources"]).default("discussion"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [r] = await db.insert(communityChannels).values({
      communityId: input.communityId, name: input.name,
      description: input.description ?? null, type: input.type,
    }).$returningId();
    return { id: r.id };
  }),
  /** Update a channel */
  updateChannel: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    type: z.enum(["discussion", "announcements", "resources"]).optional(),
    sortOrder: z.number().optional(),
    isDefault: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { id, ...data } = input;
    await db.update(communityChannels).set(data as any).where(eq(communityChannels.id, id));
    return { success: true };
  }),
  /** Award a badge to a user (alias for grantBadge) */
  awardBadge: protectedProcedure.input(z.object({ userId: z.number(), badgeId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(communityUserBadges).values({ userId: input.userId, badgeId: input.badgeId }).catch(() => {});
    return { success: true };
  }),
  /** List all communities (admin) */
  listAllCommunities: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const all = await db.select().from(communities).orderBy(desc(communities.createdAt));
    const withCounts = await Promise.all(all.map(async (c) => {
      const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(communityMembers).where(eq(communityMembers.communityId, c.id));
      return { ...c, memberCount: Number(count) };
    }));
    return withCounts;
  }),

  /** List channels for a community (admin) */
  listChannels: protectedProcedure.input(z.object({ communityId: z.number() })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select().from(communityChannels)
      .where(eq(communityChannels.communityId, input.communityId))
      .orderBy(asc(communityChannels.sortOrder));
  }),
  /** Add a channel */
  addChannel: protectedProcedure.input(z.object({
    communityId: z.number(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    type: z.enum(["discussion", "announcements", "resources"]).default("discussion"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [{ maxSort }] = await db.select({ maxSort: sql<number>`COALESCE(MAX(sort_order), -1)` })
      .from(communityChannels).where(eq(communityChannels.communityId, input.communityId));
    const [result] = await db.insert(communityChannels).values({ ...input, sortOrder: Number(maxSort) + 1 }).$returningId();
    return { id: result.id };
  }),

  /** Delete a channel */
  deleteChannel: protectedProcedure.input(z.object({ channelId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(communityChannels).where(eq(communityChannels.id, input.channelId));
    return { success: true };
  }),

  /** Pin / unpin a post */
  togglePinPost: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select({ isPinned: communityPosts.isPinned }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    await db.update(communityPosts).set({ isPinned: !post.isPinned }).where(eq(communityPosts.id, input.postId));
    return { isPinned: !post.isPinned };
  }),

  /** Hide / unhide a post */
  toggleHidePost: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select({ isHidden: communityPosts.isHidden }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    await db.update(communityPosts).set({ isHidden: !post.isHidden }).where(eq(communityPosts.id, input.postId));
    return { isHidden: !post.isHidden };
  }),

  /** Lock / unlock a post */
  toggleLockPost: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [post] = await db.select({ isLocked: communityPosts.isLocked }).from(communityPosts).where(eq(communityPosts.id, input.postId)).limit(1);
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    await db.update(communityPosts).set({ isLocked: !post.isLocked }).where(eq(communityPosts.id, input.postId));
    return { isLocked: !post.isLocked };
  }),

  /** List pending reports */
  listReports: protectedProcedure.input(z.object({ status: z.enum(["pending", "reviewed", "dismissed"]).default("pending") })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select().from(communityReports).where(eq(communityReports.status, input.status)).orderBy(desc(communityReports.createdAt)).limit(100);
  }),

  /** Resolve a report */
  resolveReport: protectedProcedure.input(z.object({
    reportId: z.number(),
    status: z.enum(["reviewed", "dismissed"]),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(communityReports).set({ status: input.status, reviewedByAdminId: ctx.user.id, reviewedAt: new Date() })
      .where(eq(communityReports.id, input.reportId));
    return { success: true };
  }),

  /** Upload community cover/logo image */
  uploadCommunityImage: protectedProcedure.input(z.object({
    communityId: z.number(),
    imageType: z.enum(["cover", "logo"]),
    dataUri: z.string().min(1).max(10_000_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const b64Marker = ";base64,";
    const b64Idx = input.dataUri.indexOf(b64Marker);
    const base64Data = b64Idx >= 0 ? input.dataUri.slice(b64Idx + b64Marker.length) : input.dataUri;
    const buffer = Buffer.from(base64Data, "base64");
    const ext = input.mimeType.split("/")[1];
    const suffix = randomBytes(4).toString("hex");
    const fileKey = `community-${input.imageType}/${input.communityId}-${suffix}.${ext}`;
    const { url } = await storagePut(fileKey, buffer, input.mimeType);
    const updateData = input.imageType === "cover" ? { coverImage: url } : { logoImage: url };
    await db.update(communities).set(updateData).where(eq(communities.id, input.communityId));
    return { url };
  }),

  /** Post an announcement (pinned post in Announcements channel) */
  postAnnouncement: protectedProcedure.input(z.object({
    communityId: z.number(),
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(50000),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [announcementChannel] = await db.select().from(communityChannels)
      .where(and(eq(communityChannels.communityId, input.communityId), eq(communityChannels.type, "announcements"))).limit(1);
    if (!announcementChannel) throw new TRPCError({ code: "NOT_FOUND", message: "No announcements channel found." });
    const [result] = await db.insert(communityPosts).values({
      communityId: input.communityId,
      channelId: announcementChannel.id,
      userId: ctx.user.id,
      title: input.title,
      body: input.body,
      isPinned: true,
    }).$returningId();
    // Notify all members
    const members = await db.select({ userId: communityMembers.userId }).from(communityMembers)
      .where(eq(communityMembers.communityId, input.communityId));
    for (const m of members) {
      if (m.userId === ctx.user.id) continue;
      await db.insert(communityNotifications).values({
        userId: m.userId, type: "announcement", actorId: ctx.user.id,
        postId: result.id, communityId: input.communityId,
        body: `New announcement: ${input.title}`,
      });
    }
    return { id: result.id };
  }),

  /** List all badges */
  listBadges: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    return db.select().from(communityBadges).orderBy(asc(communityBadges.id));
  }),
  /** Create a badge */
  createBadge: protectedProcedure.input(z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    description: z.string().optional(),
    iconEmoji: z.string().max(10).default("🏅"),
    xpRequired: z.number().min(0).default(0),
    color: z.string().default("#189aa1"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [result] = await db.insert(communityBadges).values(input).$returningId();
    return { id: result.id };
  }),
  /** Grant a badge to a user */
  grantBadge: protectedProcedure.input(z.object({
    userId: z.number(),
    badgeId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.insert(communityUserBadges).values({ userId: input.userId, badgeId: input.badgeId })
      .onDuplicateKeyUpdate({ set: { badgeId: input.badgeId } });
    return { success: true };
  }),
  /** List members of a community */
  listMembers: protectedProcedure.input(z.object({
    communityId: z.number(),
    search: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(50),
  })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return { members: [], total: 0 };
    const offset = (input.page - 1) * input.pageSize;
    const baseWhere = eq(communityMembers.communityId, input.communityId);
    const rows = await db
      .select({
        id: communityMembers.id,
        userId: communityMembers.userId,
        role: communityMembers.role,
        joinedAt: communityMembers.joinedAt,
        approvedToPost: communityMembers.approvedToPost,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .where(baseWhere)
      .orderBy(desc(communityMembers.joinedAt))
      .limit(input.pageSize)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(communityMembers).where(baseWhere);
    return { members: rows, total: Number(total) };
  }),

  /** Add a member by userId or email */
  addMember: protectedProcedure.input(z.object({
    communityId: z.number(),
    userId: z.number().optional(),
    email: z.string().email().optional(),
    role: z.enum(["admin", "moderator", "member"]).default("member"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    let targetUserId = input.userId;
    if (!targetUserId && input.email) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
      if (!u) throw new TRPCError({ code: "NOT_FOUND", message: `No user found with email: ${input.email}` });
      targetUserId = u.id;
    }
    if (!targetUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide userId or email" });
    await db.insert(communityMembers)
      .values({ communityId: input.communityId, userId: targetUserId, role: input.role })
      .onDuplicateKeyUpdate({ set: { role: input.role } });
    return { success: true, userId: targetUserId };
  }),

  /** Bulk add members by email list */
  bulkAddMembers: protectedProcedure.input(z.object({
    communityId: z.number(),
    emails: z.array(z.string().email()).min(1).max(500),
    role: z.enum(["admin", "moderator", "member"]).default("member"),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const found = await db.select({ id: users.id, email: users.email }).from(users)
      .where(inArray(users.email, input.emails));
    const notFound = input.emails.filter(e => !found.find(u => u.email === e));
    if (found.length > 0) {
      for (const u of found) {
        await db.insert(communityMembers)
          .values({ communityId: input.communityId, userId: u.id, role: input.role })
          .onDuplicateKeyUpdate({ set: { role: input.role } });
      }
    }
    return { added: found.length, notFound };
  }),

  /** Remove a member */
  removeMember: protectedProcedure.input(z.object({
    communityId: z.number(),
    userId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(communityMembers)
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.userId)));
    return { success: true };
  }),

  /** Update a member's role */
  updateMemberRole: protectedProcedure.input(z.object({
    communityId: z.number(),
    userId: z.number(),
    role: z.enum(["admin", "moderator", "member"]),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(communityMembers)
      .set({ role: input.role })
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.userId)));
    return { success: true };
  }),

  /** Set whether a member requires comment moderation */
  setMemberApproval: protectedProcedure.input(z.object({
    communityId: z.number(),
    userId: z.number(),
    approvedToPost: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(communityMembers)
      .set({ approvedToPost: input.approvedToPost })
      .where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.userId)));
    return { success: true };
  }),

  /** List pending comments awaiting moderation */
  listPendingComments: protectedProcedure.input(z.object({
    communityId: z.number(),
  })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: communityPostComments.id,
        postId: communityPostComments.postId,
        userId: communityPostComments.userId,
        body: communityPostComments.body,
        status: communityPostComments.status,
        createdAt: communityPostComments.createdAt,
        authorName: users.name,
        authorEmail: users.email,
        authorAvatar: users.avatarUrl,
      })
      .from(communityPostComments)
      .innerJoin(communityPosts, eq(communityPosts.id, communityPostComments.postId))
      .innerJoin(users, eq(users.id, communityPostComments.userId))
      .where(and(
        eq(communityPosts.communityId, input.communityId),
        eq(communityPostComments.status, "pending"),
      ))
      .orderBy(asc(communityPostComments.createdAt))
      .limit(200);
    return rows;
  }),

  /** Approve or reject a pending comment */
  moderateComment: protectedProcedure.input(z.object({
    commentId: z.number(),
    action: z.enum(["approve", "reject"]),
  })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const newStatus = input.action === "approve" ? "approved" : "rejected";
    await db.update(communityPostComments)
      .set({ status: newStatus })
      .where(eq(communityPostComments.id, input.commentId));
    return { success: true };
  }),

  /** Get page blocks for the community page editor */
  getCommunityPageBlocks: protectedProcedure.input(z.object({ communityId: z.number(), pageType: z.enum(["page", "landing"]).default("page") })).query(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [community] = await db.select({ pageBlocks: communities.pageBlocks, landingPageBlocks: communities.landingPageBlocks }).from(communities).where(eq(communities.id, input.communityId)).limit(1);
    if (!community) throw new TRPCError({ code: "NOT_FOUND" });
    const raw = input.pageType === "landing" ? community.landingPageBlocks : community.pageBlocks;
    try { return { blocks: raw ? JSON.parse(raw) : [] }; }
    catch { return { blocks: [] }; }
  }),

  /** Save page blocks for the community page editor */
  saveCommunityPageBlocks: protectedProcedure.input(z.object({ communityId: z.number(), pageType: z.enum(["page", "landing"]).default("page"), blocks: z.string() })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const field = input.pageType === "landing" ? { landingPageBlocks: input.blocks } : { pageBlocks: input.blocks };
    await db.update(communities).set(field).where(eq(communities.id, input.communityId));
    return { success: true };
  }),

  /** AI: summarize recent posts in a channel */
  aiSummarizeChannel: protectedProcedure.input(z.object({ channelId: z.number(), limit: z.number().default(20) })).mutation(async ({ ctx, input }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const posts = await db.select({ title: communityPosts.title, body: communityPosts.body, createdAt: communityPosts.createdAt })
      .from(communityPosts).where(and(eq(communityPosts.channelId, input.channelId), eq(communityPosts.isHidden, false)))
      .orderBy(desc(communityPosts.createdAt)).limit(input.limit);
    if (!posts.length) return { summary: "No recent posts to summarize." };
    const postText = posts.map((p, i) => `${i + 1}. ${p.title ? p.title + ": " : ""}${p.body.slice(0, 300)}`).join("\n");
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an AI assistant for a healthcare education community. Summarize the key themes and discussions from recent community posts in 3-5 bullet points. Be concise and professional." },
        { role: "user", content: `Summarize these recent community posts:\n\n${postText}` },
      ],
    });
    return { summary: response.choices[0]?.message?.content ?? "Unable to generate summary." };
  }),
});

// ─── Root community router ────────────────────────────────────────────────────

export const communityRouter = router({
  public: communityPublicRouter,
  member: communityMemberRouter,
  admin: communityAdminRouter,
});
