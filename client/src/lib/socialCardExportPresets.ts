export type SocialExportPlatform =
  | "facebook_feed"
  | "facebook_feed_square"
  | "facebook_feed_horizontal"
  | "facebook_story_reel"
  | "facebook_cover"
  | "instagram_feed"
  | "instagram_feed_square"
  | "instagram_feed_horizontal"
  | "instagram_story_reel"
  | "linkedin_post"
  | "linkedin_feed_horizontal"
  | "linkedin_link_preview"
  | "linkedin_profile_cover"
  | "x_post"
  | "x_feed_square"
  | "x_feed_vertical"
  | "x_link_preview"
  | "instagram_reel"
  | "facebook_reel"
  | "tiktok"
  | "tiktok_photo"
  | "tiktok_profile"
  | "youtube_video"
  | "youtube_short"
  | "youtube_thumbnail"
  | "youtube_banner";

export type SocialExportFormat = "png" | "mp4";

export type SocialExportPreset = {
  id: SocialExportPlatform;
  label: string;
  width: number;
  height: number;
  description: string;
};

export type SocialCardLayout = "wide" | "landscape" | "square" | "portrait" | "vertical";

export type SocialCardFrame = {
  width: number;
  height: number;
  layout: SocialCardLayout;
  /** Typography and spacing multiplier for the selected placement. */
  contentScale: number;
};

/**
 * Exact platform placements supplied for all supported feed, story, video,
 * preview, cover, and banner outputs. Existing ids remain stable where they
 * already represented a platform placement, so saved administrator choices and
 * exported file names remain understandable.
 */
export const SOCIAL_EXPORT_PRESETS: readonly SocialExportPreset[] = [
  { id: "facebook_feed", label: "Facebook Feed · vertical", width: 1080, height: 1350, description: "1080 × 1350 · 4:5" },
  { id: "facebook_feed_square", label: "Facebook Feed · square", width: 1080, height: 1080, description: "1080 × 1080 · 1:1" },
  { id: "facebook_feed_horizontal", label: "Facebook Feed · horizontal", width: 1200, height: 630, description: "1200 × 630 · 1.91:1" },
  { id: "facebook_story_reel", label: "Facebook Story / Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "facebook_cover", label: "Facebook Cover Photo", width: 851, height: 315, description: "851 × 315 · 2.70:1" },

  { id: "instagram_feed", label: "Instagram Feed · vertical", width: 1080, height: 1350, description: "1080 × 1350 · 4:5" },
  { id: "instagram_feed_square", label: "Instagram Feed · square", width: 1080, height: 1080, description: "1080 × 1080 · 1:1" },
  { id: "instagram_feed_horizontal", label: "Instagram Feed · horizontal", width: 1080, height: 566, description: "1080 × 566 · 1.91:1" },
  { id: "instagram_story_reel", label: "Instagram Story / Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },

  { id: "tiktok", label: "TikTok Video / Story", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "tiktok_photo", label: "TikTok Photo Post", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "tiktok_profile", label: "TikTok Profile Photo", width: 200, height: 200, description: "200 × 200 · 1:1" },

  { id: "x_post", label: "X Feed · horizontal", width: 1600, height: 900, description: "1600 × 900 · 16:9" },
  { id: "x_feed_square", label: "X Feed · square", width: 1080, height: 1080, description: "1080 × 1080 · 1:1" },
  { id: "x_feed_vertical", label: "X Feed · vertical", width: 1080, height: 1350, description: "1080 × 1350 · 4:5" },
  { id: "x_link_preview", label: "X Link Preview / Card", width: 1200, height: 630, description: "1200 × 630 · 1.91:1" },

  { id: "linkedin_post", label: "LinkedIn Feed · vertical", width: 1080, height: 1350, description: "1080 × 1350 · 4:5" },
  { id: "linkedin_feed_horizontal", label: "LinkedIn Feed · horizontal", width: 1200, height: 627, description: "1200 × 627 · 1.91:1" },
  { id: "linkedin_link_preview", label: "LinkedIn Link Preview", width: 1200, height: 627, description: "1200 × 627 · 1.91:1" },
  { id: "linkedin_profile_cover", label: "LinkedIn Profile Cover", width: 1584, height: 396, description: "1584 × 396 · 4:1" },

  { id: "instagram_reel", label: "Instagram Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "facebook_reel", label: "Facebook Reel", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "youtube_video", label: "YouTube Standard Video", width: 1920, height: 1080, description: "1920 × 1080 · 16:9" },
  { id: "youtube_short", label: "YouTube Short", width: 1080, height: 1920, description: "1080 × 1920 · 9:16" },
  { id: "youtube_thumbnail", label: "YouTube Video Thumbnail", width: 1280, height: 720, description: "1280 × 720 · 16:9" },
  { id: "youtube_banner", label: "YouTube Channel Banner", width: 2560, height: 1440, description: "2560 × 1440 · 16:9" },
] as const;

export const DEFAULT_SOCIAL_EXPORT_PLATFORM: SocialExportPlatform = "instagram_feed";

export function getSocialExportPreset(platform: SocialExportPlatform): SocialExportPreset {
  return SOCIAL_EXPORT_PRESETS.find((preset) => preset.id === platform) ?? SOCIAL_EXPORT_PRESETS.find((preset) => preset.id === DEFAULT_SOCIAL_EXPORT_PLATFORM)!;
}

/** Returns dimensions and a layout density used by each live card composition. */
export function getSocialCardFrame(platform: SocialExportPlatform): SocialCardFrame {
  const preset = getSocialExportPreset(platform);
  const ratio = preset.width / preset.height;
  const layout: SocialCardLayout = ratio >= 2.15
    ? "wide"
    : ratio > 1.15
      ? "landscape"
      : ratio < 0.7
        ? "vertical"
        : ratio < 0.9
          ? "portrait"
          : "square";
  const contentScale = layout === "wide" ? 0.78 : layout === "landscape" ? 0.9 : layout === "portrait" ? 1.02 : layout === "vertical" ? 1.04 : 1;
  return { width: preset.width, height: preset.height, layout, contentScale };
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
