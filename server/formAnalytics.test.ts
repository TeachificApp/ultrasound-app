import { describe, it, expect } from "vitest";
import {
  computeFieldAnalytics,
  computeCrossTab,
  compareFieldAcrossForms,
  parseFormAnalyticsSettings,
  mergeFormAnalyticsIntoTheme,
  filterSubmissions,
  parseSubmissions,
} from "../shared/formAnalyticsUtils";
import { applySavedFilter } from "../shared/formItemUtils";

describe("formAnalyticsUtils", () => {
  const items = [
    { id: 1, label: "Region", itemType: "select", sortOrder: 0, extraConfig: null },
    { id: 2, label: "Years", itemType: "number", sortOrder: 1, extraConfig: null },
    { id: 3, label: "Role", itemType: "radio", sortOrder: 2, extraConfig: null },
  ];
  const options = [
    { itemId: 1, label: "East", value: "east", sortOrder: 0 },
    { itemId: 1, label: "West", value: "west", sortOrder: 1 },
    { itemId: 3, label: "Tech", value: "tech", sortOrder: 0 },
    { itemId: 3, label: "Lead", value: "lead", sortOrder: 1 },
  ];
  const submissions = parseSubmissions([
    { id: 1, responses: JSON.stringify({ "1": "east", "2": "5", "3": "tech" }) },
    { id: 2, responses: JSON.stringify({ "1": "west", "2": "10", "3": "lead" }) },
    { id: 3, responses: JSON.stringify({ "1": "east", "2": "7", "3": "tech" }) },
  ]);

  it("computes field distributions and numeric stats", () => {
    const analytics = computeFieldAnalytics(items, options, submissions);
    const region = analytics.find(f => f.fieldId === 1);
    const years = analytics.find(f => f.fieldId === 2);
    expect(region?.distribution).toHaveLength(2);
    expect(region?.distribution.find(d => d.value === "east")?.count).toBe(2);
    expect(years?.numericStats?.avg).toBe(7.33);
  });

  it("builds cross-tabulation matrix", () => {
    const cross = computeCrossTab(items, options, submissions, 1, 3);
    expect(cross).not.toBeNull();
    expect(cross!.total).toBe(3);
    const eastTech = cross!.cells.find(c => c.rowValue === "East" && c.colValue === "Tech");
    expect(eastTech?.count).toBe(2);
  });

  it("compares matching field labels across forms", () => {
    const compare = compareFieldAcrossForms(
      [
        {
          formId: 10,
          formName: "Form A",
          items,
          options,
          submissions,
        },
        {
          formId: 11,
          formName: "Form B",
          items: [{ id: 99, label: "Region", itemType: "select", sortOrder: 0 }],
          options: [{ itemId: 99, label: "North", value: "north", sortOrder: 0 }],
          submissions: parseSubmissions([
            { id: 9, responses: JSON.stringify({ "99": "north" }) },
          ]),
        },
      ],
      "Region",
    );
    expect(compare).toHaveLength(2);
    expect(compare[0].distribution.find(d => d.value === "east")?.count).toBe(2);
    expect(compare[1].distribution[0].count).toBe(1);
  });

  it("stores analytics reports in themeSettings", () => {
    const theme = JSON.stringify({ primaryColor: "#000" });
    const merged = mergeFormAnalyticsIntoTheme(theme, {
      reports: [
        {
          id: "r1",
          name: "Public",
          token: "abc",
          showTable: true,
          showCharts: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });
    const parsed = parseFormAnalyticsSettings(merged);
    expect(parsed.reports[0].name).toBe("Public");
  });

  it("filters submissions before analytics", () => {
    const rows = [
      { id: 1, responses: JSON.stringify({ "1": "east" }) },
      { id: 2, responses: JSON.stringify({ "1": "west" }) },
    ];
    const filtered = filterSubmissions(rows, {
      id: "f1",
      name: "East only",
      logic: "AND",
      conditions: [{ fieldId: "1", operator: "equals", value: "east" }],
    });
    expect(filtered).toHaveLength(1);
    expect(applySavedFilter(rows, {
      id: "f1",
      name: "East only",
      logic: "AND",
      conditions: [{ fieldId: "1", operator: "equals", value: "east" }],
    })).toHaveLength(1);
  });
});
