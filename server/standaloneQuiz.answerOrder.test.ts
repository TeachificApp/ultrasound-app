import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { orderQuestionOptions } from "./lib/questionOptionOrder";

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

  it("uses the shared question-specific ordering behavior in standalone and builder delivery", () => {
    const routerSource = fs.readFileSync(path.resolve(process.cwd(), "server/routers/standaloneQuizRouter.ts"), "utf8");
    const schemaSource = fs.readFileSync(path.resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const builderPayloadSource = fs.readFileSync(path.resolve(process.cwd(), "server/lib/gradeBuilderQuestion.ts"), "utf8");

    expect(schemaSource).toContain('shuffleAnswerOptions: boolean("shuffle_answer_options").default(false).notNull()');
    expect(routerSource).toContain("options = orderQuestionOptions(options, q.sqq.shuffleAnswerOptions);");
    expect(routerSource).toContain("updateQuestionAnswerOrder");
    expect(builderPayloadSource).toContain("orderQuestionOptions(dataWithChoices.choices, true)");
    expect(builderPayloadSource).toContain("data: playerData");
  });
});
