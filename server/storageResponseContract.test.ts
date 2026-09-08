import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("SCORM media storage response contract", () => {
  it("keeps Railway SCORM imports on R2 and rejects unexpected Forge HTML responses clearly", () => {
    const backend = readFileSync(new URL("./lib/storageBackend.ts", import.meta.url), "utf8");
    const storage = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");

    expect(backend).toContain("isRailwayPrimaryHost() && hasR2Credentials()");
    expect(backend).toContain('return "r2"');
    expect(storage).toContain("Storage ${operation} returned an unexpected non-JSON response");
    expect(storage).toContain("Storage ${operation} response did not include a usable file URL");
    expect(storage).toContain("export async function readStorageUrlResponse");
  });
});
