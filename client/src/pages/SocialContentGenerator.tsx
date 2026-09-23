/*
 * SocialContentGenerator — Admin Only
 * AI-powered ultrasound & echocardiography social media content generator.
 * Produces branded 1080×1080 image cards in two layouts:
 *   1. "Card" — clean branded card with AAU teal/aqua styling
 *   2. "Infographic" — multi-section educational layout with structured panels
 * Both layouts support dark/light themes, PNG download, and ready-to-copy social posts.
 * Image options: None, Abstract AI background, or Upload custom clinical image.
 */
import { useRef, useCallback, useEffect, useState, useMemo, type ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  ArrowLeft, Download, Loader2,
  Sparkles, Package, Share2, Copy, Check, RefreshCw,
  Image as ImageLucide, Upload, LayoutGrid, CreditCard,
  X, LibraryBig, Flag, Trash2, CheckCircle2, Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getBrandToolPresentation, resolveToolBrand, STANDARD_SOCIAL_HASHTAGS, type BrandToolPresentation } from "@/lib/brandToolPresentation";
import { perBrandAdminUrl } from "@/lib/perBrandUrls";
import { uploadFileToMediaRepository } from "@/lib/mediaRepoUpload";
import {
  DEFAULT_SOCIAL_EXPORT_PLATFORM,
  exportSocialCard,
  renderSocialCard,
  SocialExportControls,
  type CardMotion,
  type SocialExportFormat,
  type SocialMusicOption,
  type SocialExportPlatform,
} from "@/components/social/SocialCardExport";
import { getSocialExportPreset } from "@/lib/socialCardExportPresets";
import { SocialCardFrameProvider, useSocialCardFrame } from "@/components/social/SocialCardFrame";

// ── Brand palette ────────────────────────────────────────────────────────────
const BRAND = "#189aa1";
const BRAND_DARK = "#0d3d44";
const BRAND_AQUA = "#4ad9e0";

// ── Theme tokens ─────────────────────────────────────────────────────────────
type CardTheme = "dark" | "light" | "white" | "teal" | "aqua";
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

const WHITE_THEME: ThemeTokens = {
  ...LIGHT_THEME,
  cardBg: "#ffffff",
  overlayBg: "linear-gradient(160deg, #ffffff 0%, #f4fbfb 55%, #ffffff 100%)",
  panelBg: "rgba(255,255,255,0.92)",
  footerBg: "#057e87",
  taglineBg: "#0d3d44",
};

const AQUA_THEME: ThemeTokens = {
  ...LIGHT_THEME,
  cardBg: "#bdeff1",
  overlayBg: "linear-gradient(160deg, #dff9fa 0%, #bdeff1 54%, #a8e4e7 100%)",
  panelBg: "rgba(255,255,255,0.64)",
  footerBg: "#0d7580",
  taglineBg: "#057e87",
};

const TEAL_THEME: ThemeTokens = {
  ...DARK_THEME,
  cardBg: "#087e86",
  overlayBg: "linear-gradient(160deg, #0c9ba2 0%, #087e86 55%, #05535b 100%)",
  headingColor: "#ffffff",
  bodyColor: "rgba(255,255,255,0.94)",
  mutedColor: "rgba(255,255,255,0.72)",
  panelBg: "rgba(0, 60, 67, 0.26)",
  panelBorder: "rgba(255,255,255,0.42)",
  sectionHeaderBg: "#ffffff",
  sectionHeaderColor: "#057e87",
  footerBg: "#064d55",
  taglineBg: "#ffffff",
  taglineColor: "#057e87",
  isDark: true,
};

const CARD_THEMES: Record<CardTheme, ThemeTokens> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
  white: WHITE_THEME,
  aqua: AQUA_THEME,
  teal: TEAL_THEME,
};

// ── Hashtags ─────────────────────────────────────────────────────────────────
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
  imageSource?: "ai" | "upload" | "media_repository";
  libraryId?: number;
  librarySaved?: boolean;
  librarySaveError?: boolean;
  mediaAssetId?: number | null;
};

function buildFullSocialPost(item: GeneratedItem, presentation: BrandToolPresentation): string {
  const catTags = CATEGORY_HASHTAGS[item.category] || [];
  const allHashtags = [...new Set([...STANDARD_SOCIAL_HASHTAGS, ...catTags])].join(" ");
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;
  return `${icon} ${label} — ${item.category}\n${item.socialCaption}\n🔗 ${presentation.publicHost}\n${allHashtags}`;
}

async function renderCardToPng(el: HTMLElement): Promise<string> {
  const actualWidth = el.clientWidth || el.scrollWidth || 1080;
  const actualHeight = el.clientHeight || el.scrollHeight || 1080;
  return toPng(el, { cacheBust: true, pixelRatio: 1, width: actualWidth, height: actualHeight });
}

