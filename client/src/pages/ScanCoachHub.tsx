/*
  ScanCoach Hub — iHeartEcho™
  FREE coaches shown first, PREMIUM coaches in a separate section at the bottom.
*/
import { useState } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import PremiumModal from "@/components/PremiumModal";
import { usePremium } from "@/hooks/usePremium";
import {
  Scan, Stethoscope, Baby, Heart, Users, Activity,
  Zap, Microscope, Droplets, Wind, Crown, Lock
} from "lucide-react";

const BRAND = "#189aa1";

const freeCoaches = [
  { tab: "tte",       icon: Stethoscope, label: "Adult TTE",          views: 10 },
  { tab: "chd",       icon: Users,       label: "Pediatric CHD",      views: 14 },
  { tab: "fetal",     icon: Baby,        label: "Fetal Echo",         views: 13 },
];

const premiumCoaches = [
  { tab: "uea",       icon: Droplets,    label: "UEA",                views: 7,  route: "/uea-scan-coach" },
  { tab: "strain",    icon: Activity,    label: "Strain",             views: 4,  route: "/strain-scan-coach" },
  { tab: "achd",      icon: Heart,       label: "Adult Congenital",   views: 13, route: null as string | null },
  { tab: "diastolic", icon: Wind,        label: "Diastolic Function", views: 7,  route: null as string | null },
  { tab: "stress",    icon: Zap,         label: "Stress Echo",        views: 13, route: "/stress-scan-coach" },
  { tab: "pulm",      icon: Wind,        label: "Pulm HTN & PE",      views: 8,  route: null as string | null },
  { tab: "hocm",      icon: Heart,       label: "HOCM",               views: 14, route: null as string | null },
  { tab: "tee",       icon: Microscope,  label: "TEE",                views: 13, route: null as string | null },
  { tab: "ice",       icon: Scan,        label: "ICE",                views: 9,  route: null as string | null },
];

export default function ScanCoachHub() {
  const [, navigate] = useLocation();
  const { isPremium } = usePremium();
  const [premiumModal, setPremiumModal] = useState<{ name: string } | null>(null);

  return (
    <Layout>
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="container py-10 md:py-14">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <Scan className="w-6 h-6 text-[#4ad9e0]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
                <span className="text-sm text-white/80 font-medium">12 Specialties · View-by-View Probe Guidance</span>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                ScanCoach™
              </h1>
              <p className="text-[#4ad9e0] font-semibold text-base mt-0.5">Probe Positioning · Anatomy · Clinical Pearls</p>
              <p className="text-white/70 text-sm md:text-base mt-2 max-w-xl leading-relaxed">
                View-by-view scanning guides with transducer positioning, normal anatomy, Doppler setup, and clinical pearls — for every modality and patient population.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-10">
        {/* FREE ScanCoaches */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-[#189aa1] bg-[#189aa1]/10 border border-[#189aa1]/20">
              <div className="w-2 h-2 rounded-full bg-[#189aa1]" />
              FREE — Included with all memberships
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {freeCoaches.map(({ tab, icon: Icon, label, views }) => (
              <button
                key={tab}
                onClick={() => navigate(`/scan-coach?tab=${tab}`)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 bg-white hover:border-[#189aa1]/50 hover:shadow-md transition-all text-center cursor-pointer group"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                  style={{ background: BRAND + "15" }}
                >
                  <Icon className="w-5 h-5" style={{ color: BRAND }} />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight text-gray-800">{label}</div>
                  <div className="text-[10px] mt-0.5 text-gray-400">{views} views</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PREMIUM ScanCoaches */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
              <Crown className="w-3 h-3 text-amber-500" />
              PREMIUM — Requires Premium membership ($9.97/month)
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {premiumCoaches.map(({ tab, icon: Icon, label, views, route }) => {
              if (isPremium) {
                return (
                  <button
                    key={tab}
                    onClick={() => navigate(route ?? `/scan-coach?tab=${tab}`)}
                    className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-amber-100 bg-white hover:border-amber-300/60 hover:shadow-md transition-all text-center cursor-pointer group"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                  >
                    <div className="absolute top-1 right-1">
                      <Crown className="w-3 h-3 text-amber-400" />
                    </div>
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                      style={{ background: BRAND + "15" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight text-gray-800">{label}</div>
                      <div className="text-[10px] mt-0.5 text-gray-400">{views} views</div>
                    </div>
                  </button>
                );
              }
              return (
                <button
                  key={tab}
                  onClick={() => setPremiumModal({ name: label })}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-amber-100 bg-amber-50/40 hover:border-amber-300/60 hover:shadow-md transition-all text-center cursor-pointer group"
                  style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                >
                  <div className="absolute top-1 right-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                  </div>
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ background: "#f59e0b15" }}
                  >
                    <Icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight text-gray-700">{label}</div>
                    <div className="text-[10px] mt-0.5 text-amber-500 flex items-center justify-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Premium
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!isPremium && (
            <div className="mt-4 text-center">
              <a href="/premium" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                <Crown className="w-4 h-4" />
                Upgrade to Premium — $9.97/month
              </a>
            </div>
          )}
        </div>
      </div>

      {premiumModal && (
        <PremiumModal
          featureName={`${premiumModal.name} ScanCoach`}
          featureDescription={`The ${premiumModal.name} ScanCoach is available with a Premium membership. Upgrade to access view-by-view probe guidance, anatomy overlays, and clinical pearls for this modality.`}
          onClose={() => setPremiumModal(null)}
        />
      )}
    </Layout>
  );
}
