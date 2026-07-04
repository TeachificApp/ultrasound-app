/**
 * sonoTravelersRouter.ts
 *
 * Handles the Sono Travelers community intake flow:
 *   - Public form submission (no login required)
 *   - Automatic community access grant on submission
 *   - Admin lead management
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, communities, communityMembers, sonoTravelersLeads } from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { ENV } from "../_core/env";
import { notifyOwner } from "../_core/notification";

/** Slug for the Sono Travelers community — must match the seeded row */
const SONO_TRAVELERS_SLUG = "sono-travelers";

/** Resolve the Sono Travelers community ID from the DB */
async function getSonoTravelersCommunityId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [c] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(eq(communities.slug, SONO_TRAVELERS_SLUG))
    .limit(1);
  return c?.id ?? null;
}

export const sonoTravelersRouter = router({
  /**
   * Submit the Sono Travelers intake form.
   * Public — no login required.
   * Grants immediate community access by:
   *   1. Finding or creating a stub user account by email.
   *   2. Inserting a communityMembers row (approved).
   *   3. Saving the lead record with communityAccessGranted = true.
   */
  submitLead: publicProcedure
    .input(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(255),
        registryCredentials: z.string().max(300).optional(),
        travelType: z.enum(["short_term", "long_term", "both"]),
        currentLocation: z.string().max(200).optional(),
        travelAgency: z.string().max(200).optional(),
        yearsTravel: z.string().max(50).optional(),
        scanSpecialties: z.string().max(500).optional(),
        additionalInfo: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const communityId = await getSonoTravelersCommunityId();
      if (!communityId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sono Travelers community not found." });
      }

      // ── 1. Find or create stub user by email ──────────────────────────────
      let userId: number | null = null;
      let isNewUser = false;
      const emailLower = input.email.toLowerCase().trim();

      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create a pending stub account so the user can log in later
        const fullName = `${input.firstName} ${input.lastName}`.trim();
        const [newUser] = await db.insert(users).values({
          name: fullName,
          email: emailLower,
          firstName: input.firstName,
          lastName: input.lastName,
          credentials: input.registryCredentials ?? null,
          isPending: true,
          pendingCreatedAt: new Date(),
          loginMethod: "pending",
          role: "user",
        });
        userId = (newUser as any).insertId as number;
        isNewUser = true;
      }

      // ── 2. Grant community access ─────────────────────────────────────────
      let communityMemberId: number | null = null;
      if (userId) {
        // Check if already a member
        const [existingMember] = await db
          .select({ id: communityMembers.id })
          .from(communityMembers)
          .where(
            and(
              eq(communityMembers.communityId, communityId),
              eq(communityMembers.userId, userId)
            )
          )
          .limit(1);

        if (existingMember) {
          communityMemberId = existingMember.id;
          // Ensure approved status
          await db
            .update(communityMembers)
            .set({ memberStatus: "approved" })
            .where(eq(communityMembers.id, existingMember.id));
        } else {
          const [memberResult] = await db.insert(communityMembers).values({
            communityId,
            userId,
            role: "member",
            memberStatus: "approved",
          });
          communityMemberId = (memberResult as any).insertId as number;
        }
      }

      // ── 3. Save lead record ───────────────────────────────────────────────
      const travelTypeLabel =
        input.travelType === "short_term"
          ? "Short-Term (<13 weeks)"
          : input.travelType === "long_term"
          ? "Long-Term (13+ weeks)"
          : "Both Short-Term & Long-Term";

      const [leadResult] = await db.insert(sonoTravelersLeads).values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: emailLower,
        registryCredentials: input.registryCredentials ?? null,
        travelType: input.travelType,
        currentLocation: input.currentLocation ?? null,
        travelAgency: input.travelAgency ?? null,
        yearsTravel: input.yearsTravel ?? null,
        scanSpecialties: input.scanSpecialties ?? null,
        additionalInfo: input.additionalInfo ?? null,
        userId: userId ?? null,
        communityAccessGranted: true,
        communityMemberId: communityMemberId ?? null,
        status: "new",
      });
      const leadId = (leadResult as any).insertId as number;

      // ── 4. Notify owner ───────────────────────────────────────────────────
      await notifyOwner({
        title: "New Sono Travelers Member",
        content: `${input.firstName} ${input.lastName} (${input.email}) joined Sono Travelers.\nTravel type: ${travelTypeLabel}\nCredentials: ${input.registryCredentials ?? "—"}\nLocation: ${input.currentLocation ?? "—"}\nAgency: ${input.travelAgency ?? "—"}\nSpecialties: ${input.scanSpecialties ?? "—"}\nNew user: ${isNewUser ? "Yes" : "No"}`,
      });

      // ── 5. Send admin email ───────────────────────────────────────────────
      try {
        const adminEmail = ENV.platformAdminEmail;
        await sendEmail({
          to: { name: "All About Ultrasound Admin", email: adminEmail },
          subject: `New Sono Travelers Member: ${input.firstName} ${input.lastName}`,
          htmlBody: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#0d9488;margin-bottom:4px;">New Sono Travelers Member</h2>
              <p style="color:#666;margin-top:0;">A travel sonographer just joined the Sono Travelers community.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <tr><td style="padding:8px 0;color:#888;width:160px;">Name</td><td style="padding:8px 0;font-weight:600;">${input.firstName} ${input.lastName}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Email</td><td style="padding:8px 0;"><a href="mailto:${input.email}" style="color:#0d9488;">${input.email}</a></td></tr>
                <tr><td style="padding:8px 0;color:#888;">Registry Credentials</td><td style="padding:8px 0;">${input.registryCredentials ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Travel Type</td><td style="padding:8px 0;">${travelTypeLabel}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Current Location</td><td style="padding:8px 0;">${input.currentLocation ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Travel Agency</td><td style="padding:8px 0;">${input.travelAgency ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Years Traveling</td><td style="padding:8px 0;">${input.yearsTravel ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">Scan Specialties</td><td style="padding:8px 0;">${input.scanSpecialties ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;vertical-align:top;">Additional Info</td><td style="padding:8px 0;">${input.additionalInfo ?? "—"}</td></tr>
                <tr><td style="padding:8px 0;color:#888;">New Account</td><td style="padding:8px 0;">${isNewUser ? "Yes — stub account created" : "No — linked to existing account"}</td></tr>
              </table>
              <p style="margin-top:24px;font-size:12px;color:#aaa;">Community access granted immediately. Lead ID: #${leadId}</p>
            </div>`,
          brandMode: "aaus",
        });
      } catch (_emailErr) {
        // Non-blocking — don't fail the submission if email fails
        console.error("[SonoTravelers] Failed to send admin email:", _emailErr);
      }

      return {
        success: true,
        leadId,
        communityAccessGranted: true,
        communitySlug: SONO_TRAVELERS_SLUG,
        isNewUser,
      };
    }),

  /**
   * Get the current user's Sono Travelers profile (if they submitted the form).
   * Protected — requires login.
   */
  getMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [lead] = await db
      .select()
      .from(sonoTravelersLeads)
      .where(eq(sonoTravelersLeads.userId, ctx.user.id))
      .limit(1);
    return lead ?? null;
  }),

  /**
   * Check if the current user has access to the Sono Travelers community.
   * Public — returns false if not logged in.
   */
  checkAccess: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { hasAccess: false, communitySlug: SONO_TRAVELERS_SLUG };
    const db = await getDb();
    if (!db) return { hasAccess: false, communitySlug: SONO_TRAVELERS_SLUG };
    const communityId = await getSonoTravelersCommunityId();
    if (!communityId) return { hasAccess: false, communitySlug: SONO_TRAVELERS_SLUG };
    const [member] = await db
      .select({ id: communityMembers.id })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, ctx.user.id),
          eq(communityMembers.memberStatus, "approved")
        )
      )
      .limit(1);
    return { hasAccess: !!member, communitySlug: SONO_TRAVELERS_SLUG };
  }),

  // ─── Admin procedures ────────────────────────────────────────────────────

  /** Admin: list all Sono Travelers leads */
  adminListLeads: protectedProcedure
    .input(
      z.object({
        status: z.enum(["all", "new", "contacted", "closed"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return { leads: [], total: 0 };
      const whereClause =
        input.status === "all"
          ? undefined
          : eq(sonoTravelersLeads.status, input.status);
      const leads = await db
        .select()
        .from(sonoTravelersLeads)
        .where(whereClause)
        .orderBy(desc(sonoTravelersLeads.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(sonoTravelersLeads)
        .where(whereClause);
      return { leads, total: Number(total) };
    }),

  /** Admin: update lead status and notes */
  adminUpdateLead: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "closed"]).optional(),
        adminNotes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.adminNotes !== undefined) updates.adminNotes = input.adminNotes;
      await db
        .update(sonoTravelersLeads)
        .set(updates)
        .where(eq(sonoTravelersLeads.id, input.id));
      return { success: true };
    }),
});
