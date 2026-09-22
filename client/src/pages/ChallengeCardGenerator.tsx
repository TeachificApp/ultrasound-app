/*
 * ChallengeCardGenerator -- Admin Only
 * Generates branded 1080x1080 social media image cards for daily challenges.
 * Adapted from iHeartEcho for UltrasoundAssist™ (All About Ultrasound™)
 */
import { useRef, useCallback, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  ArrowLeft, Download, Loader2, AlertCircle, ImageIcon,
  CheckCircle2, Zap, Package, Share2, Copy, Check,
  ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getBrandToolPresentation, resolveToolBrand, type BrandToolPresentation } from "@/lib/brandToolPresentation";
import { perBrandAdminUrl } from "@/lib/perBrandUrls";
import { ClinicalQuizCard, type ClinicalQuizCardTemplate } from "@/components/social/ClinicalQuizCard";
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

// Brand palette
const BRAND = "#189aa1";
const BRAND_DARK = "#0d3d44";
const BRAND_AQUA = "#4ad9e0";
const HERO_URL_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/daily-challenge-banner-v3_AAUS_ccb55bf0.webp";
const HERO_URL_LIGHT = HERO_URL_DARK;

// ---- Theme tokens -----------------------------------------------------------
type CardTheme = "dark" | "light";
type ChallengeCardTemplate = "classic" | ClinicalQuizCardTemplate;

interface ThemeTokens {
  cardBg: string;
  heroOverlay: string;
  heroFilter: string;
  accentBar: string;
  leftStripe: string;
  cornerGlow: string;
  headingColor: string;
  subheadingColor: string;
  bodyColor: string;
  mutedColor: string;
  footerColor: string;
  footerRight: string;
  optionEvenBg: string;
  optionOddBg: string;
  optionEvenBorder: string;
  optionOddBorder: string;
  bubbleEvenBg: string;
  bubbleOddBg: string;
  bubbleEvenBorder: string;
  bubbleOddBorder: string;
  bubbleEvenColor: string;
  bubbleOddColor: string;
  dividerFade: string;
  footerBorder: string;
  answerBoxBg: string;
  answerBoxBorder: string;
  answerTextColor: string;
  explanationBg: string;
  explanationBorder: string;
  explanationTextColor: string;
  recapColor: string;
  recapBorder: string;
  qPillBg: string;
  qPillBorder: string;
  qPillColor: string;
  aPillBg: string;
  aPillBorder: string;
  aPillColor: string;
}

const DARK_THEME: ThemeTokens = {
  cardBg: "#071318",
  heroOverlay: "linear-gradient(160deg, rgba(5,14,22,0.88) 0%, rgba(7,25,35,0.82) 50%, rgba(5,14,22,0.90) 100%)",
  heroFilter: "none",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  leftStripe: `linear-gradient(180deg, ${BRAND_AQUA}bb 0%, ${BRAND}44 60%, transparent 100%)`,
  cornerGlow: `linear-gradient(225deg, ${BRAND}1a 0%, transparent 60%)`,
  headingColor: "#fff",
  subheadingColor: "rgba(255,255,255,0.32)",
  bodyColor: "rgba(255,255,255,0.88)",
  mutedColor: "rgba(255,255,255,0.65)",
  footerColor: BRAND_AQUA,
  footerRight: "rgba(255,255,255,0.25)",
  optionEvenBg: "rgba(255,255,255,0.04)",
  optionOddBg: `${BRAND}0a`,
  optionEvenBorder: "rgba(255,255,255,0.07)",
  optionOddBorder: `${BRAND}33`,
  bubbleEvenBg: "rgba(255,255,255,0.07)",
  bubbleOddBg: `${BRAND}33`,
  bubbleEvenBorder: "rgba(255,255,255,0.12)",
  bubbleOddBorder: `${BRAND_AQUA}55`,
  bubbleEvenColor: "rgba(255,255,255,0.65)",
  bubbleOddColor: BRAND_AQUA,
  dividerFade: `${BRAND}55`,
  footerBorder: `${BRAND}44`,
  answerBoxBg: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(74,222,128,0.05))",
  answerBoxBorder: "rgba(34,197,94,0.4)",
  answerTextColor: "#fff",
  explanationBg: `linear-gradient(135deg, ${BRAND}12, rgba(255,255,255,0.02))`,
  explanationBorder: `${BRAND}44`,
  explanationTextColor: "rgba(255,255,255,0.82)",
  recapColor: "rgba(255,255,255,0.50)",
  recapBorder: `${BRAND}66`,
  qPillBg: `linear-gradient(135deg, ${BRAND}33, ${BRAND_AQUA}18)`,
  qPillBorder: BRAND_AQUA,
  qPillColor: BRAND_AQUA,
  aPillBg: "linear-gradient(135deg, #22c55e22, #4ade8012)",
  aPillBorder: "#22c55e",
  aPillColor: "#4ade80",
};

