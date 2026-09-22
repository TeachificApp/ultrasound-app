import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vitest";
import { formatMysqlQueryError } from "./lib/mysqlQueryError";

describe("formatMysqlQueryError", () => {
  it("maps missing Study Groups tables to migration guidance", () => {
    const cause = Object.assign(new Error("Table doesn't exist"), {
      code: "ER_NO_SUCH_TABLE",
      sqlMessage: "Table 'railway.study_groups' doesn't exist",
    });
    const err = new DrizzleQueryError("insert into study_groups", [1], cause);
    expect(formatMysqlQueryError(err, "Could not create study group")).toContain("0070_study_groups.sql");
  });

  it("surfaces sqlMessage for other database errors", () => {
    const cause = Object.assign(new Error("Duplicate"), {
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry '1-echo@example.com' for key 'uq_study_group_member_email'",
    });
    expect(formatMysqlQueryError(cause, "Invite failed")).toContain("Duplicate entry");
  });
});
