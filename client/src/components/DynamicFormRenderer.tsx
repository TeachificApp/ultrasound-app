/**
 * DynamicFormRenderer
 * Renders any Form Builder template from the database.
 * Supports: all 10 field types, branching rules, org visibility rules, quality score computation.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormOption {
  id: number;
  label: string;
  value: string;
  sortOrder: number;
  qualityScore: number;
}

interface FormItem {
  id: number;
  sectionId: number;
  templateId: number;
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
  options: FormOption[];
}

interface FormSection {
  id: number;
  templateId: number;
  title: string;
  description: string | null;
  sortOrder: number;
  isCollapsible: boolean;
  items: FormItem[];
}

interface BranchRule {
  id: number;
  templateId: number;
  targetItemId: number;
  conditionItemId: number;
  conditionValue: string;
  action: "show" | "hide";
}

interface FormTemplate {
  id: number;
  name: string;
  description: string | null;
  formType: string;
  sections: FormSection[];
  branchRules: BranchRule[];
}

interface DynamicFormRendererProps {
  templateId: number;
  formType: string;
  orgId?: number;
  reviewTargetType?: string;
  reviewTargetId?: number;
  onSubmitted?: (submissionId: number) => void;
  onCancel?: () => void;
  /** If true, shows a read-only view of the form structure (no submission) */
  readOnly?: boolean;
  /** Pre-filled responses for read-only viewing of a submission */
  initialResponses?: Record<string, string | string[]>;
}

// ─── Score Computation ────────────────────────────────────────────────────────

function computeQualityScore(
  items: FormItem[],
  responses: Record<string, string | string[]>
): { score: number; maxScore: number } {
  let total = 0;
  let max = 0;
  for (const item of items) {
    if (!["radio", "checkbox", "select", "scale"].includes(item.itemType)) continue;
    const weight = item.scoreWeight ?? 1;
    if (weight === 0) continue;
    max += weight * 100;
    const val = responses[String(item.id)];
    if (!val) continue;
    if (item.itemType === "scale") {
      const scaleMin = item.scaleMin ?? 1;
      const scaleMax = item.scaleMax ?? 5;
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        const pct = ((numVal - scaleMin) / (scaleMax - scaleMin)) * 100;
        total += weight * Math.max(0, Math.min(100, pct));
      }
    } else if (item.itemType === "checkbox") {
      const selected = Array.isArray(val) ? val : [val];
      const matchingOptions = item.options.filter(o => selected.includes(o.value));
      const avgScore = matchingOptions.length > 0
        ? matchingOptions.reduce((sum, o) => sum + (o.qualityScore ?? 0), 0) / matchingOptions.length
        : 0;
      total += weight * avgScore;
    } else {
      const opt = item.options.find(o => o.value === val);
      if (opt) total += weight * (opt.qualityScore ?? 0);
    }
  }
  return { score: Math.round(total), maxScore: Math.round(max) };
}

// ─── Branch Rule Evaluation ───────────────────────────────────────────────────

function evaluateBranchRules(
  rules: BranchRule[],
  responses: Record<string, string | string[]>
): Set<number> {
  const hiddenItemIds = new Set<number>();
  // First pass: collect all items that have a "show" rule — they start hidden
  const showRuleTargets = new Set<number>();
  for (const rule of rules) {
    if (rule.action === "show") showRuleTargets.add(rule.targetItemId);
  }
  // Items with show rules are hidden by default unless condition is met
  Array.from(showRuleTargets).forEach(id => hiddenItemIds.add(id));

  for (const rule of rules) {
    const condVal = responses[String(rule.conditionItemId)];
    const matches = Array.isArray(condVal)
      ? condVal.includes(rule.conditionValue)
      : condVal === rule.conditionValue;

    if (rule.action === "show") {
      if (matches) hiddenItemIds.delete(rule.targetItemId);
    } else if (rule.action === "hide") {
      if (matches) hiddenItemIds.add(rule.targetItemId);
    }
  }
  return hiddenItemIds;
}

