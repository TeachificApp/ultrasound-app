import { describe, expect, it } from "vitest";
import { selectCourseFocusRegenerationLessons } from "./lib/courseFocusRegenerationBatch";

describe("course focus regeneration selection", () => {
  const lessons = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  it("keeps course order while selecting administrator-requested lessons", () => {
    expect(selectCourseFocusRegenerationLessons(lessons, [4, 2])).toEqual([{ id: 2 }, { id: 4 }]);
  });

  it("requires valid in-course selections with a maximum of 25 lessons", () => {
    expect(() => selectCourseFocusRegenerationLessons(lessons, [])).toThrow("Select at least one");
    expect(() => selectCourseFocusRegenerationLessons(lessons, [1, 1])).toThrow("only once");
    expect(() => selectCourseFocusRegenerationLessons(lessons, [9])).toThrow("do not belong");
    expect(() => selectCourseFocusRegenerationLessons(Array.from({ length: 26 }, (_, index) => ({ id: index + 1 })), Array.from({ length: 26 }, (_, index) => index + 1))).toThrow("no more than 25");
  });
});
