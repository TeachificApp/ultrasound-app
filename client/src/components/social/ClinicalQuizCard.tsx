import { useMemo } from "react";
import { toPng } from "html-to-image";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import type { BrandToolPresentation } from "@/lib/brandToolPresentation";
import { useSocialCardFrame } from "@/components/social/SocialCardFrame";

export type ClinicalQuizCardTemplate = "clinical-white" | "clinical-aqua" | "clinical-teal" | "clinical-dark";
export type ClinicalCardMedia =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string }
  | { kind: "placeholder" }
  | { kind: "none" };

export const CLINICAL_QUIZ_CARD_TEMPLATES: Array<{
  id: ClinicalQuizCardTemplate;
  label: string;
  background: string;
  text: string;
  accent: string;
}> = [
  { id: "clinical-white", label: "Clinical White", background: "#ffffff", text: "#057e87", accent: "#16c9d1" },
  { id: "clinical-aqua", label: "Clinical Aqua", background: "#bdeff1", text: "#057e87", accent: "#16c9d1" },
  { id: "clinical-teal", label: "Clinical Teal", background: "#16c4cc", text: "#ffffff", accent: "#ffffff" },
  { id: "clinical-dark", label: "Clinical Dark", background: "#050505", text: "#c4f4f5", accent: "#16c9d1" },
];