const LIGHT_THEME: ThemeTokens = {
  cardBg: "#e8f7f8",
  heroOverlay: "linear-gradient(160deg, rgba(220,245,248,0.92) 0%, rgba(200,238,242,0.86) 50%, rgba(215,244,247,0.93) 100%)",
  heroFilter: "brightness(1.6) saturate(0.5)",
  accentBar: `linear-gradient(90deg, ${BRAND_DARK}, ${BRAND}, ${BRAND_AQUA}, ${BRAND})`,
  leftStripe: `linear-gradient(180deg, ${BRAND}cc 0%, ${BRAND}55 60%, transparent 100%)`,
  cornerGlow: `linear-gradient(225deg, ${BRAND}22 0%, transparent 60%)`,
  headingColor: BRAND_DARK,
  subheadingColor: `${BRAND_DARK}99`,
  bodyColor: "#0d3d44",
  mutedColor: `${BRAND_DARK}bb`,
  footerColor: BRAND,
  footerRight: `${BRAND_DARK}66`,
  optionEvenBg: "rgba(24,154,161,0.06)",
  optionOddBg: "rgba(74,217,224,0.10)",
  optionEvenBorder: `${BRAND}33`,
  optionOddBorder: `${BRAND_AQUA}55`,
  bubbleEvenBg: `${BRAND}22`,
  bubbleOddBg: `${BRAND_AQUA}33`,
  bubbleEvenBorder: `${BRAND}55`,
  bubbleOddBorder: `${BRAND_AQUA}88`,
  bubbleEvenColor: BRAND_DARK,
  bubbleOddColor: BRAND,
  dividerFade: `${BRAND}44`,
  footerBorder: `${BRAND}55`,
  answerBoxBg: "linear-gradient(135deg, rgba(24,154,161,0.10), rgba(74,217,224,0.06))",
  answerBoxBorder: `${BRAND}88`,
  answerTextColor: BRAND_DARK,
  explanationBg: `linear-gradient(135deg, ${BRAND}0e, rgba(74,217,224,0.06))`,
  explanationBorder: `${BRAND}44`,
  explanationTextColor: "#0d3d44",
  recapColor: `${BRAND_DARK}bb`,
  recapBorder: `${BRAND}77`,
  qPillBg: `linear-gradient(135deg, ${BRAND}22, ${BRAND_AQUA}18)`,
  qPillBorder: BRAND,
  qPillColor: BRAND_DARK,
  aPillBg: `linear-gradient(135deg, ${BRAND}22, ${BRAND_AQUA}14)`,
  aPillBorder: BRAND,
  aPillColor: BRAND_DARK,
};

// Category-specific hashtag map
const CATEGORY_HASHTAGS: Record<string, string[]> = {
  "Abdominal": ["#AbdominalUltrasound", "#AbdominalImaging", "#GIUltrasound"],
  "Small Parts": ["#SmallPartsUltrasound", "#ThyroidUltrasound", "#ScrotalUltrasound"],
  "Pelvic/Gyn": ["#PelvicUltrasound", "#GynUltrasound", "#PelvicImaging"],
  "OB 1st Trimester": ["#FirstTrimester", "#ObstetricUltrasound", "#OBUltrasound"],
  "OB 2nd/3rd Trimester": ["#ObstetricUltrasound", "#FetalImaging", "#OBUltrasound"],
  "Fetal Echo": ["#FetalEcho", "#FetalCardiology", "#FetalUltrasound"],
  "Breast": ["#BreastUltrasound", "#BreastImaging", "#BIRADs"],
  "Vascular": ["#VascularUltrasound", "#VascularImaging", "#DuplexScan"],
  "MSK": ["#MSKUltrasound", "#MusculoskeletalUltrasound", "#MSKImaging"],
  "POCUS": ["#POCUS", "#PointOfCareUltrasound", "#BedSideUltrasound"],
  "Physics": ["#UltrasoundPhysics", "#SonographyPhysics", "#UltrasoundInstrumentation"],
};

function getCategoryHashtags(category: string): string[] {
  if (CATEGORY_HASHTAGS[category]) return CATEGORY_HASHTAGS[category];
  for (const [key, tags] of Object.entries(CATEGORY_HASHTAGS)) {
    if (category.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(category.toLowerCase())) {
      return tags;
    }
  }
  return ["#UltrasoundTraining", "#ClinicalImaging", "#SonographyEducation"];
}

function buildSocialPost(
  type: "question" | "answer",
  category: string,
  challengeTitle: string,
  questionText: string,
  answerText: string | null,
  explanationText: string | null,
  presentation: BrandToolPresentation,
  options?: string[],
): string {
  const cleanQ = stripHtml(questionText);
  const cleanA = answerText ? stripHtml(answerText) : null;
  const cleanE = explanationText ? stripHtml(explanationText) : null;
  const categoryTags = getCategoryHashtags(category);
  const allHashtags = [...presentation.socialHashtags, ...categoryTags].join(" ");
  const letters = ["A", "B", "C", "D", "E"];

  if (type === "question") {
    const optionsBlock =
      options && options.length > 0
        ? "\n\n" + options.map((o, i) => `${letters[i]}. ${stripHtml(o)}`).join("\n")
        : "";
    return `🏆${presentation.challengeLabel} — ${category}

Can you answer today's question?

❓ ${cleanQ}${optionsBlock}

Drop your answer in the comments below! 👇

Get more challenges and take your place on the leaderboard 🏆 at ${presentation.appHost}

${allHashtags}`;
  } else {
    const answerLine = cleanA ? `✅ Answer: ${cleanA}` : "";
    const explanationLine = cleanE ? `\n\n💡 ${cleanE}` : "";
    return `🏆${presentation.challengeLabel} — ${category} | ANSWER

${answerLine}${explanationLine}

Get more challenges and take your place on the leaderboard 🏆 at ${presentation.appHost}

${allHashtags}`;
  }
}

