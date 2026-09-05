export function isConvertedDocumentBlock(data: Record<string, unknown> | null | undefined) {
  if (!data) return false;
  if (data.sourceDocument) return true;
  if (data.pptxSlide) return true;
  const html = typeof data.html === "string" ? data.html : "";
  return html.includes("data-pptx-slide-layout");
}

export const CONVERTED_DOCUMENT_PANEL_WIDTH_RATIO = 0.65;
export const CONVERTED_DOCUMENT_PANEL_MIN_WIDTH_RATIO = 0.5;
export const EDITOR_SETTINGS_PANEL_MIN_WIDTH = 300;
export const EDITOR_SETTINGS_PANEL_MAX_WIDTH_RATIO = 0.92;

export function clampEditorSettingsPanelWidth(width: number, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280) {
  const max = Math.round(viewportWidth * EDITOR_SETTINGS_PANEL_MAX_WIDTH_RATIO);
  const min = EDITOR_SETTINGS_PANEL_MIN_WIDTH;
  return Math.min(max, Math.max(min, Math.round(width)));
}

export function defaultEditorSettingsPanelWidth(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280) {
  return clampEditorSettingsPanelWidth(Math.round(viewportWidth * CONVERTED_DOCUMENT_PANEL_WIDTH_RATIO), viewportWidth);
}

export function preferredConvertedDocumentPanelWidth(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280) {
  return clampEditorSettingsPanelWidth(Math.round(viewportWidth * CONVERTED_DOCUMENT_PANEL_WIDTH_RATIO), viewportWidth);
}