const CARD_SIZE = 1080;
const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
export const CLINICAL_MEDIA_FRAME = { x: 112, y: 378, width: 856, height: 430, inset: 12 };

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getTemplate(template: ClinicalQuizCardTemplate) {
  return CLINICAL_QUIZ_CARD_TEMPLATES.find((item) => item.id === template) ?? CLINICAL_QUIZ_CARD_TEMPLATES[0];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getQuestionFit(question: string, options: string[], hasMedia: boolean) {
  const optionCharacters = options.reduce((total, option) => total + stripHtml(option).length, 0);
  const questionSize = clamp(59 - Math.floor(question.length / (hasMedia ? 18 : 19)), hasMedia ? 27 : 32, 59);
  const optionSize = clamp(29 - Math.floor(optionCharacters / (hasMedia ? 65 : 90)), hasMedia ? 15 : 17, 29);
  return {
    questionSize,
    optionSize,
    optionGap: optionSize <= 20 ? (hasMedia ? 7 : 10) : (hasMedia ? 10 : 18),
    optionNumberSize: clamp(optionSize + 2, hasMedia ? 16 : 19, 31),
  };
}

function getAnswerFit(question: string, answer: string | null, explanation: string | null) {
  const answerLength = answer?.length ?? 0;
  const explanationLength = explanation ? stripHtml(explanation).length : 0;
  return {
    recapSize: clamp(28 - Math.floor(question.length / 52), 16, 28),
    answerSize: clamp(42 - Math.floor(answerLength / 38), 20, 42),
    explanationSize: clamp(24 - Math.floor(explanationLength / 180), 14, 24),
    sectionPadding: explanationLength > 520 ? 18 : 28,
  };
}

export interface ClinicalQuizCardProps {
  presentation: BrandToolPresentation;
  template: ClinicalQuizCardTemplate;
  question: string;
  options: string[];
  media: ClinicalCardMedia;
  label?: string;
  title?: string;
  footerHost?: string;
  answerContextLabel?: string;
  answerFooterMessage?: string;
  variant?: "question" | "answer";
  correctAnswer?: string | null;
  explanation?: string | null;
}

/** A square social-card layout based on the supplied clinical quiz references. */
export function ClinicalQuizCard({
  presentation,
  template,
  question,
  options,
  media,
  label = "CLINICAL QUIZ",
  title,
  footerHost,
  answerContextLabel,
  answerFooterMessage,
  variant = "question",
  correctAnswer,
  explanation,
}: ClinicalQuizCardProps) {
  const frame = useSocialCardFrame();
  if (variant === "answer") {
    return (
      <ClinicalQuizAnswerCard
        presentation={presentation}
        template={template}
        question={question}
        correctAnswer={correctAnswer ?? null}
        explanation={explanation ?? null}
        title={title}
        footerHost={footerHost}
        answerContextLabel={answerContextLabel}
        answerFooterMessage={answerFooterMessage}
      />
    );
  }
  const theme = useMemo(() => getTemplate(template), [template]);
  const visibleOptions = options.slice(0, 4).map(stripHtml).filter(Boolean);
  const questionText = stripHtml(question);
  const hasMediaArea = media.kind !== "none";
  const fit = getQuestionFit(questionText, visibleOptions, hasMediaArea);
  const density = frame.contentScale;
  const px = (value: number) => Math.max(1, Math.round(value * density));

  return (
    <div
      data-social-quiz-card="true"
      style={{
        width: frame.width,
        height: frame.height,
        minHeight: frame.height,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: hasMediaArea ? `${px(46)}px ${px(76)}px ${px(48)}px` : `${px(62)}px ${px(76)}px ${px(48)}px`,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        background: theme.background,
        color: theme.text,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: px(hasMediaArea ? 20 : 26), minHeight: px(hasMediaArea ? 88 : 118) }}>
        <img
          src={presentation.logoUrl}
          alt={presentation.displayName}
          crossOrigin="anonymous"
          style={{
            width: px(hasMediaArea ? 86 : 116),
            height: px(hasMediaArea ? 86 : 116),
            borderRadius: px(58),
            objectFit: "cover",
            background: "#ffffff",
            border: `${px(3)}px solid ${theme.accent}`,
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ color: theme.text, fontSize: px(hasMediaArea ? 17 : 22), fontWeight: 800, letterSpacing: px(hasMediaArea ? 2 : 2.6), opacity: 0.78 }}>
            {label}
          </div>
          <div style={{ color: theme.text, fontSize: px(hasMediaArea ? 25 : 30), fontWeight: 800, lineHeight: 1.15, marginTop: px(5) }}>
            {presentation.displayName}
          </div>
        </div>
      </header>

      {title && (
        <div style={{ color: theme.text, fontSize: px(20), fontWeight: 700, opacity: 0.72, marginTop: px(18), letterSpacing: px(0.7) }}>
          {title}
        </div>
      )}

      <div
        style={{
          color: theme.text,
          fontSize: px(fit.questionSize),
          fontWeight: 800,
          lineHeight: 1.18,
          marginTop: px(title ? 10 : (hasMediaArea ? 16 : 24)),
          minHeight: hasMediaArea ? 0 : px(frame.layout === "vertical" ? 490 : frame.layout === "portrait" ? 450 : 410),
          display: "flex",
          alignItems: hasMediaArea ? "flex-start" : "center",
        }}
      >
        {questionText}
      </div>

      {hasMediaArea && (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: px(frame.layout === "vertical" ? 340 : frame.layout === "portrait" ? 302 : 264),
            marginTop: px(16),
            marginBottom: px(14),
            background: "#080808",
            border: `${px(8)}px solid ${theme.accent}`,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {media.kind === "image" && (
            <img src={media.url} alt="Clinical reference" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
          )}
          {media.kind === "video" && (
            <video src={media.url} muted controls preload="metadata" playsInline style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", background: "#000" }} />
          )}
          {media.kind === "placeholder" && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.64)", fontSize: 22, fontWeight: 700, letterSpacing: 1.2 }}>
              CLINICAL VIDEO
            </div>
          )}
        </div>
      )}

      <section
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: px(fit.optionGap),
          marginTop: hasMediaArea ? 0 : px(22),
          paddingBottom: hasMediaArea ? px(54) : 0,
        }}
      >
        {visibleOptions.map((option, index) => (
          <div key={`${index}-${option}`} style={{ display: "flex", gap: px(hasMediaArea ? 12 : 16), alignItems: "center", minWidth: 0, border: `${px(2)}px solid ${theme.accent}66`, borderRadius: px(12), padding: `${px(hasMediaArea ? Math.max(7, fit.optionGap) : Math.max(10, fit.optionGap))}px ${px(hasMediaArea ? 13 : 16)}px`, background: `${theme.accent}0d` }}>
            <span style={{ display: "inline-flex", width: px(Math.max(hasMediaArea ? 29 : 34, fit.optionNumberSize + (hasMediaArea ? 8 : 10))), height: px(Math.max(hasMediaArea ? 29 : 34, fit.optionNumberSize + (hasMediaArea ? 8 : 10))), alignItems: "center", justifyContent: "center", borderRadius: px(8), background: theme.accent, color: theme.background, fontSize: px(fit.optionNumberSize), fontWeight: 900, lineHeight: 1, flexShrink: 0 }}>{OPTION_LETTERS[index] ?? `${index + 1}`}</span>
            <span style={{ color: theme.text, fontSize: px(fit.optionSize), fontWeight: 800, lineHeight: 1.2 }}>{option}</span>
          </div>
        ))}
      </section>

      <footer
        style={{
          position: "absolute",
          bottom: px(42),
          left: px(74),
          right: px(74),
          textAlign: "center",
          color: theme.accent,
          fontSize: px(23),
          fontWeight: 800,
          letterSpacing: 0.4,
        }}
      >
        {footerHost ?? presentation.appHost}
      </footer>
    </div>
  );
}