// ---- helpers ----------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function RichHtml({
  html,
  color,
  fontSize = 22,
  lineHeight = 1.6,
}: {
  html: string;
  color: string;
  fontSize?: number;
  lineHeight?: number;
}) {
  const processed = html
    .replace(/&nbsp;/g, "\u00a0")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<strong>/g, `<span style="font-weight:800;color:${color}">`)
    .replace(/<\/strong>/g, "</span>")
    .replace(/<b>/g, `<span style="font-weight:800;color:${color}">`)
    .replace(/<\/b>/g, "</span>")
    .replace(/<em>/g, `<span style="font-style:italic">`)
    .replace(/<\/em>/g, "</span>")
    .replace(/<i>/g, `<span style="font-style:italic">`)
    .replace(/<\/i>/g, "</span>")
    .replace(/<u>/g, `<span style="text-decoration:underline">`)
    .replace(/<\/u>/g, "</span>")
    .replace(/<hr\s*\/?>/gi, `<div style="height:2px;background:linear-gradient(90deg,${BRAND_AQUA},${BRAND});border-radius:2px;margin:10px 0"></div>`)
    .replace(/<li>/g, `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px"><span style="color:${BRAND_AQUA};font-size:${fontSize}px;line-height:${lineHeight};flex-shrink:0">•</span><span style="flex:1">`)
    .replace(/<\/li>/g, "</span></div>")
    .replace(/<\/?(?:ul|ol|p|div|h[1-6]|blockquote|pre|code)[^>]*>/gi, "")
    .replace(/<(?!\/?(?:span|div|br|img))[^>]+>/gi, "")
    .replace(/<br\s*\/?>/gi, "<br/>");
  return (
    <div
      style={{ color, fontSize, lineHeight, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: processed }}
    />
  );
}

function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (typeof parsed[0] === "object" && parsed[0] !== null)
      return parsed.map((o: any) => (typeof o.text === "string" ? o.text : String(o)));
    return parsed as string[];
  } catch {
    return [];
  }
}

async function renderCardToPng(el: HTMLElement): Promise<string> {
  // The selected platform wrapper owns the real output frame.
  const actualWidth = el.clientWidth || el.scrollWidth || 1080;
  const actualHeight = el.clientHeight || el.scrollHeight || 1080;
  return toPng(el, {
    cacheBust: true,
    pixelRatio: 1,
    width: actualWidth,
    height: actualHeight,
  });
}

// ---- shared card shell ------------------------------------------------------

function CardShell({ children, t, presentation }: { children: React.ReactNode; t: ThemeTokens; presentation: BrandToolPresentation }) {
  const frame = useSocialCardFrame();
  const px = (value: number) => Math.max(1, Math.round(value * frame.contentScale));
  const isLight = t === LIGHT_THEME;
  const heroUrl = presentation.brand === "aaus" ? (isLight ? HERO_URL_LIGHT : HERO_URL_DARK) : null;
  return (
    <div
      style={{
        width: frame.width,
        height: frame.height,
        minHeight: frame.height,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Segoe UI', 'Open Sans', sans-serif",
        boxSizing: "border-box",
        background: t.cardBg,
      }}
    >
      {/* Full-bleed background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: heroUrl ? `url("${heroUrl}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 1,
          filter: t.heroFilter,
        }}
      />
      {/* Overlay for readability */}
      <div style={{ position: "absolute", inset: 0, background: t.heroOverlay }} />
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 7,
          background: t.accentBar,
        }}
      />
      {/* Left accent stripe */}
      <div
        style={{
          position: "absolute",
          top: 7,
          left: 0,
          bottom: 0,
          width: 4,
          background: t.leftStripe,
        }}
      />
      {/* Top-right geometric accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 260,
          height: 260,
          background: t.cornerGlow,
          clipPath: "polygon(100% 0, 0 0, 100% 100%)",
        }}
      />
      {/* Content */}
      <div
        style={{
          position: "relative",
          width: "100%",
          minHeight: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: `${px(52)}px ${px(64)}px ${px(44)}px ${px(68)}px`,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---- card header ------------------------------------------------------------

function CardHeader({ pill, t, presentation }: { pill: "QUESTION" | "ANSWER"; t: ThemeTokens; presentation: BrandToolPresentation }) {
  const frame = useSocialCardFrame();
  const px = (value: number) => Math.max(1, Math.round(value * frame.contentScale));
  const pillBg = pill === "QUESTION" ? t.qPillBg : t.aPillBg;
  const pillBorder = pill === "QUESTION" ? t.qPillBorder : t.aPillBorder;
  const pillColor = pill === "QUESTION" ? t.qPillColor : t.aPillColor;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: px(28),
      }}
    >
      {/* Logo + wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: px(18) }}>
        <div
          style={{
            width: px(72),
            height: px(72),
            borderRadius: px(18),
            overflow: "hidden",
            border: `${px(2.5)}px solid ${BRAND}88`,
            boxShadow: `0 0 24px ${BRAND}55`,
            flexShrink: 0,
          }}
        >
          <img src={presentation.logoUrl} alt={presentation.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: px(7) }}>
            <span
              style={{
                color: t.headingColor,
                fontSize: px(28),
                fontWeight: 800,
                letterSpacing: `${-px(0.5)}px`,
                lineHeight: 1,
              }}
            >
              {presentation.displayName}
            </span>
          </div>
          <div
            style={{
              color: BRAND,
              fontSize: px(13),
              fontWeight: 600,
              marginTop: px(4),
              letterSpacing: `${px(0.8)}px`,
              textTransform: "uppercase",
            }}
          >
            {presentation.challengeLabel}
          </div>
        </div>
      </div>

      {/* Type pill */}
      <div
        style={{
          background: pillBg,
          border: `${px(1.5)}px solid ${pillBorder}`,
          borderRadius: px(28),
          padding: `${px(9)}px ${px(22)}px`,
          color: pillColor,
          fontSize: px(13),
          fontWeight: 800,
          letterSpacing: `${px(2)}px`,
          boxShadow: `0 0 18px ${pillBorder}44`,
        }}
      >
        {pill}
      </div>
    </div>
  );
}

// ---- teal divider -----------------------------------------------------------

