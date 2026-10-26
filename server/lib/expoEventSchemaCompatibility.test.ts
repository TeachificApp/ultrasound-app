import { describe, expect, it } from "vitest";
import { normalizeLegacyExpoEvent } from "./expoEventSchemaCompatibility";

describe("Expo event schema compatibility", () => {
  it("treats a legacy row without the additive tenant column as UltrasoundExpo™", () => {
    expect(normalizeLegacyExpoEvent({ id: 12, name: "Annual Expo" }, false)).toMatchObject({
      id: 12,
      name: "Annual Expo",
      tenant: "ultrasound_expo",
    });
  });

  it("retains an explicit EchoExpo™ tenant only after the additive schema is available", () => {
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, true).tenant).toBe("echo_expo");
    expect(normalizeLegacyExpoEvent({ id: 13, tenant: "echo_expo" }, false).tenant).toBe("ultrasound_expo");
  });
});
