/**
 * SoundBytes.tsx
 *
 * Bite-sized ultrasound education clips.
 * Data is loaded from the real API (trpc.soundBytes.list) which filters by brand server-side.
 * Gating rules:
 *   - Not logged in → blurred list + sign-in overlay
 *   - Free member → first clip per category unlocked (isFree flag from server), rest locked
 *   - Premium → all clips unlocked
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";
import { Link } from "wouter";
import {
  Crown, ExternalLink, Lock, Music, Play, Search, Zap, BookOpen, Clock,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";

const isIHE = isIHeartEchoDomain();
const BANNER_IMG = isIHE
  ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp"
  : "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/soundbytes-banner-AAUS_8880afff.png";

/** Format seconds as "m:ss" */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SoundBytes() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = !!(user as any)?.isPremium || user?.role === "admin";
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch real SoundBytes from the API (brand-filtered server-side)
  const { data: soundBytesData = [], isLoading } = trpc.soundBytes.list.useQuery({});

  // Derive unique categories from loaded data
  const categories = Array.from(new Set(soundBytesData.map(s => s.category)));

  const filtered = soundBytesData.filter(s => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const soundbytesWithAccess = filtered.map(sb => {
    const canPlay = isPremium || sb.isFree;
    return { ...sb, canPlay };
  });

  return (
    <Layout>
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: `url("${BANNER_IMG}")`, backgroundSize: "cover", backgroundPosition: "center right" }}
        />
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Audio · Video · Short Clips</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              SoundBytes
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">
              {isIHE ? "Bite-Sized Echo Education from iHeartEcho™" : "Bite-Sized Ultrasound Education from All About Ultrasound™"}
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
              <div className="space-y-3">
                {soundBytesData.slice(0, 6).map(sb => (
                  <div key={sb.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
                    >
                      <Play className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{sb.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{CATEGORY_LABELS[sb.category] ?? sb.category}</span>
                        {sb.durationSeconds && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{formatDuration(sb.durationSeconds)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Sign-in overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-full max-w-sm rounded-2xl border shadow-2xl px-6 py-7 text-center"
                style={{ background: "rgba(14, 30, 46, 0.97)", borderColor: "#4ad9e040", backdropFilter: "blur(12px)" }}
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
                <h2 className="font-bold text-white text-lg mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                  Sign In to Listen
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
                  <Link href="/">
                    <button className="w-full text-white/50 text-sm py-2 hover:text-white/70 transition-colors">
                      Back to Dashboard
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Logged-in content ─────────────────────────────────────────────── */}
        {isAuthenticated && (
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
                    <p className="text-white/60 text-xs">Free members get 1 clip per category. Premium unlocks everything.</p>
                  </div>
                </div>
                <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <button
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap"
                    style={{ background: "#189aa1" }}
                  >
                    Upgrade
                  </button>
                </a>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search SoundBytes…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#189aa1]/30"
              />
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="overflow-x-auto pb-1 -mx-1 px-1">
                <div className="flex gap-2 min-w-max">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedCategory === "all"
                        ? "text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                    }`}
                    style={selectedCategory === "all" ? { background: "#189aa1" } : {}}
                  >
                    All
                  </button>
                  {categories.map(key => (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        selectedCategory === key
                          ? "text-white"
                          : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
                      }`}
                      style={selectedCategory === key ? { background: "#189aa1" } : {}}
                    >
                      {CATEGORY_LABELS[key] ?? key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SoundBytes List */}
            {!isLoading && (
              <div className="space-y-3">
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
                  soundbytesWithAccess.map(sb => {
                    const isLocked = !sb.canPlay;
                    return (
                      <div
                        key={sb.id}
                        className={`bg-white rounded-xl border transition-all ${
                          isLocked
                            ? "border-gray-100 opacity-80"
                            : "border-gray-100 hover:border-[#189aa1]/40 hover:shadow-md"
                        }`}
                      >
                        <div className="p-4 flex items-start gap-4">
                          {/* Thumbnail / play icon */}
                          {sb.thumbnailUrl ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative">
                              <img src={sb.thumbnailUrl} alt={sb.title} className="w-full h-full object-cover" />
                              {isLocked && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <Lock size={14} className="text-white" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{
                                background: isLocked
                                  ? "#f3f4f6"
                                  : "linear-gradient(135deg, #0e4a50, #189aa1)",
                              }}
                            >
                              {isLocked ? (
                                <Lock size={18} className="text-gray-400" />
                              ) : (
                                <Play size={18} className="text-white" />
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-gray-800 leading-snug">{sb.title}</p>
                              {isLocked && (
                                <span
                                  className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: "#fef3c7", color: "#92400e" }}
                                >
                                  <Crown size={8} /> Premium
                                </span>
                              )}
                            </div>

                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[sb.category] ?? "bg-gray-100 text-gray-700"}`}
                              >
                                {CATEGORY_LABELS[sb.category] ?? sb.category}
                              </span>
                              {sb.durationSeconds && (
                                <span className="flex items-center gap-0.5 text-[10px] text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                                  <Clock size={9} className="mr-0.5" /> {formatDuration(sb.durationSeconds)}
                                </span>
                              )}
                              {sb.phantomViews > 0 && (
                                <span className="text-[10px] text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                                  {sb.phantomViews.toLocaleString()} views
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            {sb.description && (
                              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{sb.description}</p>
                            )}

                            {/* CTA */}
                            <div className="mt-2">
                              {!isLocked && sb.videoUrl ? (
                                <a
                                  href={sb.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#189aa1] hover:underline"
                                >
                                  <ExternalLink size={11} /> Watch Now
                                </a>
                              ) : isLocked ? (
                                <a
                                  href={THINKIFIC_LINKS.premiumMonthly}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline"
                                >
                                  <Crown size={11} /> {isIHE ? "Upgrade to iHeartEcho™ Premium to access" : "Upgrade to All About Ultrasound™ Premium to access"}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer */}
            <p className="text-xs text-gray-400 text-center pb-2">
              {isIHE
                ? <><strong>iHeartEcho™</strong> SoundBytes — curated by the education team. New clips added regularly.</>
                : <><strong>All About Ultrasound™</strong> SoundBytes — curated by the education team. New clips added regularly.</>}
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
