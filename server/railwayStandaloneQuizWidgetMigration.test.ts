import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Railway standalone quiz widget-launch migration", () => {
  it("creates only the existing direct-editor lookup table and indexes", () => {
    const sql = readFileSync("drizzle/0062_railway_standalone_quiz_widget_launches.sql", "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `standalone_quiz_widget_launches`");
    expect(sql).toContain("standalone_quiz_widget_launches_token_hash_unique");
    expect(sql).toContain("standalone_quiz_widget_launches_quiz_active_idx");
    expect(sql).toContain("`quiz_id`");
    expect(sql).toContain("`expires_at`");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
  });
});
