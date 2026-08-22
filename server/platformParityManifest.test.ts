import { describe, expect, it } from "vitest";
import { classifyPlatformTable } from "../scripts/platformParityManifest.mjs";

describe("platform parity manifest", () => {
  it("includes normal platform tables but excludes credentials and personal operational logs", () => {
    expect(classifyPlatformTable("lms_courses")).toBe("non-sensitive-platform-data");
    expect(classifyPlatformTable("users")).toBe("non-sensitive-platform-data");
    expect(classifyPlatformTable("access_token_uses")).toBe("excluded-sensitive");
    expect(classifyPlatformTable("ip_access_logs")).toBe("excluded-operational-personal-data");
  });
});
