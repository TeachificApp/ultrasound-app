import { describe, expect, it } from "vitest";
import { resolveEmbeddedFormUrl } from "./embeddedFormUrl";

describe("resolveEmbeddedFormUrl", () => {
  it("replaces supported CME form placeholders with encoded profile values", () => {
    const url = resolveEmbeddedFormUrl(
      "https://forms.example.test/fill?id15={{first_name}}&id336={{last_name}}&id35={{email}}",
      { name: "Avery Doe", email: "avery.doe@example.test" },
    );

    expect(url).toBe("https://forms.example.test/fill?id15=Avery&id336=Doe&id35=avery.doe%40example.test");
  });

  it("does not expose literal supported placeholders when profile values are unavailable", () => {
    expect(resolveEmbeddedFormUrl("https://forms.example.test/fill?id15={{first_name}}&id35={{email}}", null))
      .toBe("https://forms.example.test/fill?id15=&id35=");
  });

  it("does not modify unsupported placeholders", () => {
    expect(resolveEmbeddedFormUrl("https://forms.example.test/fill?keep={{unknown_value}}", { name: "Avery Doe" }))
      .toBe("https://forms.example.test/fill?keep={{unknown_value}}");
  });
});
