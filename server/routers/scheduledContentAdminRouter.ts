import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  digitalProducts,
  lmsCohortGroupEnrollments,
  lmsCohortGroups,
  lmsCourses,
  scheduledContentLinks,
  webinars,
  workshopEnrollments,
  workshopInstances,
  workshops,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { assertAdmin } from "./lmsHelpers";
import { grantScheduledContentAccess } from "../lib/scheduledContentLinks";

const sourceTypeSchema = z.enum(["cohort_group", "workshop_instance"]);
const targetTypeSchema = z.enum(["course", "download", "webinar", "workshop_instance"]);

async function assertSourceExists(db: any, sourceType: z.infer<typeof sourceTypeSchema>, sourceId: number) {
  const table = sourceType === "cohort_group" ? lmsCohortGroups : workshopInstances;
  const [source] = await db.select({ id: table.id }).from(table).where(eq(table.id, sourceId)).limit(1);
  if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Scheduled source was not found." });
}

async function assertTargetExists(db: any, targetType: z.infer<typeof targetTypeSchema>, targetId: number) {
  const table = targetType === "course" ? lmsCourses
    : targetType === "download" ? digitalProducts
    : targetType === "webinar" ? webinars
    : workshopInstances;
  const [target] = await db.select({ id: table.id }).from(table).where(eq(table.id, targetId)).limit(1);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Linked content was not found." });
}

export const scheduledContentAdminRouter = router({
  list: protectedProcedure
    .input(z.object({ sourceType: sourceTypeSchema, sourceId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await assertSourceExists(db, input.sourceType, input.sourceId);
      return db.select().from(scheduledContentLinks).where(and(
        eq(scheduledContentLinks.sourceType, input.sourceType),
        eq(scheduledContentLinks.sourceId, input.sourceId),
      )).orderBy(asc(scheduledContentLinks.sortOrder), asc(scheduledContentLinks.id));
    }),

  catalog: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [courses, downloads, webinarRows, instances] = await Promise.all([
      db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, status: lmsCourses.status })
        .from(lmsCourses).orderBy(asc(lmsCourses.title)),
      db.select({ id: digitalProducts.id, title: digitalProducts.title, status: digitalProducts.status })
        .from(digitalProducts).orderBy(asc(digitalProducts.title)),
      db.select({ id: webinars.id, title: webinars.title, status: webinars.status })
        .from(webinars).orderBy(asc(webinars.title)),
      db.select({ id: workshopInstances.id, title: workshopInstances.title, startDate: workshopInstances.startDate, workshopTitle: workshops.title })
        .from(workshopInstances).innerJoin(workshops, eq(workshops.id, workshopInstances.workshopId))
        .orderBy(asc(workshops.title), asc(workshopInstances.startDate)),
    ]);
    return { courses, downloads, webinars: webinarRows, workshopInstances: instances };
  }),

  create: protectedProcedure
    .input(z.object({
      sourceType: sourceTypeSchema,
      sourceId: z.number().int().positive(),
      targetType: targetTypeSchema,
      targetId: z.number().int().positive(),
      accessDurationDays: z.number().int().min(1).max(3650).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await Promise.all([
        assertSourceExists(db, input.sourceType, input.sourceId),
        assertTargetExists(db, input.targetType, input.targetId),
      ]);
      const [duplicate] = await db.select({ id: scheduledContentLinks.id }).from(scheduledContentLinks).where(and(
        eq(scheduledContentLinks.sourceType, input.sourceType),
        eq(scheduledContentLinks.sourceId, input.sourceId),
        eq(scheduledContentLinks.targetType, input.targetType),
        eq(scheduledContentLinks.targetId, input.targetId),
      )).limit(1);
      if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "This item is already linked to the scheduled run." });
      const [last] = await db.select({ sortOrder: scheduledContentLinks.sortOrder }).from(scheduledContentLinks)
        .where(and(eq(scheduledContentLinks.sourceType, input.sourceType), eq(scheduledContentLinks.sourceId, input.sourceId)))
        .orderBy(desc(scheduledContentLinks.sortOrder));
      const [inserted] = await db.insert(scheduledContentLinks).values({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        accessDurationDays: input.accessDurationDays ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdByUserId: ctx.user.id,
      }).$returningId();
      const participants = input.sourceType === "cohort_group"
        ? await db.select({ userId: lmsCohortGroupEnrollments.userId }).from(lmsCohortGroupEnrollments)
          .where(eq(lmsCohortGroupEnrollments.cohortGroupId, input.sourceId))
        : await db.select({ userId: workshopEnrollments.userId }).from(workshopEnrollments)
          .where(and(eq(workshopEnrollments.instanceId, input.sourceId), eq(workshopEnrollments.status, "active")));
      for (const participant of participants) {
        await grantScheduledContentAccess(db, { userId: participant.userId, sourceType: input.sourceType, sourceId: input.sourceId });
      }
      return { id: inserted.id, grantedToExistingParticipants: participants.length };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(scheduledContentLinks).where(eq(scheduledContentLinks.id, input.id));
      return { success: true };
    }),
});
