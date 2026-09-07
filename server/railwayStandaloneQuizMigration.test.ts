import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Railway standalone quiz creation migration", () => {
  it("aligns every live Flashcards creation field without destructive operations", () => {
    const sql = readFileSync("drizzle/0061_railway_standalone_quiz_contract.sql", "utf8");

    expect(sql).toContain("read_aloud_enabled");
    expect(sql).toContain("read_aloud_voice");
    expect(sql).toContain("allow_retakes_type");
    expect(sql).toContain("show_per_question_score");
    expect(sql).toContain("account_fields");
    expect(sql).toContain("ENUM('quiz','mock_exam','flashcards')");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });
});
