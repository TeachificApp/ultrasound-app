import { describe, it, expect } from "vitest";
import {
  parseItemExtraConfig,
  isAdminOnlyItem,
  mergeExtraConfig,
  evalFilterCondition,
  parseResultsSettings,
  mergeResultsSettingsIntoTheme,
  applySavedFilter,
} from "../shared/formItemUtils";

describe("formItemUtils", () => {
  it("parses adminOnly from extraConfig", () => {
    expect(isAdminOnlyItem({ extraConfig: JSON.stringify({ adminOnly: true }) })).toBe(true);
    expect(isAdminOnlyItem({ extraConfig: null })).toBe(false);
    expect(isAdminOnlyItem({ extraConfig: "{invalid" })).toBe(false);
  });

  it("merges extraConfig patches", () => {
    const merged = mergeExtraConfig(JSON.stringify({ formula: "a+b" }), { adminOnly: true });
    expect(JSON.parse(merged)).toEqual({ formula: "a+b", adminOnly: true });
  });

  it("evaluates filter conditions", () => {
    const responses = { "1": "hello world", "2": "5" };
    expect(
      evalFilterCondition(responses, { fieldId: "1", operator: "contains", value: "world" }),
    ).toBe(true);
    expect(
      evalFilterCondition(responses, { fieldId: "2", operator: "greater_than", value: "3" }),
    ).toBe(true);
    expect(
      evalFilterCondition(responses, { fieldId: "3", operator: "is_empty", value: "" }),
    ).toBe(true);
  });

  it("stores and reads results settings in themeSettings", () => {
    const theme = JSON.stringify({ primaryColor: "#000" });
    const settings = {
      savedFilters: [
        {
          id: "f1",
          name: "Approved",
          logic: "AND" as const,
          conditions: [{ fieldId: "10", operator: "equals" as const, value: "yes" }],
        },
      ],
      actions: [
        {
          id: "a1",
          name: "Notify",
          event: "on_submit" as const,
          type: "email" as const,
          enabled: true,
          emailTo: "admin@test.com",
        },
      ],
    };
    const merged = mergeResultsSettingsIntoTheme(theme, settings);
    const parsed = parseResultsSettings(merged);
    expect(parsed.savedFilters).toHaveLength(1);
    expect(parsed.actions[0].emailTo).toBe("admin@test.com");
    expect(parseItemExtraConfig(null)).toEqual({});
  });

  it("applySavedFilter filters submissions", () => {
    const subs = [
      { responses: JSON.stringify({ "1": "yes" }) },
      { responses: JSON.stringify({ "1": "no" }) },
    ];
    const filtered = applySavedFilter(subs, {
      id: "x",
      name: "Yes only",
      logic: "AND",
      conditions: [{ fieldId: "1", operator: "equals", value: "yes" }],
    });
    expect(filtered).toHaveLength(1);
  });
});
