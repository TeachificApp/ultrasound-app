/**
 * SoundBytes.tsx
 *
 * Bite-sized echo / ultrasound education clips.
 * Layout: 3-column card grid → click → inline detail page with embedded YouTube + rich text.
 *
 * Gating:
 *   - Not logged in → blurred list + sign-in overlay
 *   - Free member → first clip per category unlocked (isFree flag from server), rest locked
 *   - Premium → all clips unlocked
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";
import {
  ArrowLeft, Crown, Eye, Lock, Music, Play, Search, Zap, BookOpen,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";

/** Convert any YouTube watch/share URL to an embed URL */
function toEmbedUrl(url: string): string {
  if (!url) return "";
  if (url.includes("youtube.com/embed/")) return url;
  if (url.includes("youtube.com/watch")) {
    try {
      const vid = new URL(url).searchParams.get("v");
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    } catch { /* fall through */ }
  }
  if (url.includes("youtu.be/")) {
    const vid = url.split("youtu.be/")[1]?.split("?")[0];
    if (vid) return `https://www.youtube.com/embed/${vid}`;
  }
  return url;
}

/** Format seconds as "m:ss" */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SoundByteItem = {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: string;
  durationSeconds: number | null;
  phantomViews: number;
  isFree: boolean;
  canPlay: boolean;
};

