import { useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from "mediabunny";
import { Headphones, Loader2, Search, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { uploadFileToMediaRepository } from "@/lib/mediaRepoUpload";
import {
  DEFAULT_SOCIAL_EXPORT_PLATFORM,
  getSocialExportPreset,
  socialExportFilename,
  SOCIAL_EXPORT_PRESETS,
  type SocialExportFormat,
  type SocialExportPlatform,
} from "@/lib/socialCardExportPresets";

export type CardMotion = {
  kind: "question" | "answer" | "combined" | "social";
  title: string;
  options?: string[];
  answer?: string | null;
  detail?: string | null;
  brandName?: string;
  accentColor?: string;
  logoUrl?: string;
  /** Website shown on the final brand screen; cards choose their approved destination. */
  outroHost?: string;
  musicUrl?: string | null;
  musicTitle?: string | null;
};

type SocialCardExportOptions = {
  cardElement: HTMLElement;
  platform: SocialExportPlatform;
  format: SocialExportFormat;
  filenameStem: string;
  motion: CardMotion;
};

type RenderedCard = {
  image: ImageBitmap;
  width: number;
  height: number;
};

const SOURCE_WIDTH = 1080;
const FRAME_RATE = 12;
const OUTRO_HOLD_SECONDS = 10;
const MOTION_DURATION_SECONDS = 20;
const OUTRO_START_SECONDS = MOTION_DURATION_SECONDS - OUTRO_HOLD_SECONDS;
// The fourth combined-question option completes at 4.11 seconds. The answer
// deliberately waits three full seconds so viewers can consider every option.
const COMBINED_ANSWER_REVEAL_SECONDS = 7.11;
const FALLBACK_BACKGROUND = "#071318";

export type SocialMusicOption = {
  id: string;
  title: string;
  url: string;
  source: "media_repository" | "openverse";
  creator?: string;
  attribution?: string;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string | null;
};

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function easeOutBack(progress: number): number {
  const x = clamp(progress, 0, 1) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
}

function easeOut(progress: number): number {
  const x = clamp(progress, 0, 1);
  return 1 - (1 - x) ** 3;
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, "")}…`;
  }
  return lines;
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapCanvasText(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

async function cardToBitmap(cardElement: HTMLElement): Promise<RenderedCard> {
  const { toPng } = await import("html-to-image");
  await document.fonts?.ready;
  const width = Math.max(1, cardElement.scrollWidth || cardElement.clientWidth || SOURCE_WIDTH);
  const height = Math.max(1, cardElement.scrollHeight || cardElement.clientHeight || SOURCE_WIDTH);
  const dataUrl = await toPng(cardElement, {
    cacheBust: true,
    pixelRatio: 1,
    width,
    height,
  });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return { image: await createImageBitmap(blob), width, height };
}

function getCardPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  const maxWidth = targetWidth * 0.92;
  const maxHeight = targetHeight * 0.88;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    x: Math.round((targetWidth - width) / 2),
    y: Math.round((targetHeight - height) / 2),
    width,
    height,
  };
}

function drawExportFrame(
  context: CanvasRenderingContext2D,
  card: RenderedCard,
  targetWidth: number,
  targetHeight: number,
  overlayAlpha = 0,
) {
  const background = context.createLinearGradient(0, 0, targetWidth, targetHeight);
  background.addColorStop(0, "#06141c");
  background.addColorStop(0.48, "#0d3d44");
  background.addColorStop(1, FALLBACK_BACKGROUND);
  context.fillStyle = background;
  context.fillRect(0, 0, targetWidth, targetHeight);

  const placement = getCardPlacement(card.width, card.height, targetWidth, targetHeight);
  context.save();
  context.shadowColor = "rgba(0,0,0,0.42)";
  context.shadowBlur = Math.max(18, Math.round(targetWidth * 0.024));
  context.shadowOffsetY = Math.max(8, Math.round(targetHeight * 0.012));
  drawRoundedRect(context, placement.x, placement.y, placement.width, placement.height, Math.max(12, Math.round(placement.width * 0.018)));
  context.clip();
  context.drawImage(card.image, placement.x, placement.y, placement.width, placement.height);
  context.restore();

  if (overlayAlpha > 0) {
    context.fillStyle = `rgba(2, 11, 16, ${clamp(overlayAlpha, 0, 0.92)})`;
    context.fillRect(0, 0, targetWidth, targetHeight);
  }
}

function drawMotionPanel(
  context: CanvasRenderingContext2D,
  motion: CardMotion,
  elapsed: number,
  targetWidth: number,
  targetHeight: number,
) {
  const accent = motion.accentColor ?? "#4ad9e0";
  const isVertical = targetHeight / targetWidth > 1.2;
  const panelWidth = Math.round(targetWidth * (isVertical ? 0.87 : 0.64));
  const panelX = Math.round((targetWidth - panelWidth) / 2);
  const panelTop = Math.round(targetHeight * (isVertical ? 0.18 : 0.16));
  const panelBottom = Math.round(targetHeight * (isVertical ? 0.16 : 0.14));
  const panelHeight = targetHeight - panelTop - panelBottom;
  const scaled = targetWidth / 1080;
  const labelFont = Math.max(15, Math.round(18 * scaled));
  const titleFont = Math.max(28, Math.round(48 * scaled));
  const optionFont = Math.max(18, Math.round(25 * scaled));
  const padding = Math.max(24, Math.round(38 * scaled));

  const panelProgress = easeOut((elapsed - 0.15) / 0.55);
  context.save();
  context.globalAlpha = panelProgress;
  const translatedY = (1 - panelProgress) * Math.round(targetHeight * 0.04);
  const panelGradient = context.createLinearGradient(panelX, panelTop, panelX + panelWidth, panelTop + panelHeight);
  panelGradient.addColorStop(0, "rgba(6, 24, 33, 0.97)");
  panelGradient.addColorStop(1, "rgba(8, 52, 59, 0.95)");
  context.fillStyle = panelGradient;
  drawRoundedRect(context, panelX, panelTop + translatedY, panelWidth, panelHeight, Math.max(18, Math.round(28 * scaled)));
  context.fill();
  context.strokeStyle = `${accent}bb`;
  context.lineWidth = Math.max(2, Math.round(3 * scaled));
  context.stroke();
  context.restore();

  if (panelProgress < 0.01) return;
  const x = panelX + padding;
  const contentWidth = panelWidth - padding * 2;
  let y = panelTop + translatedY + padding + labelFont;

  context.save();
  context.globalAlpha = panelProgress;
  context.fillStyle = accent;
  context.font = `800 ${labelFont}px "Segoe UI", Arial, sans-serif`;
  const motionLabel = motion.kind === "answer" ? "ANSWER REVEAL" : motion.kind === "question" || motion.kind === "combined" ? "CLINICAL QUESTION" : "CLINICAL INSIGHT";
  context.fillText(motionLabel, x, y);
  y += labelFont * 1.7;

  const titleProgress = easeOutBack((elapsed - 0.65) / 0.55);
  if (titleProgress > 0) {
    context.save();
    context.globalAlpha = clamp(titleProgress, 0, 1);
    context.translate(0, (1 - clamp(titleProgress, 0, 1)) * 36 * scaled);
    context.fillStyle = "#ffffff";
    context.font = `800 ${titleFont}px "Segoe UI", Arial, sans-serif`;
    const titleHeight = drawWrappedText(context, motion.title, x, y, contentWidth, titleFont * 1.14, motion.kind === "social" ? 4 : 3);
    context.restore();
    y += titleHeight + Math.max(20, Math.round(26 * scaled));
  }

  if ((motion.kind === "question" || motion.kind === "combined") && motion.options?.length) {
    const optionTop = y;
    const itemHeight = Math.max(54, Math.round(62 * scaled));
    const itemGap = Math.max(11, Math.round(13 * scaled));
    motion.options.slice(0, 4).forEach((option, index) => {
      const start = 1.65 + index * 0.68;
      const progress = easeOutBack((elapsed - start) / 0.42);
      if (progress <= 0) return;
      const itemY = optionTop + index * (itemHeight + itemGap);
      const visibleProgress = clamp(progress, 0, 1);
      context.save();
      context.globalAlpha = visibleProgress;
      context.translate(0, (1 - visibleProgress) * 30 * scaled);
      context.fillStyle = "rgba(255,255,255,0.085)";
      drawRoundedRect(context, x, itemY, contentWidth, itemHeight, Math.max(10, Math.round(12 * scaled)));
      context.fill();
      context.strokeStyle = `${accent}99`;
      context.lineWidth = Math.max(1, Math.round(1.5 * scaled));
      context.stroke();
      context.fillStyle = accent;
      context.font = `900 ${Math.max(17, Math.round(21 * scaled))}px "Segoe UI", Arial, sans-serif`;
      context.fillText(String.fromCharCode(65 + index), x + Math.round(18 * scaled), itemY + itemHeight / 2 + Math.round(7 * scaled));
      context.fillStyle = "#ffffff";
      context.font = `700 ${optionFont}px "Segoe UI", Arial, sans-serif`;
      const optionLines = wrapCanvasText(context, option, contentWidth - Math.round(70 * scaled), 2);
      context.fillText(optionLines[0] ?? "", x + Math.round(54 * scaled), itemY + itemHeight / 2 + Math.round(7 * scaled));
      context.restore();
    });
  }

  if (motion.kind === "answer") {
    const answerLetter = motion.answer?.match(/^\s*([A-E])[.)]/i)?.[1]?.toUpperCase() ?? "A";
    const answerIndex = Math.max(0, answerLetter.charCodeAt(0) - 65);
    const optionTop = y;
    const itemHeight = Math.max(46, Math.round(52 * scaled));
    const itemGap = Math.max(8, Math.round(10 * scaled));
    motion.options?.slice(0, 4).forEach((option, index) => {
      const start = 1.65 + index * 0.36;
      const progress = easeOutBack((elapsed - start) / 0.34);
      if (progress <= 0) return;
      const itemY = optionTop + index * (itemHeight + itemGap);
      const visibleProgress = clamp(progress, 0, 1);
      const isCorrectChoice = index === answerIndex;
      context.save();
      context.globalAlpha = visibleProgress;
      context.translate(0, (1 - visibleProgress) * 24 * scaled);
      context.fillStyle = isCorrectChoice ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.075)";
      drawRoundedRect(context, x, itemY, contentWidth, itemHeight, Math.max(8, Math.round(10 * scaled)));
      context.fill();
      context.strokeStyle = isCorrectChoice ? "rgba(74,222,128,0.92)" : `${accent}70`;
      context.lineWidth = Math.max(1, Math.round(1.5 * scaled));
      context.stroke();
      context.fillStyle = isCorrectChoice ? "#86efac" : accent;
      context.font = `900 ${Math.max(15, Math.round(18 * scaled))}px "Segoe UI", Arial, sans-serif`;
      context.fillText(String.fromCharCode(65 + index), x + Math.round(17 * scaled), itemY + itemHeight / 2 + Math.round(6 * scaled));
      context.fillStyle = "#ffffff";
      context.font = `700 ${Math.max(16, Math.round(20 * scaled))}px "Segoe UI", Arial, sans-serif`;
      context.fillText(wrapCanvasText(context, option, contentWidth - Math.round(64 * scaled), 1)[0] ?? "", x + Math.round(49 * scaled), itemY + itemHeight / 2 + Math.round(6 * scaled));
      context.restore();
    });

    const answerProgress = easeOutBack((elapsed - 4.5) / 0.5);
    if (answerProgress > 0 && motion.answer) {
      const visibleProgress = clamp(answerProgress, 0, 1);
      const answerHeight = Math.max(92, Math.round(122 * scaled));
      const answerY = optionTop + 4 * (itemHeight + itemGap);
      context.save();
      context.globalAlpha = visibleProgress;
      context.translate(0, (1 - visibleProgress) * 40 * scaled);
      context.fillStyle = "rgba(34,197,94,0.19)";
      drawRoundedRect(context, x, answerY, contentWidth, answerHeight, Math.max(12, Math.round(15 * scaled)));
      context.fill();
      context.strokeStyle = "rgba(74,222,128,0.95)";
      context.lineWidth = Math.max(2, Math.round(3 * scaled));
      context.stroke();
      context.fillStyle = "#86efac";
      context.font = `900 ${labelFont}px "Segoe UI", Arial, sans-serif`;
      context.fillText("CORRECT ANSWER", x + Math.round(20 * scaled), answerY + Math.round(27 * scaled));
      context.fillStyle = "#ffffff";
      context.font = `800 ${Math.max(optionFont, Math.round(30 * scaled))}px "Segoe UI", Arial, sans-serif`;
      drawWrappedText(context, motion.answer, x + Math.round(20 * scaled), answerY + Math.round(65 * scaled), contentWidth - Math.round(40 * scaled), Math.max(optionFont, Math.round(30 * scaled)) * 1.12, 2);
      context.restore();
    }
  }

  if (motion.kind === "combined" && motion.answer) {
    const answerProgress = easeOutBack((elapsed - COMBINED_ANSWER_REVEAL_SECONDS) / 0.48);
    if (answerProgress > 0) {
      const visibleProgress = clamp(answerProgress, 0, 1);
      const answerHeight = Math.max(92, Math.round(122 * scaled));
      const answerY = panelTop + panelHeight - padding - answerHeight;
      context.save();
      context.globalAlpha = visibleProgress;
      context.translate(0, (1 - visibleProgress) * 40 * scaled);
      context.fillStyle = "rgba(34,197,94,0.19)";
      drawRoundedRect(context, x, answerY, contentWidth, answerHeight, Math.max(12, Math.round(15 * scaled)));
      context.fill();
      context.strokeStyle = "rgba(74,222,128,0.95)";
      context.lineWidth = Math.max(2, Math.round(3 * scaled));
      context.stroke();
      context.fillStyle = "#86efac";
      context.font = `900 ${labelFont}px "Segoe UI", Arial, sans-serif`;
      context.fillText("CORRECT ANSWER", x + Math.round(20 * scaled), answerY + Math.round(27 * scaled));
      context.fillStyle = "#ffffff";
      context.font = `800 ${Math.max(optionFont, Math.round(30 * scaled))}px "Segoe UI", Arial, sans-serif`;
      drawWrappedText(context, motion.answer, x + Math.round(20 * scaled), answerY + Math.round(65 * scaled), contentWidth - Math.round(40 * scaled), Math.max(optionFont, Math.round(30 * scaled)) * 1.12, 2);
      context.restore();
    }
  }

  if (motion.kind === "social" && motion.detail) {
    const detailProgress = easeOutBack((elapsed - 1.85) / 0.55);
    if (detailProgress > 0) {
      const visibleProgress = clamp(detailProgress, 0, 1);
      context.save();
      context.globalAlpha = visibleProgress;
      context.translate(0, (1 - visibleProgress) * 28 * scaled);
      context.fillStyle = "rgba(255,255,255,0.08)";
      drawRoundedRect(context, x, y, contentWidth, Math.max(120, Math.round(152 * scaled)), Math.max(12, Math.round(14 * scaled)));
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.88)";
      context.font = `600 ${optionFont}px "Segoe UI", Arial, sans-serif`;
      drawWrappedText(context, motion.detail, x + Math.round(20 * scaled), y + Math.round(31 * scaled), contentWidth - Math.round(40 * scaled), optionFont * 1.35, 4);
      context.restore();
    }
  }

  context.restore();
}

function drawMotionFrame(
  context: CanvasRenderingContext2D,
  card: RenderedCard,
  motion: CardMotion,
  elapsed: number,
  targetWidth: number,
  targetHeight: number,
  logo?: HTMLImageElement | null,
) {
  const outroProgress = clamp((elapsed - OUTRO_START_SECONDS) / 0.6, 0, 1);
  drawExportFrame(context, card, targetWidth, targetHeight, 0.86 * (1 - outroProgress));
  if (outroProgress < 1) {
    drawMotionPanel(context, motion, elapsed, targetWidth, targetHeight);
    return;
  }

  const background = context.createLinearGradient(0, 0, targetWidth, targetHeight);
  background.addColorStop(0, "#06141c");
  background.addColorStop(1, "#0b6670");
  context.fillStyle = background;
  context.fillRect(0, 0, targetWidth, targetHeight);
  const scale = targetWidth / 1080;
  const centerX = targetWidth / 2;
  const logoSize = Math.min(targetWidth * 0.34, targetHeight * 0.27);
  if (logo) {
    const sourceWidth = logo.naturalWidth || logo.width || logoSize;
    const sourceHeight = logo.naturalHeight || logo.height || logoSize;
    const aspectRatio = sourceWidth / sourceHeight;
    const width = aspectRatio >= 1 ? logoSize : logoSize * aspectRatio;
    const height = aspectRatio >= 1 ? logoSize / aspectRatio : logoSize;
    context.drawImage(logo, centerX - width / 2, targetHeight * 0.31 - height / 2, width, height);
  }
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.font = `800 ${Math.max(28, Math.round(44 * scale))}px "Segoe UI", Arial, sans-serif`;
  context.fillText(motion.brandName ?? "Clinical education", centerX, targetHeight * 0.59);
  context.fillStyle = motion.accentColor ?? "#4ad9e0";
  context.font = `700 ${Math.max(16, Math.round(22 * scale))}px "Segoe UI", Arial, sans-serif`;
  context.fillText(motion.outroHost ?? "Follow for clinical learning", centerX, targetHeight * 0.65);
  context.textAlign = "start";
}

async function loadMotionLogo(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function addMusicTrack(output: Output, musicUrl: string | null | undefined): Promise<{ source: AudioBufferSource; buffer: AudioBuffer } | null> {
  if (!musicUrl) return null;
  try {
    const response = await fetch(musicUrl, { mode: "cors" });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const audioContext = new AudioContextCtor();
    const decoded = await audioContext.decodeAudioData(bytes.slice(0));
    const frames = Math.min(decoded.length, Math.floor(decoded.sampleRate * MOTION_DURATION_SECONDS));
    const clip = audioContext.createBuffer(decoded.numberOfChannels, frames, decoded.sampleRate);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      clip.copyToChannel(decoded.getChannelData(channel).slice(0, frames), channel);
    }
    const source = new AudioBufferSource({ codec: "aac", quality: new Quality("medium") });
    output.addAudioTrack(source);
    return { source, buffer: clip };
  } catch {
    return null;
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type));
  if (!blob) throw new Error("The browser could not create the export file.");
  return blob;
}

export async function renderSocialCardAsPng(cardElement: HTMLElement, platform: SocialExportPlatform): Promise<Blob> {
  const preset = getSocialExportPreset(platform);
  const card = await cardToBitmap(cardElement);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas exports are not supported in this browser.");
    drawExportFrame(context, card, preset.width, preset.height);
    return await canvasToBlob(canvas, "image/png");
  } finally {
    card.image.close();
  }
}

export async function renderSocialCardAsMp4(
  cardElement: HTMLElement,
  platform: SocialExportPlatform,
  motion: CardMotion,
): Promise<Blob> {
  if (!("VideoEncoder" in window)) {
    throw new Error("MP4 export needs a current Chromium-based browser with hardware video encoding.");
  }
  const preset = getSocialExportPreset(platform);
  const card = await cardToBitmap(cardElement);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas video export is not supported in this browser.");

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const source = new CanvasSource(canvas, { codec: "avc", bitrate: new Quality("high") });
    output.addVideoTrack(source);
    const [logo, music] = await Promise.all([
      loadMotionLogo(motion.logoUrl),
      addMusicTrack(output, motion.musicUrl),
    ]);
    await output.start();
    try {
      const frames = MOTION_DURATION_SECONDS * FRAME_RATE;
      for (let frame = 0; frame < frames; frame += 1) {
        const elapsed = frame / FRAME_RATE;
        drawMotionFrame(context, card, motion, elapsed, preset.width, preset.height, logo);
        await source.add(elapsed, 1 / FRAME_RATE);
      }
      if (music) await music.source.add(music.buffer);
      await output.finalize();
      const buffer = output.target.buffer;
      if (!buffer) throw new Error("MP4 export did not produce a file.");
      return new Blob([buffer], { type: "video/mp4" });
    } catch (error) {
      await output.cancel().catch(() => undefined);
      throw error;
    }
  } finally {
    card.image.close();
  }
}

export async function renderSocialCard({
  cardElement,
  platform,
  format,
  motion,
}: Omit<SocialCardExportOptions, "filenameStem">): Promise<Blob> {
  return format === "png"
    ? renderSocialCardAsPng(cardElement, platform)
    : renderSocialCardAsMp4(cardElement, platform, motion);
}

export async function exportSocialCard(options: SocialCardExportOptions): Promise<string> {
  const blob = await renderSocialCard(options);
  const filename = socialExportFilename(options.filenameStem, options.platform, options.format);
  saveAs(blob, filename);
  return filename;
}

export function SocialExportControls({
  platform,
  format,
  onPlatformChange,
  onFormatChange,
  musicOptions = [],
  selectedMusic,
  onMusicChange,
  musicUploadBrand,
  compact = false,
}: {
  platform: SocialExportPlatform;
  format: SocialExportFormat;
  onPlatformChange: (platform: SocialExportPlatform) => void;
  onFormatChange: (format: SocialExportFormat) => void;
  musicOptions?: SocialMusicOption[];
  selectedMusic?: SocialMusicOption | null;
  onMusicChange?: (option: SocialMusicOption | null) => void;
  musicUploadBrand?: "aaus" | "iheartecho";
  compact?: boolean;
}) {
  const activePreset = useMemo(() => getSocialExportPreset(platform), [platform]);
  const [catalogueInput, setCatalogueInput] = useState("");
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const musicPreviewRef = useRef<HTMLAudioElement>(null);
  const catalogue = trpc.openverseMusic.searchCc0Audio.useQuery(
    { query: catalogueQuery, limit: 8 },
    { enabled: catalogueQuery.length >= 2, retry: false, staleTime: 60_000 },
  );
  const catalogueOptions = useMemo<SocialMusicOption[]>(() => (catalogue.data?.tracks ?? []).map((track: any) => ({
    id: `openverse:${track.id}`,
    title: track.title,
    url: track.previewUrl,
    source: "openverse" as const,
    creator: track.creator,
    attribution: track.attribution,
    license: track.license,
    licenseUrl: track.licenseUrl,
    sourceUrl: track.sourceUrl,
  })), [catalogue.data?.tracks]);
  const combinedMusicOptions = useMemo(() => {
    const entries = [...musicOptions, ...catalogueOptions];
    if (selectedMusic && !entries.some((item) => item.id === selectedMusic.id)) entries.push(selectedMusic);
    return entries;
  }, [catalogueOptions, musicOptions, selectedMusic]);

  const selectMusic = (value: string) => {
    if (!value) {
      onMusicChange?.(null);
      return;
    }
    onMusicChange?.(combinedMusicOptions.find((option) => option.id === value) ?? null);
  };

  useEffect(() => {
    const preview = musicPreviewRef.current;
    if (!preview) return;
    preview.pause();
    preview.currentTime = 0;
  }, [selectedMusic?.id]);

  const uploadMusic = async (file: File) => {
    if (!musicUploadBrand || !file.type.startsWith("audio/")) return;
    if (file.size > 30 * 1024 * 1024) {
      throw new Error("Music files must be 30 MB or smaller.");
    }
    setIsUploadingMusic(true);
    try {
      const uploaded = await uploadFileToMediaRepository(file, {
        access: "private",
        folder: "social-card-music",
        brand: musicUploadBrand,
      });
      onMusicChange?.({
        id: `media:${uploaded.assetId}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        url: uploaded.s3Url,
        source: "media_repository",
      });
    } finally {
      setIsUploadingMusic(false);
    }
  };

  return (
    <div className={`rounded-lg border border-white/15 bg-black/15 ${compact ? "p-2" : "p-3"}`}>
      <div className={`flex ${compact ? "flex-col gap-1.5" : "flex-wrap items-end gap-3"}`}>
        <label className="flex min-w-[176px] flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Social platform
          <select
            value={platform}
            onChange={(event) => onPlatformChange(event.target.value as SocialExportPlatform)}
            className="rounded-md border border-white/15 bg-[#0e1a24] px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-white outline-none"
          >
            {SOCIAL_EXPORT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Export format</span>
          <div className="flex overflow-hidden rounded-md border border-white/15">
            {(["png", "mp4"] as SocialExportFormat[]).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => onFormatChange(value)}
                className={`px-3 py-1.5 text-xs font-bold uppercase transition-colors ${format === value ? "bg-teal-500 text-white" : "bg-white/[0.03] text-white/55 hover:bg-white/10 hover:text-white"}`}
                aria-pressed={format === value}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {onMusicChange && (
          <div className="min-w-[220px] space-y-1.5">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              <span className="flex items-center gap-1">Background music <span className="font-normal normal-case text-white/35">MP4 only</span></span>
              <select
                value={selectedMusic?.id ?? ""}
                onChange={(event) => selectMusic(event.target.value)}
                className="rounded-md border border-white/15 bg-[#0e1a24] px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-white outline-none"
              >
                <option value="">No music</option>
                {musicOptions.length > 0 && <optgroup label="Media Repository">{musicOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</optgroup>}
                {catalogueOptions.length > 0 && <optgroup label="Openverse CC0 catalogue">{catalogueOptions.map((option) => <option key={option.id} value={option.id}>{option.title} — {option.creator}</option>)}</optgroup>}
              </select>
            </label>
            {selectedMusic && <div className="rounded-md border border-white/10 bg-white/[0.035] p-2">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-white/70"><Headphones className="h-3 w-3 text-teal-200" />Sample: {selectedMusic.title}</div>
              <audio ref={musicPreviewRef} controls preload="metadata" src={selectedMusic.url} className="h-7 w-full max-w-[290px]" aria-label={`Play a sample of ${selectedMusic.title}`} />
              <p className="mt-1 text-[9px] leading-relaxed normal-case tracking-normal text-white/40">Preview plays in this browser only. The full MP4 uses the selected track when the source permits browser decoding and CORS access.</p>
            </div>}
            <div className="flex gap-1">
              <input
                value={catalogueInput}
                onChange={(event) => setCatalogueInput(event.target.value.slice(0, 80))}
                onKeyDown={(event) => { if (event.key === "Enter" && catalogueInput.trim().length >= 2) setCatalogueQuery(catalogueInput.trim()); }}
                placeholder="Search free CC0 music"
                className="min-w-0 flex-1 rounded-md border border-white/15 bg-[#0e1a24] px-2 py-1.5 text-xs normal-case tracking-normal text-white outline-none placeholder:text-white/35"
              />
              <button
                type="button"
                disabled={catalogueInput.trim().length < 2 || catalogue.isFetching}
                onClick={() => setCatalogueQuery(catalogueInput.trim())}
                className="inline-flex items-center justify-center rounded-md border border-white/15 px-2 text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Search the Openverse CC0 music catalogue"
              >
                {catalogue.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </button>
            </div>
            {musicUploadBrand && <div className="flex items-center gap-2">
              <input ref={musicInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/wav" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMusic(file).catch((error) => console.error("Music upload failed:", error)); event.currentTarget.value = ""; }} />
              <button type="button" disabled={isUploadingMusic} onClick={() => musicInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] normal-case tracking-normal text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40">
                {isUploadingMusic ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}{isUploadingMusic ? "Uploading…" : "Upload audio"}
              </button>
              <span className="text-[10px] normal-case tracking-normal text-white/35">MP3, M4A, AAC, or WAV · up to 30 MB</span>
            </div>}
            {catalogue.error && <p className="text-[10px] normal-case tracking-normal text-amber-200">Catalogue search is temporarily unavailable. Media Repository music remains available.</p>}
            {catalogueOptions.length > 0 && <p className="text-[10px] leading-relaxed normal-case tracking-normal text-white/45">Openverse results are third-party CC0 1.0 previews. Confirm attribution and source before publishing.</p>}
            {selectedMusic?.source === "openverse" && <p className="text-[10px] leading-relaxed normal-case tracking-normal text-teal-100/80">Selected: {selectedMusic.title} — {selectedMusic.creator} · {selectedMusic.license ?? "CC0 1.0"}</p>}
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/45">
        {activePreset.description}. PNG keeps the full card visible; MP4 stages the text with readable pacing and ends on a 10-second branded website screen{selectedMusic ? " with the selected approved track" : ""}.
      </p>
    </div>
  );
}

export { DEFAULT_SOCIAL_EXPORT_PLATFORM };
