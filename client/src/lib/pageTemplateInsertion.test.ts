import { describe, expect, it } from "vitest";
import { copyPageTemplateBlocks } from "./pageTemplateInsertion";

describe("copyPageTemplateBlocks", () => {
  it("creates fresh block IDs without changing source page-template content", () => {
    const template = [{
      id: "source-column",
      type: "column_layout",
      data: {
        leftBlocks: [{ id: "source-text", type: "text", data: { html: "<p>Keep this content</p>" } }],
        rightBlocks: [],
      },
    }];
    const ids = ["copy-column", "copy-text"];
    const copied = copyPageTemplateBlocks(template, () => ids.shift()!);

    expect(copied).toEqual([{ id: "copy-column", type: "column_layout", data: {
      leftBlocks: [{ id: "copy-text", type: "text", data: { html: "<p>Keep this content</p>" } }],
      rightBlocks: [],
    } }]);
    expect(template[0].id).toBe("source-column");
    expect((template[0].data.leftBlocks as any[])[0].id).toBe("source-text");
  });
});
