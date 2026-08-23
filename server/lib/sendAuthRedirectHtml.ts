import type { Response } from "express";

/**
 * Return a 200 HTML page that redirects via meta refresh + JS.
 * Cloudflare can strip Set-Cookie on 302 responses; this pattern preserves cookies.
 */
export function sendAuthRedirectHtml(
  res: Response,
  redirectUrl: string,
  title = "Signing you in…",
): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const safeRedirect = redirectUrl.replace(
    /[<>"'&]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" })[c] ?? c,
  );

  res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta http-equiv="refresh" content="0;url=${safeRedirect}">
  <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0e1e2e;font-family:sans-serif;color:#fff}</style>
</head>
<body>
  <div style="text-align:center">
    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#189aa1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px"></div>
    <p style="color:#4ad9e0;font-size:14px">${title}</p>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});<\/script>
</body>
</html>`);
}

/** Append auth_pending=1 so the SPA retries auth.me before redirecting to login. */
export function withAuthPending(redirectPath: string): string {
  return (
    redirectPath +
    (redirectPath.includes("?") ? "&" : "?") +
    "auth_pending=1"
  );
}
