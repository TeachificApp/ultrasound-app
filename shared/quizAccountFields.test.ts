import { describe, expect, it } from "vitest";
import { normalizeQuizAccountFieldKeys, resolveQuizAccountFields } from "./quizAccountFields";

describe("quiz account fields", () => {
  it("keeps only unique allow-listed field keys", () => {
    expect(normalizeQuizAccountFieldKeys(["email", "email", "role", "full_name"])).toEqual(["email", "full_name"]);
  });

  it("resolves selected profile fields without exposing unselected account data", () => {
    expect(resolveQuizAccountFields(["full_name", "email"], {
      firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", specialty: "Internal",
    })).toEqual([
      { key: "full_name", label: "Full name", value: "Ada Lovelace" },
      { key: "email", label: "Email address", value: "ada@example.test" },
    ]);
  });
});
