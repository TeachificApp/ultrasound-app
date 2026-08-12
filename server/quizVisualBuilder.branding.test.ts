import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const activeBuilderFiles = [
  "client/src/quiz-creator/components/EditorToolbar.tsx",
  "client/src/quiz-creator/components/BrandingPanel.tsx",
  "client/src/quiz-creator/components/QuizAnalyticsPanel.tsx",
  "client/src/pages/admin/QuizVisualBuilder.tsx",
  "client/src/pages/admin/QuizCreatorAdmin.tsx",
];

describe("Visual Builder co-branding", () => {
  it("uses All About Ultrasound | iHeartEcho branding with no legacy licensing or publishing language", () => {
    const source = activeBuilderFiles.map((file) => fs.readFileSync(path.resolve(root, file), "utf8")).join("\n");
    expect(source).toContain("All About Ultrasound");
    expect(source).toContain("iHeartEcho");
    expect(source).toContain("reusable learning content");
    expect(source).not.toMatch(/Teachific|License Key|Free Plan|Purchase a license|Publish to Teachific|Bulk export|Team sharing/i);
  });
});
