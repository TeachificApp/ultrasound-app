import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldClearPendingAfterCredentialVerification } from "./routers/emailAuthRouter";

const source = () => readFileSync(resolve(process.cwd(), "server/routers/emailAuthRouter.ts"), "utf8");

describe("pending account recovery", () => {
  it("clears a pending marker only after a caller has already completed credential verification", () => {
    expect(shouldClearPendingAfterCredentialVerification({
      isPending: true,
    })).toBe(true);
  });

  it("leaves active accounts outside the activation update", () => {
    expect(shouldClearPendingAfterCredentialVerification({
      isPending: false,
    })).toBe(false);
  });

  it("does not retain a pre-registration rejection in the password login path", () => {
    const emailAuth = source();

    expect(emailAuth).not.toContain("Your account has been pre-registered but not yet activated");
    expect(emailAuth).toContain("shouldClearPendingAfterCredentialVerification(user)");
    expect(emailAuth).toContain("const passwordMatch = await bcrypt.compare");
  });

  it("allows password reset and magic-link handlers to operate without pending-account guards", () => {
    const emailAuth = source();
    const magicLink = readFileSync(resolve(process.cwd(), "server/routes/authLogin.ts"), "utf8");

    expect(emailAuth).toMatch(/resetPassword:[\s\S]*?isPending: false/);
    expect(magicLink).not.toContain("isPending");
  });
});
