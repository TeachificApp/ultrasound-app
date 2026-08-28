import { describe, expect, it } from "vitest";
import {
  buildQuizCoursePlayerUrl,
  buildStudentDashboardUrl,
  normalizeLegacyStudentDashboardLocation,
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
});
