/**
 * .quiz file format utilities
 *
 * Free tier: plain JSON wrapped in a header (no encryption)
 * Pro/Enterprise: AES-256-GCM encrypted, key derived from license key + static salt
 *
 * File format:
 *   Line 1: TEACHIFIC_QUIZ_V1\n
 *   Line 2: <base64-encoded payload>
 *
 * Payload (free):   base64(JSON)
 * Payload (pro):    base64(iv[12] + ciphertext)
 */

import type { QuizFile } from "../types/quiz";

const HEADER = "TEACHIFIC_QUIZ_V1";
const SALT = "teachific-quiz-salt-2025";

async function deriveKey(licenseKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(licenseKey),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(""));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Serialize a QuizFile to a .quiz string */
export async function serializeQuiz(
  quiz: QuizFile,
  licenseKey: string | null
): Promise<string> {
  const json = JSON.stringify(quiz);
  let payload: string;

  if (licenseKey) {
    // Encrypt
    const key = await deriveKey(licenseKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(json)
    );
    // Combine iv + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    payload = toBase64(combined.buffer);
  } else {
    // Free tier: plain base64
    payload = btoa(unescape(encodeURIComponent(json)));
  }

  return `${HEADER}\n${payload}`;
}

/** Deserialize a .quiz string back to a QuizFile */
export async function deserializeQuiz(
  content: string,
  licenseKey: string | null
): Promise<QuizFile> {
  const lines = content.trim().split("\n");
  if (lines[0] !== HEADER) {
    throw new Error("Invalid .quiz file: missing header");
  }
  const payload = lines[1];
  if (!payload) throw new Error("Invalid .quiz file: empty payload");

  const raw = fromBase64(payload);

  let json: string;
  if (licenseKey) {
    // Try to decrypt
    try {
      const key = await deriveKey(licenseKey);
      const iv = raw.slice(0, 12);
      const ciphertext = raw.slice(12);
      const dec = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );
      json = new TextDecoder().decode(dec);
    } catch {
      // Might be a plain (free) file opened with a license key — try plain
      json = decodeURIComponent(escape(Array.from(raw, (b) => String.fromCharCode(b)).join("")));
    }
  } else {
    // Try plain base64 first
    try {
      json = decodeURIComponent(escape(Array.from(raw, (b) => String.fromCharCode(b)).join("")));
    } catch {
      throw new Error(
        "This .quiz file is encrypted. Please enter your license key to open it."
      );
    }
  }

  const parsed = JSON.parse(json) as QuizFile;
  return parsed;
}

/** Trigger a browser download of the .quiz file */
export async function downloadQuiz(
  quiz: QuizFile,
  licenseKey: string | null
): Promise<string> {
  const content = await serializeQuiz(quiz, licenseKey);
  const blob = new Blob([content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `${quiz.meta.title.replace(/[^a-z0-9]/gi, "_")}.quiz`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/** Read a .quiz file from a File object */
export async function openQuizFile(
  file: File,
  licenseKey: string | null
): Promise<QuizFile> {
  const text = await file.text();
  return deserializeQuiz(text, licenseKey);
}
