import { describe, expect, it } from "vitest";
import { formatConversionError } from "./uploadLessonDocument";

describe("formatConversionError", () => {
  it("maps invalid JSON proxy responses to a readable upload error", () => {
    expect(formatConversionError(new Error('Unexpected token "<", "<!DOCTYPE "... is not valid JSON'))).toContain("too large");
  });

  it("passes through normal conversion errors", () => {
    expect(formatConversionError(new Error("The PowerPoint does not contain any readable slides."))).toBe(
      "The PowerPoint does not contain any readable slides.",
    );
  });
});
