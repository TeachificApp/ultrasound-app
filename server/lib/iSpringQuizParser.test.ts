import { describe, expect, it } from "vitest";
import { ISpringFlashcardDeckError, parseQuizFromHtml } from "./iSpringQuizParser";

describe("parseQuizFromHtml", () => {
  it("identifies an iSpring Presentation flashcard deck by package structure before attempting quiz JSON parsing", () => {
    const flashcardHtml = `
      <!-- Created with iSpring -->
      <html>
        <head><title>Adult Echo Review</title></head>
        <body>
          <script>window.ispringPresentation = true; PresentationPlayer.start();</script>
          <script>var data = "not-a-quiz-payload";</script>
        </body>
      </html>
    `;

    expect(() => parseQuizFromHtml(flashcardHtml)).toThrow(ISpringFlashcardDeckError);
    expect(() => parseQuizFromHtml(flashcardHtml)).toThrow(/flashcard deck/i);
  });

  it("parses a valid iSpring QuizMaker payload", () => {
    const quizData = Buffer.from(JSON.stringify({
      d: {
        T: "Adult Echo Quiz",
        sl: { g: [{ i: "group-1", T: "Review", S: [] }] },
      },
    })).toString("base64");
    const quizHtml = `<html><head><title>Adult Echo Quiz</title></head><body><!-- iSpring --><script>QuizPlayer.start("${quizData}");</script></body></html>`;

    expect(parseQuizFromHtml(quizHtml)).toMatchObject({
      title: "Adult Echo Quiz",
      groups: [],
    });
  });

  it("rejects generic SCORM content that does not contain an iSpring QuizMaker payload", () => {
    const genericScormHtml = "<html><head><title>Generic SCORM Module</title></head><body>SCORM 1.2 content</body></html>";

    expect(() => parseQuizFromHtml(genericScormHtml)).toThrow(/Not an iSpring SCORM package/);
  });
});
