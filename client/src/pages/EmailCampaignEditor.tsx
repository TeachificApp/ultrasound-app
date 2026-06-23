/**
 * EmailCampaignEditor — Full-page email campaign builder
 *
 * Features:
 *  - Block-based email builder (text, heading, image, button, divider, spacer, quote)
 *  - Live HTML preview (desktop/mobile toggle)
 *  - Advanced audience filter builder (course, quiz, product, download, cohort, team, form, interests)
 *  - Sender profile selector
 *  - Save draft / send now / schedule
 *  - Save as template / load from template
 *  - Automatic unsubscribe footer injected on send
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Eye, EyeOff, Send, Save, Clock, Users, Mail,
  Monitor, Smartphone, ChevronDown, ChevronUp, Check, RefreshCw,
  LayoutTemplate,
} from "lucide-react";
import EmailBlockEditor, { emailBlocksToHtml } from "@/components/EmailBlockEditor";
import type { Block } from "@/pages/admin/LandingPageBuilder";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import type { AudienceFilter, LegacyInterestKey } from "@shared/emailCampaignAudience";
import { DEFAULT_AUDIENCE_FILTER } from "@shared/emailCampaignAudience";

// Block type is imported from LandingPageBuilder via EmailBlockEditor
function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultEmailBlocks(): Block[] {
  return [
    { id: uid(), type: "text", data: { html: "<p>Write your email content here. Keep it concise and engaging.</p>", align: "left", bgColor: "#ffffff", textColor: "#1a2e3b" } },
    { id: uid(), type: "cta_standalone", data: { headline: "Ready to learn more?", subtext: "", ctaText: "Click Here", ctaLink: "https://", ctaColor: "#189aa1", ctaTextColor: "#ffffff", bgColor: "#f0fafa", align: "center" } },
  ];
}


// ─── Branded email wrapper ────────────────────────────────────────────────────
function wrapInBrandedEmail(bodyHtml: string, previewText?: string): string {
  const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : "";
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>All About Ultrasound\u2122 | iHeartEcho\u2122</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Open Sans',Arial,sans-serif;">
${preview}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;margin:0;padding:0;">
  <tr><td align="center" style="padding:20px 0;">
    <table width="900" cellpadding="0" cellspacing="0" border="0" style="max-width:900px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <tr>
        <td style="background:linear-gradient(135deg,#0e1e2e 0%,#0e4a50 60%,#189aa1 100%);padding:24px 32px;">
          <span style="font-family:Merriweather,Georgia,serif;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">All About Ultrasound\u2122</span>
          <span style="font-size:13px;color:#4ad9e0;font-weight:600;margin-left:10px;letter-spacing:0.5px;">| iHeartEcho\u2122</span>
        </td>
      </tr>
      <tr>
        <td style="padding:0;color:#1a2e3b;font-size:15px;line-height:1.7;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#f4f4f4;padding:20px 32px;border-top:1px solid #e5eaec;">
          <p style="margin:0;font-size:11px;color:#8a9bb0;text-align:center;line-height:1.6;">
            \u00a9 ${year} All About Ultrasound\u2122 | iHeartEcho\u2122. All rights reserved.<br/>
            You are receiving this email because you have an account on All About Ultrasound\u2122 | iHeartEcho\u2122.<br/>
            <a href="{{UNSUBSCRIBE_URL}}" style="color:#189aa1;text-decoration:none;">Unsubscribe</a> &middot; <a href="https://app.allaboutultrasound.com/profile" style="color:#189aa1;text-decoration:none;">Manage preferences</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const LEGACY_INTEREST_OPTIONS: { key: LegacyInterestKey; label: string }[] = [
  { key: "acs", label: "ACS" },
  { key: "adultEcho", label: "Adult Echo" },
  { key: "pediatricEcho", label: "Pediatric Echo" },
  { key: "fetalEcho", label: "Fetal Echo" },
  { key: "pocus", label: "POCUS" },
];

const DEFAULT_FILTER: AudienceFilter = { ...DEFAULT_AUDIENCE_FILTER };

function MultiSelect({ label, options, selected, onChange, hint }: {
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  onChange: (v: number[]) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  return (
    <div className="relative">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      {hint && <p className="text-[10px] text-gray-400 mb-1">{hint}</p>}
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left text-sm border rounded-lg px-3 py-2 bg-white flex items-center justify-between">
        <span className="truncate text-gray-700">{selectedLabels.length > 0 ? selectedLabels.join(", ") : <span className="text-gray-400">None selected</span>}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">No options available</div>}
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => {
                onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id));
              }} className="rounded" />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function StringMultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  return (
    <div className="relative">
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left text-sm border rounded-lg px-3 py-2 bg-white flex items-center justify-between">
        <span className="truncate text-gray-700">{selectedLabels.length > 0 ? selectedLabels.join(", ") : <span className="text-gray-400">None selected</span>}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => {
                onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id));
              }} className="rounded" />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function AudienceFilterBuilder({ filter, onChange, preview }: {
  filter: AudienceFilter;
  onChange: (f: AudienceFilter) => void;
  preview: { count: number; sampleEmails: string[] } | undefined;
}) {
  const { data: options } = trpc.emailCampaign.getAudienceOptions.useQuery();
  const [expanded, setExpanded] = useState(true);
  // Auto-expand advanced section if any advanced filters are already active (e.g. loaded from saved draft)
  const hasAdvancedFilters =
    (filter.enrolledInCourseIds?.length ?? 0) > 0 ||
    (filter.activeAccessCourseIds?.length ?? 0) > 0 ||
    (filter.freePreviewCourseIds?.length ?? 0) > 0 ||
    (filter.completedCourseIds?.length ?? 0) > 0 ||
    (filter.purchasedCourseIds?.length ?? 0) > 0 ||
    (filter.purchasedProductIds?.length ?? 0) > 0 ||
    (filter.downloadedProductIds?.length ?? 0) > 0 ||
    (filter.inGroupIds?.length ?? 0) > 0 ||
    (filter.inCohortGroupIds?.length ?? 0) > 0 ||
    (filter.submittedFormIds?.length ?? 0) > 0 ||
    (filter.membershipPlanIds?.length ?? 0) > 0 ||
    (filter.bundleIds?.length ?? 0) > 0 ||
    (filter.workshopIds?.length ?? 0) > 0 ||
    (filter.communityIds?.length ?? 0) > 0 ||
    !!filter.enrolledAfter || !!filter.enrolledBefore ||
    !!filter.purchasedAfter || !!filter.purchasedBefore;
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Expand advanced section once if active filters are detected (e.g. on draft load)
  const didAutoExpand = useRef(false);
  useEffect(() => {
    if (hasAdvancedFilters && !didAutoExpand.current) {
      didAutoExpand.current = true;
      setShowAdvanced(true);
    }
  }, [hasAdvancedFilters]);
  const [specificEmailsText, setSpecificEmailsText] = useState(filter.specificEmails.join("\n"));
  // Keep specificEmailsText in sync when the filter is loaded from a saved draft
  // Use JSON.stringify to compare arrays by value, not reference
  const prevSpecificEmailsJson = useRef(JSON.stringify(filter.specificEmails));
  useEffect(() => {
    const json = JSON.stringify(filter.specificEmails);
    if (json !== prevSpecificEmailsJson.current) {
      prevSpecificEmailsJson.current = json;
      setSpecificEmailsText(filter.specificEmails.join("\n"));
    }
  }, [filter.specificEmails]);

  function update(patch: Partial<AudienceFilter>) {
    onChange({ ...filter, ...patch });
  }

  function toggleLegacyInterest(key: LegacyInterestKey) {
    const arr = filter.interests.includes(key) ? filter.interests.filter((k) => k !== key) : [...filter.interests, key];
    update({ interests: arr });
  }

  function toggleInterestId(id: number) {
    const arr = filter.interestIds.includes(id) ? filter.interestIds.filter((k) => k !== id) : [...filter.interestIds, id];
    update({ interestIds: arr });
  }

  const abTest = filter.abTest ?? { enabled: false, variants: [] };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#189aa1]" />
            Audience
            {preview && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {preview.count.toLocaleString()} recipient{preview.count !== 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-5 pb-5 space-y-4">
          {/* Email lists */}
          {options?.lists && options.lists.length > 0 && (
            <div className="p-3 bg-[#f0fbfc] border border-[#189aa1]/20 rounded-lg space-y-3">
              <label className="text-xs font-semibold text-gray-700 block">Email Lists</label>
              <MultiSelect
                label="Target lists"
                options={options.lists.map((l) => ({ id: l.id, label: `${l.label} (${l.subscriberCount ?? 0})` }))}
                selected={filter.listIds}
                onChange={(v) => update({ listIds: v })}
                hint="Connect campaigns to lists built in the Email Lists tab"
              />
              {filter.listIds.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">List combination</label>
                  <Select value={filter.listMode} onValueChange={(v: AudienceFilter["listMode"]) => update({ listMode: v })}>
                    <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intersect">List + filters (intersect)</SelectItem>
                      <SelectItem value="only">List only</SelectItem>
                      <SelectItem value="union">List + all matching users (union)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Match</span>
            <div className="flex rounded-lg border overflow-hidden">
              {(["and", "or"] as const).map((l) => (
                <button key={l} type="button" onClick={() => update({ logic: l })} className={`px-3 py-1 text-xs font-semibold ${filter.logic === l ? "bg-[#189aa1] text-white" : "bg-white text-gray-600"}`}>
                  {l === "and" ? "ALL" : "ANY"}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">advanced filters</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subscription</label>
              <Select value={filter.subscriptionType} onValueChange={(v: AudienceFilter["subscriptionType"]) => update({ subscriptionType: v })}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="premium">Premium only</SelectItem>
                  <SelectItem value="free">Free only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">User Status</label>
              <Select value={filter.userStatus} onValueChange={(v: AudienceFilter["userStatus"]) => update({ userStatus: v })}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {options?.roles && options.roles.length > 0 && (
            <StringMultiSelect label="Roles" options={options.roles} selected={filter.roles} onChange={(v) => update({ roles: v })} />
          )}

          {options?.interests && options.interests.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Content Interests</label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {options.interests.map((i) => (
                  <button key={i.id} type="button" onClick={() => toggleInterestId(i.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filter.interestIds.includes(i.id) ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
          )}



          {/* Brand / App filter */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">App / Brand</label>
            <div className="flex flex-wrap gap-1.5">
              {([{ key: "aaus", label: "All About Ultrasound" }, { key: "iheartecho", label: "iHeartEcho" }] as const).map(({ key, label }) => {
                const selected = (filter.brands ?? []).includes(key);
                return (
                  <button key={key} type="button" onClick={() => {
                    const arr = selected ? (filter.brands ?? []).filter((b) => b !== key) : [...(filter.brands ?? []), key];
                    update({ brands: arr });
                  }} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-[#189aa1] text-white border-[#189aa1]" : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1]"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-[#189aa1] font-medium flex items-center gap-1">
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showAdvanced ? "Hide" : "Show"} course, product, cohort & date filters
          </button>

          {showAdvanced && options && (
            <div className="space-y-4 pl-1 border-l-2 border-gray-100 ml-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Enrolled after</label>
                  <Input type="date" value={filter.enrolledAfter?.slice(0, 10) ?? ""} onChange={(e) => update({ enrolledAfter: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Enrolled before</label>
                  <Input type="date" value={filter.enrolledBefore?.slice(0, 10) ?? ""} onChange={(e) => update({ enrolledBefore: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Purchased after</label>
                  <Input type="date" value={filter.purchasedAfter?.slice(0, 10) ?? ""} onChange={(e) => update({ purchasedAfter: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Purchased before</label>
                  <Input type="date" value={filter.purchasedBefore?.slice(0, 10) ?? ""} onChange={(e) => update({ purchasedBefore: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined })} className="text-sm h-9" />
                </div>
              </div>
              <MultiSelect label="Enrolled in Course" options={options.courses} selected={filter.enrolledInCourseIds} onChange={(v) => update({ enrolledInCourseIds: v })} />
              <MultiSelect label="Active Course Access (in progress)" options={options.courses} selected={filter.activeAccessCourseIds} onChange={(v) => update({ activeAccessCourseIds: v })} />
              <MultiSelect label="Free Preview Enrollees" options={options.courses} selected={filter.freePreviewCourseIds} onChange={(v) => update({ freePreviewCourseIds: v })} />
              <MultiSelect label="Completed Course" options={options.courses} selected={filter.completedCourseIds} onChange={(v) => update({ completedCourseIds: v })} />
              <MultiSelect label="Purchased Course (paid order)" options={options.courses} selected={filter.purchasedCourseIds} onChange={(v) => update({ purchasedCourseIds: v })} />
              <MultiSelect label="Purchased Product" options={options.products} selected={filter.purchasedProductIds} onChange={(v) => update({ purchasedProductIds: v })} />
              <MultiSelect label="Downloaded Product" options={options.products} selected={filter.downloadedProductIds} onChange={(v) => update({ downloadedProductIds: v })} />
              <MultiSelect label="In Team/Group" options={options.groups} selected={filter.inGroupIds} onChange={(v) => update({ inGroupIds: v })} />
              <MultiSelect label="In Cohort Group" options={options.cohortGroups} selected={filter.inCohortGroupIds} onChange={(v) => update({ inCohortGroupIds: v })} />
              <MultiSelect label="Submitted Form" options={options.forms} selected={filter.submittedFormIds} onChange={(v) => update({ submittedFormIds: v })} />
              {(options.membershipPlans?.length ?? 0) > 0 && (
                <MultiSelect label="Membership Plan" options={options.membershipPlans!} selected={filter.membershipPlanIds ?? []} onChange={(v) => update({ membershipPlanIds: v })} />
              )}
              <MultiSelect label="Bundle Enrolled" options={options.bundles ?? []} selected={filter.bundleIds ?? []} onChange={(v) => update({ bundleIds: v })} />
              <MultiSelect label="Workshop Enrolled" options={options.workshops ?? []} selected={filter.workshopIds ?? []} onChange={(v) => update({ workshopIds: v })} />
              <MultiSelect label="Community Member" options={options.communities ?? []} selected={filter.communityIds ?? []} onChange={(v) => update({ communityIds: v })} />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Specific Emails (overrides all filters)</label>
            {filter.specificEmails.length > 0 && (
              <div className="mb-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">⚠ Override active:</span>
                <span>Only {filter.specificEmails.length} specific email{filter.specificEmails.length !== 1 ? "s" : ""} will receive this campaign. Clear the field below to send to all matched users.</span>
                <button type="button" onClick={() => { setSpecificEmailsText(""); update({ specificEmails: [] }); }} className="ml-auto text-amber-700 underline font-semibold hover:text-amber-900">Clear</button>
              </div>
            )}
            <Textarea
              value={specificEmailsText}
              onChange={(e) => {
                setSpecificEmailsText(e.target.value);
                const emails = e.target.value.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.includes("@"));
                update({ specificEmails: emails });
              }}
              rows={3}
              placeholder="one@email.com, two@email.com"
              className="text-sm"
            />
          </div>

          {/* A/B segmentation */}
          <div className="border rounded-lg p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={abTest.enabled}
                onChange={(e) => update({
                  abTest: {
                    ...abTest,
                    enabled: e.target.checked,
                    variants: abTest.variants.length > 0 ? abTest.variants : [
                      { key: "A", name: "Variant A", weight: 50 },
                      { key: "B", name: "Variant B", weight: 50 },
                    ],
                  },
                })}
                className="rounded"
              />
              A/B test segmentation
            </label>
            {abTest.enabled && (
              <div className="space-y-2">
                {abTest.variants.map((v, idx) => (
                  <div key={v.key} className="grid grid-cols-12 gap-2 items-center text-sm">
                    <Input className="col-span-2 h-8 text-xs" value={v.key} onChange={(e) => {
                      const variants = [...abTest.variants];
                      variants[idx] = { ...v, key: e.target.value };
                      update({ abTest: { ...abTest, variants } });
                    }} placeholder="Key" />
                    <Input className="col-span-4 h-8 text-xs" value={v.name ?? ""} onChange={(e) => {
                      const variants = [...abTest.variants];
                      variants[idx] = { ...v, name: e.target.value };
                      update({ abTest: { ...abTest, variants } });
                    }} placeholder="Name" />
                    <Input className="col-span-2 h-8 text-xs" type="number" min={1} max={100} value={v.weight} onChange={(e) => {
                      const variants = [...abTest.variants];
                      variants[idx] = { ...v, weight: Number(e.target.value) || 1 };
                      update({ abTest: { ...abTest, variants } });
                    }} />
                    <span className="col-span-1 text-xs text-gray-400">%</span>
                    <Input className="col-span-3 h-8 text-xs" value={v.subject ?? ""} onChange={(e) => {
                      const variants = [...abTest.variants];
                      variants[idx] = { ...v, subject: e.target.value || undefined };
                      update({ abTest: { ...abTest, variants } });
                    }} placeholder="Subject override" />
                  </div>
                ))}
                <p className="text-[10px] text-gray-400">Recipients are split by email hash. Leave subject blank to use the campaign default. Variant HTML overrides can be set when duplicating blocks per variant in a future release.</p>
              </div>
            )}
          </div>

          {preview && preview.sampleEmails.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <span className="font-medium">Sample recipients:</span> {preview.sampleEmails.join(", ")}
              {preview.count > 5 && ` +${preview.count - 5} more`}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────
interface EditorProps {
  campaignId?: number;
  onClose?: () => void;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export default function EmailCampaignEditor({ campaignId, onClose }: EditorProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // ── State ───────────────────────────────────────────────────────────────────
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [blocks, setBlocks] = useState<Block[]>(defaultEmailBlocks());
  const handleBlocksChange = useCallback((newBlocks: Block[]) => setBlocks(newBlocks), []);
  const [filter, setFilter] = useState<AudienceFilter>(DEFAULT_FILTER);
  const [senderProfileId, setSenderProfileId] = useState<number | undefined>();
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | undefined>(campaignId);
  const [isSaving, setIsSaving] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(!campaignId);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LS_KEY = `email_draft_backup_${campaignId ?? "new"}`;

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: senderProfiles } = trpc.emailCampaign.listSenderProfiles.useQuery(undefined, { enabled: !!user });
  const { data: templates } = trpc.emailCampaign.listTemplates.useQuery(undefined, { enabled: !!user });
  const { data: audiencePreview } = trpc.emailCampaign.previewAudience.useQuery(filter, { enabled: !!user });
  const { data: existingCampaign } = trpc.emailCampaign.getCampaign.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId && !!user }
  );

  // ── Load existing draft ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!existingCampaign || draftLoaded) return;
    setSubject(existingCampaign.subject ?? "");
    setPreviewText(existingCampaign.previewText ?? "");
    if (existingCampaign.senderProfileId) setSenderProfileId(existingCampaign.senderProfileId);
    if (existingCampaign.audienceFilter) {
      try {
        const parsed = JSON.parse(existingCampaign.audienceFilter) as Partial<AudienceFilter>;
        setFilter({ ...DEFAULT_FILTER, ...parsed });
      } catch { /* ignore */ }
    }
    if (existingCampaign.blocksJson) {
      try {
        const parsed = JSON.parse(existingCampaign.blocksJson);
        if (Array.isArray(parsed) && parsed.length > 0) setBlocks(parsed);
      } catch {}
    }
    setDraftLoaded(true);
  }, [existingCampaign, draftLoaded]);

  // ── Auto-save to localStorage backup ────────────────────────────────────────
  useEffect(() => {
    if (!draftLoaded) return;
    // Save to localStorage as a backup every time blocks/subject/previewText change
    const backup = { subject, previewText, blocks, filter, senderProfileId, savedAt: Date.now() };
    try { localStorage.setItem(LS_KEY, JSON.stringify(backup)); } catch { /* quota exceeded */ }
  }, [blocks, subject, previewText, filter, senderProfileId, draftLoaded, LS_KEY]);

  // ── Auto-save to server every 30 seconds ─────────────────────────────────────
  const autoSaveDraftMutation = trpc.emailCampaign.saveDraft.useMutation({
    onSuccess: (r) => { setDraftId(r.id); setLastAutoSave(new Date()); },
    onError: () => { /* silent — don't toast on auto-save errors */ },
  });

  useEffect(() => {
    if (!draftLoaded || !user) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      // standalone=false: raw inner HTML, wrapInBrandedEmail provides the 900px outer container
      const htmlBody = emailBlocksToHtml(blocks, undefined, false);
      const wrappedHtml = wrapInBrandedEmail(htmlBody, previewText);
      autoSaveDraftMutation.mutate({
        id: draftId,
        subject, htmlBody: wrappedHtml, previewText,
        audienceFilter: filter,
        senderProfileId,
        blocksJson: JSON.stringify(blocks),
      });
    }, 30_000); // 30 second debounce
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [blocks, subject, previewText, filter, senderProfileId, draftId, draftLoaded, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ───────────────────────────────────────────────────────────────
  const saveDraftMutation = trpc.emailCampaign.saveDraft.useMutation({
    onSuccess: (r) => { setDraftId(r.id); toast.success("Draft saved"); setIsSaving(false); setLastAutoSave(new Date()); try { localStorage.removeItem(LS_KEY); } catch {} },
    onError: (e) => { toast.error(e.message); setIsSaving(false); },
  });

  const sendMutation = trpc.emailCampaign.sendCampaign.useMutation({
    onSuccess: (r) => {
      toast.success(`Sending to ${r.recipientCount} recipient${r.recipientCount !== 1 ? "s" : ""}…`);
      setSendDialogOpen(false);
      if (onClose) onClose(); else navigate("/admin/email");
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduleMutation = trpc.emailCampaign.scheduleCampaign.useMutation({
    onSuccess: (r) => {
      toast.success(`Scheduled for ${new Date(r.scheduledAt).toLocaleString()}`);
      setScheduleDialogOpen(false);
      if (onClose) onClose(); else navigate("/admin/email");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveTemplateMutation = trpc.emailCampaign.saveTemplate.useMutation({
    onSuccess: () => { toast.success("Template saved"); setSaveTemplateDialogOpen(false); setTemplateName(""); },
    onError: (e) => toast.error(e.message),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // standalone=false: raw inner HTML, wrapInBrandedEmail provides the 900px outer container
  const htmlBody = useMemo(() => emailBlocksToHtml(blocks, undefined, false), [blocks]);
  const wrappedHtml = useMemo(() => wrapInBrandedEmail(htmlBody, previewText), [htmlBody, previewText]);

  function handleSaveDraft() {
    setIsSaving(true);
    saveDraftMutation.mutate({
      id: draftId,
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
      senderProfileId,
      blocksJson: JSON.stringify(blocks),
    });
  }

  function handleSend() {
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    if (blocks.length === 0) { toast.error("Add at least one content block"); return; }
    setSendDialogOpen(true);
  }

  function confirmSend() {
    sendMutation.mutate({
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
      blocksJson: JSON.stringify(blocks),
    });
  }

  function confirmSchedule() {
    if (!scheduledAt) { toast.error("Pick a date/time"); return; }
    scheduleMutation.mutate({
      subject, htmlBody: wrappedHtml, previewText,
      audienceFilter: filter,
      scheduledAt: new Date(scheduledAt),
      blocksJson: JSON.stringify(blocks),
    });
  }

  function loadTemplate(t: any) {
    setSubject(t.subject || "");
    setPreviewText(t.previewText || "");
    // Load blocks from blocksJson if available, otherwise create a text block from HTML
    if (t.blocksJson) {
      try {
        setBlocks(JSON.parse(t.blocksJson));
      } catch {
        setBlocks([{ id: uid(), type: "text", data: { html: t.htmlBody || "", align: "left", bgColor: "#ffffff", textColor: "#1a2e3b" } }]);
      }
    } else {
      setBlocks([{ id: uid(), type: "text", data: { html: t.htmlBody || "", align: "left", bgColor: "#ffffff", textColor: "#1a2e3b" } }]);
    }
    setLoadTemplateDialogOpen(false);
    toast.success(`Loaded: ${t.name}`);
  }

  const goBack = onClose ?? (() => navigate("/admin/email"));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#189aa1" }}>
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{draftId ? "Edit Campaign" : "New Campaign"}</h1>
            {draftId && <p className="text-xs text-gray-400">Draft #{draftId}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLoadTemplateDialogOpen(true)}>
            <LayoutTemplate className="w-4 h-4 mr-1.5" /> Templates
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          {/* Auto-save status indicator */}
          {autoSaveDraftMutation.isPending ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Saving…
            </span>
          ) : lastAutoSave ? (
            <span className="text-xs text-gray-400 flex items-center gap-1" title={`Auto-saved at ${lastAutoSave.toLocaleTimeString()}`}>
              <Check className="w-3 h-3 text-green-500" />
              Auto-saved {formatRelativeTime(lastAutoSave)}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="w-4 h-4 mr-1.5" /> {isSaving ? "Saving…" : "Save Draft"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleDialogOpen(true)}>
            <Clock className="w-4 h-4 mr-1.5" /> Schedule
          </Button>
          <Button size="sm" onClick={handleSend} style={{ background: "#189aa1" }} className="text-white hover:opacity-90">
            <Send className="w-4 h-4 mr-1.5" /> Send Now
          </Button>
        </div>
      </div>

      <div className={`p-6 ${showPreview ? "grid grid-cols-2 gap-6" : ""}`}>
        {/* Editor column */}
        <div className="space-y-4">
          {/* Subject + preview text */}
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subject Line <span className="text-red-400">*</span></label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter email subject…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Preview Text <span className="text-gray-400 font-normal">(shown in inbox)</span></label>
                <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Short preview shown in email clients…" maxLength={300} />
              </div>
              {/* Sender profile */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">From (Sender Profile)</label>
                <Select value={senderProfileId?.toString() ?? "__default__"} onValueChange={(v) => setSenderProfileId(v && v !== "__default__" ? parseInt(v) : undefined)}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Default sender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default sender</SelectItem>
                    {(senderProfiles ?? []).map((sp) => (
                      <SelectItem key={sp.id} value={sp.id.toString()}>
                        {sp.name} &lt;{sp.email}&gt;{sp.isDefault ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Block editor */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Email Body</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSaveTemplateDialogOpen(true)} className="text-xs text-gray-500">
                  <Save className="w-3 h-3 mr-1" /> Save as Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0" style={{ minHeight: 400 }}>
              <EmailBlockEditor key={draftLoaded ? "loaded" : "default"} initialBlocks={blocks} onChange={handleBlocksChange} />
            </CardContent>
          </Card>

          {/* Audience filter */}
          <AudienceFilterBuilder filter={filter} onChange={setFilter} preview={audiencePreview} />
        </div>

        {/* Preview column */}
        {showPreview && (
          <div className="sticky top-20 self-start">
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
                <button onClick={() => setPreviewMode("desktop")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${previewMode === "desktop" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                  <Monitor className="w-3.5 h-3.5" /> Desktop
                </button>
                <button onClick={() => setPreviewMode("mobile")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${previewMode === "mobile" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                  <Smartphone className="w-3.5 h-3.5" /> Mobile
                </button>
                <span className="ml-auto text-xs text-gray-400">{subject || "(no subject)"}</span>
              </div>
              <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
                <div className={`mx-auto ${previewMode === "mobile" ? "max-w-sm" : "max-w-2xl"} p-4`}>
                  <iframe
                    srcDoc={wrappedHtml}
                    className="w-full border-0 rounded"
                    style={{ height: "600px" }}
                    title="Email preview"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send confirmation dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">You are about to send <strong>"{subject}"</strong> to:</p>
            <div className="bg-[#f0fbfc] border border-[#189aa1]/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#189aa1]">{audiencePreview?.count ?? 0}</div>
              <div className="text-xs text-gray-500">recipients</div>
            </div>
            <p className="text-xs text-gray-400">An unsubscribe link will be automatically added to every email.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSend} disabled={sendMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">Send at</label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            <p className="text-xs text-gray-400">Campaign will be sent to {audiencePreview?.count ?? 0} recipients at the scheduled time.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSchedule} disabled={scheduleMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              <Clock className="w-4 h-4 mr-1.5" /> Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-gray-700">Template name</label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Monthly Newsletter" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
            <Button         onClick={() => saveTemplateMutation.mutate({ name: templateName, subject, htmlBody: wrappedHtml, previewText, blocksJson: JSON.stringify(blocks) })} disabled={!templateName.trim() || saveTemplateMutation.isPending} style={{ background: "#189aa1" }} className="text-white">
              <Save className="w-4 h-4 mr-1.5" /> Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load template dialog */}
      <Dialog open={loadTemplateDialogOpen} onOpenChange={setLoadTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Load Template</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto py-2">
            {(!templates || templates.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No saved templates yet.</p>}
            {(templates ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-[#189aa1] cursor-pointer" onClick={() => loadTemplate(t)}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.subject}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-[#189aa1]">Use</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
