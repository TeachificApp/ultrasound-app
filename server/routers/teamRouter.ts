import { getStripeClient } from "../lib/stripeClient";
/**
 * Team / University Subscription Router
 *
 * Handles team/university subscriptions that grant brand premium access
 * to a pool of invited members.
 *
 * Pricing (per seat):
 *   AAUS monthly:      $9.97/seat/month  (15% off → $8.47 at 10+ seats)
 *   AAUS lifetime:     $99.97/seat       (15% off → $84.97 at 10+ seats)
 *   IHE monthly:       $9.97/seat/month  (15% off → $8.47 at 10+ seats)
 *   IHE lifetime:      $99.97/seat       (15% off → $84.97 at 10+ seats)
 *   Dual monthly:      $12.99/seat/month (15% off → $11.04 at 10+ seats)
 *   Dual lifetime:     $147.00/seat      (15% off → $124.95 at 10+ seats)
 *
 * Procedures:
 *   team.getPricing          — public: returns pricing matrix
 *   team.createCheckout      — protected: create Stripe checkout for team purchase
 *   team.getMyTeams          — protected: list teams where user is admin
 *   team.getTeamDetails      — protected: full team + members for admin
 *   team.inviteMember        — protected: invite a new member by email
 *   team.resendInvite        — protected: resend invite email
 *   team.revokeMember        — protected: revoke a seat
 *   team.updateSeatCount     — protected: increase seat count (monthly only)
 *   team.acceptInvite        — public: accept invite via token
 *   team.adminList           — admin: list all team subscriptions
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, count, desc, isNull, or } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { teamSubscriptions, teamMembers, brandMemberships, users } from "../../drizzle/schema";
import { sendEmail } from "../_core/email";
import { notifyOwner } from "../_core/notification";

// ─── Pricing Constants ────────────────────────────────────────────────────────

export const TEAM_PRICING = {
  aaus: {
    monthly: { base: 997, label: "$9.97/seat/month" },
    lifetime: { base: 9997, label: "$99.97/seat" },
  },
  iheartecho: {
    monthly: { base: 997, label: "$9.97/seat/month" },
    lifetime: { base: 9997, label: "$99.97/seat" },
  },
  dual: {
    monthly: { base: 1299, label: "$12.99/seat/month" },
    lifetime: { base: 14700, label: "$147.00/seat" },
  },
} as const;

export const TEAM_BULK_DISCOUNT_THRESHOLD = 10;
export const TEAM_BULK_DISCOUNT_PCT = 15;

function calcTeamPrice(brand: "aaus" | "iheartecho" | "dual", plan: "monthly" | "lifetime", seatCount: number) {
  const base = TEAM_PRICING[brand][plan].base;
  const discountPct = seatCount >= TEAM_BULK_DISCOUNT_THRESHOLD ? TEAM_BULK_DISCOUNT_PCT : 0;
  const pricePerSeat = Math.round(base * (1 - discountPct / 100));
  const total = pricePerSeat * seatCount;
  return { base, discountPct, pricePerSeat, total };
}

function generateInviteToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ─── Brand label helpers ──────────────────────────────────────────────────────
function brandLabel(brand: string): string {
  if (brand === "aaus") return "UltrasoundAssist™";
  if (brand === "iheartecho") return "EchoAssist™";
  return "UltrasoundAssist™ + EchoAssist™";
}

// ─── Grant premium access to a team member ────────────────────────────────────
export async function grantTeamMemberAccess(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  brand: "aaus" | "iheartecho" | "dual",
  plan: "monthly" | "lifetime",
  expiresAt: Date | null,
): Promise<number[]> {
  if (!db) return [];
  const brandsToGrant: Array<"aaus" | "iheartecho"> =
    brand === "dual" ? ["aaus", "iheartecho"] : [brand];
  const grantedIds: number[] = [];

  for (const b of brandsToGrant) {
    const [existing] = await db
      .select({ id: brandMemberships.id })
      .from(brandMemberships)
      .where(and(eq(brandMemberships.userId, userId), eq(brandMemberships.brand, b)))
      .limit(1);

    if (existing) {
      await db.update(brandMemberships).set({
        tier: plan === "lifetime" ? "lifetime" : "premium",
        status: "active",
        source: "team",
        expiresAt,
        updatedAt: new Date(),
      }).where(eq(brandMemberships.id, existing.id));
      grantedIds.push(existing.id);
    } else {
      const [inserted] = await db.insert(brandMemberships).values({
        userId,
        brand: b,
        tier: plan === "lifetime" ? "lifetime" : "premium",
        status: "active",
        source: "team",
        expiresAt,
      }).$returningId();
      if (inserted) grantedIds.push(inserted.id);
    }
  }
  return grantedIds;
}

// ─── Revoke premium access granted by a team seat ────────────────────────────
export async function revokeTeamMemberAccess(
  db: Awaited<ReturnType<typeof getDb>>,
  grantedMembershipIds: number[],
): Promise<void> {
  if (!db || grantedMembershipIds.length === 0) return;
  for (const mid of grantedMembershipIds) {
    await db.update(brandMemberships).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(brandMemberships.id, mid));
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const teamRouter = router({
  /**
   * Public: return pricing matrix for all brands and plans.
   */
  getPricing: publicProcedure
    .input(z.object({
      brand: z.enum(["aaus", "iheartecho", "dual"]),
      plan: z.enum(["monthly", "lifetime"]),
      seatCount: z.number().int().min(1).max(500),
    }))
    .query(({ input }) => {
      const { brand, plan, seatCount } = input;
      const { base, discountPct, pricePerSeat, total } = calcTeamPrice(brand, plan, seatCount);
      return {
        brand,
        plan,
        seatCount,
        basePricePerSeatCents: base,
        discountPct,
        pricePerSeatCents: pricePerSeat,
        totalCents: total,
        discountThreshold: TEAM_BULK_DISCOUNT_THRESHOLD,
        discountPctAvailable: TEAM_BULK_DISCOUNT_PCT,
      };
    }),

  /**
   * Protected: create a Stripe Checkout session for a team purchase.
   */
  createCheckout: protectedProcedure
    .input(z.object({
      orgName: z.string().min(2).max(200),
      brand: z.enum(["aaus", "iheartecho", "dual"]),
      plan: z.enum(["monthly", "lifetime"]),
      seatCount: z.number().int().min(1).max(500),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!process.env.STRIPE_SECRET_KEY?.trim()) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment system not configured." });
      }
      const { brand, plan, seatCount, orgName, origin } = input;
      const { discountPct, pricePerSeat, total } = calcTeamPrice(brand, plan, seatCount);

      const Stripe = (await import("stripe")).default;
      const stripe = getStripeClient();

      const unitAmountCents = pricePerSeat;
      const productName = `${brandLabel(brand)} — Team/University ${plan === "lifetime" ? "Lifetime" : "Monthly"} Access`;
      const description = `${seatCount} seat${seatCount > 1 ? "s" : ""}${discountPct > 0 ? ` (${discountPct}% bulk discount applied)` : ""}`;

      const lineItem = plan === "monthly"
        ? {
            price_data: {
              currency: "usd",
              product_data: { name: productName, description },
              unit_amount: unitAmountCents,
              recurring: { interval: "month" as const, interval_count: 1 },
            },
            quantity: seatCount,
          }
        : {
            price_data: {
              currency: "usd",
              product_data: { name: productName, description },
              unit_amount: unitAmountCents,
            },
            quantity: seatCount,
          };

      const session = await stripe.checkout.sessions.create({
        mode: plan === "monthly" ? "subscription" : "payment",
        customer_email: ctx.user.email ?? undefined,
        allow_promotion_codes: true,
        line_items: [lineItem],
        ...(plan === "monthly" ? {
          subscription_data: {
            description: `${productName} — ${seatCount} seats — Monthly Subscription — Initial`,
            metadata: {
              user_id: ctx.user.id.toString(),
              type: "team_subscription",
              brand,
              plan,
              seat_count: seatCount.toString(),
              org_name: orgName,
              discount_pct: discountPct.toString(),
              price_per_seat: pricePerSeat.toString(),
            },
          },
        } : { payment_intent_data: { description: `${productName} — ${seatCount} seats — One-Time Purchase` } }),
        success_url: `${origin}/team/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/team/subscribe`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          type: "team_subscription",
          brand,
          plan,
          seat_count: seatCount.toString(),
          org_name: orgName,
          discount_pct: discountPct.toString(),
          price_per_seat: pricePerSeat.toString(),
        },
      }, { idempotencyKey: `team-${ctx.user.id}-${brand}-${plan}-${seatCount}-${new Date().toISOString().slice(0, 10)}` });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session." });
      }
      return { checkoutUrl: session.url };
    }),

  /**
   * Protected: list teams where the current user is the admin.
   */
  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const teams = await db
      .select()
      .from(teamSubscriptions)
      .where(eq(teamSubscriptions.adminUserId, ctx.user.id))
      .orderBy(desc(teamSubscriptions.createdAt));

    // Attach used seat counts
    const result = await Promise.all(teams.map(async (team) => {
      const [{ value: usedSeats }] = await db
        .select({ value: count() })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.isActive, true)));
      return { ...team, usedSeats };
    }));
    return result;
  }),

  /**
   * Protected: get full team details + members (admin only).
   */
  getTeamDetails: protectedProcedure
    .input(z.object({ teamId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, input.teamId))
        .limit(1);

      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      if (team.adminUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, input.teamId))
        .orderBy(desc(teamMembers.createdAt));

      const usedSeats = members.filter(m => m.isActive).length;
      return { ...team, usedSeats, members };
    }),

  /**
   * Protected: invite a member by email to a team seat.
   */
  inviteMember: protectedProcedure
    .input(z.object({
      teamId: z.number().int().positive(),
      email: z.string().email(),
      displayName: z.string().max(100).optional(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, input.teamId))
        .limit(1);

      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found." });
      if (team.adminUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (team.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Team subscription is not active." });
      }

      // Check seat capacity
      const [{ value: usedSeats }] = await db
        .select({ value: count() })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.isActive, true)));

      if (usedSeats >= team.seatCount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `All ${team.seatCount} seats are in use. Increase your seat count to invite more members.`,
        });
      }

      // Check for existing active invite
      const [existing] = await db
        .select({ id: teamMembers.id, inviteStatus: teamMembers.inviteStatus })
        .from(teamMembers)
        .where(and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.inviteEmail, input.email.toLowerCase()),
          eq(teamMembers.isActive, true),
        ))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: existing.inviteStatus === "accepted"
            ? "This email already has an active seat on this team."
            : "An invite has already been sent to this email.",
        });
      }

      const inviteToken = generateInviteToken();
      const inviteUrl = `${input.origin}/team/join?token=${inviteToken}`;

      await db.insert(teamMembers).values({
        teamId: input.teamId,
        inviteEmail: input.email.toLowerCase(),
        displayName: input.displayName,
        inviteStatus: "pending",
        inviteToken,
        invitedByUserId: ctx.user.id,
      });

      // Send invite email
      const brandName = brandLabel(team.brand);
      const planLabel = team.plan === "lifetime" ? "Lifetime Access" : "Monthly Subscription";
      await sendEmail({
        to: input.email,
        subject: `You've been invited to ${team.orgName} — ${brandName} Team Access`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #189aa1;">You've been invited!</h2>
            <p>${ctx.user.name ?? "Your team admin"} has invited you to join <strong>${team.orgName}</strong> with access to <strong>${brandName}</strong> (${planLabel}).</p>
            <p>Click the button below to accept your invitation and activate your premium access:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background: #189aa1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Accept Invitation</a>
            </p>
            <p style="color: #666; font-size: 13px;">This invitation link is unique to you. If you didn't expect this email, you can safely ignore it.</p>
          </div>
        `,
      });

      return { success: true, inviteToken };
    }),

  /**
   * Protected: resend invite email for a pending member.
   */
  resendInvite: protectedProcedure
    .input(z.object({
      memberId: z.number().int().positive(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [member] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, input.memberId))
        .limit(1);

      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, member.teamId))
        .limit(1);

      if (!team || (team.adminUserId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (member.inviteStatus !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite is not in pending state." });
      }

      // Refresh token
      const newToken = generateInviteToken();
      await db.update(teamMembers).set({ inviteToken: newToken, updatedAt: new Date() })
        .where(eq(teamMembers.id, input.memberId));

      const inviteUrl = `${input.origin}/team/join?token=${newToken}`;
      const brandName = brandLabel(team.brand);
      const planLabel = team.plan === "lifetime" ? "Lifetime Access" : "Monthly Subscription";

      await sendEmail({
        to: member.inviteEmail,
        subject: `Reminder: You've been invited to ${team.orgName} — ${brandName} Team Access`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #189aa1;">Reminder: Your invitation is waiting</h2>
            <p>You have a pending invitation to join <strong>${team.orgName}</strong> with access to <strong>${brandName}</strong> (${planLabel}).</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${inviteUrl}" style="background: #189aa1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Accept Invitation</a>
            </p>
            <p style="color: #666; font-size: 13px;">This is a refreshed invitation link. Previous links for this invite are no longer valid.</p>
          </div>
        `,
      });

      return { success: true };
    }),

  /**
   * Protected: revoke a member's seat.
   */
  revokeMember: protectedProcedure
    .input(z.object({ memberId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [member] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, input.memberId))
        .limit(1);

      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, member.teamId))
        .limit(1);

      if (!team || (team.adminUserId !== ctx.user.id && ctx.user.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Revoke premium access
      if (member.grantedMembershipIds) {
        try {
          const ids: number[] = JSON.parse(member.grantedMembershipIds);
          await revokeTeamMemberAccess(db, ids);
        } catch { /* ignore parse errors */ }
      }

      await db.update(teamMembers).set({
        isActive: false,
        inviteStatus: "revoked",
        revokedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(teamMembers.id, input.memberId));

      return { success: true };
    }),

  /**
   * Public: accept a team invite via token.
   * Grants premium access to the authenticated user.
   */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.inviteToken, input.token),
          eq(teamMembers.isActive, true),
        ))
        .limit(1);

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already used." });
      }
      if (member.inviteStatus === "accepted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has already been accepted." });
      }
      if (member.inviteStatus === "revoked") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has been revoked." });
      }

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, member.teamId))
        .limit(1);

      if (!team || team.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This team subscription is no longer active." });
      }

      // Grant premium access
      const expiresAt = team.plan === "lifetime" ? null : (team.currentPeriodEnd ?? null);
      const grantedIds = await grantTeamMemberAccess(db, ctx.user.id, team.brand, team.plan, expiresAt);

      await db.update(teamMembers).set({
        userId: ctx.user.id,
        inviteStatus: "accepted",
        joinedAt: new Date(),
        inviteToken: null,
        grantedMembershipIds: JSON.stringify(grantedIds),
        updatedAt: new Date(),
      }).where(eq(teamMembers.id, member.id));

      // Notify team admin
      notifyOwner({
        title: `👥 Team Member Joined — ${team.orgName}`,
        content: `${ctx.user.name ?? ctx.user.email} accepted their invite to ${team.orgName} (${brandLabel(team.brand)}). Used seats: ${(await db.select({ value: count() }).from(teamMembers).where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.isActive, true))))[0].value}/${team.seatCount}.`,
      }).catch(() => {});

      return { success: true, brand: team.brand, plan: team.plan, orgName: team.orgName };
    }),

  /**
   * Protected: update seat count for a monthly team subscription.
   * Only increases are allowed (decreases require removing members first).
   */
  updateSeatCount: protectedProcedure
    .input(z.object({
      teamId: z.number().int().positive(),
      newSeatCount: z.number().int().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, input.teamId))
        .limit(1);

      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      if (team.adminUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (input.newSeatCount < team.seatCount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Seat count can only be increased. To reduce seats, revoke members first.",
        });
      }
      if (input.newSeatCount === team.seatCount) {
        return { success: true, seatCount: team.seatCount };
      }

      const { discountPct, pricePerSeat, total } = calcTeamPrice(
        team.brand as "aaus" | "iheartecho" | "dual",
        team.plan as "monthly" | "lifetime",
        input.newSeatCount,
      );

      // Update Stripe subscription quantity for monthly plans
      if (team.plan === "monthly" && team.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = getStripeClient();
          const sub = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
          const itemId = sub.items.data[0]?.id;
          if (itemId) {
            await stripe.subscriptions.update(team.stripeSubscriptionId, {
              items: [{ id: itemId, quantity: input.newSeatCount }],
              proration_behavior: "create_prorations",
            });
          }
        } catch (err) {
          console.error("[teamRouter] Failed to update Stripe subscription quantity:", err);
          // Don't throw — update DB anyway and notify admin
          notifyOwner({
            title: "⚠️ Team Seat Count Updated (Stripe sync failed)",
            content: `Team ${team.id} (${team.orgName}) seat count changed to ${input.newSeatCount} but Stripe subscription ${team.stripeSubscriptionId} could not be updated. Manual Stripe update required.`,
          }).catch(() => {});
        }
      }

      await db.update(teamSubscriptions).set({
        seatCount: input.newSeatCount,
        discountPct,
        pricePerSeatCents: pricePerSeat,
        totalAmountCents: total,
        updatedAt: new Date(),
      }).where(eq(teamSubscriptions.id, input.teamId));

      return { success: true, seatCount: input.newSeatCount, discountPct, pricePerSeatCents: pricePerSeat };
    }),

  /**
   * Public: look up invite details by token (for the join page preview).
   */
  getInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.inviteToken, input.token),
          eq(teamMembers.isActive, true),
        ))
        .limit(1);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already used." });
      if (member.inviteStatus === "revoked") throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has been revoked." });
      if (member.inviteStatus === "accepted") throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has already been accepted." });
      const [team] = await db
        .select()
        .from(teamSubscriptions)
        .where(eq(teamSubscriptions.id, member.teamId))
        .limit(1);
      if (!team || team.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "This team subscription is no longer active." });
      // Return only safe public fields
      return {
        orgName: team.orgName,
        brand: team.brand,
        plan: team.plan,
        inviteEmail: member.inviteEmail,
      };
    }),
  /**
   * Public: submit a team/university inquiry (lead capture) for App brand subscriptions.
   * No checkout — collects contact info and emails the admin.
   */
  submitInquiry: publicProcedure
    .input(z.object({
      orgName: z.string().min(2).max(200),
      contactName: z.string().min(2).max(100),
      contactEmail: z.string().email(),
      contactPhone: z.string().max(30).optional(),
      seatEstimate: z.number().int().min(1).max(10000),
      brand: z.enum(["aaus", "iheartecho", "dual"]),
      plan: z.enum(["monthly", "lifetime"]),
      message: z.string().max(2000).optional(),
    }))
    .mutation(async ({ input }) => {
      const { env } = await import("../_core/env");
      const bLabel =
        input.brand === "aaus" ? "UltrasoundAssist\u2122" :
        input.brand === "iheartecho" ? "EchoAssist\u2122" :
        "Both Apps (UltrasoundAssist\u2122 + EchoAssist\u2122)";
      const planLabel = input.plan === "monthly" ? "Monthly" : "Lifetime";

      await notifyOwner({
        title: `New Team Inquiry: ${input.orgName}`,
        content: `**${input.contactName}** (${input.contactEmail}) from **${input.orgName}** is interested in a team subscription.\n\n- **App:** ${bLabel}\n- **Plan:** ${planLabel}\n- **Estimated seats:** ${input.seatEstimate}\n- **Message:** ${input.message || "(none)"}`,
      });

      await sendEmail({
        to: env.platformAdminEmail,
        subject: `[Team Inquiry] ${input.orgName} \u2014 ${input.seatEstimate} seats (${bLabel})`,
        html: `
          <h2>New Team / University Membership Inquiry</h2>
          <table style="border-collapse:collapse;width:100%;max-width:600px">
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Organization</td><td style="padding:8px">${input.orgName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Contact Name</td><td style="padding:8px">${input.contactName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Contact Email</td><td style="padding:8px"><a href="mailto:${input.contactEmail}">${input.contactEmail}</a></td></tr>
            ${input.contactPhone ? `<tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${input.contactPhone}</td></tr>` : ""}
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">App Interest</td><td style="padding:8px">${bLabel}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Plan Preference</td><td style="padding:8px">${planLabel}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Estimated Seats</td><td style="padding:8px">${input.seatEstimate}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Message</td><td style="padding:8px">${input.message || "(none)"}</td></tr>
          </table>
          <p style="margin-top:16px">Reply directly to <a href="mailto:${input.contactEmail}">${input.contactEmail}</a> to follow up.</p>
        `,
      });

      await sendEmail({
        to: input.contactEmail,
        subject: `We received your team membership inquiry \u2014 ${input.orgName}`,
        html: `
          <h2>Thanks for your interest, ${input.contactName}!</h2>
          <p>We've received your inquiry for a <strong>${bLabel}</strong> team subscription (${planLabel}) for <strong>${input.orgName}</strong>.</p>
          <p>Our team will be in touch within 1\u20132 business days to discuss pricing, onboarding, and next steps.</p>
          <p>In the meantime, feel free to reply to this email with any questions.</p>
          <br/><p>\u2014 The All About Ultrasound Team</p>
        `,
      });

      return { success: true };
    }),

  /**
   * Admin: list all team subscriptions.
   */
  adminList: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const teams = await db
      .select()
      .from(teamSubscriptions)
      .orderBy(desc(teamSubscriptions.createdAt));

    const result = await Promise.all(teams.map(async (team) => {
      const [{ value: usedSeats }] = await db
        .select({ value: count() })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.isActive, true)));

      const [admin] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, team.adminUserId))
        .limit(1);

      return { ...team, usedSeats, adminName: admin?.name, adminEmail: admin?.email };
    }));
    return result;
  }),
});
