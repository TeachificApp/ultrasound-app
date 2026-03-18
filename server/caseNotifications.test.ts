/**
 * Case notification email template tests
 * Validates that buildCaseApprovedEmail and buildCaseRejectedEmail produce
 * correct subjects, preview text, and HTML content without making real API calls.
 */
import { describe, it, expect } from "vitest";
import { buildCaseApprovedEmail, buildCaseRejectedEmail, buildNewCaseSubmissionAdminEmail } from "./_core/email";

describe("buildCaseApprovedEmail", () => {
  const opts = {
    firstName: "Sarah",
    caseTitle: "Severe AS with Low-Flow Low-Gradient Pattern",
    caseUrl: "https://app.iheartecho.com/case-library/42",
  };

  it("should return a subject containing the case title", () => {
    const { subject } = buildCaseApprovedEmail(opts);
    expect(subject).toContain(opts.caseTitle);
  });

  it("should return a subject indicating approval", () => {
    const { subject } = buildCaseApprovedEmail(opts);
    expect(subject.toLowerCase()).toContain("approved");
  });

  it("should include the user's first name in the HTML body", () => {
    const { htmlBody } = buildCaseApprovedEmail(opts);
    expect(htmlBody).toContain(opts.firstName);
  });

  it("should include the case title in the HTML body", () => {
    const { htmlBody } = buildCaseApprovedEmail(opts);
    expect(htmlBody).toContain(opts.caseTitle);
  });

  it("should include a link to the case URL in the HTML body", () => {
    const { htmlBody } = buildCaseApprovedEmail(opts);
    expect(htmlBody).toContain(opts.caseUrl);
  });

  it("should include a non-empty previewText", () => {
    const { previewText } = buildCaseApprovedEmail(opts);
    expect(previewText.length).toBeGreaterThan(10);
  });

  it("should produce valid HTML with doctype", () => {
    const { htmlBody } = buildCaseApprovedEmail(opts);
    expect(htmlBody.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("should include iHeartEcho™ branding in the HTML body", () => {
    const { htmlBody } = buildCaseApprovedEmail(opts);
    expect(htmlBody).toContain("iHeartEcho™");
  });
});

describe("buildCaseRejectedEmail", () => {
  const opts = {
    firstName: "James",
    caseTitle: "Dilated Cardiomyopathy with Reduced EF",
    reason: "The submitted images do not clearly demonstrate the described findings. Please resubmit with higher quality clips.",
    submitUrl: "https://app.iheartecho.com/case-library/submit",
  };

  it("should return a subject containing the case title", () => {
    const { subject } = buildCaseRejectedEmail(opts);
    expect(subject).toContain(opts.caseTitle);
  });

  it("should include the user's first name in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain(opts.firstName);
  });

  it("should include the case title in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain(opts.caseTitle);
  });

  it("should include the rejection reason in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain(opts.reason);
  });

  it("should include a link to the submit URL in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain(opts.submitUrl);
  });

  it("should include a HIPAA reminder in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody.toLowerCase()).toContain("hipaa");
  });

  it("should include a non-empty previewText", () => {
    const { previewText } = buildCaseRejectedEmail(opts);
    expect(previewText.length).toBeGreaterThan(10);
  });

  it("should produce valid HTML with doctype", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("should include iHeartEcho™ branding in the HTML body", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain("iHeartEcho™");
  });

  it("should include a support contact email", () => {
    const { htmlBody } = buildCaseRejectedEmail(opts);
    expect(htmlBody).toContain("support@iheartecho.com");
  });
});

describe("buildNewCaseSubmissionAdminEmail", () => {
  const opts = {
    submitterName: "Dr. Emily Chen",
    caseTitle: "Hypertrophic Cardiomyopathy with LVOTO",
    modality: "TTE",
    difficulty: "advanced",
    adminUrl: "https://app.iheartecho.com/admin/cases",
  };

  it("should return a subject containing the case title", () => {
    const { subject } = buildNewCaseSubmissionAdminEmail(opts);
    expect(subject).toContain(opts.caseTitle);
  });

  it("should indicate the case is pending review in the subject", () => {
    const { subject } = buildNewCaseSubmissionAdminEmail(opts);
    expect(subject.toLowerCase()).toContain("pending review");
  });

  it("should include the submitter name in the HTML body", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain(opts.submitterName);
  });

  it("should include the case title in the HTML body", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain(opts.caseTitle);
  });

  it("should include the modality in the HTML body", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain(opts.modality);
  });

  it("should include the difficulty label in the HTML body", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain("Advanced");
  });

  it("should include a link to the admin case management URL", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain(opts.adminUrl);
  });

  it("should include a non-empty previewText with the submitter name", () => {
    const { previewText } = buildNewCaseSubmissionAdminEmail(opts);
    expect(previewText).toContain(opts.submitterName);
    expect(previewText.length).toBeGreaterThan(10);
  });

  it("should produce valid HTML with doctype", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody.trim().toLowerCase()).toMatch(/^<!doctype html>/);
  });

  it("should mention HIPAA acknowledgement in the HTML body", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody.toLowerCase()).toContain("hipaa");
  });

  it("should include iHeartEcho™ branding", () => {
    const { htmlBody } = buildNewCaseSubmissionAdminEmail(opts);
    expect(htmlBody).toContain("iHeartEcho™");
  });
});
