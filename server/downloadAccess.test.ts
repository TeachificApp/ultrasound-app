/**
 * Download access control unit tests
 */
import { describe, it, expect } from "vitest";
import {
  isPurchaseAccessActive,
  resolveMaxDownloadsPerFile,
  formatOrderRef,
  computeAccessExpiresAt,
} from "./lib/downloadAccess";

describe("downloadAccess", () => {
  it("isPurchaseAccessActive rejects expired and revoked", () => {
    expect(isPurchaseAccessActive({ status: "open" })).toBe(true);
    expect(isPurchaseAccessActive({ status: "revoked" })).toBe(false);
    expect(isPurchaseAccessActive({
      status: "open",
      accessExpiresAt: new Date(Date.now() - 1000),
    })).toBe(false);
  });

  it("resolveMaxDownloadsPerFile uses purchase then product then default 3", () => {
    expect(resolveMaxDownloadsPerFile({ maxDownloadsPerFile: 5 }, {})).toBe(5);
    expect(resolveMaxDownloadsPerFile({}, { maxDownloadsPerFile: 2 })).toBe(2);
    expect(resolveMaxDownloadsPerFile({}, {})).toBe(3);
    expect(resolveMaxDownloadsPerFile({ maxDownloadsPerFile: null }, { maxDownloadsPerFile: null })).toBe(null);
  });

  it("formatOrderRef uses session id or purchase id", () => {
    expect(formatOrderRef({ id: 42, stripeCheckoutSessionId: "cs_test_abc123xyz" })).toMatch(/ABC123/);
    expect(formatOrderRef({ id: 42 })).toBe("ORD-42");
  });

  it("computeAccessExpiresAt adds days", () => {
    const exp = computeAccessExpiresAt(7);
    expect(exp).not.toBeNull();
    const diffDays = (exp!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
    expect(computeAccessExpiresAt(null)).toBeNull();
  });
});
