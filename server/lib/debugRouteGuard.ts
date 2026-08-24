import type { Request, Response } from "express";

/** Returns true when debug tooling is allowed for this request. */
export function isDebugRouteAuthorized(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.DEBUG_ADMIN_SECRET?.trim();
  if (!secret) return false;

  const headerSecret = req.headers["x-debug-secret"];
  const querySecret = req.query.secret;
  const provided = typeof headerSecret === "string"
    ? headerSecret
    : typeof querySecret === "string"
      ? querySecret
      : "";

  return provided.length > 0 && provided === secret;
}

/** Respond 404 and return true when the caller must be blocked. */
export function denyUnlessDebugAuthorized(req: Request, res: Response): boolean {
  if (isDebugRouteAuthorized(req)) return false;
  res.status(404).json({ error: "Not found" });
  return true;
}
