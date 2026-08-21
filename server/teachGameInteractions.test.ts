import { describe, expect, it } from "vitest";
import { aggregateWordCloud, evaluateTeachResponse } from "./lib/teachGameInteractions";

describe("Teach live game interactions", () => {
  it("scores a point-and-click hotspot only inside its configured target region", () => {
    const interactionConfig = JSON.stringify({ targetRegions: [{ x: 35, y: 20, width: 30, height: 40 }] });
    expect(evaluateTeachResponse({ interactionType: "hotspot", selectedAnswer: -1, correctAnswer: -1, interactionConfig, responsePayload: { hotspot: { x: 50, y: 40 } } })).toBe(true);
    expect(evaluateTeachResponse({ interactionType: "hotspot", selectedAnswer: -1, correctAnswer: -1, interactionConfig, responsePayload: { hotspot: { x: 10, y: 40 } } })).toBe(false);
  });

  it("scores a puzzle only when its submitted order matches the teacher configuration", () => {
    const interactionConfig = JSON.stringify({ correctOrder: ["Acquire", "Optimise", "Document"] });
    expect(evaluateTeachResponse({ interactionType: "puzzle", selectedAnswer: -1, correctAnswer: -1, interactionConfig, responsePayload: { order: ["Acquire", "Optimise", "Document"] } })).toBe(true);
    expect(evaluateTeachResponse({ interactionType: "puzzle", selectedAnswer: -1, correctAnswer: -1, interactionConfig, responsePayload: { order: ["Optimise", "Acquire", "Document"] } })).toBe(false);
  });

  it("accepts word-cloud participation without assigning correctness", () => {
    expect(evaluateTeachResponse({ interactionType: "word_cloud", selectedAnswer: -1, correctAnswer: -1, responsePayload: { words: ["mitral"] } })).toBe(false);
  });

  it("aggregates safe group words without retaining participant identifiers", () => {
    expect(aggregateWordCloud([{ words: ["Mitral", "valve"] }, { words: ["mitral", "A!"] }])).toEqual([
      { word: "mitral", count: 2 },
      { word: "valve", count: 1 },
    ]);
  });
});