function ClinicalQuizAnswerCard({
  presentation,
  template,
  question,
  correctAnswer,
  explanation,
  title,
  footerHost,
  answerContextLabel = "DAILY CLINICAL CHALLENGE",
  answerFooterMessage = "Follow for daily clinical challenges",
}: Pick<ClinicalQuizCardProps, "presentation" | "template" | "question" | "correctAnswer" | "explanation" | "title" | "footerHost" | "answerContextLabel" | "answerFooterMessage">) {
  const theme = useMemo(() => getTemplate(template), [template]);
  const frame = useSocialCardFrame();
  const questionText = stripHtml(question);
  const answerText = correctAnswer ? stripHtml(correctAnswer) : "Answer available in the accompanying explanation.";
  const fit = getAnswerFit(questionText, answerText, explanation);
  const density = frame.contentScale;
  const px = (value: number) => Math.max(1, Math.round(value * density));

  return (
    <div
      data-social-quiz-card="true"
      style={{
        width: frame.width,
        height: frame.height,
        minHeight: frame.height,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: `${px(50)}px ${px(66)}px ${px(44)}px`,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        background: theme.background,
        color: theme.text,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: px(20), minHeight: px(76) }}>
        <div style={{ display: "flex", alignItems: "center", gap: px(18), minWidth: 0 }}>
        <img
          src={presentation.logoUrl}
          alt={presentation.displayName}
          crossOrigin="anonymous"
          style={{ width: px(64), height: px(64), borderRadius: "50%", objectFit: "cover", background: "#ffffff", border: `${px(2)}px solid ${theme.accent}`, flexShrink: 0 }}
        />
        <div>
          <div style={{ color: theme.text, fontSize: px(23), fontWeight: 900, lineHeight: 1.1 }}>{presentation.displayName}</div>
          <div style={{ color: theme.text, fontSize: px(12), fontWeight: 800, letterSpacing: px(1.8), opacity: 0.68, marginTop: px(5) }}>{answerContextLabel}</div>
        </div>
        </div>
        <div style={{ color: theme.accent, border: `${px(2)}px solid ${theme.accent}`, borderRadius: 999, padding: `${px(8)}px ${px(18)}px`, fontSize: px(14), fontWeight: 900, letterSpacing: px(1.4), flexShrink: 0 }}>ANSWER</div>
      </header>

      {title && <div style={{ color: theme.text, fontSize: px(15), fontWeight: 800, opacity: 0.7, marginTop: px(16), letterSpacing: px(0.8), textTransform: "uppercase" }}>{title}</div>}

      <div style={{ width: px(58), height: px(4), background: theme.accent, borderRadius: 999, marginTop: px(title ? 13 : 20) }} />

      <section style={{ marginTop: px(16), borderLeft: `${px(5)}px solid ${theme.accent}`, paddingLeft: px(18) }}>
        <div style={{ color: theme.text, fontSize: px(fit.recapSize), fontWeight: 700, lineHeight: 1.25, opacity: 0.82 }}>{questionText}</div>
      </section>

      <section style={{ marginTop: px(22), border: `${px(3)}px solid ${theme.accent}`, borderRadius: px(15), padding: `${px(fit.sectionPadding)}px ${px(24)}px`, background: `${theme.accent}16` }}>
        <div style={{ color: theme.accent, fontSize: px(14), fontWeight: 900, letterSpacing: px(1.8) }}>CORRECT ANSWER</div>
        <div style={{ color: theme.text, fontSize: px(fit.answerSize), fontWeight: 900, lineHeight: 1.16, marginTop: px(10) }}>{answerText}</div>
      </section>

      {explanation && (
        <section style={{ marginTop: px(17), border: `${px(1)}px solid ${theme.accent}88`, borderRadius: px(13), padding: `${px(fit.sectionPadding)}px ${px(22)}px`, background: `${theme.accent}0b` }}>
          <div style={{ color: theme.accent, fontSize: px(13), fontWeight: 900, letterSpacing: px(1.7) }}>EXPLANATION</div>
          <div style={{ color: theme.text, fontSize: px(fit.explanationSize), fontWeight: 650, lineHeight: 1.34, marginTop: px(8) }}>{stripHtml(explanation)}</div>
        </section>
      )}

      <footer style={{ position: "absolute", bottom: px(34), left: px(66), right: px(66), display: "flex", justifyContent: "space-between", color: theme.accent, fontSize: px(13), fontWeight: 800, letterSpacing: px(0.4) }}><span>{footerHost ?? presentation.appHost}</span><span>{answerFooterMessage}</span></footer>
    </div>
  );
}

