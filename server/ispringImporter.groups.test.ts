import { describe, expect, it } from "vitest";
import { convertDocumentToQuiz } from "../client/src/quiz-creator/lib/ispringImporter";

describe("iSpring Visual Builder import", () => {
  it("preserves iSpring group boundaries and media-backed questions", () => {
    const quiz = convertDocumentToQuiz({
      title: "Grouped Echo Review",
      sl: {
        g: [
          { id: "anatomy", nm: "Anatomy", S: [{ tp: "mc", D: "Identify the valve", img: "media/valve.png", C: { chs: [{ t: "Mitral", c: true }, { t: "Aortic", c: false }] } }] },
          { id: "hemodynamics", nm: "Hemodynamics", S: [{ tp: "mc", D: "Estimate pressure", video: "media/pressure.mp4", C: { chs: [{ t: "Normal", c: true }, { t: "High", c: false }] } }] },
        ],
      },
    }, new Map([
      ["media/valve.png", "https://cdn.example/valve.png"],
      ["media/pressure.mp4", "https://cdn.example/pressure.mp4"],
    ]), []);

    expect(quiz.meta.groups?.map((group) => group.name)).toEqual(["Anatomy", "Hemodynamics"]);
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0].groupId).toBe(quiz.meta.groups?.[0]?.id);
    expect(quiz.questions[1].groupId).toBe(quiz.meta.groups?.[1]?.id);
    expect(quiz.questions[0].image?.url).toBe("https://cdn.example/valve.png");
    expect(quiz.questions[1].video?.url).toBe("https://cdn.example/pressure.mp4");
  });
});
