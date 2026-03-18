import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getUserRoles,
  assignRole,
  removeRole,
  listUsersWithRoles,
  countUsers,
  getDiyUsersForLab,
  getLabByAdmin,
  findUserByEmailWithRoles,
  createPendingUser,
  countPendingUsers,
  cleanupUserRolesDb,
  type AppRole,
  type UserTypeFilter,
} from "../db";
import { syncCatalogToDb } from "./cmeRouter";
import { sendEmail, buildWelcomeEmail } from "../_core/email";

/** Send a branded welcome email to a pre-registered user via SendGrid */
async function sendPreRegistrationWelcome(email: string, roles: string[]): Promise<void> {
  const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
  const payload = buildWelcomeEmail({
    firstName: email.split("@")[0], // best-effort first name from email
    loginUrl: `${appUrl}/login`,
    roles,
  });
  const sent = await sendEmail({
    to: { name: email, email },
    subject: payload.subject,
    htmlBody: payload.htmlBody,
    previewText: payload.previewText,
  });
  if (!sent) {
    console.warn(`[AdminEmail] Welcome email to ${email} could not be sent (SendGrid unavailable)`);
  }
}

// ─── Platform Admin Router ────────────────────────────────────────────────────
// Manages user roles and seat assignments for the iHeartEcho™ platform.
// Access: platform_admin role or owner (role === "admin")

