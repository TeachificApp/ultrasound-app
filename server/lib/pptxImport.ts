/**
 * pptxImport.ts — Parse .pptx (Office Open XML) into TEACH presentation slides.
 * Extracts text shapes, images, backgrounds, notes, and slide master layouts.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import {
  type TeachSlide,
  type TeachSlideElement,
  type TeachTextStyle,
  newElementId,
  newSlideId,
  DEFAULT_TEXT_STYLE,
  DEFAULT_ANIMATION,
  createShapeElement,
} from "../../shared/teachPresentation";
import {
  type TeachMasterSlide,
  createDefaultMasterSlides,
  MASTER_LAYOUT_LABELS,
} from "../../shared/teachSlideMaster";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // A PowerPoint text run can be a single literal space. Preserve it so text
  // does not collapse together after slide composition is converted to HTML.
  trimValues: false,
  isArray: (name) =>
    ["sldId", "sldMasterId", "sp", "pic", "p", "r", "Relationship"].includes(name),
});

export type PptxImageUploader = (
  fileName: string,
  data: Buffer,
  mimeType: string,
) => Promise<string>;

export interface PptxImportResult {
  slides: TeachSlide[];
  masterSlides: TeachMasterSlide[];
  warnings: string[];
}

const DEFAULT_SLIDE_CX = 9144000;
const DEFAULT_SLIDE_CY = 6858000;

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function emuToPercent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function relAttr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[`@_${key}`];
    if (typeof val === "string") return val;
  }
  return undefined;
}

function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const doc = xmlParser.parse(xml);
  for (const rel of asArray(doc?.Relationships?.Relationship)) {
    const id = rel["@_Id"] as string | undefined;
    const target = rel["@_Target"] as string | undefined;
    if (id && target) map.set(id, target);
  }
  return map;
}

function resolveTarget(basePath: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const baseParts = basePath.split("/");
  baseParts.pop();
  for (const part of target.split("/")) {
    if (part === "..") baseParts.pop();
    else if (part !== ".") baseParts.push(part);
  }
  return baseParts.join("/");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"] ?? "");
  return "";
}

function textRunStyle(rPr: Record<string, unknown> | undefined): Partial<TeachTextStyle> {
  if (!rPr) return {};
  const style: Partial<TeachTextStyle> = {};
  if (rPr["@_sz"]) style.fontSize = Math.round(Number(rPr["@_sz"]) / 100);
  if (rPr["@_b"] === "1" || rPr["@_b"] === 1) style.fontWeight = "bold";
  if (rPr["@_i"] === "1" || rPr["@_i"] === 1) style.fontStyle = "italic";
  const solid = rPr.solidFill as Record<string, unknown> | undefined;
  const srgb = solid?.srgbClr as Record<string, unknown> | undefined;
  if (srgb?.["@_val"]) style.color = `#${String(srgb["@_val"]).slice(0, 6)}`;
  const latin = rPr.latin as Record<string, unknown> | undefined;
  if (typeof latin?.["@_typeface"] === "string" && latin["@_typeface"].trim()) style.fontFamily = latin["@_typeface"].trim();
  if (rPr["@_u"] && rPr["@_u"] !== "none") style.textDecoration = "underline";
  return style;
}

function richRunHtml(value: string, style: Partial<TeachTextStyle>) {
  const css = [
    style.fontSize ? `font-size:${style.fontSize}pt` : "",
    style.fontWeight === "bold" ? "font-weight:700" : "",
    style.fontStyle === "italic" ? "font-style:italic" : "",
    style.color ? `color:${style.color}` : "",
    style.fontFamily ? `font-family:${style.fontFamily.replace(/[^a-zA-Z0-9 ,_-]/g, "")}` : "",
    style.textDecoration ? `text-decoration:${style.textDecoration}` : "",
  ].filter(Boolean).join(";");
  return `<span${css ? ` style="${css}"` : ""}>${escapeHtml(value)}</span>`;
}

function extractTextFromParagraphs(txBody: unknown): { text: string; richHtml: string; style: Partial<TeachTextStyle> } {
  const paragraphs = asArray((txBody as Record<string, unknown>)?.p);
  const lines: string[] = [];
  const htmlLines: string[] = [];
  let style: Partial<TeachTextStyle> = {};

  for (const p of paragraphs) {
    const runs = asArray((p as Record<string, unknown>)?.r);
    let line = "";
    let lineHtml = "";
    for (const r of runs) {
      const run = r as Record<string, unknown>;
      const runText = textValue(run.t);
      line += runText;
      const rPr = (r as Record<string, unknown>)?.rPr as Record<string, unknown> | undefined;
      const runStyle = textRunStyle(rPr);
      style = { ...style, ...runStyle };
      lineHtml += richRunHtml(runText, runStyle);
    }
    const pPr = (p as Record<string, unknown>)?.pPr as Record<string, unknown> | undefined;
    const algn = pPr?.["@_algn"] as string | undefined;
    if (algn === "ctr") style.textAlign = "center";
    else if (algn === "r") style.textAlign = "right";
    else if (algn === "l") style.textAlign = "left";
    if (line) {
      lines.push(line);
      const paragraphCss = style.textAlign ? ` style="display:block;text-align:${style.textAlign}"` : "";
      htmlLines.push(`<span${paragraphCss}>${lineHtml || "&nbsp;"}</span>`);
    }
  }

  return { text: lines.join("\n"), richHtml: htmlLines.join("<br />"), style };
}

function getTransform(spPr: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!spPr || typeof spPr !== "object") return null;
  const xfrm = (spPr as Record<string, unknown>).xfrm as Record<string, unknown> | undefined;
  if (!xfrm) return null;
  const off = xfrm.off as Record<string, unknown> | undefined;
  const ext = xfrm.ext as Record<string, unknown> | undefined;
  if (!off || !ext) return null;
  return {
    x: Number(off["@_x"] ?? 0),
    y: Number(off["@_y"] ?? 0),
    w: Number(ext["@_cx"] ?? 0),
    h: Number(ext["@_cy"] ?? 0),
  };
}

function parseSolidFill(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const solid = (node as Record<string, unknown>).solidFill as Record<string, unknown> | undefined;
  const srgb = solid?.srgbClr as Record<string, unknown> | undefined;
  if (srgb?.["@_val"]) return `#${String(srgb["@_val"]).slice(0, 6)}`;
  return undefined;
}

function sourceShapeName(node: unknown, property: string): string | undefined {
  const container = node && typeof node === "object" ? (node as Record<string, unknown>)[property] : undefined;
  const cNvPr = container && typeof container === "object" ? (container as Record<string, unknown>).cNvPr as Record<string, unknown> | undefined : undefined;
  const name = cNvPr?.["@_name"];
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 180) : undefined;
}

function parseBackground(cSld: unknown): { backgroundColor?: string; backgroundImage?: string } {
  if (!cSld || typeof cSld !== "object") return {};
  const bg = (cSld as Record<string, unknown>).bg as Record<string, unknown> | undefined;
  const bgPr = bg?.bgPr as Record<string, unknown> | undefined;
  const color = parseSolidFill(bgPr);
  return color ? { backgroundColor: color } : {};
}

function mimeFromExt(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    emf: "image/x-emf",
    wmf: "image/x-wmf",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

async function parseShapeTree(
  spTree: unknown,
  rels: Map<string, string>,
  slidePath: string,
  slideCx: number,
  slideCy: number,
  zip: JSZip,
  uploadImage: PptxImageUploader | null,
  warnings: string[],
): Promise<TeachSlideElement[]> {
  const elements: TeachSlideElement[] = [];
  if (!spTree || typeof spTree !== "object") return elements;

  const tree = spTree as Record<string, unknown>;
  let z = 1;

  for (const sp of asArray(tree.sp)) {
    const spObj = sp as Record<string, unknown>;
    const spPr = spObj.spPr;
    const xfrm = getTransform(spPr);
    if (!xfrm) continue;

    const txBody = spObj.txBody;
    const { text, richHtml, style } = extractTextFromParagraphs(txBody);
    if (!text.trim()) continue;
    const fill = parseSolidFill(spPr);

    elements.push({
      id: newElementId(),
      type: "text",
      x: emuToPercent(xfrm.x, slideCx),
      y: emuToPercent(xfrm.y, slideCy),
      width: emuToPercent(xfrm.w, slideCx),
      height: emuToPercent(xfrm.h, slideCy),
      zIndex: z++,
      content: text,
      contentHtml: richHtml,
      sourceName: sourceShapeName(spObj, "nvSpPr"),
      style: { ...DEFAULT_TEXT_STYLE, ...style, ...(fill ? { backgroundColor: fill } : {}) },
      entrance: { ...DEFAULT_ANIMATION, trigger: "auto" },
    });
  }

  for (const pic of asArray(tree.pic)) {
    const picObj = pic as Record<string, unknown>;
    const spPr = picObj.spPr;
    const xfrm = getTransform(spPr);
    if (!xfrm) continue;

    const blipFill = picObj.blipFill as Record<string, unknown> | undefined;
    const blip = blipFill?.blip as Record<string, unknown> | undefined;
    const embed = relAttr(blip ?? {}, "embed", "r:embed");
    if (!embed) continue;

    const target = rels.get(embed);
    if (!target) {
      warnings.push(`Missing image relationship ${embed}`);
      continue;
    }

    const mediaPath = resolveTarget(slidePath, target);
    let src = `pptx://${mediaPath}`;

    if (uploadImage) {
      try {
        const file = await zip.file(mediaPath)?.async("nodebuffer");
        if (file) {
          const name = mediaPath.split("/").pop() ?? "image.png";
          src = await uploadImage(name, Buffer.from(file), mimeFromExt(name));
        }
      } catch {
        warnings.push(`Failed to upload image ${mediaPath}`);
      }
    } else {
      // No uploader provided — embed as base64 data URL for immediate rendering
      try {
        const file = await zip.file(mediaPath)?.async("nodebuffer");
        if (file) {
          const name = mediaPath.split("/").pop() ?? "image.png";
          const mime = mimeFromExt(name);
          src = `data:${mime};base64,${file.toString("base64")}`;
        }
      } catch {
        warnings.push(`Failed to embed image ${mediaPath}`);
      }
    }

    elements.push({
      id: newElementId(),
      type: "image",
      x: emuToPercent(xfrm.x, slideCx),
      y: emuToPercent(xfrm.y, slideCy),
      width: emuToPercent(xfrm.w, slideCx),
      height: emuToPercent(xfrm.h, slideCy),
      zIndex: z++,
      src,
      sourceName: sourceShapeName(picObj, "nvPicPr"),
      entrance: { ...DEFAULT_ANIMATION, type: "zoomIn", trigger: "auto" },
    });
  }

  // Native PowerPoint tables are graphic frames. Promote their cells to
  // positioned text elements so the rich-text import retains editable table
  // labels, values, and cell backgrounds inside the slide composition.
  for (const graphicFrame of asArray(tree.graphicFrame)) {
    const frame = graphicFrame as Record<string, unknown>;
    const xfrm = getTransform({ xfrm: frame.xfrm });
    const graphic = frame.graphic as Record<string, unknown> | undefined;
    const graphicData = graphic?.graphicData as Record<string, unknown> | undefined;
    const table = graphicData?.tbl as Record<string, unknown> | undefined;
    if (!xfrm || !table) continue;

    const columns = asArray((table.tblGrid as Record<string, unknown> | undefined)?.gridCol)
      .map(column => Number((column as Record<string, unknown>)["@_w"] ?? 0))
      .filter(width => Number.isFinite(width) && width > 0);
    const rows = asArray(table.tr);
    if (!columns.length || !rows.length) continue;

    const totalColumnWidth = columns.reduce((sum, width) => sum + width, 0);
    const rowHeights = rows.map(row => {
      const height = Number((row as Record<string, unknown>)["@_h"] ?? 0);
      return Number.isFinite(height) && height > 0 ? height : 1;
    });
    const totalRowHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    let rowOffset = 0;

    rows.forEach((row, rowIndex) => {
      const cells = asArray((row as Record<string, unknown>).tc);
      let columnOffset = 0;
      cells.forEach((cell, cellIndex) => {
        const columnWidth = columns[cellIndex] ?? columns[columns.length - 1] ?? 1;
        const cellObj = cell as Record<string, unknown>;
        const { text, richHtml, style } = extractTextFromParagraphs(cellObj.txBody);
        const fill = parseSolidFill(cellObj.tcPr);
        elements.push({
          id: newElementId(),
          type: "text",
          x: emuToPercent(xfrm.x + (xfrm.w * columnOffset) / totalColumnWidth, slideCx),
          y: emuToPercent(xfrm.y + (xfrm.h * rowOffset) / totalRowHeight, slideCy),
          width: emuToPercent((xfrm.w * columnWidth) / totalColumnWidth, slideCx),
          height: emuToPercent((xfrm.h * rowHeights[rowIndex]!) / totalRowHeight, slideCy),
          zIndex: z++,
          content: text || " ",
          contentHtml: richHtml || "&nbsp;",
          sourceName: sourceShapeName(frame, "nvGraphicFramePr"),
          style: { ...DEFAULT_TEXT_STYLE, ...style, ...(fill ? { backgroundColor: fill } : {}) },
          entrance: { ...DEFAULT_ANIMATION, trigger: "auto" },
        });
        columnOffset += columnWidth;
      });
      rowOffset += rowHeights[rowIndex]!;
    });
  }

  for (const sp of asArray(tree.sp)) {
    const spObj = sp as Record<string, unknown>;
    const { text } = extractTextFromParagraphs(spObj.txBody);
    if (text.trim()) continue;
    const spPr = spObj.spPr;
    const xfrm = getTransform(spPr);
    if (!xfrm) continue;
    const fill = parseSolidFill(spPr);
    const prstGeom = (spPr as Record<string, unknown>)?.prstGeom as Record<string, unknown> | undefined;
    const preset = prstGeom?.["@_prst"] as string | undefined;

    elements.push({
      ...createShapeElement(),
      id: newElementId(),
      x: emuToPercent(xfrm.x, slideCx),
      y: emuToPercent(xfrm.y, slideCy),
      width: emuToPercent(xfrm.w, slideCx),
      height: emuToPercent(xfrm.h, slideCy),
      zIndex: z++,
      shape: preset === "ellipse" ? "ellipse" : "rectangle",
      fill: fill ?? "#179ca322",
      stroke: fill ?? "#179ca3",
      sourceName: sourceShapeName(spObj, "nvSpPr"),
      entrance: { ...DEFAULT_ANIMATION, trigger: "auto" },
    });
  }

  return elements;
}

async function parseSlideXml(
  xml: string,
  slidePath: string,
  rels: Map<string, string>,
  slideCx: number,
  slideCy: number,
  index: number,
  uploadImage: PptxImageUploader | null,
  zip: JSZip,
  warnings: string[],
  notesText?: string,
): Promise<TeachSlide> {
  const doc = xmlParser.parse(xml);
  const sld = doc?.sld as Record<string, unknown> | undefined;
  const cSld = sld?.cSld as Record<string, unknown> | undefined;
  const spTree = cSld?.spTree;

  const bg = parseBackground(cSld);
  const elements = await parseShapeTree(spTree, rels, slidePath, slideCx, slideCy, zip, uploadImage, warnings);

  const titleEl = elements.find((e) => e.type === "text" && e.style?.fontWeight === "bold");
  const title = titleEl?.content?.split("\n")[0] ?? `Slide ${index + 1}`;

  return {
    id: newSlideId(),
    title,
    sourceWidth: slideCx,
    sourceHeight: slideCy,
    notes: notesText ?? "",
    backgroundColor: bg.backgroundColor ?? "#ffffff",
    backgroundImage: bg.backgroundImage,
    elements,
    masterLayoutRole: index === 0 ? "title" : "titleAndContent",
  };
}

async function parseMasterXml(
  xml: string,
  masterPath: string,
  rels: Map<string, string>,
  slideCx: number,
  slideCy: number,
  index: number,
  zip: JSZip,
): Promise<TeachMasterSlide> {
  const doc = xmlParser.parse(xml);
  const sldMaster = doc?.sldMaster as Record<string, unknown> | undefined;
  const cSld = sldMaster?.cSld as Record<string, unknown> | undefined;
  const spTree = cSld?.spTree;
  const bg = parseBackground(cSld);
  const elements = await parseShapeTree(spTree, rels, masterPath, slideCx, slideCy, zip, null, []);

  const layoutRole =
    index === 0 ? "title" : index === 1 ? "titleAndContent" : index === 2 ? "sectionHeader" : "custom";

  return {
    id: newSlideId(),
    name: MASTER_LAYOUT_LABELS[layoutRole] ?? `Master ${index + 1}`,
    layoutRole,
    backgroundColor: bg.backgroundColor ?? "#ffffff",
    elements,
  };
}

function extractNotesText(xml: string): string {
  const doc = xmlParser.parse(xml);
  const notes = doc?.notes as Record<string, unknown> | undefined;
  const cSld = notes?.cSld as Record<string, unknown> | undefined;
  const spTree = cSld?.spTree;
  const shapes = asArray((spTree as Record<string, unknown> | undefined)?.sp);
  const lines: string[] = [];
  for (const sp of shapes) {
    const { text } = extractTextFromParagraphs((sp as Record<string, unknown>).txBody);
    if (text && !text.includes("Click to edit Master")) lines.push(text);
  }
  return lines.join("\n").trim();
}

/**
 * Parse a .pptx buffer into TEACH slides (and optional master layouts).
 */
