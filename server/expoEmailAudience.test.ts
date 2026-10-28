import { describe, expect, it } from "vitest";
import {
  EXPO_EMAIL_LISTS,
  getExpoAttendeeListKey,
  getPartnerProgramTags,
  getPartnerRoleTags,
} from "../shared/expoEmailAudience";

describe("Expo email audiences", () => {
  it("defines dedicated attendee and partner lists", () => {
    expect(EXPO_EMAIL_LISTS.ultrasoundExpoAttendees.name).toBe("UltrasoundExpo™ Attendees");
    expect(EXPO_EMAIL_LISTS.echoExpoAttendees.name).toBe("EchoExpo™ Attendees");
    expect(EXPO_EMAIL_LISTS.exhibitorsAndSponsors.name).toContain("Exhibitors & Sponsors");
    expect(getExpoAttendeeListKey("ultrasound_expo")).toBe("ultrasoundExpoAttendees");
    expect(getExpoAttendeeListKey("echo_expo")).toBe("echoExpoAttendees");
  });

  it("tags partner organizations by role and program pathway", () => {
    expect(getPartnerRoleTags(["vendor", "exhibitor", "sponsor"])).toEqual(["Vendor", "Exhibitor", "Sponsor"]);
    expect(getPartnerProgramTags({ requestedScopes: ["aaus_ihe", "ultrasound_expo"], eventFocus: "echo_expo" }))
      .toEqual(["All About Ultrasound™", "EchoExpo™"]);
    expect(getPartnerProgramTags({ requestedScopes: ["ultrasound_expo"], eventFocus: "ultrasound_expo" }))
      .toEqual(["UltrasoundExpo™"]);
    expect(getPartnerProgramTags({
      requestedScopes: ["ultrasound_expo"],
      eventInterests: ["ultrasound_expo", "echo_expo"],
    })).toEqual(["UltrasoundExpo™", "EchoExpo™"]);
  });

  it("wires new Expo applications and registrations into automatic list membership", async () => {
    const [helpers, vendorRouter, stripeWebhook, campaignRouter, migration] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile("server/lib/emailListHelper.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routers/vendorPortalRouter.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/webhooks/stripe.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("server/routers/emailCampaignRouter.ts", "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile("drizzle/0115_expo_email_audience_lists.sql", "utf8")),
    ]);
    expect(helpers).toContain("ensureExpoAudienceLists");
    expect(helpers).toContain("addExpoAttendeeToEmailList");
    expect(helpers).toContain("addExpoPartnerToEmailList");
    expect(helpers).toContain('automationScope: "expo"');
    expect(vendorRouter).toContain("addExpoPartnerToEmailList");
    expect(stripeWebhook).toContain("addExpoAttendeeToEmailList");
    expect(campaignRouter).toContain("ensureExpoAudienceLists");
    expect(migration).toContain("UltrasoundExpo™ Attendees");
    expect(migration).toContain("EchoExpo™ Attendees");
  });
});
