import { describe, expect, it } from "vitest";
import { convertDocumentToQuiz, normalizeISpringDocument } from "../shared/ispringDocumentToQuiz";

describe("ispringDocumentToQuiz", () => {
  it("preserves groups, media, and SCORM-style question feedback", () => {
    const quiz = convertDocumentToQuiz(
      {
        d: {
          T: "Echo Review",
          ps: 80,
          rnd: true,
          sl: {
            g: [
              {
                i: "g1",
                T: "Anatomy",
                S: [
                  {
                    i: "q1",
                    tp: "MultipleChoice",
                    D: { h: "<p>Identify the valve</p>", d: ["Identify the valve"] },
                    C: {
                      chs: [
                        { t: { h: "Mitral", d: ["Mitral"] }, c: true, F: { v: { h: "<p>Correct!</p>" } } },
                        { t: { h: "Aortic", d: ["Aortic"] }, c: false },
                      ],
                    },
                    s: {
                      F: {
                        c: { v: { h: "<p>Well done</p>", d: ["Well done"] } },
                        ic: { v: { h: "<p>Try again</p>", d: ["Try again"] } },
                      },
                      af: 0,
                    },
                    br: { c: 1, ic: 2 },
                  },
                ],
              },
            ],
          },
        },
      },
      new Map([["media/valve.png", "https://cdn.example/valve.png"]]),
      [],
    );

    expect(quiz.meta.title).toBe("Echo Review");
    expect(quiz.meta.passingScore).toBe(80);
    expect(quiz.meta.shuffleQuestions).toBe(true);
    expect((quiz.meta.groups as Array<{ name: string }>)?.[0]?.name).toBe("Anatomy");
    expect(quiz.questions).toHaveLength(1);
    const q = quiz.questions[0] as Record<string, unknown>;
    expect(q.feedback).toEqual({ correct: "Well done", incorrect: "Try again", partial: undefined });
    expect(q.feedbackMode).toBe("question");
    expect(Array.isArray(q.branchRules)).toBe(true);
    expect((q.branchRules as unknown[]).length).toBeGreaterThan(0);
  });

  it("normalizes SCORM blob wrapper", () => {
    const doc = normalizeISpringDocument({ d: { T: "Wrapped Quiz", ps: 65 } });
    expect(doc.title).toBe("Wrapped Quiz");
    expect(doc.passingScore).toBe(65);
  });

  it("includes per-choice feedback for MCQ imports", () => {
    const quiz = convertDocumentToQuiz(
      {
        sl: {
          g: [
            {
              S: [
                {
                  tp: "mc",
                  D: "Pick one",
                  C: {
                    chs: [
                      { t: "A", c: true, fb: { correct: "Nice" } },
                      { t: "B", c: false },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      new Map(),
      [],
    );
    const data = (quiz.questions[0] as { data: { choices: Array<{ feedback?: string }> } }).data;
    expect(data.choices[0]?.feedback).toBe("Nice");
  });
});
