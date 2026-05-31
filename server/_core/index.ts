import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerChatRoutes } from "./chat";
import { registerThinkificWebhook } from "../webhooks/thinkific";
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
import { registerUploadCohortMediaRoute } from "../routes/uploadCohortMedia";
import { registerUploadSocialImageRoute } from "../routes/uploadSocialImage";
import { registerSsoAutoRoute } from "../routes/ssoAuto";
import { registerFunnelOgMetaRoutes } from "../routes/funnelOgMeta";
import { registerAutoLoginRoute } from "../routes/autoLogin";
import { registerGoogleOAuthRoutes } from "../routes/googleOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { detectBrandFromHostname, detectBrandMode } from "../../shared/brands";
import { startChallengeCron } from "../jobs/challengeCron";
import { startMediaPurgeCron } from "../jobs/mediaPurgeCron";
import { startEmailCampaignScheduler } from "../routers/emailCampaignRouter";
import { startThinkificMemberSync } from "../jobs/thinkificMemberSync";
import { initSonoQuizHub } from "../sonoQuizHub";
import { startMirrorSync } from "../jobs/mirrorSync";
import { startSharingMonitor } from "../jobs/sharingMonitor";

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
      description: "General & Vascular Ultrasound Clinical Intelligence \u2014 real-time ultrasound interpretation and measurement assistant for sonographers, radiologists, OB/Gyn, vascular surgeons, and ultrasound educators from All About Ultrasound\u2122.",
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
      description: "General, Vascular & Cardiac Ultrasound Clinical Intelligence \u2014 learning platform for sonographers, physicians, and ultrasound educators.",
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
    res.json(manifest);
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
    res.json({ resolved, xAppHostname, xForwardedHost, origin, referer, host, reqHostname, brand, brandMode });
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
  // Storage proxy for /manus-storage/* assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // Thinkific webhook for live course sync
  registerThinkificWebhook(app);
  // Stripe webhook for Concierge purchase activation
  registerStripeWebhook(app);
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
  // Cohort group discussion media upload (images + videos, admin only)
  registerUploadCohortMediaRoute(app);
  // Social content image upload (multipart, admin only)
  registerUploadSocialImageRoute(app);
  // Cross-domain silent SSO endpoint — must be before tRPC so it's not caught by the SPA catch-all
  registerSsoAutoRoute(app);
  // Funnel page OG meta injection — must be before SPA catch-all so crawlers get correct meta tags
  registerFunnelOgMetaRoutes(app);
  // Auto-login route — one-time token redemption for post-purchase automatic sign-in
  registerAutoLoginRoute(app);
  // Google OAuth2 routes for per-form Google Sheets integration
  registerGoogleOAuthRoutes(app);
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
    // Start the Thinkific member sync job (imports new members every 6 hours, no emails sent)
    startThinkificMemberSync();
    // Start the Media Repository purge cron (hard-deletes assets soft-deleted > 30 days ago)
    startMediaPurgeCron();
    // Start the Railway/R2 mirror sync (syncs DB and media every 6 hours)
    startMirrorSync();
    // Start the Account Sharing Monitor (detects multi-IP abuse every 30 min)
    startSharingMonitor();
  });
}

startServer().catch(console.error);
