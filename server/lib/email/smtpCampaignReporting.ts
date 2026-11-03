import { createHash } from "node:crypto";
import type { SmtpCampaignReport, SmtpReportCounts } from "../../../shared/smtpCampaignReport";

const API_ROOT = "https://api.smtp.com/v4";
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
const REQUEST_BUDGET_MS = 25000;
const METRICS = ["accepted", "delivered", "failed", "queued", "opened", "clicked", "unsubscribed", "complained"] as const;
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject | null => value != null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
export const unavailableSmtpCounts = (): SmtpReportCounts => Object.fromEntries(METRICS.map(key => [key, null])) as SmtpReportCounts;

/** The documented grouped response is keyed by channel. Never substitute account totals. */
export function parseSmtpChannelStats(payload: unknown, channel: string): SmtpReportCounts | null {
  const root = object(payload);
  if (!root || (root.status != null && root.status !== "success")) return null;
  const data = object(root.data) ?? root;
  const items = object(data.items);
  let row = object(data[channel]) ?? object(items?.[channel]);
  if (!row && Array.isArray(data.items)) {
    const matches = data.items.filter(value => object(value)?.channel === channel);
    if (matches.length === 1) row = object(matches[0]);
  }
  if (!row) return null;
  const result = Object.fromEntries(METRICS.map(key => [key, count(row![key])])) as SmtpReportCounts;
  return METRICS.some(key => result[key] != null) ? result : null;
}

export type SmtpMessage = {
  msg_id?: unknown;
  channel?: unknown;
  smtp_vars?: unknown;
  msg_data?: { rcpt_to?: unknown };
  details?: { delivery?: { event?: unknown } };
  opens?: { items?: unknown };
  clicks?: { items?: unknown };
  unsubs?: { items?: unknown };
  abuse?: { complaints?: unknown };
};

export function parseSmtpMessages(payload: unknown): SmtpMessage[] {
  const root = object(payload);
  const data = object(root?.data);
  if (!root || root.status !== "success" || !Array.isArray(data?.items)) {
    throw new Error("SMTP.com message response could not be verified.");
  }
  return data.items.filter(value => object(value) !== null) as SmtpMessage[];
}

/** Match ONLY provider IDs saved at acceptance or echoed campaign metadata. Never use subject/time as attribution. */
export function summarizeSmtpCampaignMessages(messages: SmtpMessage[], channel: string, campaignId: number, knownMessageIds: string[] = [], partial = false): SmtpCampaignReport["campaign"] {
  const known = new Set(knownMessageIds);
  const unique = new Map<string, SmtpMessage>();
  for (const message of messages) {
    if (message.channel !== channel || typeof message.msg_id !== "string" || !message.msg_id) continue;
    const vars = object(message.smtp_vars);
    const mappedId = vars?.campaignId;
    if (!(mappedId === campaignId || mappedId === String(campaignId) || known.has(message.msg_id))) continue;
    const recipient = typeof message.msg_data?.rcpt_to === "string" ? message.msg_data.rcpt_to.trim().toLowerCase() : "";
    unique.set(`${message.msg_id}\0${recipient}`, message);
  }
  if (!unique.size) return null;
  const rows = [...unique.values()];
  const counts = unavailableSmtpCounts();
  counts.accepted = rows.length;
  const deliveryComplete = rows.every(row => ["delivered", "failed", "queued"].includes(String(row.details?.delivery?.event)));
  if (deliveryComplete) {
    for (const event of ["delivered", "failed", "queued"] as const) counts[event] = rows.filter(row => row.details?.delivery?.event === event).length;
  }
  const sumArrays = (getItems: (row: SmtpMessage) => unknown): number | null => {
    if (!rows.every(row => Array.isArray(getItems(row)))) return null;
    return rows.reduce((total, row) => total + (getItems(row) as unknown[]).length, 0);
  };
  counts.opened = sumArrays(row => row.opens?.items);
  counts.clicked = sumArrays(row => row.clicks?.items);
  counts.unsubscribed = sumArrays(row => row.unsubs?.items);
  counts.complained = sumArrays(row => row.abuse?.complaints);
  const uniqueRecipients = (getItems: (row: SmtpMessage) => unknown): number | null => {
    if (!rows.every(row => Array.isArray(getItems(row)) && typeof row.msg_data?.rcpt_to === "string" && row.msg_data.rcpt_to.trim())) return null;
    return new Set(rows.filter(row => (getItems(row) as unknown[]).length > 0).map(row => String(row.msg_data!.rcpt_to).trim().toLowerCase())).size;
  };
  const matchedIds = new Set(rows.map(row => String(row.msg_id)));
  return { counts, matchedMessages: rows.length, uniqueOpenRecipients: uniqueRecipients(row => row.opens?.items), uniqueClickRecipients: uniqueRecipients(row => row.clicks?.items), partial: partial || knownMessageIds.some(id => !matchedIds.has(id)) };
}

export type SmtpCampaignReportInput = {
  campaignId: number;
  start: Date;
  knownMessageIds?: string[];
  period?: "this_day" | "this_week";
  refresh?: boolean;
};
const cache = new Map<string, { expires: number; report: SmtpCampaignReport }>();
const running = new Map<string, Promise<SmtpCampaignReport>>();

