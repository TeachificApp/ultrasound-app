import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  expoPointsProgramEvents,
  expoPointsPrograms,
  expoPointsRedemptions,
  expoPointsRewards,
  expoPointsTransactions,
  ultrasoundExpoEvents,
  ultrasoundExpoPackages,
  ultrasoundExpoRegistrations,
  users,
  vendorPartnerApplications,
} from "../../drizzle/schema";
import {
  EXPO_POINTS_ACTIVITY_TYPES,
  EXPO_POINTS_ELIGIBILITY_ROLES,
  EXPO_POINTS_LEADERBOARD_SCOPES,
  EXPO_POINTS_REDEMPTION_STATUSES,
  expoPointsPublicDisplayName,
  normalizeExpoPointsRoles,
} from "../../shared/expoPoints";
import { getDb, getUserRoles } from "../db";
import { getExpoPointsBalance, getExpoPointsParticipant } from "../lib/expoPoints";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const programScopeInput = z.enum(EXPO_POINTS_LEADERBOARD_SCOPES);
const eligibleRoleInput = z.enum(EXPO_POINTS_ELIGIBILITY_ROLES);
const activityTypeInput = z.enum(EXPO_POINTS_ACTIVITY_TYPES);
const redemptionStatusInput = z.enum(EXPO_POINTS_REDEMPTION_STATUSES);

async function assertExpoAdmin(user: { id: number; role: string }) {
  const roles = await getUserRoles(user.id);
  if (user.role !== "admin" && !roles.includes("platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access is required." });
  }
}

async function getProgram(db: any, programId: number) {
  const [program] = await db.select().from(expoPointsPrograms).where(eq(expoPointsPrograms.id, programId)).limit(1);
  if (!program) throw new TRPCError({ code: "NOT_FOUND", message: "This ExpoPoints program was not found." });
  return program;
}

async function getProgramEventIds(db: any, programId: number) {
  const rows = await db.select({ eventId: expoPointsProgramEvents.eventId }).from(expoPointsProgramEvents)
    .where(eq(expoPointsProgramEvents.programId, programId));
  return rows.map((row: any) => row.eventId);
}