function TealDivider({ t }: { t: ThemeTokens }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 26 }}>
      <div style={{ height: 3, width: 44, borderRadius: 2, background: `linear-gradient(90deg, ${BRAND_AQUA}, ${BRAND})` }} />
      <div style={{ height: 3, width: 10, borderRadius: 2, background: t.dividerFade }} />
      <div style={{ height: 3, width: 5, borderRadius: 2, background: t.dividerFade + "88" }} />
    </div>
  );
}

// ---- card footer ------------------------------------------------------------

function CardFooter({ right, t, presentation }: { right?: string; t: ThemeTokens; presentation: BrandToolPresentation }) {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: `1px solid ${t.footerBorder}`,
      }}
    >
      <div style={{ color: t.footerColor, fontSize: 13, fontWeight: 700, opacity: 0.8, letterSpacing: "0.3px" }}>
        {presentation.appHost}
      </div>
      {right && (
        <div style={{ color: t.footerRight, fontSize: 12 }}>{right}</div>
      )}
    </div>
  );
}

// ---- Question Card ----------------------------------------------------------

function QuestionCard({
  challengeTitle,
  questionText,
  options,
  qid,
  t,
  presentation,
}: {
  challengeTitle: string;
  questionText: string;
  options: string[];
  qid: string | null;
  t: ThemeTokens;
  presentation: BrandToolPresentation;
}) {
  const letters = ["A", "B", "C", "D", "E"];
  const frame = useSocialCardFrame();
  const density = frame.contentScale;
  const px = (value: number) => Math.max(1, Math.round(value * density));
  const cleanQ = stripHtml(questionText);
  const optionCharacters = options.reduce((total, option) => total + stripHtml(option).length, 0);
  const questionFontSize = Math.max(20, Math.min(options.length > 0 ? 30 : 44, (options.length > 0 ? 34 : 48) - Math.floor(cleanQ.length / 72)));
  const optionFontSize = Math.max(15, 26 - Math.floor(optionCharacters / 115));
  const optionPadding = optionFontSize <= 18 ? "9px 14px" : "12px 20px";

  return (
    <CardShell t={t} presentation={presentation}>
      <CardHeader pill="QUESTION" t={t} presentation={presentation} />

      <div
        style={{
          color: t.subheadingColor,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 18,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        {challengeTitle}
      </div>

      <TealDivider t={t} />

      {/* Question text */}
      <div
        style={{
          color: t.headingColor,
          fontSize: px(questionFontSize),
          fontWeight: 700,
          lineHeight: 1.45,
          marginBottom: options.length > 0 ? 20 : 0,
          fontFamily: "'Georgia', 'Merriweather', serif",
          textShadow: t === DARK_THEME ? "0 2px 20px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {cleanQ}
      </div>

      {/* Options */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: px(10), marginBottom: px(8) }}>
          {options.map((opt, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                background: i % 2 === 0 ? t.optionEvenBg : t.optionOddBg,
                border: `1px solid ${i % 2 === 0 ? t.optionEvenBorder : t.optionOddBorder}`,
                borderRadius: 12,
                padding: optionPadding,
              }}
            >
              <div
                style={{
                  width: optionFontSize <= 18 ? 34 : 44,
                  height: optionFontSize <= 18 ? 34 : 44,
                  borderRadius: 11,
                  flexShrink: 0,
                  background: i % 2 === 0 ? t.bubbleEvenBg : t.bubbleOddBg,
                  border: `2px solid ${i % 2 === 0 ? t.bubbleEvenBorder : t.bubbleOddBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: i % 2 === 0 ? t.bubbleEvenColor : t.bubbleOddColor,
                  fontWeight: 800,
                  fontSize: optionFontSize <= 18 ? 16 : 20,
                  marginTop: 2,
                  boxShadow: i % 2 !== 0 ? `0 0 14px ${BRAND}44` : "none",
                }}
              >
                {letters[i]}
              </div>
              <span style={{ color: t.bodyColor, fontSize: px(optionFontSize), fontWeight: 500, lineHeight: 1.32 }}>
                {stripHtml(opt)}
              </span>
            </div>
          ))}
        </div>
      )}

      <CardFooter t={t} presentation={presentation} />
    </CardShell>
  );
}

// ---- Answer Card ------------------------------------------------------------

function AnswerCard({
  challengeTitle,
  questionText,
  options,
  correctAnswer,
  explanation,
  reviewAnswer,
  qid,
  t,
  presentation,
}: {
  challengeTitle: string;
  questionText: string;
  options: string[];
  correctAnswer: number | null;
  explanation: string | null;
  reviewAnswer: string | null;
  qid: string | null;
  t: ThemeTokens;
  presentation: BrandToolPresentation;
}) {
  const letters = ["A", "B", "C", "D", "E"];
  const answerText =
    options.length > 0 && correctAnswer != null
      ? `${letters[correctAnswer]}. ${stripHtml(options[correctAnswer] ?? "")}`
      : reviewAnswer
      ? stripHtml(reviewAnswer)
      : null;
  const answerFontSize = Math.max(18, 36 - Math.floor((answerText?.length ?? 0) / 44));
  const explanationFontSize = Math.max(14, 22 - Math.floor((explanation ? stripHtml(explanation).length : 0) / 170));
  const recapFontSize = Math.max(15, 24 - Math.floor(stripHtml(questionText).length / 80));

  return (
    <CardShell t={t} presentation={presentation}>
      <CardHeader pill="ANSWER" t={t} presentation={presentation} />

      <div
        style={{
          color: t.subheadingColor,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 18,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        {challengeTitle}
      </div>

      <TealDivider t={t} />

      {/* Question recap */}
      <div
        style={{
          marginBottom: 24,
          borderLeft: `4px solid ${t.recapBorder}`,
          paddingLeft: 18,
          fontFamily: "'Georgia', 'Merriweather', serif",
        }}
      >
        <RichHtml html={questionText} color={t.recapColor} fontSize={recapFontSize} lineHeight={1.35} />
      </div>

      {/* Answer box */}
      {answerText && (
        <div
          style={{
            background: t.answerBoxBg,
            border: `2px solid ${t.answerBoxBorder}`,
            borderRadius: 16,
            padding: "20px 26px",
            marginBottom: 18,
            position: "relative",
            boxShadow: `0 0 36px ${t.answerBoxBorder}44`,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -2,
              left: 26,
              width: 52,
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${BRAND_AQUA}, ${BRAND})`,
            }}
          />
          <div style={{ color: BRAND, fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: "2px" }}>
            CORRECT ANSWER
          </div>
          <div style={{ color: t.answerTextColor, fontSize: answerFontSize, fontWeight: 700, lineHeight: 1.25 }}>
            {answerText}
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div
          style={{
            background: t.explanationBg,
            border: `1px solid ${t.explanationBorder}`,
            borderRadius: 16,
            padding: "18px 24px",
            flex: "1 1 auto",
            boxShadow: `0 0 28px ${BRAND}16`,
          }}
        >
          <div style={{ color: BRAND, fontSize: 10, fontWeight: 800, marginBottom: 10, letterSpacing: "2px" }}>
            EXPLANATION
          </div>
          <RichHtml html={explanation} color={t.explanationTextColor} fontSize={explanationFontSize} lineHeight={1.38} />
        </div>
      )}

      <CardFooter right={`Follow for daily ${presentation.brand === "iheartecho" ? "echocardiography" : "ultrasound"} challenges`} t={t} presentation={presentation} />
    </CardShell>
  );
}

// ---- DownloadableCard wrapper -----------------------------------------------

interface DownloadableCardHandle {
  exportPng: () => Promise<string>;
  exportPlatform: (platform: SocialExportPlatform, format: SocialExportFormat, motion: CardMotion) => Promise<string>;
  renderPlatform: (platform: SocialExportPlatform, format: SocialExportFormat, motion: CardMotion) => Promise<Blob>;
}

const PREVIEW_SIZE = 700;

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
  onRef?: (handle: DownloadableCardHandle) => void;
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
    platform: SocialExportPlatform,
    format: SocialExportFormat,
    motion: CardMotion,
  ): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return exportSocialCard({ cardElement: ref.current, platform, format, filenameStem: filename, motion });
  }, [filename]);

  const renderPlatform = useCallback(async (
    platform: SocialExportPlatform,
    format: SocialExportFormat,
    motion: CardMotion,
  ): Promise<Blob> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderSocialCard({ cardElement: ref.current, platform, format, motion });
  }, []);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      (ref as any).current = el;
      if (el && onRef) {
        onRef({ exportPng, exportPlatform, renderPlatform });
      }
    },
    [exportPlatform, exportPng, onRef, renderPlatform]
  );

  const handleDownload = useCallback(async () => {
    try {
      await exportPlatform(platform, format, motion);
    } catch (err) {
      console.error("Card export failed:", err);
      toast.error(err instanceof Error ? err.message : "Export failed. Please try again.");
    }
  }, [exportPlatform, format, motion, platform]);

  return (
    <div className="flex flex-col">
      <div
        style={{
          width: previewWidth,
          height: previewHeight,
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
            width: previewPreset.width,
            height: previewPreset.height,
            transform: `scale(${previewScale})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={refCallback} style={{ width: previewPreset.width, height: previewPreset.height }}>
            <SocialCardFrameProvider platform={platform}>{children}</SocialCardFrameProvider>
          </div>
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/75">{previewPreset.label} · {previewPreset.width}×{previewPreset.height}</div>
      </div>
      <Button
        onClick={handleDownload}
        size="sm"
        className="w-full gap-2 text-white font-semibold text-xs rounded-t-none"
        style={{
          background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})`,
          borderRadius: "0 0 10px 10px",
        }}
      >
        <Download className="w-3 h-3" />
        Download {format.toUpperCase()}
      </Button>
    </div>
  );
}

