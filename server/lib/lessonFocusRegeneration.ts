export type BlockTextField = {
  path: string;
  value: string;
};

const EDITABLE_TEXT_KEYS = new Set([
  "headline",
  "headline2",
  "subheadline",
  "title",
  "subtitle",
  "content",
  "body",
  "text",
  "description",
  "caption",
  "intro",
  "summary",
  "message",
  "instructions",
  "quote",
]);

const PROTECTED_KEY_PARTS = [
  "url",
  "href",
  "src",
  "image",
  "video",
  "media",
  "asset",
  "color",
  "style",
  "class",
  "layout",
  "align",
  "position",
  "width",
  "height",
  "padding",
  "margin",
  "font",
  "button",
  "cta",
  "link",
  "id",
];

function isQuizBlock(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" && type.toLowerCase().includes("quiz");
}

function isEditableTextKey(key: string): boolean {
  const lower = key.toLowerCase();
  return EDITABLE_TEXT_KEYS.has(lower) && !PROTECTED_KEY_PARTS.some(part => lower.includes(part));
}

function safeParseBlocks(contentBlocks: string | null | undefined): unknown {
  if (!contentBlocks) return [];
  try {
    const parsed = JSON.parse(contentBlocks);
    return parsed && typeof parsed === "object" ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Extracts only text-bearing fields that can be rewritten without moving blocks,
 * changing their IDs/types, or touching URLs, media, styling, quiz blocks, and CTAs.
 */
export function collectEditableBlockText(contentBlocks: string | null | undefined): BlockTextField[] {
  const result: BlockTextField[] = [];
  const walk = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...path, String(index)]));
      return;
    }
    if (!value || typeof value !== "object" || isQuizBlock(value)) return;

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = [...path, key];
      if (typeof child === "string" && child.trim() && isEditableTextKey(key)) {
        result.push({ path: childPath.join("."), value: child });
      } else if (child && typeof child === "object") {
        walk(child, childPath);
      }
    }
  };
  walk(safeParseBlocks(contentBlocks), []);
  return result;
}

function setAtPath(root: unknown, path: string[], value: string): boolean {
  let current: any = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (!current || typeof current !== "object" || !(segment in current)) return false;
    current = current[segment];
  }
  const finalSegment = path[path.length - 1];
  if (!current || typeof current !== "object" || typeof current[finalSegment] !== "string") return false;
  current[finalSegment] = value;
  return true;
}

/**
 * Applies only replacements for paths that were extracted from the current lesson.
 * Unknown, empty, and oversized values are ignored so client-supplied proposals
 * cannot change lesson structure or non-text block properties.
 */
export function applyEditableBlockText(
  contentBlocks: string | null | undefined,
  replacements: BlockTextField[] | null | undefined,
): { contentBlocks: string | null; appliedCount: number } {
  if (!contentBlocks || !replacements?.length) return { contentBlocks: contentBlocks ?? null, appliedCount: 0 };
  const root = safeParseBlocks(contentBlocks);
  const allowedPaths = new Set(collectEditableBlockText(contentBlocks).map(field => field.path));
  let appliedCount = 0;
  for (const replacement of replacements) {
    const text = typeof replacement?.value === "string" ? replacement.value.trim() : "";
    if (!allowedPaths.has(replacement?.path) || !text || text.length > 50_000) continue;
    if (setAtPath(root, replacement.path.split("."), text)) appliedCount += 1;
  }
  return { contentBlocks: JSON.stringify(root), appliedCount };
}

export function stripCodeFences(value: string): string {
  return value.replace(/^```[\w-]*\n?/m, "").replace(/\n?```$/m, "").trim();
}
