import { describe, expect, it } from "vitest";
import { resolveLegacyPasswordSetupPath } from "../shared/legacyPasswordSetupPath";

describe("legacy password setup URL", () => {
  it("redirects access-email /auth/reset-password links to the registered reset-password route while preserving token parameters", () => {
    expect(resolveLegacyPasswordSetupPath("/auth/reset-password", "?token=secure-token", "#set-password"))
      .toBe("/reset-password?token=secure-token#set-password");
  });

  it("does not rewrite other auth routes", () => {
    expect(resolveLegacyPasswordSetupPath("/auth/magic", "?token=other")).toBeNull();
  });
});
