import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getEmailCampaignAppUrl,
  injectTrackingPixel,
  wrapLinksForTracking,
  resolveTrackableHref,
} from "./lib/emailCampaignTracking";

describe("emailCampaignTracking", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("prefers VITE_APP_URL for tracking base URL", () => {
    process.env.VITE_APP_URL = "https://app.allaboutultrasound.com";
    process.env.CANONICAL_ROOT_DOMAIN = "allaboutultrasound.com";
    expect(getEmailCampaignAppUrl()).toBe("https://app.allaboutultrasound.com");
  });

  it("adds https:// to bare CANONICAL_ROOT_DOMAIN", () => {
    delete process.env.VITE_APP_URL;
    process.env.CANONICAL_ROOT_DOMAIN = "app.allaboutultrasound.com";
    expect(getEmailCampaignAppUrl()).toBe("https://app.allaboutultrasound.com");
  });

  it("injects tracking pixel with app URL", () => {
    process.env.VITE_APP_URL = "https://app.allaboutultrasound.com";
    const html = injectTrackingPixel("<html><body>Hi</body></html>", 42, "u7", "A");
    expect(html).toContain(
      'src="https://app.allaboutultrasound.com/api/email/track/open/42/u7.gif?v=A"',
    );
  });

  it("wraps https and relative links for click tracking", () => {
    process.env.VITE_APP_URL = "https://app.allaboutultrasound.com";
    const html = wrapLinksForTracking(
      '<a href="https://learn.allaboutultrasound.com/courses/foo">Course</a>' +
      "<a href='/premium'>Premium</a>" +
      '<a href="mailto:support@example.com">Email</a>',
      9,
      "u3",
    );
    expect(html).toContain("/api/email/track/click/9/u3?url=");
    expect(html).toContain(encodeURIComponent("https://learn.allaboutultrasound.com/courses/foo"));
    expect(html).toContain(encodeURIComponent("https://app.allaboutultrasound.com/premium"));
    expect(html).toContain('href="mailto:support@example.com"');
  });

  it("skips unsubscribe and existing track links", () => {
    process.env.VITE_APP_URL = "https://app.allaboutultrasound.com";
    const html = wrapLinksForTracking(
      '<a href="https://app.allaboutultrasound.com/unsubscribe?token=abc">Unsub</a>',
      1,
      "u1",
    );
    expect(html).not.toContain("/api/email/track/click/");
  });

  it("resolveTrackableHref handles absolute and relative URLs", () => {
    const app = "https://app.allaboutultrasound.com";
    expect(resolveTrackableHref("/premium", app)).toBe("https://app.allaboutultrasound.com/premium");
    expect(resolveTrackableHref("https://example.com", app)).toBe("https://example.com");
    expect(resolveTrackableHref("#section", app)).toBeNull();
    expect(resolveTrackableHref("mailto:a@b.com", app)).toBeNull();
  });
});
