/**
 * formHtmlExtractor.ts
 *
 * Converts raw HTML from a form page into a structured JSON representation
 * that can be sent to the AI for form scaffolding. This replaces the old
 * approach of stripping all HTML to plain text and truncating to 5-6k chars.
 *
 * Key improvements:
 * 1. Preserves field types, labels, options, required markers
 * 2. Extracts ALL hidden RESULT_* fields (reveals multi-page field inventory)
 * 3. Extracts images (src URLs), headings, and rich text blocks
 * 4. Extracts scoring-related JS hints
 * 5. Handles Formsite, JotForm, Google Forms, and generic HTML forms
 */

export interface ExtractedField {
  id: string;
  type: string; // input type or element type
  name: string;
  label: string;
  required: boolean;
  options?: string[]; // for select/radio/checkbox
  placeholder?: string;
  helpText?: string;
  isHidden?: boolean; // hidden input (may be from another page)
}

export interface ExtractedFormData {
  title: string;
  description: string;
  platform: string; // "formsite" | "typeform" | "jotform" | "google" | "generic"
  pages: number; // detected page count
  visibleFields: ExtractedField[];
  hiddenFields: ExtractedField[]; // fields from other pages embedded as hidden
  images: string[]; // image src URLs
  headings: string[]; // h1-h4 text content
  richTextBlocks: string[]; // p/div text blocks that aren't labels
  scoringHints: string[]; // JS snippets or text mentioning scoring/points
  rawStructuredText: string; // fallback: structured text representation
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x[0-9a-f]+;/gi, "")
    .replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function detectPlatform(html: string, url: string): string {
  if (url.includes("formsite.com")) return "formsite";
  if (url.includes("typeform.com")) return "typeform";
  if (url.includes("jotform.com")) return "jotform";
  if (url.includes("docs.google.com/forms")) return "google";
  if (html.includes("formsite.com") || html.includes("fs23.formsite")) return "formsite";
  if (html.includes("jotform.com")) return "jotform";
  return "generic";
}

function extractFormsite(html: string): Partial<ExtractedFormData> {
  const visibleFields: ExtractedField[] = [];
  const hiddenFields: ExtractedField[] = [];

  // Extract all label+input pairs
  const labelInputRe = /<label[^>]*for="([^"]*)"[^>]*>([\s\S]*?)<\/label>/gi;
  const labelMap: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = labelInputRe.exec(html)) !== null) {
    labelMap[m[1]] = stripTags(m[2]);
  }

  // Extract all inputs
  const inputRe = /<input([^>]*)>/gi;
  while ((m = inputRe.exec(html)) !== null) {
    const attrs = m[1];
    const typeM = /type="([^"]+)"/.exec(attrs);
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /id="([^"]+)"/.exec(attrs);
    const placeholderM = /placeholder="([^"]+)"/.exec(attrs);
    const requiredM = /required|class="[^"]*required[^"]*"/.test(attrs);

    if (!nameM) continue;
    const name = nameM[1];
    const id = idM ? idM[1] : name;
    const type = typeM ? typeM[1] : "text";
    const label = labelMap[id] || labelMap[name] || "";
    const placeholder = placeholderM ? placeholderM[1] : "";

    const field: ExtractedField = { id, type, name, label, required: requiredM, placeholder };

    if (type === "hidden") {
      // Hidden fields reveal fields from other pages
      if (name.startsWith("RESULT_")) {
        hiddenFields.push({ ...field, isHidden: true });
      }
    } else if (type !== "submit" && type !== "button" && type !== "image") {
      visibleFields.push(field);
    }
  }

  // Extract select fields
  const selectRe = /<select([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = selectRe.exec(html)) !== null) {
    const attrs = m[1];
    const optionsHtml = m[2];
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /id="([^"]+)"/.exec(attrs);
    if (!nameM) continue;
    const name = nameM[1];
    const id = idM ? idM[1] : name;
    const label = labelMap[id] || labelMap[name] || "";
    const options: string[] = [];
    const optRe = /<option[^>]*>([\s\S]*?)<\/option>/gi;
    let optM: RegExpExecArray | null;
    while ((optM = optRe.exec(optionsHtml)) !== null) {
      const optText = stripTags(optM[1]).trim();
      if (optText && optText !== "Select...") options.push(optText);
    }
    visibleFields.push({ id, type: "select", name, label, required: false, options });
  }

  // Extract radio/checkbox groups
  const radioGroups: Record<string, string[]> = {};
  const radioRe = /<input[^>]*type="(?:radio|checkbox)"[^>]*name="([^"]+)"[^>]*>/gi;
  while ((m = radioRe.exec(html)) !== null) {
    const name = m[1];
    if (!radioGroups[name]) radioGroups[name] = [];
    // Find the label for this specific radio
    const idM = /id="([^"]+)"/.exec(m[0]);
    if (idM) {
      const optLabel = labelMap[idM[1]];
      if (optLabel && !radioGroups[name].includes(optLabel)) {
        radioGroups[name].push(optLabel);
      }
    }
  }
  for (const [name, options] of Object.entries(radioGroups)) {
    const existing = visibleFields.find(f => f.name === name);
    if (existing) {
      existing.options = options;
    }
  }

  // Extract images
  const images: string[] = [];
  const imgRe = /<img[^>]*src="([^"]+)"[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const src = m[1];
    if (!src.includes("formsite.com/res/") && !src.includes("button") && !src.includes("icon")) {
      images.push(src);
    }
  }

  // Extract headings
  const headings: string[] = [];
  const headingRe = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  while ((m = headingRe.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) headings.push(text);
  }

  // Extract rich text paragraphs (not inside labels)
  const richTextBlocks: string[] = [];
  const paraRe = /<p[^>]*class="[^"]*(?:description|help|info|note|rich)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = paraRe.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text && text.length > 10) richTextBlocks.push(text);
  }

  // Detect page count from pagination elements
  const pageCountM = /(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:pages?|steps?)/i.exec(html);
  const pages = pageCountM ? parseInt(pageCountM[2]) : (hiddenFields.length > 5 ? 2 : 1);

  // Scoring hints
  const scoringHints: string[] = [];
  const scoreRe = /(?:score|points?|passing|threshold|correct)[^<\n]{0,150}/gi;
  while ((m = scoreRe.exec(html)) !== null) {
    const hint = m[0].trim();
    if (hint.length > 10 && !scoringHints.includes(hint)) scoringHints.push(hint);
    if (scoringHints.length >= 5) break;
  }

  return { visibleFields, hiddenFields, images, headings, richTextBlocks, scoringHints, pages };
}

