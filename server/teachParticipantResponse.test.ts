import { describe, expect, it } from "vitest";
import { buildHotspotResponse, buildPuzzleResponse, buildWordCloudResponse } from "../shared/teachParticipantResponse";

describe("Teach participant responses", () => {
  it("normalizes word-cloud, hotspot, and puzzle payloads before live submission", () => {
    expect(buildWordCloudResponse("  mitral   valve  assessment extra ")).toEqual({ words: ["mitral", "valve", "assessment"] });
    expect(buildHotspotResponse(101.2, -1.4)).toEqual({ hotspot: { x: 100, y: 0 } });
    const order = ["Second", "First"];
    expect(buildPuzzleResponse(order)).toEqual({ order });
    expect(buildPuzzleResponse(order).order).not.toBe(order);
  });
});
