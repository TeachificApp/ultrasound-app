/**
 * FormPreview — Live preview of a dynamic accreditation form.
 * Renders all sections/items with branching logic and org-based visibility applied.
 * Used in the Form Builder editor's Preview tab.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Eye,
  RefreshCw,
  CheckCircle2,
  Building2,
  Info,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormTemplate {
  id: number;
  name: string;
  description: string | null;
  formType: string;
  isActive: boolean;
}

interface FormSection {
  id: number;
  title: string;
  description: string | null;
  sortOrder: number;
}

interface FormItem {
  id: number;
  sectionId: number;
  label: string;
  helpText: string | null;
  itemType: string;
  isRequired: boolean;
  sortOrder: number;
  scaleMin: number | null;
  scaleMax: number | null;
  scaleMinLabel: string | null;
  scaleMaxLabel: string | null;
  scoreWeight: number;
  richTextContent: string | null;
  emailRoutingRules: string | null;
  placeholder: string | null;
  validationRegex: string | null;
}

interface FormOption {
  id?: number;
  itemId: number;
  label: string;
  value: string;
  sortOrder: number;
  qualityScore: number;
}

interface BranchRule {
  id: number;
  targetItemId: number;
  conditionItemId: number;
  conditionValue: string;
  action: "show" | "hide";
}

interface OrgVisibilityRule {
  id: number;
  ruleType: "item" | "section";
  targetId: number;
  action: "show_only_for" | "hide_for";
  orgIds: string; // JSON array
}

interface FormPreviewProps {
  template: FormTemplate;
  sections: FormSection[];
  items: FormItem[];
  options: FormOption[];
  branchRules: BranchRule[];
  orgVisibilityRules?: OrgVisibilityRule[];
  previewOrgId?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evaluateBranchVisibility(
  itemId: number,
  branchRules: BranchRule[],
  responses: Record<number, string | string[]>
): boolean {
  const rulesForItem = branchRules.filter(r => r.targetItemId === itemId);
  if (rulesForItem.length === 0) return true; // no rules = always visible

  for (const rule of rulesForItem) {
    const response = responses[rule.conditionItemId];
    const responseValues = Array.isArray(response) ? response : [response ?? ""];
    const matches = responseValues.includes(rule.conditionValue);

    if (rule.action === "show" && matches) return true;
    if (rule.action === "hide" && matches) return false;
  }

  // If all rules are "show" type and none matched, hide the item
  const hasShowRules = rulesForItem.some(r => r.action === "show");
  if (hasShowRules) return false;

  return true;
}

function evaluateOrgVisibility(
  id: number,
  type: "item" | "section",
  orgVisibilityRules: OrgVisibilityRule[],
  orgId: number | null
): boolean {
  const rules = orgVisibilityRules.filter(r => r.ruleType === type && r.targetId === id);
  if (rules.length === 0) return true; // no rules = visible to all

  for (const rule of rules) {
    const orgIds: number[] = JSON.parse(rule.orgIds || "[]");

    if (rule.action === "show_only_for") {
      // Visible only if orgId is in the list
      if (orgId === null) return false; // no org selected = hidden
      return orgIds.includes(orgId);
    }
    if (rule.action === "hide_for") {
      // Hidden if orgId is in the list
      if (orgId === null) return true; // no org = not hidden
      return !orgIds.includes(orgId);
    }
  }

  return true;
}

function computeQualityScore(
  items: FormItem[],
  options: FormOption[],
  responses: Record<number, string | string[]>
): { score: number; maxScore: number; percentage: number } {
  let score = 0;
  let maxScore = 0;

  for (const item of items) {
    if (["heading", "info", "text", "textarea"].includes(item.itemType)) continue;
    const itemOptions = options.filter(o => o.itemId === item.id);
    if (itemOptions.length === 0) continue;

    const maxOptionScore = Math.max(...itemOptions.map(o => o.qualityScore));
    maxScore += maxOptionScore * item.scoreWeight;

    const response = responses[item.id];
    const responseValues = Array.isArray(response) ? response : (response ? [response] : []);

    for (const val of responseValues) {
      const opt = itemOptions.find(o => o.value === val);
      if (opt) score += opt.qualityScore * item.scoreWeight;
    }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percentage };
}

// ─── Item Renderer ────────────────────────────────────────────────────────────

function ItemRenderer({
  item,
  options,
  value,
  onChange,
}: {
  item: FormItem;
  options: FormOption[];
  value: string | string[];
  onChange: (val: string | string[]) => void;
}) {
  const itemOptions = options.filter(o => o.itemId === item.id).sort((a, b) => a.sortOrder - b.sortOrder);

  if (item.itemType === "heading") {
    return (
      <h3 className="text-base font-bold text-gray-800 mt-2 mb-1 border-b border-gray-100 pb-2">
        {item.label}
      </h3>
    );
  }

  if (item.itemType === "info") {
    return (
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
        <div className="flex items-start gap-2 text-sm text-blue-700 mb-1">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{item.label}</p>
        </div>
        {item.richTextContent && (
          <div
            className="prose prose-sm max-w-none text-blue-800 pl-6"
            dangerouslySetInnerHTML={{ __html: item.richTextContent }}
          />
        )}
      </div>
    );
  }

  if (item.itemType === "richtext") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
          {item.label}
          {item.isRequired && <span className="text-red-500">*</span>}
        </label>
        {item.helpText && <p className="text-xs text-gray-400">{item.helpText}</p>}
        {item.richTextContent ? (
          <div
            className="prose prose-sm max-w-none p-3 rounded-lg border border-gray-200 bg-gray-50"
            dangerouslySetInnerHTML={{ __html: item.richTextContent }}
          />
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 italic">
            Rich text content will appear here
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
        {item.label}
        {item.isRequired && <span className="text-red-500">*</span>}
      </label>
      {item.helpText && (
        <p className="text-xs text-gray-400">{item.helpText}</p>
      )}

      {item.itemType === "text" && (
        <Input
          className="h-9 text-sm"
          placeholder={item.placeholder || "Enter text…"}
          value={typeof value === "string" ? value : ""}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {item.itemType === "textarea" && (
        <textarea
          className="w-full min-h-[80px] text-sm border border-gray-200 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#0891b2]/30"
          placeholder={item.placeholder || "Enter text…"}
          value={typeof value === "string" ? value : ""}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {item.itemType === "email" && (
        <div className="space-y-1">
          <Input
            type="email"
            className="h-9 text-sm"
            placeholder={item.placeholder || "Enter email address…"}
            value={typeof value === "string" ? value : ""}
            onChange={e => onChange(e.target.value)}
          />
          {item.emailRoutingRules && (
            <p className="text-xs text-[#0891b2] flex items-center gap-1">
              <Info className="w-3 h-3" /> Email routing rules active
            </p>
          )}
        </div>
      )}

      {item.itemType === "radio" && (
        <div className="space-y-1.5">
          {itemOptions.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  value === opt.value ? "border-[#0891b2] bg-[#0891b2]" : "border-gray-300 group-hover:border-gray-400"
                }`}
                onClick={() => onChange(opt.value)}
              >
                {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-gray-700">{opt.label}</span>
              {opt.qualityScore > 0 && (
                <span className="text-xs text-[#0891b2] ml-auto">+{opt.qualityScore}</span>
              )}
            </label>
          ))}
        </div>
      )}

      {item.itemType === "checkbox" && (
        <div className="space-y-1.5">
          {itemOptions.map(opt => {
            const checked = Array.isArray(value) ? value.includes(opt.value) : false;
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked ? "border-[#0891b2] bg-[#0891b2]" : "border-gray-300 group-hover:border-gray-400"
                  }`}
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(checked ? current.filter(v => v !== opt.value) : [...current, opt.value]);
                  }}
                >
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span className="text-sm text-gray-700">{opt.label}</span>
                {opt.qualityScore > 0 && (
                  <span className="text-xs text-[#0891b2] ml-auto">+{opt.qualityScore}</span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {item.itemType === "select" && (
        <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select an option…" />
          </SelectTrigger>
          <SelectContent>
            {itemOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {item.itemType === "scale" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {Array.from({ length: (item.scaleMax ?? 5) - (item.scaleMin ?? 1) + 1 }, (_, i) => {
              const val = String((item.scaleMin ?? 1) + i);
              const selected = value === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange(val)}
                  className={`w-9 h-9 rounded-lg border-2 text-sm font-semibold transition-all ${
                    selected
                      ? "border-[#0891b2] bg-[#0891b2] text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>
          {(item.scaleMinLabel || item.scaleMaxLabel) && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>{item.scaleMinLabel}</span>
              <span>{item.scaleMaxLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormPreview({
  template,
  sections,
  items,
  options,
  branchRules,
  orgVisibilityRules = [],
  previewOrgId: externalPreviewOrgId,
}: FormPreviewProps) {
  const [responses, setResponses] = useState<Record<number, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [previewOrgId, setPreviewOrgId] = useState<number | null>(externalPreviewOrgId ?? null);

  const { data: organizations } = trpc.formBuilder.listOrganizations.useQuery();

  const setResponse = (itemId: number, val: string | string[]) => {
    setResponses(prev => ({ ...prev, [itemId]: val }));
    setSubmitted(false);
  };

  const reset = () => {
    setResponses({});
    setSubmitted(false);
  };

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const qualityScore = computeQualityScore(items, options, responses);

  // Determine which items are visible based on branching + org rules
  const isItemVisible = (item: FormItem): boolean => {
    const branchVisible = evaluateBranchVisibility(item.id, branchRules, responses);
    const orgVisible = evaluateOrgVisibility(item.id, "item", orgVisibilityRules, previewOrgId);
    return branchVisible && orgVisible;
  };

  const isSectionVisible = (section: FormSection): boolean => {
    return evaluateOrgVisibility(section.id, "section", orgVisibilityRules, previewOrgId);
  };

  const hasOrgRules = orgVisibilityRules.length > 0;

  return (
    <div className="space-y-4">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#0891b2]/5 to-[#0891b2]/10 border border-[#0891b2]/20">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#0891b2]" />
          <span className="text-sm font-semibold text-[#0891b2]">Live Preview</span>
          <span className="text-xs text-gray-500">— responses are not saved</span>
        </div>
        <div className="flex items-center gap-2">
          {hasOrgRules && (
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <Select
                value={previewOrgId ? String(previewOrgId) : "__all__"}
                onValueChange={v => setPreviewOrgId(v === "__all__" ? null : parseInt(v))}
              >
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="Preview as org…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-xs">All organizations (no filter)</SelectItem>
                  {organizations?.map(org => (
                    <SelectItem key={org.id} value={String(org.id)} className="text-xs">
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={reset}>
            <RefreshCw className="w-3 h-3" /> Reset
          </Button>
        </div>
      </div>

      {/* Org filter notice */}
      {hasOrgRules && previewOrgId && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Previewing as: <strong>{organizations?.find(o => o.id === previewOrgId)?.name ?? `Org #${previewOrgId}`}</strong> — some items/sections may be hidden by org visibility rules.
        </div>
      )}

      {/* Form */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-50">
          <CardTitle className="text-base font-bold text-gray-900" style={{ fontFamily: "Merriweather, serif" }}>
            {template.name}
          </CardTitle>
          {template.description && (
            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
          )}
        </CardHeader>
        <CardContent className="p-5 space-y-6">
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">Form Submitted (Preview)</h3>
              <p className="text-sm text-gray-500 mb-4">This is a preview — no data was saved.</p>
              {qualityScore.maxScore > 0 && (
                <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[#0891b2]">{qualityScore.percentage}%</div>
                    <div className="text-xs text-gray-500">Quality Score</div>
                  </div>
                  <div className="w-px h-10 bg-gray-200" />
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">{qualityScore.score}/{qualityScore.maxScore}</div>
                    <div className="text-xs text-gray-500">Weighted Points</div>
                  </div>
                </div>
              )}
              <Button className="mt-4" variant="outline" onClick={reset}>Reset Preview</Button>
            </div>
          ) : (
            <>
              {sortedSections.map(section => {
                if (!isSectionVisible(section)) return null;

                const sectionItems = items
                  .filter(i => i.sectionId === section.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .filter(item => isItemVisible(item));

                if (sectionItems.length === 0) return null;

                return (
                  <div key={section.id} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{section.title}</h3>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    {section.description && (
                      <p className="text-xs text-gray-400 -mt-2">{section.description}</p>
                    )}
                    <div className="space-y-4 pl-1">
                      {sectionItems.map(item => (
                        <ItemRenderer
                          key={item.id}
                          item={item}
                          options={options}
                          value={responses[item.id] ?? (["checkbox"].includes(item.itemType) ? [] : "")}
                          onChange={val => setResponse(item.id, val)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Quality Score Live Meter */}
              {qualityScore.maxScore > 0 && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">Quality Score (live)</span>
                    <span className="text-sm font-bold text-[#0891b2]">{qualityScore.percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${qualityScore.percentage}%`,
                        background: qualityScore.percentage >= 80 ? "#22c55e" : qualityScore.percentage >= 60 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{qualityScore.score} / {qualityScore.maxScore} weighted points</div>
                </div>
              )}

              <Button
                className="w-full text-white"
                style={{ background: "#0891b2" }}
                onClick={() => setSubmitted(true)}
              >
                Submit Form (Preview)
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
