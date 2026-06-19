/**
 * Shared embed configuration UI for courses, workshops, downloads, and physical products.
 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Copy, Eye, EyeOff, Loader2 } from "lucide-react";

export type ContentEmbedEntityType = "course" | "workshop" | "download" | "physical";

export interface InstanceEmbedItem {
  id: number;
  label: string;
  startDate?: string | Date | null;
  location?: string | null;
}

export interface ContentEmbedTabProps {
  entityType: ContentEmbedEntityType;
  slug: string;
  title: string;
  subtitle?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  defaultCheckoutUrl: string;
  /** Course / cohort curriculum accordion */
  courseId?: number;
  sections?: any[];
  showCurriculumAccordion?: boolean;
  /** Workshop instances or cohort groups for instance-page embed */
  instanceItems?: InstanceEmbedItem[];
  instanceEmbedKind?: "workshop" | "cohort";
  /** When set, fetches cohort groups for instance embed (cohort courses) */
  courseIdForGroups?: number;
}

function ctaEmbedPath(entityType: ContentEmbedEntityType, slug: string, baseUrl: string, query: string) {
  if (entityType === "course") {
    return `${baseUrl}/embed/curriculum-cta/${slug}?${query}`;
  }
  return `${baseUrl}/embed/content-cta/${entityType}/${slug}?${query}`;
}

function ctaScriptSrc(entityType: ContentEmbedEntityType, baseUrl: string) {
  return entityType === "course"
    ? `${baseUrl}/embed/curriculum-cta.js`
    : `${baseUrl}/embed/content-cta.js`;
}

function ctaEmbedAttr(entityType: ContentEmbedEntityType, slug: string) {
  return entityType === "course"
    ? { "data-cta-card-embed": slug }
    : { "data-content-cta-embed": slug, "data-entity-type": entityType };
}

