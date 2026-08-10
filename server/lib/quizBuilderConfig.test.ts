import { describe, it, expect } from "vitest";
import {
  parseBuilderConfig,
  drawQuestionsFromBuilder,
  defaultBrandingForBrand,
  serializeBuilderConfig,
} from "./quizBuilderConfig";
import { gradeBuilderAnswer, stableBuilderQuestionId } from "./gradeBuilderQuestion";

describe("quizBuilderConfig", () => {
  it("parses valid builder config", () => {
    const config = {
      meta: { id: "1", title: "Test", questions: [] },
      questions: [{ id: "q1", stem: "Q?" }],
    };
    const parsed = parseBuilderConfig(JSON.stringify(config));
    expect(parsed?.meta.title).toBe("Test");
    expect(parsed?.questions).toHaveLength(1);
  });

  it("returns null for invalid JSON", () => {
    expect(parseBuilderConfig("not json")).toBeNull();
  });

  it("provides site brand defaults", () => {
    const branding = defaultBrandingForBrand("aaus");
    expect(branding.primaryColor).toBe("#24abbc");
  });

  it("draws questions per group config", () => {
    const config = {
      meta: {
        id: "1",
        title: "T",
        shuffleQuestions: false,
        drawConfig: {
          enabled: true,
          totalQuestions: 2,
          groupDraws: [{ groupId: "g1", drawCount: 1 }],
          ungroupedDrawCount: 0,
        },
      },
      questions: [
        { id: "q1", groupId: "g1", points: 1 },
        { id: "q2", groupId: "g1", points: 1 },
        { id: "q3", points: 1 },
      ],
    };
    const drawn = drawQuestionsFromBuilder(config as any);
    expect(drawn).toHaveLength(1);
    expect((drawn[0] as { groupId: string }).groupId).toBe("g1");
  });

  it("round-trips serialize", () => {
    const config = { meta: { id: "1", title: "T" }, questions: [] };
    const raw = serializeBuilderConfig(config as any);
    expect(parseBuilderConfig(raw)?.meta.title).toBe("T");
  });
});

describe("gradeBuilderQuestion", () => {
  it("grades MCQ correctly", () => {
    const q = {
      id: "q1",
      type: "mcq",
      points: 1,
      data: {
        choices: [
          { id: "a", text: "A", correct: true },
          { id: "b", text: "B", correct: false },
        ],
        multiSelect: false,
      },
    };
    expect(gradeBuilderAnswer(q, JSON.stringify(["a"]))).toBe(true);
    expect(gradeBuilderAnswer(q, JSON.stringify(["b"]))).toBe(false);
  });

  it("produces stable question IDs", () => {
    expect(stableBuilderQuestionId("abc")).toBe(stableBuilderQuestionId("abc"));
    expect(stableBuilderQuestionId("abc")).not.toBe(stableBuilderQuestionId("xyz"));
  });
});
