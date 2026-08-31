import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("InlineLessonQuiz CME survey controls", () => {
  const source = readFileSync(resolve(import.meta.dirname, "CoursePlayer.tsx"), "utf8");

  it("records survey responses and renders survey choices without graded feedback", () => {
    expect(source).toContain('qType === "survey_choice"');
    expect(source).toContain('responses,');
    expect(source).toContain('"likert", "star_rating", "open_text", "survey_choice"');
    expect(source).toContain('✓ Recorded');
  });

  it("requires a response for template questions marked required", () => {
    expect(source).toContain('q.required === true');
    expect(source).toContain('A response is required');
  });
});
