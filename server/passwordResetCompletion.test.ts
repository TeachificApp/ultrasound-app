import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPasswordResetAutoLoginUrl } from "./lib/passwordResetAutoLogin";

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("password reset completion", () => {
  it("uses the automatic-login endpoint instead of navigating to a raw token path", () => {
    expect(buildPasswordResetAutoLoginUrl("secure token+/=")).toBe(
      "/api/auth/auto-login?token=secure%20token%2B%2F%3D",
    );
  });

  it("never reports a completed password reset as failed when auto-login token creation is unavailable", () => {
    const router = source("server/routers.ts");
    const resetStart = router.indexOf("resetPassword: publicProcedure");
    const resetEnd = router.indexOf("// ─── Magic Link", resetStart);
    const reset = router.slice(resetStart, resetEnd);

    expect(reset).toContain("await updateUserPassword(user.id, newHash)");
    expect(reset).toContain("await clearPasswordResetToken(user.id)");
    expect(reset).toContain("let autoLoginUrl: string | null = null");
    expect(reset).toContain("buildPasswordResetAutoLoginUrl(autoLoginToken)");
    expect(reset).toContain("Password reset completed but automatic sign-in could not be prepared");
  });

  it("gives learners a direct sign-in path when auto-login is not available", () => {
    const page = source("client/src/pages/ResetPassword.tsx");

    expect(page).toContain("setAutomaticSignInReady(Boolean(autoLoginUrl))");
    expect(page).toContain("Please sign in with your new password.");
    expect(page).toContain('href={automaticSignInReady ? "/my-dashboard" : "/login"}');
    expect(page).toContain('{automaticSignInReady ? "Go to Dashboard" : "Sign In"}');
  });
});
