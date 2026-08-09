/**
 * googleDriveCme.ts
 * Google Drive integration for saving CME Activity Planning PDFs to a shared folder.
 * Uses the platform_settings table for OAuth credentials and folder configuration.
 */
import { getDb } from "../db";
import { platformSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error("Token refresh failed: " + await res.text());
  return res.json() as any;
}

async function getValidToken(settings: any): Promise<string> {
  const now = Date.now();
  if (
    settings.cmeDriveAccessToken &&
    settings.cmeDriveTokenExpiresAt &&
    settings.cmeDriveTokenExpiresAt - 300_000 > now
  ) {
    return settings.cmeDriveAccessToken;
  }
  if (!settings.cmeDriveRefreshToken) {
    throw new Error("No refresh token — admin must reconnect Google Drive in Platform Settings");
  }
  const tokens = await refreshAccessToken(
    settings.cmeDriveClientId!,
    settings.cmeDriveClientSecret!,
    settings.cmeDriveRefreshToken
  );
  const db = await getDb();
  if (db) {
    await db.update(platformSettings).set({
      cmeDriveAccessToken: tokens.access_token,
      cmeDriveTokenExpiresAt: now + tokens.expires_in * 1000,
    }).where(eq(platformSettings.id, 1));
  }
  return tokens.access_token;
}

/**
 * Upload a PDF buffer to the configured Google Drive CME folder.
 * Returns the Drive file ID and web view link.
 */
export async function uploadCmePdfToDrive(
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ fileId: string; webViewLink: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
  if (!settings?.cmeDriveEnabled || !settings.cmeDriveClientId || !settings.cmeDriveRefreshToken) {
    return null; // Drive not configured or disabled
  }

  const accessToken = await getValidToken(settings);
  const folderId = settings.cmeDriveFolderId ?? undefined;

  // Multipart upload: metadata + PDF bytes
  const metadata = {
    name: fileName,
    mimeType: "application/pdf",
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = "cme_pdf_boundary_" + Date.now();
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n`;
  const filePart =
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(metaPart, "utf8"),
    Buffer.from(filePart, "utf8"),
    pdfBuffer,
    Buffer.from(closing, "utf8"),
  ]);

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload failed: ${err}`);
  }

  const data: any = await uploadRes.json();
  return { fileId: data.id, webViewLink: data.webViewLink ?? "" };
}

/**
 * List files in the configured CME Drive folder (for admin preview).
 */
export async function listCmeDriveFiles(): Promise<Array<{ id: string; name: string; webViewLink: string; createdTime: string }>> {
  const db = await getDb();
  if (!db) return [];

  const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 1));
  if (!settings?.cmeDriveEnabled || !settings.cmeDriveClientId || !settings.cmeDriveRefreshToken) {
    return [];
  }

  const accessToken = await getValidToken(settings);
  const folderId = settings.cmeDriveFolderId;
  const q = folderId
    ? `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
    : `mimeType='application/pdf' and trashed=false`;

  const res = await fetch(
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data: any = await res.json();
  return data.files ?? [];
}
