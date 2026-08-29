import { describe, expect, it } from "vitest";
import {
  ALL_USER_QUIZZES_HREF,
  ensureAllUserQuizzesNavigation,
} from "./quizNavigation";

describe("all-user Quizzes navigation", () => {
  it("uses the canonical My Content quizzes deep link", () => {
    expect(ALL_USER_QUIZZES_HREF).toBe("/my-dashboard?tab=content&contentTab=quizzes");
  });

  it("adds Quizzes when a managed header has omitted it", () => {
    const items = ensureAllUserQuizzesNavigation([
      { label: "Education Library", href: "/education-library" },
    ]);

    expect(items).toEqual([
      { label: "Education Library", href: "/education-library" },
      { label: "Quizzes", href: ALL_USER_QUIZZES_HREF },
    ]);
  });

  it("does not duplicate an existing legacy or canonical Quizzes link", () => {
    expect(ensureAllUserQuizzesNavigation([{ label: "Quizzes", href: "/my-dashboard?tab=quizzes" }])).toHaveLength(1);
    expect(ensureAllUserQuizzesNavigation([{ label: "Learning", href: ALL_USER_QUIZZES_HREF }])).toHaveLength(1);
  });
});
