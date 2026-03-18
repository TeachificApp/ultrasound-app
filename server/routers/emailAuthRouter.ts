/**
 * emailAuthRouter.ts
 * Custom email/password authentication — fully white-labelled, no OAuth portal.
 *
 * Procedures:
 *   emailAuth.register       — create account + send verification email
 *   emailAuth.login          — verify credentials + issue session cookie
 *   emailAuth.verifyEmail    — confirm email with token
 *   emailAuth.resendVerification — resend the verification email
 *   emailAuth.forgotPassword — send password-reset email
 *   emailAuth.resetPassword  — apply new password via reset token
 */

import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { ENV } from "../_core/env";
import { publicProcedure, router } from "../_core/trpc";
import { getDb, ensureUserRole, markThinkificEnrolled } from "../db";
import { sendEmail, buildWelcomeEmail, buildVerificationEmail, buildPasswordResetEmail } from "../_core/email";
import { enrollInFreeMembership } from "../thinkific";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Synthetic openId used for email/password accounts */
function emailOpenId(email: string) {
  return `email:${email.toLowerCase().trim()}`;
}

/** Generate a cryptographically secure random token */
function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/** Token expiry: 24 hours from now */
function tokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** Issue a session cookie for a user identified by their synthetic openId */
async function issueSession(
  req: Parameters<typeof getSessionCookieOptions>[0],
  res: { cookie: (name: string, value: string, options: object) => void },
  openId: string,
  name: string
) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

// ─── Email sending helpers (use SendGrid via shared _core/email.ts) ──────────

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function sendVerificationEmail(to: string, token: string, name: string) {
  const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
  const verificationUrl = `${appUrl}/verify-email?token=${token}`;
  const firstName = name || "there";
  const { subject, htmlBody, previewText } = buildVerificationEmail({ firstName, verificationUrl });
  const sent = await sendEmail({ to: { name: firstName, email: to }, subject, htmlBody, previewText });
  if (!sent) {
    console.warn(`[EmailAuth] Verification email to ${to} could not be sent (SendGrid unavailable)`);
  }
}

