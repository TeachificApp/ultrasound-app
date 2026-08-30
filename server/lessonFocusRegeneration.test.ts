import { describe, expect, it } from "vitest";
import { applyEditableBlockText, assertSubstantiveFocusRegeneration, collectEditableBlockText } from "./lib/lessonFocusRegeneration";

describe("lesson focus regeneration block safeguards", () => {
  const sourceBlocks = JSON.stringify([
    {
      id: "hero-1",
      type: "hero",
      data: {
        headline: "Indications for Fetal Echocardiography",
        subheadline: "Recognize when a fetal study is appropriate.",
        bgColor: "#149096",
        imageUrl: "https://example.test/hero.png",
        buttons: [{ label: "Enroll now", url: "https://example.test/enroll" }],
      },
    },
    {
      id: "quiz-1",
      type: "lesson_quiz",
      data: { question: "Which indication is present?", options: ["A", "B"] },
    },
  ]);

  it("extracts instructional text while excluding media, styling, CTAs, and quiz blocks", () => {
    expect(collectEditableBlockText(sourceBlocks)).toEqual([
      { path: "0.data.headline", value: "Indications for Fetal Echocardiography" },
      { path: "0.data.subheadline", value: "Recognize when a fetal study is appropriate." },
    ]);
  });

  it("updates only extracted text paths and preserves layout, media, CTAs, and quiz content", () => {
    const applied = applyEditableBlockText(sourceBlocks, [
      { path: "0.data.headline", value: "Indications for Pediatric Echocardiography" },
      { path: "0.data.imageUrl", value: "https://untrusted.test/replaced.png" },
      { path: "1.data.question", value: "Changed question" },
    ]);
    const parsed = JSON.parse(applied.contentBlocks ?? "[]");
    expect(applied.appliedCount).toBe(1);
    expect(parsed[0].id).toBe("hero-1");
    expect(parsed[0].data.headline).toBe("Indications for Pediatric Echocardiography");
    expect(parsed[0].data.bgColor).toBe("#149096");
    expect(parsed[0].data.imageUrl).toBe("https://example.test/hero.png");
    expect(parsed[0].data.buttons[0]).toEqual({ label: "Enroll now", url: "https://example.test/enroll" });
    expect(parsed[1].data.question).toBe("Which indication is present?");
  });

  it("includes rich lesson-body HTML and instructional list items while retaining protected fields", () => {
    const richBlocks = JSON.stringify([
      { id: "text-1", type: "text", data: { html: "<p>Assess fetal cardiac anatomy and rhythm.</p>", bgColor: "#ffffff" } },
      { id: "bullets-1", type: "bullets", data: { headline: "Fetal assessment", items: ["Evaluate four-chamber anatomy", "Assess outflow tracts"], imageUrl: "https://example.test/reference.png" } },
    ]);
    expect(collectEditableBlockText(richBlocks)).toEqual([
      { path: "0.data.html", value: "<p>Assess fetal cardiac anatomy and rhythm.</p>" },
      { path: "1.data.headline", value: "Fetal assessment" },
      { path: "1.data.items.0", value: "Evaluate four-chamber anatomy" },
      { path: "1.data.items.1", value: "Assess outflow tracts" },
    ]);
  });

  it("rejects a title-only-style proposal that omits substantive body or block-text changes", () => {
    const source = {
      content: "<p>Discuss fetal echocardiography indications, anatomy, and counseling considerations.</p>",
      videoContent: "",
      editableBlockText: [{ path: "0.data.html", value: "<p>Review fetal imaging planes and Doppler findings.</p>" }],
    };
    expect(() => assertSubstantiveFocusRegeneration(source, {
      content: source.content,
      videoContent: "",
      blockText: source.editableBlockText,
    })).toThrow("instructional body");
    expect(() => assertSubstantiveFocusRegeneration(source, {
      content: "<p>Discuss pediatric echocardiography indications, anatomy, and counseling considerations.</p>",
      videoContent: "",
      blockText: [],
    })).toThrow("block-text proposal is incomplete");
  });
});
