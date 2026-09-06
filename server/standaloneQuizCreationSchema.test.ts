import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Standalone Flashcards creation schema", () => {
  it("keeps the two active Quiz Creator insert fields in Drizzle and the additive migration", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "drizzle/0060_standalone_quiz_creation_contract.sql"), "utf8");

    expect(schema).toContain('allowRetakesType: varchar("allow_retakes_type", { length: 64 })');
    expect(schema).toContain('showPerQuestionScore: boolean("show_per_question_score").default(true).notNull()');
    expect(migration).toContain('ADD COLUMN `allow_retakes_type` varchar(64) NULL DEFAULT NULL');
    expect(migration).toContain('ADD COLUMN `show_per_question_score` tinyint(1) NOT NULL DEFAULT 1');
  });
});
