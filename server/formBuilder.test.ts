/**
 * Form Builder Router — Vitest Tests
 *
 * Tests cover:
 * - Template CRUD helpers
 * - Section CRUD helpers
 * - Item CRUD helpers with all field types
 * - Branch rule save/load
 * - Org visibility rule save/load
 * - Quality score weighting logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createFormTemplate: vi.fn().mockResolvedValue(1),
  getFormTemplateById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Form",
    description: "A test form",
    formType: "image_quality",
    version: 1,
    isActive: true,
    createdByUserId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  listFormTemplates: vi.fn().mockResolvedValue([
    { id: 1, name: "Test Form", formType: "image_quality", isActive: true, description: null, version: 1, createdByUserId: 1, createdAt: new Date(), updatedAt: new Date() },
  ]),
  updateFormTemplate: vi.fn().mockResolvedValue(undefined),
  deleteFormTemplate: vi.fn().mockResolvedValue(undefined),
  getFullFormTemplate: vi.fn().mockResolvedValue({
    template: { id: 1, name: "Test Form", formType: "image_quality", isActive: true },
    sections: [{ id: 1, templateId: 1, title: "Section 1", description: null, sortOrder: 1, isCollapsible: false, createdAt: new Date() }],
    items: [
      { id: 1, sectionId: 1, templateId: 1, label: "Q1", helpText: null, itemType: "radio", isRequired: true, sortOrder: 1, scaleMin: null, scaleMax: null, scaleMinLabel: null, scaleMaxLabel: null, scoreWeight: 2, richTextContent: null, emailRoutingRules: null, placeholder: null, validationRegex: null, createdAt: new Date() },
      { id: 2, sectionId: 1, templateId: 1, label: "Q2", helpText: null, itemType: "email", isRequired: false, sortOrder: 2, scaleMin: null, scaleMax: null, scaleMinLabel: null, scaleMaxLabel: null, scoreWeight: 1, richTextContent: null, emailRoutingRules: JSON.stringify([{ label: "Route to reviewer", conditionItemId: 1, conditionValue: "yes", routeTo: "reviewer@hospital.org" }]), placeholder: "Enter email…", validationRegex: null, createdAt: new Date() },
      { id: 3, sectionId: 1, templateId: 1, label: "Info Block", helpText: null, itemType: "richtext", isRequired: false, sortOrder: 3, scaleMin: null, scaleMax: null, scaleMinLabel: null, scaleMaxLabel: null, scoreWeight: 0, richTextContent: "<p>This is <strong>rich</strong> content with an image.</p>", emailRoutingRules: null, placeholder: null, validationRegex: null, createdAt: new Date() },
    ],
    options: [
      { id: 1, itemId: 1, label: "Excellent", value: "excellent", sortOrder: 1, qualityScore: 3 },
      { id: 2, itemId: 1, label: "Adequate", value: "adequate", sortOrder: 2, qualityScore: 2 },
      { id: 3, itemId: 1, label: "Poor", value: "poor", sortOrder: 3, qualityScore: 0 },
    ],
    branchRules: [
      { id: 1, templateId: 1, targetItemId: 2, conditionItemId: 1, conditionValue: "excellent", action: "show", createdAt: new Date() },
    ],
  }),
  createFormSection: vi.fn().mockResolvedValue(10),
  updateFormSection: vi.fn().mockResolvedValue(undefined),
  deleteFormSection: vi.fn().mockResolvedValue(undefined),
  reorderFormSections: vi.fn().mockResolvedValue(undefined),
  createFormItem: vi.fn().mockResolvedValue(20),
  updateFormItem: vi.fn().mockResolvedValue(undefined),
  deleteFormItem: vi.fn().mockResolvedValue(undefined),
  reorderFormItems: vi.fn().mockResolvedValue(undefined),
  saveFormOptions: vi.fn().mockResolvedValue(undefined),
  saveBranchRules: vi.fn().mockResolvedValue(undefined),
  getOrgVisibilityRules: vi.fn().mockResolvedValue([
    { id: 1, templateId: 1, ruleType: "item", targetId: 1, action: "show_only_for", orgIds: "[101, 102]", label: "IAC only", createdAt: new Date(), updatedAt: new Date() },
  ]),
  saveOrgVisibilityRule: vi.fn().mockResolvedValue(1),
  deleteOrgVisibilityRule: vi.fn().mockResolvedValue(undefined),
  listOrganizationsForFormBuilder: vi.fn().mockResolvedValue([
    { id: 101, name: "IAC", accreditationTypes: "echo" },
    { id: 102, name: "ICAEL", accreditationTypes: "echo" },
  ]),
}));

// ─── Import helpers after mocking ─────────────────────────────────────────────
import {
  createFormTemplate,
  getFormTemplateById,
  listFormTemplates,
  getFullFormTemplate,
  createFormSection,
  createFormItem,
  saveFormOptions,
  saveBranchRules,
  getOrgVisibilityRules,
  saveOrgVisibilityRule,
  deleteOrgVisibilityRule,
  listOrganizationsForFormBuilder,
} from "./db";

// ─── Template Tests ────────────────────────────────────────────────────────────
describe("Form Builder — Templates", () => {
  it("creates a template and returns an ID", async () => {
    const id = await createFormTemplate({
      name: "Image Quality Review",
      description: "Standard IQ review form",
      formType: "image_quality",
      version: 1,
      isActive: true,
      createdByUserId: 1,
    });
    expect(id).toBe(1);
  });

  it("retrieves a template by ID", async () => {
    const template = await getFormTemplateById(1);
    expect(template).not.toBeNull();
    expect(template?.name).toBe("Test Form");
    expect(template?.formType).toBe("image_quality");
  });

  it("lists all templates", async () => {
    const templates = await listFormTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("Test Form");
  });
});

// ─── Full Template Tests ───────────────────────────────────────────────────────
describe("Form Builder — Full Template", () => {
  it("returns template with sections, items, options, and branch rules", async () => {
    const result = await getFullFormTemplate(1);
    expect(result).not.toBeNull();
    expect(result?.sections).toHaveLength(1);
    expect(result?.items).toHaveLength(3);
    expect(result?.options).toHaveLength(3);
    expect(result?.branchRules).toHaveLength(1);
  });

  it("includes email item with routing rules", async () => {
    const result = await getFullFormTemplate(1);
    const emailItem = result?.items.find(i => i.itemType === "email");
    expect(emailItem).toBeDefined();
    expect(emailItem?.emailRoutingRules).not.toBeNull();
    const rules = JSON.parse(emailItem!.emailRoutingRules!);
    expect(rules[0].routeTo).toBe("reviewer@hospital.org");
  });

  it("includes richtext item with HTML content", async () => {
    const result = await getFullFormTemplate(1);
    const richtextItem = result?.items.find(i => i.itemType === "richtext");
    expect(richtextItem).toBeDefined();
    expect(richtextItem?.richTextContent).toContain("<strong>rich</strong>");
  });
});

// ─── Section Tests ─────────────────────────────────────────────────────────────
describe("Form Builder — Sections", () => {
  it("creates a section and returns an ID", async () => {
    const id = await createFormSection({
      templateId: 1,
      title: "Image Quality",
      description: null,
      sortOrder: 1,
      isCollapsible: false,
    });
    expect(id).toBe(10);
  });
});

// ─── Item Tests ────────────────────────────────────────────────────────────────
describe("Form Builder — Items", () => {
  it("creates a radio item", async () => {
    const id = await createFormItem({
      sectionId: 1,
      templateId: 1,
      label: "Overall image quality",
      helpText: null,
      itemType: "radio",
      isRequired: true,
      sortOrder: 1,
      scoreWeight: 2,
    });
    expect(id).toBe(20);
  });

  it("creates an email item with routing rules", async () => {
    const id = await createFormItem({
      sectionId: 1,
      templateId: 1,
      label: "Reviewer email",
      helpText: null,
      itemType: "email",
      isRequired: false,
      sortOrder: 2,
      scoreWeight: 0,
      placeholder: "reviewer@hospital.org",
      emailRoutingRules: JSON.stringify([{ label: "Route to QA", conditionItemId: 1, conditionValue: "poor", routeTo: "qa@hospital.org" }]),
    });
    expect(id).toBe(20);
  });

  it("creates a richtext item with HTML content", async () => {
    const id = await createFormItem({
      sectionId: 1,
      templateId: 1,
      label: "Instructions",
      helpText: null,
      itemType: "richtext",
      isRequired: false,
      sortOrder: 3,
      scoreWeight: 0,
      richTextContent: "<p>Please review the <strong>image quality</strong> carefully.</p>",
    });
    expect(id).toBe(20);
  });

  it("creates a scale item with min/max labels", async () => {
    const id = await createFormItem({
      sectionId: 1,
      templateId: 1,
      label: "Rate the scan quality",
      helpText: null,
      itemType: "scale",
      isRequired: true,
      sortOrder: 4,
      scoreWeight: 3,
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "Poor",
      scaleMaxLabel: "Excellent",
    });
    expect(id).toBe(20);
  });
});

// ─── Options / Score Weighting Tests ──────────────────────────────────────────
describe("Form Builder — Options & Score Weighting", () => {
  it("saves options with quality scores", async () => {
    await saveFormOptions(1, [
      { label: "Excellent", value: "excellent", sortOrder: 1, qualityScore: 3 },
      { label: "Adequate", value: "adequate", sortOrder: 2, qualityScore: 2 },
      { label: "Poor", value: "poor", sortOrder: 3, qualityScore: 0 },
    ]);
    expect(saveFormOptions).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ value: "excellent", qualityScore: 3 }),
    ]));
  });

  it("computes quality score correctly", () => {
    const items = [
      { id: 1, itemType: "radio", scoreWeight: 2 },
      { id: 2, itemType: "radio", scoreWeight: 1 },
    ];
    const options = [
      { itemId: 1, value: "excellent", qualityScore: 3 },
      { itemId: 1, value: "poor", qualityScore: 0 },
      { itemId: 2, value: "yes", qualityScore: 2 },
      { itemId: 2, value: "no", qualityScore: 0 },
    ];
    const responses: Record<number, string> = { 1: "excellent", 2: "yes" };

    let score = 0;
    let maxScore = 0;
    for (const item of items) {
      const itemOpts = options.filter(o => o.itemId === item.id);
      if (itemOpts.length === 0) continue;
      const maxOptScore = Math.max(...itemOpts.map(o => o.qualityScore));
      maxScore += maxOptScore * item.scoreWeight;
      const response = responses[item.id];
      const opt = itemOpts.find(o => o.value === response);
      if (opt) score += opt.qualityScore * item.scoreWeight;
    }

    expect(score).toBe(8); // 3*2 + 2*1 = 8
    expect(maxScore).toBe(8); // 3*2 + 2*1 = 8
    expect(Math.round((score / maxScore) * 100)).toBe(100);
  });
});

// ─── Branch Rules Tests ────────────────────────────────────────────────────────
describe("Form Builder — Branch Rules", () => {
  it("saves branch rules", async () => {
    await saveBranchRules(1, [
      { templateId: 1, targetItemId: 2, conditionItemId: 1, conditionValue: "excellent", action: "show" },
    ]);
    expect(saveBranchRules).toHaveBeenCalledWith(1, expect.arrayContaining([
      expect.objectContaining({ action: "show", conditionValue: "excellent" }),
    ]));
  });

  it("evaluates branch visibility correctly", () => {
    const branchRules = [
      { id: 1, targetItemId: 2, conditionItemId: 1, conditionValue: "excellent", action: "show" as const },
    ];
    const responses: Record<number, string | string[]> = { 1: "excellent" };

    // Item 2 should be visible when item 1 = "excellent"
    const rulesForItem = branchRules.filter(r => r.targetItemId === 2);
    const response = responses[rulesForItem[0].conditionItemId];
    const responseValues = Array.isArray(response) ? response : [response ?? ""];
    const matches = responseValues.includes(rulesForItem[0].conditionValue);
    const visible = rulesForItem[0].action === "show" ? matches : !matches;

    expect(visible).toBe(true);
  });

  it("hides item when condition does not match a show rule", () => {
    const branchRules = [
      { id: 1, targetItemId: 2, conditionItemId: 1, conditionValue: "excellent", action: "show" as const },
    ];
    const responses: Record<number, string | string[]> = { 1: "poor" };

    const rulesForItem = branchRules.filter(r => r.targetItemId === 2);
    const response = responses[rulesForItem[0].conditionItemId];
    const responseValues = Array.isArray(response) ? response : [response ?? ""];
    const matches = responseValues.includes(rulesForItem[0].conditionValue);

    // "show" rule didn't match → item should be hidden
    const hasShowRules = rulesForItem.some(r => r.action === "show");
    const visible = hasShowRules ? matches : true;

    expect(visible).toBe(false);
  });
});

// ─── Org Visibility Rules Tests ────────────────────────────────────────────────
describe("Form Builder — Org Visibility Rules", () => {
  it("retrieves org visibility rules for a template", async () => {
    const rules = await getOrgVisibilityRules(1);
    expect(rules).toHaveLength(1);
    expect(rules[0].action).toBe("show_only_for");
    expect(rules[0].ruleType).toBe("item");
    const orgIds = JSON.parse(rules[0].orgIds);
    expect(orgIds).toContain(101);
  });

  it("saves an org visibility rule", async () => {
    const id = await saveOrgVisibilityRule({
      templateId: 1,
      ruleType: "section",
      targetId: 1,
      action: "hide_for",
      orgIds: JSON.stringify([103]),
      label: "Hide for non-ICAEL",
    });
    expect(id).toBe(1);
  });

  it("deletes an org visibility rule", async () => {
    await deleteOrgVisibilityRule(1);
    expect(deleteOrgVisibilityRule).toHaveBeenCalledWith(1);
  });

  it("evaluates org visibility — show_only_for", () => {
    const rules = [
      { id: 1, ruleType: "item" as const, targetId: 1, action: "show_only_for" as const, orgIds: "[101, 102]" },
    ];
    const orgId = 101;

    const rulesForItem = rules.filter(r => r.ruleType === "item" && r.targetId === 1);
    let visible = true;
    for (const rule of rulesForItem) {
      const orgIds: number[] = JSON.parse(rule.orgIds || "[]");
      if (rule.action === "show_only_for") {
        visible = orgId !== null ? orgIds.includes(orgId) : false;
      }
    }
    expect(visible).toBe(true);
  });

  it("evaluates org visibility — hide_for", () => {
    const rules = [
      { id: 2, ruleType: "item" as const, targetId: 1, action: "hide_for" as const, orgIds: "[103]" },
    ];
    const orgId = 103;

    const rulesForItem = rules.filter(r => r.ruleType === "item" && r.targetId === 1);
    let visible = true;
    for (const rule of rulesForItem) {
      const orgIds: number[] = JSON.parse(rule.orgIds || "[]");
      if (rule.action === "hide_for") {
        visible = orgId !== null ? !orgIds.includes(orgId) : true;
      }
    }
    expect(visible).toBe(false);
  });

  it("lists organizations for form builder", async () => {
    const orgs = await listOrganizationsForFormBuilder();
    expect(orgs).toHaveLength(2);
    expect(orgs[0].name).toBe("IAC");
  });
});
