import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("../client/src/components/admin/FocusRegenerationDialog.tsx", import.meta.url), "utf8");

describe("lesson focus regeneration reviewed-draft flow", () => {
  it("retries one incomplete populated draft with its validation reason", () => {
    expect(routerSource).toContain("for (let attempt = 0; attempt < 2; attempt += 1)");
    expect(routerSource).toContain("The first draft failed review because: ${validationReason}");
    expect(routerSource).toContain("AI did not return a complete instructional rewrite for this lesson. ${validationReason}");
  });

  it("validates the reviewed proposal against the intended persisted lesson", () => {
    const applyStart = routerSource.indexOf("applyFocusRegeneration: protectedProcedure");
    const applySource = routerSource.slice(applyStart, routerSource.indexOf("// ── Courses", applyStart));
    expect(applySource).toContain("const lesson = byId.get(change.lessonId)!");
    expect(applySource).toContain("assertSubstantiveFocusRegeneration({");
    expect(applySource).toContain("where(eq(lmsLessons.id, lesson.id))");
    expect(applySource).toContain("await db.transaction(async tx =>");
  });

  it("sends only the reviewed proposal for explicit administrator application", () => {
    expect(dialogSource).toContain("lessonId: entry.proposal.lessonId");
    expect(dialogSource).toContain("onClick={applyPreview}");
    expect(dialogSource).toContain("Apply Reviewed Changes");
    expect(dialogSource).toContain("applyChanges.mutateAsync");
  });
});
