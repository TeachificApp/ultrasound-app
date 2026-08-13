import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { bundles, contentWaitlistEntries, digitalProducts, lmsCohortGroups, lmsCourses, membershipPlans, standaloneQuizzes, users, webinars, workshopInstances, workshops } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendEmail } from "../_core/email";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const waitlistProductType = z.enum(["course", "cohort_group", "workshop", "workshop_instance", "webinar", "download", "bundle", "membership", "quiz"]);

type WaitlistProductType = z.infer<typeof waitlistProductType>;

async function getWaitlistTarget(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, productType: WaitlistProductType, productId: number) {
  switch (productType) {
    case "course": {
      const [row] = await db.select({ id: lmsCourses.id, title: lmsCourses.title, status: lmsCourses.status })
        .from(lmsCourses).where(eq(lmsCourses.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "cohort_group": {
      const [row] = await db.select({ id: lmsCohortGroups.id, title: lmsCohortGroups.name, status: lmsCohortGroups.status, parentProductId: lmsCohortGroups.courseId })
        .from(lmsCohortGroups).where(eq(lmsCohortGroups.id, productId)).limit(1);
      return row ?? null;
    }
    case "workshop": {
      const [row] = await db.select({ id: workshops.id, title: workshops.title, status: workshops.status })
        .from(workshops).where(eq(workshops.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "workshop_instance": {
      const [row] = await db.select({ id: workshopInstances.id, title: workshopInstances.title, status: workshopInstances.status, parentProductId: workshopInstances.workshopId })
        .from(workshopInstances).where(eq(workshopInstances.id, productId)).limit(1);
      return row ?? null;
    }
    case "webinar": {
      const [row] = await db.select({ id: webinars.id, title: webinars.title, status: webinars.status })
        .from(webinars).where(eq(webinars.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "download": {
      const [row] = await db.select({ id: digitalProducts.id, title: digitalProducts.title, status: digitalProducts.status })
        .from(digitalProducts).where(eq(digitalProducts.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "bundle": {
      const [row] = await db.select({ id: bundles.id, title: bundles.title, status: bundles.status })
        .from(bundles).where(eq(bundles.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "membership": {
      const [row] = await db.select({ id: membershipPlans.id, title: membershipPlans.title, status: membershipPlans.status })
        .from(membershipPlans).where(eq(membershipPlans.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
    case "quiz": {
      const [row] = await db.select({ id: standaloneQuizzes.id, title: standaloneQuizzes.title, status: standaloneQuizzes.status })
        .from(standaloneQuizzes).where(eq(standaloneQuizzes.id, productId)).limit(1);
      return row ? { ...row, parentProductId: null } : null;
    }
  }
}

export const contentAvailabilityRouter = router({
  /** Visitor request to join a product or individual enrolment-instance waitlist. */
  joinWaitlist: publicProcedure
    .input(z.object({
      productType: waitlistProductType,
      productId: z.number().int().positive(),
      name: z.string().trim().min(1).max(255),
      email: z.string().trim().email().max(255),
      userId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const target = await getWaitlistTarget(db, input.productType, input.productId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "This content is no longer available." });
      if ((target.status as string) !== "waitlist") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This content is not currently accepting waitlist signups." });
      }
      const normalizedEmail = input.email.toLowerCase();
      const [existing] = await db.select({ id: contentWaitlistEntries.id })
        .from(contentWaitlistEntries)
        .where(and(
          eq(contentWaitlistEntries.productType, input.productType),
          eq(contentWaitlistEntries.productId, input.productId),
          eq(contentWaitlistEntries.email, normalizedEmail),
        ))
        .limit(1);
      if (existing) return { success: true, alreadyJoined: true, title: target.title };
      await db.insert(contentWaitlistEntries).values({
        productType: input.productType,
        productId: input.productId,
        parentProductId: target.parentProductId,
        userId: input.userId ?? null,
        name: input.name,
        email: normalizedEmail,
      });
      return { success: true, alreadyJoined: false, title: target.title };
    }),

  /** Platform Admin waitlist view across products and individual instances. */
  listWaitlistEntries: adminProcedure
    .input(z.object({
      productType: waitlistProductType.optional(),
      productId: z.number().int().positive().optional(),
      parentProductId: z.number().int().positive().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [];
      if (input?.productType) conditions.push(eq(contentWaitlistEntries.productType, input.productType));
      if (input?.productId) conditions.push(eq(contentWaitlistEntries.productId, input.productId));
      if (input?.parentProductId) conditions.push(eq(contentWaitlistEntries.parentProductId, input.parentProductId));
      return db.select().from(contentWaitlistEntries)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(contentWaitlistEntries.createdAt));
    }),

  /** Explicit admin action; no waitlist email is ever sent automatically. */
  notifyEnrollmentOpen: adminProcedure
    .input(z.object({
      productType: waitlistProductType,
      productId: z.number().int().positive(),
      entryIds: z.array(z.number().int().positive()).min(1),
      subject: z.string().trim().min(1).max(500),
      messageHtml: z.string().trim().min(1),
      enrollmentUrl: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const entries = await db.select().from(contentWaitlistEntries).where(and(
        eq(contentWaitlistEntries.productType, input.productType),
        eq(contentWaitlistEntries.productId, input.productId),
        inArray(contentWaitlistEntries.id, input.entryIds),
      ));
      let sent = 0;
      for (const entry of entries) {
        await sendEmail({
          to: entry.email,
          subject: input.subject,
          htmlBody: `${input.messageHtml}<p style="margin-top:24px"><a href="${input.enrollmentUrl}" style="display:inline-block;padding:12px 18px;background:#189aa1;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">Enroll now</a></p>`,
        });
        sent += 1;
      }
      if (entries.length) {
        await db.update(contentWaitlistEntries).set({ notifiedAt: new Date() })
          .where(inArray(contentWaitlistEntries.id, entries.map(entry => entry.id)));
      }
      return { success: true, sent, selected: entries.length };
    }),
});
