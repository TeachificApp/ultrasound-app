import { describe, it, expect } from "vitest";
import { parseSlidesData, teachFolderSlug } from "./lib/teachAccess";

describe("TEACH platform helpers", () => {
  it("builds per-instructor media folder slug", () => {
    expect(teachFolderSlug(42)).toBe("Teach/user-42");
  });

  it("parses slides JSON or returns default slide", () => {
    const slides = parseSlidesData(
      JSON.stringify([
        { id: "1", title: "Intro", content: "Hello", notes: "Say hi" },
        { id: "2", title: "Next", content: "More", notes: "" },
      ]),
    );
    expect(slides).toHaveLength(2);
    expect(slides[0]?.title).toBe("Intro");
    expect(slides[0]?.notes).toBe("Say hi");
  });

  it("returns default slide for empty or invalid JSON", () => {
    expect(parseSlidesData(null)).toHaveLength(1);
    expect(parseSlidesData("not-json")).toHaveLength(1);
    expect(parseSlidesData("[]")).toHaveLength(1);
  });

  it("documents permission levels for shared materials", () => {
    const levels = ["view", "present", "edit", "manage", "copy", "download"] as const;
    expect(levels).toContain("present");
    expect(levels).toContain("copy");
  });
});
