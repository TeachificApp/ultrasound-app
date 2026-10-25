import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canReusePasswordResetToken,
  getPasswordResetExpiry,
  PASSWORD_RESET_VALIDITY_MS,
  PASSWORD_RESET_VALIDITY_LABEL,
} from "../shared/passwordResetValidity";
import { buildPasswordResetEmail } from "./_core/email";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("password reset validity", () => {
  it("issues reset links that remain valid for 24 hours", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    const expiry = getPasswordResetExpiry(now);

    expect(expiry.getTime() - now.getTime()).toBe(PASSWORD_RESET_VALIDITY_MS);
    expect(PASSWORD_RESET_VALIDITY_LABEL).toBe("24 hours");
  });

  it("reuses only an active reset token so delayed email copies remain valid", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");

    expect(canReusePasswordResetToken("active-token", new Date(now.getTime() + 1), now)).toBe(true);
    expect(canReusePasswordResetToken("expired-token", new Date(now.getTime() - 1), now)).toBe(false);
    expect(canReusePasswordResetToken(null, new Date(now.getTime() + 1), now)).toBe(false);
  });

  it("uses the shared validity policy in both public reset entry points", () => {
    for (const file of ["server/routers.ts", "server/routers/emailAuthRouter.ts"]) {
      const router = source(file);
      expect(router).toContain("canReusePasswordResetToken");
      expect(router).toContain("getPasswordResetExpiry");
    }
  });

  it("shows the same 24-hour expiry in the reset email", () => {
    const email = buildPasswordResetEmail({
      firstName: "Learner",
      resetUrl: "https://learn.allaboutultrasound.com/reset-password?token=test",
    });

    expect(email.previewText).toContain(PASSWORD_RESET_VALIDITY_LABEL);
    expect(email.htmlBody).toContain(PASSWORD_RESET_VALIDITY_LABEL);
  });
});
