/**
 * funnelBranchEngine.ts
 * Evaluates funnel branch rules against a visitor context to determine
 * which page (or URL) to redirect to next.
 *
 * Rules are evaluated in ascending priority order (lower number = higher priority).
 * The first rule whose conditions all match (matchMode="all") or any match (matchMode="any")
 * wins and its target is returned.
 * If no rule matches, null is returned and the caller falls back to nextPageId.
 */

import type { FunnelBranchRule, FunnelBranchCondition } from "../../drizzle/schema";

// ─── Visitor Context ──────────────────────────────────────────────────────────
// Passed in from the checkout form / page load. All fields are optional.
export interface VisitorContext {
  /** Products purchased in this session: "course:5", "download:3", "bundle:1" */
  productsPurchased?: string[];
  /** Order bumps selected: "course:5", "download:3" */
  orderBumpsSelected?: string[];
  /** Visitor email address */
  email?: string;
  /** Total purchase amount in cents */
  purchasePrice?: number;
  /** Full source URL (referrer or current URL) */
  sourceUrl?: string;
  /** UTM parameters */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** ISO country code e.g. "US" */
  country?: string;
  /** "mobile" | "tablet" | "desktop" */
  deviceType?: string;
  /** Custom form fields: { fieldName: value } */
  customFields?: Record<string, string>;
  /** Current timestamp (defaults to Date.now()) */
  now?: number;
}

// ─── Rule with conditions ─────────────────────────────────────────────────────
export interface RuleWithConditions extends FunnelBranchRule {
  conditions: FunnelBranchCondition[];
}

// ─── Evaluate a single condition ─────────────────────────────────────────────
function getVariableValue(variable: string, value: string, ctx: VisitorContext): string | string[] | number | null {
  switch (variable) {
    case "product_purchased":
      return ctx.productsPurchased ?? [];
    case "order_bump_selected":
      return ctx.orderBumpsSelected ?? [];
    case "email_contains":
    case "email_domain":
      return ctx.email ?? null;
    case "purchase_price":
      return ctx.purchasePrice ?? null;
    case "source_url":
      return ctx.sourceUrl ?? null;
    case "utm_source":
      return ctx.utmSource ?? null;
    case "utm_medium":
      return ctx.utmMedium ?? null;
    case "utm_campaign":
      return ctx.utmCampaign ?? null;
    case "date_range":
      return ctx.now ?? Date.now();
    case "day_of_week":
      return new Date(ctx.now ?? Date.now()).getDay(); // 0=Sun
    case "hour_of_day":
      return new Date(ctx.now ?? Date.now()).getHours(); // 0-23
    case "country":
      return ctx.country ?? null;
    case "device_type":
      return ctx.deviceType ?? null;
    case "custom_field": {
      // value format: "fieldName:expectedValue" — we extract the field name
      // The actual comparison value (after colon) is handled in evaluateCondition
      const colonIdx = value.indexOf(":");
      const fieldName = colonIdx >= 0 ? value.substring(0, colonIdx) : value;
      return ctx.customFields?.[fieldName] ?? null;
    }
    default:
      return null;
  }
}

function evaluateCondition(cond: FunnelBranchCondition, ctx: VisitorContext): boolean {
  const { variable, operator } = cond;
  // For custom_field, the condition value is "fieldName:expectedValue"
  // We compare against the part after the colon
  let value = cond.value;
  if (variable === "custom_field") {
    const colonIdx = cond.value.indexOf(":");
    if (colonIdx >= 0) value = cond.value.substring(colonIdx + 1);
  }
  const actual = getVariableValue(variable, cond.value, ctx);

  // is_set / is_not_set work on any type
  if (operator === "is_set") return actual !== null && actual !== "" && (Array.isArray(actual) ? actual.length > 0 : true);
  if (operator === "is_not_set") return actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0);

  // Array variables (product_purchased, order_bump_selected) use membership checks
  if (Array.isArray(actual)) {
    const list = actual as string[];
    switch (operator) {
      case "equals":
      case "in_list":
        return list.includes(value);
      case "not_equals":
      case "not_in_list":
        return !list.includes(value);
      case "contains":
        return list.some(item => item.includes(value));
      case "not_contains":
        return !list.some(item => item.includes(value));
      default:
        return false;
    }
  }

  if (actual === null) return false;

  // Numeric comparisons
  if (variable === "purchase_price" || variable === "day_of_week" || variable === "hour_of_day") {
    const num = typeof actual === "number" ? actual : parseFloat(String(actual));
    switch (operator) {
      case "equals":      return num === parseFloat(value);
      case "not_equals":  return num !== parseFloat(value);
      case "greater_than": return num > parseFloat(value);
      case "less_than":   return num < parseFloat(value);
      case "between": {
        const [lo, hi] = value.split("|").map(parseFloat);
        return num >= lo && num <= hi;
      }
      case "in_list":     return value.split(",").map(parseFloat).includes(num);
      case "not_in_list": return !value.split(",").map(parseFloat).includes(num);
      default: return false;
    }
  }

  // Date range variable: actual is timestamp (ms), value is "YYYY-MM-DD|YYYY-MM-DD"
  if (variable === "date_range") {
    const ts = typeof actual === "number" ? actual : Date.now();
    const [startStr, endStr] = value.split("|");
    const start = startStr ? new Date(startStr).getTime() : 0;
    const end = endStr ? new Date(endStr + "T23:59:59").getTime() : Infinity;
    if (operator === "between") return ts >= start && ts <= end;
    if (operator === "equals") return ts >= start && ts <= end; // treat equals as "within range"
    if (operator === "not_equals") return ts < start || ts > end;
    return false;
  }

  // String comparisons
  const str = String(actual).toLowerCase();
  const expected = variable === "email_domain"
    ? value.toLowerCase()
    : value.toLowerCase();

  switch (operator) {
    case "equals":      return str === expected;
    case "not_equals":  return str !== expected;
    case "contains":    return str.includes(expected);
    case "not_contains": return !str.includes(expected);
    case "starts_with": return str.startsWith(expected);
    case "ends_with":   return str.endsWith(expected);
    case "in_list":     return expected.split(",").map(s => s.trim()).includes(str);
    case "not_in_list": return !expected.split(",").map(s => s.trim()).includes(str);
    default: return false;
  }
}

// ─── Evaluate all rules for a page ───────────────────────────────────────────
export interface BranchResult {
  ruleId: number;
  ruleName: string;
  targetPageId: number | null;
  targetUrl: string | null;
}

export function evaluateBranchRules(
  rules: RuleWithConditions[],
  ctx: VisitorContext
): BranchResult | null {
  // Sort by priority ascending (lower = higher priority)
  const sorted = [...rules]
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const { conditions, matchMode } = rule;
    if (conditions.length === 0) continue; // skip empty rules

    const results = conditions.map(c => evaluateCondition(c, ctx));
    const matches = matchMode === "any"
      ? results.some(Boolean)
      : results.every(Boolean);

    if (matches) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        targetPageId: rule.targetPageId ?? null,
        targetUrl: rule.targetUrl ?? null,
      };
    }
  }

  return null; // no rule matched — use default nextPageId
}
