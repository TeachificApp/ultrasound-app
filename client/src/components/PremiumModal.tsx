/*
  PremiumModal — iHeartEcho™
  Shown when a user clicks a Premium-locked card.
  Explains what's included and links to the upgrade flow.
*/
import { X, Lock, Check, Zap, Star, ExternalLink } from "lucide-react";

interface PremiumModalProps {
  featureName: string;
  featureDescription?: string;
  onClose: () => void;
}

const PREMIUM_FEATURES = [
  "Stress Echo, Pulmonary HTN, HOCM, TEE, ICE & Structural Heart Navigators",
  "Stress Echo, HOCM, TEE, ICE & Structural Heart ScanCoaches",
  "POCUS RUSH & Lung POCUS Modules",
  "EchoAssist™ LAP Grading, Diastology Special Populations & StressEchoAssist™",
  "HOCM LVOT Gradient Calculator",
  "Report Builder — 2025 ASE-compliant clinical narratives",
  "Unlimited Case Library (500+ cases) & Daily Challenge Archive",
  "Unlimited Echo Flashcards (no daily limit)",
  "EchoAccreditation Navigator — IAC standards guide",
];

export default function PremiumModal({ featureName, featureDescription, onClose }: PremiumModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#fff" }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-widest mb-0.5">
                Premium Feature
              </div>
              <h2 className="text-lg font-black text-white leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
                {featureName}
              </h2>
            </div>
          </div>
          {featureDescription && (
            <p className="text-white/70 text-xs leading-relaxed">
              {featureDescription}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-gray-800">What's included in Premium</span>
          </div>
          <ul className="space-y-2 mb-5">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-600">{f}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="space-y-2">
            <a
              href="https://www.iheartecho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
            >
              <Zap className="w-4 h-4" />
              Upgrade to Premium — $9.97/month
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-full py-2.5 rounded-xl font-semibold text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