// ---- Social Post Panel ------------------------------------------------------

function SocialPostPanel({
  type,
  category,
  challengeTitle,
  questionText,
  answerText,
  explanationText,
  options,
  presentation,
}: {
  type: "question" | "answer";
  category: string;
  challengeTitle: string;
  questionText: string;
  answerText: string | null;
  explanationText: string | null;
  options?: string[];
  presentation: BrandToolPresentation;
}) {
  const [copied, setCopied] = useState(false);

  const post = buildSocialPost(type, category, challengeTitle, questionText, answerText, explanationText, presentation, options);

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
      toast.success("Copied!", { description: "Social post copied to clipboard." });
      setTimeout(() => setCopied(false), 2500);
    }
  }, [post]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${BRAND}33`, background: "#0a1620" }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${BRAND}22`, background: `${BRAND}0a` }}
      >
        <div className="flex items-center gap-1.5">
          <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND_AQUA }}>
            Social Post — {type === "question" ? "Question" : "Answer"}
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
        style={{ color: "rgba(255,255,255,0.65)", maxHeight: 160, overflowY: "auto" }}
      >
        {post}
      </div>
    </div>
  );
}

// ---- CategorySection --------------------------------------------------------

type QuestionItem = {
  id: number;
  qid: string | null;
  type: string;
  question: string;
  options: string | null;
  correctAnswer: number | null;
  explanation: string | null;
  reviewAnswer: string | null;
  imageUrl: string | null;
  difficulty: string;
  category: string | null;
};

type CategoryItem = {
  category: string;
  challenge: { title: string; status: string; category: string } | null;
  questions: QuestionItem[];
};

