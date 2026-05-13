/**
 * UpgradeTriggerModal — contextual upgrade prompt shown at moments of value.
 *
 * Triggers:
 *   "post_case"    — after a free user completes a case
 *   "streak"       — after 3+ consecutive daily visits
 *   "narrative"    — when EchoAssist hides the clinical narrative
 *   "module_lock"  — when a free user clicks a locked module
 *
 * Usage:
 *   const { showUpgradeModal, UpgradeTriggerModal } = useUpgradeTrigger();
 *   showUpgradeModal("post_case");
 *   <UpgradeTriggerModal />
 */

import { Crown, BookOpen, Flame, FileText, Lock, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useCallback } from "react";

export type UpgradeTriggerType = "post_case" | "streak" | "narrative" | "module_lock";

interface TriggerConfig {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  gradient: string;
  highlight?: string;
}

const TRIGGER_CONFIGS: Record<UpgradeTriggerType, TriggerConfig> = {
  post_case: {
    icon: <BookOpen className="w-8 h-8 text-white" />,
    badge: "500+ Cases Available",
    title: "Unlock the Full Case Library",
    description:
      "You've completed a case — great work! Premium members get unlimited access to 500+ echo cases across all modalities, with detailed explanations and CME credit.",
    primaryLabel: "Unlock 500+ Cases",
    secondaryLabel: "Maybe Later",
    gradient: "linear-gradient(135deg, #0e4a50, #189aa1)",
    highlight: "500+ cases",
  },
  streak: {
    icon: <Flame className="w-8 h-8 text-white" />,
    badge: "You're on a Roll!",
    title: "Keep Your Streak Going",
    description:
      "You've been building a great learning habit. Premium members get unlimited daily challenges, streak tracking, leaderboard rankings, and CME credit for every session.",
    primaryLabel: "Go Premium — Keep the Streak",
    secondaryLabel: "Continue for Free",
    gradient: "linear-gradient(135deg, #b45309, #d97706)",
    highlight: "streak tracking",
  },
  narrative: {
    icon: <FileText className="w-8 h-8 text-white" />,
    badge: "Full Interpretation Available",
    title: "See the Full Clinical Narrative",
    description:
      "You've got the severity grade. Premium unlocks the complete EchoAssist™ clinical narrative — management recommendations, guideline thresholds, and a structured report.",
    primaryLabel: "Unlock Full Interpretation",
    secondaryLabel: "Stay on Free Plan",
    gradient: "linear-gradient(135deg, #0e4a50, #189aa1)",
    highlight: "clinical narrative",
  },
  module_lock: {
    icon: <Lock className="w-8 h-8 text-white" />,
    badge: "Premium Feature",
    title: "Upgrade to Access This Module",
    description:
      "This module is available to Premium members. Upgrade to unlock all EchoNavigator protocols, ScanCoach clinical pearls, EchoAssist™ engines, and more.",
    primaryLabel: "Upgrade to Premium",
    secondaryLabel: "Back to Dashboard",
    gradient: "linear-gradient(135deg, #b45309, #d97706)",
  },
};

interface UpgradeTriggerModalProps {
  triggerType: UpgradeTriggerType | null;
  onClose: () => void;
  /** Optional override for the module name shown in module_lock trigger */
  moduleName?: string;
}

export function UpgradeTriggerModal({
  triggerType,
  onClose,
  moduleName,
}: UpgradeTriggerModalProps) {
  if (!triggerType) return null;

  const cfg = TRIGGER_CONFIGS[triggerType];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl px-6 py-7 text-center relative"
        style={{
          background: "rgba(14, 30, 46, 0.98)",
          borderColor: "#4ad9e040",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: cfg.gradient }}
        >
          {cfg.icon}
        </div>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
          style={{
            background: "#189aa122",
            color: "#4ad9e0",
            border: "1px solid #4ad9e033",
          }}
        >
          {cfg.badge}
        </div>

        {/* Title */}
        <h2
          className="font-bold text-white text-lg mb-2"
          style={{ fontFamily: "Merriweather, serif" }}
        >
          {triggerType === "module_lock" && moduleName
            ? `${moduleName}: ${cfg.title}`
            : cfg.title}
        </h2>

        {/* Description */}
        <p className="text-white/60 text-sm mb-5 leading-relaxed">{cfg.description}</p>

        {/* CTAs */}
        <div className="flex flex-col gap-2">
          <Link href="/premium" onClick={onClose}>
            <button
              className="w-full font-semibold text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: cfg.gradient }}
            >
              <Crown className="w-4 h-4" />
              {cfg.primaryLabel}
            </button>
          </Link>
          <button
            onClick={onClose}
            className="w-full text-white/50 text-sm py-2 hover:text-white/70 transition-colors"
          >
            {cfg.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage upgrade trigger modal state.
 *
 * Usage:
 *   const { triggerType, moduleName, showUpgrade, closeUpgrade } = useUpgradeTrigger();
 *   <UpgradeTriggerModal triggerType={triggerType} moduleName={moduleName} onClose={closeUpgrade} />
 */
export function useUpgradeTrigger() {
  const [triggerType, setTriggerType] = useState<UpgradeTriggerType | null>(null);
  const [moduleName, setModuleName] = useState<string | undefined>(undefined);

  const showUpgrade = useCallback(
    (type: UpgradeTriggerType, name?: string) => {
      setTriggerType(type);
      setModuleName(name);
    },
    []
  );

  const closeUpgrade = useCallback(() => {
    setTriggerType(null);
    setModuleName(undefined);
  }, []);

  return { triggerType, moduleName, showUpgrade, closeUpgrade };
}
