import { describe, expect, it } from "vitest";
import { getCatalogItemsForCategory } from "./LandingPageBuilder";

describe("Content block catalog ordering", () => {
  it("places Text/Rich Text, Image, and Video before the grouped AI generation blocks", () => {
    const contentTypes = getCatalogItemsForCategory("Content").map(block => block.type);
    expect(contentTypes.slice(0, 7)).toEqual(["text", "image", "video", "ai_content", "ai_image", "file_upload", "file_download"]);
  });
});
