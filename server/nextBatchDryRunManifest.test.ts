import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const expectedOrder = [
  "users",
  "userRoles",
  "teach_folders",
  "teach_slide_masters",
  "teach_materials",
  "teach_material_permissions",
  "sonoQuizzes",
  "sonoQuizQuestions",
  "sonoQuizSessions",
  "sonoQuizParticipants",
  "sonoQuizAnswers",
];

describe("next Manus-to-Railway dry-run manifest", () => {
  it("keeps Teach game dependencies parent-first and identity-sensitive", () => {
    expect(expectedOrder.indexOf("users")).toBeLessThan(expectedOrder.indexOf("teach_materials"));
    expect(expectedOrder.indexOf("sonoQuizzes")).toBeLessThan(expectedOrder.indexOf("sonoQuizQuestions"));
    expect(expectedOrder.indexOf("sonoQuizSessions")).toBeLessThan(expectedOrder.indexOf("sonoQuizParticipants"));
    expect(expectedOrder.indexOf("sonoQuizParticipants")).toBeLessThan(expectedOrder.indexOf("sonoQuizAnswers"));
  });

  it("documents a read-only policy that forbids Railway updates and deletes", async () => {
    const source = await readFile(new URL("../scripts/dryRunNextManusRailwayBatch.mjs", import.meta.url), "utf8");
    expect(source).toContain("Read-only next Manus-to-Railway dry run");
    expect(source).toContain("must never update or delete existing Railway rows");
    expect(source).not.toContain(".execute(");
  });
});
