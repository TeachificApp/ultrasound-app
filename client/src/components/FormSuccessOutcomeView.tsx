/**
 * FormSuccessOutcomeView.tsx
 * Renders post-submission success outcomes (inline, full page, redirect handled by caller).
 */
import React, { useEffect, useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { BlockPreview, Block } from "@/components/BlockPreview";
import { RichTextDisplay } from "@/components/RichTextEditor";

export type SuccessOutcomePayload = {
  moduleId: number | null;
  moduleName: string;
  type: "inline_message" | "full_page" | "redirect_url";
  inlineHtml?: string;
  pageBlocks?: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  redirectUrl?: string;
  mergeContext?: Record<string, string>;
};

function evaluateConditionalBlock(
  block: Block,
  mergeContext: Record<string, string>,
  responses: Record<string, unknown>,
): Block | null {
  if (block.type !== "conditional_text") return block;
  const d = block.data ?? {};
  const fieldId = String(d.fieldId ?? "");
  let actual = mergeContext[fieldId.replace(/^__|__$/g, "")] ?? mergeContext[fieldId] ?? "";
  if (!actual && responses[fieldId] != null) {
    actual = Array.isArray(responses[fieldId]) ? (responses[fieldId] as string[]).join(",") : String(responses[fieldId]);
  }
  if (fieldId === "__score_percent__") actual = mergeContext.score_percent ?? actual;
  if (fieldId === "__pass_status__") actual = mergeContext.pass_status ?? actual;

  const target = String(d.value ?? "");
  const op = String(d.operator ?? "equals");
  let match = false;
  const numActual = parseFloat(actual);
  if (op === "equals") match = actual === target;
  else if (op === "not_equals") match = actual !== target;
  else if (op === "contains") match = actual.toLowerCase().includes(target.toLowerCase());
  else if (op === "greater_or_equal") match = !Number.isNaN(numActual) && numActual >= parseFloat(target);
  else if (op === "less_than") match = !Number.isNaN(numActual) && numActual < parseFloat(target);

  const html = match ? String(d.htmlIfTrue ?? "") : String(d.htmlIfFalse ?? "");
  return { id: block.id, type: "text", data: { html, bgColor: d.bgColor ?? "#ffffff" } };
}

export function FormSuccessOutcomeView({
  outcome,
  theme,
  isEmbed,
  responses = {},
  onRedirect,
}: {
  outcome: SuccessOutcomePayload;
  theme?: { primaryColor?: string; textColor?: string; formBackground?: string; fontFamily?: string; fontSize?: string; borderRadius?: string };
  isEmbed?: boolean;
  responses?: Record<string, unknown>;
  onRedirect?: (url: string) => void;
}) {
  const primary = theme?.primaryColor ?? "#0e7490";
  const textColor = theme?.textColor ?? "#111827";
  const bg = theme?.formBackground ?? "#ffffff";
  const fontFamily = theme?.fontFamily ?? "system-ui, sans-serif";
  const mergeContext = outcome.mergeContext ?? {};

  const pageBlocks = useMemo(() => {
    if (outcome.type !== "full_page" || !outcome.pageBlocks) return [];
    return outcome.pageBlocks
      .map(b => evaluateConditionalBlock(b as Block, mergeContext, responses))
      .filter(Boolean) as Block[];
  }, [outcome, mergeContext, responses]);

  useEffect(() => {
    if (outcome.type === "redirect_url" && outcome.redirectUrl) {
      if (onRedirect) onRedirect(outcome.redirectUrl);
      else window.location.href = outcome.redirectUrl;
    }
  }, [outcome, onRedirect]);

  if (outcome.type === "redirect_url") {
    return (
      <div style={{ minHeight: isEmbed ? "auto" : "40vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily }}>
        <p style={{ color: textColor, opacity: 0.7 }}>Redirecting…</p>
      </div>
    );
  }

  if (outcome.type === "full_page") {
    return (
      <div style={{ minHeight: isEmbed ? "auto" : "100vh", fontFamily, background: "#f9fafb", padding: isEmbed ? "16px 0" : "32px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", background: bg, borderRadius: 12, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: primary, marginBottom: 16 }} />
          <div className="space-y-4">
            {pageBlocks.map(block => (
              <BlockPreview key={block.id} block={block} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const html = outcome.inlineHtml ?? "Your response has been submitted successfully.";
  return (
    <div style={{ minHeight: isEmbed ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, fontFamily }}>
      <div style={{ background: bg, borderRadius: 12, padding: "48px 40px", textAlign: "center", maxWidth: 520, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <CheckCircle2 style={{ width: 52, height: 52, color: primary, margin: "0 auto 20px" }} />
        <h2 style={{ color: textColor, fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Thank you!</h2>
        {html.trim().startsWith("<") ? (
          <div style={{ color: textColor, opacity: 0.85, fontSize: parseInt(theme?.fontSize ?? "16"), textAlign: "left" }}>
            <RichTextDisplay html={html} />
          </div>
        ) : (
          <p style={{ color: textColor, opacity: 0.8, fontSize: parseInt(theme?.fontSize ?? "16") }}>{html}</p>
        )}
      </div>
    </div>
  );
}

/** Preview helper for admin — uses sample merge context */
export function previewSuccessModule(
  module: {
    moduleType: string;
    inlineContent?: string | null;
    pageContent?: string | null;
    redirectUrl?: string | null;
    name: string;
    id?: number;
  },
): SuccessOutcomePayload {
  const sampleContext = {
    score: "8",
    max_score: "10",
    score_percent: "80",
    pass_status: "pass",
    payment_status: "completed",
    name: "Jane Doe",
    email: "jane@example.com",
    reference_number: "12345",
    submission_id: "12345",
    form_name: "Sample Form",
  };

  const apply = (text: string) =>
    text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => sampleContext[k as keyof typeof sampleContext] ?? "");

  if (module.moduleType === "redirect_url") {
    return {
      moduleId: module.id ?? null,
      moduleName: module.name,
      type: "redirect_url",
      redirectUrl: apply(module.redirectUrl ?? ""),
      mergeContext: sampleContext,
    };
  }
  if (module.moduleType === "full_page") {
    let blocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
    try {
      blocks = JSON.parse(module.pageContent ?? "[]");
    } catch {
      blocks = [];
    }
    const deepApply = (val: unknown): unknown => {
      if (typeof val === "string") return apply(val);
      if (Array.isArray(val)) return val.map(deepApply);
      if (val && typeof val === "object") {
        const o: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) o[k] = deepApply(v);
        return o;
      }
      return val;
    };
    return {
      moduleId: module.id ?? null,
      moduleName: module.name,
      type: "full_page",
      pageBlocks: blocks.map(b => ({ ...b, data: deepApply(b.data) as Record<string, unknown> })),
      mergeContext: sampleContext,
    };
  }
  return {
    moduleId: module.id ?? null,
    moduleName: module.name,
    type: "inline_message",
    inlineHtml: apply(module.inlineContent ?? ""),
    mergeContext: sampleContext,
  };
}
