import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type PluginOption, type ViteDevServer, type Plugin } from "vite";

// Manus-specific plugins (optional, only available in Manus sandbox)
let jsxLocPlugin: any;
let vitePluginManusRuntime: any;
try { jsxLocPlugin = require("@builder.io/vite-plugin-jsx-loc").jsxLocPlugin; } catch {}
try { vitePluginManusRuntime = require("vite-plugin-manus-runtime").vitePluginManusRuntime; } catch {}

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// =============================================================================
// Analytics HTML plugin — replaces %VITE_ANALYTICS_*% in index.html at build
// time. If env vars are not set, removes the umami <script> entirely so the
// browser never tries to load a bogus URL like /AVITE_ANALYTICS_ENDPOINT/umami
// which throws "Unexpected token '<'" and can white-screen the app.
// =============================================================================
function vitePluginAnalyticsHtml(): Plugin {
  return {
    name: "manus-analytics-html",
    // enforce: 'pre' ensures this runs before Vite's own HTML transform
    enforce: "pre" as const,
    transformIndexHtml(html: string) {
      const endpoint = process.env.VITE_ANALYTICS_ENDPOINT;
      const websiteId = process.env.VITE_ANALYTICS_WEBSITE_ID;
      if (endpoint && websiteId) {
        // Both vars present — substitute them in
        return html
          .replace(/%VITE_ANALYTICS_ENDPOINT%/g, endpoint)
          .replace(/%VITE_ANALYTICS_WEBSITE_ID%/g, websiteId);
      }
      // Vars missing — strip the entire umami <script> block so no broken
      // placeholder URL reaches the browser
      return html.replace(
        /<script[\s\S]*?%VITE_ANALYTICS_ENDPOINT%[\s\S]*?<\/script>/g,
        ""
      );
    },
  };
}

const plugins: PluginOption[] = [react(), tailwindcss(), vitePluginAnalyticsHtml()];
if (jsxLocPlugin) plugins.push(jsxLocPlugin());
if (vitePluginManusRuntime) plugins.push(vitePluginManusRuntime());
if (process.env.NODE_ENV !== "production") plugins.push(vitePluginManusDebugCollector());

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: true,
    hmr: {
      // When running behind the Manus sandbox proxy the browser connects via
      // HTTPS/WSS on port 443. Tell Vite's HMR client to use the same host
      // and the standard TLS port so the WebSocket handshake succeeds.
      // Do NOT set host here — the client must use window.location.hostname.
      clientPort: 443,
      protocol: "wss",
      // Suppress the WebSocket connection error overlay in the browser console
      // when the dev server is accessed through the Manus sandbox proxy.
      overlay: false,
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
