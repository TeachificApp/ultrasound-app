import { describe, it, expect, afterEach } from "vitest";
import {
  PLATFORM_ADMIN_EMAIL_DEFAULT,
  resolvePlatformAdminEmail,
} from "./lib/platformAdminEmail";

describe("resolvePlatformAdminEmail", () => {
  const original = process.env.PLATFORM_ADMIN_EMAIL;

  afterEach(() => {
    if (original === undefined) delete process.env.PLATFORM_ADMIN_EMAIL;
    else process.env.PLATFORM_ADMIN_EMAIL = original;
  });

  it("defaults to the All About Ultrasound admin inbox", () => {
    delete process.env.PLATFORM_ADMIN_EMAIL;
    expect(resolvePlatformAdminEmail()).toBe(PLATFORM_ADMIN_EMAIL_DEFAULT);
    expect(resolvePlatformAdminEmail()).toBe("admin@allaboutultrasound.com");
  });

  it("uses PLATFORM_ADMIN_EMAIL when set to a valid client address", () => {
    process.env.PLATFORM_ADMIN_EMAIL = "ops@example.com";
    expect(resolvePlatformAdminEmail()).toBe("ops@example.com");
  });

  it("ignores the legacy Manus owner gmail address", () => {
    process.env.PLATFORM_ADMIN_EMAIL = "larawilliams0501@gmail.com";
    expect(resolvePlatformAdminEmail()).toBe(PLATFORM_ADMIN_EMAIL_DEFAULT);
    expect(resolvePlatformAdminEmail()).not.toContain("larawilliams");
    expect(resolvePlatformAdminEmail()).not.toContain("gmail.com");
  });
});
