import { describe, expect, it } from "vitest";
import {
  buildQuizCoursePlayerUrl,
  buildStudentDashboardUrl,
  normalizeLegacyStudentDashboardLocation,
  resolveStudentDashboardHref,
} from "../shared/studentDashboardUrls";

describe("student dashboard URLs", () => {
  it("builds my-dashboard content deep links", () => {
    expect(buildStudentDashboardUrl({ contentTab: "quizzes" }))
      .toBe("https://app.allaboutultrasound.com/my-dashboard?tab=content&contentTab=quizzes");
    expect(buildStudentDashboardUrl({ origin: "relative", tab: "profile" }))
      .toBe("/my-dashboard?tab=profile");
  });

  it("builds learn-domain quiz player links", () => {
    expect(buildQuizCoursePlayerUrl("rphs-venous"))
      .toBe("https://learn.allaboutultrasound.com/courses/rphs-venous/player");
  });

  it("normalizes legacy dashboard/my-content links", () => {
    expect(normalizeLegacyStudentDashboardLocation("/dashboard/my-content", "tab=quizzes"))
      .toBe("/my-dashboard?tab=content&contentTab=quizzes");
    expect(normalizeLegacyStudentDashboardLocation("/my-dashboard/my-content", "tab=webinars"))
      .toBe("/my-dashboard?tab=content&contentTab=webinars");
  });

  it("maps legacy content tab aliases on /my-dashboard", () => {
    expect(normalizeLegacyStudentDashboardLocation("/my-dashboard", "tab=quizzes"))
      .toBe("/my-dashboard?tab=content&contentTab=quizzes");
  });

  it("redirects bare /dashboard to my-dashboard content tab", () => {
    expect(normalizeLegacyStudentDashboardLocation("/dashboard", ""))
      .toBe("/my-dashboard?tab=content");
    expect(normalizeLegacyStudentDashboardLocation("/dashboard", "tab=subscriptions"))
      .toBe("/my-dashboard?tab=subscriptions");
  });

  it("redirects /dashboard/subscriptions to subscriptions tab", () => {
    expect(normalizeLegacyStudentDashboardLocation("/dashboard/subscriptions", ""))
      .toBe("/my-dashboard?tab=subscriptions");
  });

  it("resolveStudentDashboardHref maps relative and learn-domain absolute links", () => {
    expect(resolveStudentDashboardHref("/dashboard")).toBe("/my-dashboard?tab=content");
    expect(resolveStudentDashboardHref("https://learn.allaboutultrasound.com/dashboard"))
      .toBe("https://learn.allaboutultrasound.com/my-dashboard?tab=content");
    expect(resolveStudentDashboardHref("/courses/foo/player")).toBe("/courses/foo/player");
  });
});
