import { storagePut } from "../storage";

const DATA_IMAGE_SRC_RE = /src=(["'])(data:image\/[^"']+)\1/gi;

const B64_MARKER = ";base64,";

function parseDataImageUri(dataUri: string): { mimeType: string; buffer: Buffer } {
  const b64Idx = dataUri.indexOf(B64_MARKER);
  if (b64Idx < 0) {
    throw new Error("Invalid image data URI");
  }

  const mimeMatch = dataUri.match(/^data:(image\/[^;,]+)/i);
  if (!mimeMatch) {
    throw new Error("Unsupported image data URI");
  }

  const mimeType = mimeMatch[1].toLowerCase();
  const base64Data = dataUri.slice(b64Idx + B64_MARKER.length);
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.byteLength === 0) {
    throw new Error("Image data URI is empty");
  }
  if (buffer.byteLength > 40 * 1024 * 1024) {
    throw new Error("Embedded image must be under 40 MB");
  }

  return { mimeType, buffer };
}

async function uploadDataImageUri(dataUri: string, context: string): Promise<string> {
  const { mimeType, buffer } = parseDataImageUri(dataUri);
  const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const suffix = Math.random().toString(36).slice(2, 10);
  const fileKey = `rich-text/${context}/${suffix}.${ext}`;
  const { url } = await storagePut(fileKey, buffer, mimeType);
  return url;
}

/**
 * Replaces inline base64 image data URIs in rich-text HTML with hosted URLs.
 * Prevents MySQL TEXT column overflows and keeps editor payloads small.
 */
export async function processRichTextHtml(
  html: string | null | undefined,
  context = "rich-text",
): Promise<string | null | undefined> {
  if (html == null || html === "") return html;
  if (!html.includes("data:image")) return html;

  const uniqueDataUris = new Set<string>();
  for (const match of html.matchAll(DATA_IMAGE_SRC_RE)) {
    uniqueDataUris.add(match[2]);
  }
  if (uniqueDataUris.size === 0) return html;

  const replacements = new Map<string, string>();
  for (const dataUri of uniqueDataUris) {
    replacements.set(dataUri, await uploadDataImageUri(dataUri, context));
  }

  return html.replace(DATA_IMAGE_SRC_RE, (full, quote: string, dataUri: string) => {
    const url = replacements.get(dataUri);
    return url ? `src=${quote}${url}${quote}` : full;
  });
}
