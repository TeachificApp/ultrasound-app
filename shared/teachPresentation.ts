/**
 * TEACH presentation model — slide elements, animations, timings, video settings.
 * Shared between client editor/presenter and server validation.
 */

import {
  DEFAULT_MEDIA_FORMAT,
  normalizeMediaFormat,
} from "./teachMediaFormat";

export type { TeachMediaFormat } from "./teachMediaFormat";
export {
  DEFAULT_MEDIA_FORMAT,
  normalizeMediaFormat,
  buildMediaFilterCss,
  buildMediaWrapperStyles,
  applyFramePreset,
  FRAME_PRESETS,
} from "./teachMediaFormat";

export type TeachElementType = "text" | "image" | "video" | "shape";

export type TeachAnimationType =
  | "none"
  | "fadeIn"
  | "fadeOut"
  | "slideInLeft"
  | "slideInRight"
  | "slideInUp"
  | "slideInDown"
  | "zoomIn"
  | "bounce";

export type TeachAnimationTrigger = "onClick" | "withPrevious" | "afterPrevious" | "auto";

export type TeachSlideTransition =
  | "none"
  | "fade"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "zoom";

export interface TeachElementAnimation {
  type: TeachAnimationType;
  durationMs: number;
  delayMs: number;
  trigger: TeachAnimationTrigger;
}

export interface TeachVideoSettings {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  controls: boolean;
  startAtSec?: number;
}

export interface TeachTextStyle {
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  color: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export type TeachPlaceholderRole = "title" | "subtitle" | "body" | "body2" | "media" | "footer";

export interface TeachSlideElement {
  id: string;
  type: TeachElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  content?: string;
  style?: TeachTextStyle;
  src?: string;
  video?: TeachVideoSettings;
  /** Picture / video formatting — corrections, color, frame, shadow */
  mediaFormat?: import("./teachMediaFormat").TeachMediaFormat;
  shape?: "rectangle" | "ellipse";
  fill?: string;
  stroke?: string;
  /** Slide master placeholder slot (title, body, media, etc.) */
  placeholderRole?: TeachPlaceholderRole;
  entrance?: TeachElementAnimation;
  emphasis?: TeachElementAnimation;
  exit?: TeachElementAnimation;
}

export interface TeachSlideTransitionConfig {
  type: TeachSlideTransition;
  durationMs: number;
}

export type TeachMasterLayoutRole =
  | "title"
  | "titleAndContent"
  | "sectionHeader"
  | "twoContent"
  | "blank"
  | "custom";

export interface TeachSlide {
  id: string;
  title: string;
  notes?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  transition?: TeachSlideTransitionConfig;
  /** Auto-advance to next slide after N ms (null = manual only) */
  advanceAfterMs?: number | null;
  /** Which master layout template this slide uses */
  masterLayoutRole?: TeachMasterLayoutRole;
  elements: TeachSlideElement[];
  /** @deprecated legacy flat fields — migrated to elements on load */
  content?: string;
  imageUrl?: string;
}

export const DEFAULT_TEXT_STYLE: TeachTextStyle = {
  fontSize: 24,
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left",
  color: "#111827",
};

export const DEFAULT_ANIMATION: TeachElementAnimation = {
  type: "fadeIn",
  durationMs: 600,
  delayMs: 0,
  trigger: "onClick",
};

export const DEFAULT_VIDEO: TeachVideoSettings = {
  autoplay: false,
  loop: false,
  muted: true,
  controls: true,
};

export const DEFAULT_TRANSITION: TeachSlideTransitionConfig = {
  type: "fade",
  durationMs: 500,
};

export function newElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newSlideId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createTextElement(partial?: Partial<TeachSlideElement>): TeachSlideElement {
  return {
    id: newElementId(),
    type: "text",
    x: 8,
    y: 12,
    width: 84,
    height: 20,
    zIndex: 1,
    content: "Click to edit text",
    style: { ...DEFAULT_TEXT_STYLE },
    entrance: { ...DEFAULT_ANIMATION },
    ...partial,
  };
}

export function createTitleElement(): TeachSlideElement {
  return createTextElement({
    y: 8,
    height: 14,
    content: "Slide title",
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 36, fontWeight: "bold", textAlign: "center" },
  });
}

export function createBodyElement(): TeachSlideElement {
  return createTextElement({
    y: 28,
    height: 50,
    content: "",
    style: { ...DEFAULT_TEXT_STYLE, fontSize: 20 },
  });
}

export function createImageElement(src = ""): TeachSlideElement {
  return {
    id: newElementId(),
    type: "image",
    x: 20,
    y: 20,
    width: 60,
    height: 55,
    zIndex: 2,
    src,
    mediaFormat: normalizeMediaFormat(undefined),
    entrance: { ...DEFAULT_ANIMATION, type: "zoomIn" },
  };
}

export function createVideoElement(src = ""): TeachSlideElement {
  return {
    id: newElementId(),
    type: "video",
    x: 15,
    y: 18,
    width: 70,
    height: 60,
    zIndex: 2,
    src,
    video: { ...DEFAULT_VIDEO },
    mediaFormat: normalizeMediaFormat(undefined),
    entrance: { ...DEFAULT_ANIMATION, type: "fadeIn" },
  };
}

