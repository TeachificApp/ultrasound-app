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
      return `<img data-pptx-image="1" src="${escapeAttribute(element.src)}" alt="" style="${escapeAttribute(`${elementStyle(element, false)};width:100%;height:100%;object-fit:contain;display:block;border:none`)}" />`;
    }
    if (element.type === "shape") {
      const borderRadius = element.shape === "ellipse" ? "50%" : "0";
      const fill = safeColor(element.fill, "transparent");
      const stroke = safeColor(element.stroke, "transparent");
      const border = stroke !== "transparent" && stroke !== fill ? `border:1px solid ${stroke}` : "border:none";
      return `<div data-pptx-shape="1" aria-hidden="true" style="${escapeAttribute(`${elementStyle(element, false)};background-color:${fill};${border};border-radius:${borderRadius}`)}"></div>`;
    }
    return "";
  }).join("");
  return `<div data-pptx-slide-layout="1" style="position:relative;width:100%;aspect-ratio:${width} / ${height};overflow:hidden;background-color:${safeColor(slide.backgroundColor, "#ffffff")};container-type:inline-size;isolation:isolate">${body}</div>`;
}

function clusterByRow(elements: PptxRichSlideElement[]) {
  const rows: PptxRichSlideElement[][] = [];
  for (const element of [...elements].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find((candidate) => {
      const anchor = candidate[0]!;
      const tolerance = Math.max(3, Math.max(anchor.height, element.height) * 0.4);
      return Math.abs(anchor.y - element.y) <= tolerance;
    });
    if (row) row.push(element);
    else rows.push([element]);
  }
  return rows.map((row) => row.sort((a, b) => a.x - b.x));
}

function isAccentBar(shape: PptxRichSlideElement) {
  return shape.type === "shape" && shape.width <= 5 && shape.height >= 8;
}

function isBackgroundPanel(shape: PptxRichSlideElement) {
  return shape.type === "shape" && shape.width >= 70 && shape.height >= 6;
}

function isTableGroup(name: string, cells: PptxRichSlideElement[]) {
  return /table/i.test(name) || cells.length >= 4;
}

function elementPlainText(element: PptxRichSlideElement) {
  const html = element.contentHtml ?? element.content ?? "";
  return plainTextFromRichHtml(typeof html === "string" ? html : String(html));
}

