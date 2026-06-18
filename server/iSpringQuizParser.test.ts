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
});