// ─── Field Renderers ──────────────────────────────────────────────────────────

function FieldWrapper({ item, children }: { item: FormItem; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {item.itemType !== "heading" && item.itemType !== "info" && (
        <Label className="text-sm font-semibold text-gray-700">
          {item.label}
          {item.isRequired && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      {item.helpText && (
        <p className="text-xs text-gray-500">{item.helpText}</p>
      )}
      {children}
    </div>
  );
}

function TextField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <FieldWrapper item={item}>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={item.placeholder ?? ""}
        disabled={readOnly}
        className="text-sm"
      />
    </FieldWrapper>
  );
}

function TextareaField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <FieldWrapper item={item}>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={item.placeholder ?? ""}
        disabled={readOnly}
        rows={4}
        className="text-sm resize-none"
      />
    </FieldWrapper>
  );
}

function EmailField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <FieldWrapper item={item}>
      <Input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={item.placeholder ?? "Enter email address"}
        disabled={readOnly}
        className="text-sm"
      />
    </FieldWrapper>
  );
}

function RichTextField({ item }: { item: FormItem }) {
  if (!item.richTextContent) return null;
  return (
    <FieldWrapper item={item}>
      <div
        className="prose prose-sm max-w-none text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-200"
        dangerouslySetInnerHTML={{ __html: item.richTextContent }}
      />
    </FieldWrapper>
  );
}

