import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
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
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startChallengeCron } from "../jobs/challengeCron";
import { startMediaPurgeCron } from "../jobs/mediaPurgeCron";
import { startEmailCampaignScheduler } from "../routers/emailCampaignRouter";
import { startThinkificMemberSync } from "../jobs/thinkificMemberSync";
import { initSonoQuizHub } from "../sonoQuizHub";

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
  // Media repository public serve/embed routes (cookieless, token-based access)
  registerMediaServeRoutes(app);
  // Media repository multipart upload endpoint (admin only)
  registerUploadMediaRepoRoute(app);
  // Course/landing-page image upload (multipart, bypasses JSON body limit)
  registerUploadCourseImageRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

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
  });
}

startServer().catch(console.error);
