export type TeachInteractionType = "multiple_choice" | "true_false" | "word_cloud" | "hotspot" | "puzzle";

function parseConfig(value: string | null | undefined): Record<string, any> {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

export function evaluateTeachResponse(input: {
  interactionType?: TeachInteractionType | string | null;
  selectedAnswer: number;
  correctAnswer: number;
  interactionConfig?: string | null;
  responsePayload?: Record<string, unknown>;
}): boolean {
  const type = input.interactionType ?? "multiple_choice";
  if (type === "multiple_choice" || type === "true_false") return input.selectedAnswer === input.correctAnswer;
  if (type === "word_cloud") return false;
  const config = parseConfig(input.interactionConfig);
  if (type === "hotspot") {
    const hotspot = input.responsePayload?.hotspot as { x?: number; y?: number } | undefined;
    const target = config.targetRegions?.[0];
    if (!hotspot || !target) return false;
    return hotspot.x >= target.x && hotspot.x <= target.x + target.width && hotspot.y >= target.y && hotspot.y <= target.y + target.height;
  }
  if (type === "puzzle") {
    const order = input.responsePayload?.order;
    const correctOrder = config.correctOrder;
    return Array.isArray(order) && Array.isArray(correctOrder) && order.length === correctOrder.length && order.every((item, index) => item === correctOrder[index]);
  }
  return false;
}

export function aggregateWordCloud(payloads: Array<Record<string, unknown> | null | undefined>) {
  const counts = new Map<string, number>();
  for (const payload of payloads) {
    const words = payload?.words;
    if (!Array.isArray(words)) continue;
    for (const rawWord of words) {
      const word = String(rawWord).trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
      if (word.length < 2) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
