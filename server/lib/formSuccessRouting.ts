/**
 * formSuccessRouting.ts
 * Rule-based, deterministic success module selection after form submission.
 */

import type { GeneralFormSuccessModule, GeneralFormTemplate } from "../../drizzle/schema";

export const SUCCESS_SPECIAL_FIELDS = [
  { value: "__score_percent__", label: "Score (%)" },
  { value: "__score__", label: "Score (points)" },
  { value: "__max_score__", label: "Max score" },
  { value: "__pass_status__", label: "Pass / Fail status" },
  { value: "__payment_status__", label: "Payment status" },
] as const;

export type SuccessModuleType = "inline_message" | "full_page" | "redirect_url";

export interface FormSuccessCondition {
  id?: string;
  fieldId: string;
  operator: string;
  value: string;
  /** Stable reference to the option row — survives label/value renames. Takes precedence over `value` for choice-field matching. */
  optionId?: number | string;
}

export interface FormSuccessRoutingRuleInput {
  id?: number;
  ruleLabel?: string;
  successModuleId: number;
  logicOperator: "all" | "any";
  conditions: FormSuccessCondition[] | string;
  grantAccessActions?: string | null; // JSON: Array<{productType, productId}>
  sortOrder?: number;
  isEnabled?: boolean;
}

export interface FormSubmissionContext {
  responses: Record<string, unknown>;
  score: number;
  maxScore: number;
  passingScorePercent?: number | null;
  submissionId: number;
  formName?: string;
  paymentStatus?: string | null;
  submitterName?: string | null;
  submitterEmail?: string | null;
}

export interface SuccessOutcome {
  moduleId: number | null;
  moduleName: string;
  type: SuccessModuleType;
  inlineHtml?: string;
  pageBlocks?: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  redirectUrl?: string;
  mergeContext: Record<string, string>;
}

export interface MergeContext extends Record<string, string> {
  score: string;
  max_score: string;
  score_percent: string;
  pass_status: string;
  payment_status: string;
  name: string;
  email: string;
  reference_number: string;
  submission_id: string;
  form_name: string;
}

export function buildMergeContext(ctx: FormSubmissionContext): MergeContext {
  const scorePercent =
    ctx.maxScore > 0 ? Math.round((ctx.score / ctx.maxScore) * 100) : 0;
  let passStatus = "n/a";
  if (ctx.passingScorePercent != null && ctx.maxScore > 0) {
    passStatus = scorePercent >= ctx.passingScorePercent ? "pass" : "fail";
  }

  return {
    score: String(ctx.score),
    max_score: String(ctx.maxScore),
    score_percent: String(scorePercent),
    pass_status: passStatus,
    payment_status: ctx.paymentStatus ?? "none",
    name: ctx.submitterName ?? "",
    email: ctx.submitterEmail ?? "",
    reference_number: String(ctx.submissionId),
    submission_id: String(ctx.submissionId),
    form_name: ctx.formName ?? "",
  };
}

export function applyMergeFields(text: string, merge: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const normalized = key.toLowerCase();
    return merge[normalized] ?? "";
  });
}

function deepApplyMergeFields(value: unknown, merge: Record<string, string>): unknown {
  if (typeof value === "string") return applyMergeFields(value, merge);
  if (Array.isArray(value)) return value.map(v => deepApplyMergeFields(v, merge));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepApplyMergeFields(v, merge);
    }
    return out;
  }
  return value;
}

export function applyMergeFieldsToBlocks(
  blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>,
  merge: Record<string, string>,
): Array<{ id: string; type: string; data: Record<string, unknown> }> {
  return blocks.map(block => ({
    ...block,
    data: deepApplyMergeFields(block.data, merge) as Record<string, unknown>,
  }));
}

function getFieldValue(fieldId: string, ctx: FormSubmissionContext, merge: MergeContext): string {
  if (fieldId === "__score_percent__") return merge.score_percent;
  if (fieldId === "__score__") return merge.score;
  if (fieldId === "__max_score__") return merge.max_score;
  if (fieldId === "__pass_status__") return merge.pass_status;
  if (fieldId === "__payment_status__") return merge.payment_status;

  const raw = ctx.responses[fieldId];
  if (raw == null) return "";
  if (Array.isArray(raw)) return raw.join(",");
  return String(raw);
}

