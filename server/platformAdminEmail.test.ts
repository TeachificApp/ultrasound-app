import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLATFORM_ADMIN_EMAIL,
  resolvePlatformAdminEmail,
} from "../shared/platformAdminEmail";
import {
  isPlatformAdminAccountEmail,
  PLATFORM_ADMIN_ACCOUNT_EMAILS,
} from "../shared/platformAdminAccess";

describe("platform admin email routing", () => {
  it("defaults notification email to admin@allaboutultrasound.com", () => {
    expect(resolvePlatformAdminEmail(undefined)).toBe(DEFAULT_PLATFORM_ADMIN_EMAIL);
    expect(resolvePlatformAdminEmail("")).toBe(DEFAULT_PLATFORM_ADMIN_EMAIL);
    expect(resolvePlatformAdminEmail("  Admin@AllAboutUltrasound.com ")).toBe(
      "admin@allaboutultrasound.com",
    );
  });

  it("includes admin@allaboutultrasound.com in platform admin account allowlist", () => {
    expect(PLATFORM_ADMIN_ACCOUNT_EMAILS).toContain("admin@allaboutultrasound.com");
    expect(isPlatformAdminAccountEmail("admin@allaboutultrasound.com")).toBe(true);
    expect(isPlatformAdminAccountEmail("larawilliams0501@gmail.com")).toBe(false);
  });
});
