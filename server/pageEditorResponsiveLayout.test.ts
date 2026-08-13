import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/admin/LandingPageBuilder.tsx"), "utf8");

describe("Page Editor responsive layout", () => {
  it("wraps the toolbar controls and keeps the course title usable on narrow screens", () => {
    expect(source).toContain('flex flex-wrap items-center justify-between gap-2');
    expect(source).toContain('min-w-0 flex-1 flex-wrap items-center');
    expect(source).toContain('hidden sm:inline">Back to Course');
  });

  it("stacks the block rail, canvas, and settings panel on mobile before restoring the desktop workspace", () => {
    expect(source).toContain('flex flex-1 min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden');
    expect(source).toContain('w-full flex-shrink-0 border-b border-gray-200 bg-white lg:w-52');
    expect(source).toContain('min-h-[52vh] flex-1 bg-gray-100 lg:min-h-0 lg:overflow-y-auto');
    expect(source).toContain('w-full flex-shrink-0 border-t border-gray-200 bg-white lg:w-[var(--page-editor-settings-width)]');
    expect(source).toContain('lg:block');
  });
});
