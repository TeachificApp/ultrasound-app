import { describe, expect, it } from "vitest";
import {
  clampEditorSettingsPanelWidth,
  defaultEditorSettingsPanelWidth,
  isConvertedDocumentBlock,
  preferredConvertedDocumentPanelWidth,
} from "../shared/convertedDocumentBlock";

describe("converted document block helpers", () => {
  it("detects converted PDF and PowerPoint rich-text blocks", () => {
    expect(isConvertedDocumentBlock({ sourceDocument: { kind: "pdf" } })).toBe(true);
    expect(isConvertedDocumentBlock({ pptxSlide: { version: 1 } })).toBe(true);
    expect(isConvertedDocumentBlock({ html: '<div data-pptx-slide-layout="1"></div>' })).toBe(true);
    expect(isConvertedDocumentBlock({ html: "<p>Normal lesson text</p>" })).toBe(false);
  });

  it("clamps editor panel widths to a customizable but bounded range", () => {
    expect(clampEditorSettingsPanelWidth(200, 1200)).toBe(300);
    expect(clampEditorSettingsPanelWidth(2000, 1200)).toBe(1104);
    expect(defaultEditorSettingsPanelWidth(1200)).toBe(780);
    expect(preferredConvertedDocumentPanelWidth(1200)).toBe(780);
  });
});