// ── Detail View ───────────────────────────────────────────────────────────────
function SoundByteDetail({
  sb,
  onBack,
}: {
  sb: SoundByteItem;
  onBack: () => void;
}) {
  const embedUrl = toEmbedUrl(sb.videoUrl);
  const categoryLabel = CATEGORY_LABELS[sb.category] ?? sb.category;
  const categoryColor = CATEGORY_COLORS[sb.category] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[#189aa1] hover:underline mb-4 font-medium"
      >
        <ArrowLeft size={15} />
        Back to SoundBytes
      </button>

      {/* YouTube embed */}
      {embedUrl && (
        <div
          className="relative w-full overflow-hidden rounded-xl shadow-lg mb-5"
          style={{ paddingBottom: "56.25%" }}
        >
          <iframe
            src={embedUrl}
            title={sb.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
          />
        </div>
      )}

      {/* Title + meta */}
      <h1 className="text-xl font-bold text-gray-900 mb-2">{sb.title}</h1>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColor}`}>
          {categoryLabel}
        </span>
        {sb.phantomViews > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Eye size={12} />
            {sb.phantomViews.toLocaleString()} views
          </span>
        )}
        {sb.durationSeconds && (
          <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
            {formatDuration(sb.durationSeconds)}
          </span>
        )}
      </div>

      {/* Rich text description */}
      {sb.description && (
        <div
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sb.description }}
        />
      )}

      {/* Locked overlay */}
      {!sb.canPlay && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <Crown size={18} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Premium Content</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {isIHE
                ? "Upgrade to iHeartEcho™ Premium to watch this SoundByte."
                : "Upgrade to All About Ultrasound™ Premium to watch this SoundByte."}
            </p>
          </div>
          <a
            href={THINKIFIC_LINKS.premiumMonthly}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex-shrink-0"
          >
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap"
              style={{ background: "#189aa1" }}
            >
              Upgrade
            </button>
          </a>
        </div>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function SoundByteCard({
  sb,
  onClick,
}: {
  sb: SoundByteItem;
  onClick: () => void;
}) {
  const isLocked = !sb.canPlay;
  const categoryLabel = CATEGORY_LABELS[sb.category] ?? sb.category;
  const categoryColor = CATEGORY_COLORS[sb.category] ?? "bg-gray-100 text-gray-700";

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-all group ${
        isLocked
          ? "border-gray-100 opacity-80"
          : "border-gray-100 hover:border-[#189aa1]/40 hover:shadow-md"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-full overflow-hidden bg-gray-100" style={{ paddingBottom: "56.25%" }}>
        {sb.thumbnailUrl ? (
          <img
            src={sb.thumbnailUrl}
            alt={sb.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
          >
            <Play size={32} className="text-white opacity-80" />
          </div>
        )}
        {/* Play overlay on hover */}
        {!isLocked && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <Play size={16} className="text-[#189aa1] ml-0.5" />
            </div>
          </div>
        )}
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Lock size={20} className="text-white" />
          </div>
        )}
        {/* Duration badge */}
        {sb.durationSeconds && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
            {formatDuration(sb.durationSeconds)}
          </span>
        )}
        {/* Premium badge */}
        {isLocked && (
          <span
            className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#fef3c7", color: "#92400e" }}
          >
            <Crown size={8} /> Premium
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 mb-2">
          {sb.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColor}`}>
            {categoryLabel}
          </span>
          {sb.phantomViews > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Eye size={9} /> {sb.phantomViews.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SoundBytes() {
  // Evaluate at render time so it reflects the actual hostname (not module-load hostname)
  const isIHE = isIHeartEchoDomain();
  const BANNER_IMG = isIHE
    ? "/manus-storage/soundbytes-ihe-banner_94f6a87a.webp"
    : "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/soundbytes-banner-AAUS_8880afff.png";
  const { user, isAuthenticated } = useAuth();
  const isPremium = !!(user as any)?.isPremium || user?.role === "admin";
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSb, setSelectedSb] = useState<SoundByteItem | null>(null);

  const { data: soundBytesData = [], isLoading } = trpc.soundBytes.list.useQuery({});

  const categories = Array.from(new Set(soundBytesData.map((s) => s.category)));

  const filtered = soundBytesData.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? "").replace(/<[^>]+>/g, "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const soundbytesWithAccess: SoundByteItem[] = filtered.map((sb) => ({
    ...sb,
    canPlay: isPremium || sb.isFree,
  }));

  return (
    <Layout>
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${BANNER_IMG}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: isIHE ? 0.55 : 0.20,
          }}
        />
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">
                {isIHE ? "Quick-hit video micro-lessons — clinical pearls in minutes" : "Audio · Video · Short Clips"}
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              SoundBytes™
              {isPremium && (
                <span
                  className="ml-3 text-sm font-bold px-2.5 py-1 rounded-full align-middle"
                  style={{ background: "#189aa1", color: "#fff" }}
                >
                  Premium
                </span>
              )}
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">
              {isIHE
                ? "Bite-Sized Echo Education from iHeartEcho™"
                : "Bite-Sized Ultrasound Education from All About Ultrasound™"}
            </p>
            <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
              {isIHE
                ? "Short audio and video clips designed to sharpen your echo knowledge — covering TTE technique, TEE views, Doppler, valvular disease, cardiomyopathy, and clinical pearls."
                : "Short audio and video clips designed to sharpen your ultrasound knowledge — covering technique, protocols, Doppler, pathology, and clinical pearls across every modality."}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              {!isPremium && (
                <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                    style={{ background: "#189aa1" }}
                  >
                    <Zap className="w-4 h-4" />
                    Unlock All SoundBytes
                  </button>
                </a>
              )}
              {!isIHE && (
                <a
                  href="https://member.allaboutultrasound.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  All About Ultrasound
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="container py-6 space-y-4">

        {/* ── Not logged in: blurred preview + sign-in overlay ─────────────── */}
        {!isAuthenticated && (
          <div className="relative">
            <div
              className="pointer-events-none select-none"
              style={{ filter: "blur(6px)", opacity: 0.35, maxHeight: "420px", overflow: "hidden" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {soundBytesData.slice(0, 6).map((sb) => (
                  <div key={sb.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="w-full bg-gray-200" style={{ paddingBottom: "56.25%" }} />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sign-in overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-full max-w-sm rounded-2xl border shadow-2xl px-6 py-7 text-center"
                style={{
                  background: "rgba(14, 30, 46, 0.97)",
                  borderColor: "#4ad9e040",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
                >
                  <Music className="w-7 h-7 text-white" />
                </div>
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
                  style={{ background: "#189aa122", color: "#189aa1", border: "1px solid #189aa133" }}
                >
                  Free Account Required
                </div>
                <h2
                  className="font-bold text-white text-lg mb-2"
                  style={{ fontFamily: "Merriweather, serif" }}
                >
                  Sign In to Watch
                </h2>
                <p className="text-white/60 text-sm mb-5 leading-relaxed">
                  {isIHE
                    ? "Create a free iHeartEcho™ account to access SoundBytes. Free members get the first clip per category. Upgrade to Premium for unlimited access."
                    : "Create a free All About Ultrasound™ account to access SoundBytes. Free members get the first clip per category. Upgrade to Premium for unlimited access."}
                </p>
                <div className="flex flex-col gap-2">
                  <a href={getLoginUrl()} className="block">
                    <button
                      className="w-full font-semibold text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
                    >
                      <Lock className="w-4 h-4" />
                      Sign In or Create Free Account
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Logged-in content ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <>
            {/* Detail view */}
            {selectedSb && (
              <SoundByteDetail sb={selectedSb} onBack={() => setSelectedSb(null)} />
            )}

            {/* Grid view */}
            {!selectedSb && (
              <>
                {/* Premium upgrade banner for free members */}
                {!isPremium && (
                  <div
                    className="rounded-xl p-4 flex items-center justify-between gap-4"
                    style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Crown className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-white font-semibold text-sm">Unlock All SoundBytes</p>
                        <p className="text-white/60 text-xs">
                          Free members get 1 clip per category. Premium unlocks everything.
                        </p>
                      </div>
                    </div>
                    <a
                      href={THINKIFIC_LINKS.premiumMonthly}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <button
                        className="px-4 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                        style={{ background: "#189aa1" }}
                      >
                        Upgrade
                      </button>
                    </a>
                  </div>
                )}

                {/* Growing library notice */}
                <p className="text-xs text-[#189aa1] font-medium">
                  • Our library is growing — check back weekly for new SoundBytes™.
                </p>

                {/* Category filter tabs */}
                {categories.length > 0 && (
                  <div className="overflow-x-auto pb-1 -mx-1 px-1">
                    <div className="flex gap-2 min-w-max">
                      <button
                        onClick={() => setSelectedCategory("all")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                          selectedCategory === "all"
                            ? "text-white border-transparent"
                            : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                        }`}
                        style={selectedCategory === "all" ? { background: "#189aa1" } : {}}
                      >
                        All
                      </button>
                      {categories.map((key) => (
                        <button
                          key={key}
                          onClick={() => setSelectedCategory(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                            selectedCategory === key
                              ? "text-white border-transparent"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                          }`}
                          style={selectedCategory === key ? { background: "#189aa1" } : {}}
                        >
                          {CATEGORY_LABELS[key] ?? key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SoundBytes…"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
                  />
                </div>

                {/* Loading skeleton */}
                {isLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                        <div className="w-full bg-gray-200" style={{ paddingBottom: "56.25%" }} />
                        <div className="p-3 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid */}
                {!isLoading && (
                  <>
                    {soundbytesWithAccess.length === 0 ? (
                      <div className="text-center py-12">
                        <Music size={32} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">
                          {soundBytesData.length === 0
                            ? "No SoundBytes available yet. Check back soon!"
                            : "No SoundBytes found matching your search."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {soundbytesWithAccess.map((sb) => (
                          <SoundByteCard
                            key={sb.id}
                            sb={sb}
                            onClick={() => setSelectedSb(sb)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Footer */}
                <p className="text-xs text-gray-400 text-center pb-2">
                  {isIHE ? (
                    <>
                      <strong>iHeartEcho™</strong> SoundBytes — curated by the education team. New clips added regularly.
                    </>
                  ) : (
                    <>
                      <strong>All About Ultrasound™</strong> SoundBytes — curated by the education team. New clips added regularly.
                    </>
                  )}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
