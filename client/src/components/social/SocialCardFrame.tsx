import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  getSocialCardFrame,
  type SocialCardFrame,
  type SocialExportPlatform,
} from "@/lib/socialCardExportPresets";

const DEFAULT_CARD_FRAME = getSocialCardFrame("instagram_feed_square");
const SocialCardFrameContext = createContext<SocialCardFrame>(DEFAULT_CARD_FRAME);

/**
 * Supplies the selected platform's real output frame to card compositions.
 * Each generator therefore reflows its own clinical/content layout before it
 * is rasterized, instead of letterboxing a fixed square inside a larger file.
 */
export function SocialCardFrameProvider({
  platform,
  children,
}: {
  platform: SocialExportPlatform;
  children: ReactNode;
}) {
  const frame = useMemo(() => getSocialCardFrame(platform), [platform]);
  return <SocialCardFrameContext.Provider value={frame}>{children}</SocialCardFrameContext.Provider>;
}

export function useSocialCardFrame(): SocialCardFrame {
  return useContext(SocialCardFrameContext);
}
