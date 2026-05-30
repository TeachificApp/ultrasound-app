/**
 * DailyChallengeBanner — Hero banner for the Daily Challenge page.
 * Brand-aware: shows iHeartEcho copy/image on app.iheartecho.com.
 */
import { Trophy, Archive, CheckCircle2, Flame } from "lucide-react";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

const AAUS_BANNER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/daily-challenge-banner-v3_AAUS_ccb55bf0.webp";
const IHE_BANNER_IMG = "/manus-storage/ihe-daily-challenge-hero_6384adcf.webp";

interface DailyChallengeBannerProps {
  streak?: number;
  completedToday?: boolean;
  onStartChallenge?: () => void;
  onViewArchive?: () => void;
}

export default function DailyChallengeBanner({
  streak = 0,
  completedToday = false,
  onStartChallenge,
  onViewArchive,
}: DailyChallengeBannerProps) {
  // Evaluate at render time (not module load) so it reflects the actual hostname
  const isIHE = isIHeartEchoDomain();
  const BANNER_IMG = isIHE ? IHE_BANNER_IMG : AAUS_BANNER_IMG;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `url("${BANNER_IMG}")`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
      />
      <div className="relative container py-10 md:py-14">
        <div className="max-w-2xl">
          {/* Live pill */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
            <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
            <span className="text-xs text-white/80 font-medium">
              {isIHE ? "One Question · Daily · All Echo Categories" : "One Question · Daily · All Categories"}
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            {isIHE ? "Echo Daily Challenge" : "Daily Challenge"}
          </h1>
          <p className="text-[#4ad9e0] font-semibold text-base mb-3">
            {isIHE ? "Sharpen Your Echo Knowledge Every Day" : "Sharpen Your Ultrasound Knowledge Every Day"}
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-4 max-w-lg">
            {isIHE
              ? "One question per echo category — TTE, TEE, Valvular Disease, Cardiomyopathy, and more. Complete all to finish today's challenge. Maintain your streak and climb the leaderboard."
              : "One question per category — Abdominal, Vascular, OB/Gyn, Breast, and POCUS. Complete all five to finish today's challenge. Maintain your streak and climb the leaderboard."}
          </p>

          {/* Streak badge */}
          {streak > 0 && (
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <Flame className={`w-4 h-4 ${streak >= 3 ? "text-amber-400" : "text-white/60"}`} />
                <span className="text-sm font-bold text-white">{streak}</span>
                <span className="text-xs text-white/70">day streak</span>
              </div>
              {streak >= 7 && (
                <span className="text-xs text-amber-300 font-medium">
                  {streak >= 30 ? "🔥 Legend!" : streak >= 14 ? "🔥 2-week warrior!" : "🔥 Keep it up!"}
                </span>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            {completedToday ? (
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-green-500/20 border border-green-400/40 text-green-300">
                <CheckCircle2 className="w-4 h-4" />
                Completed Today ✓
              </div>
            ) : (
              <button
                onClick={onStartChallenge}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                style={{ background: "#189aa1" }}
              >
                <Trophy className="w-4 h-4" />
                Start Today's Challenge
              </button>
            )}
            <button
              onClick={onViewArchive}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
            >
              <Archive className="w-4 h-4" />
              View Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
