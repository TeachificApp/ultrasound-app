import type { QuizTtsVoiceId } from "./quizVoiceOptions";

export type BrowserVoiceCandidate = {
  name: string;
  lang: string;
  default?: boolean;
};

/** Natural, conversational pacing for browser fallback voices. */
export function getBrowserSpeechProfile(voiceId: QuizTtsVoiceId): { pitch: number; rate: number } {
  switch (voiceId) {
    case "nova":
      return { pitch: 1.02, rate: 0.94 };
    case "onyx":
      return { pitch: 0.93, rate: 0.94 };
    default:
      return { pitch: 1, rate: 1 };
  }
}

export function scoreBrowserVoiceForQuizVoice(
  voiceId: QuizTtsVoiceId,
  candidate: BrowserVoiceCandidate,
): number {
  const name = candidate.name.toLowerCase();
  let score = 0;

  if (candidate.lang.toLowerCase().startsWith("en")) score += 2;
  if (candidate.default) score += 1;

  const femaleHints = /female|woman|girl|samantha|victoria|zira|jenny|aria|susan|karen|moira|tessa|fiona/;
  const maleHints = /male|man|boy|daniel|david|guy|fred|alex|tom|james|mark|george|richard/;

  if (voiceId === "nova") {
    if (femaleHints.test(name)) score += 12;
    if (maleHints.test(name)) score -= 4;
  }

  if (voiceId === "onyx") {
    if (maleHints.test(name)) score += 12;
    if (femaleHints.test(name)) score -= 4;
  }

  if (voiceId === "onyx" && /deep|low|baritone|bass/.test(name)) score += 6;

  // Spread choices across the list when names are ambiguous.
  const voiceOrder: QuizTtsVoiceId[] = ["nova", "onyx"];
  const slot = voiceOrder.indexOf(voiceId);
  if (slot >= 0 && name.includes(String(slot))) score += 1;

  return score;
}

export function pickBrowserVoiceIndex(
  voiceId: QuizTtsVoiceId,
  candidates: BrowserVoiceCandidate[],
): number {
  if (candidates.length === 0) return -1;

  const english = candidates
    .map((voice, index) => ({ voice, index }))
    .filter(({ voice }) => voice.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : candidates.map((voice, index) => ({ voice, index }));

  let bestIndex = pool[0]?.index ?? 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const { voice, index } of pool) {
    const score = scoreBrowserVoiceForQuizVoice(voiceId, voice);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  // When scores tie (common with only one system voice), rotate by voice id.
  if (pool.length > 1) {
    const tied = pool.filter(({ voice }) => scoreBrowserVoiceForQuizVoice(voiceId, voice) === bestScore);
    if (tied.length > 1) {
      const voiceOrder: QuizTtsVoiceId[] = ["nova", "onyx"];
      const offset = Math.max(0, voiceOrder.indexOf(voiceId));
      bestIndex = tied[offset % tied.length]?.index ?? bestIndex;
    }
  }

  return bestIndex;
}
