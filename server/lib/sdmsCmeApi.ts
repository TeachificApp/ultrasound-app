/**
 * SDMS CME Provider API client — field names MUST match SDMS spec exactly.
 * @see SDMS_CME_Provider_API May 2022
 */

import { sdmsCmeCreditCategoryEnum } from "../../drizzle/schema";

/** Exact outbound payload keys per SDMS ImportCmeCompletions spec */
export const SDMS_PAYLOAD_FIELD_NAMES = [
  "Approval ID",
  "SDMS Number",
  "LastName",
  "FirstName",
  "BirthDate",
  "Email",
  "ARDMS Number",
  "ARRT Number",
  "Sonography Canada Number",
  "CCI Number",
  "Date Completed",
  "AB_CME",
  "AE_CME",
  "BR_CME",
  "FE_CME",
  "MSK_CME",
  "OB_CME",
  "OT_CME",
  "PE_CME",
  "PS_CME",
  "SPI_CME",
  "VT_CME",
  "Is Speaker",
] as const;

export type SdmsImportPayload = Record<(typeof SDMS_PAYLOAD_FIELD_NAMES)[number], string>;

export const SDMS_SUCCESS_CODE = "305";

export const SDMS_KNOWN_ERROR_CODES: Record<string, string> = {
  "302": "Total CME credits exceed limit",
  "306": "General failure / duplicate equivalent activity / date parsing issue",
  "308": "Zero CME credits entered",
  "312": "Completion submitted outside 90-day window",
  "313": "Clinical instructorship outside one-year window",
  "315": "Invalid completion date",
  "400": "Missing required data / template issue",
  "403": "Invalid credit value; only .25 increments allowed",
  "806": "Application not approved",
  "902": "Approval number authentication failed",
};

const CREDIT_CATEGORIES = [...sdmsCmeCreditCategoryEnum];

export function zeroCreditPayload(): Pick<
  SdmsImportPayload,
  | "AB_CME"
  | "AE_CME"
  | "BR_CME"
  | "FE_CME"
  | "MSK_CME"
  | "OB_CME"
  | "OT_CME"
  | "PE_CME"
  | "PS_CME"
  | "SPI_CME"
  | "VT_CME"
> {
  return {
    AB_CME: "0.00",
    AE_CME: "0.00",
    BR_CME: "0.00",
    FE_CME: "0.00",
    MSK_CME: "0.00",
    OB_CME: "0.00",
    OT_CME: "0.00",
    PE_CME: "0.00",
    PS_CME: "0.00",
    SPI_CME: "0.00",
    VT_CME: "0.00",
  };
}

export function buildSdmsPayload(input: {
  approvalId: string;
  learner: {
    sdmsNumber?: string;
    lastName: string;
    firstName: string;
    birthDate: string;
    email: string;
    ardmsNumber?: string;
    arrtNumber?: string;
    sonographyCanadaNumber?: string;
    cciNumber?: string;
    isSpeaker: string;
  };
  dateCompleted: string;
  creditCategory: (typeof sdmsCmeCreditCategoryEnum)[number];
  creditAmount: string;
}): SdmsImportPayload {
  const credits = zeroCreditPayload();
  credits[input.creditCategory] = formatCreditAmount(input.creditAmount);

  return {
    "Approval ID": String(input.approvalId),
    "SDMS Number": String(input.learner.sdmsNumber ?? ""),
    LastName: String(input.learner.lastName),
    FirstName: String(input.learner.firstName),
    BirthDate: String(input.learner.birthDate),
    Email: String(input.learner.email),
    "ARDMS Number": String(input.learner.ardmsNumber ?? ""),
    "ARRT Number": String(input.learner.arrtNumber ?? ""),
    "Sonography Canada Number": String(input.learner.sonographyCanadaNumber ?? ""),
    "CCI Number": String(input.learner.cciNumber ?? ""),
    "Date Completed": String(input.dateCompleted),
    ...credits,
    "Is Speaker": input.learner.isSpeaker === "Y" ? "Y" : "N",
  };
}

export function formatCreditAmount(amount: string): string {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
}

export type SdmsValidationResult =
  | { ok: true; payload: SdmsImportPayload }
  | { ok: false; errors: string[] };

