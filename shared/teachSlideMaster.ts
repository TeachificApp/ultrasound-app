/**
 * TEACH slide masters — layout templates with placeholders, apply/force to presentations.
 */

import {
  type TeachSlide,
  type TeachSlideElement,
  createTextElement,
  createTitleElement,
  createBodyElement,
  createShapeElement,
  newElementId,
  newSlideId,
  normalizeSlide,
  DEFAULT_TEXT_STYLE,
} from "./teachPresentation";

export type TeachMasterLayoutRole =
  | "title"
  | "titleAndContent"
  | "sectionHeader"
  | "twoContent"
  | "blank"
  | "custom";

export type TeachPlaceholderRole = "title" | "subtitle" | "body" | "body2" | "media" | "footer";

export interface TeachMasterSlide {
  id: string;
  name: string;
  layoutRole: TeachMasterLayoutRole;
  backgroundColor?: string;
  backgroundImage?: string;
  elements: TeachSlideElement[];
}

export const MASTER_LAYOUT_LABELS: Record<TeachMasterLayoutRole, string> = {
  title: "Title slide",
  titleAndContent: "Title and content",
  sectionHeader: "Section header",
  twoContent: "Two content",
  blank: "Blank",
  custom: "Custom",
};

export function createPlaceholderElement(
  role: TeachPlaceholderRole,
  partial?: Partial<TeachSlideElement>,
): TeachSlideElement {
  const base =
    role === "title"
      ? createTitleElement()
      : role === "body" || role === "body2"
        ? createBodyElement()
        : role === "subtitle"
          ? createTextElement({
              content: "Subtitle",
              y: 22,
              height: 10,
              style: { ...DEFAULT_TEXT_STYLE, fontSize: 22, textAlign: "center", color: "#6b7280" },
            })
          : createTextElement({
              content: role === "footer" ? "Footer" : "Click to add content",
              y: role === "footer" ? 88 : 40,
              height: role === "footer" ? 8 : 40,
              style: {
                ...DEFAULT_TEXT_STYLE,
                fontSize: role === "footer" ? 12 : 20,
                textAlign: role === "footer" ? "center" : "left",
                color: role === "footer" ? "#9ca3af" : DEFAULT_TEXT_STYLE.color,
              },
            });

  return {
    ...base,
    placeholderRole: role,
    ...partial,
  };
}

export function createDefaultMasterSlide(role: TeachMasterLayoutRole, index: number): TeachMasterSlide {
  const id = newSlideId();
  const name = MASTER_LAYOUT_LABELS[role] ?? `Layout ${index + 1}`;

  const decorativeBar = (): TeachSlideElement => ({
    ...createShapeElement(),
    id: newElementId(),
    y: 0,
    height: 4,
    width: 100,
    x: 0,
    fill: "#179ca3",
    stroke: "transparent",
    zIndex: 0,
  });

  switch (role) {
    case "title":
      return {
        id,
        name,
        layoutRole: role,
        backgroundColor: "#ffffff",
        elements: [decorativeBar(), createPlaceholderElement("title"), createPlaceholderElement("subtitle")],
      };
    case "sectionHeader":
      return {
        id,
        name,
        layoutRole: role,
        backgroundColor: "#179ca3",
        elements: [
          createPlaceholderElement("title", {
            style: { ...DEFAULT_TEXT_STYLE, fontSize: 40, fontWeight: "bold", textAlign: "center", color: "#ffffff" },
            y: 38,
            height: 18,
          }),
        ],
      };
    case "twoContent":
      return {
        id,
        name,
        layoutRole: role,
        backgroundColor: "#ffffff",
        elements: [
          decorativeBar(),
          createPlaceholderElement("title", { y: 10, height: 12 }),
          createPlaceholderElement("body", { x: 5, y: 26, width: 42, height: 62 }),
          createPlaceholderElement("body2", { x: 53, y: 26, width: 42, height: 62 }),
        ],
      };
    case "blank":
      return { id, name, layoutRole: role, backgroundColor: "#ffffff", elements: [decorativeBar()] };
    case "custom":
      return {
        id,
        name,
        layoutRole: role,
        backgroundColor: "#ffffff",
        elements: [decorativeBar(), createPlaceholderElement("title"), createPlaceholderElement("body")],
      };
    case "titleAndContent":
    default:
      return {
        id,
        name,
        layoutRole: "titleAndContent",
        backgroundColor: "#ffffff",
        elements: [
          decorativeBar(),
          createPlaceholderElement("title", { y: 10, height: 14 }),
          createPlaceholderElement("body", { y: 28, height: 58 }),
        ],
      };
  }
}

export function createDefaultMasterSlides(): TeachMasterSlide[] {
  return [
    createDefaultMasterSlide("title", 0),
    createDefaultMasterSlide("titleAndContent", 1),
    createDefaultMasterSlide("sectionHeader", 2),
    createDefaultMasterSlide("blank", 3),
  ];
}

export function normalizeMasterSlide(raw: unknown, index: number): TeachMasterSlide {
  if (!raw || typeof raw !== "object") {
    return createDefaultMasterSlide("titleAndContent", index);
  }
  const s = raw as Record<string, unknown>;
  const layoutRole =
    typeof s.layoutRole === "string"
      ? (s.layoutRole as TeachMasterLayoutRole)
      : "titleAndContent";
  const slide = normalizeSlide(raw, index);
  return {
    id: slide.id,
    name: typeof s.name === "string" ? s.name : MASTER_LAYOUT_LABELS[layoutRole] ?? `Layout ${index + 1}`,
    layoutRole,
    backgroundColor: slide.backgroundColor,
    backgroundImage: slide.backgroundImage,
    elements: slide.elements.map((el) => {
      const e = el as TeachSlideElement & { placeholderRole?: TeachPlaceholderRole };
      return {
        ...el,
        placeholderRole: e.placeholderRole,
      };
    }),
  };
}

