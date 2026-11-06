import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserByEmail: vi.fn(),
  setPasswordResetToken: vi.fn(),
  setMagicLinkToken: vi.fn(),
  upsertUser: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  sendEmail: vi.fn(),
  buildReset: vi.fn(),
  buildMagic: vi.fn(),
  prepare: vi.fn(),
  resolveDelivery: vi.fn(),
  rateLimit: vi.fn(),
  markSent: vi.fn(),
}));

// Keep unrelated router exports intact; all DB and delivery operations used here
// are replaced. No database connection or provider request is made by these tests.
vi.mock("./db", async (importOriginal) => ({
  ...await importOriginal<typeof import("./db")>(),
  getDb: mocks.getDb,
  getUserByEmail: mocks.getUserByEmail,
  setPasswordResetToken: mocks.setPasswordResetToken,
  setMagicLinkToken: mocks.setMagicLinkToken,
  upsertUser: mocks.upsertUser,
}));
vi.mock("./_core/email", () => ({
  sendEmail: mocks.sendEmail,
  buildPasswordResetEmail: mocks.buildReset,
  buildMagicLinkEmail: mocks.buildMagic,
  buildWelcomeEmail: vi.fn(),
  buildVerificationEmail: vi.fn(),
}));
vi.mock("./lib/ensureTransactionalEmailDelivery", () => ({ ensureTransactionalEmailDelivery: mocks.prepare }));
vi.mock("./lib/authEmailDelivery", () => ({ resolveAuthDeliveryEmail: mocks.resolveDelivery }));
vi.mock("./lib/authEmailRateLimit", () => ({ shouldSendAuthEmail: mocks.rateLimit, markAuthEmailSent: mocks.markSent }));
vi.mock("./lib/recordUserLogin", () => ({ getRequestClientInfo: () => ({ ipAddress: "192.0.2.10", userAgent: "test" }) }));

import { appRouter } from "./routers";

const ctx = {
  user: null,
  req: { hostname: "app.allaboutultrasound.com", headers: {}, protocol: "https" },
  res: {},
} as TrpcContext;
const caller = appRouter.createCaller(ctx);
const input = { email: "learner@example.com", origin: "https://app.allaboutultrasound.com" };
const accepted = { success: true, deliveryStatus: "acknowledged" };
const user = {
  id: 123,
  email: input.email,
  name: "Test Learner",
  passwordHash: null,
  passwordResetToken: "existing-reset-token",
  passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
  magicLinkToken: "existing-magic-token",
  magicLinkExpiry: new Date(Date.now() + 60 * 60 * 1000),
};
const resetRequests = [
  ["auth.requestPasswordReset", () => caller.auth.requestPasswordReset(input)],
  ["emailAuth.forgotPassword", () => caller.emailAuth.forgotPassword(input)],
] as const;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Fail fast if an unexpected code path attempts an outbound HTTP request.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in mocked auth tests"); }));
});
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue({ update: mocks.update });
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue(undefined);
  mocks.getUserByEmail.mockResolvedValue({ ...user });
  mocks.setPasswordResetToken.mockResolvedValue(undefined);
  mocks.setMagicLinkToken.mockResolvedValue(undefined);
  mocks.upsertUser.mockResolvedValue(undefined);
  mocks.sendEmail.mockResolvedValue(true);
  const payload = { subject: "Test", htmlBody: "test", previewText: "test" };
  mocks.buildReset.mockReturnValue(payload);
  mocks.buildMagic.mockReturnValue(payload);
  mocks.prepare.mockResolvedValue(undefined);
  mocks.resolveDelivery.mockReturnValue(input.email);
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.markSent.mockResolvedValue(undefined);
});

