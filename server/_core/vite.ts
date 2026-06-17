import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/**
 * Regex that matches all paths EXCEPT those starting with /media/ or /api/.
 * This ensures the SPA catch-all can NEVER intercept server-side routes.
 */
const SPA_CATCH_ALL_REGEX = /^\/(?!media\/|api\/|manus-storage\/).*/;

/**
 * Brand meta config keyed by hostname substring.
 * Social crawlers don't execute JS, so OG tags must be injected server-side.
 */
const BRAND_META: Record<string, { title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; ogUrl: string; themeColor: string; appTitle: string }> = {
  iheartecho: {
    title: "iHeartEcho — Echocardiography Clinical Intelligence",
    description: "iHeartEcho — Echocardiography clinical intelligence for cardiac ultrasound students, sonographers, echocardiographers, and cardiologists.",
    ogTitle: "iHeartEcho — Echocardiography Clinical Intelligence",
    ogDescription: "Real-time echo interpretation and measurement assistant for cardiac ultrasound professionals.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/icon-512_79ee0572.png",
    ogUrl: "https://app.iheartecho.com",
    themeColor: "#0e1e2e",
    appTitle: "iHeartEcho",
  },
  "learn.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://learn.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
  "app.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://app.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
  "members.allaboutultrasound": {
    title: "All About Ultrasound | iHeartEcho",
    description: "All About Ultrasound | iHeartEcho — General, Vascular & Cardiac Ultrasound Clinical Intelligence.",
    ogTitle: "All About Ultrasound | iHeartEcho",
    ogDescription: "General, Vascular & Cardiac Ultrasound Clinical Intelligence learning platform.",
    ogImage: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_e47ffb71.png",
    ogUrl: "https://members.allaboutultrasound.com",
    themeColor: "#189aa1",
    appTitle: "AAUS | iHeartEcho",
  },
};

/**
 * Inject brand-specific OG/meta tags into HTML based on the Host header.
 * This runs server-side so social crawlers (which don't execute JS) see the correct tags.
 */
function injectBrandMeta(html: string, host: string): string {
  const brandKey = Object.keys(BRAND_META).find(k => host.includes(k));
  if (!brandKey) return html;
  const m = BRAND_META[brandKey];
  let result = html
    .replace(/<title>[^<]*<\/title>/, `<title>${m.title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${m.description}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${m.ogTitle}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${m.ogDescription}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${m.ogImage}$2`)
    .replace(/(<meta\s+name="theme-color"\s+content=")[^"]*(")/, `$1${m.themeColor}$2`)
    .replace(/(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/, `$1${m.appTitle}$2`);
  // Inject or replace og:url — insert after og:type if present, otherwise before </head>
  const ogUrlTag = `<meta property="og:url" content="${m.ogUrl}" />`;
  if (result.includes('property="og:url"')) {
    result = result.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${m.ogUrl}$2`);
  } else if (result.includes('property="og:type"')) {
    result = result.replace(/(<meta\s+property="og:type"[^>]*>)/, `$1\n    ${ogUrlTag}`);
  } else {
    result = result.replace(/<\/head>/, `    ${ogUrlTag}\n  </head>`);
  }
  return result;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Use regex route so /media/* paths are structurally excluded
  app.get(SPA_CATCH_ALL_REGEX, async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // Inject brand-specific OG tags server-side (crawlers don't run JS)
      const host = req.hostname || req.headers.host || "";
      template = injectBrandMeta(template, host);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../../../", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Use regex route so /media/* paths are structurally excluded — they can NEVER
  // be caught by this fallback, regardless of route registration order.
  // Read and inject brand-specific OG tags server-side (crawlers don't run JS).
  const indexHtmlPath = path.resolve(distPath, "index.html");
  app.get(SPA_CATCH_ALL_REGEX, (req, res) => {
    const host = req.hostname || req.headers.host || "";
    if (!host || !Object.keys(BRAND_META).some(k => host.includes(k))) {
      // No brand override needed — serve file directly for performance
      return res.sendFile(indexHtmlPath);
    }
    fs.readFile(indexHtmlPath, "utf-8", (err, html) => {
      if (err) return res.sendFile(indexHtmlPath);
      const branded = injectBrandMeta(html, host);
      res.status(200).set({ "Content-Type": "text/html" }).end(branded);
    });
  });
}
