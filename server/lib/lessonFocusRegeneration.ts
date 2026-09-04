export type BlockTextField = {
  path: string;
  value: string;
};

const EDITABLE_TEXT_KEYS = new Set([
  "headline",
  "headline2",
  "heading",
  "subheadline",
  "subheading",
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
  "q",
  "a",
  "front",
  "back",
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
  const isRichTextHtml = lower === "html" || lower.endsWith("html");
  return (EDITABLE_TEXT_KEYS.has(lower) || isRichTextHtml) && !PROTECTED_KEY_PARTS.some(part => lower.includes(part));
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
  const walk = (value: unknown, path: string[], parentKey?: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemPath = [...path, String(index)];
        if (typeof item === "string" && item.trim() && parentKey === "items") {
          result.push({ path: itemPath.join("."), value: item });
        } else {
          walk(item, itemPath, parentKey);
        }
      });
      return;
    }
    if (!value || typeof value !== "object" || isQuizBlock(value)) return;

    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = [...path, key];
      if (typeof child === "string" && child.trim() && isEditableTextKey(key)) {
        result.push({ path: childPath.join("."), value: child });
      } else if (child && typeof child === "object") {
        walk(child, childPath, key);
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

type FocusProposalLike = {
  content: string;
  videoContent: string;
  blockText: BlockTextField[];
};

function normalizedInstructionalText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function materiallyChanged(source: string, proposal: string): boolean {
  return normalizedInstructionalText(source) !== normalizedInstructionalText(proposal);
}

/**
 * Rejects incomplete model output before an administrator can review or apply it.
 * A focus regeneration is a substantive instructional rewrite, not a title-only edit.
 */
export function assertSubstantiveFocusRegeneration(
  source: { content: string; videoContent: string; editableBlockText: BlockTextField[] },
  proposal: FocusProposalLike,
): void {
  if (source.content.trim() && (!proposal.content.trim() || !materiallyChanged(source.content, proposal.content))) {
    throw new Error("The instructional body was not substantively rewritten.");
  }
  if (source.videoContent.trim() && (!proposal.videoContent.trim() || !materiallyChanged(source.videoContent, proposal.videoContent))) {
    throw new Error("The video-supporting instructional text was not substantively rewritten.");
  }

  const sourceByPath = new Map(source.editableBlockText.map(field => [field.path, field.value]));
  const proposalPaths = proposal.blockText.map(field => field.path);
  if (new Set(proposalPaths).size !== proposalPaths.length || proposalPaths.length !== sourceByPath.size) {
    throw new Error("The editable block-text proposal is incomplete.");
  }
  for (const field of proposal.blockText) {
    const original = sourceByPath.get(field.path);
    if (original === undefined || !field.value.trim()) {
      throw new Error("The editable block-text proposal is incomplete.");
    }
  }

  const sourceText = [source.content, source.videoContent, ...source.editableBlockText.map(field => field.value)]
    .map(normalizedInstructionalText).join(" ").trim();
  const proposalText = [proposal.content, proposal.videoContent, ...proposal.blockText.map(field => field.value)]
    .map(normalizedInstructionalText).join(" ").trim();
  if (sourceText.length >= 400 && proposalText.length < sourceText.length * 0.35) {
    throw new Error("The instructional rewrite is too abbreviated.");
  }
}
