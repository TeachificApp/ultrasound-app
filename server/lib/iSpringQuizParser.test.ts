import { describe, expect, it } from "vitest";
import { ISpringFlashcardDeckError, parseISpringDataBlob, parseQuizFromHtml } from "./iSpringQuizParser";

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

  it("retains declared image and video references without changing native quiz question types", () => {
    const parsed = parseISpringDataBlob(JSON.stringify({
      d: {
        T: "Media quiz",
        sl: { g: [{ i: "media", T: "Media", S: [{
          i: "q-media",
          tp: "MultipleChoice",
          D: { h: "<p>What is shown?</p>", r: ["storage://question.mp4", "storage://question.png"] },
          C: { chs: [{ t: { h: "Answer", r: ["storage://choice.webm"] }, c: true }] },
          s: { F: { c: { v: { h: "<p>Correct</p>", r: ["storage://feedback.png"] } } } },
        }] }] },
      },
    }));

    const question = parsed.groups[0].questions[0];
    expect(question.type).toBe("mcq");
    expect(question.questionImageRefs).toContain("storage://question.png");
    expect(question.questionVideoRefs).toContain("storage://question.mp4");
    expect(question.answers[0].videoRef).toBe("storage://choice.webm");
    expect(question.feedbackImageRefs).toContain("storage://feedback.png");
    expect(parsed.allVideoRefs).toEqual(expect.arrayContaining(["storage://question.mp4", "storage://choice.webm"]));
  });

  it("retains packaged image and video paths embedded in iSpring question, answer, and feedback HTML", () => {
    const parsed = parseISpringDataBlob(JSON.stringify({
      d: {
        T: "Local package media quiz",
        sl: { g: [{ i: "media", T: "Media", S: [{
          i: "q-local-media",
          tp: "MultipleChoice",
          D: {
            h: '<p>Identify this view.</p><img src="data/images/question.png"><video poster="data/images/poster.jpg" src="data/video/question.mp4"></video>',
            r: ["data/images/declared-question.webp"],
          },
          C: { chs: [{
            t: { h: '<img src="data/images/choice.png"><video src="data/video/choice.webm"></video>' },
            c: true,
          }] },
          s: { F: { c: { v: { h: '<p>Correct.</p><img src="data/images/feedback.png" style="background-image:url(data/images/feedback-bg.svg)"><video src="data/video/feedback.mp4"></video>' } } } },
        }] }] },
      },
    }));

    const question = parsed.groups[0].questions[0];
    expect(question.questionImageRefs).toEqual(expect.arrayContaining([
      "data/images/question.png",
      "data/images/poster.jpg",
      "data/images/declared-question.webp",
    ]));
    expect(question.questionVideoRefs).toContain("data/video/question.mp4");
    expect(question.answers[0]).toMatchObject({ imageRef: "data/images/choice.png", videoRef: "data/video/choice.webm" });
    expect(question.feedbackImageRefs).toEqual(expect.arrayContaining(["data/images/feedback.png", "data/images/feedback-bg.svg"]));
    expect(question.feedbackVideoRefs).toContain("data/video/feedback.mp4");
    expect(parsed.allImageRefs).toEqual(expect.arrayContaining(["data/images/question.png", "data/images/choice.png", "data/images/feedback.png"]));
    expect(parsed.allVideoRefs).toEqual(expect.arrayContaining(["data/video/question.mp4", "data/video/choice.webm", "data/video/feedback.mp4"]));
  });
});
