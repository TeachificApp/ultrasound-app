/**
 * teachMediaFormat.ts — Office-style picture/video formatting (corrections, color, frame, shadow).
 */

export type TeachFrameStyle = "none" | "simple" | "rounded" | "beveled" | "thick" | "double" | "matte";

export interface TeachMediaCorrections {
  /** -100 … 100 */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0 … 100 sharpen amount */
  sharpness: number;
}

export interface TeachMediaColor {
  /** 0 … 100 */
  opacity: number;
  grayscale: number;
  sepia: number;
  /** -100 cool … 100 warm */
  temperature: number;
  /** -100 green … 100 magenta */
  tint: number;
}

export interface TeachMediaFrame {
  style: TeachFrameStyle;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  backgroundColor?: string;
}

export interface TeachMediaShadow {
  enabled: boolean;
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
}

export interface TeachMediaFormat {
  corrections: TeachMediaCorrections;
  color: TeachMediaColor;
  frame: TeachMediaFrame;
  shadow: TeachMediaShadow;
  objectFit: "contain" | "cover" | "fill";
}

export const DEFAULT_MEDIA_CORRECTIONS: TeachMediaCorrections = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
};

export const DEFAULT_MEDIA_COLOR: TeachMediaColor = {
  opacity: 100,
  grayscale: 0,
  sepia: 0,
  temperature: 0,
  tint: 0,
};

export const DEFAULT_MEDIA_FRAME: TeachMediaFrame = {
  style: "none",
  borderColor: "#d1d5db",
  borderWidth: 0,
  borderRadius: 0,
  padding: 0,
  backgroundColor: "transparent",
};

export const DEFAULT_MEDIA_SHADOW: TeachMediaShadow = {
  enabled: false,
  color: "rgba(0,0,0,0.35)",
  offsetX: 4,
  offsetY: 4,
  blur: 12,
  spread: 0,
};

export const DEFAULT_MEDIA_FORMAT: TeachMediaFormat = {
  corrections: { ...DEFAULT_MEDIA_CORRECTIONS },
  color: { ...DEFAULT_MEDIA_COLOR },
  frame: { ...DEFAULT_MEDIA_FRAME },
  shadow: { ...DEFAULT_MEDIA_SHADOW },
  objectFit: "contain",
};

export const FRAME_PRESETS: Record<
  TeachFrameStyle,
  { label: string; frame: Partial<TeachMediaFrame>; shadow?: Partial<TeachMediaShadow> }
> = {
  none: { label: "None", frame: { style: "none", borderWidth: 0, borderRadius: 0, padding: 0 } },
  simple: {
    label: "Simple",
    frame: { style: "simple", borderWidth: 2, borderColor: "#9ca3af", borderRadius: 0, padding: 0 },
  },
  rounded: {
    label: "Rounded",
    frame: { style: "rounded", borderWidth: 3, borderColor: "#ffffff", borderRadius: 16, padding: 4 },
    shadow: { enabled: true, blur: 8, offsetY: 2 },
  },
  beveled: {
    label: "Beveled",
    frame: {
      style: "beveled",
      borderWidth: 3,
      borderColor: "#e5e7eb",
      borderRadius: 4,
      padding: 2,
      backgroundColor: "#f9fafb",
    },
    shadow: { enabled: true, blur: 0, offsetX: 2, offsetY: 2, color: "rgba(255,255,255,0.8)" },
  },
  thick: {
    label: "Thick",
    frame: { style: "thick", borderWidth: 6, borderColor: "#179ca3", borderRadius: 0, padding: 0 },
  },
  double: {
    label: "Double",
    frame: { style: "double", borderWidth: 4, borderColor: "#374151", borderRadius: 0, padding: 2 },
  },
  matte: {
    label: "Matte",
    frame: {
      style: "matte",
      borderWidth: 12,
      borderColor: "#f3f4f6",
      borderRadius: 2,
      padding: 8,
      backgroundColor: "#ffffff",
    },
    shadow: { enabled: true, blur: 16, offsetY: 6 },
  },
};

export function normalizeMediaFormat(raw?: Partial<TeachMediaFormat> | null): TeachMediaFormat {
  if (!raw) return { ...DEFAULT_MEDIA_FORMAT, corrections: { ...DEFAULT_MEDIA_CORRECTIONS }, color: { ...DEFAULT_MEDIA_COLOR }, frame: { ...DEFAULT_MEDIA_FRAME }, shadow: { ...DEFAULT_MEDIA_SHADOW } };
  return {
    corrections: { ...DEFAULT_MEDIA_CORRECTIONS, ...raw.corrections },
    color: { ...DEFAULT_MEDIA_COLOR, ...raw.color },
    frame: { ...DEFAULT_MEDIA_FRAME, ...raw.frame },
    shadow: { ...DEFAULT_MEDIA_SHADOW, ...raw.shadow },
    objectFit: raw.objectFit ?? "contain",
  };
}

/** CSS filter string for img/video (corrections + color) */
export function buildMediaFilterCss(format: TeachMediaFormat): string {
  const { corrections: c, color: col } = format;
  const parts: string[] = [];

  const brightness = Math.max(0, 100 + c.brightness);
  const contrast = Math.max(0, 100 + c.contrast + c.sharpness * 0.25);
  const saturate = Math.max(0, 100 + c.saturation);

  parts.push(`brightness(${brightness}%)`);
  parts.push(`contrast(${contrast}%)`);
  parts.push(`saturate(${saturate}%)`);

  if (col.grayscale > 0) parts.push(`grayscale(${col.grayscale}%)`);
  if (col.sepia > 0) parts.push(`sepia(${col.sepia}%)`);

  const hue = col.temperature * 0.35 + col.tint * 0.5;
  if (Math.abs(hue) > 0.5) parts.push(`hue-rotate(${hue}deg)`);

  return parts.join(" ");
}

export interface MediaWrapperStyle {
  wrapper: Record<string, string | number | undefined>;
  media: Record<string, string | number | undefined>;
}

/** Frame + shadow wrapper styles; opacity on media */
export function buildMediaWrapperStyles(format: TeachMediaFormat): MediaWrapperStyle {
  const { frame, shadow, color } = format;
  const shadows: string[] = [];

  if (shadow.enabled) {
    shadows.push(`${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.spread}px ${shadow.color}`);
  }
  if (frame.style === "beveled") {
    shadows.push(`inset 2px 2px 4px rgba(0,0,0,0.15), inset -1px -1px 2px rgba(255,255,255,0.7)`);
  }

  const borderStyle = frame.style === "double" ? "double" : "solid";

  return {
    wrapper: {
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      padding: frame.padding,
      backgroundColor: frame.backgroundColor ?? "transparent",
      border:
        frame.borderWidth > 0
          ? `${frame.borderWidth}px ${borderStyle} ${frame.borderColor}`
          : undefined,
      borderRadius: frame.borderRadius,
      boxShadow: shadows.length > 0 ? shadows.join(", ") : undefined,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    media: {
      filter: buildMediaFilterCss(format),
      opacity: color.opacity / 100,
      width: "100%",
      height: "100%",
      objectFit: format.objectFit,
    },
  };
}

export function applyFramePreset(preset: TeachFrameStyle): TeachMediaFormat {
  const p = FRAME_PRESETS[preset];
  const base = normalizeMediaFormat({});
  return {
    ...base,
    frame: { ...base.frame, ...p.frame, style: preset },
    shadow: p.shadow ? { ...base.shadow, ...p.shadow } : { ...base.shadow, enabled: false },
  };
}
