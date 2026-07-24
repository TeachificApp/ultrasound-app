import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { storagePut } from "./storage";
import { processRichTextHtml } from "./lib/processRichTextHtml";

const mockedStoragePut = vi.mocked(storagePut);

describe("processRichTextHtml", () => {
  beforeEach(() => {
    mockedStoragePut.mockReset();
    mockedStoragePut.mockResolvedValue({ url: "https://cdn.example.com/image.png", key: "rich-text/test/abc.png" });
  });

  it("returns html unchanged when no embedded images", async () => {
    const html = '<p>Hello <img src="https://example.com/a.jpg" alt="a" /></p>';
    await expect(processRichTextHtml(html)).resolves.toBe(html);
    expect(mockedStoragePut).not.toHaveBeenCalled();
  });

  it("uploads and replaces a base64 image src", async () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    const html = `<p>City</p><img src="${dataUri}" alt="Columbus.jpg" />`;

    const result = await processRichTextHtml(html, "cohort-session");

    expect(result).toBe('<p>City</p><img src="https://cdn.example.com/image.png" alt="Columbus.jpg" />');
    expect(mockedStoragePut).toHaveBeenCalledTimes(1);
    expect(mockedStoragePut).toHaveBeenCalledWith(
      expect.stringMatching(/^rich-text\/cohort-session\/.+\.png$/),
      expect.any(Buffer),
      "image/png",
    );
  });

  it("deduplicates identical embedded images", async () => {
    const dataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const html = `<img src='${dataUri}' /><img src='${dataUri}' />`;

    const result = await processRichTextHtml(html);

    expect(result).toBe(
      "<img src='https://cdn.example.com/image.png' /><img src='https://cdn.example.com/image.png' />",
    );
    expect(mockedStoragePut).toHaveBeenCalledTimes(1);
  });

  it("passes through null and empty values", async () => {
    await expect(processRichTextHtml(null)).resolves.toBeNull();
    await expect(processRichTextHtml(undefined)).resolves.toBeUndefined();
    await expect(processRichTextHtml("")).resolves.toBe("");
  });
});
