import { describe, expect, it } from "vitest";
import { getHostSessionReturnPath, getJoinRoute, getLiveSessionBrand } from "../shared/teachLiveSessionPresentation";

describe("Teach live session presentation", () => {
  it("keeps a Teach host inside the Teach game workspace while legacy quizzes retain their admin return path", () => {
    expect(getHostSessionReturnPath(true)).toBe("/teach/games");
    expect(getHostSessionReturnPath(false)).toBe("/admin/sonoquiz");
  });

  it("brands Teach participant sessions and creates a normalized QR/PIN join path", () => {
    expect(getLiveSessionBrand(true)).toBe("Teach Live Game");
    expect(getLiveSessionBrand(false)).toBe("SonoQuiz");
    expect(getJoinRoute("ab12cd")).toBe("/quiz/AB12CD");
  });
});