export function ContentEmbedTab({
  entityType,
  slug,
  title,
  subtitle,
  coverImageUrl,
  thumbnailUrl,
  defaultCheckoutUrl,
  courseId,
  sections = [],
  showCurriculumAccordion = false,
  instanceItems: instanceItemsProp,
  instanceEmbedKind,
  courseIdForGroups,
}: ContentEmbedTabProps) {
  const baseUrl = window.location.origin;

  const { data: cohortGroups = [] } = trpc.lmsAdmin.listCohortGroups.useQuery(
    { courseId: courseIdForGroups! },
    { enabled: !!courseIdForGroups && instanceEmbedKind === "cohort" && !instanceItemsProp?.length },
  );

  const instanceItems = useMemo<InstanceEmbedItem[]>(() => {
    if (instanceItemsProp?.length) return instanceItemsProp;
    if (instanceEmbedKind === "cohort" && cohortGroups.length) {
      return cohortGroups.map((g: any) => ({
        id: g.id,
        label: g.name ?? `Group ${g.id}`,
        startDate: g.startDate ?? null,
        location: g.location ?? null,
      }));
    }
    return [];
  }, [instanceItemsProp, instanceEmbedKind, cohortGroups]);

  const [accentColor, setAccentColor] = useState("#14adb8");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ctaUrl, setCtaUrl] = useState(defaultCheckoutUrl);
  const [ctaLabel, setCtaLabel] = useState("Enroll Now");
  const [copied, setCopied] = useState<string | null>(null);

  const [showCta, setShowCta] = useState(true);
  const [ctaLayout, setCtaLayout] = useState<"vertical" | "horizontal">("vertical");
  const [showImage, setShowImage] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMeta, setShowMeta] = useState(entityType === "course");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");

  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(
    instanceItems[0]?.id ?? null,
  );

  // CTA Card: optional cohort/instance override (drill-down)
  // Use "none" as the sentinel string so Radix Select never receives an empty value.
  const NONE_SENTINEL = "__none__";
  const [ctaInstanceId, setCtaInstanceId] = useState<number | null>(null);

  React.useEffect(() => {
    if (instanceItems.length && !instanceItems.some(i => i.id === selectedInstanceId)) {
      setSelectedInstanceId(instanceItems[0]?.id ?? null);
    }
  }, [instanceItems, selectedInstanceId]);

  // When a cohort/instance is selected for the CTA card, auto-update ctaUrl AND
  // pre-fill customTitle/customSubtitle with the instance label + date/location.
  React.useEffect(() => {
    if (ctaInstanceId != null && instanceEmbedKind) {
      const item = instanceItems.find(i => i.id === ctaInstanceId);
      if (item) {
        const path = instanceEmbedKind === "cohort"
          ? `/courses/${slug}?group=${ctaInstanceId}`
          : `/workshops/${slug}?instance=${ctaInstanceId}`;
        setCtaUrl(`${baseUrl}${path}`);
        // Pre-fill title with the cohort/instance label.
        setCustomTitle(item.label);
        // Build a subtitle from start date + location.
        const parts: string[] = [];
        if (item.startDate) {
          const d = new Date(item.startDate);
          parts.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
        }
        if (item.location) parts.push(item.location);
        setCustomSubtitle(parts.join(" • "));
      }
    } else if (ctaInstanceId === null) {
      setCtaUrl(defaultCheckoutUrl);
      setCustomTitle("");
      setCustomSubtitle("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctaInstanceId]);

  const ctaQuery = [
    `accent=${encodeURIComponent(accentColor)}`,
    `theme=${theme}`,
    `ctaUrl=${encodeURIComponent(ctaUrl)}`,
    `ctaLabel=${encodeURIComponent(ctaLabel)}`,
    `layout=${ctaLayout}`,
    `showImage=${showImage ? "1" : "0"}`,
    `showPrice=${showPrice ? "1" : "0"}`,
    `showMeta=${showMeta ? "1" : "0"}`,
    `imageUrl=${encodeURIComponent(customImageUrl)}`,
    `title=${encodeURIComponent(customTitle)}`,
    `subtitle=${encodeURIComponent(customSubtitle)}`,
  ].join("&");

  const accordionSrc = showCurriculumAccordion
    ? `${baseUrl}/embed/curriculum/${slug}?accent=${encodeURIComponent(accentColor)}&theme=${theme}&ctaUrl=${encodeURIComponent(ctaUrl)}&ctaLabel=${encodeURIComponent(ctaLabel)}&cta=${showCta ? "1" : "0"}`
    : "";

  const ctaCardSrc = ctaEmbedPath(entityType, slug, baseUrl, ctaQuery);

  const instanceSrc =
    selectedInstanceId && instanceEmbedKind
      ? `${baseUrl}/embed/instance/${instanceEmbedKind}/${selectedInstanceId}`
      : "";

  const accordionScriptEmbed = `<div\n  data-curriculum-embed="${slug}"\n  data-accent="${accentColor}"\n  data-theme="${theme}"\n  data-cta-url="${ctaUrl}"\n  data-cta-label="${ctaLabel}"\n  data-cta="${showCta ? "1" : "0"}"\n  data-base-url="${baseUrl}"\n></div>\n<script src="${baseUrl}/embed/curriculum.js" async><\/script>`;

  const accordionIframeEmbed = `<iframe\n  src="${accordionSrc}"\n  style="width:100%;border:none;min-height:400px;"\n  scrolling="no"\n  frameborder="0"\n  allowtransparency="true"\n  title="${title} — Curriculum"\n></iframe>`;

  const ctaAttrs = ctaEmbedAttr(entityType, slug);
  const ctaAttrLines = Object.entries(ctaAttrs)
    .map(([k, v]) => `  ${k}="${v}"`)
    .join("\n");

  const ctaCardScriptEmbed = `<div\n${ctaAttrLines}\n  data-accent="${accentColor}"\n  data-theme="${theme}"\n  data-cta-url="${ctaUrl}"\n  data-cta-label="${ctaLabel}"\n  data-layout="${ctaLayout}"\n  data-show-image="${showImage ? "1" : "0"}"\n  data-show-price="${showPrice ? "1" : "0"}"\n  data-show-meta="${showMeta ? "1" : "0"}"${customImageUrl ? `\n  data-image-url="${customImageUrl}"` : ""}${customTitle ? `\n  data-title="${customTitle}"` : ""}${customSubtitle ? `\n  data-subtitle="${customSubtitle}"` : ""}\n  data-base-url="${baseUrl}"\n></div>\n<script src="${ctaScriptSrc(entityType, baseUrl)}" async><\/script>`;

  const ctaCardIframeEmbed = `<iframe\n  src="${ctaCardSrc}"\n  style="width:100%;max-width:${ctaLayout === "horizontal" ? "480" : "320"}px;border:none;min-height:${ctaLayout === "horizontal" ? "140" : "320"}px;"\n  scrolling="no"\n  frameborder="0"\n  allowtransparency="true"\n  title="${title}"\n></iframe>`;

  const instanceScriptEmbed =
    selectedInstanceId && instanceEmbedKind
      ? `<div\n  data-instance-embed="${instanceEmbedKind}:${selectedInstanceId}"\n  data-base-url="${baseUrl}"\n></div>\n<script src="${baseUrl}/embed/instance.js" async><\/script>`
      : "";

  const instanceIframeEmbed =
    instanceSrc
      ? `<iframe\n  src="${instanceSrc}"\n  style="width:100%;border:none;min-height:500px;"\n  scrolling="yes"\n  frameborder="0"\n  title="${title} — ${instanceEmbedKind === "cohort" ? "Group" : "Instance"} Page"\n></iframe>`
      : "";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const defaultImage = coverImageUrl ?? thumbnailUrl ?? "";

  const SharedOptions = (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Accent Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            className="h-8 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
          />
          <Input
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            className="h-8 text-xs font-mono flex-1"
            placeholder="#14b8a6"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Theme</Label>
        <Select value={theme} onValueChange={(v: "light" | "dark") => setTheme(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Button URL</Label>
        <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} className="h-8 text-xs" placeholder="https://..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Button Label</Label>
        <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} className="h-8 text-xs" placeholder="Enroll Now" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {showCurriculumAccordion && courseId != null && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Curriculum Accordion Embed</h3>
          <p className="text-sm text-gray-500 mb-5">
            Embed the full course curriculum accordion on any external website. Fully self-contained, auto-resizes, no login required.
          </p>

          {SharedOptions}

          <div className="flex items-center gap-3 mb-6">
            <Switch checked={showCta} onCheckedChange={setShowCta} />
            <span className="text-xs text-gray-600">Show enroll button below accordion</span>
          </div>

          <EmbedVisibilitySection courseId={courseId} sections={sections} />

          <div className="mb-6 mt-6">
            <p className="text-xs font-medium text-gray-600 mb-2">Live Preview</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <iframe
                src={accordionSrc}
                style={{ width: "100%", border: "none", minHeight: 320, display: "block" }}
                title="Curriculum accordion preview"
              />
            </div>
          </div>

          <div className="space-y-4">
            <EmbedCodeBlock
              title="Script Tag (Recommended)"
              hint="Paste before </body>. Auto-resizes."
              value={accordionScriptEmbed}
              copyKey="acc-script"
              copied={copied}
              onCopy={copy}
              rows={6}
            />
            <EmbedCodeBlock
              title="Direct <iframe>"
              hint="For Kajabi, Squarespace, and platforms that block script tags."
              value={accordionIframeEmbed}
              copyKey="acc-iframe"
              copied={copied}
              onCopy={copy}
              rows={8}
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-gray-800">JSON Data Endpoint</p>
                  <p className="text-xs text-gray-500">Build a fully custom UI with your own styles.</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => copy(`${baseUrl}/api/curriculum-embed/data?courseSlug=${slug}`, "json")}>
                  <Copy className="h-3 w-3 mr-1" />{copied === "json" ? "Copied!" : "Copy"}
                </Button>
              </div>
              <Input readOnly value={`${baseUrl}/api/curriculum-embed/data?courseSlug=${slug}`} className="h-8 text-xs font-mono bg-white" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">CTA Card Embed</h3>
        <p className="text-sm text-gray-500 mb-5">
          A compact promotional card with image, title, price, and an enroll button. Great for sidebars, blog posts, or email landing pages.
        </p>

        {SharedOptions}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Layout</Label>
            <Select value={ctaLayout} onValueChange={(v: "vertical" | "horizontal") => setCtaLayout(v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Vertical (image on top)</SelectItem>
                <SelectItem value="horizontal">Horizontal (image on left)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Custom Image URL <span className="text-gray-400">(optional)</span></Label>
            <Input
              value={customImageUrl}
              onChange={e => setCustomImageUrl(e.target.value)}
              className="h-8 text-xs"
              placeholder={defaultImage ? "Leave blank to use cover image" : "https://..."}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Custom Title <span className="text-gray-400">(optional)</span></Label>
            <Input value={customTitle} onChange={e => setCustomTitle(e.target.value)} className="h-8 text-xs" placeholder={title} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700">Custom Subtitle <span className="text-gray-400">(optional)</span></Label>
            <Input value={customSubtitle} onChange={e => setCustomSubtitle(e.target.value)} className="h-8 text-xs" placeholder={subtitle ?? "Short description..."} />
          </div>
        </div>

        {/* Cohort/Instance drill-down for CTA card */}
        {instanceEmbedKind && instanceItems.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-teal-100 bg-teal-50/40">
            <Label className="text-xs font-semibold text-teal-800 block mb-1">
              {instanceEmbedKind === "cohort" ? "Cohort Group" : "Workshop Instance"} Override <span className="font-normal text-teal-600">(optional)</span>
            </Label>
            <p className="text-[10px] text-teal-700 mb-2">
              Select a specific {instanceEmbedKind === "cohort" ? "cohort group" : "instance"} to point the button URL directly to that {instanceEmbedKind === "cohort" ? "group" : "instance"}'s enrollment page. Leave blank to use the main course URL.
            </p>
            <Select
              value={ctaInstanceId != null ? String(ctaInstanceId) : NONE_SENTINEL}
              onValueChange={v => setCtaInstanceId(v === NONE_SENTINEL ? null : Number(v))}
            >
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="Main course URL (no override)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_SENTINEL}>Main course URL (no override)</SelectItem>
                {instanceItems.map(item => {
                  const parts: string[] = [];
                  if (item.startDate) {
                    const d = new Date(item.startDate);
                    parts.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
                  }
                  if (item.location) parts.push(item.location);
                  const meta = parts.join(" • ");
                  return (
                    <SelectItem key={item.id} value={String(item.id)}>
                      <span className="font-medium">{item.label}</span>
                      {meta && <span className="text-gray-400 ml-1 text-[10px]">({meta})</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap gap-5 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={showImage} onCheckedChange={setShowImage} />
            <span className="text-xs text-gray-600">Show image</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={showPrice} onCheckedChange={setShowPrice} />
            <span className="text-xs text-gray-600">Show price</span>
          </label>
          {entityType === "course" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={showMeta} onCheckedChange={setShowMeta} />
              <span className="text-xs text-gray-600">Show lesson/duration stats</span>
            </label>
          )}
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-600 mb-2">Live Preview</p>
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-4 flex justify-start">
            <iframe
              src={ctaCardSrc}
              style={{
                width: "100%",
                maxWidth: ctaLayout === "horizontal" ? 480 : 320,
                border: "none",
                minHeight: ctaLayout === "horizontal" ? 160 : 340,
                display: "block",
              }}
              title="CTA card preview"
            />
          </div>
        </div>

        <div className="space-y-4">
          <EmbedCodeBlock
            title="Script Tag (Recommended)"
            hint="Paste before </body>. Auto-resizes."
            value={ctaCardScriptEmbed}
            copyKey="cta-script"
            copied={copied}
            onCopy={copy}
            rows={8}
          />
          <EmbedCodeBlock
            title="Direct <iframe>"
            hint="For platforms that block script tags."
            value={ctaCardIframeEmbed}
            copyKey="cta-iframe"
            copied={copied}
            onCopy={copy}
            rows={7}
          />
        </div>
      </div>

      {instanceEmbedKind && instanceItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            {instanceEmbedKind === "cohort" ? "Cohort Group Page Embed" : "Workshop Instance Page Embed"}
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            Embed a specific {instanceEmbedKind === "cohort" ? "cohort group" : "workshop instance"} landing page on any external website.
            Shows the page builder content for that {instanceEmbedKind === "cohort" ? "group" : "instance"}.
          </p>

          <div className="space-y-1.5 mb-6 max-w-md">
            <Label className="text-xs font-medium text-gray-700">
              {instanceEmbedKind === "cohort" ? "Cohort Group" : "Workshop Instance"}
            </Label>
            <Select
              value={selectedInstanceId != null ? String(selectedInstanceId) : ""}
              onValueChange={v => setSelectedInstanceId(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {instanceItems.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {instanceSrc && (
            <div className="mb-6">
              <p className="text-xs font-medium text-gray-600 mb-2">Live Preview</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                <iframe
                  src={instanceSrc}
                  style={{ width: "100%", border: "none", minHeight: 400, display: "block" }}
                  title="Instance page preview"
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <EmbedCodeBlock
              title="Script Tag (Recommended)"
              hint="Paste before </body>. Embeds the full instance/group page."
              value={instanceScriptEmbed}
              copyKey="inst-script"
              copied={copied}
              onCopy={copy}
              rows={5}
            />
            <EmbedCodeBlock
              title="Direct <iframe>"
              hint="For platforms that block script tags."
              value={instanceIframeEmbed}
              copyKey="inst-iframe"
              copied={copied}
              onCopy={copy}
              rows={6}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmbedCodeBlock({
  title,
  hint,
  value,
  copyKey,
  copied,
  onCopy,
  rows,
}: {
  title: string;
  hint: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  rows: number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => onCopy(value, copyKey)}>
          <Copy className="h-3 w-3 mr-1" />{copied === copyKey ? "Copied!" : "Copy"}
        </Button>
      </div>
      <textarea readOnly value={value} rows={rows} className="w-full text-xs font-mono bg-white border border-gray-200 rounded p-2 resize-none focus:outline-none" />
    </div>
  );
}

function EmbedVisibilitySection({ courseId, sections }: { courseId: number; sections: any[] }) {
  const utils = trpc.useUtils();
  const { data: visData, isLoading } = trpc.lmsCourseBuilder.getCurriculumEmbedVisibility.useQuery({ courseId });
  const setVisibility = trpc.lmsCourseBuilder.setCurriculumEmbedVisibility.useMutation({
    onSuccess: () => {
      toast.success("Embed visibility updated");
      utils.lmsCourseBuilder.getCurriculumEmbedVisibility.invalidate({ courseId });
    },
    onError: (e) => toast.error(e.message),
  });

  const hiddenMap = visData?.hiddenMap ?? {};
  const [collapsed, setCollapsed] = useState(true);

  const toggle = (itemType: "section" | "lesson", itemId: number, currentlyHidden: boolean) => {
    setVisibility.mutate({
      courseId,
      items: [{ itemType, itemId, hidden: !currentlyHidden }],
    });
  };

  const allItems = useMemo(() => {
    const items: Array<{ itemType: "section" | "lesson"; itemId: number }> = [];
    sections.forEach((s: any) => {
      items.push({ itemType: "section", itemId: s.id });
      (s.lessons ?? []).forEach((l: any) => items.push({ itemType: "lesson", itemId: l.id }));
    });
    return items;
  }, [sections]);

  const handleBulkToggle = (hidden: boolean) => {
    if (allItems.length === 0) return;
    setVisibility.mutate({
      courseId,
      items: allItems.map(i => ({ ...i, hidden })),
    });
  };

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/60 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-left px-4 py-3 hover:bg-gray-50"
        onClick={() => setCollapsed(c => !c)}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Embed Visibility Control</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose which modules and lessons appear in the curriculum embed above.
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200">
          {sections.length > 0 && !isLoading && (
            <div className="flex items-center gap-2 pt-3">
              <span className="text-xs text-gray-500 mr-1">Bulk:</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
                disabled={setVisibility.isPending}
                onClick={() => handleBulkToggle(false)}
              >
                <Eye className="w-3 h-3" /> Show All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                disabled={setVisibility.isPending}
                onClick={() => handleBulkToggle(true)}
              >
                <EyeOff className="w-3 h-3" /> Hide All
              </Button>
              {setVisibility.isPending && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No modules found for this course.</p>
          ) : (
            sections.map((section: any) => {
              const sectionKey = `section_${section.id}`;
              const sectionHidden = !!hiddenMap[sectionKey];
              return (
                <div key={section.id} className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                  <div className={`flex items-center gap-3 px-4 py-2.5 ${sectionHidden ? "bg-gray-50" : "bg-teal-50/40"}`}>
                    <Switch
                      checked={!sectionHidden}
                      onCheckedChange={() => toggle("section", section.id, sectionHidden)}
                      disabled={setVisibility.isPending}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-semibold truncate block ${sectionHidden ? "text-gray-400 line-through" : "text-gray-800"}`}>
                        {section.title}
                      </span>
                    </div>
                    {sectionHidden ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <EyeOff className="w-3.5 h-3.5" /> Hidden
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                        <Eye className="w-3.5 h-3.5" /> Visible
                      </span>
                    )}
                  </div>
                  {(section.lessons ?? []).map((lesson: any) => {
                    const lessonKey = `lesson_${lesson.id}`;
                    const lessonHidden = !!hiddenMap[lessonKey];
                    return (
                      <div
                        key={lesson.id}
                        className={`flex items-center gap-3 px-4 py-2 border-t border-gray-100 ml-4 ${lessonHidden ? "bg-gray-50/50" : ""}`}
                      >
                        <Switch
                          checked={!lessonHidden}
                          onCheckedChange={() => toggle("lesson", lesson.id, lessonHidden)}
                          disabled={setVisibility.isPending || sectionHidden}
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs truncate block ${lessonHidden || sectionHidden ? "text-gray-400 line-through" : "text-gray-600"}`}>
                            {lesson.title}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          <p className="text-xs text-gray-400">
            Changes take effect immediately. Refresh the curriculum preview to see updates.
          </p>
        </div>
      )}
    </div>
  );
}
