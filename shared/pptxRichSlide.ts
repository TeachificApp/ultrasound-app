import type { TeachSlide, TeachSlideElement, TeachTextStyle } from "./teachPresentation";

export type PptxRichSlideElement = Pick<TeachSlideElement, "id" | "type" | "x" | "y" | "width" | "height" | "zIndex" | "content" | "contentHtml" | "sourceName" | "style" | "src" | "shape" | "fill" | "stroke">;

export type PptxRichSlide = {
  version: 1;
  title: string;
  sourceWidth: number;
  sourceHeight: number;
  backgroundColor: string;
  elements: PptxRichSlideElement[];
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const escapeAttribute = (value: string) => escapeHtml(value).replace(/`/g, "&#096;");

const finitePercent = (value: number | undefined, fallback: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : fallback));

const safeColor = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : fallback;

const safeFontFamily = (value: unknown) => {
  if (typeof value !== "string") return "Arial, sans-serif";
  const clean = value.replace(/[^a-zA-Z0-9 ,_-]/g, "").trim();
  return clean ? `'${clean}', Arial, sans-serif` : "Arial, sans-serif";
};

const richTextFontSize = (value: unknown) => {
  const pointSize = typeof value === "number" && Number.isFinite(value) ? Math.min(72, Math.max(8, value)) : 16;
  const responsiveSize = Math.min(13, Math.max(0.8, pointSize / 8));
  return `clamp(9px, ${responsiveSize.toFixed(2)}cqw, ${Math.round(pointSize * 1.34)}px)`;
};

function elementStyle(element: PptxRichSlideElement, includeTextStyle: boolean) {
  const base = [
    "position:absolute",
    `left:${finitePercent(element.x, 0)}%`,
    `top:${finitePercent(element.y, 0)}%`,
    `width:${finitePercent(element.width, 100)}%`,
    `height:${finitePercent(element.height, 100)}%`,
    `z-index:${Math.max(1, Math.round(element.zIndex ?? 1))}`,
    "box-sizing:border-box",
  ];
  if (!includeTextStyle) return base.join(";");
  const style = element.style;
  base.push(
    `color:${safeColor(style?.color, "#1a1a1a")}`,
    `font-family:${safeFontFamily(style?.fontFamily)}`,
    `font-size:${richTextFontSize(style?.fontSize)}`,
    `font-weight:${style?.fontWeight === "bold" ? "700" : "400"}`,
    `font-style:${style?.fontStyle === "italic" ? "italic" : "normal"}`,
    `text-align:${style?.textAlign ?? "left"}`,
    `text-decoration:${style?.textDecoration ?? "none"}`,
    `line-height:${style?.lineHeight ?? 1.2}`,
    // Responsive lesson widths can produce an extra wrapped line compared with
    // the original slide. Never clip source text; adjacent slide layers retain
    // their absolute placement and authors can refine the selected layer.
    "overflow:visible",
    "white-space:normal",
  );
  if (style?.backgroundColor) base.push(`background-color:${safeColor(style.backgroundColor, "transparent")}`);
  return base.join(";");
}

export function teachSlideToPptxRichSlide(slide: TeachSlide): PptxRichSlide {
  return {
    version: 1,
    title: slide.title,
    sourceWidth: Number.isFinite(slide.sourceWidth) && slide.sourceWidth! > 0 ? slide.sourceWidth! : 4,
    sourceHeight: Number.isFinite(slide.sourceHeight) && slide.sourceHeight! > 0 ? slide.sourceHeight! : 3,
    backgroundColor: safeColor(slide.backgroundColor, "#ffffff"),
    elements: slide.elements.map((element) => ({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      zIndex: element.zIndex,
      content: element.content,
      contentHtml: element.contentHtml,
      sourceName: element.sourceName,
      style: element.style,
      src: element.src,
      shape: element.shape,
      fill: element.fill,
      stroke: element.stroke,
    })),
  };
}

export function pptxRichSlideToHtml(slide: PptxRichSlide) {
  const width = Number.isFinite(slide.sourceWidth) && slide.sourceWidth > 0 ? slide.sourceWidth : 4;
  const height = Number.isFinite(slide.sourceHeight) && slide.sourceHeight > 0 ? slide.sourceHeight : 3;
  const body = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex || a.y - b.y || a.x - b.x).map((element) => {
    if (element.type === "text") {
      const content = element.contentHtml || escapeHtml(element.content ?? " ").replace(/\n/g, "<br />");
      return `<div data-pptx-text-box="1" style="${escapeAttribute(elementStyle(element, true))}">${content || "&nbsp;"}</div>`;
    }
    if (element.type === "image" && element.src) {
      return `<img data-pptx-image="1" src="${escapeAttribute(element.src)}" alt="" style="${escapeAttribute(`${elementStyle(element, false)};object-fit:contain;display:block`)}" />`;
    }
    if (element.type === "shape") {
      const borderRadius = element.shape === "ellipse" ? "50%" : "0";
      return `<div data-pptx-shape="1" aria-hidden="true" style="${escapeAttribute(`${elementStyle(element, false)};background-color:${safeColor(element.fill, "transparent")};border:1px solid ${safeColor(element.stroke, "transparent")};border-radius:${borderRadius}`)}"></div>`;
    }
    return "";
  }).join("");
  return `<div data-pptx-slide-layout="1" style="position:relative;width:100%;aspect-ratio:${width} / ${height};overflow:hidden;background-color:${safeColor(slide.backgroundColor, "#ffffff")};container-type:inline-size;isolation:isolate">${body}</div>`;
}

export function plainTextFromRichHtml(html: string, fallback = "") {
  return html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#039;/gi, "'").replace(/&quot;/gi, '"').trim() || fallback;
}

export function defaultPptxTextStyle(style?: Partial<TeachTextStyle>): Partial<TeachTextStyle> {
  return style ?? {};
}