export function evaluateSuccessCondition(
  condition: FormSuccessCondition,
  ctx: FormSubmissionContext,
  merge: MergeContext,
  /** Optional: map of itemId -> [{id, label, value}] for ID-stable and label-as-fallback matching */
  optionsByItemId?: Record<string, Array<{ id: number; label: string; value: string }>>,
): boolean {
  const strVal = getFieldValue(condition.fieldId, ctx, merge);
  const numVal = parseFloat(strVal);
  const target = condition.value ?? "";

  // Resolution priority for choice fields:
  // 1. If condition stores optionId, resolve to the current value of that option (stable across renames)
  // 2. If target matches a value directly, use it as-is
  // 3. If target matches a label but not a value, resolve label -> value (backward compat)
  let resolvedTarget = target;
  if (optionsByItemId && condition.fieldId && optionsByItemId[condition.fieldId]) {
    const opts = optionsByItemId[condition.fieldId];
    if (condition.optionId != null) {
      // Priority 1: stable ID-based resolution
      const byId = opts.find(o => String(o.id) === String(condition.optionId));
      if (byId) {
        resolvedTarget = byId.value;
      } else {
        // Option was deleted — condition cannot match
        resolvedTarget = "__deleted_option__";
      }
    } else {
      // Priority 2 & 3: value-match then label-as-fallback (backward compat for old conditions)
      const byValue = opts.find(o => o.value === target);
      if (!byValue) {
        const byLabel = opts.find(o => o.label.toLowerCase() === target.toLowerCase());
        if (byLabel) resolvedTarget = byLabel.value;
      }
    }
  }

  switch (condition.operator) {
    case "equals":
      return strVal === resolvedTarget;
    case "not_equals":
      return strVal !== resolvedTarget;
    case "contains":
      return strVal.toLowerCase().includes(target.toLowerCase());
    case "not_contains":
      return !strVal.toLowerCase().includes(target.toLowerCase());
    case "starts_with":
      return strVal.toLowerCase().startsWith(target.toLowerCase());
    case "is_empty":
      return strVal === "";
    case "is_not_empty":
      return strVal !== "";
    case "greater_than":
      return !Number.isNaN(numVal) && numVal > parseFloat(target);
    case "less_than":
      return !Number.isNaN(numVal) && numVal < parseFloat(target);
    case "greater_or_equal":
      return !Number.isNaN(numVal) && numVal >= parseFloat(target);
    case "less_or_equal":
      return !Number.isNaN(numVal) && numVal <= parseFloat(target);
    default:
      return false;
  }
}

