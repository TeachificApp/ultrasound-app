export type MediaUrlPrompt = (message: string) => string | null;

/** Prompts for a reusable Media Repository URL and returns a trimmed value or null. */
export function requestMediaRepositoryUrl(label: string, promptFn?: MediaUrlPrompt): string | null {
  const prompt = promptFn ?? (typeof window !== "undefined" ? window.prompt.bind(window) : (() => null));
  const value = prompt(`Paste the ${label} URL from Media Repository`);
  return value?.trim() || null;
}

/** Applies a valid reusable Media Repository URL to an authoring field. */
export function reuseMediaRepositoryUrl(label: string, onReuse: (url: string) => void, promptFn?: MediaUrlPrompt): boolean {
  const url = requestMediaRepositoryUrl(label, promptFn);
  if (!url) return false;
  onReuse(url);
  return true;
}
