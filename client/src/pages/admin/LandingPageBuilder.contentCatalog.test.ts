import { describe, expect, it } from "vitest";
import { BLOCK_CATALOG } from "./LandingPageBuilder";

describe("Content block catalog ordering", () => {
  it("places Text/Rich Text, Image, and Video before the grouped AI generation blocks", () => {
    const contentTypes = BLOCK_CATALOG.filter(block => block.category === "Content").map(block => block.type);
    expect(contentTypes.slice(0, 5)).toEqual(["text", "image", "video", "ai_content", "ai_image"]);
  });
});
