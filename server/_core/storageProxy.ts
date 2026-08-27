import type { Express } from "express";
import { ENV } from "./env";
import { resolveStorageBackend } from "../lib/storageBackend";
import { legacyCloudFrontUrlForStorageKey } from "../../shared/resolveAssetUrl";

function buildR2PublicUrl(key: string): string | null {
  const base = process.env.CF_R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/${key.replace(/^\/+/, "")}`;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Railway / R2-primary: redirect to public R2 URL
    try {
      if (resolveStorageBackend() === "r2") {
        const r2Url = buildR2PublicUrl(key);
        if (r2Url) {
          let useR2 = false;
          try {
            const head = await fetch(r2Url, { method: "HEAD" });
            useR2 = head.ok;
          } catch {
            useR2 = false;
          }
          const target = useR2 ? r2Url : legacyCloudFrontUrlForStorageKey(key);
          res.set("Cache-Control", "public, max-age=3600");
          res.redirect(307, target);
          return;
        }
      }
    } catch {
      // Fall through to Forge proxy
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
