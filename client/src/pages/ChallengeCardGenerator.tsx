/*
 * ChallengeCardGenerator -- Admin Only
 * Generates branded 1080x1080 social media image cards for daily challenges.
 * Adapted from iHeartEcho for UltrasoundAssist™ (All About Ultrasound™)
 */
import { useRef, useCallback, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
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

// Brand palette
const BRAND = "#189aa1";
const BRAND_DARK = "#0d3d44";
const BRAND_AQUA = "#4ad9e0";
const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_icon_192_teal_f0c966ce.png";
const HERO_URL_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/daily-challenge-banner-v3_AAUS_ccb55bf0.webp";
const HERO_URL_LIGHT = HERO_URL_DARK;

// ---- Theme tokens -----------------------------------------------------------
type CardTheme = "dark" | "light";

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

// Required hashtags for all posts
const REQUIRED_HASHTAGS = [
  "#AllAboutUltrasound",
  "#UltrasoundAssist",
  "#Ultrasound",
  "#DailyChallenge",
  "#UltrasoundChallenge",
  "#Sonography",
  "#MedicalImaging",
  "#Sonographer",
  "#UltrasoundEducation",
];

// Category-specific hashtag map
const CATEGORY_HASHTAGS: Record<string, string[]> = {
  "Abdominal": ["#AbdominalUltrasound", "#AbdominalImaging", "#GIUltrasound"],
  "Vascular": ["#VascularUltrasound", "#VascularImaging", "#DuplexScan"],
  "OB 2nd/3rd Trimester": ["#ObstetricUltrasound", "#FetalImaging", "#OBUltrasound"],
  "OB 2nd/3rd": ["#ObstetricUltrasound", "#FetalImaging", "#OBUltrasound"],
  "POCUS": ["#POCUS", "#PointOfCareUltrasound", "#BedSideUltrasound"],
  "MSK": ["#MSKUltrasound", "#MusculoskeletalUltrasound", "#MSKImaging"],
  "Thyroid": ["#ThyroidUltrasound", "#ThyroidImaging", "#TIRADs"],
  "Breast": ["#BreastUltrasound", "#BreastImaging", "#BIRADs"],
  "Renal": ["#RenalUltrasound", "#KidneyUltrasound", "#RenalImaging"],
  "Fetal Echo": ["#FetalEcho", "#FetalCardiology", "#FetalUltrasound"],
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
): string {
  const cleanQ = stripHtml(questionText);
  const cleanA = answerText ? stripHtml(answerText) : null;
  const cleanE = explanationText ? stripHtml(explanationText) : null;
  const categoryTags = getCategoryHashtags(category);
  const allHashtags = [...REQUIRED_HASHTAGS, ...categoryTags].join(" ");

  if (type === "question") {
    return `🔬 Daily Ultrasound Challenge — ${category}

Can you answer today's question?

❓ ${cleanQ}

Drop your answer in the comments and take your place on the leaderboard 🏆 at app.allaboutultrasound.com
Answer revealed tomorrow. 👇

${allHashtags}`;
  } else {
    const answerLine = cleanA ? `✅ Answer: ${cleanA}` : "";
    const explanationLine = cleanE ? `\n💡 ${cleanE}` : "";
    return `🔬 Daily Ultrasound Challenge — ${category} | ANSWER

${answerLine}${explanationLine}

How did you do? Take your place on the leaderboard at app.allaboutultrasound.com and follow for a new ultrasound challenge every day!

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
  // Measure the actual rendered height so nothing is clipped
  const actualHeight = el.scrollHeight || 1080;
  return toPng(el, {
    cacheBust: true,
    pixelRatio: 1,
    width: 1080,
    height: actualHeight,
  });
}

// ---- shared card shell ------------------------------------------------------

function CardShell({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  const isLight = t === LIGHT_THEME;
  const heroUrl = isLight ? HERO_URL_LIGHT : HERO_URL_DARK;
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
      {/* Full-bleed background image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${heroUrl}")`,
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

// ---- card header ------------------------------------------------------------

function CardHeader({ pill, t }: { pill: "QUESTION" | "ANSWER"; t: ThemeTokens }) {
  const pillBg = pill === "QUESTION" ? t.qPillBg : t.aPillBg;
  const pillBorder = pill === "QUESTION" ? t.qPillBorder : t.aPillBorder;
  const pillColor = pill === "QUESTION" ? t.qPillColor : t.aPillColor;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 28,
      }}
    >
      {/* Logo + wordmark */}
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
          <img src={LOGO_URL} alt="All About Ultrasound" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span
              style={{
                color: t.headingColor,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}
            >
              All About Ultrasound™
            </span>
          </div>
          <div
            style={{
              color: BRAND,
              fontSize: 13,
              fontWeight: 600,
              marginTop: 4,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
            }}
          >
            Daily Ultrasound Challenge
          </div>
        </div>
      </div>

      {/* Type pill */}
      <div
        style={{
          background: pillBg,
          border: `1.5px solid ${pillBorder}`,
          borderRadius: 28,
          padding: "9px 22px",
          color: pillColor,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "2px",
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

function CardFooter({ right, t }: { right?: string; t: ThemeTokens }) {
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
        app.allaboutultrasound.com
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
}: {
  challengeTitle: string;
  questionText: string;
  options: string[];
  qid: string | null;
  t: ThemeTokens;
}) {
  const letters = ["A", "B", "C", "D", "E"];
  const cleanQ = stripHtml(questionText);

  return (
    <CardShell t={t}>
      <CardHeader pill="QUESTION" t={t} />

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
          fontSize: options.length > 0 ? 30 : 44,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
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
                padding: "12px 20px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 11,
                  flexShrink: 0,
                  background: i % 2 === 0 ? t.bubbleEvenBg : t.bubbleOddBg,
                  border: `2px solid ${i % 2 === 0 ? t.bubbleEvenBorder : t.bubbleOddBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: i % 2 === 0 ? t.bubbleEvenColor : t.bubbleOddColor,
                  fontWeight: 800,
                  fontSize: 20,
                  marginTop: 2,
                  boxShadow: i % 2 !== 0 ? `0 0 14px ${BRAND}44` : "none",
                }}
              >
                {letters[i]}
              </div>
              <span style={{ color: t.bodyColor, fontSize: 26, fontWeight: 500, lineHeight: 1.4 }}>
                {stripHtml(opt)}
              </span>
            </div>
          ))}
        </div>
      )}

      <CardFooter t={t} />
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
}: {
  challengeTitle: string;
  questionText: string;
  options: string[];
  correctAnswer: number | null;
  explanation: string | null;
  reviewAnswer: string | null;
  qid: string | null;
  t: ThemeTokens;
}) {
  const letters = ["A", "B", "C", "D", "E"];
  const answerText =
    options.length > 0 && correctAnswer != null
      ? `${letters[correctAnswer]}. ${stripHtml(options[correctAnswer] ?? "")}`
      : reviewAnswer
      ? stripHtml(reviewAnswer)
      : null;

  return (
    <CardShell t={t}>
      <CardHeader pill="ANSWER" t={t} />

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
        <RichHtml html={questionText} color={t.recapColor} fontSize={24} lineHeight={1.45} />
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
          <div style={{ color: t.answerTextColor, fontSize: 36, fontWeight: 700, lineHeight: 1.35 }}>
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
          <RichHtml html={explanation} color={t.explanationTextColor} fontSize={22} lineHeight={1.6} />
        </div>
      )}

      <CardFooter right="Follow for daily ultrasound challenges" t={t} />
    </CardShell>
  );
}

// ---- DownloadableCard wrapper -----------------------------------------------

interface DownloadableCardHandle {
  exportPng: () => Promise<string>;
}

const PREVIEW_SIZE = 700;
const SCALE = PREVIEW_SIZE / 1080;

function DownloadableCard({
  filename,
  children,
  onRef,
}: {
  filename: string;
  children: React.ReactNode;
  onRef?: (handle: DownloadableCardHandle) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const exportPng = useCallback(async (): Promise<string> => {
    if (!ref.current) throw new Error("Card not mounted");
    return renderCardToPng(ref.current);
  }, []);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      (ref as any).current = el;
      if (el && onRef) {
        onRef({ exportPng });
      }
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
          height: PREVIEW_SIZE,
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
            height: 1080,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <div ref={refCallback}>{children}</div>
        </div>
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
        Download PNG
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
}: {
  type: "question" | "answer";
  category: string;
  challengeTitle: string;
  questionText: string;
  answerText: string | null;
  explanationText: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const post = buildSocialPost(type, category, challengeTitle, questionText, answerText, explanationText);

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
}: {
  item: CategoryItem;
  onQuestionRef: (cat: string, h: DownloadableCardHandle) => void;
  onAnswerRef: (cat: string, h: DownloadableCardHandle) => void;
  theme: CardTheme;
  date: string;
}) {
  const t = theme === "dark" ? DARK_THEME : LIGHT_THEME;
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
              onRef={(h) => onQuestionRef(category, h)}
            >
              <QuestionCard
                challengeTitle={challenge.title}
                questionText={q.question}
                options={options}
                qid={q.qid}
                t={t}
              />
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
            >
              <AnswerCard
                challengeTitle={challenge.title}
                questionText={q.question}
                options={options}
                correctAnswer={q.correctAnswer}
                explanation={q.explanation}
                reviewAnswer={q.reviewAnswer}
                qid={q.qid}
                t={t}
              />
            </DownloadableCard>
          </div>
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
  // Normalise to a flat array of CategoryItem
  const data: any[] | undefined = useMemo(() => {
    if (isToday) return todayQuery.data as any[] | undefined;
    const d = dateQuery.data as { date: string; results: any[] } | undefined;
    return d?.results;
  }, [isToday, todayQuery.data, dateQuery.data]);

  const refetch = isToday ? todayQuery.refetch : dateQuery.refetch;

  const [cardTheme, setCardTheme] = useState<CardTheme>("dark");

  const questionRefs = useRef<Record<string, DownloadableCardHandle>>({});
  const answerRefs = useRef<Record<string, DownloadableCardHandle>>({});
  const [batchLoading, setBatchLoading] = useState<"questions" | "answers" | null>(null);

  const handleBatchDownload = useCallback(async (type: "questions" | "answers") => {
    setBatchLoading(type);
    const refs = type === "questions" ? questionRefs.current : answerRefs.current;
    const zip = new JSZip();
    const folder = zip.folder(type === "questions" ? "question-cards" : "answer-cards")!;
    try {
      await Promise.all(
        Object.entries(refs).map(async ([cat, handle]) => {
          const dataUrl = await handle.exportPng();
          const base64 = dataUrl.split(",")[1];
          folder.file(
            `${cat.replace(/\s+/g, "-")}-${type === "questions" ? "question" : "answer"}.png`,
            base64,
            { base64: true }
          );
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `ultrasoundassist-${type}-${selectedDate}.zip`);
    } catch (err) {
      console.error("Batch export failed:", err);
      toast.error("Batch export failed. Please try again.");
    } finally {
      setBatchLoading(null);
    }
  }, [selectedDate]);

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
          <Link href="/platform-admin">
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-white/50" />
            </button>
          </Link>
          <ImageIcon className="w-4 h-4" style={{ color: BRAND_AQUA }} />
          <h1 className="text-base font-bold text-white">Challenge Card Generator</h1>
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
            Each card is <strong className="text-white">1080×1080 px</strong> — ideal for Instagram, Facebook, and LinkedIn.
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
