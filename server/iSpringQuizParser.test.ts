import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import {
  extractISpringBase64FromHtml,
  parseISpringDataBlob,
  parseISpringQuizFromBuffer,
} from "./lib/iSpringQuizParser";

function makeMiniQuizJson(title = "Test Quiz") {
  return JSON.stringify({
    d: {
      T: title,
      sl: {
        g: [
          {
            i: "g1",
            T: "Group 1",
            S: [
              {
                i: "q1",
                tp: "TrueFalse",
                D: { h: "<p>Is this a test?</p>", d: ["Is this a test?"] },
                C: {
                  chs: [
                    { t: { d: ["True"] }, c: true },
                    { t: { d: ["False"] }, c: false },
                  ],
                },
                s: { F: { c: { v: { h: "<p>Correct!</p>" } } } },
              },
            ],
          },
        ],
      },
    },
  });
}

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

describe("extractISpringBase64FromHtml", () => {
  it("extracts a single-line var data assignment", () => {
    const payload = b64(makeMiniQuizJson());
    const html = `<html><script>var data = "${payload}"; QuizPlayer.start(data);</script></html>`;
    expect(extractISpringBase64FromHtml(html)).toBe(payload);
  });

  it("extracts concatenated string literals assigned to var data", () => {
    const payload = b64(makeMiniQuizJson());
    const mid = Math.floor(payload.length / 2);
    const html = `<html><script>var data = "${payload.slice(0, mid)}" + "${payload.slice(mid)}";</script></html>`;
    expect(extractISpringBase64FromHtml(html)).toBe(payload);
  });
});

describe("parseISpringQuizFromBuffer", () => {
  it("parses a minimal iSpring zip with split base64 literals", async () => {
    const payload = b64(makeMiniQuizJson("Fetal Echo Registry Review"));
    const mid = Math.floor(payload.length / 2);
    const html = `<!DOCTYPE html><html><body><script>
      var data = "${payload.slice(0, mid)}" +
        "${payload.slice(mid)}";
      document.addEventListener("DOMContentLoaded", function() { QuizPlayer.start(data); });
    </script></body></html>`;

    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from(html, "utf8"));
    const parsed = await parseISpringQuizFromBuffer(zip.toBuffer());

    expect(parsed.title).toBe("Fetal Echo Registry Review");
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].questions).toHaveLength(1);
    expect(parsed.groups[0].questions[0].explanationHtml).toContain("Correct!");
  });
});

describe("parseISpringDataBlob", () => {
  it("collects feedback text from questions", () => {
    const parsed = parseISpringDataBlob(makeMiniQuizJson());
    expect(parsed.groups[0].questions[0].explanationText).toBe("Correct!");
  });

  it("imports iSpring matching and sequence questions as native matching pairs", () => {
    const payload = JSON.stringify({
      d: {
        T: "Advanced review",
        sl: {
          g: [{
            i: "group-1",
            T: "Matching",
            S: [
              {
                i: "match-1",
                tp: "Matching",
                D: { h: "<p>Match each medication.</p>", d: ["Match each medication."] },
                C: { m: [
                  { p: { i: "1", t: { d: ["Losartan"] } }, r: { i: "1", t: { d: ["ARB"] } } },
                  { p: { i: "2", t: { d: ["Diltiazem"] } }, r: { i: "2", t: { d: ["Calcium-channel blocker"] } } },
                ] },
              },
              {
                i: "sequence-1",
                tp: "Sequence",
                D: { h: "<p>Put the phases in order.</p>", d: ["Put the phases in order."] },
                C: { chs: [
                  { i: "0", t: { d: ["Atrial contraction"] } },
                  { i: "1", t: { d: ["Isovolumetric contraction"] } },
                ] },
              },
              {
                i: "fill-1",
                tp: "FillInTheBlank",
                D: { h: "<p>The normal ejection fraction is ___%.</p>", d: ["The normal ejection fraction is ___%."] },
                C: { rt: { r: [{ data: { v: ["55"] } }] } },
              },
            ],
          }],
        },
      },
    });

    const parsed = parseISpringDataBlob(payload);
    const [matching, sequence, fillInTheBlank] = parsed.groups[0].questions;
    expect(matching.type).toBe("matching");
    expect(matching.matchingPairs).toEqual([
      { id: "1", left: "Losartan", right: "ARB" },
      { id: "2", left: "Diltiazem", right: "Calcium-channel blocker" },
    ]);
    expect(sequence.type).toBe("matching");
    expect(sequence.matchingPairs).toEqual([
      { id: "0", left: "1", right: "Atrial contraction" },
      { id: "1", left: "2", right: "Isovolumetric contraction" },
    ]);
    expect(fillInTheBlank.type).toBe("flashcard");
    expect(fillInTheBlank.flashcardFront).toBe("The normal ejection fraction is ___%.");
    expect(fillInTheBlank.flashcardBack).toBe("55");
  });

  it("keeps each choice image distinct and excludes choice feedback media", () => {
    const payload = JSON.stringify({
      d: {
        T: "Vascular image answers",
        sl: {
          g: [{
            i: "group-1",
            T: "Image Questions",
            S: [{
              i: "option-image-1",
              tp: "MultipleChoice",
              D: { h: "<p>Which waveform is monophasic?</p>", d: ["Which waveform is monophasic?"] },
              C: { chs: [
                {
                  t: { h: "<p></p>", d: [] },
                  ia: { i: "storage://images/choice-a.jpg" },
                  f: { v: { r: ["storage://images/correct-feedback.jpg"] } },
                  c: false,
                },
                {
                  t: { h: "<p></p>", d: [] },
                  ia: { i: "storage://images/choice-b.jpg" },
                  f: { v: { r: ["storage://images/correct-feedback.jpg"] } },
                  c: true,
                },
              ] },
            }],
          }],
        },
      },
    });

    const parsed = parseISpringDataBlob(payload);
    const question = parsed.groups[0].questions[0];
    expect(question.answers.map((answer) => answer.imageRef)).toEqual([
      "storage://images/choice-a.jpg",
      "storage://images/choice-b.jpg",
    ]);
    expect(question.answers.some((answer) => answer.imageRef === "storage://images/correct-feedback.jpg")).toBe(false);
    expect(parsed.allImageRefs).toEqual(expect.arrayContaining([
      "storage://images/choice-a.jpg",
      "storage://images/choice-b.jpg",
    ]));
  });
});
