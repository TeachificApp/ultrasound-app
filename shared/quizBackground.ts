export type QuizBackgroundBranding = {
  backgroundMode?: "solid" | "image" | "gradient";
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageUrl?: string;
};

export type QuizQuestionBackground = {
  backgroundColor?: string;
  backgroundImageUrl?: string;
};

export function resolveQuizBackground(
  branding?: QuizBackgroundBranding | null,
  question?: QuizQuestionBackground | null,
): string {
  if (question?.backgroundImageUrl) {
    return `linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url(${question.backgroundImageUrl}) center/cover`;
  }
  if (question?.backgroundColor) return question.backgroundColor;
  if (branding?.backgroundMode === "gradient" && branding.backgroundGradient) return branding.backgroundGradient;
  if (branding?.backgroundMode === "image" && branding.backgroundImageUrl) {
    return `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.32)), url(${branding.backgroundImageUrl}) center/cover`;
  }
  if (branding?.backgroundMode === "solid") return branding.backgroundColor || "#f0fdfa";
  if (branding?.backgroundImageUrl) {
    return `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${branding.backgroundImageUrl}) center/cover`;
  }
  return branding?.backgroundColor ? `radial-gradient(ellipse at center, ${branding.backgroundColor} 0%, #000 100%)` : "rgba(0, 0, 0, 0.4)";
}