export function createShapeElement(): TeachSlideElement {
  return {
    id: newElementId(),
    type: "shape",
    x: 30,
    y: 35,
    width: 40,
    height: 25,
    zIndex: 0,
    shape: "rectangle",
    fill: "#179ca322",
    stroke: "#179ca3",
    entrance: { ...DEFAULT_ANIMATION },
  };
}

export function createEmptySlide(index: number): TeachSlide {
  return {
    id: newSlideId(),
    title: `Slide ${index}`,
    notes: "",
    backgroundColor: "#ffffff",
    transition: { ...DEFAULT_TRANSITION },
    advanceAfterMs: null,
    elements: [createTitleElement(), createBodyElement()],
  };
}

/** Migrate legacy { title, content, imageUrl } slides to element-based model */
export function normalizeSlide(raw: unknown, index: number): TeachSlide {
  if (!raw || typeof raw !== "object") return createEmptySlide(index + 1);

  const s = raw as Record<string, unknown>;
  const id = typeof s.id === "string" ? s.id : newSlideId();
  const title = typeof s.title === "string" ? s.title : `Slide ${index + 1}`;
  const notes = typeof s.notes === "string" ? s.notes : "";

  let elements: TeachSlideElement[] = Array.isArray(s.elements)
    ? (s.elements as TeachSlideElement[]).map(normalizeElement)
    : [];

  if (elements.length === 0) {
    const legacyTitle = title;
    const legacyContent = typeof s.content === "string" ? s.content : "";
    const legacyImage = typeof s.imageUrl === "string" ? s.imageUrl : "";

    elements = [
      createTextElement({
        content: legacyTitle,
        y: 8,
        height: 12,
        style: { ...DEFAULT_TEXT_STYLE, fontSize: 32, fontWeight: "bold", textAlign: "center" },
        entrance: { ...DEFAULT_ANIMATION, trigger: "auto" },
      }),
    ];
    if (legacyContent) {
      elements.push(
        createTextElement({
          content: legacyContent,
          y: 24,
          height: 50,
          style: { ...DEFAULT_TEXT_STYLE, fontSize: 20 },
          entrance: { ...DEFAULT_ANIMATION, trigger: "onClick", delayMs: 200 },
        }),
      );
    }
    if (legacyImage) {
      elements.push(createImageElement(legacyImage));
    }
  }

  const transition = normalizeTransition(s.transition);
  const advanceAfterMs =
    s.advanceAfterMs === null || s.advanceAfterMs === undefined
      ? null
      : typeof s.advanceAfterMs === "number"
        ? s.advanceAfterMs
        : null;

  return {
    id,
    title,
    notes,
    backgroundColor: typeof s.backgroundColor === "string" ? s.backgroundColor : "#ffffff",
    backgroundImage: typeof s.backgroundImage === "string" ? s.backgroundImage : undefined,
    transition,
    advanceAfterMs,
    elements,
  };
}

function normalizeElement(el: TeachSlideElement): TeachSlideElement {
  return {
    ...el,
    style: el.style ? { ...DEFAULT_TEXT_STYLE, ...el.style } : el.type === "text" ? { ...DEFAULT_TEXT_STYLE } : undefined,
    video: el.type === "video" ? { ...DEFAULT_VIDEO, ...el.video } : el.video,
    mediaFormat:
      el.type === "image" || el.type === "video"
        ? normalizeMediaFormat(el.mediaFormat)
        : el.mediaFormat,
    entrance: el.entrance ? { ...DEFAULT_ANIMATION, ...el.entrance } : el.entrance,
  };
}

function normalizeTransition(raw: unknown): TeachSlideTransitionConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TRANSITION };
  const t = raw as Record<string, unknown>;
  const type = typeof t.type === "string" ? (t.type as TeachSlideTransition) : "fade";
  const durationMs = typeof t.durationMs === "number" ? t.durationMs : 500;
  return { type, durationMs };
}

export function parseTeachSlides(raw: string | null | undefined): TeachSlide[] {
  if (!raw) return [createEmptySlide(1)];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s, i) => normalizeSlide(s, i));
    }
  } catch {
    /* ignore */
  }
  return [createEmptySlide(1)];
}

export function animationCssClass(type: TeachAnimationType): string {
  return `teach-anim-${type}`;
}

export function slideTransitionClass(type: TeachSlideTransition): string {
  return `teach-slide-trans-${type}`;
}

/** Presenter sync keys in localStorage */
export function presenterSlideKey(materialId: number): string {
  return `teach-present-${materialId}-slide`;
}

export function presenterStepKey(materialId: number): string {
  return `teach-present-${materialId}-step`;
}

export function presenterTickKey(materialId: number): string {
  return `teach-present-${materialId}-tick`;
}

/** Ordered entrance animations for a slide (by zIndex then array order) */
export function orderedEntranceElements(slide: TeachSlide): TeachSlideElement[] {
  return [...slide.elements]
    .filter((el) => el.entrance && el.entrance.type !== "none")
    .sort((a, b) => a.zIndex - b.zIndex || 0);
}

/** How many click-steps before slide can advance */
export function clickStepsForSlide(slide: TeachSlide): number {
  return orderedEntranceElements(slide).filter((el) => el.entrance?.trigger === "onClick").length + 1;
}
