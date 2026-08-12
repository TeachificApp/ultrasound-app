import { describe, expect, it } from "vitest";
import {
  buildFreshAssetUrl,
  isStaleAssetError,
  staleAssetRecoveryKey,
} from "../../client/src/lib/staleAssetRecovery";

describe("stale asset recovery", () => {
  it("recognises Vite dynamic-import failures", () => {
    expect(isStaleAssetError(new Error("Failed to fetch dynamically imported module: https://app.example/assets/QuizCreatorAdmin-old.js"))).toBe(true);
    expect(isStaleAssetError(new Error("Validation failed"))).toBe(false);
  });

  it("keeps recovery attempts scoped to the specific missing bundle", () => {
    expect(staleAssetRecoveryKey(new Error("Loading chunk old.js")))
      .not.toBe(staleAssetRecoveryKey(new Error("Loading chunk next.js")));
  });

  it("builds a cache-busted refresh URL without losing the route or hash", () => {
    expect(buildFreshAssetUrl("https://app.allaboutultrasound.com/admin/quiz-creator?view=list#row", 123))
      .toBe("https://app.allaboutultrasound.com/admin/quiz-creator?view=list&__asset_refresh=123#row");
  });
});
