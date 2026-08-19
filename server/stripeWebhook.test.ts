/** Stripe webhook handler regression coverage. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  emailWrapper: vi.fn((body: string) => body),
  buildFunnelPurchaseConfirmationEmail: vi.fn().mockReturnValue({ subject: "Purchase confirmed", htmlBody: "<p>Thanks</p>", previewText: "Thanks" }),
  buildPaymentFailedEmail: vi.fn().mockReturnValue({ subject: "Payment failed", htmlBody: "<p>Update payment</p>", previewText: "Update payment" }),
}));
vi.mock("./routers/downloadsRouter", () => ({ sendPurchaseConfirmationEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./lib/orderBumpCheckout", () => ({ fulfillOrderBumpPurchase: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./routes/autoLogin", () => ({ generateAutoLoginToken: vi.fn().mockResolvedValue("test-auto-login-token") }));
vi.mock("./lib/stripeClient", () => ({
  getStripeClient: vi.fn(() => ({ subscriptions: { update: vi.fn().mockResolvedValue({}) } })),
}));

import { registerStripeWebhook } from "./webhooks/stripe";

function buildApp() {
  const app = express();
  registerStripeWebhook(app);
  app.use(express.json());
  return app;
}

function stripeEventPayload(type: string, object: Record<string, unknown> = {}, id = "evt_test_123") {
  return JSON.stringify({ id, type, data: { object } });
}

describe("Stripe webhook", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "";
  });

  afterEach(() => {
    if (originalSecret) process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it.each(["/api/webhooks/stripe", "/api/stripe/webhook"])("acknowledges Stripe sandbox verification on %s", async (path) => {
    const res = await request(buildApp())
      .post(path)
      .set("Content-Type", "application/json")
      .send(stripeEventPayload("checkout.session.completed", { id: "cs_test", amount_total: 9900 }));
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
  });

  it.each(["invoice.paid", "invoice.payment_failed"])("accepts recurring lifecycle event %s on the production webhook route", async (type) => {
    const payload = stripeEventPayload(type, {
      id: `in_${type.replace(/[^a-z]/g, "_")}`,
      subscription: "sub_recurring_test",
      customer_email: "member@example.com",
      attempt_count: 1,
    }, `evt_recurring_${type.replace(/[^a-z]/g, "_")}`);
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await request(buildApp()).post("/api/stripe/webhook").set("Content-Type", "application/json").send("not-json");
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=bad")
      .send(stripeEventPayload("payment_intent.succeeded", { id: "pi_test" }));
    expect(res.status).toBe(400);
  });

  it("accepts a correctly signed event after runtime webhook-secret rotation", async () => {
    const secret = "whsec_test_secret";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const payload = stripeEventPayload("payment_intent.succeeded", { id: "pi_test" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${timestamp},v1=${signature}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
  });
});
