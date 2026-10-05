import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getCampaignDeliveryEventType } from "./webhooks/sendgrid";

describe("SendGrid campaign delivery webhook normalization", () => {
  it("keeps delivery events distinct from engagement events", () => {
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "delivered", timestamp: 1 })).toBe("delivered");
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "deferred", timestamp: 1 })).toBe("deferred");
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "dropped", timestamp: 1 })).toBe("dropped");
  });

  it("maps SendGrid soft bounces to blocked and preserves hard bounces", () => {
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "bounce", type: "blocked", timestamp: 1 })).toBe("blocked");
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "bounce", type: "bounce", timestamp: 1 })).toBe("bounce");
  });

  it("does not treat first-party open and click webhook traffic as delivery outcomes", () => {
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "open", timestamp: 1 })).toBeNull();
    expect(getCampaignDeliveryEventType({ email: "learner@example.com", event: "click", timestamp: 1 })).toBeNull();
  });

  it("registers the raw-body SendGrid webhook before global JSON parsing", () => {
    const startup = fs.readFileSync(path.resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(startup.indexOf("registerSendGridWebhook(app);")).toBeGreaterThan(-1);
    expect(startup.indexOf("registerSendGridWebhook(app);")).toBeLessThan(startup.indexOf("app.use(express.json"));
  });
});
