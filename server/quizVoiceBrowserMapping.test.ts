import { describe, expect, it } from "vitest";
import {
  getBrowserSpeechProfile,
  pickBrowserVoiceIndex,
  scoreBrowserVoiceForQuizVoice,
} from "../shared/quizVoiceBrowserMapping";

const VOICES = [
  { name: "Google US English", lang: "en-US", default: true },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US" },
];

describe("quizVoiceBrowserMapping", () => {
  it("prefers different browser voices for nova vs onyx", () => {
    const novaIndex = pickBrowserVoiceIndex("nova", VOICES);
    const onyxIndex = pickBrowserVoiceIndex("onyx", VOICES);
    expect(novaIndex).not.toBe(onyxIndex);
  });

  it("scores female hints higher for nova", () => {
    const zira = scoreBrowserVoiceForQuizVoice("nova", VOICES[4]!);
    const david = scoreBrowserVoiceForQuizVoice("nova", VOICES[3]!);
    expect(zira).toBeGreaterThan(david);
  });

  it("uses distinct pitch profiles per quiz voice", () => {
    expect(getBrowserSpeechProfile("onyx").pitch).toBeLessThan(getBrowserSpeechProfile("shimmer").pitch);
  });
});
