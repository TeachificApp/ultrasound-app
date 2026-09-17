export type SocialExportPlatform =
  | "facebook_feed"
  | "instagram_feed"
  | "linkedin_post"
  | "x_post"
  | "instagram_reel"
  | "facebook_reel"
  | "tiktok"
  | "youtube_video"
  | "youtube_short";

export type SocialExportFormat = "png" | "mp4";

export type SocialExportPreset = {
  id: SocialExportPlatform;
  label: string;
  width: number;
  height: number;
  description: string;
};

/**
 * The card design remains fully visible inside every target frame. Portrait and
 * landscape formats receive a branded background rather than cropping clinical
 * text or image content.
 */
export const SOCIAL_EXPORT_PRESETS: readonly SocialExportPreset[] = [
  { id: "facebook_feed", label: "Facebook Feed", width: 1200, height: 1500, description: "1200 × 1500 · 4:5" },
  { id: "instagram_feed", label: "Instagram Feed", width: 1080, height: 1350, description: "1080 × 1350 · 4:5" },
  { id: "linkedin_post", label: "LinkedIn Post", width: 1200, height: 1200, description: "1200 × 1200 · 1:1" },
  { id: "x_post", label: "X Post", width: 1600, height: 900, description: "1600 × 900 · 16:9" },
  { id: "instagram_reel", label: "Instagram Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "facebook_reel", label: "Facebook Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "tiktok", label: "TikTok", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "youtube_video", label: "YouTube Video", width: 1920, height: 1080, description: "1920 × 1080 · 16:9" },
  { id: "youtube_short", label: "YouTube Short", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
] as const;

export const DEFAULT_SOCIAL_EXPORT_PLATFORM: SocialExportPlatform = "instagram_feed";

export function getSocialExportPreset(platform: SocialExportPlatform): SocialExportPreset {
  return SOCIAL_EXPORT_PRESETS.find((preset) => preset.id === platform) ?? SOCIAL_EXPORT_PRESETS[0];
}

export function socialExportFilename(stem: string, platform: SocialExportPlatform, format: SocialExportFormat): string {
  const safeStem = stem
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "social-card";
  return `${safeStem}-${platform.replace(/_/g, "-")}.${format}`;
}