function isPlaceholderText(element: PptxRichSlideElement) {
  const plain = elementPlainText(element).replace(/\s+/g, " ").trim();
  return !plain || /^["'|~`\s]+$/.test(plain);
}

function textContentHtml(element: PptxRichSlideElement) {
  if (isPlaceholderText(element)) return "";
  return element.contentHtml || escapeHtml(element.content ?? "").replace(/\n/g, "<br />");
}

function cssTextStyle(element: PptxRichSlideElement, accent?: PptxRichSlideElement) {
  const style = element.style;
  const parts = ["margin:0", "border:none", "outline:none"];
  if (style?.color) parts.push(`color:${safeColor(style.color, "#1a1a1a")}`);
  if (style?.fontFamily) parts.push(`font-family:${safeFontFamily(style.fontFamily)}`);
  if (style?.fontSize) parts.push(`font-size:${Math.min(36, Math.max(11, style.fontSize))}pt`);
  if (style?.fontWeight === "bold") parts.push("font-weight:700");
  if (style?.fontStyle === "italic") parts.push("font-style:italic");
  if (style?.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style?.backgroundColor) parts.push(`background-color:${safeColor(style.backgroundColor, "transparent")}`);
  if (accent?.fill) {
    parts.push(`border-left:4px solid ${safeColor(accent.fill, "#179ca3")}`);
    parts.push("padding-left:0.85rem");
  }
  return parts.join(";");
}

function textBlockHtml(element: PptxRichSlideElement, accent?: PptxRichSlideElement) {
  const content = textContentHtml(element);
  if (!content) return "";
  const fontSize = element.style?.fontSize ?? 16;
  const tag = fontSize >= 28 ? "h2" : fontSize >= 21 ? "h3" : "p";
  const hasCalloutBg = !!(element.style?.backgroundColor || accent);
  const inner = `<${tag} data-pptx-text-box="1" style="${escapeAttribute(cssTextStyle(element, accent))}">${content}</${tag}>`;
  if (!hasCalloutBg) return inner;
  const wrapperStyle = [
    "margin:1rem 0",
    "padding:1rem",
    "border:none",
    "border-radius:8px",
    element.style?.backgroundColor ? `background:${safeColor(element.style.backgroundColor, "#f0fbfc")}` : "background:#f0fbfc",
    accent?.fill ? `border-left:4px solid ${safeColor(accent.fill, "#179ca3")}` : "",
  ].filter(Boolean).join(";");
  return `<div data-pptx-callout="1" style="${escapeAttribute(wrapperStyle)}">${inner}</div>`;
}

function imageBlockHtml(element: PptxRichSlideElement) {
  if (!element.src) return "";
  return `<figure data-pptx-figure="1" style="margin:0;width:100%"><img data-pptx-image="1" src="${escapeAttribute(element.src)}" alt="" style="width:100%;height:auto;max-width:100%;display:block;object-fit:contain;border:none" /></figure>`;
}

function tableGroupToHtml(cells: PptxRichSlideElement[]) {
  const rows = clusterByRow(cells);
  const body = rows.map((row, rowIndex) => {
    const cellsHtml = row.map((cell) => {
      const isHeader = rowIndex === 0 || cell.style?.fontWeight === "bold";
      const tag = isHeader ? "th" : "td";
      const parts = ["padding:0.65rem 0.85rem", "vertical-align:top", "border:none", "text-align:left"];
      if (cell.style?.backgroundColor) parts.push(`background-color:${safeColor(cell.style.backgroundColor, "transparent")}`);
      else if (!isHeader && rowIndex % 2 === 1) parts.push("background-color:#f9fafb");
      if (cell.style?.color) parts.push(`color:${safeColor(cell.style.color, "#1a1a1a")}`);
      if (cell.style?.fontWeight === "bold") parts.push("font-weight:700");
      const content = textContentHtml(cell) || "&nbsp;";
      return `<${tag} style="${escapeAttribute(parts.join(";"))}">${content}</${tag}>`;
    }).join("");
    return `<tr>${cellsHtml}</tr>`;
  }).join("");
  return `<div data-pptx-table-wrap="1" style="overflow-x:auto;margin:1.25rem 0"><table data-pptx-table="1" style="width:100%;border-collapse:collapse;border-spacing:0;border:none">${body}</table></div>`;
}

function findAccentForElement(element: PptxRichSlideElement, accentBars: PptxRichSlideElement[]) {
  return accentBars.find((bar) => Math.abs(bar.y - element.y) <= Math.max(4, element.height * 0.5) && bar.x + bar.width <= element.x + 6);
}

function columnRowToHtml(row: PptxRichSlideElement[], accentBars: PptxRichSlideElement[], bgPanel?: PptxRichSlideElement) {
  const columns = row.map((element) => `${Math.max(1, Math.round(finitePercent(element.width, 50)))}fr`).join(" ");
  const children = row.map((element) => {
    const accent = findAccentForElement(element, accentBars);
    if (element.type === "image") return imageBlockHtml(element);
    if (element.type === "text") return textBlockHtml(element, accent);
    return "";
  }).filter(Boolean).join("");
  const panelStyle = [
    "display:grid",
    `grid-template-columns:${columns}`,
    "gap:1.25rem",
    "align-items:start",
    "border:none",
    "margin:1rem 0",
    bgPanel?.fill ? `background:${safeColor(bgPanel.fill, "transparent")}` : "",
    bgPanel ? "padding:1rem;border-radius:8px" : "",
  ].filter(Boolean).join(";");
  return `<div data-pptx-columns="1" style="${escapeAttribute(panelStyle)}">${children}</div>`;
}

function singleElementRowHtml(element: PptxRichSlideElement, accentBars: PptxRichSlideElement[]) {
  const accent = findAccentForElement(element, accentBars);
  if (element.type === "image") return `<div style="margin:1rem 0;border:none">${imageBlockHtml(element)}</div>`;
  if (element.type === "text") return textBlockHtml(element, accent);
  return "";
}

/** Reflowed lesson-document HTML that keeps tables, columns, callouts, and images editable. */
export function pptxRichSlideToDocumentHtml(slide: PptxRichSlide) {
  const elements = [...slide.elements];
  const shapes = elements.filter((element) => element.type === "shape");
  const accentBars = shapes.filter(isAccentBar);
  const bgPanels = shapes.filter(isBackgroundPanel);
  const usedTextIds = new Set<string>();

  const bySource = new Map<string, PptxRichSlideElement[]>();
  for (const element of elements.filter((candidate) => candidate.type === "text" && candidate.sourceName)) {
    const group = bySource.get(element.sourceName!) ?? [];
    group.push(element);
    bySource.set(element.sourceName!, group);
  }

  const tableGroups = [...bySource.entries()]
    .filter(([name, cells]) => isTableGroup(name, cells))
    .map(([, cells]) => ({ cells, y: Math.min(...cells.map((cell) => cell.y)) }));

  for (const group of tableGroups) {
    for (const cell of group.cells) usedTextIds.add(cell.id);
  }

  const flowElements = elements.filter((element) => !usedTextIds.has(element.id) && element.type !== "shape");
  const sections: Array<{ y: number; html: string }> = tableGroups.map((group) => ({
    y: group.y,
    html: tableGroupToHtml(group.cells),
  }));

  for (const row of clusterByRow(flowElements)) {
    const y = Math.min(...row.map((element) => element.y));
    const rowBottom = Math.max(...row.map((element) => element.y + element.height));
    const bgPanel = bgPanels.find((panel) => panel.y <= y + 1 && panel.y + panel.height >= rowBottom - 1);
    sections.push({
      y,
      html: row.length === 1
        ? singleElementRowHtml(row[0]!, accentBars)
        : columnRowToHtml(row, accentBars, bgPanel),
    });
  }

  const body = sections.filter((section) => section.html).sort((a, b) => a.y - b.y).map((section) => section.html).join("");
  return `<div data-pptx-document-slide="1" style="display:flex;flex-direction:column;gap:0.75rem;background-color:${safeColor(slide.backgroundColor, "#ffffff")}">${body || "<p></p>"}</div>`;
}

export function plainTextFromRichHtml(html: string, fallback = "") {
  return html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#039;/gi, "'").replace(/&quot;/gi, '"').trim() || fallback;
}

export function defaultPptxTextStyle(style?: Partial<TeachTextStyle>): Partial<TeachTextStyle> {
  return style ?? {};
}
