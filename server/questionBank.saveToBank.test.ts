import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirror the questionInput schema from questionBankRouter.ts
const questionInput = z.object({
  question: z.string().min(1),
  type: z.enum(["mcq", "truefalse", "multiselect", "hotspot", "matching"]).default("mcq"),
  options: z.array(z.object({
    text: z.string(),
    imageUrl: z.string().optional(),
    videoUrl: z.string().optional(),
  })).optional(),
  correctAnswer: z.string().optional(),
  correctAnswers: z.array(z.number().int()).optional(),
  hotspotMarkers: z.string().optional(),
  matchingPairs: z.string().optional(),
  explanation: z.string().optional(),
  questionImageUrl: z.string().optional(),
  questionVideoUrl: z.string().optional(),
  feedbackImageUrl: z.string().optional(),
  feedbackVideoUrl: z.string().optional(),
  folderId: z.number().int().optional(),
  tagIds: z.array(z.number().int()).optional(),
});

// Simulate the fixed handleSave payload construction
function buildPayload(question: any, selectedTagIds: number[], selectedFolderId: number | null) {
  const qType = question.type ?? "mcq";
  const payload: any = {
    question: question.question,
    type: qType,
    explanation: question.explanation ?? "",
    questionImageUrl: question.imageUrl,
    questionVideoUrl: question.videoUrl,
    feedbackImageUrl: question.feedbackImageUrl,
    feedbackVideoUrl: question.feedbackVideoUrl,
    tagIds: selectedTagIds,
    folderId: selectedFolderId ?? undefined,
  };

  if (qType === "truefalse") {
    payload.options = [{ text: "True" }, { text: "False" }];
    payload.correctAnswer = question.correctAnswer === 0 ? "True" : "False";
  } else if (qType === "multiselect") {
    payload.options = question.options.map((o: string, i: number) => ({
      text: o,
      imageUrl: question.answerImages?.[i],
    }));
    payload.correctAnswers = question.correctAnswers ?? [];
  } else if (qType === "hotspot") {
    payload.options = [];
    payload.hotspotMarkers = JSON.stringify(question.hotspotMarkers ?? []);
    payload.questionImageUrl = question.hotspotImageUrl ?? question.imageUrl;
  } else if (qType === "matching") {
    payload.options = [];
    payload.matchingPairs = JSON.stringify(question.matchingPairs ?? []);
  } else {
    payload.options = question.options.map((o: string, i: number) => ({
      text: o,
      imageUrl: question.answerImages?.[i],
    }));
    payload.correctAnswer = question.options[question.correctAnswer] ?? "";
  }

  return payload;
}

describe("Save to Question Bank payload construction", () => {
  it("MCQ: options is array of objects, not a JSON string", () => {
    const q = { type: "mcq", question: "Test?", options: ["A", "B", "C", "D"], correctAnswer: 1 };
    const payload = buildPayload(q, [], null);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(Array.isArray(payload.options)).toBe(true);
    expect(payload.options[0]).toEqual({ text: "A", imageUrl: undefined });
    expect(payload.correctAnswer).toBe("B");
  });

  it("MCQ: uses 'type' field not 'questionType'", () => {
    const q = { type: "mcq", question: "Test?", options: ["A", "B"], correctAnswer: 0 };
    const payload = buildPayload(q, [], null);
    expect(payload.type).toBe("mcq");
    expect(payload.questionType).toBeUndefined();
  });

  it("True/False: options is array of objects", () => {
    const q = { type: "truefalse", question: "Is this true?", options: [], correctAnswer: 0 };
    const payload = buildPayload(q, [], null);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(Array.isArray(payload.options)).toBe(true);
    expect(payload.options).toEqual([{ text: "True" }, { text: "False" }]);
    expect(payload.correctAnswer).toBe("True");
  });

  it("Multiselect: options is array, correctAnswers is array of numbers", () => {
    const q = { type: "multiselect", question: "Select all?", options: ["A", "B", "C"], correctAnswers: [0, 2] };
    const payload = buildPayload(q, [], null);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(Array.isArray(payload.options)).toBe(true);
    expect(Array.isArray(payload.correctAnswers)).toBe(true);
    expect(payload.correctAnswers).toEqual([0, 2]);
  });

  it("Hotspot: options is empty array, hotspotMarkers is JSON string", () => {
    const q = { type: "hotspot", question: "Click the region", options: [], hotspotMarkers: [{ id: "m1", x: 50, y: 50, label: "Region 1", isCorrect: true }] };
    const payload = buildPayload(q, [], null);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(payload.options).toEqual([]);
    expect(typeof payload.hotspotMarkers).toBe("string");
  });

  it("Matching: options is empty array, matchingPairs is JSON string", () => {
    const q = { type: "matching", question: "Match these", options: [], matchingPairs: [{ id: "p1", left: "A", right: "1" }] };
    const payload = buildPayload(q, [], null);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(payload.options).toEqual([]);
    expect(typeof payload.matchingPairs).toBe("string");
  });

  it("Passes tagIds and folderId correctly", () => {
    const q = { type: "mcq", question: "Test?", options: ["A", "B"], correctAnswer: 0 };
    const payload = buildPayload(q, [1, 2], 5);
    const result = questionInput.safeParse(payload);
    expect(result.success).toBe(true);
    expect(payload.tagIds).toEqual([1, 2]);
    expect(payload.folderId).toBe(5);
  });

  it("folderId is undefined (not null) when no folder selected", () => {
    const q = { type: "mcq", question: "Test?", options: ["A", "B"], correctAnswer: 0 };
    const payload = buildPayload(q, [], null);
    expect(payload.folderId).toBeUndefined();
  });
});
