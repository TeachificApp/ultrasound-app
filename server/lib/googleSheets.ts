/**
 * Google Sheets API helpers for per-form submission sync.
 */
import { getDb } from "../db";
import { googleFormIntegrations, generalFormItems } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
  });
  if (!res.ok) throw new Error("Token refresh failed: " + await res.text());
  return res.json() as any;
}

async function getValidToken(integration: any): Promise<string> {
  const now = Date.now();
  if (integration.accessToken && integration.tokenExpiresAt && integration.tokenExpiresAt - 300000 > now) {
    return integration.accessToken;
  }
  if (!integration.refreshToken) throw new Error("No refresh token — user must reconnect Google");
  const tokens = await refreshAccessToken(integration.googleClientId, integration.googleClientSecret, integration.refreshToken);
  const db = await getDb();
  if (db) {
    await db.update(googleFormIntegrations).set({ accessToken: tokens.access_token, tokenExpiresAt: now + tokens.expires_in * 1000, updatedAt: new Date() }).where(eq(googleFormIntegrations.formId, integration.formId));
  }
  return tokens.access_token;
}

async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const res = await fetch(SHEETS_BASE, {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!res.ok) throw new Error("Create spreadsheet failed: " + await res.text());
  const data: any = await res.json();
  return data.spreadsheetId;
}

async function appendRow(accessToken: string, spreadsheetId: string, sheetTab: string, values: string[]): Promise<void> {
  const range = encodeURIComponent(sheetTab + "!A1");
  const res = await fetch(SHEETS_BASE + "/" + spreadsheetId + "/values/" + range + ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error("Append row failed: " + await res.text());
}

async function writeHeaders(accessToken: string, spreadsheetId: string, sheetTab: string, headers: string[]): Promise<void> {
  const range = encodeURIComponent(sheetTab + "!A1");
  const res = await fetch(SHEETS_BASE + "/" + spreadsheetId + "/values/" + range + "?valueInputOption=USER_ENTERED", {
    method: "PUT",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [headers] }),
  });
  if (!res.ok) throw new Error("Write headers failed: " + await res.text());
}

export async function syncSubmissionToSheets(formId: number, responses: Record<string, any>, submittedAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [integration] = await db.select().from(googleFormIntegrations).where(eq(googleFormIntegrations.formId, formId));
  if (!integration || !integration.isEnabled || !integration.googleClientId) return;

  const items = await db.select().from(generalFormItems).where(eq(generalFormItems.templateId, formId)).orderBy(asc(generalFormItems.sortOrder));
  const accessToken = await getValidToken(integration);
  const sheetTab = integration.sheetTabName ?? "Form Responses";
  let spreadsheetId = integration.spreadsheetId;
  let needsHeaders = !integration.headersInitialised;

  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet(accessToken, integration.spreadsheetName ?? ("Form Responses - Form " + formId));
    await db.update(googleFormIntegrations).set({ spreadsheetId, headersInitialised: false, updatedAt: new Date() }).where(eq(googleFormIntegrations.formId, formId));
    needsHeaders = true;
  }

  if (needsHeaders) {
    const headers = ["Submitted At", "Submitter Email", ...items.map((i: any) => i.label ?? ("Field " + i.id))];
    await writeHeaders(accessToken, spreadsheetId, sheetTab, headers);
    await db.update(googleFormIntegrations).set({ headersInitialised: true, updatedAt: new Date() }).where(eq(googleFormIntegrations.formId, formId));
  }

  const submitterEmail = responses["__email"] ?? "";
  const row: string[] = [
    submittedAt.toISOString(),
    submitterEmail,
    ...items.map((item: any) => {
      const val = responses[String(item.id)];
      if (val === undefined || val === null) return "";
      if (Array.isArray(val)) return val.join(", ");
      return String(val);
    }),
  ];
  await appendRow(accessToken, spreadsheetId, sheetTab, row);
}
