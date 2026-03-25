/**
 * Tests for the SendGrid Event Webhook handler.
 * Verifies that unsubscribe and spamreport events are accepted and processed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mocks (vi.mock is hoisted — no top-level variable references allowed) ─────

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 99, unsubscribedAt: null, notificationPrefs: null },
          ]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

vi.mock("../drizzle/schema", () => ({
  users: {
    id: "id",
    email: "email",
    unsubscribedAt: "unsubscribedAt",
    notificationPrefs: "notificationPrefs",
  },
  webhookEvents: {},
}));

vi.mock("./lib/sendgridSuppressions", () => ({
  addToSendGridGlobalUnsubscribes: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { registerSendGridWebhook } from "./webhooks/sendgrid";
import { addToSendGridGlobalUnsubscribes } from "./lib/sendgridSuppressions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  registerSendGridWebhook(app);
  return app;
}

const makeEvent = (event: string, email = "test@example.com") => [
  { email, event, timestamp: Math.floor(Date.now() / 1000), sg_event_id: "evt-1" },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SendGrid Event Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and received count for a valid unsubscribe event", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("unsubscribe")));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
  });

  it("returns 200 for a spamreport event", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("spamreport")));
    expect(res.status).toBe(200);
  });

  it("returns 200 for a group_unsubscribe event", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("group_unsubscribe")));
    expect(res.status).toBe(200);
  });

  it("returns 200 for non-unsubscribe events (e.g. open)", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("open")));
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send("not-valid-json");
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-array JSON body", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ event: "unsubscribe" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 for an empty event array", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify([]));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(0);
  });

  it("returns correct received count for multiple events", async () => {
    const events = [
      ...makeEvent("unsubscribe", "a@example.com"),
      ...makeEvent("spamreport", "b@example.com"),
      ...makeEvent("open", "c@example.com"),
    ];
    const res = await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(events));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(3);
  });

  it("calls addToSendGridGlobalUnsubscribes for unsubscribe events after processing", async () => {
    await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("unsubscribe", "test@example.com")));

    // Allow async processing to complete
    await new Promise((r) => setTimeout(r, 150));
    expect(addToSendGridGlobalUnsubscribes).toHaveBeenCalledWith(["test@example.com"]);
  });

  it("does NOT call addToSendGridGlobalUnsubscribes for open events", async () => {
    await request(buildApp())
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(makeEvent("open", "open@example.com")));

    await new Promise((r) => setTimeout(r, 150));
    expect(addToSendGridGlobalUnsubscribes).not.toHaveBeenCalled();
  });
});