describe.each(resetRequests)("%s reliability", (_name, request) => {
  it("acknowledges unknown accounts generically without sending or preparing a token", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    await expect(request()).resolves.toEqual(accepted);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.setPasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    ["cooldown", "cooldown", 5 * 60 * 1000],
    ["email_hourly", "hourly_limit", 60 * 60 * 1000],
    ["ip_hourly", "hourly_limit", 60 * 60 * 1000],
  ])("reports %s without claiming an email was sent", async (reason, status, retryAfterMs) => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, reason });
    await expect(request()).resolves.toEqual({ success: true, deliveryStatus: status, retryAfterMs });
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("preserves a precise limiter-provided retry duration", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, reason: "cooldown", retryAfterMs: 42_000 });
    await expect(request()).resolves.toMatchObject({ deliveryStatus: "cooldown", retryAfterMs: 42_000 });
  });

  it.each([false, "throw"])("returns generic service unavailable when sending returns %s", async (outcome) => {
    if (outcome === false) mocks.sendEmail.mockResolvedValue(false);
    else mocks.sendEmail.mockRejectedValue(new Error("Sensitive provider rejection"));
    await expect(request()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Password reset email is temporarily unavailable. Please try again shortly or contact support.",
    });
    expect(mocks.markSent).not.toHaveBeenCalled();
  });

  it.each(["lookup", "token", "template", "address", "rate-limit"])("returns service unavailable on %s preparation failure", async (step) => {
    if (step === "lookup") mocks.getUserByEmail.mockRejectedValue(new Error("lookup failed"));
    if (step === "token") {
      mocks.setPasswordResetToken.mockRejectedValue(new Error("token failed"));
      mocks.where.mockRejectedValue(new Error("token failed"));
    }
    if (step === "template") mocks.buildReset.mockImplementation(() => { throw new Error("template failed"); });
    if (step === "address") mocks.resolveDelivery.mockReturnValue(null);
    if (step === "rate-limit") mocks.rateLimit.mockRejectedValue(new Error("limiter failed"));
    await expect(request()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("returns the generic acknowledgment after provider acceptance even when rate-limit logging fails", async () => {
    mocks.markSent.mockRejectedValue(new Error("log insert failed"));
    await expect(request()).resolves.toEqual(accepted);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ transactional: true }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reuses an active reset token and renews the shared 24-hour expiry for OAuth-only accounts", async () => {
    const start = Date.now();
    await expect(request()).resolves.toEqual(accepted);
    const tokenUpdate = _name === "auth.requestPasswordReset"
      ? { token: mocks.setPasswordResetToken.mock.calls[0][1], expiry: mocks.setPasswordResetToken.mock.calls[0][2] }
      : { token: mocks.set.mock.calls[0][0].passwordResetToken, expiry: mocks.set.mock.calls[0][0].passwordResetExpiry };
    expect(tokenUpdate.token).toBe(user.passwordResetToken);
    expect(tokenUpdate.expiry.getTime()).toBeGreaterThanOrEqual(start + 24 * 60 * 60 * 1000);
    expect(tokenUpdate.expiry.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
  });
});

describe("auth.requestPasswordReset additional preparation", () => {
  it("does not claim success when transactional delivery preparation fails", async () => {
    mocks.prepare.mockRejectedValue(new Error("prep failed"));
    await expect(caller.auth.requestPasswordReset(input)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("emailAuth.forgotPassword database availability", () => {
  it("returns generic service unavailable when the DB is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(caller.emailAuth.forgotPassword(input)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("auth.requestMagicLink reliability", () => {
  it.each([
    ["cooldown", "cooldown", 60_000],
    ["email_hourly", "hourly_limit", 60 * 60 * 1000],
    ["ip_hourly", "hourly_limit", 60 * 60 * 1000],
  ])("reports %s with correct retry guidance", async (reason, status, retryAfterMs) => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, reason });
    await expect(caller.auth.requestMagicLink(input)).resolves.toEqual({ success: true, deliveryStatus: status, retryAfterMs });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
  });

  it("returns sent after acceptance even if rate-limit logging fails", async () => {
    mocks.markSent.mockRejectedValue(new Error("log insert failed"));
    await expect(caller.auth.requestMagicLink(input)).resolves.toEqual({ success: true, deliveryStatus: "sent" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not log a send rejected by the provider", async () => {
    mocks.sendEmail.mockResolvedValue(false);
    await expect(caller.auth.requestMagicLink(input)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.markSent).not.toHaveBeenCalled();
  });

  it("preserves guest account creation and active token reuse", async () => {
    mocks.getUserByEmail.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...user });
    await expect(caller.auth.requestMagicLink(input)).resolves.toMatchObject({ deliveryStatus: "sent" });
    expect(mocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ email: input.email, loginMethod: "magic_link" }));
    expect(mocks.setMagicLinkToken).toHaveBeenCalledWith(user.id, user.magicLinkToken, expect.any(Date));
  });
});