export async function renderClinicalQuizCardToPng(element: HTMLElement): Promise<string> {
  return toPng(element, {
    cacheBust: true,
    pixelRatio: 1,
    width: CARD_SIZE,
    height: CARD_SIZE,
  });
}

/**
 * Creates an MP4 overlay export for a selected clinical video. The conversion runs
 * entirely in the administrator's browser and leaves source Question Bank/media
 * records untouched.
 */
export async function exportClinicalVideoCardAsMp4({
  videoUrl,
  baseCardElement,
  fileName,
}: {
  videoUrl: string;
  baseCardElement: HTMLElement;
  fileName: string;
}): Promise<void> {
  const [videoResponse, cardDataUrl] = await Promise.all([
    fetch(videoUrl, { credentials: "include" }),
    renderClinicalQuizCardToPng(baseCardElement),
  ]);
  if (!videoResponse.ok) throw new Error("The selected video could not be read for MP4 export.");

  const [videoBlob, cardBlob] = await Promise.all([
    videoResponse.blob(),
    fetch(cardDataUrl).then((response) => response.blob()),
  ]);
  const cardBitmap = await createImageBitmap(cardBlob);
  const canvas = new OffscreenCanvas(CARD_SIZE, CARD_SIZE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser does not support canvas video export.");

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(videoBlob) });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      process: (sample: any) => {
        context.clearRect(0, 0, CARD_SIZE, CARD_SIZE);
        context.drawImage(cardBitmap, 0, 0, CARD_SIZE, CARD_SIZE);
        const inset = CLINICAL_MEDIA_FRAME.inset;
        const frame = {
          x: CLINICAL_MEDIA_FRAME.x + inset,
          y: CLINICAL_MEDIA_FRAME.y + inset,
          width: CLINICAL_MEDIA_FRAME.width - inset * 2,
          height: CLINICAL_MEDIA_FRAME.height - inset * 2,
        };
        const sourceWidth = Number(sample.displayWidth ?? frame.width);
        const sourceHeight = Number(sample.displayHeight ?? frame.height);
        const scale = Math.min(frame.width / sourceWidth, frame.height / sourceHeight);
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const x = frame.x + Math.round((frame.width - width) / 2);
        const y = frame.y + Math.round((frame.height - height) / 2);
        sample.draw(context, x, y, width, height);
        return canvas;
      },
    },
  });
  if (!conversion.isValid) {
    cardBitmap.close();
    throw new Error("This browser could not convert the selected video to MP4.");
  }
  try {
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("MP4 export did not produce a file.");
    const blob = new Blob([buffer], { type: "video/mp4" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2_000);
  } finally {
    cardBitmap.close();
  }
}