async function getEligibleParticipants(db: any, program: any) {
  const eventIds = await getProgramEventIds(db, program.id);
  if (!eventIds.length) return [] as any[];
  const eligibleRoles = new Set(normalizeExpoPointsRoles(JSON.parse(program.eligibleRolesJson || "[]")));
  const registrations = await db.select({
    userId: ultrasoundExpoRegistrations.userId,
    packageType: ultrasoundExpoPackages.packageType,
    eventId: ultrasoundExpoRegistrations.eventId,
    displayName: users.displayName,
    name: users.name,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  }).from(ultrasoundExpoRegistrations)
    .innerJoin(ultrasoundExpoPackages, eq(ultrasoundExpoRegistrations.packageId, ultrasoundExpoPackages.id))
    .innerJoin(users, eq(ultrasoundExpoRegistrations.userId, users.id))
    .where(and(
      inArray(ultrasoundExpoRegistrations.eventId, eventIds),
      eq(ultrasoundExpoRegistrations.paymentStatus, "paid"),
      inArray(ultrasoundExpoPackages.packageType, ["registrant", "exhibitor", "sponsor"]),
    ));
  const applicantRows = await db.select({
    userId: vendorPartnerApplications.linkedUserId,
    displayName: users.displayName,
    name: users.name,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  }).from(vendorPartnerApplications)
    .innerJoin(users, eq(vendorPartnerApplications.linkedUserId, users.id))
    .where(and(eq(vendorPartnerApplications.status, "approved"), eq(vendorPartnerApplications.expoAccess, true)));

  const byUser = new Map<number, { userId: number; name: string; email: string | null; roles: Set<string>; eventIds: Set<number> }>();
  for (const row of registrations as any[]) {
    if (!row.userId) continue;
    const role = row.packageType === "registrant" ? "attendee" : row.packageType;
    if (!eligibleRoles.has(role)) continue;
    const existing = byUser.get(row.userId) ?? { userId: row.userId, name: row.displayName || row.name || "Expo participant", email: row.email ?? null, roles: new Set(), eventIds: new Set() };
    existing.roles.add(role); existing.eventIds.add(row.eventId); byUser.set(row.userId, existing);
  }
  if (eligibleRoles.has("vendor")) {
    for (const row of applicantRows as any[]) {
      if (!row.userId) continue;
      const existing = byUser.get(row.userId) ?? { userId: row.userId, name: row.displayName || row.name || "Expo partner", email: row.email ?? null, roles: new Set(), eventIds: new Set() };
      existing.roles.add("vendor"); byUser.set(row.userId, existing);
    }
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function programValues(input: any, userId: number) {
  return {
    name: input.name,
    description: input.description || null,
    leaderboardScope: input.leaderboardScope,
    eligibleRolesJson: JSON.stringify(input.eligibleRoles),
    liveDisplayEnabled: input.liveDisplayEnabled,
    isActive: input.isActive,
    createdByUserId: userId,
  };
}

export const expoPointsRouter = router({
  /** Signed-in Expo participants see only programs in which their actual registration or approved partner role is eligible. */
  myDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ExpoPoints is temporarily unavailable." });
    const programs = await db.select().from(expoPointsPrograms).where(eq(expoPointsPrograms.isActive, true)).orderBy(asc(expoPointsPrograms.name));
    const visible = [] as any[];
    for (const program of programs) {
      const participant = await getExpoPointsParticipant(db, ctx.user.id, program.id);
      if (!participant) continue;
      const [balance, eventIds, rewards, transactions, redemptions] = await Promise.all([
        getExpoPointsBalance(db, program.id, ctx.user.id),
        getProgramEventIds(db, program.id),
        db.select().from(expoPointsRewards).where(and(eq(expoPointsRewards.programId, program.id), eq(expoPointsRewards.isActive, true))).orderBy(asc(expoPointsRewards.sortOrder), asc(expoPointsRewards.title)),
        db.select().from(expoPointsTransactions).where(and(eq(expoPointsTransactions.programId, program.id), eq(expoPointsTransactions.userId, ctx.user.id))).orderBy(desc(expoPointsTransactions.createdAt)).limit(12),
        db.select({ id: expoPointsRedemptions.id, rewardId: expoPointsRedemptions.rewardId, status: expoPointsRedemptions.status, pointsCost: expoPointsRedemptions.pointsCost, createdAt: expoPointsRedemptions.createdAt, rewardTitle: expoPointsRewards.title }).from(expoPointsRedemptions).innerJoin(expoPointsRewards, eq(expoPointsRedemptions.rewardId, expoPointsRewards.id)).where(and(eq(expoPointsRedemptions.programId, program.id), eq(expoPointsRedemptions.userId, ctx.user.id))).orderBy(desc(expoPointsRedemptions.createdAt)).limit(12),
      ]);
      visible.push({ program, participant, eventIds, balance, rewards, transactions, redemptions });
    }
    return visible;
  }),

  /** Requests do not spend points until an event team member fulfills the reward. */
  requestRedemption: protectedProcedure.input(z.object({ programId: z.number().int().positive(), rewardId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [program, reward] = await Promise.all([getProgram(db, input.programId), db.select().from(expoPointsRewards).where(and(eq(expoPointsRewards.id, input.rewardId), eq(expoPointsRewards.programId, input.programId))).limit(1).then((rows: any[]) => rows[0])]);
    if (!program.isActive || !reward || !reward.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "This ExpoPoints reward is not available." });
    const participant = await getExpoPointsParticipant(db, ctx.user.id, program.id);
    if (!participant) throw new TRPCError({ code: "FORBIDDEN", message: "A qualifying Expo registration or approved partner role is required for this reward." });
    const [balance, reservations] = await Promise.all([
      getExpoPointsBalance(db, program.id, ctx.user.id),
      db.select({ count: sql<number>`COUNT(*)` }).from(expoPointsRedemptions).where(and(eq(expoPointsRedemptions.rewardId, reward.id), inArray(expoPointsRedemptions.status, ["requested", "fulfilled"]))),
    ]);
    if (balance < reward.pointsCost) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You do not have enough ExpoPoints for this reward yet." });
    if (reward.inventoryLimit !== null && Number(reservations[0]?.count ?? 0) >= reward.inventoryLimit) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This reward has been fully reserved." });
    const created = await db.insert(expoPointsRedemptions).values({ programId: program.id, rewardId: reward.id, userId: ctx.user.id, pointsCost: reward.pointsCost, status: "requested" }).$returningId();
    return { id: created[0]?.id ?? null, status: "requested" as const };
  }),

  /** A privacy-safe monitor feed is public only after an administrator enables it for that program. */
  publicLiveLeaderboard: publicProcedure.input(z.object({ programId: z.number().int().positive(), limit: z.number().int().min(3).max(50).default(15) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const program = await getProgram(db, input.programId);
    if (!program.isActive || !program.liveDisplayEnabled) throw new TRPCError({ code: "NOT_FOUND", message: "This live ExpoPoints display is not available." });
    const rows = await db.select({
      userId: expoPointsTransactions.userId,
      points: sql<number>`COALESCE(SUM(${expoPointsTransactions.points}), 0)`,
      displayName: users.displayName,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(expoPointsTransactions)
      .innerJoin(users, eq(expoPointsTransactions.userId, users.id))
      .where(eq(expoPointsTransactions.programId, program.id))
      .groupBy(expoPointsTransactions.userId, users.displayName, users.name, users.firstName, users.lastName)
      .orderBy(desc(sql`COALESCE(SUM(${expoPointsTransactions.points}), 0)`))
      .limit(input.limit);
    return {
      program: { id: program.id, name: program.name, leaderboardScope: program.leaderboardScope },
      entries: rows.map((row: any, index: number) => ({ rank: index + 1, displayName: expoPointsPublicDisplayName(row), points: Number(row.points ?? 0) })),
      refreshedAt: new Date(),
    };
  }),

  adminWorkspace: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [event, program, allEvents] = await Promise.all([
      db.select().from(ultrasoundExpoEvents).where(eq(ultrasoundExpoEvents.id, input.eventId)).limit(1).then((rows: any[]) => rows[0]),
      db.select().from(expoPointsPrograms).where(eq(expoPointsPrograms.hostEventId, input.eventId)).limit(1).then((rows: any[]) => rows[0] ?? null),
      db.select().from(ultrasoundExpoEvents).orderBy(asc(ultrasoundExpoEvents.startsAt)),
    ]);
    if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "The Expo event was not found." });
    if (!program) return { event, program: null, includedEventIds: [event.id], availableEvents: allEvents, participants: [], rewards: [], redemptions: [], leaderboard: [] };
    const [includedEventIds, participants, rewards, redemptions, leaderboard] = await Promise.all([
      getProgramEventIds(db, program.id),
      getEligibleParticipants(db, program),
      db.select().from(expoPointsRewards).where(eq(expoPointsRewards.programId, program.id)).orderBy(asc(expoPointsRewards.sortOrder), asc(expoPointsRewards.title)),
      db.select({ id: expoPointsRedemptions.id, userId: expoPointsRedemptions.userId, pointsCost: expoPointsRedemptions.pointsCost, status: expoPointsRedemptions.status, fulfillmentNote: expoPointsRedemptions.fulfillmentNote, createdAt: expoPointsRedemptions.createdAt, rewardTitle: expoPointsRewards.title, userName: users.name, displayName: users.displayName }).from(expoPointsRedemptions).innerJoin(expoPointsRewards, eq(expoPointsRedemptions.rewardId, expoPointsRewards.id)).innerJoin(users, eq(expoPointsRedemptions.userId, users.id)).where(eq(expoPointsRedemptions.programId, program.id)).orderBy(desc(expoPointsRedemptions.createdAt)).limit(100),
      db.select({ userId: expoPointsTransactions.userId, points: sql<number>`COALESCE(SUM(${expoPointsTransactions.points}), 0)`, displayName: users.displayName, name: users.name }).from(expoPointsTransactions).innerJoin(users, eq(expoPointsTransactions.userId, users.id)).where(eq(expoPointsTransactions.programId, program.id)).groupBy(expoPointsTransactions.userId, users.displayName, users.name).orderBy(desc(sql`COALESCE(SUM(${expoPointsTransactions.points}), 0)`)).limit(50),
    ]);
    return { event, program, includedEventIds, availableEvents: allEvents, participants, rewards, redemptions, leaderboard: leaderboard.map((row: any, index: number) => ({ ...row, rank: index + 1, points: Number(row.points ?? 0) })) };
  }),

  adminSaveProgram: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), name: z.string().trim().min(2).max(255), description: z.string().trim().max(4_000).optional().or(z.literal("")), leaderboardScope: programScopeInput, eligibleRoles: z.array(eligibleRoleInput).min(1), includedEventIds: z.array(z.number().int().positive()).min(1).max(20), liveDisplayEnabled: z.boolean(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    if (!input.includedEventIds.includes(input.eventId)) throw new TRPCError({ code: "BAD_REQUEST", message: "The current event instance must be included in its ExpoPoints program." });
    const available = await db.select({ id: ultrasoundExpoEvents.id, tenant: ultrasoundExpoEvents.tenant }).from(ultrasoundExpoEvents).where(inArray(ultrasoundExpoEvents.id, input.includedEventIds));
    if (available.length !== input.includedEventIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "One or more selected Expo event instances no longer exist." });
    if (input.leaderboardScope === "ultrasound_expo" && available.some((event: any) => event.tenant !== "ultrasound_expo")) throw new TRPCError({ code: "BAD_REQUEST", message: "An UltrasoundExpo leaderboard can include only UltrasoundExpo event instances." });
    if (input.leaderboardScope === "echo_expo" && available.some((event: any) => event.tenant !== "echo_expo")) throw new TRPCError({ code: "BAD_REQUEST", message: "An EchoExpo leaderboard can include only EchoExpo event instances." });
    const [existing] = await db.select().from(expoPointsPrograms).where(eq(expoPointsPrograms.hostEventId, input.eventId)).limit(1);
    const values = programValues({ ...input, eligibleRoles: [...new Set(input.eligibleRoles)] }, ctx.user.id);
    let programId = existing?.id;
    if (existing) await db.update(expoPointsPrograms).set(values).where(eq(expoPointsPrograms.id, existing.id));
    else { const created = await db.insert(expoPointsPrograms).values({ hostEventId: input.eventId, ...values }).$returningId(); programId = created[0]?.id; }
    if (!programId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ExpoPoints program could not be saved." });
    await db.delete(expoPointsProgramEvents).where(eq(expoPointsProgramEvents.programId, programId));
    await db.insert(expoPointsProgramEvents).values(input.includedEventIds.map(eventId => ({ programId: programId!, eventId })));
    return { id: programId, updated: !!existing };
  }),

  adminAwardPoints: protectedProcedure.input(z.object({ programId: z.number().int().positive(), userId: z.number().int().positive(), eventId: z.number().int().positive().optional(), activityType: activityTypeInput.exclude(["reward_redemption"]), points: z.number().int().min(-10_000).max(100_000).refine(value => value !== 0, "Points cannot be zero."), description: z.string().trim().min(2).max(1_000), sourceKey: z.string().trim().max(255).optional().or(z.literal("")) })).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const program = await getProgram(db, input.programId);
    const participant = await getExpoPointsParticipant(db, input.userId, program.id);
    if (!participant) throw new TRPCError({ code: "FORBIDDEN", message: "This person is not eligible for the selected ExpoPoints program." });
    const eventIds = await getProgramEventIds(db, program.id);
    if (input.eventId && !eventIds.includes(input.eventId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Select an event instance included in this ExpoPoints program." });
    try {
      const created = await db.insert(expoPointsTransactions).values({ programId: program.id, eventId: input.eventId ?? null, userId: input.userId, activityType: input.activityType, points: input.points, description: input.description, sourceKey: input.sourceKey || null, awardedByUserId: ctx.user.id }).$returningId();
      return { id: created[0]?.id ?? null };
    } catch (error: any) {
      if (error?.code === "ER_DUP_ENTRY" || error?.message?.includes("Duplicate entry")) throw new TRPCError({ code: "CONFLICT", message: "This activity was already recorded for this ExpoPoints program." });
      throw error;
    }
  }),

  adminSaveReward: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), programId: z.number().int().positive(), title: z.string().trim().min(2).max(255), description: z.string().trim().max(4_000).optional().or(z.literal("")), pointsCost: z.number().int().min(1).max(1_000_000), inventoryLimit: z.number().int().min(1).max(100_000).nullable().optional(), isActive: z.boolean(), sortOrder: z.number().int().min(0).max(10_000).default(0) })).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" }); await getProgram(db, input.programId);
    const values = { programId: input.programId, title: input.title, description: input.description || null, pointsCost: input.pointsCost, inventoryLimit: input.inventoryLimit ?? null, isActive: input.isActive, sortOrder: input.sortOrder };
    if (input.id) { await db.update(expoPointsRewards).set(values).where(and(eq(expoPointsRewards.id, input.id), eq(expoPointsRewards.programId, input.programId))); return { id: input.id, updated: true }; }
    const created = await db.insert(expoPointsRewards).values(values).$returningId(); return { id: created[0]?.id ?? null, updated: false };
  }),

  adminSetRedemptionStatus: protectedProcedure.input(z.object({ redemptionId: z.number().int().positive(), status: redemptionStatusInput, fulfillmentNote: z.string().trim().max(4_000).optional().or(z.literal("")) })).mutation(async ({ ctx, input }) => {
    await assertExpoAdmin(ctx.user); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [redemption] = await db.select().from(expoPointsRedemptions).where(eq(expoPointsRedemptions.id, input.redemptionId)).limit(1);
    if (!redemption) throw new TRPCError({ code: "NOT_FOUND", message: "This reward request was not found." });
    const program = await getProgram(db, redemption.programId);
    if (input.status === "fulfilled" && redemption.status !== "fulfilled") {
      const balance = await getExpoPointsBalance(db, program.id, redemption.userId);
      if (balance < redemption.pointsCost) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The participant no longer has enough ExpoPoints to fulfill this reward." });
      const created = await db.insert(expoPointsTransactions).values({ programId: program.id, userId: redemption.userId, activityType: "reward_redemption", points: -redemption.pointsCost, description: `Redeemed reward #${redemption.rewardId}`, sourceKey: `reward-redemption:${redemption.id}`, awardedByUserId: ctx.user.id }).$returningId();
      await db.update(expoPointsRewards).set({ redeemedCount: sql`${expoPointsRewards.redeemedCount} + 1` }).where(eq(expoPointsRewards.id, redemption.rewardId));
      await db.update(expoPointsRedemptions).set({ status: "fulfilled", transactionId: created[0]?.id ?? null, fulfillmentNote: input.fulfillmentNote || null, fulfilledByUserId: ctx.user.id, fulfilledAt: new Date() }).where(eq(expoPointsRedemptions.id, redemption.id));
      return { status: "fulfilled" as const };
    }
    if (redemption.status === "fulfilled" && input.status !== "fulfilled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Fulfilled rewards are retained for audit history and cannot be reversed here." });
    await db.update(expoPointsRedemptions).set({ status: input.status, fulfillmentNote: input.fulfillmentNote || null, fulfilledByUserId: input.status === "cancelled" ? ctx.user.id : redemption.fulfilledByUserId, fulfilledAt: input.status === "cancelled" ? new Date() : redemption.fulfilledAt }).where(eq(expoPointsRedemptions.id, redemption.id));
    return { status: input.status };
  }),
});