async function sendPasswordResetEmail(to: string, token: string, name: string) {
  const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const firstName = name || "there";
  const { subject, htmlBody, previewText } = buildPasswordResetEmail({ firstName, resetUrl });
  const sent = await sendEmail({ to: { name: firstName, email: to }, subject, htmlBody, previewText });
  if (!sent) {
    console.warn(`[EmailAuth] Password reset email to ${to} could not be sent (SendGrid unavailable)`);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const emailAuthRouter = router({
  /**
   * Register a new account with email + password.
   * Sends a verification email. The account is active immediately but
   * emailVerified is false until the user clicks the link.
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().min(1, "First name is required").max(50),
        lastName: z.string().min(1, "Last name is required").max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const email = input.email.toLowerCase().trim();
      const openId = emailOpenId(email);
      const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`;

      // Check for existing account
      const existing = await db
        .select({ id: users.id, isPending: users.isPending, emailVerified: users.emailVerified })
        .from(users)
        .where(or(eq(users.openId, openId), eq(users.email, email)))
        .limit(1);

      if (existing.length > 0) {
        const existingUser = existing[0];
        if (existingUser.isPending) {
          // Admin pre-registered this email — activate the pending account
          const passwordHash = await bcrypt.hash(input.password, 12);
          const verificationToken = generateToken();
          const verificationExpiry = tokenExpiry(24);
          await db
            .update(users)
            .set({
              openId,
              name: fullName,
              loginMethod: "email",
              passwordHash,
              emailVerified: false,
              emailVerificationToken: verificationToken,
              emailVerificationExpiry: verificationExpiry,
              isPending: false,
              lastSignedIn: new Date(),
            })
            .where(eq(users.id, existingUser.id));
          await sendVerificationEmail(email, verificationToken, input.firstName);
          // Send welcome email asynchronously (don't block activation)
          const appUrlActivate = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
          const welcomeActivate = buildWelcomeEmail({
            firstName: input.firstName,
            loginUrl: `${appUrlActivate}/login`,
            roles: [],
          });
          sendEmail({
            to: { name: fullName, email },
            subject: welcomeActivate.subject,
            htmlBody: welcomeActivate.htmlBody,
            previewText: welcomeActivate.previewText,
          }).catch((err: unknown) => {
            console.error(`[EmailAuth] Failed to send welcome email to ${email}:`, err);
          });
          // Issue session immediately so they can use the app
          await issueSession(ctx.req, ctx.res, openId, fullName);
          return { success: true, emailSent: true, activated: true };
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Please sign in instead.",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 12);
      const verificationToken = generateToken();
      const verificationExpiry = tokenExpiry(24);

      // Insert new user
      await db.insert(users).values({
        openId,
        name: fullName,
        email,
        loginMethod: "email",
        passwordHash,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
        isPending: false,
        lastSignedIn: new Date(),
      });

      // Ensure base "user" role
      const newUser = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (newUser[0]) {
        await ensureUserRole(newUser[0].id);
        // Auto-enroll in Thinkific free membership
        if (newUser[0].email) {
          enrollInFreeMembership(newUser[0].email, input.firstName, input.lastName)
            .then(async () => {
              await markThinkificEnrolled(newUser[0].id);
            })
            .catch((err: unknown) => {
              console.error(`[Thinkific] Auto-enrollment failed for ${email}:`, err);
            });
        }
      }

      // Send verification email
      await sendVerificationEmail(email, verificationToken, input.firstName);

      // Send welcome email asynchronously (don't block registration)
      const appUrl = process.env.VITE_APP_URL ?? "https://app.iheartecho.com";
      const welcomePayload = buildWelcomeEmail({
        firstName: input.firstName,
        loginUrl: `${appUrl}/login`,
        roles: [],
      });
      sendEmail({
        to: { name: fullName, email },
        subject: welcomePayload.subject,
        htmlBody: welcomePayload.htmlBody,
        previewText: welcomePayload.previewText,
      }).catch((err: unknown) => {
        console.error(`[EmailAuth] Failed to send welcome email to ${email}:`, err);
      });

      // Issue session immediately — user can use the app while email is unverified
      await issueSession(ctx.req, ctx.res, openId, fullName);

      return { success: true, emailSent: true, activated: false };
    }),

  /**
   * Sign in with email + password.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const email = input.email.toLowerCase().trim();
      const openId = emailOpenId(email);

      const result = await db
        .select()
        .from(users)
        .where(or(eq(users.openId, openId), eq(users.email, email)))
        .limit(1);

      const user = result[0];

      // Generic error to avoid email enumeration
      const invalidError = new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });

      if (!user) throw invalidError;
      if (!user.passwordHash) {
        // Account exists but was created via OAuth — guide them
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This account was created with Google/Microsoft/Apple. Please use social sign-in.",
        });
      }
      if (user.isPending) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Your account has been pre-registered but not yet activated. Please complete registration.",
        });
      }

      const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
      if (!passwordMatch) throw invalidError;

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      // Issue session
      await issueSession(ctx.req, ctx.res, openId, user.name ?? "");

      return {
        success: true,
        emailVerified: user.emailVerified,
        name: user.name,
      };
    }),

  /**
   * Verify email address using the token from the verification email.
   */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.emailVerificationToken, input.token))
        .limit(1);

      const user = result[0];
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired verification link." });
      }
      if (user.emailVerified) {
        return { success: true, alreadyVerified: true };
      }
      if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link has expired. Please request a new one." });
      }

      await db
        .update(users)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        })
        .where(eq(users.id, user.id));

      // Issue session if not already logged in
      if (!ctx.user) {
        await issueSession(ctx.req, ctx.res, user.openId ?? emailOpenId(user.email ?? ""), user.name ?? "");
      }

      return { success: true, alreadyVerified: false };
    }),

  /**
   * Resend the verification email to the currently signed-in user.
   */
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const email = input.email.toLowerCase().trim();
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Always return success to avoid email enumeration
      const user = result[0];
      if (user && !user.emailVerified && user.passwordHash) {
        const verificationToken = generateToken();
        const verificationExpiry = tokenExpiry(24);
        await db
          .update(users)
          .set({ emailVerificationToken: verificationToken, emailVerificationExpiry: verificationExpiry })
          .where(eq(users.id, user.id));
        const firstName = (user.name ?? "").split(" ")[0] ?? "there";
        await sendVerificationEmail(email, verificationToken, firstName);
      }

      return { success: true };
    }),

  /**
   * Request a password reset email.
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const email = input.email.toLowerCase().trim();
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // Always return success to avoid email enumeration
      // Send reset email to any registered account (including OAuth-only accounts without a passwordHash)
      // — this allows OAuth users to set a password for the first time via the reset flow
      const user = result[0];
      if (user) {
        const resetToken = generateToken();
        const resetExpiry = tokenExpiry(1); // 1 hour
        await db
          .update(users)
          .set({ passwordResetToken: resetToken, passwordResetExpiry: resetExpiry })
          .where(eq(users.id, user.id));
        const firstName = (user.name ?? "").split(" ")[0] ?? "there";
        await sendPasswordResetEmail(email, resetToken, firstName);
      }

      return { success: true };
    }),

  /**
   * Reset password using the token from the reset email.
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.passwordResetToken, input.token))
        .limit(1);

      const user = result[0];
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired reset link." });
      }
      if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db
        .update(users)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
          emailVerified: true, // Resetting password confirms ownership of email
        })
        .where(eq(users.id, user.id));

      // Issue session so they're logged in after reset
      const openId = user.openId ?? emailOpenId(user.email ?? "");
      await issueSession(ctx.req, ctx.res, openId, user.name ?? "");

      return { success: true };
    }),
});