/** Reporting only: GET endpoints, server-side key, never sends mail or changes callback configuration. */
export async function getSmtpCampaignReport(input: SmtpCampaignReportInput): Promise<SmtpCampaignReport> {
  const key = process.env.SMTPCOM_API_KEY?.trim();
  const channel = process.env.SMTPCOM_CHANNEL?.trim();
  const period = input.period ?? "this_day";
  const empty: SmtpCampaignReport = { status: "unconfigured", checkedAt: Date.now(), period, channel: null, campaign: null,
    notice: "SMTP.com reporting is not connected. Configure SMTPCOM_API_KEY and the marketing SMTPCOM_CHANNEL on the application server. Transactional emails continue through SendGrid.",
    campaignNotice: "Campaign-level SMTP.com results are unavailable until provider message records can be matched to this campaign." };
  if (!key || !channel) return empty;
  const fingerprint = createHash("sha256").update(`${key}\0${channel}`).digest("hex");
  const cacheKey = `${fingerprint}:${input.campaignId}:${input.start.getTime()}:${period}:${createHash("sha256").update((input.knownMessageIds ?? []).join(",")).digest("hex")}`;
  const previous = cache.get(cacheKey);
  if (!input.refresh && previous && previous.expires > Date.now()) return previous.report;
  const pending = running.get(cacheKey);
  if (pending) return pending;
  const task = (async (): Promise<SmtpCampaignReport> => {
    const deadline = Date.now() + REQUEST_BUDGET_MS;
    const get = async (path: string, params: Record<string, string>): Promise<unknown> => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("SMTP.com reporting timed out. Retry to refresh the report.");
      const url = new URL(`${API_ROOT}${path}`);
      Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
      const response = await fetch(url, { method: "GET", headers: { "X-SMTPCOM-API": key, Accept: "application/json" }, signal: AbortSignal.timeout(Math.min(8000, remaining)) });
      if (!response.ok) throw new Error(`SMTP.com reporting returned HTTP ${response.status}. Check reporting permissions and try again.`);
      const payload: unknown = await response.json();
      const envelope = object(payload);
      if (envelope?.status != null && envelope.status !== "success") throw new Error("SMTP.com did not accept the reporting request.");
      return payload;
    };
    try {
      // Verify the configured channel rather than reading a different sending stream.
      const channels = object(await get("/channels/", { limit: "1000", offset: "0" }));
      const channelItems = object(channels?.data)?.items;
      if (!Array.isArray(channelItems) || !channelItems.some(row => object(row)?.name === channel)) {
        throw new Error("The configured SMTP.com marketing channel was not found in the authorized account.");
      }
      const stats = parseSmtpChannelStats(await get(`/stats/${period}/channel`, { limit: "1000", offset: "0" }), channel);
      let campaign: SmtpCampaignReport["campaign"] = null;
      let campaignNotice = "No provider message IDs or campaign metadata matched this campaign. Channel-wide totals below are not this campaign's totals. Existing historical messages cannot be attributed by subject alone.";
      try {
        const messages: SmtpMessage[] = [];
        let partial = false;
        // Detailed retention is provider-controlled. Always label this as matched records, not an exhaustive historical export.
        const start = input.start.toUTCString().replace("GMT", "+0000");
        const end = new Date().toUTCString().replace("GMT", "+0000");
        for (let page = 0; page < MAX_PAGES; page++) {
          if (Date.now() >= deadline - 1000) { partial = true; break; }
          const items = parseSmtpMessages(await get("/messages", { channel, start, end, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) }));
          messages.push(...items);
          if (items.length < PAGE_SIZE) break;
          if (page === MAX_PAGES - 1) partial = true;
        }
        campaign = summarizeSmtpCampaignMessages(messages, channel, input.campaignId, input.knownMessageIds, partial);
        if (campaign) campaignNotice = campaign.partial
          ? "Partial campaign-matched SMTP.com message records. Pagination, reporting delay, or provider retention may exclude additional messages. Unique recipients are app-derived from matched message records, not SMTP.com unique-event totals."
          : "Campaign-matched SMTP.com message records within the available reporting window. Provider retention/reporting delay can limit coverage. Unique recipients are app-derived; open and click totals are events, not unique people.";
      } catch {
        campaignNotice = "SMTP.com detailed campaign messages are currently unavailable. Channel aggregates remain separate; missing message data is not zero engagement.";
      }
      return { ...empty, status: "ready", checkedAt: Date.now(), channel: stats ? { counts: stats } : null, campaign, campaignNotice,
        notice: stats
          ? "SMTP.com API channel aggregates for the selected provider calendar period. These include all mail on the configured marketing channel, not only this campaign. Opened and clicked are event counts, not unique recipients."
          : "SMTP.com access succeeded, but its response did not identify the configured channel's statistics. No account-wide totals have been substituted." };
    } catch (error) {
      return { ...empty, status: "error", checkedAt: Date.now(), notice: error instanceof Error && error.message.startsWith("SMTP.com") ? error.message : "SMTP.com reporting is unavailable. Check the reporting connection and retry." };
    }
  })();
  running.set(cacheKey, task);
  try {
    const report = await task;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { report, expires: Date.now() + (report.status === "ready" ? 60000 : 15000) });
    return report;
  } finally { running.delete(cacheKey); }
}