export function evaluateSuccessRule(
  rule: FormSuccessRoutingRuleInput,
  ctx: FormSubmissionContext,
  merge: MergeContext,
  optionsByItemId?: Record<string, Array<{ label: string; value: string }>>,
): boolean {
  if (rule.isEnabled === false) return false;
  let conditions: FormSuccessCondition[] = [];
  if (typeof rule.conditions === "string") {
    try {
      conditions = JSON.parse(rule.conditions);
    } catch {
      return false;
    }
  } else {
    conditions = rule.conditions;
  }
  if (!conditions.length) return false;
  const results = conditions.map(c => evaluateSuccessCondition(c, ctx, merge, optionsByItemId));
  return rule.logicOperator === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function selectSuccessModule(
  rules: FormSuccessRoutingRuleInput[],
  modules: GeneralFormSuccessModule[],
  defaultModuleId: number | null | undefined,
  ctx: FormSubmissionContext,
  optionsByItemId?: Record<string, Array<{ label: string; value: string }>>,
): GeneralFormSuccessModule | null {
  const enabledModules = modules.filter(m => m.isEnabled);
  const moduleById = new Map(enabledModules.map(m => [m.id, m]));
  const merge = buildMergeContext(ctx);

  const sortedRules = [...rules]
    .filter(r => r.isEnabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const rule of sortedRules) {
    if (!evaluateSuccessRule(rule, ctx, merge, optionsByItemId)) continue;
    const mod = moduleById.get(rule.successModuleId);
    if (mod) return mod;
  }

  if (defaultModuleId != null) {
    const def = moduleById.get(defaultModuleId);
    if (def) return def;
  }

  return enabledModules.sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}

/**
 * Like selectSuccessModule but also returns the matched rule (for grantAccessActions).
 */
export function selectSuccessModuleWithRule(
  rules: FormSuccessRoutingRuleInput[],
  modules: GeneralFormSuccessModule[],
  defaultModuleId: number | null | undefined,
  ctx: FormSubmissionContext,
  optionsByItemId?: Record<string, Array<{ label: string; value: string }>>,
): { module: GeneralFormSuccessModule | null; matchedRule: FormSuccessRoutingRuleInput | null } {
  const enabledModules = modules.filter(m => m.isEnabled);
  const moduleById = new Map(enabledModules.map(m => [m.id, m]));
  const merge = buildMergeContext(ctx);

  const sortedRules = [...rules]
    .filter(r => r.isEnabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const rule of sortedRules) {
    if (!evaluateSuccessRule(rule, ctx, merge, optionsByItemId)) continue;
    const mod = moduleById.get(rule.successModuleId);
    if (mod) return { module: mod, matchedRule: rule };
  }

  if (defaultModuleId != null) {
    const def = moduleById.get(defaultModuleId);
    if (def) return { module: def, matchedRule: null };
  }

  const fallback = enabledModules.sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
  return { module: fallback, matchedRule: null };
}

export function buildSuccessOutcome(
  module: GeneralFormSuccessModule | null,
  template: Pick<GeneralFormTemplate, "successMessage" | "successRedirectUrl" | "name">,
  ctx: FormSubmissionContext,
): SuccessOutcome {
  const merge = buildMergeContext(ctx);
  const mergeContext: Record<string, string> = { ...merge };

  if (!module) {
    return resolveLegacySuccessOutcome(template, mergeContext);
  }

  const base: SuccessOutcome = {
    moduleId: module.id,
    moduleName: module.name,
    type: module.moduleType as SuccessModuleType,
    mergeContext,
  };

  if (module.moduleType === "inline_message") {
    return {
      ...base,
      inlineHtml: applyMergeFields(module.inlineContent ?? "", mergeContext),
    };
  }

  if (module.moduleType === "full_page") {
    let blocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
    try {
      blocks = JSON.parse(module.pageContent ?? "[]");
    } catch {
      blocks = [];
    }
    return {
      ...base,
      pageBlocks: applyMergeFieldsToBlocks(blocks, mergeContext),
    };
  }

  if (module.moduleType === "redirect_url") {
    return {
      ...base,
      redirectUrl: applyMergeFields(module.redirectUrl ?? "", mergeContext),
    };
  }

  return resolveLegacySuccessOutcome(template, mergeContext);
}

export function resolveLegacySuccessOutcome(
  template: Pick<GeneralFormTemplate, "successMessage" | "successRedirectUrl" | "name">,
  mergeContext: Record<string, string>,
): SuccessOutcome {
  if (template.successRedirectUrl) {
    return {
      moduleId: null,
      moduleName: "Legacy Redirect",
      type: "redirect_url",
      redirectUrl: applyMergeFields(template.successRedirectUrl, mergeContext),
      mergeContext,
    };
  }
  return {
    moduleId: null,
    moduleName: "Legacy Thank You",
    type: "inline_message",
    inlineHtml: applyMergeFields(
      template.successMessage ?? "Your response has been submitted successfully.",
      mergeContext,
    ),
    mergeContext,
  };
}

export function extractSubmitterInfo(responses: Record<string, unknown>): {
  name: string | null;
  email: string | null;
} {
  let email: string | null = null;
  let name: string | null = null;
  for (const val of Object.values(responses)) {
    if (typeof val === "string" && val.includes("@") && val.includes(".")) {
      email = val.trim().toLowerCase();
    }
    if (typeof val === "string" && !val.includes("@") && val.trim().length > 1 && !name) {
      name = val.trim();
    }
  }
  return { name, email };
}
