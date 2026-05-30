/**
 * CaseLibraryBanner — Hero banner for the Case Library page.
 * Brand-aware: shows iHeartEcho copy/image on app.iheartecho.com.
 */
import { Link } from "wouter";
import { Plus, BookOpen, LogIn } from "lucide-react";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

const AAUS_BANNER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/caselibrary-banner-final_AAUS_4bee1eff.webp";
const IHE_BANNER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/ihe-hero-MNscA4NaWNyxrdkewtLGLG.webp";

interface CaseLibraryBannerProps {
  isAuthenticated: boolean;
}

export default function CaseLibraryBanner({ isAuthenticated }: CaseLibraryBannerProps) {
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
            <span className="text-xs text-white/80 font-medium">Image · Video · Scenario Cases</span>
          </div>

          {/* Title */}
          <h1
            className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
            style={{ fontFamily: "Merriweather, serif" }}
          >
            {isIHE ? "Echo Case Library" : "Ultrasound Case Library"}
          </h1>
          <p className="text-[#4ad9e0] font-semibold text-base mb-3">
            {isIHE
              ? "Clinical Reasoning Through Real Echo Cases"
              : "Clinical Reasoning Through Real Ultrasound Cases"}
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
            {isIHE
              ? "Browse image, video, and scenario-based echocardiography cases designed to sharpen your clinical thinking — TTE, TEE, Pediatric Echo, Fetal Echo, Valvular Disease, and more."
              : "Browse image, video, and scenario-based ultrasound cases designed to sharpen your clinical thinking — not just image interpretation, but history, decision-making, and outcomes."}
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            {isAuthenticated ? (
              <Link href="/case-library/submit">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                  style={{ background: "#189aa1" }}
                >
                  <Plus className="w-4 h-4" />
                  Submit a Case
                </button>
              </Link>
            ) : (
              <a href="/login">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Submit
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
  );
}
