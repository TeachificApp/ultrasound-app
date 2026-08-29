import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerChatRoutes } from "./chat";
import { registerStripeWebhook } from "../webhooks/stripe";
import { registerSendGridWebhook } from "../webhooks/sendgrid";
import { registerUploadCaseMediaRoute } from "../routes/uploadCaseMedia";
import { registerUploadQuestionImageRoute } from "../routes/uploadQuestionImage";
import { registerUploadQuestionMediaRoute } from "../routes/uploadQuestionMedia";
import { registerUploadNavigatorImageRoute } from "../routes/uploadNavigatorImage";
import { registerUnsubscribeRoute } from "../routes/unsubscribe";
import { registerAuthLoginRoute } from "../routes/authLogin";
import { registerMediaServeRoutes } from "../routes/mediaServe";
import { registerUploadMediaRepoRoute } from "../routes/uploadMediaRepo";
import { registerUploadCourseImageRoute } from "../routes/uploadCourseImage";
import { registerProcessRichTextHtmlRoute } from "../routes/processRichTextHtml";
import { registerReconstructMathRoute } from "../routes/reconstructMath";
import { registerUploadQuizBankFileRoute } from "../routes/uploadQuizBankFile";
import { registerUploadAiGenerationSourceRoute } from "../routes/uploadAiGenerationSource";
import quizImportRouter from "../quizImportRoutes";
import questionBankExportRouter from "../routes/questionBankExport";
import { registerUploadDigitalFileRoute } from "../routes/uploadDigitalFile";
import { registerUploadCohortMediaRoute } from "../routes/uploadCohortMedia";
import { registerUploadCohortResourceRoute } from "../routes/uploadCohortResource";
import { registerUploadSocialImageRoute } from "../routes/uploadSocialImage";
import { registerUploadTeachRoute } from "../routes/uploadTeach";
import { registerUploadGenericRoute } from "../routes/uploadGeneric";
import { registerSsoAutoRoute } from "../routes/ssoAuto";
import { registerFunnelOgMetaRoutes } from "../routes/funnelOgMeta";
import { registerSitemapRoute } from "../routes/sitemap";
import { registerAutoLoginRoute } from "../routes/autoLogin";
import { registerGoogleOAuthRoutes, registerGoogleDriveCmeOAuthRoutes } from "../routes/googleOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { detectBrandFromHostname, detectBrandMode } from "../../shared/brands";
import { normalizeLegacyStudentDashboardLocation } from "../../shared/studentDashboardUrls";
import { resolveAssetUrls } from "../lib/resolveAssetUrl";
import { startChallengeCron } from "../jobs/challengeCron";
import { startMediaPurgeCron } from "../jobs/mediaPurgeCron";
import { startEmailCampaignScheduler } from "../routers/emailCampaignRouter";
import { backfillAllContacts } from "../lib/emailListHelper";
import { getDb } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { initSonoQuizHub } from "../sonoQuizHub";
import { startMirrorSync } from "../jobs/mirrorSync";
import { startSharingMonitor } from "../jobs/sharingMonitor";
import { scormExtractHeartbeatHandler, scormHealthCheckHandler } from "../routes/scormExtractor";
import { healStuckScormVersions } from "../scheduled/scormHealthCheck";
import { registerFormEmbedRoutes } from "../routes/formEmbedRoutes";
import { registerCurriculumEmbedRoutes } from "../routes/curriculumEmbedRoutes";
import { registerIncludedItemsEmbedRoutes } from "../routes/includedItemsEmbedRoutes";
import { hourlyBackupHandler } from "../routes/hourlyBackupHandler";
import { sdmsCmeDailySummaryHandler } from "../routes/sdmsCmeDailySummary";
import { cmeExpiryCheckHandler } from "../scheduled/cmeExpiryCheck";
import { stripeSubscriptionSyncHandler } from "../scheduled/stripeSubscriptionSync";
import { clearSessionCookies, getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, DEMO_COOKIE_NAME } from "../../shared/const";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust the reverse proxy so req.protocol reflects HTTPS and SameSite=None;Secure cookies work
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Stripe webhook MUST register before express.json().
  registerStripeWebhook(app);
  // Configure body parser with larger size limit for file uploads
  // No body-parser limit for chunked media uploads — multer handles streaming directly
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));
  // ── Dynamic PWA manifest (brand-aware) ─────────────────────────────────────
  app.get("/manifest.json", (req, res) => {
    const hostname = req.hostname || req.headers.host?.split(":")[0] || "";
    const brand = detectBrandFromHostname(hostname);
    const brandMode = detectBrandMode(hostname);

    const AAUS_MANIFEST = {
      id: "https://app.allaboutultrasound.com/",
      name: "UltrasoundAssist\u2122",
      short_name: "UltrasoundAssist",
      description: "Ultrasound Clinical Intelligence \u2014 real-time ultrasound interpretation and measurement assistant for sonographers, radiologists, OB/Gyn, vascular surgeons, and ultrasound educators from All About Ultrasound\u2122.",
      start_url: "/",
      scope: "/",
      display: "standalone" as const,
      background_color: "#189aa1",
      theme_color: "#189aa1",
      orientation: "portrait-primary" as const,
      icons: [
        { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_teal_f0c966ce.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_512_teal_840494a6.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      categories: ["medical", "health", "education"],
      lang: "en-US",
    };

    const IHE_MANIFEST = {
      id: "https://app.iheartecho.com/",
      name: "iHeartEcho™",
      short_name: "iHeartEcho™",
      description: "Echocardiography Clinical Intelligence \u2014 real-time echo interpretation and measurement assistant for cardiac ultrasound students, sonographers, echocardiographers, cardiologists, physicians, residents, ACS professionals, and echo educators.",
      start_url: "/",
      scope: "/",
      display: "standalone" as const,
      background_color: "#0e1e2e",
      theme_color: "#189aa1",
      orientation: "portrait-primary" as const,
      icons: [
        { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-192_df958e9b.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      categories: ["medical", "health", "education"],
      lang: "en-US",
    };

    const COMBINED_MANIFEST = {
      ...AAUS_MANIFEST,
      id: "https://members.allaboutultrasound.com/",
      name: "All About Ultrasound | iHeartEcho",
      short_name: "AAUS | iHE",
      description: "Ultrasound Clinical Intelligence \u2014 learning platform for sonographers, physicians, and ultrasound educators.",
    };

    let manifest;
    if (brand === "iheartecho") {
      manifest = IHE_MANIFEST;
    } else if (brandMode === "combined") {
      manifest = COMBINED_MANIFEST;
    } else {
      manifest = AAUS_MANIFEST;
    }

    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(resolveAssetUrls(manifest));
  });

  // Debug endpoint to check brand detection from hostname
  app.get("/api/debug/brand", (req, res) => {
    const xAppHostname = req.headers["x-app-hostname"] || "";
    const xForwardedHost = req.headers["x-forwarded-host"] || "";
    const origin = req.headers["origin"] || "";
    const referer = req.headers["referer"] || "";
    const host = req.headers.host || "";
    const reqHostname = req.hostname || "";
    function extractH(url: string) { try { return new URL(url).hostname; } catch { return ""; } }
    const resolved = (Array.isArray(xAppHostname) ? xAppHostname[0] : xAppHostname)
      || (Array.isArray(xForwardedHost) ? xForwardedHost[0] : xForwardedHost)
      || extractH(Array.isArray(origin) ? origin[0] : origin)
      || extractH(Array.isArray(referer) ? referer[0] : referer)
      || host || reqHostname || "";
    const brand = detectBrandFromHostname(resolved);
    const brandMode = detectBrandMode(resolved);
    const cookieOpts = getSessionCookieOptions(req);
    const cookieHeader = req.headers.cookie || "";
    const hasCookie = cookieHeader.includes("app_session_id");
    res.json({ resolved, xAppHostname, xForwardedHost, origin, referer, host, reqHostname, brand, brandMode, cookieDomain: cookieOpts.domain || '(none)', cookieSameSite: cookieOpts.sameSite, cookieHeader: cookieHeader.substring(0, 300), hasCookie });
  });
  // Test endpoint to verify Set-Cookie headers pass through Cloudflare
  app.get("/api/debug/set-test-cookie", (req, res) => {
    const cookieOpts = getSessionCookieOptions(req);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.cookie("test_cookie", "hello_from_server", { ...cookieOpts, maxAge: 60000 });
    const cookieHeader = req.headers.cookie || "";
    res.json({ cookieSet: true, domain: cookieOpts.domain || '(none)', sameSite: cookieOpts.sameSite, secure: cookieOpts.secure, cookieHeader: cookieHeader.substring(0, 200), canonicalRootDomain: process.env.CANONICAL_ROOT_DOMAIN || '(not set)', nodeEnv: process.env.NODE_ENV });
  });
  // Railway/load-balancer health probe — must return HTTP 200 with no auth
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, ts: Date.now() });
  });
  // Build version debug endpoint to verify deployed code
  app.get("/api/debug/build-version", (_req, res) => {
    res.json({ version: "2026-05-14-v2-api-media", deployedAt: new Date().toISOString(), spaRegex: "^/(?!media/|api/|manus-storage/).*" });
  });
  // Temporary debug endpoint to diagnose Railway DB connection
  app.get("/api/debug/db-status", async (_req, res) => {
    const { getDb } = await import("../db");
    const hasDbUrl = !!process.env.DATABASE_URL;
    const dbUrlPrefix = process.env.DATABASE_URL?.substring(0, 30) || "NOT SET";
    const db = await getDb();
    res.json({ hasDbUrl, dbUrlPrefix, dbConnected: !!db });
  });
  // Temporary debug endpoint to diagnose email/SendGrid configuration
  app.get("/api/debug/email-status", async (_req, res) => {
    const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
    const keyPrefix = process.env.SENDGRID_API_KEY?.substring(0, 7) || "NOT SET";
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "NOT SET";
    const fromName = process.env.SENDGRID_FROM_NAME || "NOT SET";
    res.json({ hasSendGridKey, keyPrefix, fromEmail, fromName, deployedAt: new Date().toISOString() });
  });
  // Temporary debug endpoint to test sending an email via SendGrid
  app.get("/api/debug/test-email", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const to = req.query.to as string;
    if (!to) return res.status(400).json({ error: "Pass ?to=your@email.com" });
    const { sendEmail } = await import("./email");
    const result = await sendEmail({
      to: { name: "Test", email: to },
      subject: "UltrasoundAssist™ Email Test",
      htmlBody: "<h2>Email is working!</h2><p>If you see this, SendGrid is correctly configured.</p>",
    });
    res.json({ sent: result, to, timestamp: new Date().toISOString() });
  });
  app.get("/api/debug/password-reset-lookup", async (req, res) => {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Pass ?email=your@email.com" });
    const { getUserByEmail } = await import("../db");
    const { resolveAuthDeliveryEmail } = await import("../lib/authEmailDelivery");
    const user = await getUserByEmail(email);
    res.json({
      userFound: !!user,
      userId: user?.id ?? null,
      hasPasswordHash: !!user?.passwordHash,
      deliveryEmail: user ? resolveAuthDeliveryEmail(user, email) : null,
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/debug/email-suppression", async (req, res) => {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Pass ?email=your@email.com" });
    const { getSendGridSuppressionStatus, isSendGridDeliveryBlocked } = await import(
      "../lib/sendgridSuppressions"
    );
    const { getUserByEmail } = await import("../db");
    const sendGrid = await getSendGridSuppressionStatus(email);
    const user = await getUserByEmail(email);
    res.json({
      email,
      sendGrid,
      blocked: isSendGridDeliveryBlocked(sendGrid),
      user: user
        ? {
            id: user.id,
            unsubscribedAt: user.unsubscribedAt,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  });
  app.post("/api/debug/clear-email-suppression", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const email = String(req.query.email ?? (req.body as { email?: string })?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) return res.status(400).json({ error: "Pass ?email=owner@example.com" });
    const { isPlatformOwnerEmail } = await import("../../shared/platformOwnerAccess");
    if (!isPlatformOwnerEmail(email)) {
      return res.status(403).json({ error: "Email is not in the platform owner allowlist" });
    }
    const { getSendGridSuppressionStatus, clearSendGridSuppressionLists } = await import(
      "../lib/sendgridSuppressions"
    );
    const { getUserByEmail } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const { getDb } = await import("../db");
    const before = await getSendGridSuppressionStatus(email);
    const cleared = await clearSendGridSuppressionLists(email);
    const after = await getSendGridSuppressionStatus(email);
    const user = await getUserByEmail(email);
    let dbUnsubscribeCleared = false;
    if (user?.unsubscribedAt) {
      const db = await getDb();
      if (db) {
        await db.update(users).set({ unsubscribedAt: null }).where(eq(users.id, user.id));
        dbUnsubscribeCleared = true;
      }
    }
    res.json({
      email,
      before,
      cleared,
      after,
      dbUnsubscribeCleared,
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/debug/test-password-reset", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const to = String(req.query.to ?? "").trim().toLowerCase();
    if (!to) return res.status(400).json({ error: "Pass ?to=your@email.com" });
    const origin = String(req.query.origin ?? "https://learn.allaboutultrasound.com");
    const { getUserByEmail, setPasswordResetToken } = await import("../db");
    const { sendEmail, buildPasswordResetEmail } = await import("./email");
    const { resolveAuthDeliveryEmail } = await import("../lib/authEmailDelivery");
    const { detectBrandMode } = await import("@shared/brands");
    const crypto = await import("crypto");
    const user = await getUserByEmail(to);
    if (!user) {
      return res.json({ userFound: false, emailSent: false, to, timestamp: new Date().toISOString() });
    }
    const deliveryEmail = resolveAuthDeliveryEmail(user, to);
    if (!deliveryEmail) {
      return res.json({
        userFound: true,
        userId: user.id,
        emailSent: false,
        reason: "no_delivery_email",
        to,
        timestamp: new Date().toISOString(),
      });
    }
    const { ensureTransactionalEmailDelivery } = await import("../lib/ensureTransactionalEmailDelivery");
    const deliveryPrep = await ensureTransactionalEmailDelivery(deliveryEmail);
    const token = crypto.randomBytes(48).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    try {
      await setPasswordResetToken(user.id, token, expiry);
    } catch (err) {
      return res.json({
        userFound: true,
        userId: user.id,
        emailSent: false,
        reason: "token_store_failed",
        error: err instanceof Error ? err.message : "unknown",
        to,
        timestamp: new Date().toISOString(),
      });
    }
    const brandMode = detectBrandMode(new URL(origin).hostname);
    const resetUrl = `${origin}/reset-password?token=${token}`;
    const firstName = (user.displayName || user.name || "there").split(" ")[0];
    const emailPayload = buildPasswordResetEmail({ firstName, resetUrl, brandMode });
    const emailSent = await sendEmail({
      to: { name: firstName, email: deliveryEmail },
      subject: emailPayload.subject,
      htmlBody: emailPayload.htmlBody,
      previewText: emailPayload.previewText,
      brandMode,
    });
    res.json({
      userFound: true,
      userId: user.id,
      deliveryEmail,
      deliveryPrep,
      emailSent,
      to,
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/debug/test-magic-link", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const to = String(req.query.to ?? "").trim().toLowerCase();
    if (!to) return res.status(400).json({ error: "Pass ?to=your@email.com" });
    const origin = String(req.query.origin ?? "https://learn.allaboutultrasound.com");
    const { getUserByEmail, setMagicLinkToken } = await import("../db");
    const { sendEmail, buildMagicLinkEmail } = await import("./email");
    const { resolveAuthDeliveryEmail } = await import("../lib/authEmailDelivery");
    const { detectBrandMode } = await import("@shared/brands");
    const crypto = await import("crypto");
    const user = await getUserByEmail(to);
    if (!user) {
      return res.json({ userFound: false, emailSent: false, to, timestamp: new Date().toISOString() });
    }
    const deliveryEmail = resolveAuthDeliveryEmail(user, to);
    if (!deliveryEmail) {
      return res.json({
        userFound: true,
        userId: user.id,
        emailSent: false,
        reason: "no_delivery_email",
        to,
        timestamp: new Date().toISOString(),
      });
    }
    const { ensureTransactionalEmailDelivery } = await import("../lib/ensureTransactionalEmailDelivery");
    const deliveryPrep = await ensureTransactionalEmailDelivery(deliveryEmail);
    const token = crypto.randomBytes(48).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await setMagicLinkToken(user.id, token, expiry);
    const brandMode = detectBrandMode(new URL(origin).hostname);
    const magicUrl = `${origin}/api/auth/magic-verify?token=${token}&returnTo=${encodeURIComponent("/my-dashboard")}&host=${encodeURIComponent(new URL(origin).hostname)}`;
    const firstName = (user.displayName || user.name || "there").split(" ")[0];
    const emailPayload = buildMagicLinkEmail({ firstName, magicUrl, brandMode });
    const emailSent = await sendEmail({
      to: { name: firstName, email: deliveryEmail },
      subject: emailPayload.subject,
      htmlBody: emailPayload.htmlBody,
      previewText: emailPayload.previewText,
      brandMode,
    });
    res.json({
      userFound: true,
      userId: user.id,
      deliveryEmail,
      deliveryPrep,
      emailSent,
      to,
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/api/debug/owner-login-link", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Pass ?email=owner@example.com" });
    const { isPlatformOwnerEmail } = await import("../../shared/platformOwnerAccess");
    if (!isPlatformOwnerEmail(email)) {
      return res.status(403).json({ error: "Email is not in the platform owner allowlist" });
    }
    const { getUserByEmail } = await import("../db");
    const user = await getUserByEmail(email);
    if (!user) {
      return res.json({ found: false, email, timestamp: new Date().toISOString() });
    }
    const { generateAutoLoginToken } = await import("../routes/autoLogin");
    const redirect = String(req.query.redirect ?? "/platform-admin");
    const origin = String(req.query.origin ?? "https://learn.allaboutultrasound.com");
    const host = new URL(origin).hostname;
    const token = await generateAutoLoginToken(user.id, redirect.startsWith("/") ? redirect : "/platform-admin");
    const loginUrl = `${origin}/api/auth/auto-login?token=${encodeURIComponent(token)}&host=${encodeURIComponent(host)}`;
    res.json({
      found: true,
      userId: user.id,
      email,
      loginUrl,
      redirect,
      timestamp: new Date().toISOString(),
    });
  });
  // Diagnose lms_courses schema (Railway mirror often missing columns)
  app.get("/api/debug/lms-courses-schema", async (_req, res) => {
    const { getDb } = await import("../db");
    const { inspectLmsCoursesSchema } = await import("../lib/ensureLmsCoursesSchema");
    const db = await getDb();
    const status = await inspectLmsCoursesSchema(db);
    res.json({ ...status, deployedAt: new Date().toISOString() });
  });
  // Manually trigger lms_courses schema sync (same as startup migration)
  app.post("/api/debug/lms-courses-schema-sync", async (_req, res) => {
    const { getDb } = await import("../db");
    const { ensureLmsCoursesSchema, inspectLmsCoursesSchema } = await import("../lib/ensureLmsCoursesSchema");
    const db = await getDb();
    const result = await ensureLmsCoursesSchema(db);
    const after = await inspectLmsCoursesSchema(db);
    res.json({ ...result, after, deployedAt: new Date().toISOString() });
  });
  app.get("/api/debug/lms-cohort-groups-schema", async (_req, res) => {
    const { getDb } = await import("../db");
    const { inspectLmsCohortGroupsSchema } = await import("../lib/ensureLmsCohortGroupsSchema");
    const db = await getDb();
    const status = await inspectLmsCohortGroupsSchema(db);
    res.json({ ...status, deployedAt: new Date().toISOString() });
  });
  app.post("/api/debug/lms-cohort-groups-schema-sync", async (_req, res) => {
    const { getDb } = await import("../db");
    const { ensureLmsCohortGroupsSchema, inspectLmsCohortGroupsSchema } = await import("../lib/ensureLmsCohortGroupsSchema");
    const db = await getDb();
    const result = await ensureLmsCohortGroupsSchema(db);
    const after = await inspectLmsCohortGroupsSchema(db);
    res.json({ ...result, after, deployedAt: new Date().toISOString() });
  });
  app.get("/api/debug/auth-email-send-log-schema", async (_req, res) => {
    const { getDb } = await import("../db");
    const { inspectAuthEmailSendLogSchema } = await import("../lib/ensureAuthEmailSendLogSchema");
    const db = await getDb();
    const status = await inspectAuthEmailSendLogSchema(db);
    res.json({ ...status, deployedAt: new Date().toISOString() });
  });
  app.post("/api/debug/auth-email-send-log-schema-sync", async (_req, res) => {
    const { getDb } = await import("../db");
    const {
      ensureAuthEmailSendLogSchema,
      inspectAuthEmailSendLogSchema,
    } = await import("../lib/ensureAuthEmailSendLogSchema");
    const db = await getDb();
    const result = await ensureAuthEmailSendLogSchema(db);
    const after = await inspectAuthEmailSendLogSchema(db);
    res.json({ ...result, after, deployedAt: new Date().toISOString() });
  });
  app.get("/api/debug/cohort-data-audit", async (_req, res) => {
    const { getDb } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }
    const [cohortCourses, groupCounts, recordingCounts, resourceCounts, messageCounts, sessionCounts] = await Promise.all([
      db.execute(sql`SELECT id, title, slug, multi_cohort_mode AS multiCohortMode FROM lms_courses WHERE type = 'cohort' ORDER BY id`),
      db.execute(sql`SELECT course_id AS courseId, COUNT(*) AS groupCount FROM lms_cohort_groups GROUP BY course_id ORDER BY course_id`),
      db.execute(sql`SELECT course_id AS courseId, COUNT(*) AS total, SUM(cohort_group_id IS NULL) AS sharedCount FROM lms_cohort_recordings GROUP BY course_id ORDER BY course_id`),
      db.execute(sql`SELECT course_id AS courseId, COUNT(*) AS total, SUM(cohort_group_id IS NULL) AS sharedCount FROM lms_cohort_resources GROUP BY course_id ORDER BY course_id`),
      db.execute(sql`SELECT course_id AS courseId, COUNT(*) AS messageCount FROM lms_cohort_messages GROUP BY course_id ORDER BY course_id`),
      db.execute(sql`SELECT course_id AS courseId, COUNT(*) AS total, SUM(cohort_group_id IS NULL) AS sharedCount FROM lms_cohort_sessions GROUP BY course_id ORDER BY course_id`),
    ]);
    const rows = (result: unknown) => (Array.isArray(result) ? result[0] : (result as { rows?: unknown[] }).rows) ?? result;
    res.json({
      cohortCourses: rows(cohortCourses),
      groupCounts: rows(groupCounts),
      recordingCounts: rows(recordingCounts),
      resourceCounts: rows(resourceCounts),
      messageCounts: rows(messageCounts),
      sessionCounts: rows(sessionCounts),
      deployedAt: new Date().toISOString(),
    });
  });
  // User identity + entitlement accounting (Railway post-migration)
  app.get("/api/debug/user-access-audit", async (_req, res) => {
    const { getDb } = await import("../db");
    const { auditUserAccess } = await import("../lib/ensureUserAccessAccounting");
    const db = await getDb();
    const audit = await auditUserAccess(db);
    res.json({ audit, deployedAt: new Date().toISOString() });
  });
  app.post("/api/debug/user-access-reconcile", async (_req, res) => {
    const { getDb } = await import("../db");
    const { ensureUserAccessAccounting, auditUserAccess } = await import("../lib/ensureUserAccessAccounting");
    const db = await getDb();
    const before = await auditUserAccess(db);
    const reconcile = await ensureUserAccessAccounting(db);
    const after = await auditUserAccess(db);
    res.json({ before, reconcile, after, deployedAt: new Date().toISOString() });
  });
  app.get("/api/debug/email-alias-audit", async (_req, res) => {
    const { getDb } = await import("../db");
    const { auditEmailAliasIntegrity } = await import("../lib/ensureEmailAliasIntegrity");
    const db = await getDb();
    const audit = await auditEmailAliasIntegrity(db);
    res.json({ audit, deployedAt: new Date().toISOString() });
  });
  app.post("/api/debug/email-alias-reconcile", async (_req, res) => {
    const { getDb } = await import("../db");
    const {
      auditEmailAliasIntegrity,
      ensureEmailAliasIntegrity,
    } = await import("../lib/ensureEmailAliasIntegrity");
    const db = await getDb();
    const before = await auditEmailAliasIntegrity(db);
    const reconcile = await ensureEmailAliasIntegrity(db);
    const after = await auditEmailAliasIntegrity(db);
    res.json({ before, reconcile, after, deployedAt: new Date().toISOString() });
  });
  app.get("/api/debug/user-by-email", async (req, res) => {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "email query param required" });
      return;
    }
    const { getDb, getUserByEmail, getUserRoles } = await import("../db");
    const { isPlatformOwnerEmail } = await import("../../shared/platformOwnerAccess");
    const { diagnoseUserAccess } = await import("../lib/userAccessDiagnosis");
    const db = await getDb();
    const user = await getUserByEmail(email);
    if (!user) {
      res.json({ found: false, email, deployedAt: new Date().toISOString() });
      return;
    }
    const roles = await getUserRoles(user.id);
    const hasPlatformOwner = roles.includes("platform_owner");
    const hasPlatformAdmin =
      roles.includes("platform_admin") ||
      hasPlatformOwner ||
      user.role === "admin";
    const diagnosis = db ? await diagnoseUserAccess(db, email, user.accessToken) : null;
    res.json({
      found: true,
      email,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        openId: user.openId,
        isPending: user.isPending,
        name: user.name,
        loginMethod: user.loginMethod,
        hasAccessToken: Boolean(user.accessToken),
      },
      roles,
      hasPlatformOwner,
      hasPlatformAdmin,
      isPlatformOwnerEmail: isPlatformOwnerEmail(user.email),
      diagnosis,
      deployedAt: new Date().toISOString(),
    });
  });
  app.post("/api/debug/repair-user-access", async (req, res) => {
    const { denyUnlessDebugAuthorized } = await import("../lib/debugRouteGuard");
    if (denyUnlessDebugAuthorized(req, res)) return;
    const email = String(req.query.email ?? (req.body as { email?: string })?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) return res.status(400).json({ error: "Pass email in JSON body or ?email=" });

    try {
      const { repairUserAccess } = await import("../lib/repairUserAccess");
      const { diagnoseUserAccess } = await import("../lib/userAccessDiagnosis");
      const { getDb, getUserByEmail } = await import("../db");
      const result = await repairUserAccess(email);
      const db = await getDb();
      const user = db ? await getUserByEmail(email) : null;
      const diagnosis =
        db && user ? await diagnoseUserAccess(db, email, user.accessToken) : null;
      res.json({ ...result, diagnosis, deployedAt: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Repair failed";
      const status = message.includes("not found") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  });
  // Storage proxy for /manus-storage/* assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // SendGrid Event Webhook for unsubscribe/spamreport sync
  registerSendGridWebhook(app);
  // Case media upload endpoint (multipart/form-data)
  registerUploadCaseMediaRoute(app);
  // Navigator section image upload endpoint (admin only)
  registerUploadNavigatorImageRoute(app);
  // Question image upload endpoint (admin only)
  registerUploadQuestionImageRoute(app);
  // Question media upload endpoint (images + videos, admin only)
  registerUploadQuestionMediaRoute(app);
  // One-click unsubscribe from notification emails
  registerUnsubscribeRoute(app);
  // Server-side login/magic-verify routes (bypasses Cloudflare fetch-response cookie stripping)
  registerAuthLoginRoute(app);
  // Media repository multipart upload endpoint (admin only)
  registerUploadMediaRepoRoute(app);
  // Course/landing-page image upload (multipart, bypasses JSON body limit)
  registerUploadCourseImageRoute(app);
  registerProcessRichTextHtmlRoute(app);
  registerReconstructMathRoute(app);
  // Quiz bank direct file upload (SCORM .quiz, CSV, XLSX — bypasses media library)
  registerUploadQuizBankFileRoute(app);
  registerUploadAiGenerationSourceRoute(app);
  // Quiz bank import REST routes (preview, confirm-native, csv-template, xlsx template)
  app.use("/api/quiz", quizImportRouter);
  app.use("/api/quiz/question-bank", questionBankExportRouter);
  // Digital download file upload (multipart, bypasses JSON body limit)
  registerUploadDigitalFileRoute(app);
  // Cohort group discussion media upload (images + videos, admin only)
  registerUploadCohortMediaRoute(app);
  registerUploadCohortResourceRoute(app);
  // Social content image upload (multipart, admin only)
  registerUploadSocialImageRoute(app);
  // TEACH chunked file upload (multipart, bypasses tRPC JSON body limit for large PPTX files)
  registerUploadTeachRoute(app);
  // Generic file upload endpoint — used by uploadFile() helper for scan coach media and other uploads
  registerUploadGenericRoute(app);
  // Cross-domain silent SSO endpoint — must be before tRPC so it's not caught by the SPA catch-all
  registerSsoAutoRoute(app);
  // Sitemap.xml and robots.txt — must be before SPA catch-all
  registerSitemapRoute(app);
  // Funnel page OG meta injection — must be before SPA catch-all so crawlers get correct meta tags
  registerFunnelOgMetaRoutes(app);
  // Auto-login route — one-time token redemption for post-purchase automatic sign-in
  registerAutoLoginRoute(app);
  // Form embed widget routes (public embed endpoint)
  registerFormEmbedRoutes(app);
  // Curriculum embed widget routes (public iframe + JS loader for external sites)
  registerCurriculumEmbedRoutes(app);
  // Included Items embed widget routes (membership/bundle items iframe + JS loader)
  registerIncludedItemsEmbedRoutes(app);
  // Dedicated logout route — bypasses tRPC batching so Set-Cookie clear is never merged with other responses
  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookies(res, req);
    res.json({ success: true });
  });
  // Google OAuth2 routes for per-form Google Sheets integration
  registerGoogleOAuthRoutes(app);
  registerGoogleDriveCmeOAuthRoutes(app);
  // Heartbeat: SCORM extraction job (every 60s) — processes pending SCORM ZIP packages
  app.post("/api/scheduled/scorm-extract", scormExtractHeartbeatHandler);
  // Heartbeat: SCORM health-check (every 10 min) — audits done versions and re-queues broken ones
  app.post("/api/scheduled/scorm-health-check", scormHealthCheckHandler);
  // Heartbeat: Hourly source-code backup → R2 + email
  app.post("/api/scheduled/hourly-backup", hourlyBackupHandler);
  // Heartbeat: Daily SDMS CME summary — 8:00 AM UTC
  app.post("/api/scheduled/sdms-cme-daily-summary", sdmsCmeDailySummaryHandler);
  // Heartbeat: Daily CME expiry check — 09:00 UTC
  app.post("/api/scheduled/cme-expiry-check", cmeExpiryCheckHandler);

  app.post("/api/scheduled/stripe-subscription-sync", stripeSubscriptionSyncHandler);
  // Admin REST API: GET /api/quiz-results/export-csv
  app.get("/api/quiz-results/export-csv", async (req: any, res: any) => {
    try {
      const { getSessionUser } = await import("../auth");
      const user = await getSessionUser(req);
      if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });
      const { standaloneQuizAttempts, standaloneQuizzes, users } = await import("../../drizzle/schema");
      const { eq, and, gte, lte } = await import("drizzle-orm");
      const { search, quizType, dateFrom, dateTo } = req.query as Record<string, string>;
      const conditions: any[] = [];
      if (quizType) conditions.push(eq(standaloneQuizzes.type, quizType as any));
      if (dateFrom) conditions.push(gte(standaloneQuizAttempts.completedAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(standaloneQuizAttempts.completedAt, new Date(dateTo + "T23:59:59")));
      const rows = await db
        .select({
          attemptId: standaloneQuizAttempts.id,
          userName: users.displayName,
          userEmail: users.email,
          quizTitle: standaloneQuizzes.title,
          quizType: standaloneQuizzes.type,
          score: standaloneQuizAttempts.score,
          passed: standaloneQuizAttempts.passed,
          correctAnswers: standaloneQuizAttempts.correctAnswers,
          totalQuestions: standaloneQuizAttempts.totalQuestions,
          completedAt: standaloneQuizAttempts.completedAt,
        })
        .from(standaloneQuizAttempts)
        .innerJoin(standaloneQuizzes, eq(standaloneQuizAttempts.quizId, standaloneQuizzes.id))
        .innerJoin(users, eq(standaloneQuizAttempts.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(standaloneQuizAttempts.completedAt);
      const filtered = search
        ? rows.filter(r => (r.userName ?? "").toLowerCase().includes(search.toLowerCase()) || (r.userEmail ?? "").toLowerCase().includes(search.toLowerCase()))
        : rows;
      const header = "Attempt ID,User Name,User Email,Quiz Title,Type,Score (%),Passed,Correct,Total Questions,Completed At\n";
      const csvRows = filtered.map(r =>
        [r.attemptId, `"${(r.userName ?? "").replace(/"/g, '""')}"`, `"${(r.userEmail ?? "").replace(/"/g, '""')}"`,
         `"${(r.quizTitle ?? "").replace(/"/g, '""')}"`, r.quizType,
         r.score ?? "", r.passed ? "Yes" : "No", r.correctAnswers ?? "", r.totalQuestions ?? "",
         r.completedAt ? new Date(r.completedAt).toISOString() : ""].join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="quiz-results-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(header + csvRows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // Public REST API: GET /api/forms/:formId/submissions (auth via Bearer apiToken)
  app.get("/api/forms/:formId/submissions", async (req: any, res: any) => {
    try {
      const auth = req.headers.authorization ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) return res.status(401).json({ error: "Missing Bearer token" });
      const { getDb } = await import("../db");
      const { generalFormTemplates, generalFormSubmissions, generalFormItems } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = getDb();
      const formId = parseInt(req.params.formId);
      if (isNaN(formId)) return res.status(400).json({ error: "Invalid formId" });
      const [form] = await db.select({ id: generalFormTemplates.id, apiToken: generalFormTemplates.apiToken, name: generalFormTemplates.name })
        .from(generalFormTemplates).where(eq(generalFormTemplates.id, formId)).limit(1);
      if (!form) return res.status(404).json({ error: "Form not found" });
      if (!form.apiToken || form.apiToken !== token) return res.status(403).json({ error: "Invalid token" });
      const items = await db.select({ id: generalFormItems.id, label: generalFormItems.label, itemType: generalFormItems.itemType })
        .from(generalFormItems).where(eq(generalFormItems.templateId, formId));
      const fieldMap: Record<string, string> = {};
      for (const item of items) fieldMap[item.id.toString()] = item.label || item.itemType;
      const page = parseInt((req.query.page as string) ?? "1") || 1;
      const pageSize = Math.min(parseInt((req.query.pageSize as string) ?? "100") || 100, 500);
      const { desc, count } = await import("drizzle-orm");
      const [submissions, [{ total }]] = await Promise.all([
        db.select().from(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, formId))
          .orderBy(desc(generalFormSubmissions.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
        db.select({ total: count() }).from(generalFormSubmissions).where(eq(generalFormSubmissions.templateId, formId)),
      ]);
      const data = submissions.map((s: any) => {
        const raw: Record<string, any> = JSON.parse(s.responses ?? "{}");
        const labeled: Record<string, any> = {};
        for (const [k, v] of Object.entries(raw)) labeled[fieldMap[k] ?? k] = v;
        return { id: s.id, submittedAt: s.createdAt, status: s.status, score: s.score, maxScore: s.maxScore, responses: labeled };
      });
      return res.json({ form: { id: form.id, name: form.name }, total, page, pageSize, submissions: data });
    } catch (e: any) {
      console.error("[FormsAPI]", e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  // Email open/click tracking routes
  app.get("/api/email/track/open/:campaignId/:recipientKeyGif", async (req: any, res: any) => {
    const { recordEmailCampaignEvent, TRACKING_GIF } = await import("../lib/emailCampaignTracking");
    const campaignId = parseInt(req.params.campaignId, 10);
    const key = String(req.params.recipientKeyGif ?? "").replace(/\.gif$/i, "");
    const variant = typeof req.query.v === "string" ? req.query.v : undefined;

    try {
      if (!Number.isNaN(campaignId) && key) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { ensureEmailCampaignEventsTable } = await import("../lib/campaignUnsubscribe");
          await ensureEmailCampaignEventsTable(db);
          await recordEmailCampaignEvent(db, {
            campaignId,
            recipientKey: key,
            eventType: "open",
            metadata: variant ? { variant } : undefined,
          });
        }
      }
    } catch (err) {
      console.error("[EmailTrack] Failed to record open:", err);
    }

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.end(TRACKING_GIF);
  });

  app.get("/api/email/track/click/:campaignId/:recipientKey", async (req: any, res: any) => {
    const url = req.query.url as string;
    const rawDest = url && typeof url === "string" ? url.trim() : "";
    // Ensure we always redirect to an absolute URL — relative paths cause ERR_INVALID_REDIRECT
    const { getEmailCampaignAppUrl } = await import("../lib/emailCampaignTracking");
    const appUrl = getEmailCampaignAppUrl();
    let destination: string;
    if (!rawDest) {
      destination = appUrl;
    } else if (rawDest.startsWith("http://") || rawDest.startsWith("https://")) {
      destination = rawDest;
    } else if (rawDest.startsWith("/")) {
      destination = `${appUrl}${rawDest}`;
    } else {
      destination = appUrl;
    }
    // Redirect immediately — record the click event asynchronously so the user isn't delayed
    // Use an HTML meta-refresh page instead of a bare 302 — Gmail's in-app browser
    // sometimes rejects bare redirects with ERR_INVALID_REDIRECT. An HTML page with
    // meta-refresh + JS window.location works in all email clients.
    const safeDestination = destination.replace(/"/g, "&quot;");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safeDestination}">
<title>Redirecting...</title>
<script>window.location.replace(${JSON.stringify(destination)});</script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
<p>Redirecting you now...</p>
<p><a href="${safeDestination}" style="color:#189aa1;font-size:18px;">Click here if not redirected</a></p>
</body>
</html>`);
    const campaignId = parseInt(req.params.campaignId, 10);
    const key = String(req.params.recipientKey ?? "");
    const variant = typeof req.query.v === "string" ? req.query.v : undefined;
    // Record click event in background (non-blocking)
    setImmediate(async () => {
      try {
        if (!Number.isNaN(campaignId) && key) {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { ensureEmailCampaignEventsTable } = await import("../lib/campaignUnsubscribe");
            await ensureEmailCampaignEventsTable(db);
            const { recordEmailCampaignEvent } = await import("../lib/emailCampaignTracking");
            await recordEmailCampaignEvent(db, {
              campaignId,
              recipientKey: key,
              eventType: "click",
              metadata: { url: destination, ...(variant ? { variant } : {}) },
            });
          }
        }
      } catch (err) {
        console.error("[EmailTrack] Failed to record click:", err);
      }
    });
  });

  // RFC 8058 one-click unsubscribe (List-Unsubscribe-Post from Gmail/Yahoo)
  const handleCampaignUnsubscribeRequest = async (req: any, res: any) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const campaignIdRaw = typeof req.query.campaignId === "string" ? parseInt(req.query.campaignId, 10) : NaN;
    const campaignId = Number.isNaN(campaignIdRaw) ? undefined : campaignIdRaw;

    if (!token) {
      if (req.method === "POST") return res.status(400).send("Missing token");
      return res.redirect(302, "/unsubscribe?status=invalid");
    }

    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) {
        if (req.method === "POST") return res.status(503).send("Unavailable");
        return res.redirect(302, "/unsubscribe?status=error");
      }
      const { ensureEmailCampaignEventsTable, processCampaignUnsubscribe } =
        await import("../lib/campaignUnsubscribe");
      await ensureEmailCampaignEventsTable(db);
      const result = await processCampaignUnsubscribe(db, token, campaignId);
      if (!result.ok) {
        if (req.method === "POST") return res.status(404).send("Invalid token");
        return res.redirect(302, "/unsubscribe?status=invalid");
      }
      if (req.method === "POST") return res.status(200).send("OK");
      const status = result.alreadyUnsubscribed ? "already" : "success";
      return res.redirect(302, `/unsubscribe?status=${status}`);
    } catch (err) {
      console.error("[EmailUnsubscribe] Error:", err);
      if (req.method === "POST") return res.status(500).send("Error");
      return res.redirect(302, "/unsubscribe?status=error");
    }
  };

  app.post("/api/email/campaign-unsubscribe", handleCampaignUnsubscribeRequest);
  app.get("/api/email/campaign-unsubscribe", handleCampaignUnsubscribeRequest);

  // ── Public Email List Webhook (POST /api/email-lists/:token/subscribe) ───────
  app.post("/api/email-lists/:token/subscribe", async (req: any, res: any) => {
    try {
      const { token } = req.params;
      const { email, name, first_name, last_name } = req.body || {};
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Service unavailable" });
      const { emailLists } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [list] = await db.select({ id: emailLists.id, name: emailLists.name })
        .from(emailLists).where(eq((emailLists as any).webhookToken, token)).limit(1);
      if (!list) return res.status(404).json({ error: "List not found" });
      const { addToEmailList, ensureAllContactsList } = await import("../lib/emailListHelper");
      await ensureAllContactsList();
      const displayName = name || [first_name, last_name].filter(Boolean).join(" ") || undefined;
      await addToEmailList(list.id, email.trim().toLowerCase(), displayName, { source: "webhook" });
      // Also add to All Contacts
      const allList = await db.select({ id: emailLists.id }).from(emailLists).where(eq(emailLists.name, "All Contacts")).limit(1);
      if (allList.length > 0 && allList[0].id !== list.id) {
        await addToEmailList(allList[0].id, email.trim().toLowerCase(), displayName, { source: "webhook" });
      }
      res.json({ ok: true, list: list.name });
    } catch (err: any) {
      console.error("[EmailListWebhook] Error:", err?.message);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // Prevent Cloudflare (and any other CDN/proxy) from caching API responses or stripping Set-Cookie headers.
  // Without this, Cloudflare strips Set-Cookie from responses it considers cacheable, breaking auth.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ── Legacy URL 301 redirects ────────────────────────────────────────────────
  // /learn/:slug → /courses/:slug  (old LMS course URL structure)
  app.get("/learn/:slug", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/courses/${req.params.slug}${qs}`);
  });
  // /f/:slug/:pageSlug → /:slug/:pageSlug  (old funnel URL structure with /f/ prefix)
  app.get("/f/:slug/:pageSlug", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/${req.params.slug}/${req.params.pageSlug}${qs}`);
  });
  // /f/:slug → /:slug  (old funnel root without page slug)
  app.get("/f/:slug", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/${req.params.slug}${qs}`);
  });
  // /products/:slug → /product/:slug  (old product URL structure)
  app.get("/products/:slug", (req, res) => {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `/product/${req.params.slug}${qs}`);
  });
  // /dashboard → /my-dashboard  (legacy student dashboard URL)
  app.get(/^\/dashboard(?:\/.*)?$/, (req, res) => {
    const pathname = req.path.replace(/\/+$/, "") || "/";
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const target = normalizeLegacyStudentDashboardLocation(pathname, qs) ?? "/my-dashboard";
    res.redirect(301, target);
  });

  // Media repository public serve/embed routes (cookieless, token-based access)
  // Handles both /api/media/:slug and /media/:slug (original stored URLs — served directly, no redirect)
  // MUST be registered BEFORE serveStatic so they take priority over the SPA catch-all
  registerMediaServeRoutes(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production (Railway), bind directly to PORT without scanning
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Initialize SonoQuiz WebSocket hub BEFORE server.listen so it binds to the same HTTP server
  initSonoQuizHub(server);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the Daily Challenge lifecycle cron (archive expired, publish next)
    startChallengeCron();
    // Start the email campaign scheduler (sends scheduled campaigns every 5 minutes)
    startEmailCampaignScheduler();
    // Start the Media Repository purge cron (hard-deletes assets soft-deleted > 30 days ago)
    startMediaPurgeCron();
    // Start the Railway/R2 mirror sync (syncs DB and media every 6 hours)
    startMirrorSync();
    // Start the Account Sharing Monitor (detects multi-IP abuse every 30 min)
    startSharingMonitor();
    // Backfill all existing users into the "All Contacts" email list (safe to run on every startup)
    backfillAllContacts().catch((err) => console.error("[backfillAllContacts] Error:", err));
    // Backfill user openId + base roles so migrated users can sign in with correct access
    getDb()
      .then(async (db) => {
        if (!db) return;
        const { ensureUserAccessAccounting } = await import("../lib/ensureUserAccessAccounting");
        const { ensureEmailAliasIntegrity } = await import("../lib/ensureEmailAliasIntegrity");
        await ensureUserAccessAccounting(db);
        return ensureEmailAliasIntegrity(db);
      })
      .catch((err) => console.error("[ensureUserAccessAccounting] Error:", err));
    // Auto-create manualInvoices table if it doesn't exist (production DB migration)
    getDb().then(async (db) => {
      if (!db) return;
      try {
        const createSql = [
          'CREATE TABLE IF NOT EXISTS manualInvoices (',
          '  id INT PRIMARY KEY AUTO_INCREMENT,',
          '  userId INT NOT NULL,',
          '  invoiceNumber VARCHAR(64),',
          '  description TEXT NOT NULL,',
          '  lineItems JSON,',
          '  amountPaid INT NOT NULL,',
          "  currency VARCHAR(8) NOT NULL DEFAULT 'usd',",
          '  paidAt TIMESTAMP NOT NULL,',
          '  paymentSource VARCHAR(64),',
          '  notes TEXT,',
          '  createdBy INT,',
          '  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
          '  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
          '  INDEX idx_manualInvoices_userId (userId)',
          ')'
        ].join('\n');
        await db.execute(drizzleSql.raw(createSql));
        console.log('[Startup] manualInvoices table ensured');
      } catch (err: any) {
        console.error('[Startup] manualInvoices migration error:', err?.message ?? err);
      }
    }).catch((err) => console.error('[Startup] manualInvoices getDb error:', err));
    // Auto-create deferred_checkout_sessions table (payment_status gating for delayed payment methods)
    getDb().then(async (db) => {
      if (!db) return;
      try {
        await db.execute(drizzleSql.raw([
          'CREATE TABLE IF NOT EXISTS deferred_checkout_sessions (',
          '  id INT PRIMARY KEY AUTO_INCREMENT,',
          '  stripe_session_id VARCHAR(128) NOT NULL UNIQUE,',
          '  stripe_payment_intent_id VARCHAR(128),',
          '  payment_status VARCHAR(32) NOT NULL,',
          '  raw_session_json TEXT NOT NULL,',
          "  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',",
          '  error_message TEXT,',
          '  completed_at TIMESTAMP NULL,',
          '  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
          '  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,',
          '  INDEX idx_deferred_checkout_pi (stripe_payment_intent_id),',
          '  INDEX idx_deferred_checkout_status (status)',
          ')'
        ].join('\n')));
        // Ensure optional columns exist (idempotent — ADD COLUMN IF NOT EXISTS is safe to re-run)
        await db.execute(drizzleSql.raw(
          'ALTER TABLE deferred_checkout_sessions ADD COLUMN IF NOT EXISTS user_id INT AFTER stripe_payment_intent_id'
        ));
        await db.execute(drizzleSql.raw(
          'ALTER TABLE deferred_checkout_sessions ADD COLUMN IF NOT EXISTS product_name VARCHAR(512) AFTER user_id'
        ));
        try {
          await db.execute(drizzleSql.raw(
            'ALTER TABLE deferred_checkout_sessions ADD INDEX idx_deferred_checkout_user (user_id)'
          ));
        } catch { /* index may already exist */ }
        // Ensure stripeEventId column exists on webhookEvents for idempotency deduplication
        await db.execute(drizzleSql.raw(
          'ALTER TABLE webhookEvents ADD COLUMN IF NOT EXISTS stripeEventId VARCHAR(128) AFTER source'
        ));
        console.log('[Startup] deferred_checkout_sessions and webhookEvents.stripeEventId ensured');

      } catch (err: any) {
        console.error('[Startup] deferred_checkout_sessions migration error:', err?.message ?? err);
      }
    }).catch((err) => console.error('[Startup] deferred_checkout_sessions getDb error:', err));
    // Ensure lms_courses has all columns expected by the current app (Railway mirror gap)
    getDb()
      .then(async (db) => {
        const { ensureLmsCoursesSchema } = await import("../lib/ensureLmsCoursesSchema");
        return ensureLmsCoursesSchema(db);
      })
      .catch((err) => console.error("[Startup] ensureLmsCoursesSchema error:", err));
    // Ensure lms_cohort_groups has all columns expected by admin cohort queries
    getDb()
      .then(async (db) => {
        const { ensureLmsCohortGroupsSchema } = await import("../lib/ensureLmsCohortGroupsSchema");
        return ensureLmsCohortGroupsSchema(db);
      })
      .catch((err) => console.error("[Startup] ensureLmsCohortGroupsSchema error:", err));
    getDb()
      .then(async (db) => {
        const { ensureAuthEmailSendLogSchema } = await import("../lib/ensureAuthEmailSendLogSchema");
        return ensureAuthEmailSendLogSchema(db);
      })
      .catch((err) => console.error("[Startup] ensureAuthEmailSendLogSchema error:", err));
    getDb()
      .then(async (db) => {
        const { ensureQuestionBankFoldersSchema } = await import("../lib/ensureQuestionBankFoldersSchema");
        return ensureQuestionBankFoldersSchema(db);
      })
      .catch((err) => console.error("[Startup] ensureQuestionBankFoldersSchema error:", err));
    getDb()
      .then(async (db) => {
        const { ensureQuestionBankSchema } = await import("../lib/ensureQuestionBankSchema");
        return ensureQuestionBankSchema(db);
      })
      .catch((err) => console.error("[Startup] ensureQuestionBankSchema error:", err));
    // Requeue interrupted SCORM work; pending packages remain available to the Always On worker.
    healStuckScormVersions().then(({ healed }) => {
      console.log("[Startup] Durable SCORM queue enabled — pending packages will not be skipped");
      if (healed > 0) console.log(`[Startup] Requeued ${healed} interrupted SCORM version(s)`);
    }).catch((err) => console.error("[Startup] SCORM heal error:", err));
  });
}

startServer().catch(console.error);
