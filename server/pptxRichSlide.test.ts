import { describe, expect, it } from "vitest";
import { plainTextFromRichHtml, pptxRichSlideToDocumentHtml, pptxRichSlideToHtml, type PptxRichSlide } from "../shared/pptxRichSlide";

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

  it("renders lesson-document HTML with real tables, borderless columns, and full-width images", () => {
    const slide: PptxRichSlide = {
      version: 1,
      title: "Document slide",
      sourceWidth: 9144000,
      sourceHeight: 6858000,
      backgroundColor: "#ffffff",
      elements: [
        { id: "h1", type: "text", sourceName: "Table 1", content: "Concept", x: 5, y: 20, width: 28, height: 5, zIndex: 1, style: { fontWeight: "bold", backgroundColor: "#179ca3", color: "#ffffff", fontSize: 12, fontStyle: "normal", textAlign: "left" } },
        { id: "h2", type: "text", sourceName: "Table 1", content: "Impact", x: 35, y: 20, width: 28, height: 5, zIndex: 2, style: { fontWeight: "bold", backgroundColor: "#179ca3", color: "#ffffff", fontSize: 12, fontStyle: "normal", textAlign: "left" } },
        { id: "c1", type: "text", sourceName: "Table 1", content: "Frequency", x: 5, y: 30, width: 28, height: 5, zIndex: 3, style: { fontSize: 11, fontWeight: "normal", fontStyle: "normal", textAlign: "left", color: "#333333" } },
        { id: "left", type: "text", content: "Important pulsed wave parameters include PD and PRP.", x: 5, y: 50, width: 55, height: 20, zIndex: 4, style: { fontSize: 14, fontWeight: "normal", fontStyle: "normal", textAlign: "left", color: "#333333" } },
        { id: "right", type: "image", src: "https://example.test/chart.png", x: 62, y: 50, width: 33, height: 20, zIndex: 5 },
      ],
    };
    const html = pptxRichSlideToDocumentHtml(slide);
    expect(html).toContain('data-pptx-document-slide="1"');
    expect(html).toContain('data-pptx-table="1"');
    expect(html).toContain("<table");
    expect(html).toContain("Concept");
    expect(html).toContain("background-color:#179ca3");
    expect(html).toContain('data-pptx-columns="1"');
    expect(html).toContain('grid-template-columns:55fr 33fr');
    expect(html).toContain('width:100%;height:auto');
    expect(html).toContain('src="https://example.test/chart.png"');
    expect(html).not.toContain("position:absolute");
    expect(html).not.toContain('border:1px solid');
  });
});
