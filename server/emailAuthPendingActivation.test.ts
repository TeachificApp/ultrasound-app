import { describe, expect, it } from "vitest";
import { isVerifiedPendingEmailAccount } from "./routers/emailAuthRouter";

describe("verified pending email-account activation", () => {
  it("recognizes only an email-verified pending account with an existing password", () => {
    expect(isVerifiedPendingEmailAccount({
      isPending: true,
      emailVerified: true,
      passwordHash: "$2b$12$already-established-password-hash",
    })).toBe(true);
  });

  it("does not auto-activate a pending account before email verification", () => {
    expect(isVerifiedPendingEmailAccount({
      isPending: true,
      emailVerified: false,
      passwordHash: "$2b$12$already-established-password-hash",
    })).toBe(false);
  });

  it("does not auto-activate an account with no password", () => {
    expect(isVerifiedPendingEmailAccount({
      isPending: true,
      emailVerified: true,
      passwordHash: null,
    })).toBe(false);
  });

  it("keeps active and non-pending accounts outside the activation path", () => {
    expect(isVerifiedPendingEmailAccount({
      isPending: false,
      emailVerified: true,
      passwordHash: "$2b$12$already-established-password-hash",
    })).toBe(false);
  });
});
