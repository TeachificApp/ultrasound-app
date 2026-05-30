/**
 * FlashcardsBanner — Hero banner for the Ultrasound Flashcards page.
 * Matches the dashboard hero style: navy-to-teal gradient, same typography.
 */
import { Link } from "wouter";
import { Zap } from "lucide-react";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

const AAUS_BANNER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/flashcards-banner-final_AAUS_94ef5d55.webp";
const IHE_BANNER_IMG = "/manus-storage/flashcards-banner-v7_f4e61e43_9139b466.webp";

interface FlashcardsBannerProps {
  streak?: number;
  isPremium?: boolean;
}

export default function FlashcardsBanner({ streak = 0, isPremium = false }: FlashcardsBannerProps) {
  // Evaluate at render time so it reflects the actual hostname (not module-load hostname)
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
            <span className="text-xs text-white/80 font-medium">Spaced Repetition · All Categories</span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            {isIHE ? "Echo Flashcards" : "Ultrasound Flashcards"}
          </h1>
          <p className="text-[#4ad9e0] font-semibold text-base mb-3">
            {isIHE ? "Rapid-Fire Echo Knowledge Review from iHeartEcho™" : "Rapid-Fire Clinical Knowledge Review from All About Ultrasound™"}
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
            {isIHE
              ? "Reinforce your echo knowledge with quick-review cards covering Adult TTE, TEE, Pediatric Echo, Fetal Echo, Valvular Disease, Cardiomyopathy, and more. Spaced repetition surfaces the cards you need most."
              : "Reinforce your ultrasound knowledge with quick-review cards covering Abdominal, OB/Gyn, Vascular, Breast, Thyroid, POCUS, and Physics. Spaced repetition surfaces the cards you need most."}
          </p>

          {/* Access row — iHeartEcho style: streak + free/premium info only, no card count */}
          <div className="flex flex-wrap gap-4 mb-6">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-white/70">
                <span className="text-lg">🔥</span>
                <span><strong className="text-white">{streak}</strong> day streak</span>
              </div>
            )}
            {!isPremium && (
              <div className="flex items-center gap-1.5 text-sm text-white/70">
                <Zap className="w-4 h-4 text-[#4ad9e0]" />
                <span>10 free cards/day · <Link href="/premium"><span className="text-[#4ad9e0] underline cursor-pointer">Upgrade for unlimited</span></Link></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
