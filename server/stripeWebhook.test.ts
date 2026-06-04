/**
 * Stripe webhook handler tests — fast ack, dual routes, signature verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
  getUserByEmail: vi.fn().mockResolvedValue(null),
  getOrCreateUserByEmail: vi.fn(),
  getOrCreateAccessToken: vi.fn(),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildFunnelPurchaseConfirmationEmail: vi.fn().mockReturnValue({
    subject: "Purchase confirmed",
    htmlBody: "<p>Thanks</p>",
    previewText: "Thanks",
  }),
  buildPaymentFailedEmail: vi.fn(),
}));

vi.mock("./routers/downloadsRouter", () => ({
  sendPurchaseConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./lib/orderBumpCheckout", () => ({
  fulfillOrderBumpPurchase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./routes/autoLogin", () => ({
  generateAutoLoginToken: vi.fn().mockResolvedValue("test-auto-login-token"),
}));

import { registerStripeWebhook } from "./webhooks/stripe";

function buildApp() {
  const app = express();
  registerStripeWebhook(app);
  app.use(express.json());
  return app;
}

function stripeEventPayload(type: string, object: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "evt_test_123",
    type,
    data: { object },
  });
}

describe("Stripe webhook", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (originalSecret) {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it("returns 200 quickly on /api/webhooks/stripe for checkout.session.completed", async () => {
    const payload = stripeEventPayload("checkout.session.completed", {
      id: "cs_test",
      metadata: { type: "digital_download", product_id: "1" },
      amount_total: 9900,
    });
    const start = Date.now();
    const res = await request(buildApp())
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("returns 200 on production alias /api/stripe/webhook", async () => {
    const payload = stripeEventPayload("checkout.session.completed", {
      id: "cs_test_alias",
      metadata: { order_id: "1", user_id: "2", course_id: "3" },
      amount_total: 5000,
    });
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send("not-json");
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const payload = stripeEventPayload("payment_intent.succeeded", {
      id: "pi_test",
      metadata: { type: "embedded_checkout_purchase" },
      amount: 1000,
    });
    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=bad")
      .send(payload);
    expect(res.status).toBe(400);
  });

  it("accepts valid signature when STRIPE_WEBHOOK_SECRET is set", async () => {
    const secret = "whsec_test_secret";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const payload = stripeEventPayload("payment_intent.succeeded", {
      id: "pi_test",
      metadata: { type: "embedded_checkout_purchase", customer_email: "buyer@example.com" },
      amount: 1000,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${timestamp}.${payload}`;
    const sig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

    const res = await request(buildApp())
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${timestamp},v1=${sig}`)
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
