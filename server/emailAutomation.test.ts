import { describe, expect, it } from "vitest";
import {
  EMAIL_AUTOMATION_SCOPES,
  EMAIL_AUTOMATION_TRIGGER_META,
  EMAIL_AUTOMATION_TRIGGERS,
} from "../shared/emailAutomation";

describe("email campaign workflow automations", () => {
  it("separates the Learn, Apps, and Expo workspaces", () => {
    expect(EMAIL_AUTOMATION_SCOPES).toEqual(["learn", "apps", "expo"]);
    expect(EMAIL_AUTOMATION_TRIGGER_META.course_purchase.scopes).toEqual(["learn"]);
    expect(EMAIL_AUTOMATION_TRIGGER_META.expo_registration.scopes).toEqual(["expo"]);
    expect(EMAIL_AUTOMATION_TRIGGER_META.account_signup.scopes).toEqual(["learn", "apps", "expo"]);
  });

  it("defines current-activity triggers for learning, lists, and Expo operations", () => {
    expect(EMAIL_AUTOMATION_TRIGGERS).toEqual(expect.arrayContaining([
      "course_purchase", "course_enrollment", "course_completion", "webinar_registration",
      "workshop_registration", "product_purchase", "list_signup", "expo_registration", "expo_vendor_approved",
    ]));
  });

  it("keeps rules paused by default and makes deliveries durable and deduplicated", async () => {
    const [migration, dispatcher, router, heartbeat] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile("drizzle/0114_email_campaign_automations.sql", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/lib/emailAutomation.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routers/emailCampaignRouter.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routes/emailAutomationHeartbeat.ts", "utf8")),
    ]);
    expect(migration).toContain("is_active BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migration).toContain("UNIQUE KEY email_automation_deliveries_workflow_source_unique");
    expect(dispatcher).toContain("eq(emailAutomationWorkflows.isActive, true)");
    expect(dispatcher).toContain("uniqueSourceKey");
    expect(dispatcher).toContain("processDueEmailAutomationDeliveries");
    expect(router).toContain("assertFullPlatformAdmin");
    expect(heartbeat).toContain("processDueEmailAutomationDeliveries(150)");
  });

  it("connects current platform activity sources without historical backfill", async () => {
    const [account, checkout, completion, lists, expo, approval] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile("server/db.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/lib/lmsCheckoutFulfillment.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routers/lmsRouter.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/lib/emailListHelper.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/webhooks/stripe.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routers/vendorPortalRouter.ts", "utf8")),
    ]);
    expect(account).toContain('type: "account_signup"');
    expect(checkout).toContain('type: "course_purchase"');
    expect(checkout).toContain('type: "course_enrollment"');
    expect(completion).toContain('type: "course_completion"');
    expect(lists).toContain('type: "list_signup"');
    expect(expo).toContain('type: "expo_registration"');
    expect(approval).toContain('type: "expo_vendor_approved"');
  });
});