// ── Card Shell ───────────────────────────────────────────────────────────────
function CardShell({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  const frame = useSocialCardFrame();
  return (
    <div style={{ width: frame.width, height: frame.height, minHeight: frame.height, position: "relative", overflow: "hidden", fontFamily: "'Segoe UI', 'Open Sans', sans-serif", boxSizing: "border-box", background: t.cardBg }}>
      <div style={{ position: "absolute", inset: 0, background: t.overlayBg }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: t.accentBar }} />
      <div style={{ position: "relative", width: "100%", minHeight: "100%", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}

// ── Branded Header (shared by both layouts) ──────────────────────────────────
function BrandedHeader({ item, t, presentation }: { item: GeneratedItem; t: ThemeTokens; presentation: BrandToolPresentation }) {
  const frame = useSocialCardFrame();
  const px = (value: number) => Math.max(1, Math.round(value * frame.contentScale));
  const icon = CONTENT_TYPE_ICONS[item.contentType] || "📸";
  const label = CONTENT_TYPE_LABELS[item.contentType] || item.contentType;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${px(36)}px ${px(48)}px ${px(24)}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: px(16) }}>
        <div style={{ width: px(64), height: px(64), borderRadius: "50%", overflow: "hidden", border: `${px(3)}px solid ${BRAND}88`, boxShadow: `0 0 ${px(20)}px ${BRAND}44`, flexShrink: 0 }}>
          <img src={presentation.logoUrl} alt={presentation.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
        </div>
        <div>
          <div style={{ color: t.headingColor, fontSize: px(26), fontWeight: 800, letterSpacing: `${-px(0.5)}px`, lineHeight: 1.1 }}>
            {presentation.displayName}
          </div>
          <div style={{ color: BRAND, fontSize: px(13), fontWeight: 700, marginTop: px(4), letterSpacing: `${px(1.2)}px`, textTransform: "uppercase" }}>
            {item.category}
          </div>
        </div>
      </div>
      <div style={{ background: t.pillBg, border: `${px(2)}px solid ${t.pillBorder}`, borderRadius: px(28), padding: `${px(8)}px ${px(20)}px`, color: t.pillColor, fontSize: px(13), fontWeight: 800, letterSpacing: `${px(1.5)}px`, textTransform: "uppercase" }}>
        {icon} {label}
      </div>
    </div>
  );
}

// ── Branded Footer (shared by both layouts) ──────────────────────────────────
function BrandedFooter({ t, presentation }: { t: ThemeTokens; presentation: BrandToolPresentation }) {
  const frame = useSocialCardFrame();
  const px = (value: number) => Math.max(1, Math.round(value * frame.contentScale));
  return (
    <div style={{ marginTop: "auto" }}>
      {/* Tagline banner */}
      <div style={{ background: t.taglineBg, padding: `${px(16)}px ${px(48)}px`, display: "flex", alignItems: "center", justifyContent: "center", gap: px(12) }}>
        <span style={{ fontSize: px(14), color: t.taglineColor, fontWeight: 400, opacity: 0.7 }}>♡</span>
        <span style={{ fontSize: px(16), color: t.taglineColor, fontWeight: 800, letterSpacing: `${px(2)}px`, textTransform: "uppercase" }}>
          See It. Measure It. Make a Difference.
        </span>
        <span style={{ fontSize: px(14), color: t.taglineColor, fontWeight: 400, opacity: 0.7 }}>♡</span>
      </div>
      {/* URL bar */}
      <div style={{ background: t.isDark ? "#060e14" : "#d0eced", padding: `${px(10)}px ${px(48)}px`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: BRAND, fontSize: px(13), fontWeight: 700, letterSpacing: `${px(0.3)}px` }}>
          {presentation.publicHost}
        </div>
        <div style={{ color: t.mutedColor, fontSize: px(11) }}>
          Follow for daily {presentation.brand === "iheartecho" ? "echocardiography" : "ultrasound"} content
        </div>
      </div>
    </div>
  );
}

// ── Simple Card Layout ───────────────────────────────────────────────────────
function SimpleContentCard({ item, t, presentation }: { item: GeneratedItem; t: ThemeTokens; presentation: BrandToolPresentation }) {
  const frame = useSocialCardFrame();
  const px = (value: number) => Math.max(1, Math.round(value * frame.contentScale));
  const hasImage = !!item.imageUrl;
  const imageHeight = frame.layout === "wide" ? px(150) : frame.layout === "landscape" ? px(245) : frame.layout === "vertical" ? px(430) : px(360);
return (
<CardShell t={t}>
      <BrandedHeader item={item} t={t} presentation={presentation} />
      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 48px", marginBottom: 24 }}>
        <div style={{ height: 3, width: 44, borderRadius: 2, background: `linear-gradient(90deg, ${BRAND_AQUA}, ${BRAND})` }} />
        <div style={{ height: 3, width: 10, borderRadius: 2, background: t.dividerColor }} />
        <div style={{ height: 3, width: 5, borderRadius: 2, background: t.dividerColor + "88" }} />
      </div>
      {/* Image area */}
      {hasImage && (
        <div style={{ margin: `0 ${px(48)}px ${px(24)}px`, height: imageHeight, borderRadius: px(16), overflow: "hidden", border: `${px(2)}px solid ${BRAND}44`, boxShadow: `0 ${px(4)}px ${px(24)}px rgba(0,0,0,0.25)`, position: "relative" }}>
          <img src={item.imageUrl} alt={item.headline} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: px(60), background: t.isDark ? "linear-gradient(transparent, rgba(10,22,32,0.6))" : "linear-gradient(transparent, rgba(234,246,247,0.6))" }} />
        </div>
      )}
      {/* Content area */}
      <div style={{ padding: `0 ${px(48)}px`, flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ color: t.headingColor, fontSize: px(hasImage ? 42 : 50), fontWeight: 800, lineHeight: 1.2, marginBottom: px(hasImage ? 16 : 24), fontFamily: "'Georgia', 'Merriweather', serif" }}>
          {item.headline}
        </div>
        <div style={{ color: t.bodyColor, fontSize: px(hasImage ? 26 : 30), fontWeight: 400, lineHeight: 1.55, marginBottom: px(item.subtext ? 24 : 0), flex: "1 1 auto", overflow: "hidden" }}>
          {item.body}
        </div>
        {item.subtext && (
          <div style={{ background: t.subtextBg, border: `${px(1)}px solid ${t.subtextBorder}`, borderRadius: px(12), padding: `${px(14)}px ${px(20)}px`, marginBottom: px(24) }}>
            <div style={{ color: t.subtextColor, fontSize: px(19), fontWeight: 500, lineHeight: 1.5, fontStyle: "italic" }}>
              {item.subtext}
            </div>
          </div>
        )}
      </div>
      <BrandedFooter t={t} presentation={presentation} />
    </CardShell>
  );
}

