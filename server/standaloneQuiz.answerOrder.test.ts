import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildStandaloneLearnerOptions, orderQuestionOptions, shouldShuffleQuestionOptions } from "./lib/questionOptionOrder";
import { builderQuestionToPlayerPayload } from "./lib/gradeBuilderQuestion";

describe("standalone quiz per-question answer order", () => {
  it("preserves authored order when a question disables shuffling", () => {
    const authored = ["A", "B", "C", "D"];
    expect(orderQuestionOptions(authored, false, () => 0)).toEqual(authored);
    expect(orderQuestionOptions(authored, false, () => 0)).not.toBe(authored);
  });

  it("randomizes option order only when a question enables it", () => {
    const authored = ["A", "B", "C", "D"];
    expect(orderQuestionOptions(authored, true, () => 0)).toEqual(["B", "C", "D", "A"]);
  });

  it("uses the quiz default unless the individual question preserves authored order", () => {
    expect(shouldShuffleQuestionOptions({ quizDefault: true })).toBe(true);
    expect(shouldShuffleQuestionOptions({ quizDefault: true, lockAnswerOrder: true })).toBe(false);
    expect(shouldShuffleQuestionOptions({ quizDefault: false, questionSetting: true })).toBe(true);
    expect(shouldShuffleQuestionOptions({ quizDefault: false, questionSetting: false })).toBe(false);
  });

  it("orders the actual builder learner payload using the quiz default and preserve-order override", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const question = {
      id: "question-1", type: "mcq", order: 1, points: 1, stem: "Question", data: {
        choices: [
          { id: "a", text: "A", correct: true },
          { id: "b", text: "B", correct: false },
          { id: "c", text: "C", correct: false },
        ],
      },
    } as any;
    const defaultShuffle = builderQuestionToPlayerPayload(question, true, true);
    const preserveOrder = builderQuestionToPlayerPayload({ ...question, lockAnswerOrder: true }, true, true);
    expect((defaultShuffle.data as any).choices.map((choice: any) => choice.id)).toEqual(["b", "c", "a"]);
    expect((preserveOrder.data as any).choices.map((choice: any) => choice.id)).toEqual(["a", "b", "c"]);
    random.mockRestore();
  });

  it("uses the same runtime ordering decision for standalone learner choices", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const authored = ["A", "B", "C"];
    const defaultOrder = buildStandaloneLearnerOptions({ options: authored, quizShuffleAnswers: true });
    const lockedOrder = buildStandaloneLearnerOptions({ options: authored, quizShuffleAnswers: true, lockAnswerOrder: true });
    expect(defaultOrder).toEqual(["B", "C", "A"]);
    expect(lockedOrder).toEqual(authored);
    random.mockRestore();
  });

  it("uses a quiz default while preserving explicit per-question order overrides", () => {
    const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers/standaloneQuizRouter.ts"), "utf8");
    const schemaSource = fs.readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const builderPayloadSource = fs.readFileSync(path.resolve(process.cwd(), "server/lib/gradeBuilderQuestion.ts"), "utf8");

    expect(schemaSource).toContain('shuffleAnswerOptions: boolean("shuffle_answer_options").default(false).notNull()');
    expect(schemaSource).toContain('lockAnswerOrder: boolean("lock_answer_order")');
    expect(routerSource).toContain("Boolean(builderConfig.meta.shuffleAnswers)");
    expect(routerSource).toContain("buildStandaloneLearnerOptions({");
    expect(builderPayloadSource).toContain("shouldShuffleQuestionOptions({ quizDefault: quizShuffleAnswers");
    expect(builderPayloadSource).toContain("orderQuestionOptions(dataWithChoices.choices, true)");
    expect(builderPayloadSource).toContain("data: playerData");
  });
});
