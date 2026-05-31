/**
 * Google OAuth2 routes for per-form Google Sheets integration.
 */
import type { Express } from "express";
import { getDb } from "../db";
import { googleFormIntegrations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "email",
      "profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as any;
}

async function getUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "";
    const data: any = await res.json();
    return data.email ?? "";
  } catch {
    return "";
  }
}

export function registerGoogleOAuthRoutes(app: Express) {
  // Step 1: Initiate OAuth consent
  app.get("/api/google/auth", async (req, res) => {
    const formId = parseInt(req.query.formId as string);
    const origin = (req.query.origin as string) || `${req.protocol}://${req.headers.host}`;
    if (!formId) return res.status(400).json({ error: "formId required" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const [integration] = await db
      .select()
      .from(googleFormIntegrations)
      .where(eq(googleFormIntegrations.formId, formId));

    if (!integration?.googleClientId) {
      return res.status(400).json({ error: "Google Client ID not configured for this form" });
    }

    const redirectUri = `${origin}/api/google/callback`;
    const state = Buffer.from(JSON.stringify({ formId, origin })).toString("base64url");
    const authUrl = buildAuthUrl(integration.googleClientId, redirectUri, state);
    return res.redirect(authUrl);
  });

  // Step 2: Handle OAuth callback
  app.get("/api/google/callback", async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      return res.redirect(`/admin/general-forms?google=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect("/admin/general-forms?google=error&reason=missing_params");
    }

    let formId: number;
    let origin: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      formId = decoded.formId;
      origin = decoded.origin || `${req.protocol}://${req.headers.host}`;
    } catch {
      return res.redirect("/admin/general-forms?google=error&reason=invalid_state");
    }

    const db = await getDb();
    if (!db) return res.redirect(`/admin/general-forms/${formId}?tab=integrations&google=error`);

    const [integration] = await db
      .select()
      .from(googleFormIntegrations)
      .where(eq(googleFormIntegrations.formId, formId));

    if (!integration?.googleClientId || !integration?.googleClientSecret) {
      return res.redirect(`/admin/general-forms/${formId}?tab=integrations&google=error&reason=no_credentials`);
    }

    const redirectUri = `${origin}/api/google/callback`;
    try {
      const tokens = await exchangeCode(
        integration.googleClientId,
        integration.googleClientSecret,
        code,
        redirectUri
      );
      const email = await getUserEmail(tokens.access_token);
      const expiresAt = Date.now() + tokens.expires_in * 1000;

      await db
        .update(googleFormIntegrations)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? integration.refreshToken ?? null,
          tokenExpiresAt: expiresAt,
          connectedEmail: email,
          isEnabled: true,
          updatedAt: new Date(),
        })
        .where(eq(googleFormIntegrations.formId, formId));

      return res.redirect(`/admin/general-forms/${formId}?tab=integrations&google=connected`);
    } catch (err: any) {
      console.error("[Google OAuth] Token exchange error:", err.message);
      return res.redirect(`/admin/general-forms/${formId}?tab=integrations&google=error&reason=token_exchange`);
    }
  });
}