// ── Infographic Layout ───────────────────────────────────────────────────────
function InfographicCard({ item, t, presentation }: { item: GeneratedItem; t: ThemeTokens; presentation: BrandToolPresentation }) {
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
            <img src={presentation.logoUrl} alt={presentation.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          </div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.mutedColor, letterSpacing: "3px", textTransform: "uppercase" }}>
            {presentation.shortName.toUpperCase()}
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: BRAND, letterSpacing: "-1px", lineHeight: 1.1 }}>
            {presentation.brand === "iheartecho" ? "ECHOCARDIOGRAPHY" : "ULTRASOUND™"}
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
      <BrandedFooter t={t} presentation={presentation} />
    </CardShell>
  );
}

// ── Downloadable wrapper ─────────────────────────────────────────────────────
interface CardHandle {
  exportPng: () => Promise<string>;
  exportPlatform: (platform: SocialExportPlatform, format: SocialExportFormat, motion: CardMotion) => Promise<string>;
  renderPlatform: (platform: SocialExportPlatform, format: SocialExportFormat, motion: CardMotion) => Promise<Blob>;
}
const PREVIEW_SIZE = 560;

function DownloadableCard({
  filename,
  children,
  onRef,
  platform,
  format,
  motion,
}: {
  filename: string;
  children: React.ReactNode;
  onRef?: (handle: CardHandle) => void;
  platform: SocialExportPlatform;
  format: SocialExportFormat;
  motion: CardMotion;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previewPreset = useMemo(() => getSocialExportPreset(platform), [platform]);
  const previewScale = Math.min(PREVIEW_SIZE / previewPreset.width, 760 / previewPreset.height);
  const previewWidth = Math.round(previewPreset.width * previewScale);
  const previewHeight = Math.round(previewPreset.height * previewScale);
  const exportPng = useCallback(async (): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderCardToPng(ref.current);
  }, []);
  const exportPlatform = useCallback(async (
    nextPlatform: SocialExportPlatform,
    nextFormat: SocialExportFormat,
    nextMotion: CardMotion,
  ): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return exportSocialCard({ cardElement: ref.current, platform: nextPlatform, format: nextFormat, filenameStem: filename, motion: nextMotion });
  }, [filename]);
  const renderPlatform = useCallback(async (
    nextPlatform: SocialExportPlatform,
    nextFormat: SocialExportFormat,
    nextMotion: CardMotion,
  ): Promise<Blob> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderSocialCard({ cardElement: ref.current, platform: nextPlatform, format: nextFormat, motion: nextMotion });
  }, []);
  const refCallback = useCallback((el: HTMLDivElement | null) => {
    (ref as any).current = el;
    if (el && onRef) onRef({ exportPng, exportPlatform, renderPlatform });
  }, [exportPlatform, exportPng, onRef, renderPlatform]);
  const handleDownload = useCallback(async () => {
    try {
      const savedFile = await exportPlatform(platform, format, motion);
      toast.success("Downloaded!", { description: savedFile });
    } catch (err) {
      console.error("Card export failed:", err);
      toast.error(err instanceof Error ? err.message : "Export failed. Please try again.");
    }
  }, [exportPlatform, format, motion, platform]);
  return (
    <div className="flex flex-col">
      <div style={{ width: previewWidth, height: previewHeight, position: "relative", overflow: "hidden", borderRadius: "10px 10px 0 0", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none", background: "#0a1620", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: previewPreset.width, height: previewPreset.height, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
          <div ref={refCallback} style={{ width: previewPreset.width, height: previewPreset.height }}><SocialCardFrameProvider platform={platform}>{children}</SocialCardFrameProvider></div>
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/75">{previewPreset.label} · {previewPreset.width}×{previewPreset.height}</div>
      </div>
      <Button onClick={handleDownload} size="sm" className="w-full gap-2 text-white font-semibold text-xs rounded-t-none" style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})`, borderRadius: "0 0 10px 10px" }}>
        <Download className="w-3 h-3" />
        Download {format.toUpperCase()}
      </Button>
    </div>
  );
}

// ── Social Post Panel ────────────────────────────────────────────────────────
function SocialPostPanel({ item, presentation }: { item: GeneratedItem; presentation: BrandToolPresentation }) {
  const [copied, setCopied] = useState(false);
  const post = buildFullSocialPost(item, presentation);
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
function ImageUploadButton({ onUploaded, disabled, brand }: { onUploaded: (uploaded: { url: string; assetId: number }) => void; disabled?: boolean; brand: "aaus" | "iheartecho" }) {
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
      const uploaded = await uploadFileToMediaRepository(file, {
        access: "private",
        folder: "social-post-library",
        brand,
      });
      onUploaded({ url: uploaded.s3Url, assetId: uploaded.assetId });
      toast.success("Image uploaded to Media Repository and selected.");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [brand, onUploaded]);

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
const AAUS_CATEGORIES = [
  "Abdominal", "Small Parts", "Pelvic/Gyn", "OB 1st Trimester",
  "OB 2nd/3rd Trimester", "Fetal Echo", "Breast", "Vascular",
  "MSK", "POCUS", "Physics", "General Ultrasound",
] as const;
const IHE_CATEGORIES = [
  "Transthoracic Echo", "Transesophageal Echo", "Intracardiac Echo",
  "Pediatric/Congenital Echo", "Fetal Echo",
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
  const [location] = useLocation();
  const presentation = useMemo(
    () => getBrandToolPresentation(resolveToolBrand(location, window.location.hostname)),
    [location],
  );
  const brandCategories = useMemo(
    () => presentation.brand === "iheartecho" ? IHE_CATEGORIES : AAUS_CATEGORIES,
    [presentation.brand],
  );
  const [contentType, setContentType] = useState<string>("meme");
  const [category, setCategory] = useState<string>("General Ultrasound");
  const [customTopic, setCustomTopic] = useState("");
  const [count, setCount] = useState(2);
  const [cardTheme, setCardTheme] = useState<CardTheme>("light");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("card");
  const [imageMode, setImageMode] = useState<ImageMode>("none");
  const [exportPlatform, setExportPlatform] = useState<SocialExportPlatform>(DEFAULT_SOCIAL_EXPORT_PLATFORM);
  const [exportFormat, setExportFormat] = useState<SocialExportFormat>("png");
  const [mp4Sequence, setMp4Sequence] = useState<"social" | "combined">("social");
  const [selectedMusic, setSelectedMusic] = useState<SocialMusicOption | null>(null);
  const [imageStyleHint, setImageStyleHint] = useState("");
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [flagComments, setFlagComments] = useState<Record<number, string>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [savedLibraryBatchLoading, setSavedLibraryBatchLoading] = useState(false);
  const [selectedSavedPostIds, setSelectedSavedPostIds] = useState<number[]>([]);
  const [regeneratingImageIdx, setRegeneratingImageIdx] = useState<number | null>(null);
  const [perCardImagePrompts, setPerCardImagePrompts] = useState<Record<number, string>>({});
  const cardRefs = useRef<Record<number, CardHandle>>({});
  const savedPostRefs = useRef<Record<number, CardHandle>>({});
  const utils = trpc.useUtils();
  const mediaAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, mediaType: "image", page: 1, pageSize: 12 });
  const musicAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, mediaType: "audio", page: 1, pageSize: 50 });
  const savedPosts = trpc.socialContent.listSavedPosts.useQuery({ brand: presentation.brand, limit: 100 });

  useEffect(() => {
    setCategory((current) => brandCategories.includes(current as never) ? current : brandCategories[0]);
  }, [brandCategories]);
  const musicOptions = useMemo<SocialMusicOption[]>(() => (musicAssets.data?.assets ?? [])
    .map((asset: any) => ({ id: `media:${asset.id}`, title: asset.title, url: asset.currentVersion?.s3Url, source: "media_repository" as const }))
    .filter((asset: SocialMusicOption) => Boolean(asset.url)), [musicAssets.data?.assets]);

  const generateMutation = trpc.socialContent.generateContent.useMutation({
    onSuccess: (data) => {
      setItems((prev) => [...data.items, ...prev]);
      void utils.socialContent.listSavedPosts.invalidate();
      const unsavedCount = data.items.filter((item: GeneratedItem) => item.librarySaveError).length;
      if (unsavedCount > 0) {
        toast.warning(`Generated ${data.items.length} item${data.items.length > 1 ? "s" : ""}.`, {
          description: `${unsavedCount} item${unsavedCount > 1 ? "s could" : " could"} not be saved to the shared Post Library. You can still download the generated card.`,
        });
      } else {
        toast.success(`Generated ${data.items.length} item${data.items.length > 1 ? "s" : ""} and saved them to the Post Library.`);
      }
    },
    onError: (err) => {
      toast.error("Generation failed", { description: err.message });
    },
  });

  const generateAbstractMutation = trpc.socialContent.generateAbstractImage.useMutation();
  const updateSavedPostMutation = trpc.socialContent.updateSavedPost.useMutation({
    onSuccess: () => void utils.socialContent.listSavedPosts.invalidate(),
  });
  const markPublishedMutation = trpc.socialContent.markSavedPostPublished.useMutation({
    onSuccess: () => void utils.socialContent.listSavedPosts.invalidate(),
  });
  const flagSavedPostMutation = trpc.socialContent.flagSavedPost.useMutation({
    onSuccess: () => void utils.socialContent.listSavedPosts.invalidate(),
  });
  const deleteSavedPostMutation = trpc.socialContent.deleteSavedPost.useMutation({
    onSuccess: () => void utils.socialContent.listSavedPosts.invalidate(),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      contentType: contentType as any,
      category: category as any,
      brand: presentation.brand,
      customTopic: customTopic.trim() || undefined,
      count,
      imageMode,
      imageStyleHint: imageMode === "abstract" ? (imageStyleHint.trim() || undefined) : undefined,
      layoutMode,
      cardTheme,
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
      setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: result.imageUrl, imageSource: "ai" as const, mediaAssetId: null } : p)));
      const saved = items[idx];
      if (saved?.libraryId) updateSavedPostMutation.mutate({ id: saved.libraryId, brand: presentation.brand, imageUrl: result.imageUrl, imageSource: "ai", mediaAssetId: null });
      toast.success("Abstract background regenerated!");
    } catch (err: any) {
      toast.error("Image generation failed", { description: err.message });
    } finally {
      setRegeneratingImageIdx(null);
    }
  }, [generateAbstractMutation, items, updateSavedPostMutation]);

  const handleUploadedImage = useCallback((idx: number, uploaded: { url: string; assetId: number }) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: uploaded.url, imageSource: "upload" as const, mediaAssetId: uploaded.assetId } : p)));
    const saved = items[idx];
    if (saved?.libraryId) updateSavedPostMutation.mutate({ id: saved.libraryId, brand: presentation.brand, imageUrl: uploaded.url, imageSource: "upload", mediaAssetId: uploaded.assetId });
  }, [items, updateSavedPostMutation]);

  const handleRepositoryImage = useCallback((idx: number, asset: any) => {
    const imageUrl = asset.currentVersion?.s3Url;
    if (!imageUrl) return;
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl, imageSource: "media_repository" as const, mediaAssetId: asset.id } : p)));
    const saved = items[idx];
    if (saved?.libraryId) updateSavedPostMutation.mutate({ id: saved.libraryId, brand: presentation.brand, imageUrl, imageSource: "media_repository", mediaAssetId: asset.id });
    toast.success("Media Repository image selected.");
  }, [items, updateSavedPostMutation]);

  const handleRemoveImage = useCallback((idx: number) => {
    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, imageUrl: undefined, imageSource: undefined } : p)));
    const saved = items[idx];
    if (saved?.libraryId) updateSavedPostMutation.mutate({ id: saved.libraryId, brand: presentation.brand, imageUrl: null, imageSource: null, mediaAssetId: null });
    toast.success("Image removed from card");
  }, [items, updateSavedPostMutation]);

  const openSavedPost = useCallback((saved: any) => {
    setItems([{
      libraryId: saved.id,
      headline: saved.headline,
      body: saved.body,
      subtext: saved.subtext ?? "",
      socialCaption: saved.socialCaption,
      category: saved.category,
      contentType: saved.contentType,
      imageUrl: saved.imageUrl ?? undefined,
      imageSource: saved.imageSource ?? undefined,
      mediaAssetId: saved.mediaAssetId ?? null,
    }]);
    setLayoutMode(saved.layoutMode);
    setCardTheme(saved.cardTheme);
    setShowLibrary(false);
    toast.success("Saved post opened. Download it from the card preview.");
  }, []);

  const asGeneratedItem = useCallback((saved: any): GeneratedItem => ({
    libraryId: saved.id,
    headline: saved.headline,
    body: saved.body,
    subtext: saved.subtext ?? "",
    socialCaption: saved.socialCaption,
    category: saved.category,
    contentType: saved.contentType,
    imageUrl: saved.imageUrl ?? undefined,
    imageSource: saved.imageSource ?? undefined,
    mediaAssetId: saved.mediaAssetId ?? null,
  }), []);

  const buildExportMotion = useCallback((item: GeneratedItem): CardMotion => mp4Sequence === "combined"
    ? { kind: "combined", title: item.headline, options: [], answer: item.body, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.outroLogoUrl, logoShape: presentation.outroLogoShape, outroHost: presentation.publicHost, musicUrl: selectedMusic?.url, musicBlob: selectedMusic?.localBlob, musicTitle: selectedMusic?.title }
    : { kind: "social", title: item.headline, detail: item.body, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.outroLogoUrl, logoShape: presentation.outroLogoShape, outroHost: presentation.publicHost, musicUrl: selectedMusic?.url, musicBlob: selectedMusic?.localBlob, musicTitle: selectedMusic?.title },
  [mp4Sequence, presentation.accentColor, presentation.displayName, presentation.outroLogoShape, presentation.outroLogoUrl, presentation.publicHost, selectedMusic?.localBlob, selectedMusic?.title, selectedMusic?.url]);

  const toggleSavedPostSelection = useCallback((id: number) => {
    setSelectedSavedPostIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }, []);

  const handleSavedLibraryBulkDownload = useCallback(async () => {
    const selected = (savedPosts.data ?? []).filter((saved: any) => selectedSavedPostIds.includes(saved.id));
    if (selected.length === 0) return;
    setSavedLibraryBatchLoading(true);
    const zip = new JSZip();
    const folder = zip.folder(`saved-post-library-${exportPlatform}-${exportFormat}`)!;
    try {
      for (const saved of selected) {
        const handle = savedPostRefs.current[saved.id];
        if (!handle) throw new Error(`Saved post ${saved.id} is not ready to export.`);
        const item = asGeneratedItem(saved);
        const card = await handle.renderPlatform(exportPlatform, exportFormat, buildExportMotion(item));
        folder.file(`${String(saved.id).padStart(4, "0")}-${item.contentType}-${item.category.replace(/[\s/]+/g, "-")}.${exportFormat}`, await card.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${presentation.brand}-saved-post-library-${exportPlatform}-${exportFormat}-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(`Downloaded ${selected.length} saved post${selected.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Saved post bulk export failed:", error);
      toast.error("Saved post bulk export failed. Please try again.");
    } finally {
      setSavedLibraryBatchLoading(false);
    }
  }, [asGeneratedItem, buildExportMotion, exportFormat, exportPlatform, presentation.brand, savedPosts.data, selectedSavedPostIds]);

  const handleBatchDownload = useCallback(async () => {
    if (items.length === 0) return;
    setBatchLoading(true);
    const zip = new JSZip();
    const folder = zip.folder(`social-content-${exportPlatform}-${exportFormat}`)!;
    try {
      for (const [idx, handle] of Object.entries(cardRefs.current)) {
        const item = items[Number(idx)];
        if (!item) continue;
        const card = await handle.renderPlatform(exportPlatform, exportFormat, buildExportMotion(item));
        const name = `${item.contentType}-${item.category.replace(/[\s/]+/g, "-")}-${Number(idx) + 1}.${exportFormat}`;
        folder.file(name, await card.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${presentation.brand}-social-content-${exportPlatform}-${exportFormat}-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success("ZIP downloaded!");
    } catch (err) {
      console.error("Batch export failed:", err);
      toast.error("Batch export failed.");
    } finally {
      setBatchLoading(false);
    }
  }, [buildExportMotion, exportFormat, exportPlatform, items, presentation.brand]);

  const t = CARD_THEMES[cardTheme];

  return (
    <div className="min-h-screen" style={{ background: "#0a1018" }}>
      {/* Header */}
      <div style={{ background: "#0e1a24", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-2">
          <Link href={perBrandAdminUrl("/platform-admin", presentation.brand)}>
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/50" />
            </button>
          </Link>
          <Sparkles className="w-4 h-4" style={{ color: BRAND_AQUA }} />
          <h1 className="text-base font-bold text-white">{presentation.displayName} Social Content Generator</h1>
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
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${BRAND}44` }}>
              {([
                ["white", "White", "#ffffff", BRAND_DARK],
                ["aqua", "Aqua", "#bdeff1", BRAND_DARK],
                ["teal", "Teal", "#087e86", "#ffffff"],
                ["dark", "Dark", BRAND_DARK, BRAND_AQUA],
              ] as const).map(([value, label, background, color]) => (
                <button
                  key={value}
                  onClick={() => setCardTheme(value)}
                  className="px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                  style={{ background: cardTheme === value ? background : "transparent", color: cardTheme === value ? color : "rgba(255,255,255,0.48)" }}
                >
                  {label}
                </button>
              ))}
            </div>
            {items.length > 1 && (
              <Button onClick={handleBatchDownload} disabled={batchLoading} size="sm" className="gap-1.5 text-xs text-white" style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}>
                {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                Download All ({items.length})
              </Button>
            )}
            <Button onClick={() => setShowLibrary((value) => !value)} size="sm" variant="outline" className="gap-1.5 border-white/15 text-xs text-white/80 hover:bg-white/10">
              <LibraryBig className="w-3 h-3" /> Post Library
            </Button>
          </div>
        </div>
      </div>

      {showLibrary && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-4">
          <section className="rounded-xl border border-white/10 bg-[#0e1a24] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Shared {presentation.displayName} Post Library</h2>
                <p className="mt-1 text-xs text-white/45">Generated posts are available to all Platform Admins for reopening and later download.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-0 bg-teal-300/15 text-teal-200">{savedPosts.data?.length ?? 0} saved</Badge>
                <Button size="sm" disabled={selectedSavedPostIds.length === 0 || savedLibraryBatchLoading} onClick={handleSavedLibraryBulkDownload} className="h-8 bg-teal-500 px-2.5 text-xs text-white hover:bg-teal-400"><Package className="mr-1 h-3.5 w-3.5" />{savedLibraryBatchLoading ? "Building ZIP…" : `Download selected (${selectedSavedPostIds.length})`}</Button>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-white/40">Bulk export uses the current platform size, file format, and optional music selection.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {savedPosts.isLoading && <div className="col-span-full py-5 text-center text-xs text-white/45"><Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" />Loading saved posts</div>}
              {savedPosts.data?.map((saved: any) => (
                <article key={saved.id} className="rounded-lg border border-white/10 bg-black/15 p-3">
                  <div className="flex items-start justify-between gap-2"><label className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/55"><input type="checkbox" checked={selectedSavedPostIds.includes(saved.id)} onChange={() => toggleSavedPostSelection(saved.id)} className="accent-teal-400" /><span className="sr-only">Select {saved.headline} for bulk export</span></label><div className="line-clamp-2 flex-1 text-sm font-semibold text-white/85">{saved.headline}</div><Badge className={`shrink-0 border-0 text-[9px] ${saved.status === "published" ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/55"}`}>{saved.status === "published" ? "Published" : "Draft"}</Badge></div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-teal-200/70">{saved.category} · {saved.contentType.replace(/_/g, " ")}</div>
                  {saved.flagComment && <div className="mt-2 rounded border border-amber-300/25 bg-amber-300/10 p-2 text-[10px] text-amber-100"><span className="font-bold">Flag:</span> {saved.flagComment}</div>}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5"><Button size="sm" onClick={() => openSavedPost(saved)} className="h-7 bg-teal-500 px-2 text-xs text-white hover:bg-teal-400"><Download className="mr-1 h-3 w-3" />Open</Button><Button size="sm" variant="outline" onClick={() => markPublishedMutation.mutate({ id: saved.id, brand: presentation.brand, published: saved.status !== "published" })} className="h-7 border-white/15 px-2 text-[10px] text-white/75 hover:bg-white/10"><CheckCircle2 className="mr-1 h-3 w-3" />{saved.status === "published" ? "Unpublish" : "Publish"}</Button><Button size="sm" variant="outline" onClick={() => deleteSavedPostMutation.mutate({ id: saved.id, brand: presentation.brand })} className="ml-auto h-7 border-rose-300/25 px-2 text-[10px] text-rose-200 hover:bg-rose-400/10"><Trash2 className="h-3 w-3" /><span className="sr-only">Delete</span></Button></div>
                  <div className="mt-2 flex gap-1.5"><input value={flagComments[saved.id] ?? ""} onChange={(event) => setFlagComments((current) => ({ ...current, [saved.id]: event.target.value }))} placeholder="Flag comment" className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/35" /><Button size="sm" variant="outline" disabled={!flagComments[saved.id]?.trim()} onClick={() => { flagSavedPostMutation.mutate({ id: saved.id, brand: presentation.brand, comment: flagComments[saved.id].trim() }); setFlagComments((current) => ({ ...current, [saved.id]: "" })); }} className="h-7 border-amber-300/25 px-2 text-[10px] text-amber-100 hover:bg-amber-300/10"><Flag className="mr-1 h-3 w-3" />Flag</Button></div>
                </article>
              ))}
              {!savedPosts.isLoading && savedPosts.data?.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-white/10 py-5 text-center text-xs text-white/45">Generated posts will appear here for every Platform Admin.</div>}
            </div>
            <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 opacity-0">
              {savedPosts.data?.map((saved: any) => {
                const item = asGeneratedItem(saved);
                const savedTheme = CARD_THEMES[saved.cardTheme as CardTheme] ?? CARD_THEMES.light;
                return <DownloadableCard key={`saved-export-${saved.id}`} filename={`saved-post-${saved.id}`} onRef={(handle) => { savedPostRefs.current[saved.id] = handle; }} platform={exportPlatform} format={exportFormat} motion={buildExportMotion(item)}>{saved.layoutMode === "infographic" ? <InfographicCard item={item} t={savedTheme} presentation={presentation} /> : <SimpleContentCard item={item} t={savedTheme} presentation={presentation} />}</DownloadableCard>;
              })}
            </div>
          </section>
        </div>
      )}

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
                {brandCategories.map((c) => (<option key={c} value={c} style={{ background: "#0e1a24" }}>{c}</option>))}
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/15 p-3">
            <div>
              <div className="text-xs font-bold text-white/80">Platform export</div>
              <p className="mt-1 text-[11px] text-white/45">MP4 exports animate the headline and clinical insight, then finish on the completed card.</p>
            </div>
            <div className="min-w-[300px] space-y-2"><SocialExportControls platform={exportPlatform} format={exportFormat} onPlatformChange={setExportPlatform} onFormatChange={setExportFormat} musicOptions={musicOptions} selectedMusic={selectedMusic} onMusicChange={setSelectedMusic} musicUploadBrand={presentation.brand} compact /><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45"><span>MP4 sequence</span><button onClick={() => setMp4Sequence("social")} className={`rounded px-2 py-1 text-[10px] normal-case ${mp4Sequence === "social" ? "bg-teal-400/20 text-teal-100" : "bg-white/5 text-white/50"}`}>Post</button><button onClick={() => setMp4Sequence("combined")} className={`rounded px-2 py-1 text-[10px] normal-case ${mp4Sequence === "combined" ? "bg-teal-400/20 text-teal-100" : "bg-white/5 text-white/50"}`}>Question + answer</button></div></div>
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
                  {mode === "abstract" && <><Sparkles className="w-3 h-3" /> AI Generate</>}
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
                  platform={exportPlatform}
                  format={exportFormat}
                  motion={buildExportMotion(item)}
                >
                  {layoutMode === "infographic" ? (
                    <InfographicCard item={item} t={t} presentation={presentation} />
                  ) : (
                    <SimpleContentCard item={item} t={t} presentation={presentation} />
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
                    <SocialPostPanel item={item} presentation={presentation} />
                  </div>
                  {/* Image controls */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center gap-1.5">
                      <ImageLucide className="w-3 h-3" style={{ color: BRAND_AQUA }} />
                      <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Image</span>
                    </div>
                    {/* Per-card image prompt input */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={perCardImagePrompts[idx] || ""}
                        onChange={(e) => setPerCardImagePrompts((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Describe image (e.g., ultrasound of liver, probe on patient)..."
                        className="flex-1 px-2.5 py-1.5 rounded-md text-xs bg-white/5 border border-white/10 text-white outline-none placeholder:text-white/25 focus:border-[#4ad9e0]/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.imageUrl ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleRegenerateAbstract(idx, item, perCardImagePrompts[idx])} disabled={regeneratingImageIdx === idx} className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs">
                            {regeneratingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {perCardImagePrompts[idx]?.trim() ? "Generate from Prompt" : "New Abstract"}
                          </Button>
                          <ImageUploadButton onUploaded={(uploaded) => handleUploadedImage(idx, uploaded)} brand={presentation.brand} disabled={regeneratingImageIdx === idx} />
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
                          <Button size="sm" variant="outline" onClick={() => handleRegenerateAbstract(idx, item, perCardImagePrompts[idx])} disabled={regeneratingImageIdx === idx} className="gap-1.5 text-white/50 border-white/15 hover:bg-white/10 text-xs">
                            {regeneratingImageIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            {perCardImagePrompts[idx]?.trim() ? "Generate from Prompt" : "Add Abstract"}
                          </Button>
                          <ImageUploadButton onUploaded={(uploaded) => handleUploadedImage(idx, uploaded)} brand={presentation.brand} disabled={regeneratingImageIdx === idx} />
                        </>
                      )}
                    </div>
                    {/* Quick prompt suggestions */}
                    <div className="flex flex-wrap gap-1">
                      {["ultrasound probe", "sonogram screen", "medical team", "teal waveform", "abstract mesh"].map((hint) => (
                        <button
                          key={hint}
                          onClick={() => setPerCardImagePrompts((prev) => ({ ...prev, [idx]: hint }))}
                          className="px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors cursor-pointer"
                          style={{
                            background: perCardImagePrompts[idx] === hint ? `${BRAND}33` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${perCardImagePrompts[idx] === hint ? BRAND : "rgba(255,255,255,0.06)"}`,
                            color: perCardImagePrompts[idx] === hint ? BRAND_AQUA : "rgba(255,255,255,0.35)",
                          }}
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">Media Repository images</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {mediaAssets.data?.assets.map((asset: any) => (
                          <button key={asset.id} onClick={() => handleRepositoryImage(idx, asset)} className="overflow-hidden rounded border border-white/10 bg-black/20 text-left hover:border-teal-300/70" title={asset.title}>
                            {asset.currentVersion?.s3Url ? <img src={asset.currentVersion.s3Url} alt={asset.title} className="h-14 w-full object-cover" /> : <div className="flex h-14 items-center justify-center"><ImageLucide className="h-4 w-4 text-teal-200" /></div>}
                            <span className="line-clamp-1 block p-1 text-[9px] text-white/60">{asset.title}</span>
                          </button>
                        ))}
                        {!mediaAssets.isLoading && mediaAssets.data?.assets.length === 0 && <div className="col-span-4 text-[10px] text-white/40">No selected-brand repository images yet.</div>}
                      </div>
                    </div>
                  </div>
                  {/* Quick regenerate */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      generateMutation.mutate(
                        { contentType: item.contentType as any, category: item.category as any, count: 1, imageMode: item.imageUrl ? "abstract" : "none", layoutMode, cardTheme },
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
