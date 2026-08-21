export function buildWordCloudResponse(text: string): { words: string[] } {
  return { words: text.trim().split(/\s+/).filter(Boolean).slice(0, 3) };
}

export function buildHotspotResponse(x: number, y: number): { hotspot: { x: number; y: number } } {
  return { hotspot: { x: Math.max(0, Math.min(100, Math.round(x))), y: Math.max(0, Math.min(100, Math.round(y))) } };
}

export function buildPuzzleResponse(order: string[]): { order: string[] } {
  return { order: [...order] };
}
