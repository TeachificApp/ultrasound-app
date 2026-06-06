/**
 * UpgradePrompt — brand-aware upgrade nudge for free (non-premium) users.
 *
 * Trigger schedule (free users only, never admins or premium):
 *  1. Once only: 60 seconds after first mount (per session)
 *  2. On-demand: when a feature behind a paywall is accessed (triggerUpgradePrompt)
 *
 * No recurring timers. No exit-intent. One passive nudge per session.
 * Dismissal: × button, backdrop click, Escape key, or "Maybe later" link.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Zap, Star, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PREMIUM_URL =
  "/premium";

const FIRST_USE_DELAY_MS = 60 * 1000; // 60 seconds — shown once per session

// ── Singleton event bus so any component can trigger the prompt ──────────────
type Listener = (force?: boolean) => void;
const listeners = new Set<Listener>();

/** Call from any feature page to trigger a contextual prompt (respects 15-min cooldown) */
export function triggerUpgradePrompt() {
  listeners.forEach((fn) => fn(false));
}

// ── Rotating value props ─────────────────────────────────────────────────────
const VALUE_PROPS = [
  {
    headline: "Unlock Premium Clinical Intelligence",
    body: "Access all 15 specialty navigators, vascular ScanCoaches, and advanced POCUS tools — built for working sonographers.",
    cta: "Upgrade to Premium →",
  },
  {
    headline: "Go Deeper with Every Scan",
    body: "Premium unlocks breast, MSK, vascular, and intracranial duplex modules with guideline-driven protocols and reference values.",
    cta: "Start Premium Today →",
  },
  {
    headline: "Unlimited Flashcards & Case Library",
    body: "Free members get 10 flashcards/day. Premium gives you unlimited access to flashcards, cases, SoundBytes™, and more.",
    cta: "Get Unlimited Access →",
  },
  {
    headline: "The Pocket Reference for Real-Time Scanning",
    body: "UltrasoundAssist™ Premium is your guideline-based companion at the probe — from protocol to pathology, in seconds.",
    cta: "Upgrade Now →",
  },
];

const FEATURES = [
  "All 15 specialty navigators",
  "Vascular & MSK ScanCoaches",
  "Unlimited flashcards & cases",
  "Full SoundBytes™ library",
];

// ── Component ────────────────────────────────────────────────────────────────
interface UpgradePromptProps {
  /** Pass true when the user is authenticated, non-premium, and non-admin */
  eligible: boolean;
}

export default function UpgradePrompt({ eligible }: UpgradePromptProps) {
  const [visible, setVisible] = useState(false);
  // Pick a random value prop on mount and rotate it each time the modal opens
  const [propIdx, setPropIdx] = useState(() =>
    Math.floor(Math.random() * VALUE_PROPS.length)
  );

  // Track whether the one scheduled nudge has already fired this session
  const scheduledShownRef = useRef(false);

  // ── Core show/dismiss ──────────────────────────────────────────────────────
  const show = useCallback(
    (scheduled = false) => {
      if (!eligible) return;
      // Scheduled (timer) nudge fires at most once per session
      if (scheduled) {
        if (scheduledShownRef.current) return;
        scheduledShownRef.current = true;
      }
      // On-demand (paywall access) always shows regardless of session flag
      setPropIdx((i) => (i + 1) % VALUE_PROPS.length);
      setVisible(true);
    },
    [eligible]
  );

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  // ── Timer: once only, 60 seconds after mount ─────────────────────────────
  useEffect(() => {
    if (!eligible) return;

    // Fire once, 60 seconds after the component mounts (i.e. after login)
    const firstTimer = setTimeout(() => {
      show(true); // scheduled=true → fires at most once per session
    }, FIRST_USE_DELAY_MS);

    return () => clearTimeout(firstTimer);
  }, [eligible, show]);

  // ── Singleton bus for contextual triggers ─────────────────────────────────
  useEffect(() => {
    if (!eligible) return;
    // On-demand paywall triggers always show (scheduled=false)
    const handler = () => show(false);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [eligible, show]);

  // ── Keyboard dismiss ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, dismiss]);

  if (!visible) return null;

  const prop = VALUE_PROPS[propIdx];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Premium"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Teal gradient header */}
        <div
          className="px-6 pt-6 pb-5"
          style={{
            background:
              "linear-gradient(135deg, #0e4a50 0%, #189aa1 60%, #4ad9e0 100%)",
          }}
        >
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3" /> Premium
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-white text-xl font-bold leading-tight mb-1">
            {prop.headline}
          </h2>
          <p className="text-white/80 text-sm leading-relaxed">{prop.body}</p>
        </div>

        {/* White body */}
        <div className="bg-white px-6 py-5">
          {/* Feature list */}
          <ul className="space-y-2 mb-5">
            {FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <CheckCircle
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "#189aa1" }}
                />
                {f}
              </li>
            ))}
          </ul>

          {/* Pricing hint */}
          <p className="text-xs text-gray-400 mb-4 text-center">
            From{" "}
            <span className="font-semibold text-gray-600">$9.97/month</span>
            {" "}· Cancel anytime
          </p>

          {/* CTA */}
          <a
            href={PREMIUM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
          >
            <Button
              className="w-full text-white font-semibold py-2.5 rounded-xl shadow-md hover:opacity-90 transition-opacity"
              style={{
                background: "linear-gradient(90deg, #189aa1, #4ad9e0)",
              }}
            >
              <Star className="w-4 h-4 mr-2" />
              {prop.cta}
            </Button>
          </a>

          {/* Dismiss link */}
          <button
            onClick={dismiss}
            className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            Maybe later
          </button>
        </div>

        {/* Brand footer */}
        <div className="px-6 py-2 text-center" style={{ background: "#0e1e2e" }}>
          <p className="text-xs text-white/40">
            All About Ultrasound™ · UltrasoundAssist™
          </p>
        </div>
      </div>
    </div>
  );
}
