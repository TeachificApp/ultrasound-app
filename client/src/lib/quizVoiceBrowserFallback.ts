/** Browser SpeechSynthesis fallback when OpenAI TTS is unavailable on the server. */
export function isBrowserSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function speakWithBrowser(text: string): Promise<void> {
  if (!isBrowserSpeechSynthesisAvailable()) {
    return Promise.reject(new Error("Browser speech is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser speech playback failed"));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function shouldUseBrowserSpeechFallback(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const data = (error as { data?: { code?: string } }).data;
  if (data?.code === "PRECONDITION_FAILED") return true;
  const message = (error as { message?: string }).message ?? "";
  return /not configured|does not support speech synthesis|OPENAI_API_KEY/i.test(message);
}
