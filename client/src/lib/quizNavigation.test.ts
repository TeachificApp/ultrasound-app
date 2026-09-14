import { describe, expect, it } from "vitest";
import {
  ALL_USER_QUIZZES_HREF,
  removeQuizNavigationItems,
} from "./quizNavigation";

describe("all-user Quizzes navigation", () => {
  it("uses the canonical My Content quizzes deep link", () => {
    expect(ALL_USER_QUIZZES_HREF).toBe("/my-dashboard?tab=content&contentTab=quizzes");
  });

  it("does not add Quizzes when a managed header has omitted it", () => {
    const items = removeQuizNavigationItems([
      { label: "Education Library", href: "/education-library" },
    ]);

    expect(items).toEqual([
      { label: "Education Library", href: "/education-library" },
    ]);
  });

  it("removes top/profile quiz and results destinations while retaining unrelated items", () => {
    expect(removeQuizNavigationItems([
      { label: "Quizzes", href: "/my-dashboard?tab=quizzes" },
      { label: "My Quiz Results", href: "/my-quizzes" },
      { label: "Learning", href: ALL_USER_QUIZZES_HREF },
      { label: "Community", href: "/community/all-about-ultrasound" },
    ])).toEqual([
      { label: "Community", href: "/community/all-about-ultrasound" },
    ]);
  });
});
