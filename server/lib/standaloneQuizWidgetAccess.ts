import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_WIDGET_LAUNCH_EXPIRY_DAYS = 30;
export const MAX_WIDGET_LAUNCH_EXPIRY_DAYS = 90;

/** Produces an unguessable, URL-safe credential. Only its digest may be stored. */
export function createStandaloneQuizWidgetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Computes the database-safe digest for a raw widget credential. */
export function hashStandaloneQuizWidgetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Validates an administrator-provided application origin before a server-side
 * widget URL is returned. The origin is presentation-only; access is granted
 * solely by a valid database-backed opaque credential.
 */
export function normalizeWidgetOrigin(origin: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("A valid HTTP or HTTPS application origin is required.");
  }
  return parsed.origin;
}

export function buildStandaloneQuizWidgetEmbed(input: {
  origin: string;
  quizId: number;
  quizTitle: string;
  token: string;
}): { widgetUrl: string; embedCode: string } {
  const widgetUrl = `${input.origin}/quizzes/${input.quizId}?embed=1&widget=${encodeURIComponent(input.token)}`;
  const safeTitle = input.quizTitle.replace(/"/g, "&quot;");
  return {
    widgetUrl,
    embedCode: `<iframe src="${widgetUrl}" width="100%" height="720" frameborder="0" style="border:0;border-radius:12px" title="${safeTitle}"></iframe>`,
  };
}
