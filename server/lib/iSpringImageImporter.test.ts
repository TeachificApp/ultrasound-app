import { beforeEach, describe, expect, it, vi } from "vitest";

const { storagePut, downloadStorageObject } = vi.hoisted(() => ({
  storagePut: vi.fn(),
  downloadStorageObject: vi.fn(),
}));

vi.mock("../storage", () => ({ storagePut }));
vi.mock("./downloadStorageObject", () => ({ downloadStorageObject }));

import { uploadISpringMediaFromExtractedPrefix, uploadISpringMediaFromZip } from "./iSpringImageImporter";

describe("uploadISpringMediaFromZip", () => {
  beforeEach(() => {
    storagePut.mockReset();
    storagePut.mockImplementation(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    downloadStorageObject.mockReset();
  });

  it("copies packaged question and answer image/video assets referenced by local paths or storage URIs", async () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const video = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const result = await uploadISpringMediaFromZip([
      { entryName: "data/images/question.png", getData: () => image },
      { entryName: "data/video/choice.webm", getData: () => video },
      { entryName: "data/storage/feedback.mp4", getData: () => video },
    ], [
      "data/images/question.png",
      "data/video/choice.webm",
      "storage://feedback.mp4",
    ]);

    expect(result.get("data/images/question.png")).toContain("question.png");
    expect(result.get("data/video/choice.webm")).toContain("choice.webm");
    expect(result.get("storage://feedback.mp4")).toContain("feedback.mp4");
    expect(storagePut).toHaveBeenCalledTimes(3);
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/question\.png$/), image, "image/png");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/choice\.webm$/), video, "video/webm");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/feedback\.mp4$/), video, "video/mp4");
  });

  it("matches common iSpring relative, URL-encoded, and cache-query media paths to the archived package entries", async () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const video = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const result = await uploadISpringMediaFromZip([
      { entryName: "data/images/fetal heart.png", getData: () => image },
      { entryName: "data/video/clip.mp4", getData: () => video },
    ], [
      "./data/images/fetal%20heart.png?cache=1",
      "/data/video/clip.mp4#poster",
    ]);

    expect(result.get("./data/images/fetal%20heart.png?cache=1")).toContain("fetal heart.png");
    expect(result.get("/data/video/clip.mp4#poster")).toContain("clip.mp4");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/fetal heart\.png$/), image, "image/png");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/clip\.mp4$/), video, "video/mp4");
  });

  it("copies relative image and storage-URI video files from an extracted Media Repository SCORM prefix", async () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const video = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
    downloadStorageObject.mockImplementation(async (key: string) => {
      if (key === "scorm/source/data/images/question.png") return image;
      if (key === "scorm/source/data/storage/feedback.mp4") return video;
      throw new Error("not found");
    });

    const result = await uploadISpringMediaFromExtractedPrefix("scorm/source", [
      "./data/images/question.png?cache=1",
      "storage://feedback.mp4",
    ]);

    expect(result.get("./data/images/question.png?cache=1")).toContain("question.png");
    expect(result.get("storage://feedback.mp4")).toContain("feedback.mp4");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/question\.png$/), image, "image/png");
    expect(storagePut).toHaveBeenCalledWith(expect.stringMatching(/feedback\.mp4$/), video, "video/mp4");
  });
});
