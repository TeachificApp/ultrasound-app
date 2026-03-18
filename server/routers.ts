import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, DEMO_COOKIE_NAME, TWO_HOURS_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { platformAdminRouter, labSeatsRouter } from "./routers/adminRouter";
import { cmeRouter } from "./routers/cmeRouter";
import { emailAuthRouter } from "./routers/emailAuthRouter";
import { quickfireRouter } from "./routers/quickfireRouter";
import { caseLibraryRouter } from "./routers/caseLibraryRouter";
import { premiumRouter } from "./routers/premiumRouter";
import { scanCoachAdminRouter } from "./routers/scanCoachAdminRouter";
import { diyRouter } from "./routers/diyRouter";
import { meetingRouter } from "./routers/meetingRouter";
import { formBuilderRouter } from "./routers/formBuilderRouter";
import { accreditationManagerRouter } from "./routers/accreditationManagerRouter";
import { educatorRouter } from "./routers/educatorRouter";
import { emailCampaignRouter } from "./routers/emailCampaignRouter";
import {
  getUserById,
  getUsersByIds,
  updateUserProfile,
  createPeerReview,
  getPeerReviews,
  createPolicy,
  getPolicies,
  updatePolicy,
  createQaLog,
  getQaLogs,
  createAucEntry,
  getAucEntries,
  createLabSubscription,
  getLabByAdmin,
  getLabById,
  updateLabSubscription,
  addLabMember,
  getLabMembers,
  updateLabMember,
  removeLabMember,
  createLabPeerReview,
  getLabPeerReviews,
  getStaffQsTrend,
  getLabStaffSnapshot,
  getLabMonthlySummary,
  createEchoCase,
  getEchoCasesByUser,
  getEchoCaseById,
  createStrainSnapshot,
  getStrainSnapshotsByCase,
  getStrainSnapshotsByUser,
  createImageQualityReview,
  getImageQualityReviewsByUser,
  getImageQualityReviewById,
  updateImageQualityReview,
  deleteImageQualityReview,
  getIqrStats,
  // Lab IQR analytics
  getIQRReviewsByLab,
  getLabStaffIQRStats,
  getStaffIQRTrend,
  getStaffIQRDomainBreakdown,
  getLabIQRMonthlySummary,
  getLabMembersWithIQRStats,
  createEchoCorrelation,
  getEchoCorrelationsByUser,
  getEchoCorrelationById,
  updateEchoCorrelation,
  deleteEchoCorrelation,
  getEchoCorrelationsByLab,
  getCaseMix,
  getLabByMemberUserId,
  createPhysicianPeerReview,
  getPhysicianPeerReviewsByUser,
  getPhysicianPeerReviewsByLab,
  getPhysicianPeerReviewById,
  updatePhysicianPeerReview,
  deletePhysicianPeerReview,
  getPhysicianPeerReviewStaffSnapshot,
  getPhysicianPeerReviewMonthlySummary,
  getPhysicianPeerReviewTrend,
  createPhysicianNotification,
  getPhysicianNotifications,
  countUnreadPhysicianNotifications,
  markPhysicianNotificationRead,
  markAllPhysicianNotificationsRead,
  dismissPhysicianNotification,
  getAccreditationReadiness,
  saveAccreditationReadiness,
  getAccreditationReadinessNavigator,
  saveAccreditationReadinessNavigator,
  getReadinessAutoChecks,
  createCaseMixSubmission,
  getCaseMixSubmissions,
  getCaseMixSummary,
  deleteCaseMixSubmission,
  updateCaseMixSubmissionStatus,
  getCmeStaffSummary,
  getCmeEntriesForMember,
  addCmeEntry,
  deleteCmeEntry,
  // RBAC
  getUserRoles,
  userHasRole,
  assignRole,
  removeRole,
  ensureUserRole,
  listUsersWithRoles,
  countUsers,
  getUsersByRole,
  getDiyUsersForLab,
  type AppRole,
  createOverReadInvitation,
  getOverReadInvitationByToken,
  getOverReadInvitationsByLab,
  getOverReadInvitationById,
  updateOverReadInvitationStatus,
  deleteOverReadInvitation,
  createOverReadSubmission,
  getOverReadSubmissionById,
  getOverReadSubmissionsByLab,
  createComparisonReview,
  getComparisonReviewsByLab,
  getComparisonReviewById,
  deleteComparisonReview,
  getComparisonReviewsMonthlySummary,
  generateCaseStudyId,
  createPossibleCaseStudy,
  getPossibleCaseStudies,
  updatePossibleCaseStudy,
  deletePossibleCaseStudy,
} from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(async opts => {
      if (!opts.ctx.user) return null;
      const roles = await getUserRoles(opts.ctx.user.id);
      // Fetch full user row to expose pendingEmail and isPremium for the profile UI
      const fullUser = await getUserById(opts.ctx.user.id);
      // Derive isPremium from both the DB flag and role-based premium access
      const PREMIUM_ROLES = new Set(["premium_user", "diy_user", "diy_admin", "platform_admin"]);
      const isPremiumByRole = roles.some(r => PREMIUM_ROLES.has(r));
      const isPremium = (fullUser?.isPremium ?? false) || isPremiumByRole;
      // Include demo mode metadata if active
      let demoModeInfo: { demoMode: true; realAdminId: number; realAdminName: string | null } | { demoMode: false } = { demoMode: false };
      if (opts.ctx.demoMode && opts.ctx.realAdminId) {
        const realAdmin = await getUserById(opts.ctx.realAdminId);
        demoModeInfo = { demoMode: true, realAdminId: opts.ctx.realAdminId, realAdminName: realAdmin?.displayName ?? realAdmin?.name ?? null };
      }
      return {
        ...opts.ctx.user,
        pendingEmail: fullUser?.pendingEmail ?? null,
        appRoles: roles,
        isPremium,
        ...demoModeInfo,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        email: z.string().email().optional(),
        displayName: z.string().min(1).max(100).optional(),
        bio: z.string().max(1000).optional(),
        credentials: z.string().max(200).optional(),
        specialty: z.string().max(100).optional(),
        yearsExperience: z.number().int().min(0).max(60).nullable().optional(),
        location: z.string().max(100).optional(),
        website: z.string().url().max(200).optional().or(z.literal('')),
        isPublicProfile: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserPasswordHash, updateUserPassword } = await import('./db');
        const bcrypt = await import('bcryptjs');
        const currentHash = await getUserPasswordHash(ctx.user.id);
        if (!currentHash) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Password change is not available for OAuth-only accounts. Please use the forgot password flow.' });
        }
        const isValid = await bcrypt.compare(input.currentPassword, currentHash);
        if (!isValid) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current password is incorrect.' });
        }
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await updateUserPassword(ctx.user.id, newHash);
        return { success: true };
      }),

    uploadAvatar: protectedProcedure
      .input(z.object({
        // base64-encoded image data URI, e.g. "data:image/jpeg;base64,..."
        dataUri: z.string().min(1).max(5_000_000), // ~3.75 MB raw → ~5 MB base64
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Decode base64 → Buffer
        const base64Data = input.dataUri.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        if (buffer.byteLength > 4 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Avatar image must be under 4 MB" });
        }
        const ext = input.mimeType.split("/")[1];
        const fileKey = `avatars/${ctx.user.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await updateUserProfile(ctx.user.id, { avatarUrl: url });
        return { avatarUrl: url };
      }),

    // ─── Email Change Verification ────────────────────────────────────────────

    requestEmailChange: protectedProcedure
      .input(z.object({
        newEmail: z.string().email().max(320),
      }))
      .mutation(async ({ ctx, input }) => {
        const { setPendingEmail, getUserById } = await import('./db');
        const { sendEmail, buildEmailChangeVerificationEmail } = await import('./_core/email');
        const crypto = await import('crypto');

        const newEmail = input.newEmail.trim().toLowerCase();

        // Prevent changing to the same email
        const currentUser = await getUserById(ctx.user.id);
        if (!currentUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
        if (currentUser.email?.toLowerCase() === newEmail) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'The new email address is the same as your current one.' });
        }

        // Check if another account already uses this email
        const { getDb } = await import('./db');
        const { users: usersTable } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const db = await getDb();
        if (db) {
          const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, newEmail)).limit(1);
          if (existing.length > 0 && existing[0].id !== ctx.user.id) {
            throw new TRPCError({ code: 'CONFLICT', message: 'That email address is already in use by another account.' });
          }
        }

        // Generate a secure token (48 bytes → 96 hex chars)
        const token = crypto.randomBytes(48).toString('hex');
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await setPendingEmail(ctx.user.id, newEmail, token, expiry);

        // Build verification URL
        const appUrl = process.env.VITE_APP_URL || 'https://app.iheartecho.com';
        const verificationUrl = `${appUrl}/verify-email?token=${token}&type=change`;

        const firstName = (currentUser.displayName || currentUser.name || 'there').split(' ')[0];
        const emailPayload = buildEmailChangeVerificationEmail({
          firstName,
          newEmail,
          verificationUrl,
        });

        await sendEmail({
          to: { name: firstName, email: newEmail },
          subject: emailPayload.subject,
          htmlBody: emailPayload.htmlBody,
          previewText: emailPayload.previewText,
        });

        return { success: true, pendingEmail: newEmail };
      }),

    verifyEmailChange: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
      }))
      .mutation(async ({ input }) => {
        const { getUserByPendingEmailToken, confirmPendingEmail } = await import('./db');

        const user = await getUserByPendingEmailToken(input.token);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Verification link is invalid or has already been used.' });
        }
        if (!user.pendingEmail || !user.pendingEmailExpiry) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No pending email change found for this token.' });
        }
        if (new Date() > user.pendingEmailExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This verification link has expired. Please request a new email change.' });
        }
        await confirmPendingEmail(user.id, user.pendingEmail);
        return { success: true, newEmail: user.pendingEmail };
      }),

    cancelEmailChange: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { clearPendingEmail } = await import('./db');
        await clearPendingEmail(ctx.user.id);
        return { success: true };
      }),

    // ─── Forgot / Reset Password ──────────────────────────────────────────────

    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
      }))
      .mutation(async ({ input }) => {
        const { getUserByEmail, setPasswordResetToken } = await import('./db');
        const { sendEmail, buildPasswordResetEmail } = await import('./_core/email');
        const crypto = await import('crypto');

        const email = input.email.trim().toLowerCase();
        const user = await getUserByEmail(email);

        // Always return success to prevent email enumeration
        // Send reset email to any registered account (including OAuth-only accounts without a passwordHash)
        // — this allows OAuth users to set a password for the first time via the reset flow
        if (!user) {
          return { success: true };
        }

        const token = crypto.randomBytes(48).toString('hex');
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await setPasswordResetToken(user.id, token, expiry);

        const appUrl = process.env.VITE_APP_URL || 'https://app.iheartecho.com';
        const resetUrl = `${appUrl}/reset-password?token=${token}`;

        const firstName = (user.displayName || user.name || 'there').split(' ')[0];
        const emailPayload = buildPasswordResetEmail({ firstName, resetUrl });

        await sendEmail({
          to: { name: firstName, email: user.email! },
          subject: emailPayload.subject,
          htmlBody: emailPayload.htmlBody,
          previewText: emailPayload.previewText,
        });

        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ input }) => {
        const { getUserByPasswordResetToken, updateUserPassword, clearPasswordResetToken } = await import('./db');
        const bcrypt = await import('bcryptjs');

        const user = await getUserByPasswordResetToken(input.token);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Reset link is invalid or has already been used.' });
        }
        if (!user.passwordResetExpiry || new Date() > user.passwordResetExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This reset link has expired. Please request a new one.' });
        }

        const newHash = await bcrypt.hash(input.newPassword, 12);
        await updateUserPassword(user.id, newHash);
        await clearPasswordResetToken(user.id);

        return { success: true };
      }),

    // ─── Magic Link (Passwordless) Login ──────────────────────────────────

    requestMagicLink: publicProcedure
      .input(z.object({
        email: z.string().email().max(320),
      }))
      .mutation(async ({ input }) => {
        const { getUserByEmail, setMagicLinkToken } = await import('./db');
        const { sendEmail, buildMagicLinkEmail } = await import('./_core/email');
        const crypto = await import('crypto');

        const email = input.email.trim().toLowerCase();
        const user = await getUserByEmail(email);

        // Always return success to prevent email enumeration
        if (!user) {
          return { success: true };
        }

        const token = crypto.randomBytes(48).toString('hex');
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await setMagicLinkToken(user.id, token, expiry);

        const appUrl = process.env.VITE_APP_URL || 'https://app.iheartecho.com';
        const magicUrl = `${appUrl}/auth/magic?token=${token}`;

        const firstName = (user.displayName || user.name || 'there').split(' ')[0];
        const emailPayload = buildMagicLinkEmail({ firstName, magicUrl });

        await sendEmail({
          to: { name: firstName, email: user.email! },
          subject: emailPayload.subject,
          htmlBody: emailPayload.htmlBody,
          previewText: emailPayload.previewText,
        });

        return { success: true };
      }),

    verifyMagicLink: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getUserByMagicLinkToken, clearMagicLinkToken } = await import('./db');
        const { sdk } = await import('./_core/sdk');
        const { COOKIE_NAME, ONE_YEAR_MS } = await import('@shared/const');
        const { getSessionCookieOptions } = await import('./_core/cookies');

        const user = await getUserByMagicLinkToken(input.token);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Magic link is invalid or has already been used.' });
        }
        if (!user.magicLinkExpiry || new Date() > user.magicLinkExpiry) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'This magic link has expired. Please request a new one.' });
        }

        // Consume the token immediately (one-time use)
        await clearMagicLinkToken(user.id);

        // Determine the openId for session creation
        // Email/password accounts use synthetic openId; OAuth accounts use their real openId
        const openId = user.openId ?? `email:${user.email!.toLowerCase().trim()}`;
        const name = user.displayName || user.name || user.email || '';

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true };
      }),
  }),

  // ─── Accreditation ────────────────────────────────────────────────────────────

  accreditation: router({
  // Peer Reviews
  createPeerReview: protectedProcedure
    .input(z.object({
      patientId: z.string().optional(),
      studyDate: z.string().optional(),
      modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS"]),
      sonographerInitials: z.string().optional(),
      imageQuality: z.enum(["excellent", "good", "adequate", "poor"]).optional(),
      imageQualityNotes: z.string().optional(),
      reportAccuracy: z.enum(["accurate", "minor_discrepancy", "major_discrepancy"]).optional(),
      reportNotes: z.string().optional(),
      technicalAdherence: z.enum(["full", "partial", "non_adherent"]).optional(),
      technicalNotes: z.string().optional(),
      overallScore: z.number().min(1).max(5).optional(),
      feedback: z.string().optional(),
      status: z.enum(["draft", "submitted", "complete"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createPeerReview({ ...input, reviewerId: ctx.user.id });
    }),

  getPeerReviews: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      return getPeerReviews(ctx.user.id, input.limit, input.offset);
    }),

  // Policies
  createPolicy: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      category: z.enum(["infection_control", "equipment", "patient_safety", "protocol", "staff_competency", "quality_assurance", "appropriate_use", "report_turnaround", "emergency", "other"]),
      modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS", "All"]).optional(),
      content: z.string().min(1),
      version: z.string().optional(),
      effectiveDate: z.string().optional(),
      reviewDate: z.string().optional(),
      status: z.enum(["draft", "active", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Attach the lab's ID so the policy is scoped to this org
      const lab = await getLabByAdmin(ctx.user.id);
      return createPolicy({ ...input, authorId: ctx.user.id, labId: lab?.id ?? null });
    }),

  getPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      // Scope policies to the user's lab so each org only sees its own policies
      const lab = await getLabByAdmin(ctx.user.id);
      return getPolicies(ctx.user.id, lab ? { labId: lab.id } : undefined);
    }),

  updatePolicy: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      category: z.enum(["infection_control", "equipment", "patient_safety", "protocol", "staff_competency", "quality_assurance", "appropriate_use", "report_turnaround", "emergency", "other"]).optional(),
      content: z.string().optional(),
      version: z.string().optional(),
      status: z.enum(["draft", "active", "archived"]).optional(),
      reviewDate: z.string().optional(),
      effectiveDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return updatePolicy(id, data);
    }),

  // QA Logs
  createQaLog: protectedProcedure
    .input(z.object({
      category: z.enum(["equipment", "protocol", "image_quality", "report_turnaround", "staff_competency", "infection_control", "patient_safety", "other"]),
      title: z.string().min(1),
      description: z.string().optional(),
      finding: z.enum(["pass", "fail", "needs_improvement", "na"]).optional(),
      actionRequired: z.string().optional(),
      actionTaken: z.string().optional(),
      dueDate: z.string().optional(),
      attachmentUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createQaLog({ ...input, userId: ctx.user.id });
    }),

  getQaLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(30), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      return getQaLogs(ctx.user.id, input.limit, input.offset);
    }),

  // Appropriate Use Cases
  createAucEntry: protectedProcedure
    .input(z.object({
      // New Formsite form269 fields
      dateReviewCompleted: z.string().optional(),
      studyDate: z.string().optional(),
      examIdentifier: z.string().optional(),
      referringPhysician: z.string().optional(),
      examTypes: z.string().optional(),
      limitedOrComplete: z.string().optional(),
      indicationAppropriateness: z.string().optional(),
      reviewComments: z.string().optional(),
      // Legacy fields
      modality: z.enum(["TTE", "TEE", "Stress", "Pediatric", "Fetal", "HOCM", "POCUS"]).optional(),
      indication: z.string().optional(),
      appropriatenessRating: z.enum(["appropriate", "may_be_appropriate", "rarely_appropriate", "unknown"]).optional(),
      clinicalScenario: z.string().optional(),
      outcome: z.string().optional(),
      notes: z.string().optional(),
      flagged: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createAucEntry({ ...input, userId: ctx.user.id });
    }),

  getAucEntries: protectedProcedure
    .input(z.object({ limit: z.number().default(30), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      return getAucEntries(ctx.user.id, input.limit, input.offset);
    }),
   }),

  // ─── Lab Subscription Router ────────────────────────────────────────────────
  lab: router({
    // Subscription management
    createLab: protectedProcedure
      .input(z.object({
        labName: z.string().min(1).max(200),
        labAddress: z.string().optional(),
        labPhone: z.string().optional(),
        plan: z.enum(["basic", "professional", "enterprise"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getLabByAdmin(ctx.user.id);
        if (existing) throw new Error("You already have a lab subscription.");
        return createLabSubscription({ ...input, adminUserId: ctx.user.id });
      }),

    getMyLab: protectedProcedure
      .query(async ({ ctx }) => {
        return getLabByAdmin(ctx.user.id);
      }),

    updateLab: protectedProcedure
      .input(z.object({
        labName: z.string().min(1).max(200).optional(),
        labAddress: z.string().optional(),
        labPhone: z.string().optional(),
        plan: z.enum(["basic", "professional", "enterprise"]).optional(),
        notes: z.string().optional(),
        accreditationTypes: z.array(z.enum(["adult_echo", "pediatric_fetal_echo"])).optional(),
        accreditationOnboardingComplete: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab found.");
        // Update seats if plan changed
        const seats = input.plan === "enterprise" ? 999 : input.plan === "professional" ? 25 : input.plan === "basic" ? 5 : undefined;
        const { accreditationTypes, ...rest } = input;
        await updateLabSubscription(lab.id, {
          ...rest,
          ...(seats ? { seats } : {}),
          ...(accreditationTypes !== undefined ? { accreditationTypes: JSON.stringify(accreditationTypes) } : {}),
        });
        return { success: true };
      }),

    upgradePlan: protectedProcedure
      .input(z.object({ plan: z.enum(["basic", "professional", "enterprise"]) }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab found.");
        const seats = input.plan === "enterprise" ? 999 : input.plan === "professional" ? 25 : 5;
        await updateLabSubscription(lab.id, { plan: input.plan, seats, status: "active" });
        return { success: true };
      }),

    // Staff management
    addMember: protectedProcedure
      .input(z.object({
        inviteEmail: z.string().email(),
        displayName: z.string().optional(),
        credentials: z.string().optional(),
        role: z.enum(["admin", "medical_director", "technical_director", "medical_staff", "technical_staff"]).optional(),
        specialty: z.string().optional(),
        department: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab subscription found. Please create a lab first.");
        const members = await getLabMembers(lab.id);
        if (members.length >= lab.seats) throw new Error(`Seat limit reached (${lab.seats}). Upgrade your plan to add more staff.`);
        return addLabMember({ ...input, labId: lab.id });
      }),

    getMembers: protectedProcedure
      .query(async ({ ctx }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabMembers(lab.id);
      }),

    updateMember: protectedProcedure
      .input(z.object({
        memberId: z.number(),
        displayName: z.string().optional(),
        credentials: z.string().optional(),
        role: z.enum(["admin", "medical_director", "technical_director", "medical_staff", "technical_staff"]).optional(),
        specialty: z.string().optional(),
        department: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab found.");
        const { memberId, ...data } = input;
        await updateLabMember(memberId, data);
        return { success: true };
      }),

    removeMember: protectedProcedure
      .input(z.object({ memberId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab found.");
        await removeLabMember(input.memberId);
        return { success: true };
      }),

    // Lab peer reviews
    createLabReview: protectedProcedure
      .input(z.object({
        peerReviewId: z.number(),
        revieweeId: z.number(),
        qualityScore: z.number().min(0).max(100).optional(),
        qualityTier: z.enum(["Excellent", "Good", "Adequate", "Needs Improvement"]).optional(),
        iqScore: z.number().min(0).max(100).optional(),
        raScore: z.number().min(0).max(100).optional(),
        taScore: z.number().min(0).max(100).optional(),
        reviewMonth: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) throw new Error("No lab found.");
        return createLabPeerReview({ ...input, labId: lab.id, reviewerId: ctx.user.id });
      }),

    getLabReviews: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabPeerReviews(lab.id, input.limit, input.offset);
      }),

    // Analytics
    getStaffTrend: protectedProcedure
      .input(z.object({ revieweeId: z.number(), months: z.number().default(12) }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getStaffQsTrend(lab.id, input.revieweeId, input.months);
      }),

    getStaffSnapshot: protectedProcedure
      .query(async ({ ctx }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabStaffSnapshot(lab.id);
      }),

    getMonthlySummary: protectedProcedure
      .input(z.object({ months: z.number().default(12) }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabMonthlySummary(lab.id, input.months);
      }),

    // ─── IQR Analytics (real data from imageQualityReviews) ──────────────────

    /** Lab-wide IQR snapshot: avg score + review count per staff member */
    getIqrStaffSnapshot: protectedProcedure
      .input(z.object({
        examType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabStaffIQRStats(lab.id, input?.examType, input?.dateFrom, input?.dateTo);
      }),

    /** Monthly IQR quality score trend for a specific staff member */
    getIqrStaffTrend: protectedProcedure
      .input(z.object({ revieweeLabMemberId: z.number(), months: z.number().default(12) }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getStaffIQRTrend(lab.id, input.revieweeLabMemberId);
      }),

    /** Domain-level breakdown for a specific staff member */
    getIqrDomainBreakdown: protectedProcedure
      .input(z.object({ revieweeLabMemberId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getStaffIQRDomainBreakdown(lab.id, input.revieweeLabMemberId);
      }),

    /** Monthly lab-wide IQR summary for the Reports tab, optionally filtered by reviewType/examType/date */
    getIqrMonthlySummary: protectedProcedure
      .input(z.object({
        reviewType: z.string().optional(),
        examType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getLabIQRMonthlySummary(lab.id, input?.reviewType, input?.examType, input?.dateFrom, input?.dateTo);
      }),

    /** Lab members enriched with IQR stats (for Staff tab) */
    getMembersWithIqrStats: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByAdmin(ctx.user.id);
      if (!lab) return [];
      return getLabMembersWithIQRStats(lab.id);
    }),

    /** Drill-down: all IQR reviews for a lab, optionally filtered by staff member/examType/date */
    getIqrDrilldown: protectedProcedure
      .input(z.object({
        revieweeLabMemberId: z.number().optional(),
        examType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getIQRReviewsByLab(lab.id, input?.revieweeLabMemberId, input?.examType, input?.dateFrom, input?.dateTo);
      }),
  }),
  // ─── Strain Navigator ────────────────────────────────────────────────────────

  strain: router({
    // List current user's echo cases for the case picker
    listMyCases: protectedProcedure.query(async ({ ctx }) => {
      return getEchoCasesByUser(ctx.user.id, 50, 0);
    }),

    // Save a strain snapshot to an existing case (or without a case)
    saveSnapshot: protectedProcedure
      .input(z.object({
        caseId: z.number().optional(),
        segmentValues: z.string(),
        wallMotionScores: z.string().optional(),
        lvGls: z.string().nullable().optional(),
        rvStrain: z.string().nullable().optional(),
        laStrain: z.string().nullable().optional(),
        wmsi: z.string().nullable().optional(),
        vendor: z.string().nullable().optional(),
        frameRate: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let caseTitle: string | null = null;
        if (input.caseId) {
          const echoCase = await getEchoCaseById(input.caseId);
          if (!echoCase || echoCase.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
          }
          caseTitle = echoCase.title;
        }
        await createStrainSnapshot({
          userId: ctx.user.id,
          caseId: input.caseId ?? null,
          caseTitle,
          segmentValues: input.segmentValues,
          wallMotionScores: input.wallMotionScores ?? null,
          lvGls: input.lvGls ?? null,
          rvStrain: input.rvStrain ?? null,
          laStrain: input.laStrain ?? null,
          wmsi: input.wmsi ?? null,
          vendor: input.vendor ?? null,
          frameRate: input.frameRate ?? null,
          notes: input.notes ?? null,
        });
        return { success: true };
      }),

    // Create a new echo case AND save the snapshot in one step
    createCaseAndSaveSnapshot: protectedProcedure
      .input(z.object({
        caseTitle: z.string().min(1).max(200),
        segmentValues: z.string(),
        wallMotionScores: z.string().optional(),
        lvGls: z.string().nullable().optional(),
        rvStrain: z.string().nullable().optional(),
        laStrain: z.string().nullable().optional(),
        wmsi: z.string().nullable().optional(),
        vendor: z.string().nullable().optional(),
        frameRate: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Create the case first
        await createEchoCase({
          userId: ctx.user.id,
          title: input.caseTitle,
        });
        // Get the newly created case
        const cases = await getEchoCasesByUser(ctx.user.id, 1, 0);
        const newCase = cases[0];
        // Save the snapshot attached to the new case
        await createStrainSnapshot({
          userId: ctx.user.id,
          caseId: newCase?.id ?? null,
          caseTitle: input.caseTitle,
          segmentValues: input.segmentValues,
          wallMotionScores: input.wallMotionScores ?? null,
          lvGls: input.lvGls ?? null,
          rvStrain: input.rvStrain ?? null,
          laStrain: input.laStrain ?? null,
          wmsi: input.wmsi ?? null,
          vendor: input.vendor ?? null,
          frameRate: input.frameRate ?? null,
          notes: input.notes ?? null,
        });
        return { success: true, caseId: newCase?.id };
      }),

    // Get all snapshots for a specific case
    getSnapshotsByCase: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ ctx, input }) => {
        const echoCase = await getEchoCaseById(input.caseId);
        if (!echoCase || echoCase.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
        }
        return getStrainSnapshotsByCase(input.caseId);
      }),

    // Get recent snapshots for the current user
    getMySnapshots: protectedProcedure.query(async ({ ctx }) => {
      return getStrainSnapshotsByUser(ctx.user.id, 20);
    }),
  }),
  // ─── Image Quality Reviews ──────────────────────────────────────────────────

  iqr: router({
    create: protectedProcedure
      .input(z.object({
        reviewType: z.string(),
        organization: z.string().optional(),
        dateReviewCompleted: z.string().optional(),
        examDos: z.string().optional(),
        examIdentifier: z.string().optional(),
        facilityLocation: z.string().optional(),
        performingSonographer: z.string().optional(),
        interpretingPhysician: z.string().optional(),
        referringPhysician: z.string().optional(),
        examType: z.string().optional(),
        examScope: z.string().optional(),
        stressType: z.string().optional(),
        examIndication: z.string().optional(),
        indicationAppropriateness: z.string().optional(),
        demographicsAccurate: z.string().optional(),
        protocolViews: z.string().optional(),
        protocolViewsOther: z.string().optional(),
        gainSettings: z.string().optional(),
        gainSettingsOther: z.string().optional(),
        depthSettings: z.string().optional(),
        depthSettingsOther: z.string().optional(),
        focalZoneSettings: z.string().optional(),
        focalZoneDeficiencies: z.string().optional(),
        colorizeSettings: z.string().optional(),
        colorizeSettingsOther: z.string().optional(),
        zoomSettings: z.string().optional(),
        zoomSettingsOther: z.string().optional(),
        ecgDisplay: z.string().optional(),
        ecgDisplayDeficiencies: z.string().optional(),
        contrastUseAppropriate: z.string().optional(),
        contrastSettingsAppropriate: z.string().optional(),
        onAxisImaging: z.string().optional(),
        effortSuboptimalViews: z.string().optional(),
        measurements2dComplete: z.string().optional(),
        measurements2dAccurate: z.string().optional(),
        psaxLvComplete: z.string().optional(),
        ventricularFunctionAccurate: z.string().optional(),
        efMeasurementsAccurate: z.string().optional(),
        simpsonsEfAccurate: z.string().optional(),
        laVolumeAccurate: z.string().optional(),
        dopplerMeasurementsComplete: z.string().optional(),
        dopplerMeasurementsAccurate: z.string().optional(),
        dopplerVentricularFunction: z.string().optional(),
        dopplerWaveformSettings: z.string().optional(),
        dopplerMeasurementAccuracy: z.string().optional(),
        forwardFlowSpectrum: z.string().optional(),
        pwDopplerPlacement: z.string().optional(),
        cwDopplerPlacement: z.string().optional(),
        spectralEnvelopePeaks: z.string().optional(),
        colorFlowInterrogation: z.string().optional(),
        colorDopplerIasIvs: z.string().optional(),
        diastolicFunctionEval: z.string().optional(),
        pulmonaryVeinInflow: z.string().optional(),
        rightHeartFunctionEval: z.string().optional(),
        tapseAccurate: z.string().optional(),
        tissueDopplerAdequate: z.string().optional(),
        dopplerWaveformSettingsPeer: z.string().optional(),
        dopplerSampleVolumesPeer: z.string().optional(),
        aorticValveDoppler: z.string().optional(),
        lvotDopplerPlacement: z.string().optional(),
        pedoffCwUtilized: z.string().optional(),
        pedoffCwEnvelope: z.string().optional(),
        pedoffCwLabelled: z.string().optional(),
        mitralValveDoppler: z.string().optional(),
        mrEvaluationMethods: z.string().optional(),
        pisaEroMeasurements: z.string().optional(),
        tricuspidValveDoppler: z.string().optional(),
        pulmonicValveDoppler: z.string().optional(),
        aorticValvePeer: z.string().optional(),
        mitralValvePeer: z.string().optional(),
        tricuspidValvePeer: z.string().optional(),
        pulmonicValvePeer: z.string().optional(),
        diastologyPeer: z.string().optional(),
        rightHeartPeer: z.string().optional(),
        additionalImagingMethods: z.string().optional(),
        strainPerformed: z.string().optional(),
        strainCorrect: z.string().optional(),
        threeDPerformed: z.string().optional(),
        imageOptimizationSummary: z.string().optional(),
        measurementAccuracySummary: z.string().optional(),
        dopplerSettingsSummary: z.string().optional(),
        protocolSequenceFollowed: z.string().optional(),
        pathologyDocumented: z.string().optional(),
        clinicalQuestionAnswered: z.string().optional(),
        reportConcordant: z.string().optional(),
        comparableToPreview: z.string().optional(),
        iacAcceptable: z.string().optional(),
        scanStartTime: z.string().optional(),
        scanEndTime: z.string().optional(),
        imagingTimeMinutes: z.number().optional(),
        scanningTimeType: z.string().optional(),
        qualityScore: z.number().optional(),
        reviewComments: z.string().optional(),
        reviewer: z.string().optional(),
        reviewerEmail: z.string().optional(),
        notifyAdmin: z.string().optional(),
        notifySonographer: z.string().optional(),
        revieweeLabMemberId: z.number().optional(),
        comparableToPrevious: z.string().optional(),
        dob: z.string().optional(),
        // TEE-specific fields
        teeMeasurementsComplete: z.string().optional(),
        teeMeasurementsAccurate: z.string().optional(),
        teeVentricularFunction: z.string().optional(),
        teeDopplerSettings: z.string().optional(),
        teeDopplerSampleVolumes: z.string().optional(),
        teeAorticValve: z.string().optional(),
        teeMitralValve: z.string().optional(),
        teeTricuspidValve: z.string().optional(),
        teePulmonicValve: z.string().optional(),
        teeImageOptSummary: z.string().optional(),
        teeMeasurementSummary: z.string().optional(),
        teeDopplerSummary: z.string().optional(),
        // Staff identifier fields
        performingSonographerId: z.string().optional(),
        performingSonographerText: z.string().optional(),
        interpretingPhysicianId: z.string().optional(),
        interpretingPhysicianText: z.string().optional(),
        // New Formsite fields
        mModeViewsObtained: z.string().optional(),
        mModeViewsObtainedOther: z.string().optional(),
        harmonicImagingAppropriate: z.string().optional(),
        harmonicImagingOther: z.string().optional(),
        contrastUtilized: z.string().optional(),
        contrastUtilizedOther: z.string().optional(),
        patientPositioned: z.string().optional(),
        patientPositionedOther: z.string().optional(),
        psaxLvCompleteness: z.string().optional(),
        psaxLvCompletenessOther: z.string().optional(),
        simpsonsEfObtained: z.string().optional(),
        simpsonsEfObtainedOther: z.string().optional(),
        biplaneLaVolume: z.string().optional(),
        biplaneLaVolumeOther: z.string().optional(),
        diastolicFunctionEvalOther: z.string().optional(),
        rightHeartFunctionEvalOther: z.string().optional(),
        pedoffCwUtilizedOther: z.string().optional(),
        pedoffCwEnvelopeOther: z.string().optional(),
        pedoffCwLabelledOther: z.string().optional(),
        pisaEroMeasurementsOther: z.string().optional(),
        additionalImagingMethodsOther: z.string().optional(),
        strainCorrectOther: z.string().optional(),
        notifyAdminEmail: z.string().optional(),
        notifyAdminComments: z.string().optional(),
        notifySonographerEmail: z.string().optional(),
        notifySonographerComments: z.string().optional(),
        // Extended IQR form fields (added to fix submission)
        stressStudyType: z.string().optional(),
        demographicsExplain: z.string().optional(),
        required2dViews: z.string().optional(),
        required2dViewsExplain: z.string().optional(),
        imageOptimized: z.string().optional(),
        imageOptimizedExplain: z.string().optional(),
        allMeasurementsObtained: z.string().optional(),
        allMeasurementsExplain: z.string().optional(),
        measurements2dExplain: z.string().optional(),
        measurementPlacementSummary: z.string().optional(),
        measurementPlacementExplain: z.string().optional(),
        ventricularFunctionExplain: z.string().optional(),
        dopplerWaveformExplain: z.string().optional(),
        forwardFlowExplain: z.string().optional(),
        dopplerSampleVolumes: z.string().optional(),
        dopplerSampleVolumesExplain: z.string().optional(),
        spectralEnvelopeExplain: z.string().optional(),
        colorFlowExplain: z.string().optional(),
        colorDopplerExplain: z.string().optional(),
        pulmonaryVeinInflowExplain: z.string().optional(),
        tapseExplain: z.string().optional(),
        tissueDopplerExplain: z.string().optional(),
        aorticValveEval: z.string().optional(),
        aorticValveExplain: z.string().optional(),
        lvotSampleVolume: z.string().optional(),
        lvotSampleVolumeExplain: z.string().optional(),
        mitralValveEval: z.string().optional(),
        mitralValveExplain: z.string().optional(),
        pisaEroEval: z.string().optional(),
        pisaEroExplain: z.string().optional(),
        tricuspidValveEval: z.string().optional(),
        tricuspidValveExplain: z.string().optional(),
        pulmonicValveEval: z.string().optional(),
        pulmonicValveExplain: z.string().optional(),
        images2dOptimized: z.string().optional(),
        images2dOptimizedExplain: z.string().optional(),
        measurementsAccurateSummary: z.string().optional(),
        measurementsAccurateExplain: z.string().optional(),
        dopplerSettingsExplain: z.string().optional(),
        protocolSequence: z.string().optional(),
        protocolSequenceExplain: z.string().optional(),
        pathologyDocumentedExplain: z.string().optional(),
        clinicalQuestionExplain: z.string().optional(),
        concordantWithPhysician: z.string().optional(),
        concordantExplain: z.string().optional(),
        // Additional missing fields from form audit
        efMeasurementsExplain: z.string().optional(),
        ventricularFunction: z.string().optional(),
        pulmonaryVeinDoppler: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Map comparableToPrevious → comparableToPreview for DB compatibility
        const { comparableToPrevious, dob: _dob, ...rest } = input;
        try {
          const review = await createImageQualityReview({ ...rest, comparableToPreview: comparableToPrevious, userId: ctx.user.id });

          // ── Send email feedback to sonographer if requested ─────────────────
          if (input.notifySonographer === "Yes" && input.notifySonographerEmail) {
            try {
              const { sendEmail, buildPeerReviewFeedbackEmail } = await import('./_core/email');
              const appUrl = process.env.VITE_APP_URL ?? "https://iheartecho.com";
              const reviewerName = ctx.user.name ?? ctx.user.email ?? "Your reviewer";
              const examType = input.examType ?? "Echo Study";
              const examDate = input.examDos ?? input.dateReviewCompleted ?? new Date().toLocaleDateString();
              const examIdentifier = input.examIdentifier ?? "";

              // Compute quality score tier label from score
              const score = input.qualityScore;
              const tier = score != null
                ? score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Adequate" : "Needs Improvement"
                : undefined;

              const emailPayload = buildPeerReviewFeedbackEmail({
                sonographerName: "Sonographer",
                reviewerName,
                examType,
                examDate,
                examIdentifier,
                qualityScore: score,
                qualityTier: tier,
                comments: input.notifySonographerComments,
                appUrl,
              });

              await sendEmail({
                to: { name: "Sonographer", email: input.notifySonographerEmail },
                subject: emailPayload.subject,
                htmlBody: emailPayload.htmlBody,
                previewText: emailPayload.previewText,
              });
            } catch (emailErr) {
              // Email failure should not block review creation
              console.warn('[IQR] Sonographer email failed:', emailErr);
            }
          }

          // ── Send email feedback to admin if requested ───────────────────────
          if (input.notifyAdmin === "Yes" && input.notifyAdminEmail) {
            try {
              const { sendEmail, buildPeerReviewFeedbackEmail } = await import('./_core/email');
              const appUrl = process.env.VITE_APP_URL ?? "https://iheartecho.com";
              const reviewerName = ctx.user.name ?? ctx.user.email ?? "A reviewer";
              const examType = input.examType ?? "Echo Study";
              const examDate = input.examDos ?? input.dateReviewCompleted ?? new Date().toLocaleDateString();
              const score = input.qualityScore;
              const tier = score != null
                ? score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Adequate" : "Needs Improvement"
                : undefined;

              const emailPayload = buildPeerReviewFeedbackEmail({
                sonographerName: "Administrator",
                reviewerName,
                examType,
                examDate,
                examIdentifier: input.examIdentifier ?? "",
                qualityScore: score,
                qualityTier: tier,
                comments: input.notifyAdminComments,
                appUrl,
              });

              await sendEmail({
                to: { name: "Administrator", email: input.notifyAdminEmail },
                subject: emailPayload.subject,
                htmlBody: emailPayload.htmlBody,
                previewText: emailPayload.previewText,
              });
            } catch (emailErr) {
              console.warn('[IQR] Admin email failed:', emailErr);
            }
          }

          return review;
        } catch (err: unknown) {
          const e = err as { message?: string; code?: string; sqlMessage?: string };
          console.error('[IQR Create Error]', { code: e?.code, sqlMessage: e?.sqlMessage, message: e?.message });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.sqlMessage ?? e?.message ?? 'Failed to save review' });
        }
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        return getImageQualityReviewsByUser(ctx.user.id, input.limit, input.offset);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await getImageQualityReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return review;
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        const { id, comparableToPrevious, dob: _dob, ...data } = input as Record<string, unknown> & { id: number; comparableToPrevious?: string; dob?: string };
        const mapped = { ...data, ...(comparableToPrevious !== undefined ? { comparableToPreview: comparableToPrevious } : {}) };
        await updateImageQualityReview(id, ctx.user.id, mapped as Parameters<typeof updateImageQualityReview>[2]);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteImageQualityReview(input.id, ctx.user.id);
        return { success: true };
      }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      return getIqrStats(ctx.user.id);
    }),
    getLabStaffForReview: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return { sonographers: [], physicians: [], labName: null };
      const members = await getLabMembers(lab.id);
      const sonographers = members.filter(m => m.role === 'technical_director' || m.role === 'technical_staff' || m.role === 'admin');
      const physicians = members.filter(m => m.role === 'medical_director' || m.role === 'medical_staff' || m.role === 'admin');
      return {
        labName: lab.labName,
        sonographers: sonographers.map(m => ({ id: m.id, name: m.displayName ?? m.inviteEmail, role: m.role })),
        physicians: physicians.map(m => ({ id: m.id, name: m.displayName ?? m.inviteEmail, role: m.role })),
      };
    }),
  }),

  // ─── Echo Correlation ─────────────────────────────────────────────────────
  echoCorrelation: router({
    create: protectedProcedure
      .input(z.object({
        organization: z.string().optional(),
        dateReviewCompleted: z.string().optional(),
        examIdentifier: z.string().optional(),
        examType: z.string().optional(),
        correlation1Type: z.string().optional(),
        correlation1TypeOther: z.string().optional(),
        correlation2Type: z.string().optional(),
        correlation2TypeOther: z.string().optional(),
        originalExamDos: z.string().optional(),
        correlation1Dos: z.string().optional(),
        correlation2Dos: z.string().optional(),
        originalFindings: z.string().optional(),
        corr1Findings: z.string().optional(),
        corr2Findings: z.string().optional(),
        concordance1: z.string().optional(),
        concordance2: z.string().optional(),
        overallConcordanceRate: z.number().optional(),
        varianceNotes: z.string().optional(),
        reviewerName: z.string().optional(),
        reviewerEmail: z.string().optional(),
        labId: z.number().optional(),
        revieweeId: z.string().optional(),
        revieweeName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createEchoCorrelation({ ...input, userId: ctx.user.id });
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx }) => {
        return getEchoCorrelationsByUser(ctx.user.id);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const record = await getEchoCorrelationById(input.id);
        if (!record || record.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return record;
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number() }).passthrough())
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const existing = await getEchoCorrelationById(id);
        if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await updateEchoCorrelation(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getEchoCorrelationById(input.id);
        if (!existing || existing.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await deleteEchoCorrelation(input.id);
        return { success: true };
      }),

    getByLab: protectedProcedure
      .input(z.object({ labId: z.number() }))
      .query(async ({ input }) => {
        return getEchoCorrelationsByLab(input.labId);
      }),
  }),

    // ─── Case Mix Tracker (legacy get, merged into new caseMix router below) ───

  // ─── Physician Peer Review ───────────────────────────────────────────────
  physicianPeerReview: router({
    /** Create a new Physician Peer Review */
    create: protectedProcedure
      .input(z.object({
        labId: z.number().optional(),
        facilityAccountNumber: z.string().optional(),
        organization: z.string().optional(),
        dateReviewCompleted: z.string().optional(),
        examIdentifier: z.string().optional(),
        dob: z.string().optional(),
        examDos: z.string().optional(),
        examType: z.string().optional(),
        // Staff linkage
        revieweeLabMemberId: z.number().optional(),
        revieweeName: z.string().optional(),
        reviewerLabMemberId: z.number().optional(),
        reviewerName: z.string().optional(),
        qualityReviewAssignedBy: z.string().optional(),
        reviewerEmail: z.string().optional(),
        // Stress
        postStressDopplerPerformed: z.string().optional(),
        // Shared findings
        situs: z.string().optional(),
        cardiacPosition: z.string().optional(),
        leftHeart: z.string().optional(),
        rightHeart: z.string().optional(),
        efPercent: z.string().optional(),
        lvWallThickness: z.string().optional(),
        ventricularSeptalDefect: z.string().optional(),
        atrialSeptalDefect: z.string().optional(),
        patentForamenOvale: z.string().optional(),
        lvChamberSize: z.string().optional(),
        laChamberSize: z.string().optional(),
        rvChamberSize: z.string().optional(),
        raChamberSize: z.string().optional(),
        regionalWallMotionAbnormalities: z.string().optional(),
        aorticValve: z.string().optional(),
        mitralValve: z.string().optional(),
        tricuspidValve: z.string().optional(),
        pulmonicValve: z.string().optional(),
        aorticStenosis: z.string().optional(),
        aorticInsufficiency: z.string().optional(),
        mitralStenosis: z.string().optional(),
        mitralRegurgitation: z.string().optional(),
        tricuspidStenosis: z.string().optional(),
        tricuspidRegurgitation: z.string().optional(),
        pulmonicStenosis: z.string().optional(),
        pulmonicInsufficiency: z.string().optional(),
        rvspmm: z.string().optional(),
        pericardialEffusion: z.string().optional(),
        // Pediatric extra
        peripheralPulmonaryStenosis: z.string().optional(),
        pulmonaryVeins: z.string().optional(),
        coronaryAnatomy: z.string().optional(),
        aorticArch: z.string().optional(),
        greatVessels: z.string().optional(),
        pdaDuctalArch: z.string().optional(),
        conotruncalAnatomy: z.string().optional(),
        // Stress
        restingEfPercent: z.string().optional(),
        postStressEfPercent: z.string().optional(),
        restingRwma: z.string().optional(),
        postStressRwma: z.string().optional(),
        responseToStress: z.string().optional(),
        stressAorticStenosis: z.string().optional(),
        stressAorticInsufficiency: z.string().optional(),
        stressMitralStenosis: z.string().optional(),
        stressMitralRegurgitation: z.string().optional(),
        stressTricuspidStenosis: z.string().optional(),
        stressTricuspidRegurgitation: z.string().optional(),
        stressPulmonicStenosis: z.string().optional(),
        stressPulmonicInsufficiency: z.string().optional(),
        stressRvspmm: z.string().optional(),
        // Fetal
        fetalBiometry: z.string().optional(),
        fetalPosition: z.string().optional(),
        fetalHeartRateRhythm: z.string().optional(),
        // Other
        otherFindings1: z.string().optional(),
        otherFindings2: z.string().optional(),
        otherFindings3: z.string().optional(),
        reviewComments: z.string().optional(),
        concordanceScore: z.number().optional(),
        discordanceFields: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const labId = input.labId ?? (await getLabByMemberUserId(ctx.user.id))?.id;
        const review = await createPhysicianPeerReview({ ...input, userId: ctx.user.id, labId });

        // ── Trigger notification to the reviewed physician ──────────────────────
        // Only send if the reviewee is a linked lab member with a userId
        if (input.revieweeLabMemberId && review) {
          try {
            // Look up the lab member to get their userId
            const labMembers = labId ? await getLabMembers(labId) : [];
            const revieweeMember = labMembers.find(m => m.id === input.revieweeLabMemberId);
            if (revieweeMember?.userId) {
              const examType = input.examType ?? "Echo";
              const examDate = input.examDos ?? input.dateReviewCompleted ?? new Date().toLocaleDateString();
              const reviewerName = input.reviewerName ?? ctx.user.name ?? "A reviewer";
              const concordance = input.concordanceScore != null ? `${input.concordanceScore}%` : "N/A";
              const discordant = input.discordanceFields
                ? JSON.parse(input.discordanceFields).slice(0, 5).join(", ")
                : "None";

              const title = `Physician Peer Review Result — ${examType} (${examDate})`;
              const message = [
                `A Physician Peer Review has been completed for your ${examType} study dated ${examDate}.`,
                ``,
                `**Concordance Score:** ${concordance}`,
                `**Discordant Fields:** ${discordant}`,
                input.reviewComments ? `**Reviewer Comments:** ${input.reviewComments}` : null,
                ``,
                `Reviewed by: ${reviewerName}`,
              ].filter(Boolean).join("\n");

              await createPhysicianNotification({
                recipientUserId: revieweeMember.userId,
                recipientLabMemberId: input.revieweeLabMemberId,
                reviewId: (review as unknown as { insertId: number }).insertId ?? 0,
                title,
                message,
                payload: {
                  concordanceScore: input.concordanceScore,
                  discordantFields: input.discordanceFields ? JSON.parse(input.discordanceFields) : [],
                  reviewerName,
                  examType,
                  examDate,
                },
              });
            }
          } catch (notifErr) {
            // Notification failure should not block review creation
            console.warn("[PhysicianPeerReview] Notification failed:", notifErr);
          }
        }

        return review;
      }),

    /** List Physician Peer Reviews for the current user */
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        return getPhysicianPeerReviewsByUser(ctx.user.id, input.limit, input.offset);
      }),

    /** Get a single Physician Peer Review by ID */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const review = await getPhysicianPeerReviewById(input.id);
        if (!review || review.userId !== ctx.user.id) return null;
        return review;
      }),

    /** Delete a Physician Peer Review */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePhysicianPeerReview(input.id, ctx.user.id);
        return { success: true };
      }),

    /** Get lab staff (physician role) for the dropdowns */
    getLabStaffForReview: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return { physicians: [] };
      const members = await getLabMembers(lab.id);
      const physicians = members.filter(m => m.role === "medical_director" || m.role === "medical_staff" || m.role === "admin");
      return { physicians };
    }),

    /** Lab-wide staff snapshot for Analytics tab */
    getStaffSnapshot: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByAdmin(ctx.user.id);
      if (!lab) return [];
      return getPhysicianPeerReviewStaffSnapshot(lab.id);
    }),

    /** Monthly summary of physician peer reviews for Analytics tab */
    getMonthlySummary: protectedProcedure
      .input(z.object({ examType: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getPhysicianPeerReviewMonthlySummary(lab.id, input?.examType);
      }),

    /** Trend for a specific physician */
    getPhysicianTrend: protectedProcedure
      .input(z.object({ revieweeLabMemberId: z.number(), examType: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByAdmin(ctx.user.id);
        if (!lab) return [];
        return getPhysicianPeerReviewTrend(lab.id, input.revieweeLabMemberId, input.examType);
      }),
  }),

  // ─── Physician Notifications ─────────────────────────────────────────────
  notification: router({
    /** Get all notifications for the current user */
    getMyNotifications: protectedProcedure.query(async ({ ctx }) => {
      const notifications = await getPhysicianNotifications(ctx.user.id);
      return notifications.map(n => ({
        ...n,
        payload: n.payload ? JSON.parse(n.payload) : null,
      }));
    }),
    /** Count unread notifications */
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      return countUnreadPhysicianNotifications(ctx.user.id);
    }),
    /** Mark a single notification as read */
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await markPhysicianNotificationRead(input.id, ctx.user.id);
        return { success: true };
      }),
    /** Mark all notifications as read */
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await markAllPhysicianNotificationsRead(ctx.user.id);
      return { success: true };
    }),
    /** Dismiss (soft-delete) a notification */
    dismiss: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await dismissPhysicianNotification(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Accreditation Readiness ──────────────────────────────────────────────────
  accreditationReadiness: router({
    /** Get or initialize readiness checklist for the current user's lab */
    get: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return null;
      return getAccreditationReadiness(lab.id, ctx.user.id);
    }),
    /** Save checklist progress */
    save: protectedProcedure
      .input(z.object({
        checklistProgress: z.record(z.string(), z.boolean()),
        itemNotes: z.record(z.string(), z.string()),
        completionPct: z.number().min(0).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found for this user" });
        await saveAccreditationReadiness(lab.id, ctx.user.id, input.checklistProgress, input.itemNotes, input.completionPct);
        return { success: true };
      }),
    /** Get auto-check signals derived from real DB records for the current lab */
    autoChecks: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return {} as Record<string, boolean>;
      return getReadinessAutoChecks(lab.id);
    }),
  }),

  // ─── Accreditation Readiness Navigator (Free-Tier) ───────────────────────────
  // Independent backend — keyed by userId only, no lab membership required.
  // Visible only to users without an active paid DIY Tool subscription.
  accreditationReadinessNavigator: router({
    /** Get or initialize readiness checklist for the current user (Navigator free-tier) */
    get: protectedProcedure.query(async ({ ctx }) => {
      return getAccreditationReadinessNavigator(ctx.user.id);
    }),
    /** Save checklist progress (Navigator free-tier) */
    save: protectedProcedure
      .input(z.object({
        checklistProgress: z.record(z.string(), z.boolean()),
        itemNotes: z.record(z.string(), z.string()),
        completionPct: z.number().min(0).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        await saveAccreditationReadinessNavigator(
          ctx.user.id,
          input.checklistProgress,
          input.itemNotes,
          input.completionPct,
        );
        return { success: true };
      }),
  }),

  // ─── Case Mix Submissions ─────────────────────────────────────────────────────
  caseMix: router({
    /** Get all case submissions for the current user's lab */
    list: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getCaseMixSubmissions(lab.id);
    }),
    /** Get only the current user's own case submissions */
    myList: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      const all = await getCaseMixSubmissions(lab.id);
      return all.filter(c => c.submittedByUserId === ctx.user.id);
    }),
    /** Get case mix summary (counts by modality/caseType) */
    summary: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getCaseMixSummary(lab.id);
    }),
    /** Submit a new case */
    create: protectedProcedure
      .input(z.object({
        modality: z.enum(["ATTE", "ATEE", "STRESS", "ACTE", "PTTE", "PTEE", "FETAL"]),
        caseType: z.string().min(1).max(80),
        studyIdentifier: z.string().min(1).max(100),
        studyDate: z.string().optional(),
        sonographerLabMemberId: z.number().optional(),
        sonographerName: z.string().max(100).optional(),
        physicianLabMemberId: z.number().optional(),
        physicianName: z.string().max(100).optional(),
        isTechDirectorCase: z.boolean().default(false),
        isMedDirectorCase: z.boolean().default(false),
        notes: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found for this user" });
        await createCaseMixSubmission({
          ...input,
          labId: lab.id,
          submittedByUserId: ctx.user.id,
          status: "draft",
        });
        return { success: true };
      }),
    /** Delete a case submission */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await deleteCaseMixSubmission(input.id, lab.id);
        return { success: true };
      }),
    /** Update case status */
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["draft", "submitted", "accepted", "rejected"]) }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await updateCaseMixSubmissionStatus(input.id, lab.id, input.status);
        return { success: true };
      }),
    /** Get lab staff for case mix dropdowns */
    getLabStaff: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return { sonographers: [], physicians: [] };
      const members = await getLabMembers(lab.id);
      return {
        sonographers: members.filter(m => m.role === "technical_director" || m.role === "technical_staff" || m.role === "admin"),
        physicians: members.filter(m => m.role === "medical_director" || m.role === "medical_staff" || m.role === "admin"),
      };
    }),
  }),

  // ─── CME Router ───────────────────────────────────────────────────────────
  cme: router({
    /** Get CME credit summary for all staff in the lab */
    getStaffSummary: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getCmeStaffSummary(lab.id);
    }),
    /** Get all CME entries for a specific lab member */
    getEntriesForMember: protectedProcedure
      .input(z.object({ labMemberId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) return [];
        return getCmeEntriesForMember(lab.id, input.labMemberId);
      }),
    /** Add a CME entry */
    addEntry: protectedProcedure
      .input(z.object({
        labMemberId: z.number(),
        title: z.string().min(1),
        provider: z.string().optional(),
        category: z.enum(["echo_specific", "cardiovascular", "general_medical", "technical", "safety", "leadership", "other"]),
        activityDate: z.string(),
        creditHours: z.number().min(0).max(100),
        certificationNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await addCmeEntry({ ...input, labId: lab.id });
        return { success: true };
      }),
    /** Delete a CME entry */
    deleteEntry: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await deleteCmeEntry(input.id, lab.id);
        return { success: true };
      }),
  }),

  // ─── Platform Admin & Seat Management ────────────────────────────────────
  platformAdmin: platformAdminRouter,
  formBuilder: formBuilderRouter,
  labSeats: labSeatsRouter,

  // ─── CME Hub (Thinkific Catalog) ──────────────────────────────────────────────
  cmeCatalog: cmeRouter,

  // ─── Email/Password Auth (white-label, no OAuth portal) ──────────────────────
  emailAuth: emailAuthRouter,

  // ─── Daily Challenge Engine ───────────────────────────────────────────────────
  quickfire: quickfireRouter,
  educator: educatorRouter,

  // ─── Echo Case Library ────────────────────────────────────────────────────────
  caseLibrary: caseLibraryRouter,

  // ─── Premium Access ───────────────────────────────────────────────────────────
  premium: premiumRouter,

  // ─── ScanCoach WYSIWYG Admin ──────────────────────────────────────────────────
  scanCoachAdmin: scanCoachAdminRouter,

  // ─── DIY Accreditation ─────────────────────────────────────────────────────────────
  diy: diyRouter,
  meeting: meetingRouter,

  // ─── Accreditation Manager ────────────────────────────────────────────────────────
  accreditationManager: accreditationManagerRouter,
  emailCampaign: emailCampaignRouter,

  // ─── Physician Over-Read Workflow (Step 1 & Step 2) ──────────────────────────
  physicianOverRead: router({
    /** List all invitations for the current user's lab */
    listInvitations: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getOverReadInvitationsByLab(lab.id);
    }),

    /** Create a new invitation and send email to physician */
    createInvitation: protectedProcedure
      .input(z.object({
        examIdentifier: z.string().min(1).max(100),
        examDos: z.string().optional(),
        examType: z.enum(["Adult TTE", "Adult TEE", "Adult STRESS", "Pediatric/Congenital TTE", "Pediatric/Congenital TEE", "FETAL"]),
        postStressDopplerPerformed: z.string().optional(),
        originalInterpretingPhysician: z.string().optional(),
        pacsImageUrl: z.string().url().optional().or(z.literal("")),
        reviewerName: z.string().optional(),
        reviewerEmail: z.string().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        const crypto = await import("crypto");
        const accessToken = crypto.randomBytes(48).toString("hex");
        const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const invitationId = await createOverReadInvitation({
          labId: lab.id,
          createdByUserId: ctx.user.id,
          examIdentifier: input.examIdentifier,
          examDos: input.examDos,
          examType: input.examType,
          postStressDopplerPerformed: input.postStressDopplerPerformed,
          originalInterpretingPhysician: input.originalInterpretingPhysician,
          pacsImageUrl: input.pacsImageUrl || undefined,
          reviewerName: input.reviewerName,
          reviewerEmail: input.reviewerEmail,
          accessToken,
          accessTokenExpiry: expiry,
          status: "pending",
        });
        // Send email to physician
        try {
          const { sendEmail } = await import("./_core/email");
          const appUrl = process.env.VITE_APP_URL || "https://app.iheartecho.com";
          const formUrl = `${appUrl}/physician-review/${accessToken}`;
          const physicianName = input.reviewerName || "Physician";
          const labName = (lab as any).organization || "the lab";
          await sendEmail({
            to: { name: physicianName, email: input.reviewerEmail },
            subject: `Physician Over-Read Request — ${input.examType} (${input.examIdentifier})`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #189aa1; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 22px;">iHeartEcho&#8482; &#8212; Physician Over-Read Request</h1>
                </div>
                <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                  <p style="color: #374151;">Dear ${physicianName},</p>
                  <p style="color: #374151;">You have been requested to perform a <strong>blind over-read</strong> of an echocardiography study by ${labName}.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Exam Type</td><td style="padding: 8px; color: #374151;">${input.examType}</td></tr>
                    <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Exam Identifier</td><td style="padding: 8px; color: #374151;">${input.examIdentifier}</td></tr>
                    ${input.examDos ? `<tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Exam Date</td><td style="padding: 8px; color: #374151;">${input.examDos}</td></tr>` : ""}
                    ${input.originalInterpretingPhysician ? `<tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Original Physician</td><td style="padding: 8px; color: #374151;">${input.originalInterpretingPhysician}</td></tr>` : ""}
                  </table>
                  ${input.pacsImageUrl ? `<div style="background: #f0fbfc; border: 1px solid #189aa1; border-radius: 6px; padding: 14px 18px; margin: 16px 0;"><p style="margin: 0 0 8px 0; color: #0e4a50; font-weight: bold; font-size: 14px;">&#128444; PACS / Echo Image Viewer</p><p style="margin: 0 0 10px 0; color: #374151; font-size: 13px;">Use the link below to view the echocardiography images for this study before completing your over-read.</p><a href="${input.pacsImageUrl}" style="background: #0e4a50; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">View Echo Images</a></div>` : ""}
                  <p style="color: #374151;"><strong>Important:</strong> Please complete this form as a <em>blind over-read</em> &#8212; do NOT view the original physician report before completing the form.</p>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${formUrl}" style="background: #189aa1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Complete Over-Read Form</a>
                  </div>
                  <p style="color: #6b7280; font-size: 13px;">This link expires in 30 days. If you have questions, please contact the lab directly.</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                  <p style="color: #9ca3af; font-size: 12px;">Powered by iHeartEcho&#8482; DIY Accreditation Tool&#8482; | All About Ultrasound</p>
                </div>
              </div>
            `,
            previewText: `Over-read request for ${input.examType} exam ${input.examIdentifier}`,
          });
          // Mark email as sent
          const { getDb } = await import("./db");
          const { physicianOverReadInvitations } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          if (db) await db.update(physicianOverReadInvitations).set({ emailSentAt: new Date() }).where(eq(physicianOverReadInvitations.id, invitationId));
        } catch (emailErr) {
          console.warn("[OverRead] Email send failed:", emailErr);
        }
        return { success: true, invitationId };
      }),

    /** Delete an invitation */
    deleteInvitation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await deleteOverReadInvitation(input.id, lab.id);
        return { success: true };
      }),

    /** Get invitation details by access token (for the physician form page) */
    getInvitationByToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const invitation = await getOverReadInvitationByToken(input.token);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation link" });
        if (invitation.status === "expired") throw new TRPCError({ code: "BAD_REQUEST", message: "This invitation has expired" });
        if (invitation.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "This over-read has already been submitted" });
        if (invitation.status === "pending") {
          await updateOverReadInvitationStatus(invitation.id, "opened", { openedAt: new Date() });
        }
        return {
          id: invitation.id,
          examIdentifier: invitation.examIdentifier,
          examDos: invitation.examDos,
          examType: invitation.examType,
          postStressDopplerPerformed: invitation.postStressDopplerPerformed,
          originalInterpretingPhysician: invitation.originalInterpretingPhysician,
          reviewerName: invitation.reviewerName,
          reviewerEmail: invitation.reviewerEmail,
          pacsImageUrl: invitation.pacsImageUrl ?? null,
        };
      }),

    /** Submit the physician's over-read (Step 1) */
    submitOverRead: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        dateReviewCompleted: z.string().optional(),
        overReadingPhysicianName: z.string().min(1),
        situs: z.string().optional(),
        cardiacPosition: z.string().optional(),
        leftHeart: z.string().optional(),
        rightHeart: z.string().optional(),
        efPercent: z.string().optional(),
        lvWallThickness: z.string().optional(),
        ventricularSeptalDefect: z.string().optional(),
        atrialSeptalDefect: z.string().optional(),
        patentForamenOvale: z.string().optional(),
        lvChamberSize: z.string().optional(),
        laChamberSize: z.string().optional(),
        rvChamberSize: z.string().optional(),
        raChamberSize: z.string().optional(),
        regionalWallMotionAbnormalities: z.string().optional(),
        aorticValve: z.string().optional(),
        mitralValve: z.string().optional(),
        tricuspidValve: z.string().optional(),
        pulmonicValve: z.string().optional(),
        aorticStenosis: z.string().optional(),
        aorticInsufficiency: z.string().optional(),
        mitralStenosis: z.string().optional(),
        mitralRegurgitation: z.string().optional(),
        tricuspidStenosis: z.string().optional(),
        tricuspidRegurgitation: z.string().optional(),
        pulmonicStenosis: z.string().optional(),
        pulmonicInsufficiency: z.string().optional(),
        rvspmm: z.string().optional(),
        pericardialEffusion: z.string().optional(),
        peripheralPulmonaryStenosis: z.string().optional(),
        pulmonaryVeins: z.string().optional(),
        coronaryAnatomy: z.string().optional(),
        aorticArch: z.string().optional(),
        greatVessels: z.string().optional(),
        pdaDuctalArch: z.string().optional(),
        conotruncalAnatomy: z.string().optional(),
        restingEfPercent: z.string().optional(),
        postStressEfPercent: z.string().optional(),
        restingRwma: z.string().optional(),
        postStressRwma: z.string().optional(),
        responseToStress: z.string().optional(),
        stressAorticStenosis: z.string().optional(),
        stressAorticInsufficiency: z.string().optional(),
        stressMitralStenosis: z.string().optional(),
        stressMitralRegurgitation: z.string().optional(),
        stressTricuspidStenosis: z.string().optional(),
        stressTricuspidRegurgitation: z.string().optional(),
        stressPulmonicStenosis: z.string().optional(),
        stressPulmonicInsufficiency: z.string().optional(),
        stressRvspmm: z.string().optional(),
        fetalBiometry: z.string().optional(),
        fetalPosition: z.string().optional(),
        fetalHeartRateRhythm: z.string().optional(),
        postStressDopplerPerformed: z.string().optional(),
        otherFindings1: z.string().optional(),
        otherFindings2: z.string().optional(),
        otherFindings3: z.string().optional(),
        reviewComments: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { token, ...findings } = input;
        const invitation = await getOverReadInvitationByToken(token);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation" });
        if (invitation.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Already submitted" });
        const submissionId = await createOverReadSubmission({
          invitationId: invitation.id,
          labId: invitation.labId,
          dateReviewCompleted: findings.dateReviewCompleted,
          examIdentifier: invitation.examIdentifier,
          examDos: invitation.examDos,
          examType: invitation.examType,
          postStressDopplerPerformed: invitation.postStressDopplerPerformed,
          originalInterpretingPhysician: invitation.originalInterpretingPhysician,
          ...findings,
        });
        await updateOverReadInvitationStatus(invitation.id, "completed", {
          completedAt: new Date(),
          submissionId,
        });
        // Notify lab admin
        try {
          const { sendEmail } = await import("./_core/email");
          const { getUserById: getUser } = await import("./db");
          const creator = await getUser(invitation.createdByUserId);
          if (creator?.email) {
            const appUrl = process.env.VITE_APP_URL || "https://app.iheartecho.com";
            const step2Url = `${appUrl}/accreditation?tab=physician-review&step2=${submissionId}`;
            await sendEmail({
              to: { name: creator.displayName || creator.name || "Lab Admin", email: creator.email },
              subject: `Over-Read Completed &#8212; ${invitation.examType} (${invitation.examIdentifier})`,
              htmlBody: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #189aa1; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 22px;">iHeartEcho&#8482; &#8212; Over-Read Completed</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                    <p style="color: #374151;">The physician over-read has been completed for the following exam:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Exam Type</td><td style="padding: 8px; color: #374151;">${invitation.examType}</td></tr>
                      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Exam Identifier</td><td style="padding: 8px; color: #374151;">${invitation.examIdentifier}</td></tr>
                      <tr><td style="padding: 8px; background: #f3f4f6; font-weight: bold; color: #374151;">Over-Reading Physician</td><td style="padding: 8px; color: #374151;">${findings.overReadingPhysicianName}</td></tr>
                    </table>
                    <p style="color: #374151;">You can now complete <strong>Step 2: Comparison Review</strong> to compare the over-read with the original interpretation.</p>
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${step2Url}" style="background: #189aa1; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">Complete Step 2 Comparison</a>
                    </div>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                    <p style="color: #9ca3af; font-size: 12px;">Powered by iHeartEcho&#8482; DIY Accreditation Tool&#8482; | All About Ultrasound</p>
                  </div>
                </div>
              `,
              previewText: `Over-read completed for ${invitation.examType} &#8212; ${invitation.examIdentifier}`,
            });
          }
        } catch (notifErr) {
          console.warn("[OverRead] Lab admin notification failed:", notifErr);
        }
        return { success: true, submissionId };
      }),

    /** Monthly summary of comparison reviews for Reports & Analytics tab */
    getMonthlySummary: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getComparisonReviewsMonthlySummary(lab.id);
    }),

    /** List all comparison reviews for the current user's lab */
    listComparisonReviews: protectedProcedure.query(async ({ ctx }) => {
      const lab = await getLabByMemberUserId(ctx.user.id);
      if (!lab) return [];
      return getComparisonReviewsByLab(lab.id);
    }),

    /** Get a specific over-read submission to prepopulate Step 2 */
    getOverReadSubmission: protectedProcedure
      .input(z.object({ submissionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        const submission = await getOverReadSubmissionById(input.submissionId);
        if (!submission || submission.labId !== lab.id) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
        return submission;
      }),

    /** Submit the comparison review (Step 2) */
    submitComparisonReview: protectedProcedure
      .input(z.object({
        invitationId: z.number().optional(),
        overReadSubmissionId: z.number().optional(),
        overReadingPhysician: z.string().optional(),
        originalReadingPhysician: z.string().min(1),
        dateReviewCompleted: z.string().optional(),
        examDos: z.string().optional(),
        examIdentifier: z.string().min(1),
        examType: z.string().min(1),
        origSitus: z.string().optional(),
        origCardiacPosition: z.string().optional(),
        origLeftHeart: z.string().optional(),
        origRightHeart: z.string().optional(),
        origEfPercent: z.string().optional(),
        origLvWallThickness: z.string().optional(),
        origVentricularSeptalDefect: z.string().optional(),
        origAtrialSeptalDefect: z.string().optional(),
        origPatentForamenOvale: z.string().optional(),
        origLvChamberSize: z.string().optional(),
        origLaChamberSize: z.string().optional(),
        origRvChamberSize: z.string().optional(),
        origRaChamberSize: z.string().optional(),
        origRegionalWallMotionAbnormalities: z.string().optional(),
        origAorticValve: z.string().optional(),
        origMitralValve: z.string().optional(),
        origTricuspidValve: z.string().optional(),
        origPulmonicValve: z.string().optional(),
        origAorticStenosis: z.string().optional(),
        origAorticInsufficiency: z.string().optional(),
        origMitralStenosis: z.string().optional(),
        origMitralRegurgitation: z.string().optional(),
        origTricuspidStenosis: z.string().optional(),
        origTricuspidRegurgitation: z.string().optional(),
        origPulmonicStenosis: z.string().optional(),
        origPulmonicInsufficiency: z.string().optional(),
        origRvspmm: z.string().optional(),
        origPericardialEffusion: z.string().optional(),
        origPeripheralPulmonaryStenosis: z.string().optional(),
        origPulmonaryVeins: z.string().optional(),
        origCoronaryAnatomy: z.string().optional(),
        origAorticArch: z.string().optional(),
        origGreatVessels: z.string().optional(),
        origPdaDuctalArch: z.string().optional(),
        origConotruncalAnatomy: z.string().optional(),
        origRestingEfPercent: z.string().optional(),
        origPostStressEfPercent: z.string().optional(),
        origRestingRwma: z.string().optional(),
        origPostStressRwma: z.string().optional(),
        origResponseToStress: z.string().optional(),
        origStressAorticStenosis: z.string().optional(),
        origStressAorticInsufficiency: z.string().optional(),
        origStressMitralStenosis: z.string().optional(),
        origStressMitralRegurgitation: z.string().optional(),
        origStressTricuspidStenosis: z.string().optional(),
        origStressTricuspidRegurgitation: z.string().optional(),
        origStressPulmonicStenosis: z.string().optional(),
        origStressPulmonicInsufficiency: z.string().optional(),
        origStressRvspmm: z.string().optional(),
        origFetalBiometry: z.string().optional(),
        origFetalPosition: z.string().optional(),
        origFetalHeartRateRhythm: z.string().optional(),
        concordanceScore: z.number().optional(),
        discordantFields: z.string().optional(),
        reviewComments: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        const reviewId = await createComparisonReview({
          labId: lab.id,
          createdByUserId: ctx.user.id,
          ...input,
        });
        return { success: true, reviewId };
      }),

    /** Delete a comparison review */
    deleteComparisonReview: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await deleteComparisonReview(input.id, lab.id);
        return { success: true };
      }),
  }),

  // ─── Possible Case Studies ──────────────────────────────────────────────────
  caseStudies: router({
    /** List all possible case studies for the lab */
    list: protectedProcedure
      .input(z.object({
        examType: z.string().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) return [];
        return getPossibleCaseStudies(lab.id, input);
      }),

    /** Create a new possible case study */
    create: protectedProcedure
      .input(z.object({
        sourceIqrId: z.number().optional(),
        examType: z.string().optional(),
        examDate: z.string().optional(),
        patientMrn: z.string().optional(),
        diagnosis: z.string().optional(),
        clinicalNotes: z.string().optional(),
        sonographerName: z.string().optional(),
        sonographerEmail: z.string().optional(),
        interpretingPhysicianName: z.string().optional(),
        interpretingPhysicianEmail: z.string().optional(),
        accreditationType: z.string().optional(),
        submissionStatus: z.enum(["identified", "under_review", "submitted", "accepted"]).optional(),
        submissionNotes: z.string().optional(),
        isTechnicalDirectorCase: z.boolean().optional(),
        isMedicalDirectorCase: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        const caseStudyId = await generateCaseStudyId(lab.id);
        await createPossibleCaseStudy({
          ...input,
          caseStudyId,
          labId: lab.id,
          createdByUserId: ctx.user.id,
        });
        return { success: true, caseStudyId };
      }),

    /** Update a possible case study */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        examType: z.string().optional(),
        examDate: z.string().optional(),
        patientMrn: z.string().optional(),
        diagnosis: z.string().optional(),
        clinicalNotes: z.string().optional(),
        sonographerName: z.string().optional(),
        sonographerEmail: z.string().optional(),
        interpretingPhysicianName: z.string().optional(),
        interpretingPhysicianEmail: z.string().optional(),
        accreditationType: z.string().optional(),
        submissionStatus: z.enum(["identified", "under_review", "submitted", "accepted"]).optional(),
        submissionNotes: z.string().optional(),
        isTechnicalDirectorCase: z.boolean().optional(),
        isMedicalDirectorCase: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        const { id, ...data } = input;
        await updatePossibleCaseStudy(id, lab.id, data);
        return { success: true };
      }),

    /** Delete a possible case study */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lab = await getLabByMemberUserId(ctx.user.id);
        if (!lab) throw new TRPCError({ code: "NOT_FOUND", message: "No lab found" });
        await deletePossibleCaseStudy(input.id, lab.id);
        return { success: true };
      }),
  }),

  stats: router({
    /** Total user count (active + pending) — refreshed by the client daily */
    userCount: publicProcedure.query(async () => {
      const total = await countUsers();
      return { total };
    }),
  }),

  // ─── Demo Mode ──────────────────────────────────────────────────────────────
  demo: router({
    /** List all demo users (isDemo=true) with their lab info — platform admin only */
    listDemoUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        const roles = await getUserRoles(ctx.user.id);
        if (!roles.includes('platform_admin')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin only' });
        }
      }
      const { getDb } = await import('./db');
      const db = await getDb();
      if (!db) return [];
      const { users, labMembers, labSubscriptions } = await import('../drizzle/schema');
      const { eq, and } = await import('drizzle-orm');
      const demoUsers = await db.select().from(users).where(eq(users.isDemo, true));
      // Enrich with lab info
      const enriched = await Promise.all(demoUsers.map(async (u) => {
        const memberRows = await db.select().from(labMembers).where(eq(labMembers.userId, u.id));
        const labId = memberRows[0]?.labId ?? null;
        let labName: string | null = null;
        let memberRole: string | null = memberRows[0]?.role ?? null;
        if (labId) {
          const labRows = await db.select().from(labSubscriptions).where(eq(labSubscriptions.id, labId));
          labName = labRows[0]?.labName ?? null;
        } else {
          // Check if this user is a lab admin
          const adminLabRows = await db.select().from(labSubscriptions).where(eq(labSubscriptions.adminUserId, u.id));
          if (adminLabRows.length > 0) {
            labName = adminLabRows[0]?.labName ?? null;
            memberRole = 'admin';
          }
        }
        return {
          id: u.id,
          displayName: u.displayName ?? u.name ?? u.email ?? 'Unknown',
          email: u.email,
          credentials: u.credentials,
          labName,
          memberRole,
        };
      }));
      return enriched.sort((a, b) => (a.labName ?? '').localeCompare(b.labName ?? '') || (a.displayName).localeCompare(b.displayName));
    }),

    /** Start a demo session as a specific demo user — platform admin only */
    start: protectedProcedure
      .input(z.object({ targetUserId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Only platform admins or owners can start demo mode
        if (ctx.user.role !== 'admin') {
          const roles = await getUserRoles(ctx.user.id);
          if (!roles.includes('platform_admin')) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin only' });
          }
        }
        // Verify target is a demo user
        const targetUser = await getUserById(input.targetUserId);
        if (!targetUser?.isDemo) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Target user is not a demo account' });
        }
        // Issue a short-lived demo JWT
        const { SignJWT } = await import('jose');
        const { ENV } = await import('./_core/env');
        const secretKey = new TextEncoder().encode(ENV.cookieSecret);
        const expiresAt = Math.floor((Date.now() + TWO_HOURS_MS) / 1000);
        const demoToken = await new SignJWT({ targetUserId: input.targetUserId, adminId: ctx.user.id })
          .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
          .setExpirationTime(expiresAt)
          .sign(secretKey);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(DEMO_COOKIE_NAME, demoToken, { ...cookieOptions, maxAge: TWO_HOURS_MS });
        return { success: true, targetUser: { id: targetUser.id, displayName: targetUser.displayName ?? targetUser.name } };
      }),

    /** Stop demo mode and return to the real admin session */
    stop: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(DEMO_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),
});
export type AppRouter = typeof appRouter;

