import { describe, it, expect } from "vitest";
import {
  applyMergeFields,
  buildMergeContext,
  buildSuccessOutcome,
  evaluateSuccessCondition,
  evaluateSuccessRule,
  selectSuccessModule,
} from "./formSuccessRouting";
import type { GeneralFormSuccessModule } from "../../drizzle/schema";

const baseCtx = {
  responses: { "42": "webinar certificate", "10": "Jane Doe", "11": "jane@example.com" },
  score: 8,
  maxScore: 10,
  passingScorePercent: 80,
  submissionId: 1001,
  formName: "CME Post-Test",
  paymentStatus: "completed",
  submitterName: "Jane Doe",
  submitterEmail: "jane@example.com",
};

function makeModule(overrides: Partial<GeneralFormSuccessModule>): GeneralFormSuccessModule {
  return {
    id: 1,
    templateId: 1,
    name: "Default",
    moduleType: "inline_message",
    inlineContent: "<p>Thanks {{name}}!</p>",
    pageContent: null,
    redirectUrl: null,
    isEnabled: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GeneralFormSuccessModule;
}

describe("formSuccessRouting", () => {
  it("builds merge context with pass status", () => {
    const merge = buildMergeContext(baseCtx);
    expect(merge.score_percent).toBe("80");
    expect(merge.pass_status).toBe("pass");
    expect(merge.payment_status).toBe("completed");
    expect(merge.reference_number).toBe("1001");
  });

  it("applies merge fields", () => {
    const merge = buildMergeContext(baseCtx);
    expect(applyMergeFields("Score: {{score_percent}}%", merge)).toBe("Score: 80%");
  });

  it("evaluates score percent conditions", () => {
    const merge = buildMergeContext(baseCtx);
    expect(
      evaluateSuccessCondition(
        { fieldId: "__score_percent__", operator: "greater_or_equal", value: "80" },
        baseCtx,
        merge,
      ),
    ).toBe(true);
    expect(
      evaluateSuccessCondition(
        { fieldId: "__score_percent__", operator: "less_than", value: "80" },
        baseCtx,
        merge,
      ),
    ).toBe(false);
  });

  it("evaluates pass status and field conditions", () => {
    const merge = buildMergeContext(baseCtx);
    expect(
      evaluateSuccessRule(
        {
          successModuleId: 2,
          logicOperator: "all",
          conditions: [{ fieldId: "__pass_status__", operator: "equals", value: "pass" }],
        },
        baseCtx,
        merge,
      ),
    ).toBe(true);
    expect(
      evaluateSuccessRule(
        {
          successModuleId: 3,
          logicOperator: "any",
          conditions: [{ fieldId: "42", operator: "contains", value: "certificate" }],
        },
        baseCtx,
        merge,
      ),
    ).toBe(true);
  });

  it("selects first matching rule by sort order", () => {
    const modules = [
      makeModule({ id: 1, name: "Default", sortOrder: 0 }),
      makeModule({ id: 2, name: "Passed", sortOrder: 1 }),
      makeModule({ id: 3, name: "Failed", sortOrder: 2, moduleType: "redirect_url", redirectUrl: "/retake" }),
    ];
    const rules = [
      {
        successModuleId: 3,
        logicOperator: "all" as const,
        sortOrder: 1,
        conditions: [{ fieldId: "__pass_status__", operator: "equals", value: "fail" }],
      },
      {
        successModuleId: 2,
        logicOperator: "all" as const,
        sortOrder: 0,
        conditions: [{ fieldId: "__pass_status__", operator: "equals", value: "pass" }],
      },
    ];
    const selected = selectSuccessModule(rules, modules, 1, baseCtx);
    expect(selected?.id).toBe(2);
  });

  it("falls back to default module when no rule matches", () => {
    const modules = [
      makeModule({ id: 1, name: "Default" }),
      makeModule({ id: 2, name: "Other" }),
    ];
    const selected = selectSuccessModule([], modules, 1, baseCtx);
    expect(selected?.id).toBe(1);
  });

  it("builds inline and redirect outcomes", () => {
    const mod = makeModule({ id: 5, inlineContent: "Hello {{name}}, ref {{reference_number}}" });
    const outcome = buildSuccessOutcome(mod, { successMessage: null, successRedirectUrl: null, name: "Form" }, baseCtx);
    expect(outcome.type).toBe("inline_message");
    expect(outcome.inlineHtml).toBe("Hello Jane Doe, ref 1001");

    const redirect = makeModule({
      id: 6,
      moduleType: "redirect_url",
      redirectUrl: "https://example.com?score={{score_percent}}",
    });
    const redirectOutcome = buildSuccessOutcome(
      redirect,
      { successMessage: null, successRedirectUrl: null, name: "Form" },
      baseCtx,
    );
    expect(redirectOutcome.redirectUrl).toBe("https://example.com?score=80");
  });
});