export async function parsePptxBuffer(
  buffer: Buffer,
  uploadImage?: PptxImageUploader,
): Promise<PptxImportResult> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(buffer);

  const presFile = zip.file("ppt/presentation.xml");
  if (!presFile) {
    throw new Error("Invalid PPTX: missing ppt/presentation.xml");
  }

  const presXml = await presFile.async("string");
  const presDoc = xmlParser.parse(presXml);
  const presentation = presDoc?.presentation as Record<string, unknown> | undefined;
  const sldSz = presentation?.sldSz as Record<string, unknown> | undefined;
  const slideCx = Number(sldSz?.["@_cx"] ?? DEFAULT_SLIDE_CX);
  const slideCy = Number(sldSz?.["@_cy"] ?? DEFAULT_SLIDE_CY);

  const presRelsFile = zip.file("ppt/_rels/presentation.xml.rels");
  const presRels = presRelsFile ? parseRels(await presRelsFile.async("string")) : new Map<string, string>();

  const slideEntries: Array<{ path: string; notesPath?: string }> = [];
  for (const sldId of asArray(presentation?.sldIdLst?.sldId)) {
    const rid = relAttr(sldId as Record<string, unknown>, "r:id", "id");
    if (!rid) continue;
    const target = presRels.get(rid);
    if (!target) continue;
    const slidePath = resolveTarget("ppt/presentation.xml", target);
    slideEntries.push({ path: slidePath });
  }

  if (slideEntries.length === 0) {
    warnings.push("No slides found; creating empty presentation");
    return { slides: [], masterSlides: createDefaultMasterSlides(), warnings };
  }

  // Link notes slides via slide rels
  for (let i = 0; i < slideEntries.length; i++) {
    const slidePath = slideEntries[i]!.path;
    const relPath = `${slidePath.replace("ppt/slides/", "ppt/slides/_rels/")}.rels`;
    const relFile = zip.file(relPath);
    if (!relFile) continue;
    const rels = parseRels(await relFile.async("string"));
    for (const [, target] of rels) {
      if (target.includes("notesSlide")) {
        slideEntries[i]!.notesPath = resolveTarget(slidePath, target);
        break;
      }
    }
  }

  const imageUploader: PptxImageUploader | null = uploadImage ?? null;

  const slides: TeachSlide[] = [];
  for (let i = 0; i < slideEntries.length; i++) {
    const { path, notesPath } = slideEntries[i]!;
    const slideFile = zip.file(path);
    if (!slideFile) {
      warnings.push(`Missing slide file: ${path}`);
      continue;
    }
    const slideXml = await slideFile.async("string");
    const relPath = `${path.replace("ppt/slides/", "ppt/slides/_rels/")}.rels`;
    const relFile = zip.file(relPath);
    const rels = relFile ? parseRels(await relFile.async("string")) : new Map<string, string>();

    let notesText = "";
    if (notesPath) {
      const notesFile = zip.file(notesPath);
      if (notesFile) notesText = extractNotesText(await notesFile.async("string"));
    }

    slides.push(
      await parseSlideXml(
        slideXml,
        path,
        rels,
        slideCx,
        slideCy,
        i,
        imageUploader,
        zip,
        warnings,
        notesText,
      ),
    );
  }

  const masterSlides: TeachMasterSlide[] = [];
  for (const sldMasterId of asArray(presentation?.sldMasterIdLst?.sldMasterId)) {
    const rid = relAttr(sldMasterId as Record<string, unknown>, "r:id", "id");
    if (!rid) continue;
    const target = presRels.get(rid);
    if (!target) continue;
    const masterPath = resolveTarget("ppt/presentation.xml", target);
    const masterFile = zip.file(masterPath);
    if (!masterFile) continue;
    const masterRelsPath = `${masterPath.replace("ppt/slideMasters/", "ppt/slideMasters/_rels/")}.rels`;
    const masterRelsFile = zip.file(masterRelsPath);
    const masterRels = masterRelsFile ? parseRels(await masterRelsFile.async("string")) : new Map();
    masterSlides.push(
      await parseMasterXml(
        await masterFile.async("string"),
        masterPath,
        masterRels,
        slideCx,
        slideCy,
        masterSlides.length,
        zip,
      ),
    );
  }

  return {
    slides: slides.length > 0 ? slides : [],
    masterSlides: masterSlides.length > 0 ? masterSlides : createDefaultMasterSlides(),
    warnings,
  };
}

/** Build a minimal valid .pptx zip for tests */
export async function buildMinimalTestPptx(slides: Array<{ title: string; body?: string }>): Promise<Buffer> {
  const zip = new JSZip();

  const slideXml = (title: string, body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr b="1" sz="4400"/><a:t>${title}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>${body}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  const slidePaths: string[] = [];
  slides.forEach((s, i) => {
    const name = `ppt/slides/slide${i + 1}.xml`;
    slidePaths.push(name);
    zip.file(name, slideXml(s.title, s.body ?? ""));
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  });

  const sldIdLst = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join("");

  const presRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
    )
    .join("");

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIdLst}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`,
  );

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${presRels}
</Relationships>`,
  );

  zip.file(
    "ppt/slideMasters/slideMaster1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="179CA3"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr/><p:grpSpPr/></p:spTree></p:cSld>
</p:sldMaster>`,
  );

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
  );

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
