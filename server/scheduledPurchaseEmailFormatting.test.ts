import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCurrentCohortGroupSchedule } from "./lib/cohortEmailSchedule";
import { renderCurrentWebinarSchedule } from "./lib/webinarEmailSchedule";

describe("scheduled purchase email formatting", () => {
  it("renders the current webinar schedule, duration, time zone, and live-access guidance", () => {
    const html = renderCurrentWebinarSchedule({
      scheduledAt: new Date("2026-10-15T15:00:00.000Z"),
      durationMinutes: 90,
      timezone: "America/New_York",
      type: "live",
      meetingUrl: "https://example.test/live-session",
    });

    expect(html).toContain("When:");
    expect(html).toContain("Thursday, October 15, 2026");
    expect(html).toContain("11:00 AM EDT");
    expect(html).toContain("12:30 PM EDT");
    expect(html).toContain("Live access:");
    expect(html).toContain("session details are available from your webinar page");
  });

  it("renders the exact selected cohort group with its current date range and location", () => {
    const html = renderCurrentCohortGroupSchedule({
      name: "Fall Clinical Cohort",
      startDate: new Date("2026-10-15T15:00:00.000Z"),
      endDate: new Date("2026-10-17T15:00:00.000Z"),
      location: "Virtual / Online",
    });

    expect(html).toContain("Cohort group:");
    expect(html).toContain("Fall Clinical Cohort");
    expect(html).toContain("Dates:");
    expect(html).toContain("Thursday, October 15, 2026");
    expect(html).toContain("Saturday, October 17, 2026");
    expect(html).toContain("Location:");
    expect(html).toContain("Virtual / Online");
  });

  it("uses the same schedule renderers in delivery and safe admin previews", () => {
    const preview = readFileSync("server/lib/purchaseEmailPreview.ts", "utf8");
    const webinarDelivery = readFileSync("server/webhooks/stripe.ts", "utf8");
    const cohortDelivery = readFileSync("server/lib/lmsCheckoutFulfillment.ts", "utf8");
    const editor = readFileSync("client/src/components/admin/PurchaseEmailOverrides.tsx", "utf8");

    expect(preview).toContain('input.source === "webinar"');
    expect(preview).toContain("renderCurrentWebinarSchedule(webinar)");
    expect(webinarDelivery).toContain("renderCurrentWebinarSchedule(webinar)");
    expect(preview).toContain('input.source === "cohort_group"');
    expect(preview).toContain("renderCurrentCohortGroupSchedule(group)");
    expect(cohortDelivery).toContain("renderCurrentCohortGroupSchedule(cohortGroupForPurchaseEmail)");
    expect(editor).toContain('id="cohort-email-preview-group"');
    expect(editor).toContain("Cohort group for preview");
  });
});
