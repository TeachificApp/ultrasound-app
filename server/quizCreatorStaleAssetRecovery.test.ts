import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "../client/src/lib/staleAssetRecovery";

describe("Quiz Creator stale asset recovery", () => {
  it("recognizes an HTML response served in place of a JavaScript module", () => {
    expect(isStaleAssetError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
  });
});
