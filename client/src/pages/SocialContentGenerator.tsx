/*
 * SocialContentGenerator — Admin Only
 * AI-powered ultrasound & echocardiography social media content generator.
 * Produces branded 1080×1080 image cards (memes, clinical pearls, tips, etc.)
 * with dark/light themes, PNG download, and ready-to-copy social posts.
 */
import { useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  ArrowLeft, Download, Loader2, AlertCircle, ImageIcon,
  Sparkles, Package, Share2, Copy, Check, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Brand palette ────────────────────────────────────────────────────────────
const BRAND = "#189aa1";
const BRAND_DARK = "#0d3d44";
const BRAND_AQUA = "#4ad9e0";
const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_teal_f0c966ce.png";

// ── Theme tokens ─────────────────────────────────────────────────────────────
type CardTheme = "dark" | "light";

interface ThemeTokens {
  cardBg: string;
  overlayBg: string;
  accentBar: string;
  leftStripe: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  footerColor: string;
  footerRight: string;
  dividerColor: string;
  subtextBg: string;
  subtextBorder: string;
  subtextColor: string;
  pillBg: string;
  pillBorder: string;
  pillColor: string;
}

const DARK_THEME: ThemeTokens = {
  cardBg: "#071318",
  overlayBg: "linear-gradient(160deg, rgba(5,14,22,0.92) 0%, rgba(7,25,35,0.88) 50%, rgba(5,14,22,0.94) 100%)",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  leftStripe: `linear-gradient(180deg, ${BRAND_AQUA}bb 0%, ${BRAND}44 60%, transparent 100%)`,
  headingColor: "#fff",
  bodyColor: "rgba(255,255,255,0.88)",
  mutedColor: "rgba(255,255,255,0.55)",
  footerColor: BRAND_AQUA,
  footerRight: "rgba(255,255,255,0.25)",
  dividerColor: `${BRAND}55`,
  subtextBg: `linear-gradient(135deg, ${BRAND}12, rgba(255,255,255,0.02))`,
  subtextBorder: `${BRAND}44`,
  subtextColor: "rgba(255,255,255,0.70)",
  pillBg: `linear-gradient(135deg, ${BRAND}33, ${BRAND_AQUA}18)`,
  pillBorder: BRAND_AQUA,
  pillColor: BRAND_AQUA,
};

const LIGHT_THEME: ThemeTokens = {
  cardBg: "#e8f7f8",
  overlayBg: "linear-gradient(160deg, rgba(220,245,248,0.95) 0%, rgba(200,238,242,0.90) 50%, rgba(215,244,247,0.96) 100%)",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  leftStripe: `linear-gradient(180deg, ${BRAND}cc 0%, ${BRAND}55 60%, transparent 100%)`,
  headingColor: BRAND_DARK,
  bodyColor: "#0d3d44",
  mutedColor: `${BRAND_DARK}bb`,
  footerColor: BRAND,
  footerRight: `${BRAND_DARK}66`,
  dividerColor: `${BRAND}44`,
  subtextBg: `linear-gradient(135deg, ${BRAND}0e, rgba(74,217,224,0.06))`,
  subtextBorder: `${BRAND}44`,
  subtextColor: "#0d3d44",
  pillBg: `linear-gradient(135deg, ${BRAND}22, ${BRAND_AQUA}18)`,
  pillBorder: BRAND,
  pillColor: BRAND_DARK,
};

// ── Hashtags ─────────────────────────────────────────────────────────────────
const REQUIRED_HASHTAGS = [
  "#AllAboutUltrasound",
  "#UltrasoundAssist",
  "#Sonography",
  "#Ultrasound",
  "#MedicalImaging",
  "#Sonographer",
  "#UltrasoundEducation",
];

const CATEGORY_HASHTAGS: Record<string, string[]> = {
  "Abdominal": ["#AbdominalUltrasound", "#AbdominalImaging"],
  "Small Parts": ["#ThyroidUltrasound", "#SmallPartsUltrasound"],
  "Pelvic/Gyn": ["#PelvicUltrasound", "#GynUltrasound"],
  "OB 1st Trimester": ["#ObstetricUltrasound", "#FirstTrimester"],
  "OB 2nd/3rd Trimester": ["#ObstetricUltrasound", "#FetalImaging"],
  "Fetal Echo": ["#FetalEcho", "#FetalCardiology"],
  "Breast": ["#BreastUltrasound", "#BreastImaging"],
  "Vascular": ["#VascularUltrasound", "#DuplexScan"],
  "MSK": ["#MSKUltrasound", "#MusculoskeletalUltrasound"],
  "POCUS": ["#POCUS", "#PointOfCareUltrasound"],
  "Physics": ["#UltrasoundPhysics", "#SonographyPhysics"],
  "Echocardiography": ["#Echocardiography", "#CardiacUltrasound", "#EchoFirst"],
  "General Ultrasound": ["#DiagnosticUltrasound", "#SonographyLife"],
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  meme: "😂",
  clinical_pearl: "💎",
  did_you_know: "🤔",
  motivational: "💪",
  myth_vs_fact: "⚡",
  tip_of_the_day: "💡",
  anatomy_spotlight: "🔬",
  case_teaser: "🔍",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  meme: "Meme",
  clinical_pearl: "Clinical Pearl",
  did_you_know: "Did You Know?",
  motivational: "Motivational",
  myth_vs_fact: "Myth vs Fact",
  tip_of_the_day: "Tip of the Day",
  anatomy_spotlight: "Anatomy Spotlight",
  case_teaser: "Case Teaser",
};

// ── Render helpers ───────────────────────────────────────────────────────────

function buildFullSocialPost(item: GeneratedItem): string {
  const catTags = CATEGORY_HASHTAGS[item.category] || [];
  const allHashtags = [...REQUIRED_HASHTAGS, ...catTags].join(" ");
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;

  return `${icon} ${label} — ${item.category}

${item.socialCaption}

🔗 app.allaboutultrasound.com

${allHashtags}`;
}

async function renderCardToPng(el: HTMLElement): Promise<string> {
  const actualHeight = el.scrollHeight || 1080;
  return toPng(el, {
    cacheBust: true,
    pixelRatio: 1,
    width: 1080,
    height: actualHeight,
  });
}

// ── Card Components ──────────────────────────────────────────────────────────

function CardShell({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  return (
    <div
      style={{
        width: 1080,
        minHeight: 1080,
        position: "relative",
        fontFamily: "'Segoe UI', 'Open Sans', sans-serif",
        boxSizing: "border-box",
        background: t.cardBg,
      }}
    >
      {/* Abstract background pattern */}
      <div style={{ position: "absolute", inset: 0, background: t.overlayBg }} />
      {/* Top accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 7, background: t.accentBar }} />
      {/* Left accent stripe */}
      <div style={{ position: "absolute", top: 7, left: 0, bottom: 0, width: 4, background: t.leftStripe }} />
      {/* Corner glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 300,
          height: 300,
          background: `linear-gradient(225deg, ${BRAND}1a 0%, transparent 60%)`,
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
        }}
      />
      {/* Content */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: 1080,
          display: "flex",
          flexDirection: "column",
          padding: "52px 64px 44px 68px",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ContentCard({
  item,
  t,
}: {
  item: GeneratedItem;
  t: ThemeTokens;
}) {
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;

  return (
    <CardShell t={t}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              overflow: "hidden",
              border: `2.5px solid ${BRAND}88`,
              boxShadow: `0 0 24px ${BRAND}55`,
              flexShrink: 0,
            }}
          >
            <img src={LOGO_URL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <span style={{ color: t.headingColor, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>
              All About Ultrasound™
            </span>
            <div style={{ color: BRAND, fontSize: 13, fontWeight: 600, marginTop: 4, letterSpacing: "0.8px", textTransform: "uppercase" }}>
              {item.category}
            </div>
          </div>
        </div>
        {/* Type pill */}
        <div
          style={{
            background: t.pillBg,
            border: `1.5px solid ${t.pillBorder}`,
            borderRadius: 28,
            padding: "9px 22px",
            color: t.pillColor,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
          }}
        >
          {icon} {label}
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        <div style={{ height: 3, width: 44, borderRadius: 2, background: `linear-gradient(90deg, ${BRAND_AQUA}, ${BRAND})` }} />
        <div style={{ height: 3, width: 10, borderRadius: 2, background: t.dividerColor }} />
        <div style={{ height: 3, width: 5, borderRadius: 2, background: t.dividerColor + "88" }} />
      </div>

      {/* Headline */}
      <div
        style={{
          color: t.headingColor,
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.25,
          marginBottom: 28,
          fontFamily: "'Georgia', 'Merriweather', serif",
          textShadow: t === DARK_THEME ? "0 2px 20px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {item.headline}
      </div>

      {/* Body */}
      <div
        style={{
          color: t.bodyColor,
          fontSize: 30,
          fontWeight: 400,
          lineHeight: 1.55,
          marginBottom: item.subtext ? 24 : 0,
          flex: "1 1 auto",
        }}
      >
        {item.body}
      </div>

      {/* Subtext / source */}
      {item.subtext && (
        <div
          style={{
            background: t.subtextBg,
            border: `1px solid ${t.subtextBorder}`,
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 0,
          }}
        >
          <div style={{ color: t.subtextColor, fontSize: 20, fontWeight: 500, lineHeight: 1.5, fontStyle: "italic" }}>
            {item.subtext}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${t.dividerColor}`,
        }}
      >
        <div style={{ color: t.footerColor, fontSize: 14, fontWeight: 700, opacity: 0.8, letterSpacing: "0.3px" }}>
          app.allaboutultrasound.com
        </div>
        <div style={{ color: t.footerRight, fontSize: 12 }}>
          Follow for daily ultrasound content
        </div>
      </div>
    </CardShell>
  );
}

// ── Downloadable wrapper ─────────────────────────────────────────────────────

interface CardHandle {
  exportPng: () => Promise<string>;
}

const PREVIEW_SIZE = 540;
const SCALE = PREVIEW_SIZE / 1080;

function DownloadableCard({
  filename,
  children,
  onRef,
}: {
  filename: string;
  children: React.ReactNode;
  onRef?: (handle: CardHandle) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const exportPng = useCallback(async (): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderCardToPng(ref.current);
  }, []);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      (ref as any).current = el;
      if (el && onRef) onRef({ exportPng });
    },
    [exportPng, onRef]
  );

  const handleDownload = useCallback(async () => {
    try {
      const dataUrl = await exportPng();
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.success("Downloaded!", { description: filename });
    } catch (err) {
      console.error("Card export failed:", err);
      toast.error("Export failed. Please try again.");
    }
  }, [exportPng, filename]);

  return (
    <div className="flex flex-col">
      <div
        style={{
          width: PREVIEW_SIZE,
          position: "relative",
          overflow: "hidden",
          borderRadius: "10px 10px 0 0",
          border: "1px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          background: "#071318",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1080,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={refCallback}>{children}</div>
        </div>
        {/* Reserve space for the scaled card */}
        <div style={{ paddingBottom: "100%" }} />
      </div>
      <Button
        onClick={handleDownload}
        size="sm"
        className="w-full gap-2 text-white font-semibold text-xs rounded-t-none"
        style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})`, borderRadius: "0 0 10px 10px" }}
      >
        <Download className="w-3 h-3" />
        Download PNG
      </Button>
    </div>
  );
}

// ── Social Post Panel ────────────────────────────────────────────────────────

function SocialPostPanel({ item }: { item: GeneratedItem }) {
  const [copied, setCopied] = useState(false);
  const post = buildFullSocialPost(item);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      toast.success("Copied!", { description: "Social post copied to clipboard." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = post;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2500);
    }
  }, [post]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BRAND}33`, background: "#0a1620" }}>
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${BRAND}22`, background: `${BRAND}0a` }}
      >
        <div className="flex items-center gap-1.5">
          <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND_AQUA }}>
            Social Post
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 gap-1 text-[10px] font-semibold text-white"
          style={{ background: copied ? "#166534" : `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
        >
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div
        className="px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap"
        style={{ color: "rgba(255,255,255,0.65)", maxHeight: 200, overflowY: "auto" }}
      >
        {post}
      </div>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type GeneratedItem = {
  headline: string;
  body: string;
  subtext: string;
  socialCaption: string;
  category: string;
  contentType: string;
};

// ── Main Page ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: "meme", label: "😂 Meme" },
  { value: "clinical_pearl", label: "💎 Clinical Pearl" },
  { value: "did_you_know", label: "🤔 Did You Know?" },
  { value: "motivational", label: "💪 Motivational" },
  { value: "myth_vs_fact", label: "⚡ Myth vs Fact" },
  { value: "tip_of_the_day", label: "💡 Tip of the Day" },
  { value: "anatomy_spotlight", label: "🔬 Anatomy Spotlight" },
  { value: "case_teaser", label: "🔍 Case Teaser" },
] as const;

const CATEGORIES = [
  "Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester",
  "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular",
  "MSK", "POCUS", "Physics", "Echocardiography", "General Ultrasound",
] as const;

export default function SocialContentGenerator() {
  const [contentType, setContentType] = useState<string>("meme");
  const [category, setCategory] = useState<string>("General Ultrasound");
  const [customTopic, setCustomTopic] = useState("");
  const [count, setCount] = useState(2);
  const [cardTheme, setCardTheme] = useState<CardTheme>("dark");
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const cardRefs = useRef<Record<number, CardHandle>>({});

  const generateMutation = trpc.socialContent.generateContent.useMutation({
    onSuccess: (data) => {
      setItems((prev) => [...data.items, ...prev]);
      toast.success(`Generated ${data.items.length} item${data.items.length > 1 ? "s" : ""}!`);
    },
    onError: (err) => {
      toast.error("Generation failed", { description: err.message });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      contentType: contentType as any,
      category: category as any,
      customTopic: customTopic.trim() || undefined,
      count,
    });
  };

  const handleBatchDownload = useCallback(async () => {
    if (items.length === 0) return;
    setBatchLoading(true);
    const zip = new JSZip();
    const folder = zip.folder("social-content-cards")!;
    try {
      await Promise.all(
        Object.entries(cardRefs.current).map(async ([idx, handle]) => {
          const dataUrl = await handle.exportPng();
          const base64 = dataUrl.split(",")[1];
          const item = items[Number(idx)];
          const name = `${item.contentType}-${item.category.replace(/[\s/]+/g, "-")}-${Number(idx) + 1}.png`;
          folder.file(name, base64, { base64: true });
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `ultrasoundassist-social-content-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success("ZIP downloaded!");
    } catch (err) {
      console.error("Batch export failed:", err);
      toast.error("Batch export failed.");
    } finally {
      setBatchLoading(false);
    }
  }, [items]);

  const t = cardTheme === "dark" ? DARK_THEME : LIGHT_THEME;

  return (
    <div className="min-h-screen" style={{ background: "#0a1018" }}>
      {/* Header */}
      <div style={{ background: "#0e1a24", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-2">
          <Link href="/platform-admin">
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/50" />
            </button>
          </Link>
          <Sparkles className="w-4 h-4" style={{ color: BRAND_AQUA }} />
          <h1 className="text-base font-bold text-white">Social Content Generator</h1>
          <Badge className="text-[10px] px-1.5 py-0 ml-0.5" style={{ background: BRAND + "22", color: BRAND_AQUA, border: "none" }}>
            Admin
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            {/* Dark / Light toggle */}
            <div
              className="flex items-center gap-1 rounded-lg p-0.5"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <button
                onClick={() => setCardTheme("dark")}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: cardTheme === "dark" ? `linear-gradient(90deg, ${BRAND}, ${BRAND_AQUA})` : "transparent",
                  color: cardTheme === "dark" ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                🌙 Dark
              </button>
              <button
                onClick={() => setCardTheme("light")}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: cardTheme === "light" ? `linear-gradient(90deg, ${BRAND}, ${BRAND_AQUA})` : "transparent",
                  color: cardTheme === "light" ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              >
                ☀️ Light
              </button>
            </div>
            {items.length > 0 && (
              <Button
                size="sm"
                onClick={handleBatchDownload}
                disabled={batchLoading}
                className="gap-1.5 text-white text-xs font-semibold"
                style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
              >
                {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                Download All
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        {/* Generator controls */}
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: "#0e1a24", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            {/* Content type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none"
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value} style={{ background: "#0e1a24" }}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} style={{ background: "#0e1a24" }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom topic */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Custom Topic (optional)</label>
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder="e.g. IVC collapsibility"
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/30"
              />
            </div>

            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Count</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n} style={{ background: "#0e1a24" }}>
                    {n} {n === 1 ? "item" : "items"}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="gap-2 text-white font-semibold"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_AQUA})`, height: 42 }}
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </div>

          {/* Quick topic buttons */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[
              "Liver scanning tips",
              "Carotid stenosis grading",
              "Fetal echo views",
              "POCUS eFAST",
              "Thyroid TI-RADS",
              "DVT compression technique",
              "Breast BI-RADS",
              "IVC assessment",
              "Gallbladder wall thickening",
              "Ovarian cyst characterization",
            ].map((topic) => (
              <button
                key={topic}
                onClick={() => setCustomTopic(topic)}
                className="px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                style={{
                  background: customTopic === topic ? `${BRAND}33` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${customTopic === topic ? BRAND : "rgba(255,255,255,0.08)"}`,
                  color: customTopic === topic ? BRAND_AQUA : "rgba(255,255,255,0.5)",
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Info bar */}
        <div
          className="rounded-lg p-3 mb-4 text-xs"
          style={{ background: BRAND + "14", border: `1px solid ${BRAND}2a` }}
        >
          <p className="text-white/60">
            Generate <strong className="text-white">ultrasound &amp; echocardiography</strong> social media content with AI.
            Each card is <strong className="text-white">1080×1080 px</strong> — ideal for Instagram, Facebook, and LinkedIn.
            Choose a content type, pick a category or enter a custom topic, then click <strong className="text-white">Generate</strong>.
            Download individual PNGs or use <strong className="text-white">Download All</strong> for a ZIP.
            Copy the ready-to-post caption with hashtags for each card.
          </p>
        </div>

        {/* Error */}
        {generateMutation.isError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{generateMutation.error.message}</span>
          </div>
        )}

        {/* Generated items */}
        {items.length === 0 && !generateMutation.isPending && (
          <div className="text-center py-16 text-white/30 text-sm">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No content generated yet. Select your options above and click Generate.</p>
          </div>
        )}

        {generateMutation.isPending && items.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: BRAND_AQUA }} />
          </div>
        )}

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={`${item.contentType}-${item.category}-${idx}`}
              className="rounded-lg border border-white/10 overflow-hidden"
              style={{ background: "#0e1a24" }}
            >
              {/* Item header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_AQUA, boxShadow: `0 0 6px ${BRAND_AQUA}` }} />
                  <span className="font-bold text-white text-sm">
                    {CONTENT_TYPE_ICONS[item.contentType]} {CONTENT_TYPE_LABELS[item.contentType]}
                  </span>
                  <Badge className="text-[10px] px-1.5 py-0" style={{ background: BRAND + "22", color: BRAND_AQUA, border: "none" }}>
                    {item.category}
                  </Badge>
                </div>
                <button
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-white/30 hover:text-red-400 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>

              {/* Card + social post side by side */}
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" style={{ color: BRAND_AQUA }} />
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Card Preview</span>
                  </div>
                  <DownloadableCard
                    filename={`${item.contentType}-${item.category.replace(/[\s/]+/g, "-")}-${idx + 1}.png`}
                    onRef={(h) => { cardRefs.current[idx] = h; }}
                  >
                    <ContentCard item={item} t={t} />
                  </DownloadableCard>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
                    <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Social Post</span>
                  </div>
                  <SocialPostPanel item={item} />

                  {/* Quick regenerate */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      generateMutation.mutate(
                        { contentType: item.contentType as any, category: item.category as any, count: 1 },
                        {
                          onSuccess: (data) => {
                            if (data.items[0]) {
                              setItems((prev) => prev.map((p, i) => (i === idx ? data.items[0] : p)));
                              toast.success("Regenerated!");
                            }
                          },
                        }
                      );
                    }}
                    disabled={generateMutation.isPending}
                    className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs mt-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate this one
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
