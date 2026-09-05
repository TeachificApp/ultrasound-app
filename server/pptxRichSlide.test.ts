import { describe, expect, it } from "vitest";
import { plainTextFromRichHtml, pptxRichSlideToHtml, type PptxRichSlide } from "../shared/pptxRichSlide";

describe("PowerPoint rich slide model", () => {
  it("keeps formatted text, visual layers, and responsive slide geometry together", () => {
    const slide: PptxRichSlide = {
      version: 1,
      title: "Slide title",
      sourceWidth: 850,
      sourceHeight: 1100,
      backgroundColor: "#f4fbfb",
      elements: [
        { id: "shape", type: "shape", x: 2, y: 2, width: 2, height: 96, zIndex: 1, shape: "rectangle", fill: "#179ca3", stroke: "#179ca3" },
        { id: "text", type: "text", x: 8, y: 10, width: 80, height: 18, zIndex: 2, content: "Styled title", contentHtml: '<span style="font-size:28pt;font-weight:700;color:#179ca3">Styled title</span>', style: { fontSize: 28, fontWeight: "bold", fontStyle: "normal", textAlign: "left", color: "#179ca3" } },
        { id: "image", type: "image", x: 15, y: 32, width: 60, height: 36, zIndex: 3, src: "https://example.test/slide.png" },
      ],
    };
    const html = pptxRichSlideToHtml(slide);
    expect(html).toContain("aspect-ratio:850 / 1100");
    expect(html).toContain("background-color:#f4fbfb");
    expect(html).toContain('data-pptx-text-box="1"');
    expect(html).toContain("font-size:28pt");
    expect(html).toContain('data-pptx-shape="1"');
    expect(html).toContain('data-pptx-image="1"');
    expect(plainTextFromRichHtml('<span>Styled</span><br />title')).toBe("Styled\ntitle");
  });
});
