/**
 * CME Hub — checkout URL builder tests
 * Tests the email-prefill deep link logic used in CmeHub.tsx
 */
import { describe, it, expect } from "vitest";

// Replicate the buildCheckoutUrl logic from CmeHub.tsx for server-side testing
function buildCheckoutUrl(enrollUrl: string, email?: string | null): string {
  if (!email) return enrollUrl;
  const separator = enrollUrl.includes("?") ? "&" : "?";
  return `${enrollUrl}${separator}prefill_email=${encodeURIComponent(email)}`;
}

describe("CME Hub — buildCheckoutUrl", () => {
  it("returns the original URL when no email is provided", () => {
    const url = "https://member.allaboutultrasound.com/enroll/603157";
    expect(buildCheckoutUrl(url)).toBe(url);
  });

  it("returns the original URL when email is null", () => {
    const url = "https://member.allaboutultrasound.com/enroll/603157";
    expect(buildCheckoutUrl(url, null)).toBe(url);
  });

  it("returns the original URL when email is empty string", () => {
    const url = "https://member.allaboutultrasound.com/enroll/603157";
    expect(buildCheckoutUrl(url, "")).toBe(url);
  });

  it("appends prefill_email with ? when no existing query string", () => {
    const url = "https://member.allaboutultrasound.com/enroll/603157";
    const result = buildCheckoutUrl(url, "test@example.com");
    expect(result).toBe("https://member.allaboutultrasound.com/enroll/603157?prefill_email=test%40example.com");
  });

  it("appends prefill_email with & when URL already has query params", () => {
    const url = "https://member.allaboutultrasound.com/enroll/3510863?et=free_trial";
    const result = buildCheckoutUrl(url, "user@iheartecho.com");
    expect(result).toBe("https://member.allaboutultrasound.com/enroll/3510863?et=free_trial&prefill_email=user%40iheartecho.com");
  });

  it("properly encodes special characters in email", () => {
    const url = "https://member.allaboutultrasound.com/enroll/617498";
    const result = buildCheckoutUrl(url, "user+tag@example.com");
    expect(result).toContain("prefill_email=user%2Btag%40example.com");
  });

  it("handles order-style checkout URLs (non-enroll format)", () => {
    const url = "https://member.allaboutultrasound.com/order?ct=ce76d1e8-7fa8-4e7a-92b0-97c07287581e";
    const result = buildCheckoutUrl(url, "lara@allaboutultrasound.com");
    expect(result).toBe(
      "https://member.allaboutultrasound.com/order?ct=ce76d1e8-7fa8-4e7a-92b0-97c07287581e&prefill_email=lara%40allaboutultrasound.com"
    );
  });

  it("all 11 CME course enroll URLs are valid HTTPS URLs", () => {
    const enrollUrls = [
      "https://member.allaboutultrasound.com/enroll/3612790",
      "https://member.allaboutultrasound.com/enroll/603157",
      "https://member.allaboutultrasound.com/enroll/617498",
      "https://member.allaboutultrasound.com/enroll/3512551",
      "https://member.allaboutultrasound.com/enroll/3512552",
      "https://member.allaboutultrasound.com/enroll/3512545",
      "https://member.allaboutultrasound.com/enroll/3512549",
      "https://member.allaboutultrasound.com/enroll/3510863",
      "https://member.allaboutultrasound.com/order?ct=ce76d1e8-7fa8-4e7a-92b0-97c07287581e",
      "https://member.allaboutultrasound.com/enroll/3584663",
      "https://member.allaboutultrasound.com/enroll/3523147",
    ];
    enrollUrls.forEach(url => {
      expect(url).toMatch(/^https:\/\/member\.allaboutultrasound\.com\//);
    });
  });
});
