export const CURRENT_QUIZ_PLAYER_PATTERN = {
  primaryColor: "#189aa1",
  backgroundColor: "#2a9ddd",
  backgroundMode: "gradient" as const,
  backgroundGradient: "radial-gradient(ellipse at center, #2a9ddd 0%, #0d1f3c 58%, #030712 100%)",
  textColor: "#ffffff",
} as const;

export function isLegacyAquaSolidQuizBranding(branding?: {
  backgroundMode?: string;
  backgroundColor?: string;
} | null) {
  return branding?.backgroundMode === "solid" && branding.backgroundColor?.toLowerCase() === "#a2d9dd";
}
