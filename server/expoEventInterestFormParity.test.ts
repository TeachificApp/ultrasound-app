import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Expo event-interest form parity", () => {
  it("keeps multi-select checkbox groups available in general and DIY form flows", async () => {
    const [generalBuilder, generalRenderer, diyBuilder, diyRenderer, partnerApplication] = await Promise.all([
      readFile("client/src/pages/admin/GeneralFormBuilder.tsx", "utf8"),
      readFile("client/src/pages/PublicFormRenderer.tsx", "utf8"),
      readFile("client/src/pages/FormBuilderAdmin.tsx", "utf8"),
      readFile("client/src/components/FormPreview.tsx", "utf8"),
      readFile("client/src/pages/PartnerApplication.tsx", "utf8"),
    ]);

    expect(generalBuilder).toContain('{ value: "checkbox", label: "Checkbox"');
    expect(generalRenderer).toContain('item.itemType === "checkbox"');
    expect(generalRenderer).toContain('value.includes(o.value)');
    expect(diyBuilder).toContain('"checkbox"');
    expect(diyRenderer).toContain('item.itemType === "checkbox"');
    expect(diyRenderer).toContain('value.includes(opt.value)');
    expect(partnerApplication).toContain('Select UltrasoundExpo™, EchoExpo™, or both.');
    expect(partnerApplication).toContain('["ultrasound_expo", "echo_expo"] as const');
  });
});
