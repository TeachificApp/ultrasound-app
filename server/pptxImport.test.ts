import { describe, it, expect } from "vitest";
import { buildMinimalTestPptx, parsePptxBuffer } from "./lib/pptxImport";
import { applyMasterToPresentation } from "../shared/teachSlideMaster";
import { parseMasterSlides } from "../shared/teachSlideMaster";

describe("pptxImport", () => {
  it("parses a minimal .pptx with title and body text", async () => {
    const buffer = await buildMinimalTestPptx([
      { title: "Welcome", body: "First slide body" },
      { title: "Chapter 2", body: "More content here" },
    ]);
    const result = await parsePptxBuffer(buffer);
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0]?.title).toBe("Welcome");
    expect(result.slides[0]?.elements.some((e) => e.content?.includes("First slide body"))).toBe(true);
    expect(result.slides[1]?.elements.length).toBeGreaterThan(0);
    expect(result.masterSlides.length).toBeGreaterThan(0);
  });

  it("retains source dimensions and visual text elements for responsive rich-text conversion", async () => {
    const buffer = await buildMinimalTestPptx([{ title: "Layout title", body: "Layout text" }]);
    const result = await parsePptxBuffer(buffer);
    expect(result.slides[0]?.sourceWidth).toBeGreaterThan(0);
    expect(result.slides[0]?.sourceHeight).toBeGreaterThan(0);
    expect(result.slides[0]?.elements.some((element) => element.type === "text")).toBe(true);
  });

  it("rejects invalid zip as pptx", async () => {
    await expect(parsePptxBuffer(Buffer.from("not a zip"))).rejects.toThrow();
  });
});

describe("teachSlideMaster", () => {
  it("applies master placeholders onto presentation slides", () => {
    const masterSlides = parseMasterSlides(null);
    const presentation = [
      {
        id: "s1",
        title: "My Title",
        notes: "",
        elements: [
          {
            id: "t1",
            type: "text" as const,
            x: 0,
            y: 0,
            width: 100,
            height: 20,
            zIndex: 1,
            content: "My Title",
            style: { fontSize: 32, fontWeight: "bold" as const, fontStyle: "normal" as const, textAlign: "center" as const, color: "#000" },
          },
          {
            id: "b1",
            type: "text" as const,
            x: 0,
            y: 30,
            width: 100,
            height: 50,
            zIndex: 2,
            content: "Body copy",
            style: { fontSize: 20, fontWeight: "normal" as const, fontStyle: "normal" as const, textAlign: "left" as const, color: "#000" },
          },
        ],
      },
    ];
    const merged = applyMasterToPresentation(presentation, masterSlides);
    expect(merged[0]?.backgroundColor).toBeDefined();
    expect(merged[0]?.elements.length).toBeGreaterThan(1);
    expect(merged[0]?.elements.some((e) => e.content === "My Title")).toBe(true);
  });
});
