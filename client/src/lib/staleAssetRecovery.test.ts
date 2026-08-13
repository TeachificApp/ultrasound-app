import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "./staleAssetRecovery";

describe("stale asset recovery", () => {
  it("recognizes an HTML response returned for a JavaScript module", () => {
    expect(isStaleAssetError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
  });

  it("continues to recognize dynamically imported module failures", () => {
    expect(isStaleAssetError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
  });
});
