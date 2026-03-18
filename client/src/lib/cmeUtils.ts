/**
 * CME Hub client-side utilities.
 * Mirrors the parseCreditHoursFromName logic from server/thinkific.ts
 * so the CME Hub can parse credit info from live Thinkific course names.
 */

/**
 * Parse CME credit hours from a course name.
 * Looks for patterns like "2.5 SDMS CME", "1 SDMS FREE CME", "2 SDMS Credits"
 * Returns null if no match found.
 */
export function parseCreditHoursFromName(name: string): {
  hours: string;
  type: "SDMS" | "AMA_PRA_1" | "ANCC" | "OTHER";
} | null {
  const sdmsMatch = name.match(/(\d+\.?\d*)\s*SDMS/i);
  if (sdmsMatch) return { hours: sdmsMatch[1], type: "SDMS" };

  const amaMatch = name.match(/(\d+\.?\d*)\s*AMA\s*PRA/i);
  if (amaMatch) return { hours: amaMatch[1], type: "AMA_PRA_1" };

  const anccMatch = name.match(/(\d+\.?\d*)\s*ANCC/i);
  if (anccMatch) return { hours: anccMatch[1], type: "ANCC" };

  return null;
}
