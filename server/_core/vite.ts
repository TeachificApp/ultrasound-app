import express, { type Express, type Request } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { getPageSeoForRequest, injectPageSeoIntoHtml } from "../routes/funnelOgMeta";
import {
  getMetadataRequestHostname,
  getSiteMetadataForHostname,
  injectSiteMetadataIntoHtml,
} from "../lib/siteMetadata";

/** Helper: look up per-page SEO and inject it into the HTML if found. */
async function injectPageSeo(html: string, req: Request): Promise<string> {
  try {
    const seo = await getPageSeoForRequest(req);
    if (!seo) return html;
    return injectPageSeoIntoHtml(html, seo, req);
  } catch (e: any) {
    console.error(`[injectPageSeo] error: ${e.message}`);
    return html;
  }
}

/**
 * Regex that matches all paths EXCEPT those starting with /media/ or /api/.
 * This ensures the SPA catch-all can NEVER intercept server-side routes.
 */
const SPA_CATCH_ALL_REGEX = /^\/(?!media\/|api\/|manus-storage\/).*/;

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
      // Inject host-specific metadata server-side. Railway's reverse proxy can
      // replace Host with an internal service hostname, so preserve the public
      // hostname supplied by a trusted edge proxy when present.
      const host = getMetadataRequestHostname(req);
      template = injectSiteMetadataIntoHtml(template, host, req.path);
      // Inject per-page SEO (course/workshop/download landing pages)
      template = await injectPageSeo(template, req);
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

  const swNoCacheHeaders = (res: import("express").Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  };

  // Serve SW files explicitly (not via express.static) so CDN/browser never
  // reuse a stale cached copy — stale sw.js caused site-wide white screens.
  app.get("/sw.js", (_req, res) => {
    swNoCacheHeaders(res);
    res.type("application/javascript");
    res.sendFile(path.resolve(distPath, "sw.js"));
  });
  app.get("/sw-clear.html", (_req, res) => {
    swNoCacheHeaders(res);
    res.sendFile(path.resolve(distPath, "sw-clear.html"));
  });

  // Fingerprinted Vite assets — long-lived immutable cache (filename changes each deploy).
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      index: false,
      etag: true,
      maxAge: "365d",
      immutable: true,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  app.use(express.static(distPath, { index: false }));

  // Use regex route so /media/* paths are structurally excluded — they can NEVER
  // be caught by this fallback, regardless of route registration order.
  // Read and inject brand-specific OG tags + per-page SEO server-side (crawlers don't run JS).
  const indexHtmlPath = path.resolve(distPath, "index.html");
  app.get(SPA_CATCH_ALL_REGEX, async (req, res) => {
    const host = getMetadataRequestHostname(req);
    const hasBrand = Boolean(getSiteMetadataForHostname(host));
    // Check if this path needs per-page SEO injection
    const pageSeo = await getPageSeoForRequest(req);
    if (!hasBrand && !pageSeo) {
      // No overrides needed — serve file directly for performance
      return res.sendFile(indexHtmlPath);
    }
    fs.readFile(indexHtmlPath, "utf-8", async (err, html) => {
      if (err) return res.sendFile(indexHtmlPath);
      if (hasBrand) html = injectSiteMetadataIntoHtml(html, host, req.path);
      if (pageSeo) html = injectPageSeoIntoHtml(html, pageSeo, req);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    });
  });
}
