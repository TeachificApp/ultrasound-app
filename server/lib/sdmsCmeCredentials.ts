import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { ENV } from "../_core/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function deriveKey(): Buffer {
  const secret = ENV.cookieSecret || "dev-sdms-cme-local-only-key-32chars!";
  return createHash("sha256").update(secret).digest();
}

/** Encrypt SDMS API password for storage. Returns base64 iv:tag:ciphertext */
export function encryptSdmsPassword(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSdmsPassword(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Mask username/password for admin display */
export function maskCredential(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
}
