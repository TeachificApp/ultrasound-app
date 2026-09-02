import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gradeImageLabelingAnswer, isCompleteImageLabelingAnswer } from "../shared/imageLabeling";
import { gradeBuilderAnswer } from "./lib/gradeBuilderQuestion";

const targets = [
  { id: "target-a", labelId: "label-a" },
  { id: "target-b", labelId: "label-b" },
];

describe("native image-labeling questions", () => {
  it("requires every image target to receive a label and grades an exact label-to-target mapping", () => {
    const correct = { "target-a": "label-a", "target-b": "label-b" };
    expect(isCompleteImageLabelingAnswer(targets, correct)).toBe(true);
    expect(gradeImageLabelingAnswer(targets, correct)).toBe(true);
    expect(gradeBuilderAnswer({ id: "label-question", type: "image_labeling", points: 2, data: { targets } }, JSON.stringify(correct))).toBe(true);
  });

  it("rejects incomplete and swapped label assignments", () => {
    expect(isCompleteImageLabelingAnswer(targets, { "target-a": "label-a" })).toBe(false);
    expect(gradeImageLabelingAnswer(targets, { "target-a": "label-b", "target-b": "label-a" })).toBe(false);
    expect(gradeBuilderAnswer({ id: "label-question", type: "image_labeling", points: 2, data: { targets } }, JSON.stringify({ "target-a": "label-a" }))).toBe(false);
  });

  it("retains the existing native matching grading behavior", () => {
    expect(gradeBuilderAnswer(
      { id: "matching-question", type: "matching", points: 1, data: { pairs: [{ id: "a" }, { id: "b" }] } },
      JSON.stringify({ a: "a", b: "b" }),
    )).toBe(true);
  });

  it("exposes accessible authoring and learner interaction paths without changing the hotspot editor", () => {
    const creator = readFileSync(resolve(import.meta.dirname, "../client/src/quiz-creator/components/QuestionEditor.tsx"), "utf8");
    const picker = readFileSync(resolve(import.meta.dirname, "../client/src/quiz-creator/components/QuestionList.tsx"), "utf8");
    const player = readFileSync(resolve(import.meta.dirname, "../client/src/pages/StandaloneQuizPlayer.tsx"), "utf8");
    const editor = readFileSync(resolve(import.meta.dirname, "../client/src/quiz-creator/components/editors/ImageLabelingEditor.tsx"), "utf8");
    const interaction = readFileSync(resolve(import.meta.dirname, "../client/src/quiz-creator/components/ImageLabelingInteraction.tsx"), "utf8");

    expect(picker).toContain('image_labeling: "Image Labeling"');
    expect(creator).toContain('<ImageLabelingEditor');
    expect(editor).toContain('aria-label="Image-labeling question setup"');
    expect(editor).toContain('Add a question image using the <strong>Image</strong> control above');
    expect(player).toContain('<ImageLabelingInteraction');
    expect(player).toContain('isCompleteImageLabelingAnswer');
    expect(interaction).toContain('labelsUsedAtOtherTargets');
    expect(interaction).toContain('disabled={labelsUsedAtOtherTargets.has(label.id)}');
    expect(creator).toContain('<HotspotEditor');
  });
});
