/**
 * Robustly extract and parse JSON from an LLM response string.
 * Handles cases where the model wraps the JSON in markdown code fences
 * (```json ... ```) or returns extra text before/after the JSON.
 */
export function extractJson(raw: string): any {
  if (!raw || typeof raw !== "string") throw new Error("Empty response");

  // 1. Strip markdown code fences: ```json ... ``` or ``` ... ```
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // 2. Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // 3. Try to find the first { or [ and extract from there
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    let start = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
    } else if (firstBracket !== -1) {
      start = firstBracket;
    }
    if (start !== -1) {
      const lastBrace = text.lastIndexOf("}");
      const lastBracket = text.lastIndexOf("]");
      const end = Math.max(lastBrace, lastBracket);
      if (end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          // fall through
        }
      }
    }
    throw new Error(`Could not parse JSON from LLM response: ${text.slice(0, 200)}`);
  }
}