/** Strict schema validation — every key must match SDMS spec exactly */
export function validateSdmsPayload(payload: Record<string, unknown>): SdmsValidationResult {
  const errors: string[] = [];
  const keys = Object.keys(payload);

  for (const required of SDMS_PAYLOAD_FIELD_NAMES) {
    if (!(required in payload)) {
      errors.push(`Missing required field: "${required}"`);
    }
  }

  for (const key of keys) {
    if (!SDMS_PAYLOAD_FIELD_NAMES.includes(key as (typeof SDMS_PAYLOAD_FIELD_NAMES)[number])) {
      errors.push(`Unknown field "${key}" — field names must match SDMS API exactly`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const typed = payload as SdmsImportPayload;

  for (const field of SDMS_PAYLOAD_FIELD_NAMES) {
    if (typeof typed[field] !== "string") {
      errors.push(`Field "${field}" must be a string`);
    }
  }

  if (!typed["Approval ID"]?.trim()) errors.push('"Approval ID" is required');
  if (!typed.LastName?.trim()) errors.push("LastName is required");
  if (!typed.FirstName?.trim()) errors.push("FirstName is required");
  if (!typed.Email?.trim()) errors.push("Email is required");
  if (!typed.BirthDate?.trim()) errors.push("BirthDate is required");
  if (!typed["Date Completed"]?.trim()) errors.push('"Date Completed" is required');

  const creditSum = CREDIT_CATEGORIES.reduce((sum, cat) => sum + parseFloat(typed[cat] || "0"), 0);
  if (creditSum <= 0) errors.push("At least one CME credit category must be greater than zero");

  if (typed["Is Speaker"] !== "Y" && typed["Is Speaker"] !== "N") {
    errors.push('"Is Speaker" must be "Y" or "N"');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, payload: typed };
}

export function parseSdmsResponseCode(body: string): { code: string | null; message: string } {
  const trimmed = body.trim();
  const match = trimmed.match(/\b(\d{3})\b/);
  const code = match?.[1] ?? null;
  return { code, message: trimmed };
}

export function isSdmsSuccess(code: string | null): boolean {
  return code === SDMS_SUCCESS_CODE;
}

export type SdmsApiCallResult = {
  ok: boolean;
  status: number;
  responseCode: string | null;
  responseMessage: string;
  rawBody: string;
  timedOut?: boolean;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

export async function sdmsConnectionTest(opts: {
  baseUrl: string;
  username: string;
  password: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SdmsApiCallResult> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `${normalizeBaseUrl(opts.baseUrl)}/restapi/esdService/ConnectionTest`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: { Authorization: basicAuthHeader(opts.username, opts.password) },
      signal: controller.signal,
    });
    const rawBody = await res.text();
    const parsed = parseSdmsResponseCode(rawBody);
    const success = res.ok && (rawBody.toLowerCase().includes("success") || parsed.code === SDMS_SUCCESS_CODE);
    return {
      ok: success,
      status: res.status,
      responseCode: parsed.code,
      responseMessage: parsed.message || rawBody,
      rawBody,
    };
  } catch (err: unknown) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      responseCode: null,
      responseMessage: timedOut ? "Connection timed out" : err instanceof Error ? err.message : "Request failed",
      rawBody: "",
      timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sdmsImportCompletion(opts: {
  baseUrl: string;
  username: string;
  password: string;
  payload: SdmsImportPayload;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<SdmsApiCallResult> {
  const validation = validateSdmsPayload(opts.payload);
  if (!validation.ok) {
    return {
      ok: false,
      status: 0,
      responseCode: "400",
      responseMessage: validation.errors.join("; "),
      rawBody: validation.errors.join("; "),
    };
  }

  const fetchFn = opts.fetchImpl ?? fetch;
  const url = `${normalizeBaseUrl(opts.baseUrl)}/restapi/esdService/ImportCmeCompletions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000);
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(opts.username, opts.password),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validation.payload),
      signal: controller.signal,
    });
    const rawBody = await res.text();
    const parsed = parseSdmsResponseCode(rawBody);
    const success = isSdmsSuccess(parsed.code);
    return {
      ok: success,
      status: res.status,
      responseCode: parsed.code,
      responseMessage: parsed.message || rawBody,
      rawBody,
    };
  } catch (err: unknown) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      responseCode: null,
      responseMessage: timedOut ? "Submission timed out" : err instanceof Error ? err.message : "Request failed",
      rawBody: "",
      timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Format Date to MM/DD/YYYY for SDMS */
export function formatSdmsDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
