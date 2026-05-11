/*
 * SocialContentGenerator — Admin Only
 * AI-powered ultrasound & echocardiography social media content generator.
 * Produces branded 1080×1080 image cards in two layouts:
 *   1. "Card" — clean branded card with AAU teal/aqua styling
 *   2. "Infographic" — multi-section educational layout with structured panels
 * Both layouts support dark/light themes, PNG download, and ready-to-copy social posts.
 * Image options: None, Abstract AI background, or Upload custom clinical image.
 */
import { useRef, useCallback, useState, type ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  ArrowLeft, Download, Loader2,
  Sparkles, Package, Share2, Copy, Check, RefreshCw,
  Image as ImageLucide, Upload, LayoutGrid, CreditCard,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Brand palette ────────────────────────────────────────────────────────────
const BRAND = "#189aa1";
const BRAND_DARK = "#0d3d44";
const BRAND_AQUA = "#4ad9e0";
const LOGO_ICON =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_teal_f0c966ce.png";
const LOGO_RING =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";

// ── Theme tokens ─────────────────────────────────────────────────────────────
type CardTheme = "dark" | "light";
type LayoutMode = "card" | "infographic";
type ImageMode = "none" | "abstract" | "upload";

interface ThemeTokens {
  cardBg: string;
  overlayBg: string;
  accentBar: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  footerBg: string;
  footerColor: string;
  footerRight: string;
  dividerColor: string;
  subtextBg: string;
  subtextBorder: string;
  subtextColor: string;
  pillBg: string;
  pillBorder: string;
  pillColor: string;
  panelBg: string;
  panelBorder: string;
  sectionHeaderBg: string;
  sectionHeaderColor: string;
  taglineBg: string;
  taglineColor: string;
  isDark: boolean;
}

const DARK_THEME: ThemeTokens = {
  cardBg: "#0a1620",
  overlayBg: "linear-gradient(160deg, rgba(10,22,32,0.97) 0%, rgba(13,30,42,0.95) 50%, rgba(10,22,32,0.98) 100%)",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  headingColor: "#fff",
  bodyColor: "rgba(255,255,255,0.88)",
  mutedColor: "rgba(255,255,255,0.55)",
  footerBg: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}cc)`,
  footerColor: "#fff",
  footerRight: "rgba(255,255,255,0.5)",
  dividerColor: `${BRAND}55`,
  subtextBg: `linear-gradient(135deg, ${BRAND}15, rgba(255,255,255,0.03))`,
  subtextBorder: `${BRAND}44`,
  subtextColor: "rgba(255,255,255,0.70)",
  pillBg: `linear-gradient(135deg, ${BRAND}33, ${BRAND_AQUA}18)`,
  pillBorder: BRAND_AQUA,
  pillColor: BRAND_AQUA,
  panelBg: "rgba(255,255,255,0.04)",
  panelBorder: `${BRAND}33`,
  sectionHeaderBg: BRAND,
  sectionHeaderColor: "#fff",
  taglineBg: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}dd)`,
  taglineColor: "#fff",
  isDark: true,
};

const LIGHT_THEME: ThemeTokens = {
  cardBg: "#eaf6f7",
  overlayBg: "linear-gradient(160deg, rgba(234,246,247,0.98) 0%, rgba(220,242,244,0.95) 50%, rgba(234,246,247,0.98) 100%)",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  headingColor: BRAND_DARK,
  bodyColor: "#0d3d44",
  mutedColor: `${BRAND_DARK}bb`,
  footerBg: `linear-gradient(90deg, ${BRAND}, ${BRAND_AQUA})`,
  footerColor: "#fff",
  footerRight: "rgba(255,255,255,0.7)",
  dividerColor: `${BRAND}44`,
  subtextBg: `linear-gradient(135deg, ${BRAND}0e, rgba(74,217,224,0.06))`,
  subtextBorder: `${BRAND}44`,
  subtextColor: "#0d3d44",
  pillBg: `linear-gradient(135deg, ${BRAND}22, ${BRAND_AQUA}18)`,
  pillBorder: BRAND,
  pillColor: BRAND_DARK,
  panelBg: "rgba(255,255,255,0.7)",
  panelBorder: `${BRAND}44`,
  sectionHeaderBg: BRAND,
  sectionHeaderColor: "#fff",
  taglineBg: `linear-gradient(90deg, ${BRAND}, ${BRAND_AQUA})`,
  taglineColor: "#fff",
  isDark: false,
};

