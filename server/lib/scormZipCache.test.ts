import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveScormFileInCache } from "./scormZipCache";

describe("scormZipCache", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    tmpDirs.length = 0;
  });

  it("resolves launch file and data assets from cache layout", () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-cache-test-"));
    tmpDirs.push(cacheDir);
    fs.mkdirSync(path.join(cacheDir, "data"), { recursive: true });
    fs.writeFileSync(path.join(cacheDir, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(cacheDir, "data", "browsersupport.js"), "console.log('ok')");

    expect(resolveScormFileInCache(cacheDir, "index.html", "")).toContain("index.html");
    expect(resolveScormFileInCache(cacheDir, "index.html", "data/browsersupport.js")).toContain(
      "browsersupport.js",
    );
  });
});
