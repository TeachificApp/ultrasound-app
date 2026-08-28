import net from "node:net";
import { lookup } from "node:dns/promises";

const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_SOURCE_RESPONSE_BYTES = 1_500_000;
const MAX_SOURCE_TEXT_CHARACTERS = 60_000;

function isBlockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224;
}

export function isBlockedAiGenerationHost(hostname: string) {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const family = net.isIP(host);
  if (family === 4) return isBlockedIpv4(host);
  if (family === 6) return host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb") || host.startsWith("::ffff:127.") || host.startsWith("::ffff:10.") || host.startsWith("::ffff:192.168.");
  return false;
}

export function normalizeAiGenerationSourceUrl(value: string) {
  if (!value || value.length > MAX_SOURCE_URL_LENGTH) throw new Error("Enter a valid public web-page URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid public web-page URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || isBlockedAiGenerationHost(url.hostname)) {
    throw new Error("Only public HTTP or HTTPS web pages are supported.");
  }
  if (url.port && !((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80"))) {
    throw new Error("Only standard HTTP and HTTPS web-page ports are supported.");
  }
  url.hash = "";
  return url;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function textFromAiGenerationHtml(value: string) {
  return decodeHtml(value
    .replace(/<(script|style|noscript|svg|canvas|iframe|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  ).slice(0, MAX_SOURCE_TEXT_CHARACTERS);
}

async function assertPublicDns(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => isBlockedAiGenerationHost(record.address))) {
    throw new Error("The URL must resolve to a public web server.");
  }
}

export async function fetchAiGenerationSourceUrl(value: string) {
  const url = normalizeAiGenerationSourceUrl(value);
  await assertPublicDns(url.hostname);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "text/html, text/plain;q=0.9", "User-Agent": "AllAboutUltrasoundQuestionGenerator/1.0" },
    });
  } catch {
    throw new Error("The web page could not be retrieved. Use a publicly accessible page without redirects.");
  }
  if (!response.ok) throw new Error(`The web page returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html") && !contentType.startsWith("text/plain") && !contentType.startsWith("application/xhtml+xml")) {
    throw new Error("The URL must point to an HTML or plain-text web page. Upload PDFs and images as source files instead.");
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SOURCE_RESPONSE_BYTES) throw new Error("The web page is too large to use as a question source.");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_SOURCE_RESPONSE_BYTES) throw new Error("The web page is too large to use as a question source.");
  const text = contentType.startsWith("text/plain") ? body.replace(/\s+/g, " ").trim().slice(0, MAX_SOURCE_TEXT_CHARACTERS) : textFromAiGenerationHtml(body);
  if (text.length < 120) throw new Error("The web page did not contain enough readable text to generate questions.");
  return { url: url.toString(), text };
}
