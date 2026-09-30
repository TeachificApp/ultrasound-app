import { describe, expect, it } from "vitest";
import { getEmailCampaignErrorMessage } from "./emailCampaignErrorMessage";

describe("getEmailCampaignErrorMessage", () => {
  it("replaces raw Zod subject payloads with a clear campaign instruction", () => {
    const rawSubjectError = JSON.stringify([{
      code: "too_small",
      minimum: 1,
      type: "string",
      message: "String must contain at least 1 character(s)",
      path: ["subject"],
    }]);

    expect(getEmailCampaignErrorMessage({ message: rawSubjectError }, "Unable to send test email.")).toBe(
      "Enter a subject line before sending this campaign.",
    );
  });

  it("provides specific guidance for email recipient and scheduling fields", () => {
    expect(getEmailCampaignErrorMessage({
      data: { zodError: { issues: [{ path: ["toEmail"] }] } },
    }, "Unable to send test email.")).toBe(
      "Enter a valid recipient email address before sending the test email.",
    );

    expect(getEmailCampaignErrorMessage({
      data: { zodError: { issues: [{ path: ["scheduledAt"] }] } },
    }, "Unable to schedule campaign.")).toBe(
      "Choose a valid future date and time before scheduling this campaign.",
    );
  });

  it("retains safe server explanations and never displays raw validation JSON", () => {
    expect(getEmailCampaignErrorMessage({ message: "SMTP provider is unavailable." }, "Unable to send test email.")).toBe(
      "SMTP provider is unavailable.",
    );
    expect(getEmailCampaignErrorMessage({ message: "[{not valid JSON" }, "Unable to send test email.")).toBe(
      "Unable to send test email.",
    );
  });
});