function RadioField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <FieldWrapper item={item}>
      <RadioGroup value={value} onValueChange={readOnly ? undefined : onChange} className="space-y-2">
        {item.options.map(opt => (
          <div key={opt.id} className="flex items-center gap-2.5">
            <RadioGroupItem value={opt.value} id={`radio-${item.id}-${opt.id}`} disabled={readOnly} />
            <Label htmlFor={`radio-${item.id}-${opt.id}`} className="text-sm font-normal cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </FieldWrapper>
  );
}

function CheckboxField({ item, values, onChange, readOnly }: {
  item: FormItem;
  values: string[];
  onChange: (v: string[]) => void;
  readOnly: boolean;
}) {
  const toggle = (val: string) => {
    if (readOnly) return;
    if (values.includes(val)) onChange(values.filter(v => v !== val));
    else onChange([...values, val]);
  };
  return (
    <FieldWrapper item={item}>
      <div className="space-y-2">
        {item.options.map(opt => (
          <div key={opt.id} className="flex items-center gap-2.5">
            <Checkbox
              id={`chk-${item.id}-${opt.id}`}
              checked={values.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              disabled={readOnly}
            />
            <Label htmlFor={`chk-${item.id}-${opt.id}`} className="text-sm font-normal cursor-pointer">
              {opt.label}
            </Label>
          </div>
        ))}
      </div>
    </FieldWrapper>
  );
}

function SelectField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <FieldWrapper item={item}>
      <Select value={value} onValueChange={readOnly ? undefined : onChange} disabled={readOnly}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder={item.placeholder ?? "Select an option"} />
        </SelectTrigger>
        <SelectContent>
          {item.options.map(opt => (
            <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

function ScaleField({ item, value, onChange, readOnly }: {
  item: FormItem;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  const min = item.scaleMin ?? 1;
  const max = item.scaleMax ?? 5;
  const current = value ? Number(value) : min;
  return (
    <FieldWrapper item={item}>
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Slider
            min={min}
            max={max}
            step={1}
            value={[current]}
            onValueChange={readOnly ? undefined : (v) => onChange(String(v[0]))}
            disabled={readOnly}
            className="flex-1"
          />
          <span className="text-sm font-bold text-[#189aa1] w-8 text-center">{current}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{item.scaleMinLabel ?? String(min)}</span>
          <span>{item.scaleMaxLabel ?? String(max)}</span>
        </div>
      </div>
    </FieldWrapper>
  );
}

function HeadingField({ item }: { item: FormItem }) {
  return (
    <div className="pt-2">
      <h3 className="text-base font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
        {item.label}
      </h3>
      {item.helpText && <p className="text-sm text-gray-500 mt-1">{item.helpText}</p>}
    </div>
  );
}

function InfoField({ item }: { item: FormItem }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p className="text-sm text-blue-800 font-medium">{item.label}</p>
      {item.helpText && <p className="text-xs text-blue-600 mt-1">{item.helpText}</p>}
      {item.richTextContent && (
        <div
          className="prose prose-sm max-w-none text-blue-700 mt-2"
          dangerouslySetInnerHTML={{ __html: item.richTextContent }}
        />
      )}
    </div>
  );
}

// ─── Item Dispatcher ──────────────────────────────────────────────────────────

function FormItemField({ item, response, onChange, readOnly }: {
  item: FormItem;
  response: string | string[];
  onChange: (v: string | string[]) => void;
  readOnly: boolean;
}) {
  const strVal = Array.isArray(response) ? response[0] ?? "" : response ?? "";
  const arrVal = Array.isArray(response) ? response : response ? [response] : [];

  switch (item.itemType) {
    case "text": return <TextField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "textarea": return <TextareaField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "email": return <EmailField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "richtext": return <RichTextField item={item} />;
    case "radio": return <RadioField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "checkbox": return <CheckboxField item={item} values={arrVal} onChange={onChange as (v: string[]) => void} readOnly={readOnly} />;
    case "select": return <SelectField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "scale": return <ScaleField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
    case "heading": return <HeadingField item={item} />;
    case "info": return <InfoField item={item} />;
    default: return <TextField item={item} value={strVal} onChange={onChange as (v: string) => void} readOnly={readOnly} />;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DynamicFormRenderer({
  templateId,
  formType,
  orgId,
  reviewTargetType,
  reviewTargetId,
  onSubmitted,
  onCancel,
  readOnly = false,
  initialResponses = {},
}: DynamicFormRendererProps) {
  const [responses, setResponses] = useState<Record<string, string | string[]>>(initialResponses);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: rawTemplateData, isLoading } = trpc.formBuilder.getFullTemplate.useQuery(
    { id: templateId },
    { enabled: !!templateId }
  );

  // Map the server response { template, sections, items, options, branchRules } into
  // a flat FormTemplate shape that the renderer expects
  const templateData = useMemo<FormTemplate | null>(() => {
    if (!rawTemplateData) return null;
    const { template, sections, items, options, branchRules } = rawTemplateData;
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      formType: template.formType,
      sections: sections.map(s => ({
        ...s,
        items: items
          .filter(i => i.sectionId === s.id)
          .map(i => ({
            ...i,
            options: options
              .filter(o => o.itemId === i.id)
              .map(o => ({
                id: o.id,
                label: o.label,
                value: o.value,
                sortOrder: o.sortOrder,
                qualityScore: o.qualityScore ?? 0,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      })).sort((a, b) => a.sortOrder - b.sortOrder),
      branchRules: branchRules.map(r => ({
        id: r.id,
        templateId: r.templateId,
        targetItemId: r.targetItemId,
        conditionItemId: r.conditionItemId,
        conditionValue: r.conditionValue,
        action: r.action as "show" | "hide",
      })),
    };
  }, [rawTemplateData]);

  const submitMutation = trpc.formBuilder.submitForm.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setSubmitting(false);
      toast.success("Form submitted successfully");
      onSubmitted?.(data.id);
    },
    onError: (err) => {
      setSubmitting(false);
      toast.error(err.message || "Failed to submit form");
    },
  });

  // Flatten all items for branch rule evaluation and score computation
  const allItems = useMemo(() => {
    if (!templateData) return [];
    return templateData.sections.flatMap((s: FormSection) =>
      [...s.items].sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }, [templateData]);

  const hiddenItemIds = useMemo(() => {
    if (!templateData) return new Set<number>();
    return evaluateBranchRules(templateData.branchRules ?? [], responses);
  }, [templateData, responses]);

  const { score, maxScore } = useMemo(() => {
    const visibleItems = allItems.filter(i => !hiddenItemIds.has(i.id));
    return computeQualityScore(visibleItems, responses);
  }, [allItems, hiddenItemIds, responses]);

  const setResponse = (itemId: number, value: string | string[]) => {
    setResponses(prev => ({ ...prev, [String(itemId)]: value }));
  };

  const validate = (): boolean => {
    if (!templateData) return false;
    for (const item of allItems) {
      if (!item.isRequired) continue;
      if (hiddenItemIds.has(item.id)) continue;
      if (["heading", "info", "richtext"].includes(item.itemType)) continue;
      const val = responses[String(item.id)];
      const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : val.trim() === "");
      if (isEmpty) {
        toast.error(`Please complete required field: "${item.label}"`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const normalizedScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    submitMutation.mutate({
      templateId,
      formType,
      orgId,
      reviewTargetType,
      reviewTargetId,
      responses,
      qualityScore: normalizedScore,
      maxPossibleScore: maxScore,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#189aa1]" />
        <span className="ml-2 text-sm text-gray-500">Loading form...</span>
      </div>
    );
  }

  if (!templateData) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span className="text-sm">Form template not found.</span>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-12 h-12 text-[#189aa1]" />
        <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
          Form Submitted
        </h3>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Your response has been recorded. Thank you for completing this review.
        </p>
        {maxScore > 0 && (
          <div className="bg-[#f0fbfc] border border-[#189aa1]/20 rounded-lg px-6 py-3 text-center">
            <div className="text-2xl font-bold text-[#189aa1]">
              {Math.round((score / maxScore) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Quality Score</div>
          </div>
        )}
      </div>
    );
  }

  const sortedSections = [...(templateData.sections ?? [])].sort((a: FormSection, b: FormSection) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
            {templateData.name}
          </h2>
          {templateData.description && (
            <p className="text-sm text-gray-500 mt-1">{templateData.description}</p>
          )}
        </div>
        {maxScore > 0 && !readOnly && (
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-gray-400">Quality Score</div>
            <div className="text-lg font-bold text-[#189aa1]">
              {maxScore > 0 ? Math.round((score / maxScore) * 100) : 0}%
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      {sortedSections.map((section: FormSection) => {
        const sortedItems = [...section.items].sort((a, b) => a.sortOrder - b.sortOrder);
        const visibleItems = sortedItems.filter(item => !hiddenItemIds.has(item.id));
        if (visibleItems.length === 0) return null;

        return (
          <Card key={section.id} className="border border-gray-200 shadow-sm">
            {section.title && (
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-bold text-[#189aa1] flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  {section.title}
                </CardTitle>
                {section.description && (
                  <p className="text-xs text-gray-500 mt-1">{section.description}</p>
                )}
              </CardHeader>
            )}
            <CardContent className={section.title ? "pt-0 px-5 pb-5" : "px-5 py-5"}>
              <div className="space-y-5">
                {visibleItems.map(item => (
                  <FormItemField
                    key={item.id}
                    item={item}
                    response={responses[String(item.id)] ?? (item.itemType === "checkbox" ? [] : "")}
                    onChange={(v) => setResponse(item.id, v)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Footer Actions */}
      {!readOnly && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {maxScore > 0 && (
              <Badge variant="outline" className="text-[#189aa1] border-[#189aa1]/30 bg-[#f0fbfc]">
                Score: {Math.round((score / maxScore) * 100)}%
              </Badge>
            )}
          </div>
          <div className="flex gap-3">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#189aa1] hover:bg-[#147f85] text-white"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                "Submit Form"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