// ── Hashtags ─────────────────────────────────────────────────────────────────
const REQUIRED_HASHTAGS = [
  "#AllAboutUltrasound", "#UltrasoundAssist", "#Sonography",
  "#Ultrasound", "#MedicalImaging", "#Sonographer", "#UltrasoundEducation",
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
  meme: "😂", clinical_pearl: "💎", did_you_know: "🤔", motivational: "💪",
  myth_vs_fact: "⚡", tip_of_the_day: "💡", anatomy_spotlight: "🔬", case_teaser: "🔍",
};
const CONTENT_TYPE_LABELS: Record<string, string> = {
  meme: "Meme", clinical_pearl: "Clinical Pearl", did_you_know: "Did You Know?",
  motivational: "Motivational", myth_vs_fact: "Myth vs Fact", tip_of_the_day: "Tip of the Day",
  anatomy_spotlight: "Anatomy Spotlight", case_teaser: "Case Teaser",
};

// ── Render helpers ───────────────────────────────────────────────────────────
type GeneratedItem = {
  headline: string;
  body: string;
  subtext: string;
  socialCaption: string;
  category: string;
  contentType: string;
  imageUrl?: string;
  imageSource?: "abstract" | "upload";
};

function buildFullSocialPost(item: GeneratedItem): string {
  const catTags = CATEGORY_HASHTAGS[item.category] || [];
  const allHashtags = [...REQUIRED_HASHTAGS, ...catTags].join(" ");
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;
  return `${icon} ${label} — ${item.category}\n${item.socialCaption}\n🔗 app.allaboutultrasound.com\n${allHashtags}`;
}

async function renderCardToPng(el: HTMLElement): Promise<string> {
  const actualHeight = el.scrollHeight || 1080;
  return toPng(el, { cacheBust: true, pixelRatio: 1, width: 1080, height: actualHeight });
}

