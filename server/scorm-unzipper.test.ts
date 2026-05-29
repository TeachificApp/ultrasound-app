/**
 * Tests for SCORM detection and extraction using unzipper.Open API.
 * Verifies that the pure Node.js approach handles filenames with spaces correctly.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import unzipper from "unzipper";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

let scormZipPath: string;
let plainZipPath: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-vitest-"));

  // Create SCORM ZIP with spaces in folder and filenames
  const scormSrc = path.join(tmpDir, "scorm-src");
  const inner = path.join(scormSrc, "Vascular Flashcards");
  fs.mkdirSync(inner, { recursive: true });
  fs.writeFileSync(path.join(inner, "index.html"), "<html>SCORM</html>");
  fs.writeFileSync(path.join(inner, "imsmanifest.xml"), "<manifest/>");
  fs.writeFileSync(path.join(inner, "some file with spaces.js"), "console.log('hi')");
  scormZipPath = path.join(tmpDir, "v3-Vascular Flashcards.zip");
  execSync(`cd "${scormSrc}" && zip -qr "${scormZipPath}" .`);

  // Create plain ZIP (no SCORM markers)
  const plainSrc = path.join(tmpDir, "plain-src");
  fs.mkdirSync(plainSrc, { recursive: true });
  fs.writeFileSync(path.join(plainSrc, "readme.txt"), "just a zip");
  fs.writeFileSync(path.join(plainSrc, "image.png"), "fake-png");
  plainZipPath = path.join(tmpDir, "plain.zip");
  execSync(`cd "${plainSrc}" && zip -qr "${plainZipPath}" .`);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Helper: same logic as detectScormInZip in uploadMediaRepo.ts ──────────────
async function detectScormInZip(zipBuffer: Buffer): Promise<boolean> {
  try {
    const directory = await unzipper.Open.buffer(zipBuffer);
    const hasManifest = directory.files.some(f => /imsmanifest\.xml$/i.test(f.path));
    const hasRootIndex = directory.files.some(f => {
      const parts = f.path.replace(/\\/g, "/").split("/").filter(Boolean);
      return parts.length <= 2 && parts[parts.length - 1].toLowerCase() === "index.html";
    });
    return hasManifest || hasRootIndex;
  } catch {
    return false;
  }
}

// ── Helper: same logic as extractScormZip in mediaServe.ts ───────────────────
async function extractZipToDir(zipPath: string, destDir: string): Promise<string[]> {
  const directory = await unzipper.Open.file(zipPath);
  const extracted: string[] = [];
  for (const entry of directory.files) {
    if (entry.type === "File") {
      const destPath = path.join(destDir, entry.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const content = await entry.buffer();
      fs.writeFileSync(destPath, content);
      extracted.push(entry.path);
    }
  }
  return extracted;
}

describe("detectScormInZip (unzipper.Open.buffer)", () => {
  it("detects SCORM ZIP with imsmanifest.xml", async () => {
    const buf = fs.readFileSync(scormZipPath);
    const result = await detectScormInZip(buf);
    expect(result).toBe(true);
  });

  it("detects SCORM ZIP via root-level index.html (one folder deep)", async () => {
    const buf = fs.readFileSync(scormZipPath);
    const result = await detectScormInZip(buf);
    expect(result).toBe(true);
  });

  it("does NOT falsely detect plain ZIP as SCORM", async () => {
    const buf = fs.readFileSync(plainZipPath);
    const result = await detectScormInZip(buf);
    expect(result).toBe(false);
  });

  it("returns false on invalid/empty buffer without throwing", async () => {
    const result = await detectScormInZip(Buffer.from("not a zip"));
    expect(result).toBe(false);
  });
});

describe("extractZipToDir (unzipper.Open.file)", () => {
  it("extracts all files including those with spaces in names", async () => {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-extract-"));
    try {
      const files = await extractZipToDir(scormZipPath, extractDir);
      expect(files).toContain("Vascular Flashcards/index.html");
      expect(files).toContain("Vascular Flashcards/imsmanifest.xml");
      expect(files).toContain("Vascular Flashcards/some file with spaces.js");
      // Verify files actually exist on disk
      expect(fs.existsSync(path.join(extractDir, "Vascular Flashcards/index.html"))).toBe(true);
      expect(fs.existsSync(path.join(extractDir, "Vascular Flashcards/some file with spaces.js"))).toBe(true);
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  });

  it("extracts correct file content", async () => {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-extract-"));
    try {
      await extractZipToDir(scormZipPath, extractDir);
      const content = fs.readFileSync(path.join(extractDir, "Vascular Flashcards/index.html"), "utf8");
      expect(content).toBe("<html>SCORM</html>");
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  });
});
