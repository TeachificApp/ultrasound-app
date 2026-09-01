import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("course participant campaign handoff", () => {
  const lmsAdmin = readFileSync(resolve(import.meta.dirname, "admin/LMSAdmin.tsx"), "utf8");
  const dashboard = readFileSync(resolve(import.meta.dirname, "EmailCampaignDashboard.tsx"), "utf8");
  const editor = readFileSync(resolve(import.meta.dirname, "EmailCampaignEditor.tsx"), "utf8");

  it("opens the existing campaign composer from course settings with a course audience", () => {
    expect(lmsAdmin).toContain("Email course participants");
    expect(lmsAdmin).toContain("/admin/email-campaigns?courseId=${courseId}");
    expect(dashboard).toContain("activeAccessCourseIds: [courseAudienceId]");
    expect(dashboard).toContain('userStatus: "active"');
    expect(editor).toContain("initialAudienceFilter");
  });

  it("states the restricted audience and keeps the final send confirmation", () => {
    expect(editor).toContain("setSendDialogOpen(true)");
  });
});
