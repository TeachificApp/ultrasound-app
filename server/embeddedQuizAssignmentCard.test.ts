import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmbeddedQuizAssignmentCard } from "../client/src/components/quiz/EmbeddedQuizAssignmentCard";

describe("EmbeddedQuizAssignmentCard", () => {
  it("renders current linked lesson data and access-controlled HTML-widget guidance", () => {
    const html = renderToStaticMarkup(createElement(EmbeddedQuizAssignmentCard, {
        assignments: [{
          lessonId: 42,
          lessonTitle: "Module assessment",
          courseId: 9,
          courseTitle: "Adult Echo",
          previewMode: "none",
        }],
        widgetSrc: "https://learn.allaboutultrasound.com/quizzes/30001?embed=1",
        onManageAssignments: vi.fn(),
        onOpenCourse: vi.fn(),
        onCopyWidget: vi.fn(),
      }));

    expect(html).toContain("Assigned learning experiences");
    expect(html).toContain("Adult Echo");
    expect(html).toContain("Module assessment");
    expect(html).toContain("Enrolled learners");
    expect(html).toContain("HTML widget embed");
    expect(html).toContain("Learners must sign in and have access through an assigned learning experience.");
    expect(html).toContain("https://learn.allaboutultrasound.com/quizzes/30001?embed=1");
  });
});
