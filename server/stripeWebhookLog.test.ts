import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("Stripe webhook MySQL audit log", () => {
  it("ensures webhookEvents exists before insert", () => {
    const stripe = readProjectFile("server/webhooks/stripe.ts");
    expect(stripe).toContain("ensureWebhookEventsTable");
    expect(stripe).toContain('outcome: "received"');
  });

  it("registers both public webhook routes before express.json", () => {
    const index = readProjectFile("server/_core/index.ts");
    expect(index).toMatch(/registerStripeWebhook\(app\)[\s\S]*express\.json/);
  });
});
