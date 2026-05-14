/**
 * funnelBranchEngine.test.ts
 * Tests for the conditional funnel branching rules engine.
 */
import { describe, it, expect } from "vitest";
import { evaluateBranchRules, type RuleWithConditions, type VisitorContext } from "./lib/funnelBranchEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<RuleWithConditions> = {}): RuleWithConditions {
  return {
    id: 1,
    funnelPageId: 10,
    name: "Test Rule",
    priority: 0,
    matchMode: "all",
    targetPageId: 99,
    targetUrl: null,
    isActive: true,
    createdAt: new Date(),
    conditions: [],
    ...overrides,
  };
}

function makeCondition(variable: string, operator: string, value: string) {
  return { id: 1, branchRuleId: 1, variable, operator, value };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateBranchRules", () => {
  // ── No rules ────────────────────────────────────────────────────────────────
  it("returns null when there are no rules", () => {
    expect(evaluateBranchRules([], {})).toBeNull();
  });

  it("returns null when the only rule is inactive", () => {
    const rule = makeRule({
      isActive: false,
      conditions: [makeCondition("email_contains", "contains", "test")],
    });
    expect(evaluateBranchRules([rule], { email: "test@example.com" })).toBeNull();
  });

  it("skips rules with no conditions", () => {
    const rule = makeRule({ conditions: [] });
    expect(evaluateBranchRules([rule], {})).toBeNull();
  });

  // ── product_purchased ────────────────────────────────────────────────────────
  it("matches product_purchased equals", () => {
    const rule = makeRule({
      conditions: [makeCondition("product_purchased", "equals", "course:5")],
    });
    const ctx: VisitorContext = { productsPurchased: ["course:5", "download:3"] };
    const result = evaluateBranchRules([rule], ctx);
    expect(result).not.toBeNull();
    expect(result!.targetPageId).toBe(99);
  });

  it("does not match product_purchased when product not in list", () => {
    const rule = makeRule({
      conditions: [makeCondition("product_purchased", "equals", "course:99")],
    });
    const ctx: VisitorContext = { productsPurchased: ["course:5"] };
    expect(evaluateBranchRules([rule], ctx)).toBeNull();
  });

  it("matches product_purchased not_equals (product not purchased)", () => {
    const rule = makeRule({
      conditions: [makeCondition("product_purchased", "not_equals", "course:99")],
    });
    const ctx: VisitorContext = { productsPurchased: ["course:5"] };
    expect(evaluateBranchRules([rule], ctx)).not.toBeNull();
  });

  // ── order_bump_selected ──────────────────────────────────────────────────────
  it("matches order_bump_selected", () => {
    const rule = makeRule({
      conditions: [makeCondition("order_bump_selected", "equals", "download:7")],
    });
    const ctx: VisitorContext = { orderBumpsSelected: ["download:7"] };
    expect(evaluateBranchRules([rule], ctx)).not.toBeNull();
  });

  // ── email_contains ───────────────────────────────────────────────────────────
  it("matches email contains", () => {
    const rule = makeRule({
      conditions: [makeCondition("email_contains", "contains", "gmail")],
    });
    expect(evaluateBranchRules([rule], { email: "user@gmail.com" })).not.toBeNull();
  });

  it("does not match email contains when email missing", () => {
    const rule = makeRule({
      conditions: [makeCondition("email_contains", "contains", "gmail")],
    });
    expect(evaluateBranchRules([rule], {})).toBeNull();
  });

  it("matches email_domain ends_with", () => {
    const rule = makeRule({
      conditions: [makeCondition("email_domain", "ends_with", ".edu")],
    });
    expect(evaluateBranchRules([rule], { email: "student@university.edu" })).not.toBeNull();
  });

  // ── purchase_price ───────────────────────────────────────────────────────────
  it("matches purchase_price greater_than", () => {
    const rule = makeRule({
      conditions: [makeCondition("purchase_price", "greater_than", "5000")],
    });
    expect(evaluateBranchRules([rule], { purchasePrice: 9900 })).not.toBeNull();
  });

  it("does not match purchase_price less_than when price is higher", () => {
    const rule = makeRule({
      conditions: [makeCondition("purchase_price", "less_than", "5000")],
    });
    expect(evaluateBranchRules([rule], { purchasePrice: 9900 })).toBeNull();
  });

  it("matches purchase_price between", () => {
    const rule = makeRule({
      conditions: [makeCondition("purchase_price", "between", "1000|5000")],
    });
    expect(evaluateBranchRules([rule], { purchasePrice: 2500 })).not.toBeNull();
    expect(evaluateBranchRules([rule], { purchasePrice: 9900 })).toBeNull();
  });

  // ── source_url ───────────────────────────────────────────────────────────────
  it("matches source_url contains", () => {
    const rule = makeRule({
      conditions: [makeCondition("source_url", "contains", "facebook.com")],
    });
    expect(evaluateBranchRules([rule], { sourceUrl: "https://facebook.com/ad" })).not.toBeNull();
  });

  // ── utm_source ───────────────────────────────────────────────────────────────
  it("matches utm_source equals", () => {
    const rule = makeRule({
      conditions: [makeCondition("utm_source", "equals", "newsletter")],
    });
    expect(evaluateBranchRules([rule], { utmSource: "newsletter" })).not.toBeNull();
    expect(evaluateBranchRules([rule], { utmSource: "google" })).toBeNull();
  });

  it("matches utm_campaign in_list", () => {
    const rule = makeRule({
      conditions: [makeCondition("utm_campaign", "in_list", "summer,winter,spring")],
    });
    expect(evaluateBranchRules([rule], { utmCampaign: "summer" })).not.toBeNull();
    expect(evaluateBranchRules([rule], { utmCampaign: "autumn" })).toBeNull();
  });

  // ── date_range ───────────────────────────────────────────────────────────────
  it("matches date_range between", () => {
    const rule = makeRule({
      conditions: [makeCondition("date_range", "between", "2020-01-01|2099-12-31")],
    });
    expect(evaluateBranchRules([rule], { now: Date.now() })).not.toBeNull();
  });

  it("does not match date_range outside range", () => {
    const rule = makeRule({
      conditions: [makeCondition("date_range", "between", "2020-01-01|2020-12-31")],
    });
    expect(evaluateBranchRules([rule], { now: Date.now() })).toBeNull();
  });

  //   // ── day_of_week ───────────────────────────────────────────────────
  it("matches day_of_week in_list", () => {
    // Use noon UTC on a Wednesday (2026-05-13) to avoid timezone boundary issues
    const wednesdayNoon = new Date("2026-05-13T12:00:00Z").getTime();
    const rule = makeRule({
      conditions: [makeCondition("day_of_week", "in_list", "1,2,3,4,5")], // weekdays
    });
    expect(evaluateBranchRules([rule], { now: wednesdayNoon })).not.toBeNull();
  });

  // ── device_type ───────────────────────────────────────────────────────────────
  it("matches device_type equals", () => {
    const rule = makeRule({
      conditions: [makeCondition("device_type", "equals", "mobile")],
    });
    expect(evaluateBranchRules([rule], { deviceType: "mobile" })).not.toBeNull();
    expect(evaluateBranchRules([rule], { deviceType: "desktop" })).toBeNull();
  });

  // ── is_set / is_not_set ───────────────────────────────────────────────────────
  it("matches is_set when email is provided", () => {
    const rule = makeRule({
      conditions: [makeCondition("email_contains", "is_set", "")],
    });
    expect(evaluateBranchRules([rule], { email: "user@example.com" })).not.toBeNull();
    expect(evaluateBranchRules([rule], {})).toBeNull();
  });

  it("matches is_not_set when email is missing", () => {
    const rule = makeRule({
      conditions: [makeCondition("email_contains", "is_not_set", "")],
    });
    expect(evaluateBranchRules([rule], {})).not.toBeNull();
    expect(evaluateBranchRules([rule], { email: "user@example.com" })).toBeNull();
  });

  // ── matchMode: any ────────────────────────────────────────────────────────────
  it("matchMode=any: matches if any condition is true", () => {
    const rule = makeRule({
      matchMode: "any",
      conditions: [
        makeCondition("utm_source", "equals", "facebook"),
        makeCondition("utm_source", "equals", "google"),
      ],
    });
    expect(evaluateBranchRules([rule], { utmSource: "google" })).not.toBeNull();
    expect(evaluateBranchRules([rule], { utmSource: "twitter" })).toBeNull();
  });

  // ── matchMode: all ────────────────────────────────────────────────────────────
  it("matchMode=all: requires all conditions to be true", () => {
    const rule = makeRule({
      matchMode: "all",
      conditions: [
        makeCondition("utm_source", "equals", "facebook"),
        makeCondition("device_type", "equals", "mobile"),
      ],
    });
    // Both match
    expect(evaluateBranchRules([rule], { utmSource: "facebook", deviceType: "mobile" })).not.toBeNull();
    // Only one matches
    expect(evaluateBranchRules([rule], { utmSource: "facebook", deviceType: "desktop" })).toBeNull();
  });

  // ── Priority ordering ─────────────────────────────────────────────────────────
  it("returns the highest priority (lowest number) matching rule", () => {
    const lowPriority = makeRule({
      id: 1,
      priority: 10,
      targetPageId: 100,
      conditions: [makeCondition("utm_source", "equals", "google")],
    });
    const highPriority = makeRule({
      id: 2,
      priority: 1,
      targetPageId: 200,
      conditions: [makeCondition("utm_source", "equals", "google")],
    });
    const result = evaluateBranchRules([lowPriority, highPriority], { utmSource: "google" });
    expect(result!.targetPageId).toBe(200); // high priority wins
  });

  // ── targetUrl ─────────────────────────────────────────────────────────────────
  it("returns targetUrl when set", () => {
    const rule = makeRule({
      targetPageId: null,
      targetUrl: "https://example.com/special",
      conditions: [makeCondition("utm_source", "equals", "email")],
    });
    const result = evaluateBranchRules([rule], { utmSource: "email" });
    expect(result!.targetUrl).toBe("https://example.com/special");
  });

  // ── custom_field ──────────────────────────────────────────────────────────────
  it("matches custom_field value", () => {
    const rule = makeRule({
      conditions: [makeCondition("custom_field", "equals", "plan:pro")],
    });
    expect(evaluateBranchRules([rule], { customFields: { plan: "pro" } })).not.toBeNull();
    expect(evaluateBranchRules([rule], { customFields: { plan: "basic" } })).toBeNull();
  });
});
