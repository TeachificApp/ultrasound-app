import { describe, expect, it } from "vitest";
import { standaloneQuizTypeSchema } from "./routers/standaloneQuizRouter";

describe("standalone quiz type contract", () => {
  it("accepts each database-supported standalone quiz type", () => {
    expect(standaloneQuizTypeSchema.parse("quiz")).toBe("quiz");
    expect(standaloneQuizTypeSchema.parse("mock_exam")).toBe("mock_exam");
    expect(standaloneQuizTypeSchema.parse("flashcards")).toBe("flashcards");
  });

  it("still rejects unsupported standalone quiz types before any database write", () => {
    expect(() => standaloneQuizTypeSchema.parse("survey")).toThrow();
  });

  it("keeps the Flashcards type available to shared standalone-quiz filters", () => {
    const filterInput = standaloneQuizTypeSchema.optional();
    expect(filterInput.parse("flashcards")).toBe("flashcards");
    expect(filterInput.parse(undefined)).toBeUndefined();
  });
});