function extractGeneric(html: string): Partial<ExtractedFormData> {
  const visibleFields: ExtractedField[] = [];
  const hiddenFields: ExtractedField[] = [];

  // Build label map
  const labelMap: Record<string, string> = {};
  const labelRe = /<label[^>]*(?:for="([^"]*)")?[^>]*>([\s\S]*?)<\/label>/gi;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(html)) !== null) {
    if (m[1]) labelMap[m[1]] = stripTags(m[2]);
  }

  // Extract inputs
  const inputRe = /<input([^>]*)>/gi;
  while ((m = inputRe.exec(html)) !== null) {
    const attrs = m[1];
    const typeM = /type="([^"]+)"/.exec(attrs);
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /id="([^"]+)"/.exec(attrs);
    const placeholderM = /placeholder="([^"]+)"/.exec(attrs);
    const requiredM = /\brequired\b/.test(attrs);
    if (!nameM) continue;
    const name = nameM[1];
    const id = idM ? idM[1] : name;
    const type = typeM ? typeM[1] : "text";
    const label = labelMap[id] || labelMap[name] || "";
    const placeholder = placeholderM ? placeholderM[1] : "";
    const field: ExtractedField = { id, type, name, label, required: requiredM, placeholder };
    if (type === "hidden") hiddenFields.push({ ...field, isHidden: true });
    else if (!["submit", "button", "image", "reset"].includes(type)) visibleFields.push(field);
  }

  // Extract textareas
  const textareaRe = /<textarea([^>]*)>/gi;
  while ((m = textareaRe.exec(html)) !== null) {
    const attrs = m[1];
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /id="([^"]+)"/.exec(attrs);
    const requiredM = /\brequired\b/.test(attrs);
    if (!nameM) continue;
    const name = nameM[1];
    const id = idM ? idM[1] : name;
    visibleFields.push({ id, type: "textarea", name, label: labelMap[id] || labelMap[name] || "", required: requiredM });
  }

  // Extract selects
  const selectRe = /<select([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = selectRe.exec(html)) !== null) {
    const attrs = m[1];
    const nameM = /name="([^"]+)"/.exec(attrs);
    const idM = /id="([^"]+)"/.exec(attrs);
    if (!nameM) continue;
    const name = nameM[1];
    const id = idM ? idM[1] : name;
    const options: string[] = [];
    const optRe = /<option[^>]*>([\s\S]*?)<\/option>/gi;
    let optM: RegExpExecArray | null;
    while ((optM = optRe.exec(m[2])) !== null) {
      const t = stripTags(optM[1]).trim();
      if (t) options.push(t);
    }
    visibleFields.push({ id, type: "select", name, label: labelMap[id] || labelMap[name] || "", required: false, options });
  }

  // Images, headings, rich text
  const images: string[] = [];
  const imgRe = /<img[^>]*src="([^"]+)"[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) images.push(m[1]);

  const headings: string[] = [];
  const hRe = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  while ((m = hRe.exec(html)) !== null) {
    const t = stripTags(m[1]).trim();
    if (t) headings.push(t);
  }

  const richTextBlocks: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(html)) !== null) {
    const t = stripTags(m[1]).trim();
    if (t.length > 20 && !t.includes("©") && !t.includes("Privacy")) richTextBlocks.push(t.substring(0, 200));
    if (richTextBlocks.length >= 10) break;
  }

  const scoringHints: string[] = [];
  const scoreRe = /(?:score|points?|passing|threshold|correct)[^<\n]{0,150}/gi;
  while ((m = scoreRe.exec(html)) !== null) {
    const hint = m[0].trim();
    if (hint.length > 10) scoringHints.push(hint);
    if (scoringHints.length >= 5) break;
  }

  return { visibleFields, hiddenFields, images, headings, richTextBlocks, scoringHints, pages: 1 };
}