export const platformAdminRouter = router({
   /** Check if current user is a platform admin */
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    const roles = await getUserRoles(ctx.user.id);
    return ctx.user.role === "admin" || roles.includes("platform_admin");
  }),

  /** Count pre-registered users who have not yet signed in */
  countPending: protectedProcedure.query(async ({ ctx }) => {
    const roles = await getUserRoles(ctx.user.id);
    const isOwner = ctx.user.role === "admin";
    const isPlatformAdmin = roles.includes("platform_admin");
    if (!isOwner && !isPlatformAdmin) return 0;
    return countPendingUsers();
  }),

  /** List all users with their roles (paginated, with optional search and type filter) */
  listUsers: protectedProcedure
    .input(z.object({
      limit: z.number().max(500).default(50),
      offset: z.number().default(0),
      search: z.string().optional().default(''),
      userType: z.enum(['all','pending','active','premium','diy_admin','diy_user','platform_admin','free']).optional().default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const roles = await getUserRoles(ctx.user.id);
      if (ctx.user.role !== "admin" && !roles.includes("platform_admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }
      return listUsersWithRoles(input.limit, input.offset, input.userType as UserTypeFilter, input.search);
    }),

  /** Get total user count */
  userCount: protectedProcedure.query(async ({ ctx }) => {
    const roles = await getUserRoles(ctx.user.id);
    if (ctx.user.role !== "admin" && !roles.includes("platform_admin")) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return countUsers();
  }),

  /** Get roles for a specific user */
  getUserRoles: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      if (ctx.user.role !== "admin" && !myRoles.includes("platform_admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getUserRoles(input.userId);
    }),

  /** Assign a role to a user */
  assignRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager"]),
      grantedByLabId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      const isOwner = ctx.user.role === "admin";
      const isPlatformAdmin = myRoles.includes("platform_admin");
      // Only owner can assign platform_admin role
      if (input.role === "platform_admin" && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can assign platform_admin" });
      }
      // Only platform_admin (or owner) can assign accreditation_manager role
      if (input.role === "accreditation_manager" && !isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a platform admin can assign the Accreditation Manager role" });
      }
      if (!isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await assignRole(input.userId, input.role as AppRole, ctx.user.id, input.grantedByLabId);
      return { success: true };
    }),

  /** Remove a role from a user */
  removeRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      const isOwner = ctx.user.role === "admin";
      const isPlatformAdmin = myRoles.includes("platform_admin");
      if (!isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Cannot remove the base "user" role
      if (input.role === "user") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the base user role" });
      }
      // Only platform_admin (or owner) can remove accreditation_manager role
      if (input.role === "accreditation_manager" && !isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a platform admin can remove the Accreditation Manager role" });
      }
      await removeRole(input.userId, input.role as AppRole);
      return { success: true };
    }),

  /** Get my own roles */
  myRoles: protectedProcedure.query(async ({ ctx }) => {
    return getUserRoles(ctx.user.id);
  }),

  /**
   * Look up a user by email address.
   * Returns the user + their current roles, or null if not found.
   * Used by the "Add user by email" flow in Platform Admin.
   */
  findUserByEmail: protectedProcedure
    .input(z.object({ email: z.string().email("Please enter a valid email address") }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      if (ctx.user.role !== "admin" && !myRoles.includes("platform_admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }
      const found = await findUserByEmailWithRoles(input.email);
      if (!found) return null;
      return {
        id: found.id,
        name: found.name,
        email: found.email,
        displayName: found.displayName,
        role: found.role,
        roles: found.roles,
        createdAt: found.createdAt,
        lastSignedIn: found.lastSignedIn,
        isPending: found.isPending,
      };
    }),

  /**
   * Bulk assign a role to multiple users by email.
   * Returns per-row results: success | already_assigned | not_found | error
   * Processes up to 500 emails per call.
   */
  bulkAssignRole: protectedProcedure
    .input(z.object({
      emails: z.array(z.string().email()).min(1).max(500),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      const isOwner = ctx.user.role === "admin";
      const isPlatformAdmin = myRoles.includes("platform_admin");
      if (!isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
      }
      if (input.role === "platform_admin" && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can assign platform_admin" });
      }
      if (input.role === "accreditation_manager" && !isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a platform admin can assign the Accreditation Manager role" });
      }

      const results: Array<{
        email: string;
        status: "success" | "already_assigned" | "pre_registered" | "error";
        displayName?: string;
        message?: string;
      }> = [];

      for (const email of input.emails) {
        try {
          const found = await findUserByEmailWithRoles(email);
          if (!found) {
            // Pre-register: create stub account and assign role immediately
            const newId = await createPendingUser(email);
            await assignRole(newId, input.role as AppRole, ctx.user.id);
            results.push({ email, status: "pre_registered" as const, displayName: email });
            // Send welcome email asynchronously (don't block the response)
            sendPreRegistrationWelcome(email, [input.role]).catch(err =>
              console.error("[AdminEmail] Failed to send welcome email:", err)
            );
            continue;
          }
          if (found.roles.includes(input.role)) {
            results.push({ email, status: "already_assigned", displayName: found.displayName ?? found.name ?? undefined });
            continue;
          }
          await assignRole(found.id, input.role as AppRole, ctx.user.id);
          results.push({ email, status: "success", displayName: found.displayName ?? found.name ?? undefined });
        } catch (err) {
          results.push({ email, status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      return {
        total: results.length,
        succeeded: results.filter(r => r.status === "success").length,
        alreadyAssigned: results.filter(r => r.status === "already_assigned").length,
        preRegistered: results.filter(r => r.status === "pre_registered").length,
        errors: results.filter(r => r.status === "error").length,
        rows: results,
      };
    }),

  /**
   * Assign a role to a user looked up by email.
   * Convenience wrapper so the UI can do email → role in one step.
   */
  assignRoleByEmail: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["user", "premium_user", "diy_admin", "diy_user", "platform_admin", "accreditation_manager"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      const isOwner = ctx.user.role === "admin";
      const isPlatformAdmin = myRoles.includes("platform_admin");
      if (!isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.role === "platform_admin" && !isOwner) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can assign platform_admin" });
      }
      if (input.role === "accreditation_manager" && !isOwner && !isPlatformAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only a platform admin can assign the Accreditation Manager role" });
      }
      let found = await findUserByEmailWithRoles(input.email);
      let wasPreRegistered = false;
      if (!found) {
        // Pre-register: create a stub account and assign the role immediately
        const newId = await createPendingUser(input.email);
        await assignRole(newId, input.role as AppRole, ctx.user.id);
        wasPreRegistered = true;
        // Send welcome email asynchronously (don't block the response)
        sendPreRegistrationWelcome(input.email, [input.role]).catch(err =>
          console.error("[AdminEmail] Failed to send welcome email:", err)
        );
        return { success: true, userId: newId, displayName: input.email, wasPreRegistered };
      }
      await assignRole(found.id, input.role as AppRole, ctx.user.id);
      return { success: true, userId: found.id, displayName: found.displayName ?? found.name, wasPreRegistered: false };
    }),

  /**
   * Manually trigger a Thinkific course catalog re-sync.
   * Fetches all products from Thinkific, filters to the E-Learning & CME collection,
   * and upserts into the cmeCoursesCache table.
   * Returns the number of courses synced and the timestamp.
   */
  syncThinkificCourses: protectedProcedure.mutation(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    const isOwner = ctx.user.role === "admin";
    const isPlatformAdmin = myRoles.includes("platform_admin");
    if (!isOwner && !isPlatformAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
    }
    const count = await syncCatalogToDb();
    return { count, syncedAt: new Date() };
  }),

  /**
   * Manually trigger a Thinkific catalog re-sync for the Registry Review collection.
   * Same underlying sync as syncThinkificCourses — both collections share the same cache table.
   */
  syncRegistryCourses: protectedProcedure.mutation(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    const isOwner = ctx.user.role === "admin";
    const isPlatformAdmin = myRoles.includes("platform_admin");
    if (!isOwner && !isPlatformAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
    }
    const count = await syncCatalogToDb();
    return { count, syncedAt: new Date() };
  }),

  /**
   * Clean up duplicate and missing user roles.
   * - Removes duplicate 'user' role entries (keeps the lowest id)
   * - Backfills missing 'user' role for all non-pending accounts
   * Returns counts of deduped and backfilled rows.
   */
  cleanupUserRoles: protectedProcedure.mutation(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    const isOwner = ctx.user.role === "admin";
    const isPlatformAdmin = myRoles.includes("platform_admin");
    if (!isOwner && !isPlatformAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
    }
    return cleanupUserRolesDb();
  }),

  /**
   * Bulk backfill: fetch all users from Thinkific and create iHeartEcho accounts
   * for anyone not already registered. Runs silently (no emails sent).
   * Returns counts of created, skipped (already existed), and errors.
   */
  syncAllThinkificMembers: protectedProcedure.mutation(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    const isOwner = ctx.user.role === "admin";
    const isPlatformAdmin = myRoles.includes("platform_admin");
    if (!isOwner && !isPlatformAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
    }

    const { getAllThinkificUsers } = await import("../thinkific");
    const { findUserByEmail, ensureUserRole } = await import("../db");

    const thinkificUsers = await getAllThinkificUsers();
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tUser of thinkificUsers) {
      if (!tUser.email) { errors++; continue; }
      try {
        const existing = await findUserByEmail(tUser.email);
        if (existing) {
          await ensureUserRole(existing.id);
          skipped++;
        } else {
          const newId = await createPendingUser(tUser.email);
          await ensureUserRole(newId);
          created++;
        }
      } catch (err) {
        console.error(`[SyncThinkific] Error processing ${tUser.email}:`, err);
        errors++;
      }
    }

    console.log(`[SyncThinkific] Bulk sync complete: ${created} created, ${skipped} skipped, ${errors} errors out of ${thinkificUsers.length} Thinkific users`);
    return { total: thinkificUsers.length, created, skipped, errors, syncedAt: new Date() };
  }),
});

