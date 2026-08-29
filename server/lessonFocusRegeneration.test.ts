import { describe, expect, it } from "vitest";
import { applyEditableBlockText, collectEditableBlockText } from "./lib/lessonFocusRegeneration";

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
});