/**
 * Main extraction function. Fetches the URL and returns structured form data.
 */
export async function extractFormFromUrl(url: string): Promise<ExtractedFormData> {
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    html = await res.text();
  } catch {
    html = "";
  }

  const platform = detectPlatform(html, url);

  // Extract title
  const titleM = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const ogTitleM = /property="og:title"[^>]*content="([^"]+)"/i.exec(html);
  const h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const title = ogTitleM ? stripTags(ogTitleM[1]) :
    titleM ? stripTags(titleM[1]) :
    h1M ? stripTags(h1M[1]) : "Imported Form";

  // Extract description
  const descM = /name="description"[^>]*content="([^"]+)"/i.exec(html) ||
    /property="og:description"[^>]*content="([^"]+)"/i.exec(html);
  const description = descM ? descM[1] : "";

  // Platform-specific extraction
  const extracted = platform === "formsite" ? extractFormsite(html) : extractGeneric(html);

  const {
    visibleFields = [],
    hiddenFields = [],
    images = [],
    headings = [],
    richTextBlocks = [],
    scoringHints = [],
    pages = 1,
  } = extracted;

  // Build a structured text representation for the AI prompt
  const lines: string[] = [];
  lines.push(`=== FORM: ${title} ===`);
  if (description) lines.push(`Description: ${description}`);
  lines.push(`Platform: ${platform} | Pages: ${pages}`);
  lines.push("");

  if (headings.length > 0) {
    lines.push("--- HEADINGS ---");
    headings.forEach(h => lines.push(`  H: ${h}`));
    lines.push("");
  }

  if (images.length > 0) {
    lines.push("--- IMAGES ---");
    images.slice(0, 5).forEach(src => lines.push(`  IMG: ${src}`));
    lines.push("");
  }

  if (richTextBlocks.length > 0) {
    lines.push("--- RICH TEXT BLOCKS ---");
    richTextBlocks.slice(0, 8).forEach(t => lines.push(`  TEXT: ${t}`));
    lines.push("");
  }

  if (visibleFields.length > 0) {
    lines.push("--- VISIBLE FIELDS (current page) ---");
    visibleFields.forEach(f => {
      const opts = f.options && f.options.length > 0 ? ` OPTIONS=[${f.options.join(" | ")}]` : "";
      const req = f.required ? " *REQUIRED*" : "";
      const ph = f.placeholder ? ` placeholder="${f.placeholder}"` : "";
      lines.push(`  [${f.name}] type=${f.type} label="${f.label}"${req}${ph}${opts}`);
    });
    lines.push("");
  }

  if (hiddenFields.length > 0) {
    lines.push(`--- HIDDEN FIELDS (from other pages, ${hiddenFields.length} total) ---`);
    // Group by type pattern
    const byType: Record<string, string[]> = {};
    hiddenFields.forEach(f => {
      const typeKey = f.name.replace(/-\d+$/, "");
      if (!byType[typeKey]) byType[typeKey] = [];
      byType[typeKey].push(f.name);
    });
    Object.entries(byType).forEach(([type, names]) => {
      lines.push(`  ${type}: ${names.length} fields (${names.slice(0, 3).join(", ")}${names.length > 3 ? "..." : ""})`);
    });
    lines.push("  NOTE: These hidden fields indicate the form has multiple pages. Infer their content from context.");
    lines.push("");
  }

  if (scoringHints.length > 0) {
    lines.push("--- SCORING HINTS ---");
    scoringHints.forEach(h => lines.push(`  ${h}`));
    lines.push("");
  }

  const rawStructuredText = lines.join("\n");

  return {
    title,
    description,
    platform,
    pages,
    visibleFields,
    hiddenFields,
    images,
    headings,
    richTextBlocks,
    scoringHints,
    rawStructuredText,
  };
}
