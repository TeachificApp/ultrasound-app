import {
  getBrowserSpeechProfile,
  pickBrowserVoiceIndex,
  type BrowserVoiceCandidate,
} from "@shared/quizVoiceBrowserMapping";
import type { QuizTtsVoiceId } from "@shared/quizVoiceOptions";

/** Browser SpeechSynthesis fallback when OpenAI TTS is unavailable on the server. */
export function isBrowserSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function waitForBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isBrowserSpeechSynthesisAvailable()) return Promise.resolve([]);

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve(window.speechSynthesis.getVoices());
    }, 500);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function toCandidates(voices: SpeechSynthesisVoice[]): BrowserVoiceCandidate[] {
  return voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    default: voice.default,
  }));
}

export function speakWithBrowser(text: string, voiceId: QuizTtsVoiceId): Promise<void> {
  if (!isBrowserSpeechSynthesisAvailable()) {
    return Promise.reject(new Error("Browser speech is not available in this environment."));
  }

  return waitForBrowserVoices().then((voices) => {
    const profile = getBrowserSpeechProfile(voiceId);
    const index = pickBrowserVoiceIndex(voiceId, toCandidates(voices));
    const selected = index >= 0 ? voices[index] : voices[0];

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      if (selected) utterance.voice = selected;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser speech playback failed"));

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  });
}

export function shouldUseBrowserSpeechFallback(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const data = (error as { data?: { code?: string } }).data;
  if (data?.code === "PRECONDITION_FAILED") return true;
  const message = (error as { message?: string }).message ?? "";
  return /not configured|does not support speech synthesis|OPENAI_API_KEY/i.test(message);
}
