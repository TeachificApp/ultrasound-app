import { describe, expect, it } from "vitest";
import { LEARNING_ACCESS_SYNC_ORDER, LEARNING_ACCESS_SYNC_TABLES } from "../scripts/learningAccessSyncManifest.mjs";

describe("learning access insert-only synchronization manifest", () => {
  it("contains only the verified gap tables in dependency-aware order", () => {
    expect(LEARNING_ACCESS_SYNC_ORDER).toHaveLength(16);
    expect(new Set(LEARNING_ACCESS_SYNC_ORDER).size).toBe(LEARNING_ACCESS_SYNC_ORDER.length);
    expect(LEARNING_ACCESS_SYNC_ORDER.every((table) => LEARNING_ACCESS_SYNC_TABLES.includes(table))).toBe(true);
    expect(LEARNING_ACCESS_SYNC_ORDER.indexOf("mediaAssets")).toBeLessThan(LEARNING_ACCESS_SYNC_ORDER.indexOf("mediaVersions"));
    expect(LEARNING_ACCESS_SYNC_ORDER.indexOf("lms_instructors")).toBeLessThan(LEARNING_ACCESS_SYNC_ORDER.indexOf("lms_course_instructors"));
    expect(LEARNING_ACCESS_SYNC_ORDER).not.toContain("access_token_uses");
  });
});
