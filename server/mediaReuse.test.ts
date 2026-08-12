import { describe, expect, it, vi } from "vitest";
import { requestMediaRepositoryUrl, reuseMediaRepositoryUrl } from "../client/src/lib/mediaReuse";

describe("Media Repository URL reuse", () => {
  it("trims a pasted Media Repository URL and applies it to the authoring field", () => {
    const apply = vi.fn();
    const used = reuseMediaRepositoryUrl("question image", apply, () => "  https://media.example/question.png  ");
    expect(used).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("https://media.example/question.png");
  });

  it("does not change an authoring field when the reuse prompt is empty or cancelled", () => {
    const apply = vi.fn();
    expect(reuseMediaRepositoryUrl("feedback video", apply, () => "   ")).toBe(false);
    expect(reuseMediaRepositoryUrl("feedback video", apply, () => null)).toBe(false);
    expect(requestMediaRepositoryUrl("feedback video", () => "")).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
