import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getUserRoles } from "../db";

const OPENVERSE_AUDIO_SEARCH_URL = "https://api.openverse.org/v1/audio/";
const CC0_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/";
const MAX_RESULTS = 15;

type OpenverseAudioResult = {
  id?: string;
  title?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  attribution?: string;
  url?: string;
  source?: string;
  source_url?: string;
  filetype?: string;
  mature?: boolean;
  duration?: number;
};

const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "admin") return next();
  const roles = await getUserRoles(ctx.user.id);
  if (roles.includes("platform_admin") || roles.includes("platform_owner")) return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
});

function isSafeCc0Preview(item: OpenverseAudioResult) {
  if (item.license !== "cc0" || item.license_version !== "1.0" || item.license_url !== CC0_LICENSE_URL) return false;
  if (item.mature || !item.id || !item.title || !item.url || !item.creator) return false;
  let url: URL;
  try {
    url = new URL(item.url);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !/\.(mp3|m4a|aac)(?:$|\?)/i.test(url.pathname)) return false;
  return true;
}

/**
 * Read-only Openverse catalogue search. Only explicit CC0 1.0, non-mature audio
 * previews are returned. Assets stay with their original provider and are not
 * copied into the Media Repository or application storage.
 */
export const openverseMusicRouter = router({
  searchCc0Audio: platformAdminProcedure
    .input(z.object({ query: z.string().trim().min(2).max(80), limit: z.number().int().min(1).max(MAX_RESULTS).default(10) }))
    .query(async ({ input }) => {
      const params = new URLSearchParams({
        q: input.query,
        license: "cc0",
        page_size: String(input.limit),
        mature: "false",
      });
      let response: Response;
      try {
        response = await fetch(`${OPENVERSE_AUDIO_SEARCH_URL}?${params.toString()}`, {
          headers: { Accept: "application/json", "User-Agent": "AllAboutUltrasoundMusicCatalogue/1.0" },
          signal: AbortSignal.timeout(8_000),
        });
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "The CC0 music catalogue is temporarily unavailable." });
      }
      if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "The CC0 music catalogue could not complete this search." });

      const payload = await response.json() as { results?: OpenverseAudioResult[] };
      const tracks = (payload.results ?? [])
        .filter(isSafeCc0Preview)
        .slice(0, input.limit)
        .map((item) => ({
          id: item.id!,
          title: item.title!.slice(0, 255),
          creator: item.creator!.slice(0, 255),
          previewUrl: item.url!,
          source: item.source ?? "Openverse",
          sourceUrl: item.source_url ?? null,
          attribution: item.attribution ?? `${item.title} by ${item.creator} — CC0 1.0`,
          license: "CC0 1.0",
          licenseUrl: CC0_LICENSE_URL,
          durationMs: Number.isFinite(item.duration) ? item.duration : null,
        }));

      return {
        provider: "Openverse",
        providerUrl: "https://openverse.org/",
        licenceNotice: "Results are third-party CC0 1.0 previews. Review the attribution and source before publishing.",
        tracks,
      };
    }),
});

export { CC0_LICENSE_URL, isSafeCc0Preview };
