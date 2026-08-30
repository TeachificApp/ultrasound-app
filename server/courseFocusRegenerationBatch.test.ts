import { describe, expect, it } from "vitest";
import { getCourseFocusRegenerationBatch } from "./lib/courseFocusRegenerationBatch";

describe("course focus regeneration batches", () => {
  it("uses rate-safe five-lesson batches and reports the next offset", () => {
    expect(getCourseFocusRegenerationBatch(12)).toEqual({ offset: 0, end: 5, count: 5, nextOffset: 5 });
    expect(getCourseFocusRegenerationBatch(12, 5)).toEqual({ offset: 5, end: 10, count: 5, nextOffset: 10 });
    expect(getCourseFocusRegenerationBatch(12, 10)).toEqual({ offset: 10, end: 12, count: 2, nextOffset: null });
  });

  it("rejects offsets beyond the available course lessons", () => {
    expect(() => getCourseFocusRegenerationBatch(3, 3)).toThrow("No lessons remain");
  });
});
