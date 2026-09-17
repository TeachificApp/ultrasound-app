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

export interface ClinicalQuizCardProps {
  presentation: BrandToolPresentation;
  template: ClinicalQuizCardTemplate;
  question: string;
  options: string[];
  media: ClinicalCardMedia;
  label?: string;
  title?: string;
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
}: ClinicalQuizCardProps) {
  const theme = useMemo(() => getTemplate(template), [template]);
  const visibleOptions = options.slice(0, 4).map(stripHtml).filter(Boolean);
  const questionText = stripHtml(question);
  const hasMediaArea = media.kind !== "none";
  const questionFontSize = questionText.length > 150 ? 42 : questionText.length > 95 ? 50 : 59;

  return (
    <div
      data-social-quiz-card="true"
      style={{
        width: CARD_SIZE,
        minHeight: CARD_SIZE,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "62px 76px 48px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        background: theme.background,
        color: theme.text,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 26, minHeight: 118 }}>
        <img
          src={presentation.logoUrl}
          alt={presentation.displayName}
          crossOrigin="anonymous"
          style={{
            width: 116,
            height: 116,
            borderRadius: "50%",
            objectFit: "cover",
            background: "#ffffff",
            border: `3px solid ${theme.accent}`,
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ color: theme.text, fontSize: 22, fontWeight: 800, letterSpacing: 2.6, opacity: 0.78 }}>
            {label}
          </div>
          <div style={{ color: theme.text, fontSize: 30, fontWeight: 800, lineHeight: 1.15, marginTop: 5 }}>
            {presentation.displayName}
          </div>
        </div>
      </header>

      {title && (
        <div style={{ color: theme.text, fontSize: 20, fontWeight: 700, opacity: 0.72, marginTop: 18, letterSpacing: 0.7 }}>
          {title}
        </div>
      )}

      <div
        style={{
          color: theme.text,
          fontSize: questionFontSize,
          fontWeight: 800,
          lineHeight: 1.18,
          marginTop: title ? 12 : 24,
          minHeight: hasMediaArea ? 210 : 410,
          display: "flex",
          alignItems: hasMediaArea ? "flex-start" : "center",
        }}
      >
        {questionText}
      </div>

      {hasMediaArea && (
        <div
          style={{
            position: "absolute",
            left: CLINICAL_MEDIA_FRAME.x,
            top: CLINICAL_MEDIA_FRAME.y,
            width: CLINICAL_MEDIA_FRAME.width,
            height: CLINICAL_MEDIA_FRAME.height,
            background: "#080808",
            border: `${CLINICAL_MEDIA_FRAME.inset}px solid ${theme.accent}`,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {media.kind === "image" && (
            <img src={media.url} alt="Clinical reference" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          )}
          {media.kind === "video" && (
            <video src={media.url} muted controls preload="metadata" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
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
          position: hasMediaArea ? "absolute" : "relative",
          left: hasMediaArea ? 104 : undefined,
          right: hasMediaArea ? 104 : undefined,
          bottom: hasMediaArea ? 112 : undefined,
          display: "grid",
          gridTemplateColumns: visibleOptions.length > 2 ? "1fr 1fr" : "1fr",
          gap: "18px 68px",
          marginTop: hasMediaArea ? undefined : 22,
        }}
      >
        {visibleOptions.map((option, index) => (
          <div key={`${option}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 15, minWidth: 0 }}>
            <span style={{ color: theme.accent, fontSize: 31, fontWeight: 900, lineHeight: 1.2, flexShrink: 0 }}>{index + 1}.</span>
            <span style={{ color: theme.text, fontSize: 29, fontWeight: 800, lineHeight: 1.2 }}>{option}</span>
          </div>
        ))}
      </section>

      <footer
        style={{
          position: "absolute",
          bottom: 42,
          left: 74,
          right: 74,
          textAlign: "center",
          color: theme.accent,
          fontSize: 23,
          fontWeight: 800,
          letterSpacing: 0.4,
        }}
      >
        {presentation.appHost}
      </footer>
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
