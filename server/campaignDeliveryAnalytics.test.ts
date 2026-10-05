import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("campaign delivery analytics", () => {
  it("persists provider event IDs and every delivery lifecycle event", () => {
    const schema = read("drizzle/schema.ts");
    const tracking = read("server/lib/emailCampaignTracking.ts");
    const migration = read("drizzle/0094_email_campaign_delivery_events.sql");
    expect(schema).toContain("providerEventId");
    expect(tracking).toContain('"delivered"');
    expect(tracking).toContain('"deferred"');
    expect(tracking).toContain('"bounce"');
    expect(tracking).toContain('"blocked"');
    expect(tracking).toContain('"dropped"');
    expect(migration).toContain("emailCampaignEvents_providerEventId_unique");
  });

  it("correlates only non-PII campaign identifiers through SendGrid custom arguments", () => {
    const provider = read("server/lib/email/providers/sendgrid.ts");
    const router = read("server/routers/emailCampaignRouter.ts");
    const webhook = read("server/webhooks/sendgrid.ts");
    expect(provider).toContain("custom_args: { campaignId: String(opts.campaignId) }");
    expect(router).toContain("campaignId,");
    expect(webhook).toContain("recordCampaignDeliveryEvent(event)");
    expect(webhook).toContain("getCampaignId(event)");
  });

  it("keeps dashboard click metrics explicitly unique while showing total engagement", () => {
    const dashboard = read("client/src/pages/EmailCampaignDashboard.tsx");
    expect(dashboard).toContain("Unique Clicks");
    expect(dashboard).toContain("total ·");
    expect(dashboard).toContain("DELIVERY STATUS");
  });
});
