import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/CoursePlayer.tsx"), "utf8");

describe("Course Player access failure state", () => {
  it("shows a retryable load error before the genuine not-enrolled state", () => {
    const errorState = source.indexOf("if (coursePlayerError)");
    const notEnrolled = source.indexOf("You are not enrolled in this course");

    expect(errorState).toBeGreaterThan(-1);
    expect(notEnrolled).toBeGreaterThan(errorState);
    expect(source).toContain("We could not load your course access");
    expect(source).toContain("Try Again");
    expect(source).toContain("void refetchCoursePlayer()");
  });
});
