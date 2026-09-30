import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMPAIGN_TEST_SUBJECT,
  resolveCampaignTestSubject,
} from "./emailCampaignTestSubject";

describe("resolveCampaignTestSubject", () => {
  it("uses the authored campaign subject when it is present", () => {
    expect(resolveCampaignTestSubject("  Upcoming Fetal Echo Workshop  ")).toBe(
      "Upcoming Fetal Echo Workshop",
    );
  });

  it("provides a deliverable preview subject for blank, unsaved campaigns", () => {
    expect(resolveCampaignTestSubject("")).toBe(DEFAULT_CAMPAIGN_TEST_SUBJECT);
    expect(resolveCampaignTestSubject("   ")).toBe(DEFAULT_CAMPAIGN_TEST_SUBJECT);
    expect(resolveCampaignTestSubject()).toBe(DEFAULT_CAMPAIGN_TEST_SUBJECT);
  });
});