function CategorySection({
  item,
  onQuestionRef,
  onAnswerRef,
  theme,
  date,
  presentation,
  template,
  exportPlatform,
  exportFormat,
  musicUrl,
  musicTitle,
}: {
  item: CategoryItem;
  onQuestionRef: (cat: string, h: DownloadableCardHandle) => void;
  onAnswerRef: (cat: string, h: DownloadableCardHandle) => void;
  theme: CardTheme;
  date: string;
  presentation: BrandToolPresentation;
  template: ChallengeCardTemplate;
  exportPlatform: SocialExportPlatform;
  exportFormat: SocialExportFormat;
  musicUrl?: string | null;
  musicTitle?: string | null;
}) {
  const t = theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const combinedRef = useRef<DownloadableCardHandle | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const { category, challenge, questions } = item;
  const q = questions[0];

  if (!challenge || !q) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-white/40 text-xs">
        No queued challenge for <span className="font-semibold text-white/60">{category}</span>
      </div>
    );
  }

  const options = parseOptions(q.options);
  const letters = ["A", "B", "C", "D", "E"];
  const answerText =
    options.length > 0 && q.correctAnswer != null
      ? `${letters[q.correctAnswer]}. ${stripHtml(options[q.correctAnswer] ?? "")}`
      : q.reviewAnswer
      ? stripHtml(q.reviewAnswer)
      : null;
  const explanationText = q.explanation ? stripHtml(q.explanation) : null;
  const contextLabel = q.category?.trim() || category;
  const questionMotion: CardMotion = { kind: "question", title: q.question, options, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.logoUrl, outroHost: presentation.appHost, musicUrl, musicTitle };
  const answerMotion: CardMotion = { kind: "answer", title: q.question, options, detail: "Review the question", answer: answerText, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.logoUrl, outroHost: presentation.appHost, musicUrl, musicTitle };
  const combinedMotion: CardMotion = { kind: "combined", title: q.question, options, answer: answerText, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.logoUrl, outroHost: presentation.appHost, musicUrl, musicTitle };
  const downloadCombined = async () => {
    if (!combinedRef.current) return;
    setCombinedLoading(true);
    try {
      const file = await combinedRef.current.renderPlatform(exportPlatform, "mp4", combinedMotion);
      saveAs(file, `${category.replace(/\s+/g, "-")}-${date}-question-answer.mp4`);
      toast.success("Question + answer MP4 is ready.");
    } catch (error) {
      console.error("Combined Challenge Card export failed:", error);
      toast.error("Question + answer MP4 export failed. Please try again.");
    } finally {
      setCombinedLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden" style={{ background: "#0e1a24" }}>
      {/* Category header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_AQUA, boxShadow: `0 0 6px ${BRAND_AQUA}` }} />
          <span className="font-bold text-white text-sm">{category}</span>
          <Badge className="text-[10px] px-1.5 py-0" style={{ background: BRAND + "22", color: BRAND_AQUA, border: "none" }}>
            {challenge.status}
          </Badge>
        </div>
        <span className="text-white/35 text-xs truncate max-w-xs">{challenge.title}</span>
      </div>

      {/* Cards + social posts */}
      <div className="p-4 space-y-4">
        {/* Cards row — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3" style={{ color: BRAND_AQUA }} />
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Question Card</span>
            </div>
            <DownloadableCard
              filename={`${category.replace(/\s+/g, "-")}-${date}-question.png`}
              onRef={(h) => { combinedRef.current = h; onQuestionRef(category, h); }}
              platform={exportPlatform}
              format={exportFormat}
              motion={questionMotion}
            >
              {template === "classic" ? (
                <QuestionCard challengeTitle={contextLabel} questionText={q.question} options={options} qid={q.qid} t={t} presentation={presentation} />
              ) : (
                <ClinicalQuizCard presentation={presentation} template={template} question={q.question} options={options} media={q.imageUrl ? { kind: "image", url: q.imageUrl } : { kind: "none" }} title={contextLabel} />
              )}
            </DownloadableCard>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Answer Card</span>
            </div>
            <DownloadableCard
              filename={`${category.replace(/\s+/g, "-")}-${date}-answer.png`}
              onRef={(h) => onAnswerRef(category, h)}
              platform={exportPlatform}
              format={exportFormat}
              motion={answerMotion}
            >
              {template === "classic" ? (
                <AnswerCard
                  challengeTitle={contextLabel}
                  questionText={q.question}
                  options={options}
                  correctAnswer={q.correctAnswer}
                  explanation={q.explanation}
                  reviewAnswer={q.reviewAnswer}
                  qid={q.qid}
                  t={t}
                  presentation={presentation}
                />
              ) : (
                <ClinicalQuizCard
                  presentation={presentation}
                  template={template}
                  variant="answer"
                  question={q.question}
                  options={options}
                  media={{ kind: "none" }}
                  correctAnswer={answerText}
                  explanation={q.explanation}
                  title={contextLabel}
                />
              )}
            </DownloadableCard>
          </div>
        </div>
        <div className="flex justify-center">
          <Button size="sm" onClick={() => void downloadCombined()} disabled={combinedLoading} className="gap-1.5 bg-teal-500 text-xs text-white hover:bg-teal-400">
            {combinedLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}Question + answer MP4
          </Button>
        </div>

        {/* Social posts row — side by side below cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Question Post</span>
            </div>
            <SocialPostPanel
              type="question"
              category={category}
              challengeTitle={challenge.title}
              questionText={q.question}
              answerText={answerText}
              explanationText={explanationText}
              presentation={presentation}
              options={options}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Share2 className="w-3 h-3" style={{ color: BRAND_AQUA }} />
              <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Answer Post</span>
            </div>
            <SocialPostPanel
              type="answer"
              category={category}
              challengeTitle={challenge.title}
              questionText={q.question}
              answerText={answerText}
              explanationText={explanationText}
              presentation={presentation}
              options={options}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page --------------------------------------------------------------

// ---- Date helpers -----------------------------------------------------------
function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  // Format as "Mar 20"
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChallengeCardGenerator() {
  const [location] = useLocation();
  const presentation = useMemo(
    () => getBrandToolPresentation(resolveToolBrand(location, window.location.hostname)),
    [location],
  );
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;

  // Available dates (up to 30 days back)
  const { data: availableDates, isLoading: datesLoading } =
    trpc.quickfire.adminListCardGeneratorDates.useQuery(undefined, { staleTime: 300_000 });

  // Card data for the selected date — use the "next queued" procedure for today,
  // and the date-specific procedure for past dates.
  const todayQuery = trpc.quickfire.adminGetCardGeneratorData.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
    enabled: isToday,
  });
  const dateQuery = trpc.quickfire.adminGetCardGeneratorForDate.useQuery(
    { date: selectedDate },
    { staleTime: 60_000, retry: false, enabled: !isToday }
  );

  const isLoading = isToday ? todayQuery.isLoading : dateQuery.isLoading;
  const error = isToday ? todayQuery.error : dateQuery.error;
  // normalize to a flat array of CategoryItem
  const data: any[] | undefined = useMemo(() => {
    if (isToday) return todayQuery.data as any[] | undefined;
    const d = dateQuery.data as { date: string; results: any[] } | undefined;
    return d?.results;
  }, [isToday, todayQuery.data, dateQuery.data]);

  const refetch = isToday ? todayQuery.refetch : dateQuery.refetch;

  const [cardTheme, setCardTheme] = useState<CardTheme>("dark");
  const [cardTemplate, setCardTemplate] = useState<ChallengeCardTemplate>("classic");
  const [exportPlatform, setExportPlatform] = useState<SocialExportPlatform>(DEFAULT_SOCIAL_EXPORT_PLATFORM);
  const [exportFormat, setExportFormat] = useState<SocialExportFormat>("png");
  const [selectedMusic, setSelectedMusic] = useState<SocialMusicOption | null>(null);
  const musicAssets = trpc.mediaRepo.listAssets.useQuery({ brand: presentation.brand, mediaType: "audio", page: 1, pageSize: 50 });
  const musicOptions = useMemo<SocialMusicOption[]>(() => (musicAssets.data?.assets ?? [])
    .map((asset: any) => ({ id: `media:${asset.id}`, title: asset.title, url: asset.currentVersion?.s3Url, source: "media_repository" as const }))
    .filter((asset: SocialMusicOption) => Boolean(asset.url)), [musicAssets.data?.assets]);

  const questionRefs = useRef<Record<string, DownloadableCardHandle>>({});
  const answerRefs = useRef<Record<string, DownloadableCardHandle>>({});
  const [batchLoading, setBatchLoading] = useState<"questions" | "answers" | null>(null);

  const handleBatchDownload = useCallback(async (type: "questions" | "answers") => {
    setBatchLoading(type);
    const refs = type === "questions" ? questionRefs.current : answerRefs.current;
    const zip = new JSZip();
    const folder = zip.folder(type === "questions" ? "question-cards" : "answer-cards")!;
    try {
      for (const [cat, handle] of Object.entries(refs)) {
        const item = data?.find((candidate: any) => candidate.category === cat);
        const question = item?.questions?.[0];
        if (!question) continue;
        const options = parseOptions(question.options);
        const letters = ["A", "B", "C", "D", "E"];
        const answer = options.length > 0 && question.correctAnswer != null
          ? `${letters[question.correctAnswer]}. ${stripHtml(options[question.correctAnswer] ?? "")}`
          : question.reviewAnswer ? stripHtml(question.reviewAnswer) : null;
        const motion: CardMotion = type === "questions"
          ? { kind: "question", title: question.question, options, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.logoUrl, musicUrl: selectedMusic?.url, musicTitle: selectedMusic?.title }
          : { kind: "answer", title: question.question, options, detail: "Review the question", answer, brandName: presentation.displayName, accentColor: presentation.accentColor, logoUrl: presentation.logoUrl, musicUrl: selectedMusic?.url, musicTitle: selectedMusic?.title };
        const file = await handle.renderPlatform(exportPlatform, exportFormat, motion);
        folder.file(`${cat.replace(/\s+/g, "-")}-${type === "questions" ? "question" : "answer"}.${exportFormat}`, await file.arrayBuffer());
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${presentation.brand}-${type}-${exportPlatform}-${exportFormat}-${selectedDate}.zip`);
    } catch (err) {
      console.error("Batch export failed:", err);
      toast.error("Batch export failed. Please try again.");
    } finally {
      setBatchLoading(null);
    }
  }, [data, exportFormat, exportPlatform, presentation.accentColor, presentation.brand, presentation.displayName, presentation.logoUrl, selectedDate, selectedMusic?.title, selectedMusic?.url]);

  // Navigation helpers
  const dates = availableDates ?? [today];
  const currentIdx = dates.indexOf(selectedDate);
  // dates are sorted newest-first, so index 0 = today, higher index = older
  const canGoNewer = currentIdx > 0;
  const canGoOlder = currentIdx < dates.length - 1 && currentIdx !== -1;

  const goNewer = () => {
    if (canGoNewer) {
      const next = dates[currentIdx - 1];
      setSelectedDate(next);
      questionRefs.current = {};
      answerRefs.current = {};
    }
  };
  const goOlder = () => {
    if (canGoOlder) {
      const next = dates[currentIdx + 1];
      setSelectedDate(next);
      questionRefs.current = {};
      answerRefs.current = {};
    }
  };

  const hasData = data && data.some((d: any) => d.challenge && d.questions.length > 0);

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
          <ImageIcon className="w-4 h-4" style={{ color: BRAND_AQUA }} />
          <h1 className="text-base font-bold text-white">{presentation.displayName} Challenge Card Generator</h1>
          <Badge className="text-[10px] px-1.5 py-0 ml-0.5" style={{ background: BRAND + "22", color: BRAND_AQUA, border: "none" }}>
            Admin
          </Badge>

          {/* Date navigation */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={goOlder}
              disabled={!canGoOlder || datesLoading}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
              title="Previous set (older)"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white/70" />
            </button>
            {/* Date picker dropdown */}
            <div className="relative flex items-center" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}>
              <Calendar className="w-3 h-3 absolute left-2.5 pointer-events-none" style={{ color: BRAND_AQUA }} />
              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  questionRefs.current = {};
                  answerRefs.current = {};
                }}
                disabled={datesLoading}
                className="pl-7 pr-6 py-1 rounded-lg text-xs font-semibold bg-transparent appearance-none cursor-pointer outline-none"
                style={{ color: isToday ? BRAND_AQUA : "rgba(255,255,255,0.85)", minWidth: 110 }}
              >
                {dates.map((d) => (
                  <option key={d} value={d} style={{ background: "#0e1a24", color: "#fff" }}>
                    {formatDateLabel(d)}{d !== new Date().toISOString().slice(0, 10) ? ` (${d})` : ""}
                  </option>
                ))}
              </select>
              <ChevronRight className="w-3 h-3 absolute right-1.5 pointer-events-none rotate-90 text-white/40" />
            </div>
            <button
              onClick={goNewer}
              disabled={!canGoNewer || datesLoading}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
              title="Next set (newer)"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white/70" />
            </button>
          </div>

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
            <select value={cardTemplate} onChange={(event) => setCardTemplate(event.target.value as ChallengeCardTemplate)} className="rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs font-semibold text-white outline-none">
              <option value="classic" className="bg-[#0e1a24]">Classic challenge</option>
              <option value="clinical-white" className="bg-[#0e1a24]">Clinical White</option>
              <option value="clinical-aqua" className="bg-[#0e1a24]">Clinical Aqua</option>
              <option value="clinical-teal" className="bg-[#0e1a24]">Clinical Teal</option>
              <option value="clinical-dark" className="bg-[#0e1a24]">Clinical Dark</option>
            </select>
            {hasData && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleBatchDownload("questions")}
                  disabled={batchLoading !== null}
                  className="gap-1.5 text-white text-xs font-semibold"
                  style={{ background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
                >
                  {batchLoading === "questions" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                  All Questions
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleBatchDownload("answers")}
                  disabled={batchLoading !== null}
                  className="gap-1.5 text-white text-xs font-semibold"
                  style={{ background: "linear-gradient(90deg, #166534, #14532d)" }}
                >
                  {batchLoading === "answers" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
                  All Answers
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 text-white/60 border-white/20 hover:bg-white/10 text-xs"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <section className="mb-4 rounded-lg border border-white/10 bg-[#0e1a24] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-white/80">Platform export</h2>
              <p className="mt-1 text-[11px] text-white/45">PNG keeps every card fully visible. MP4 gives combined question-and-answer cards a three-second answer pause, then ends on a 10-second app website screen.</p>
            </div>
            <div className="min-w-[300px]"><SocialExportControls platform={exportPlatform} format={exportFormat} onPlatformChange={setExportPlatform} onFormatChange={setExportFormat} musicOptions={musicOptions} selectedMusic={selectedMusic} onMusicChange={setSelectedMusic} musicUploadBrand={presentation.brand} compact /></div>
          </div>
        </section>
        {/* Info bar */}
        <div
          className="rounded-lg p-3 mb-4 text-xs"
          style={{ background: BRAND + "14", border: `1px solid ${BRAND}2a` }}
        >
          <p className="text-white/60">
            {isToday
              ? <>Cards are generated from the <strong className="text-white">next queued challenge</strong> per category.</>
              : <>Showing cards for <strong className="text-white">{selectedDate}</strong> — use ‹ › to browse up to 30 days back.</>
            }{" "}
            Select Facebook, Instagram, LinkedIn, X, Reel, TikTok, YouTube Video, or YouTube Short export sizes above.
            Post the question card first, then the answer card 24 hours later.
            Use <strong className="text-white">All Questions</strong> or <strong className="text-white">All Answers</strong> to download a ZIP of all cards at once.
            Click <strong className="text-white">Copy</strong> on any social post to get a ready-to-paste caption with hashtags.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin" style={{ color: BRAND_AQUA }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{(error as any).message}</span>
          </div>
        )}

        {/* Cards */}
        {data && (
          <div className="space-y-4">
            {data.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm">
                {isToday
                  ? "No queued challenges found. Add challenges to the queue first."
                  : `No challenge cards found for ${formatDateLabel(selectedDate)} (${selectedDate}).`
                }
              </div>
            ) : (
              data.map((item: any) => (
                <CategorySection
                  key={item.category}
                  item={item}
                  theme={cardTheme}
                  date={selectedDate}
                  presentation={presentation}
                  template={cardTemplate}
                  exportPlatform={exportPlatform}
                  exportFormat={exportFormat}
                  musicUrl={selectedMusic?.url}
                  musicTitle={selectedMusic?.title}
                  onQuestionRef={(cat, h) => { questionRefs.current[cat] = h; }}
                  onAnswerRef={(cat, h) => { answerRefs.current[cat] = h; }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
