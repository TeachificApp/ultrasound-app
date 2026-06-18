import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMinimalTestPptx } from "./lib/pptxImport";
import {
  TEACH_IMPORT_FAILED_PREFIX,
  TEACH_IMPORT_PENDING,
  parseAndUpdateTeachMaterial,
} from "./lib/teachPptxMaterialImport";

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./lib/downloadStorageObject", () => ({
  downloadStorageObject: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `https://storage.example/${key}` })),
}));

import { getDb } from "./db";
import { downloadStorageObject } from "./lib/downloadStorageObject";

describe("teachPptxMaterialImport", () => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockResolvedValue([{ insertId: 99 }]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue({
      insert: vi.fn().mockReturnValue({ values: mockInsert }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: mockUpdate }) }),
    } as any);
  });

  it("marks pending imports with a sentinel description", () => {
    expect(TEACH_IMPORT_PENDING).toBe("__import_pending__");
    expect(TEACH_IMPORT_FAILED_PREFIX).toBe("IMPORT_FAILED:");
  });

  it("parses pptx buffer and updates the material row", async () => {
    const buffer = await buildMinimalTestPptx([{ title: "Slide A", body: "Hello" }]);
    vi.mocked(downloadStorageObject).mockResolvedValue(buffer);

    const result = await parseAndUpdateTeachMaterial(12, {
      userId: 1,
      assetId: 5,
      s3Key: "media-repo/test/v1-deck.pptx",
      s3Url: "https://cdn.example/media-repo/test/v1-deck.pptx",
      fileName: "deck.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileSize: buffer.length,
      title: "Deck",
      ownerContext: "lms_instructor",
    });

    expect(downloadStorageObject).toHaveBeenCalledWith(
      "media-repo/test/v1-deck.pptx",
      "https://cdn.example/media-repo/test/v1-deck.pptx",
    );
    expect(result.parsed).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
