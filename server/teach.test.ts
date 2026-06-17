import { describe, it, expect } from "vitest";
import {
  parseTeachSlides,
  normalizeSlide,
  orderedEntranceElements,
  createEmptySlide,
} from "../shared/teachPresentation";
import { parseSlidesData, teachFolderSlug } from "./lib/teachAccess";

describe("TEACH presentation model", () => {
  it("builds per-instructor media folder slug", () => {
    expect(teachFolderSlug(42)).toBe("Teach/user-42");
  });

  it("migrates legacy flat slides to element-based model", () => {
    const legacy = [{ id: "1", title: "Hello", content: "Body text", imageUrl: "https://x/img.png", notes: "note" }];
    const slides = parseTeachSlides(JSON.stringify(legacy));
    expect(slides[0]?.elements.length).toBeGreaterThanOrEqual(2);
    expect(slides[0]?.notes).toBe("note");
  });

  it("parses element animations and video settings", () => {
    const slide = normalizeSlide(
      {
        id: "s1",
        title: "Video slide",
        elements: [
          {
            id: "v1",
            type: "video",
            x: 10,
            y: 10,
            width: 80,
            height: 70,
            zIndex: 1,
            src: "https://example.com/v.mp4",
            video: { autoplay: true, loop: true, muted: false, controls: false },
            entrance: { type: "fadeIn", durationMs: 800, delayMs: 100, trigger: "auto" },
          },
        ],
        advanceAfterMs: 5000,
      },
      0,
    );
    const ordered = orderedEntranceElements(slide);
    expect(ordered).toHaveLength(1);
    expect(ordered[0]?.video?.loop).toBe(true);
    expect(slide.advanceAfterMs).toBe(5000);
  });

  it("teachAccess parseSlidesData delegates to shared parser", () => {
    const slides = parseSlidesData(null);
    expect(slides[0]?.elements).toBeDefined();
    expect(createEmptySlide(1).elements.length).toBeGreaterThan(0);
  });
});