export function parseMasterSlides(raw: string | null | undefined): TeachMasterSlide[] {
  if (!raw) return createDefaultMasterSlides();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s, i) => normalizeMasterSlide(s, i));
    }
  } catch {
    /* ignore */
  }
  return createDefaultMasterSlides();
}

function isPlaceholder(el: TeachSlideElement): boolean {
  return !!(el as TeachSlideElement & { placeholderRole?: string }).placeholderRole;
}

function decorativeElements(master: TeachMasterSlide): TeachSlideElement[] {
  return master.elements
    .filter((el) => !isPlaceholder(el))
    .map((el) => ({ ...el, id: newElementId() }));
}

function placeholderElements(master: TeachMasterSlide): TeachSlideElement[] {
  return master.elements.filter((el) => isPlaceholder(el));
}

function extractSlideContent(slide: TeachSlide): {
  title: string;
  bodyTexts: string[];
  media: TeachSlideElement[];
  other: TeachSlideElement[];
} {
  const title = slide.title;
  const bodyTexts: string[] = [];
  const media: TeachSlideElement[] = [];
  const other: TeachSlideElement[] = [];

  for (const el of slide.elements) {
    const role = (el as TeachSlideElement & { placeholderRole?: string }).placeholderRole;
    if (role === "title" || (el.type === "text" && el.style?.fontWeight === "bold" && el.style.fontSize >= 28)) {
      if (el.content && el.content !== "Slide title" && el.content !== "Click to edit text") {
        /* title captured via slide.title */
      }
      continue;
    }
    if (el.type === "text" && el.content) {
      bodyTexts.push(el.content);
    } else if (el.type === "image" || el.type === "video") {
      media.push(el);
    } else if (!isPlaceholder(el)) {
      other.push(el);
    }
  }

  if (bodyTexts.length === 0 && slide.content) {
    bodyTexts.push(slide.content);
  }

  return { title, bodyTexts, media, other };
}

function fillPlaceholder(
  template: TeachSlideElement,
  role: TeachPlaceholderRole,
  content: { title: string; bodyTexts: string[]; media: TeachSlideElement[] },
  index: number,
): TeachSlideElement {
  const id = newElementId();
  if (role === "title") {
    return {
      ...template,
      id,
      type: "text",
      content: content.title || template.content || "Slide title",
      placeholderRole: role,
    };
  }
  if (role === "subtitle") {
    return { ...template, id, placeholderRole: role };
  }
  if (role === "body" || role === "body2") {
    const textIdx = role === "body2" ? 1 : 0;
    return {
      ...template,
      id,
      type: "text",
      content: content.bodyTexts[textIdx] ?? template.content ?? "",
      placeholderRole: role,
    };
  }
  if (role === "media" && content.media[index]) {
    const m = content.media[index]!;
    return { ...m, ...template, id, x: template.x, y: template.y, width: template.width, height: template.height, placeholderRole: role };
  }
  return { ...template, id, placeholderRole: role };
}

export function pickMasterLayout(
  masterSlides: TeachMasterSlide[],
  layoutRole?: TeachMasterLayoutRole | null,
): TeachMasterSlide {
  if (layoutRole) {
    const match = masterSlides.find((m) => m.layoutRole === layoutRole);
    if (match) return match;
  }
  return (
    masterSlides.find((m) => m.layoutRole === "titleAndContent") ??
    masterSlides[0] ??
    createDefaultMasterSlide("titleAndContent", 0)
  );
}

/** Merge master layout onto presentation slides; preserves slide titles, body text, and media. */
export function applyMasterToPresentation(
  presentationSlides: TeachSlide[],
  masterSlides: TeachMasterSlide[],
  options?: { defaultLayoutRole?: TeachMasterLayoutRole },
): TeachSlide[] {
  return presentationSlides.map((slide, slideIndex) => {
    const slideRole =
      (slide as TeachSlide & { masterLayoutRole?: TeachMasterLayoutRole }).masterLayoutRole ??
      (slideIndex === 0 ? "title" : options?.defaultLayoutRole ?? "titleAndContent");
    const master = pickMasterLayout(masterSlides, slideRole);
    const content = extractSlideContent(slide);
    const decor = decorativeElements(master);
    const placeholders = placeholderElements(master);
    let mediaIdx = 0;

    const filled = placeholders.map((ph) => {
      const role = (ph as TeachSlideElement & { placeholderRole: TeachPlaceholderRole }).placeholderRole;
      if (role === "media") {
        const el = fillPlaceholder(ph, role, content, mediaIdx);
        mediaIdx += 1;
        return el;
      }
      return fillPlaceholder(ph, role, content, 0);
    });

    return {
      ...slide,
      backgroundColor: master.backgroundColor ?? slide.backgroundColor,
      backgroundImage: master.backgroundImage ?? slide.backgroundImage,
      masterLayoutRole: master.layoutRole,
      elements: [...decor, ...filled],
    } as TeachSlide & { masterLayoutRole?: TeachMasterLayoutRole };
  });
}

export function masterSlidesToJson(slides: TeachMasterSlide[]): string {
  return JSON.stringify(slides);
}
