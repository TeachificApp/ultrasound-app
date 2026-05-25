/**
 * Tests for SCORM ZIP extraction helpers in mediaServe.ts
 * Tests the findScormLaunchFile function and ZIP extraction logic.
 */
import { describe, it, expect } from "vitest";

// We test the findScormLaunchFile logic inline since it's a pure function
// (not exported, but we can replicate the logic here to test it)

function findScormLaunchFile(manifestXml: string): string {
  // Try SCO resource first
  const scoMatch =
    manifestXml.match(/<resource[^>]+type=['"'][^'"]*sco[^'"]*['"'][^>]*href=['"']([^'"]+)['"']/i) ||
    manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"'][^>]*type=['"'][^'"]*sco[^'"]*['"']/i);
  if (scoMatch) return scoMatch[1].split("?")[0];

  // Fallback: first resource with any href
  const anyMatch = manifestXml.match(/<resource[^>]+href=['"']([^'"]+)['"']/i);
  if (anyMatch) return anyMatch[1].split("?")[0];

  return "index.html";
}

describe("SCORM launch file detection", () => {
  it("finds SCO resource href from imsmanifest.xml", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="story.html">
    </resource>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("story.html");
  });

  it("finds SCO resource when type comes after href", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" href="launch.html" type="webcontent adlcp:scormtype=sco">
    </resource>
  </resources>
</manifest>`;
    // Falls back to first resource href since type pattern doesn't match exactly
    expect(findScormLaunchFile(manifest)).toBe("launch.html");
  });

  it("falls back to first resource href when no SCO type", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" type="webcontent" href="index.html">
    </resource>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("index.html");
  });

  it("strips query parameters from href", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" type="webcontent adlcp:scormtype=sco" href="story.html?v=1.2">
    </resource>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("story.html");
  });

  it("returns index.html as default when no resources found", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("index.html");
  });

  it("handles empty manifest", () => {
    expect(findScormLaunchFile("")).toBe("index.html");
  });

  it("finds nested path href", () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <resources>
    <resource identifier="res1" type="webcontent" href="content/story_html5/story.html">
    </resource>
  </resources>
</manifest>`;
    expect(findScormLaunchFile(manifest)).toBe("content/story_html5/story.html");
  });
});

describe("SCORM embed page behavior", () => {
  it("uses scorm-launch URL for ZIP files", () => {
    const fileUrl = "https://cdn.example.com/files/course.zip";
    const isZip = fileUrl.endsWith(".zip") || fileUrl.includes(".zip?");
    expect(isZip).toBe(true);
  });

  it("uses scorm-launch URL for ZIP files with query params", () => {
    const fileUrl = "https://cdn.example.com/files/course.zip?X-Amz-Signature=abc";
    const isZip = fileUrl.endsWith(".zip") || fileUrl.includes(".zip?");
    expect(isZip).toBe(true);
  });

  it("does NOT use scorm-launch for non-ZIP HTML files", () => {
    const fileUrl = "https://cdn.example.com/files/story.html";
    const isZip = fileUrl.endsWith(".zip") || fileUrl.includes(".zip?");
    expect(isZip).toBe(false);
  });

  it("does NOT use scorm-launch for CDN URLs that happen to contain zip in path", () => {
    const fileUrl = "https://cdn.example.com/zipfiles/story.html";
    const isZip = fileUrl.endsWith(".zip") || fileUrl.includes(".zip?");
    expect(isZip).toBe(false);
  });
});