// ── Card Shell ───────────────────────────────────────────────────────────────
function CardShell({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  return (
    <div style={{ width: 1080, minHeight: 1080, position: "relative", fontFamily: "'Segoe UI', 'Open Sans', sans-serif", boxSizing: "border-box", background: t.cardBg }}>
      <div style={{ position: "absolute", inset: 0, background: t.overlayBg }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: t.accentBar }} />
      <div style={{ position: "relative", width: "100%", minHeight: 1080, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}

// ── Branded Header (shared by both layouts) ──────────────────────────────────
function BrandedHeader({ item, t }: { item: GeneratedItem; t: ThemeTokens }) {
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "36px 48px 24px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: `3px solid ${BRAND}88`, boxShadow: `0 0 20px ${BRAND}44`, flexShrink: 0 }}>
          <img src={LOGO_RING} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
        </div>
        <div>
          <div style={{ color: t.headingColor, fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            All About Ultrasound™
          </div>
          <div style={{ color: BRAND, fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: "1.2px", textTransform: "uppercase" }}>
            {item.category}
          </div>
        </div>
      </div>
      <div style={{ background: t.pillBg, border: `2px solid ${t.pillBorder}`, borderRadius: 28, padding: "8px 20px", color: t.pillColor, fontSize: 13, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" }}>
        {icon} {label}
      </div>
    </div>
  );
}

// ── Branded Footer (shared by both layouts) ──────────────────────────────────
function BrandedFooter({ t }: { t: ThemeTokens }) {
  return (
    <div style={{ marginTop: "auto" }}>
      {/* Tagline banner */}
      <div style={{ background: t.taglineBg, padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: t.taglineColor, fontWeight: 400, opacity: 0.7 }}>♡</span>
        <span style={{ fontSize: 16, color: t.taglineColor, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" }}>
          See It. Measure It. Make a Difference.
        </span>
        <span style={{ fontSize: 14, color: t.taglineColor, fontWeight: 400, opacity: 0.7 }}>♡</span>
      </div>
      {/* URL bar */}
      <div style={{ background: t.isDark ? "#060e14" : "#d0eced", padding: "10px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: BRAND, fontSize: 13, fontWeight: 700, letterSpacing: "0.3px" }}>
          app.allaboutultrasound.com
        </div>
        <div style={{ color: t.mutedColor, fontSize: 11 }}>
          Follow for daily ultrasound content
        </div>
      </div>
    </div>
  );
}

// ── Simple Card Layout ───────────────────────────────────────────────────────
function SimpleContentCard({ item, t }: { item: GeneratedItem; t: ThemeTokens }) {
  const hasImage = !!item.imageUrl;
  return (
    <CardShell t={t}>
      <BrandedHeader item={item} t={t} />
      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 48px", marginBottom: 24 }}>
        <div style={{ height: 3, width: 44, borderRadius: 2, background: `linear-gradient(90deg, ${BRAND_AQUA}, ${BRAND})` }} />
        <div style={{ height: 3, width: 10, borderRadius: 2, background: t.dividerColor }} />
        <div style={{ height: 3, width: 5, borderRadius: 2, background: t.dividerColor + "88" }} />
      </div>
      {/* Image area */}
      {hasImage && (
        <div style={{ margin: "0 48px 24px 48px", height: 360, borderRadius: 16, overflow: "hidden", border: `2px solid ${BRAND}44`, boxShadow: `0 4px 24px rgba(0,0,0,0.25)`, position: "relative" }}>
          <img src={item.imageUrl} alt={item.headline} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: t.isDark ? "linear-gradient(transparent, rgba(10,22,32,0.6))" : "linear-gradient(transparent, rgba(234,246,247,0.6))" }} />
        </div>
      )}
      {/* Content area */}
      <div style={{ padding: "0 48px", flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
        <div style={{ color: t.headingColor, fontSize: hasImage ? 42 : 50, fontWeight: 800, lineHeight: 1.2, marginBottom: hasImage ? 16 : 24, fontFamily: "'Georgia', 'Merriweather', serif" }}>
          {item.headline}
        </div>
        <div style={{ color: t.bodyColor, fontSize: hasImage ? 26 : 30, fontWeight: 400, lineHeight: 1.55, marginBottom: item.subtext ? 24 : 0, flex: "1 1 auto" }}>
          {item.body}
        </div>
        {item.subtext && (
          <div style={{ background: t.subtextBg, border: `1px solid ${t.subtextBorder}`, borderRadius: 12, padding: "14px 20px", marginBottom: 24 }}>
            <div style={{ color: t.subtextColor, fontSize: 19, fontWeight: 500, lineHeight: 1.5, fontStyle: "italic" }}>
              {item.subtext}
            </div>
          </div>
        )}
      </div>
      <BrandedFooter t={t} />
    </CardShell>
  );
}

// ── Infographic Layout ───────────────────────────────────────────────────────
function InfographicCard({ item, t }: { item: GeneratedItem; t: ThemeTokens }) {
  const hasImage = !!item.imageUrl;
  // Split body text into bullet points for the infographic
  const bodyLines = item.body.split(/[.!?]+/).filter((s) => s.trim().length > 5).slice(0, 5);
  const leftLines = bodyLines.slice(0, Math.ceil(bodyLines.length / 2));
  const rightLines = bodyLines.slice(Math.ceil(bodyLines.length / 2));

  return (
    <CardShell t={t}>
      {/* Large branded header */}
      <div style={{ padding: "36px 48px 0 48px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: `3px solid ${BRAND}88`, boxShadow: `0 0 24px ${BRAND}44`, flexShrink: 0 }}>
            <img src={LOGO_RING} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          </div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.mutedColor, letterSpacing: "3px", textTransform: "uppercase" }}>
            ALL ABOUT
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: BRAND, letterSpacing: "-1px", lineHeight: 1.1 }}>
            ULTRASOUND™
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.mutedColor, letterSpacing: "2px", marginTop: 4 }}>
            — on —
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>
      {/* Topic title */}
      <div style={{ textAlign: "center", padding: "8px 48px 24px 48px" }}>
        <div style={{ display: "inline-block", background: BRAND, padding: "10px 32px", borderRadius: 8 }}>
          <span style={{ color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
            {item.headline}
          </span>
        </div>
        <div style={{ color: t.mutedColor, fontSize: 13, fontWeight: 600, marginTop: 8, letterSpacing: "1px", textTransform: "uppercase" }}>
          {item.category}
        </div>
      </div>
      {/* Three-column content area */}
      <div style={{ display: "flex", gap: 16, padding: "0 32px", flex: "1 1 auto" }}>
        {/* Left panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: t.sectionHeaderBg, borderRadius: "8px 8px 0 0", padding: "8px 16px" }}>
            <span style={{ color: t.sectionHeaderColor, fontSize: 14, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" }}>
              Key Points
            </span>
          </div>
          <div style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}`, borderRadius: "0 0 8px 8px", padding: "16px", flex: 1 }}>
            {leftLines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${BRAND}22`, border: `2px solid ${BRAND}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: BRAND, fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
                </div>
                <span style={{ color: t.bodyColor, fontSize: 18, lineHeight: 1.45, fontWeight: 400 }}>
                  {line.trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* Center — image or highlight */}
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 12 }}>
          {hasImage ? (
            <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: `2px solid ${BRAND}44`, boxShadow: `0 4px 20px rgba(0,0,0,0.2)` }}>
              <img src={item.imageUrl} alt={item.headline} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
            </div>
          ) : (
            <div style={{ flex: 1, borderRadius: 12, background: `linear-gradient(135deg, ${BRAND}22, ${BRAND_AQUA}11)`, border: `2px solid ${BRAND}33`, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{CONTENT_TYPE_ICONS[item.contentType] || "📸"}</div>
                <div style={{ color: t.headingColor, fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
                  {item.headline}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: t.sectionHeaderBg, borderRadius: "8px 8px 0 0", padding: "8px 16px" }}>
            <span style={{ color: t.sectionHeaderColor, fontSize: 14, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" }}>
              {item.contentType === "myth_vs_fact" ? "The Facts" : "Remember"}
            </span>
          </div>
          <div style={{ background: t.panelBg, border: `1px solid ${t.panelBorder}`, borderRadius: "0 0 8px 8px", padding: "16px", flex: 1 }}>
            {rightLines.length > 0 ? rightLines.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${BRAND}22`, border: `2px solid ${BRAND}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: BRAND, fontSize: 14 }}>✓</span>
                </div>
                <span style={{ color: t.bodyColor, fontSize: 18, lineHeight: 1.45, fontWeight: 400 }}>
                  {line.trim()}
                </span>
              </div>
            )) : (
              <div style={{ color: t.bodyColor, fontSize: 18, lineHeight: 1.5 }}>
                {item.body}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Subtext / source */}
      {item.subtext && (
        <div style={{ margin: "16px 32px 0 32px", display: "flex", gap: 16 }}>
          <div style={{ flex: 1, background: t.panelBg, border: `1px solid ${t.panelBorder}`, borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${BRAND}22`, border: `2px solid ${BRAND}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>📋</span>
            </div>
            <span style={{ color: t.subtextColor, fontSize: 16, fontWeight: 500, lineHeight: 1.4, fontStyle: "italic" }}>
              {item.subtext}
            </span>
          </div>
        </div>
      )}
      {/* Spacer */}
      <div style={{ height: 16 }} />
      <BrandedFooter t={t} />
    </CardShell>
  );
}

// ── Downloadable wrapper ─────────────────────────────────────────────────────
interface CardHandle { exportPng: () => Promise<string>; }
const PREVIEW_SIZE = 540;
const SCALE = PREVIEW_SIZE / 1080;

function DownloadableCard({ filename, children, onRef }: { filename: string; children: React.ReactNode; onRef?: (handle: CardHandle) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const exportPng = useCallback(async (): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderCardToPng(ref.current);
  }, []);
  const refCallback = useCallback((el: HTMLDivElement | null) => {
    (ref as any).current = el;
    if (el && onRef) onRef({ exportPng });
  }, [exportPng, onRef]);
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
      <div style={{ width: PREVIEW_SIZE, position: "relative", overflow: "hidden", borderRadius: "10px 10px 0 0", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none", background: "#0a1620", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: 1080, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          <div ref={refCallback}>{children}</div>
        </div>
        <div style={{ paddingBottom: "100%" }} />
      </div>
      <Button onClick={handleDownload} size="sm" className="w-full gap-2 text-white font-semibold text-xs rounded-t-none" style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})`, borderRadius: "0 0 10px 10px" }}>
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
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${BRAND}22`, background: `${BRAND}0a` }}>
        <div className="flex items-center gap-1.5">
          <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND_AQUA }}>Social Post</span>
        </div>
        <Button size="sm" onClick={handleCopy} className="h-6 px-2 gap-1 text-[10px] font-semibold text-white" style={{ background: copied ? "#166534" : `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}>
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.65)", maxHeight: 200, overflowY: "auto" }}>
        {post}
      </div>
    </div>
  );
}

// ── Image Upload Helper ──────────────────────────────────────────────────────
function ImageUploadButton({ onUploaded, disabled }: { onUploaded: (url: string) => void; disabled?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-social-image", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await res.json();
      onUploaded(url);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onUploaded]);

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <Button
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
    </>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────
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
const IMAGE_STYLE_HINTS = [
  "Teal waveform pattern",
  "Geometric mesh",
  "Gradient bokeh",
  "Pulse wave lines",
  "Abstract sound waves",
  "Flowing teal streams",
];

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SocialContentGenerator() {
  const [contentType, setContentType] = useState<string>("meme");
  const [category, setCategory] = useState<string>("General Ultrasound");
  const [customTopic, setCustomTopic] = useState("");
  const [count, setCount] = useState(2);
  const [cardTheme, setCardTheme] = useState<CardTheme>("light");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("card");
  const [imageMode, setImageMode] = useState<ImageMode>("none");
  const [imageStyleHint, setImageStyleHint] = useState("");
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [regeneratingImageIdx, setRegeneratingImageIdx] = useState<number | null>(null);
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

  const generateAbstractMutation = trpc.socialContent.generateAbstractImage.useMutation();

  const handleGenerate = () => {
    generateMutation.mutate({
      contentType: contentType as any,
      category: category as any,
      customTopic: customTopic.trim() || undefined,
      count,
      imageMode,
      imageStyleHint: imageMode === "abstract" ? (imageStyleHint.trim() || undefined) : undefined,
    });
  };

  const handleRegenerateAbstract = useCallback(async (idx: number, item: GeneratedItem, styleHint?: string) => {
    setRegeneratingImageIdx(idx);
    try {
      const result = await generateAbstractMutation.mutateAsync({
        headline: item.headline,
        category: item.category,
        contentType: item.contentType,
        styleHint: styleHint?.trim() || undefined,
      });
      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: result.imageUrl, imageSource: "abstract" as const } : p)));
      toast.success("Abstract background regenerated!");
    } catch (err: any) {
      toast.error("Image generation failed", { description: err.message });
    } finally {
      setRegeneratingImageIdx(null);
    }
  }, [generateAbstractMutation]);

  const handleUploadedImage = useCallback((idx: number, url: string) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: url, imageSource: "upload" as const } : p)));
  }, []);

  const handleRemoveImage = useCallback((idx: number) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: undefined, imageSource: undefined } : p)));
    toast.success("Image removed from card");
  }, []);

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
          <Badge className="text-[10px] px-1.5 py-0 ml-0.5" style={{ background: BRAND + "22", color: BRAND_AQUA, border: "none" }}>Admin</Badge>
          <div className="ml-auto flex items-center gap-2">
            {/* Layout toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BRAND}44` }}>
              <button
                onClick={() => setLayoutMode("card")}
                className="px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                style={{ background: layoutMode === "card" ? BRAND : "transparent", color: layoutMode === "card" ? "#fff" : "rgba(255,255,255,0.5)" }}
              >
                <CreditCard className="w-3 h-3" /> Card
              </button>
              <button
                onClick={() => setLayoutMode("infographic")}
                className="px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                style={{ background: layoutMode === "infographic" ? BRAND : "transparent", color: layoutMode === "infographic" ? "#fff" : "rgba(255,255,255,0.5)" }}
              >
                <LayoutGrid className="w-3 h-3" /> Infographic
              </button>
            </div>
            {/* Theme toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BRAND}44` }}>
              <button
                onClick={() => setCardTheme("dark")}
                className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ background: cardTheme === "dark" ? BRAND_DARK : "transparent", color: cardTheme === "dark" ? BRAND_AQUA : "rgba(255,255,255,0.4)" }}
              >
                Dark
              </button>
              <button
                onClick={() => setCardTheme("light")}
                className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ background: cardTheme === "light" ? "#e8f7f8" : "transparent", color: cardTheme === "light" ? BRAND_DARK : "rgba(255,255,255,0.4)" }}
              >
                Light
              </button>
            </div>
            {items.length > 1 && (
              <Button onClick={handleBatchDownload} disabled={batchLoading} size="sm" className="gap-1.5 text-xs text-white" style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}>
                {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                Download All ({items.length})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="rounded-xl p-4" style={{ background: "#0e1a24", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex flex-wrap items-end gap-3">
            {/* Content Type */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Content Type</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none">
                {CONTENT_TYPES.map((ct) => (<option key={ct.value} value={ct.value} style={{ background: "#0e1a24" }}>{ct.label}</option>))}
              </select>
            </div>
            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none">
                {CATEGORIES.map((c) => (<option key={c} value={c} style={{ background: "#0e1a24" }}>{c}</option>))}
              </select>
            </div>
            {/* Custom Topic */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Custom Topic (optional)</label>
              <input type="text" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="e.g., Aortic stenosis scanning tips" className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/25" />
            </div>
            {/* Count */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Count</label>
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none">
                {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n} style={{ background: "#0e1a24" }}>{n} {n === 1 ? "item" : "items"}</option>))}
              </select>
            </div>
            {/* Generate */}
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2 text-white font-semibold" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_AQUA})`, height: 42 }}>
              {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </div>

          {/* Image mode selector */}
          <div className="mt-3 rounded-lg p-3" style={{ background: imageMode !== "none" ? `${BRAND}12` : "rgba(255,255,255,0.02)", border: `1px solid ${imageMode !== "none" ? BRAND + "44" : "rgba(255,255,255,0.06)"}`, transition: "all 0.2s ease" }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider mr-2">Image:</span>
              {(["none", "abstract", "upload"] as ImageMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setImageMode(mode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  style={{
                    background: imageMode === mode ? `${BRAND}33` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${imageMode === mode ? BRAND : "rgba(255,255,255,0.08)"}`,
                    color: imageMode === mode ? BRAND_AQUA : "rgba(255,255,255,0.4)",
                  }}
                >
                  {mode === "none" && <><X className="w-3 h-3" /> None</>}
                  {mode === "abstract" && <><Sparkles className="w-3 h-3" /> Abstract AI</>}
                  {mode === "upload" && <><Upload className="w-3 h-3" /> Upload After</>}
                </button>
              ))}
              {imageMode === "abstract" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ background: `${BRAND}22`, color: BRAND_AQUA }}>
                  5-20s per image
                </span>
              )}
              {imageMode === "upload" && (
                <span className="text-[10px] text-white/40 ml-1">
                  Upload your own clinical images after generating
                </span>
              )}
            </div>
            {/* Abstract style hint */}
            {imageMode === "abstract" && (
              <div className="flex flex-col gap-2 mt-2">
                <input type="text" value={imageStyleHint} onChange={(e) => setImageStyleHint(e.target.value)} placeholder="Style hint (optional) — e.g., teal waveform pattern, geometric mesh" className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/25" />
                <div className="flex flex-wrap gap-1.5">
                  {IMAGE_STYLE_HINTS.map((hint) => (
                    <button key={hint} onClick={() => setImageStyleHint(hint)} className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors" style={{ background: imageStyleHint === hint ? `${BRAND}33` : "rgba(255,255,255,0.04)", border: `1px solid ${imageStyleHint === hint ? BRAND : "rgba(255,255,255,0.06)"}`, color: imageStyleHint === hint ? BRAND_AQUA : "rgba(255,255,255,0.4)" }}>
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 && !generateMutation.isPending && (
        <div className="max-w-screen-2xl mx-auto px-6 py-20 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND}15`, border: `1px solid ${BRAND}33` }}>
            <Sparkles className="w-7 h-7" style={{ color: BRAND_AQUA }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white/80">Generate Social Content</h2>
            <p className="text-sm text-white/40 mt-1 max-w-md">
              Choose a content type, category, and count above, then click Generate to create branded social media cards.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {generateMutation.isPending && (
        <div className="max-w-screen-2xl mx-auto px-6 py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_AQUA }} />
          <p className="text-sm text-white/50">Generating content{imageMode === "abstract" ? " with abstract backgrounds" : ""}...</p>
        </div>
      )}

      {/* Cards grid */}
      {items.length > 0 && (
        <div className="max-w-screen-2xl mx-auto px-6 pb-12">
          <div className="flex flex-col gap-8">
            {items.map((item, idx) => (
              <div key={`${item.headline}-${idx}`} className="flex gap-6 items-start">
                {/* Card preview */}
                <DownloadableCard
                  filename={`${item.contentType}-${item.category.replace(/[\s/]+/g, "-")}-${idx + 1}.png`}
                  onRef={(handle) => { cardRefs.current[idx] = handle; }}
                >
                  {layoutMode === "infographic" ? (
                    <InfographicCard item={item} t={t} />
                  ) : (
                    <SimpleContentCard item={item} t={t} />
                  )}
                </DownloadableCard>
                {/* Actions panel */}
                <div className="flex-1 min-w-[280px] max-w-md flex flex-col gap-3">
                  {/* Social post */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
                      <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Social Post</span>
                    </div>
                    <SocialPostPanel item={item} />
                  </div>
                  {/* Image controls */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center gap-1.5">
                      <ImageLucide className="w-3 h-3" style={{ color: BRAND_AQUA }} />
                      <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Image</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.imageUrl ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleRegenerateAbstract(idx, item)} disabled={regeneratingImageIdx === idx} className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs">
                            {regeneratingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            New Abstract
                          </Button>
                          <ImageUploadButton onUploaded={(url) => handleUploadedImage(idx, url)} disabled={regeneratingImageIdx === idx} />
                          <Button size="sm" variant="outline" onClick={() => handleRemoveImage(idx)} className="gap-1.5 text-red-400/70 border-red-400/20 hover:bg-red-400/10 text-xs">
                            <X className="w-3 h-3" /> Remove
                          </Button>
                          <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" download>
                            <Button size="sm" variant="outline" className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs">
                              <Download className="w-3 h-3" /> Image Only
                            </Button>
                          </a>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleRegenerateAbstract(idx, item)} disabled={regeneratingImageIdx === idx} className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs">
                            {regeneratingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Add Abstract
                          </Button>
                          <ImageUploadButton onUploaded={(url) => handleUploadedImage(idx, url)} disabled={regeneratingImageIdx === idx} />
                        </>
                      )}
                    </div>
                  </div>
                  {/* Quick regenerate */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      generateMutation.mutate(
                        { contentType: item.contentType as any, category: item.category as any, count: 1, imageMode: item.imageUrl ? "abstract" : "none" },
                        { onSuccess: (data) => { if (data.items[0]) { setItems((prev) => prev.map((p, i) => (i === idx ? data.items[0] : p))); toast.success("Regenerated!"); } } }
                      );
                    }}
                    disabled={generateMutation.isPending}
                    className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs mt-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate Everything
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
