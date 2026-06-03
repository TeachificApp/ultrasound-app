/**
 * EnrolledAccessBanner
 *
 * Shown at the very top of a landing page when the logged-in user already has
 * access to the content (enrolled in a course, purchased a download/bundle, etc.).
 * Teal, slightly transparent, sticky, clickable — takes the user straight to the
 * content.
 *
 * Usage:
 *   <EnrolledAccessBanner href="/courses/my-course/player" label="Continue Learning" />
 *   <EnrolledAccessBanner href="/downloads/my-product/files" label="Access Your Files" />
 */
import React from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface EnrolledAccessBannerProps {
  /** Destination URL when the banner is clicked */
  href: string;
  /** Primary action label, e.g. "Continue Learning" or "Access Your Files" */
  label?: string;
  /** Optional sub-text, e.g. the course/product title */
  subtitle?: string;
}

export function EnrolledAccessBanner({ href, label = "Continue Learning", subtitle }: EnrolledAccessBannerProps) {
  return (
    <a
      href={href}
      className="block w-full sticky top-0 z-50 group"
      style={{
        background: "rgba(20, 184, 166, 0.88)", // teal-500 at ~88% opacity
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 2px 12px rgba(20,184,166,0.25)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: icon + message */}
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 opacity-90" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              You already have access to this{subtitle ? "" : " content"}.
              {subtitle && (
                <span className="font-normal opacity-80 ml-1 truncate">{subtitle}</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: CTA pill */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-full px-4 py-1.5 text-white text-sm font-semibold group-hover:gap-2.5"
          style={{ transition: "gap 0.15s ease, background 0.15s ease" }}
        >
          <span>{label}</span>
          <ArrowRight className="w-4 h-4 opacity-90 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </a>
  );
}
