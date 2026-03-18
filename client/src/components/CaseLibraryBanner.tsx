/**
 * CaseLibraryBanner — Hero banner for the Echo Case Library page.
 * Matches the dashboard hero style: navy-to-teal gradient, same typography.
 */
import { Link } from "wouter";
import { Plus, BookOpen, LogIn } from "lucide-react";

const BANNER_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/case-library-banner-v1_ab0f93e1.png";

interface CaseLibraryBannerProps {
  isAuthenticated: boolean;
}

export default function CaseLibraryBanner({ isAuthenticated }: CaseLibraryBannerProps) {
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
            Echo Case Library
          </h1>
          <p className="text-[#4ad9e0] font-semibold text-base mb-3">
            Clinical Reasoning Through Real Echo Cases
          </p>
          <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
            Browse image, video, and scenario-based echo cases designed to sharpen your clinical
            thinking — not just image interpretation, but history, decision-making, and outcomes.
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
            <a
              href="https://www.iheartecho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              iheartecho.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