// ─── Lab Seat Management Router ───────────────────────────────────────────────
// DIY Accreditation Tool™ seat management — controlled by diy_admin role

export const labSeatsRouter = router({
  /** List DIY users for the current admin's lab */
  listDiyUsers: protectedProcedure.query(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    if (!myRoles.includes("diy_admin") && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "DIY Admin access required" });
    }
    const lab = await getLabByAdmin(ctx.user.id);
    if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
    return getDiyUsersForLab(lab.id);
  }),

  /** Assign a DIY user seat */
  assignSeat: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      if (!myRoles.includes("diy_admin") && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const lab = await getLabByAdmin(ctx.user.id);
      if (!lab) throw new TRPCError({ code: "NOT_FOUND" });
      // Check seat limit from subscription
      const seatLimit = (lab as any).seatCount ?? 1;
      const currentSeats = await getDiyUsersForLab(lab.id);
      if (currentSeats.length >= seatLimit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Seat limit reached (${seatLimit} seats). Upgrade your subscription to add more users.`,
        });
      }
      await assignRole(input.userId, "diy_user", ctx.user.id, lab.id);
      return { success: true };
    }),

  /** Revoke a DIY user seat */
  revokeSeat: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      if (!myRoles.includes("diy_admin") && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await removeRole(input.userId, "diy_user");
      return { success: true };
    }),

  /**
   * Bulk assign DIY seats to multiple users by email.
   * Respects the lab's seat limit — stops and reports when limit is reached.
   * Returns per-row results: success | already_assigned | not_found | seat_limit_reached | error
   */
  bulkAssignSeat: protectedProcedure
    .input(z.object({
      emails: z.array(z.string().email()).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const myRoles = await getUserRoles(ctx.user.id);
      if (!myRoles.includes("diy_admin") && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "DIY Admin access required" });
      }
      const lab = await getLabByAdmin(ctx.user.id);
      if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });

      const seatLimit = (lab as any).seatCount ?? 1;
      let currentSeats = await getDiyUsersForLab(lab.id);

      const results: Array<{
        email: string;
        status: "success" | "already_assigned" | "pre_registered" | "seat_limit_reached" | "error";
        displayName?: string;
        message?: string;
      }> = [];

      for (const email of input.emails) {
        // Re-check seat count each iteration
        if (currentSeats.length >= seatLimit) {
          results.push({ email, status: "seat_limit_reached", message: `Seat limit of ${seatLimit} reached` });
          continue;
        }
        try {
          const found = await findUserByEmailWithRoles(email);
          if (!found) {
            // Pre-register: create stub account and assign diy_user seat immediately
            const newId = await createPendingUser(email);
            await assignRole(newId, "diy_user", ctx.user.id, lab.id);
            currentSeats = [...currentSeats, { id: newId, email } as any];
            results.push({ email, status: "pre_registered" as const, displayName: email });
            continue;
          }
          if (found.roles.includes("diy_user")) {
            results.push({ email, status: "already_assigned", displayName: found.displayName ?? found.name ?? undefined });
            continue;
          }
          await assignRole(found.id, "diy_user", ctx.user.id, lab.id);
          // Increment local count to avoid extra DB round-trip
          currentSeats = [...currentSeats, found as any];
          results.push({ email, status: "success", displayName: found.displayName ?? found.name ?? undefined });
        } catch (err) {
          results.push({ email, status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      return {
        total: results.length,
        succeeded: results.filter(r => r.status === "success").length,
        alreadyAssigned: results.filter(r => r.status === "already_assigned").length,
        preRegistered: results.filter(r => r.status === "pre_registered").length,
        seatLimitReached: results.filter(r => r.status === "seat_limit_reached").length,
        errors: results.filter(r => r.status === "error").length,
        rows: results,
        seatUsage: { used: currentSeats.length, total: seatLimit },
      };
    }),

  /** One-time cleanup: deduplicate userRoles and backfill missing 'user' roles */
  cleanupUserRoles: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
    }
    return cleanupUserRolesDb();
  }),

  /** Get seat usage for current lab */
  seatUsage: protectedProcedure.query(async ({ ctx }) => {
    const myRoles = await getUserRoles(ctx.user.id);
    if (!myRoles.includes("diy_admin") && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const lab = await getLabByAdmin(ctx.user.id);
    if (!lab) return { used: 0, total: 0 };
    const seats = await getDiyUsersForLab(lab.id);
    return { used: seats.length, total: (lab as any).seatCount ?? 1 };
  }),
});
