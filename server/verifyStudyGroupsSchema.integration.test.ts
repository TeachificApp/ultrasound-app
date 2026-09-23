import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";

const REQUIRED_TABLES = [
  "study_groups",
  "study_group_members",
  "study_group_share_links",
  "study_group_documents",
  "study_group_tasks",
  "study_group_messages",
  "study_group_modules",
  "study_group_activity",
  "study_group_content_access",
  "study_group_content_assignments",
  "study_group_workspace_blocks",
];

const dbUrl = process.env.DATABASE_URL?.trim();

describe.skipIf(!dbUrl)("Study Groups schema on DATABASE_URL", () => {
  it("has all study_group_* tables", async () => {
    const conn = await mysql.createConnection(dbUrl!);
    try {
      for (const table of REQUIRED_TABLES) {
        const [rows] = await conn.query(
          "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
          [table],
        );
        expect(Array.isArray(rows) && rows.length > 0, `missing table ${table}`).toBe(true);
      }
    } finally {
      await conn.end();
    }
  });
});
