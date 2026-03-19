import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crown, ExternalLink, Lock, Music, Play, Search, Zap, BookOpen } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";
import Layout from "@/components/Layout";

const BANNER_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/etVPnUidWNWG8W4GHnRqzv/soundbytes-banner_b5a7c3d2.png";

// Sample soundbytes shown before DB content is added
const sampleSoundBytes = [
  { id: 1, title: "Abdominal Aorta Measurement Tips", category: "abdominal", duration: "3:42", isPremium: false, description: "Key tips for accurate AAA measurement including outer-to-outer technique and pitfalls to avoid." },
  { id: 2, title: "DVT Compression Technique", category: "venous", duration: "4:15", isPremium: false, description: "Step-by-step guide to proper vein compression technique for DVT evaluation." },
  { id: 3, title: "Thyroid TIRADS Scoring", category: "thyroid", duration: "5:20", isPremium: false, description: "Quick review of ACR TIRADS scoring system and FNA thresholds." },
  { id: 4, title: "Fetal Cardiac Axis Assessment", category: "fetal_echo", duration: "3:55", isPremium: false, description: "How to measure and interpret fetal cardiac axis in the 4-chamber view." },
  { id: 5, title: "POCUS B-Line Counting", category: "pocus", duration: "4:30", isPremium: false, description: "Systematic approach to counting B-lines and interpreting interstitial syndrome." },
  { id: 6, title: "Carotid Stenosis Grading", category: "extracranial_carotid", duration: "6:10", isPremium: true, description: "SRU consensus criteria for ICA stenosis grading with velocity thresholds." },
  { id: 7, title: "Endoleak Classification Post-EVAR", category: "abdominal_vascular", duration: "5:45", isPremium: true, description: "Types I–V endoleak: identification and clinical significance." },
  { id: 8, title: "Breast BI-RADS Lexicon", category: "breast", duration: "7:00", isPremium: true, description: "ACR BI-RADS ultrasound lexicon: shape, orientation, margin, echo pattern, posterior features." },
  { id: 9, title: "NT Measurement Technique", category: "obstetric_1st", duration: "4:00", isPremium: false, description: "Correct technique for nuchal translucency measurement at 11–14 weeks." },
  { id: 10, title: "IVC Assessment for Volume Status", category: "pocus", duration: "3:30", isPremium: false, description: "IVC diameter and collapsibility index for rapid hemodynamic assessment." },
];

export default function SoundBytes() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = !!(user as any)?.isPremium || user?.role === "admin";
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allSoundbytes = sampleSoundBytes;

  const filtered = allSoundbytes.filter(s => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch = !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Layout>
      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("${BANNER_IMG}")`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
          }}
        />
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse" />
              <span className="text-xs text-white/80 font-medium">Audio · Video · Short Clips</span>
            </div>

            {/* Title */}
            <h1
              className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              SoundBytes
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">
              Bite-Sized Ultrasound Education from All About Ultrasound™
            </p>
            <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-lg">
              Short audio and video clips designed to sharpen your ultrasound knowledge — covering technique, protocols, Doppler, pathology, and clinical pearls across every modality.
            </p>

            {/* Stats / CTAs */}
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
              <a
                href="https://member.allaboutultrasound.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
              >
                <BookOpen className="w-4 h-4" />
                All About Ultrasound
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="container py-6 space-y-4">
        {/* Premium Banner */}
        {!isPremium && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <Crown size={14} className="inline text-yellow-500 mr-1" />
                <span className="font-semibold">Premium</span>
                <span className="text-muted-foreground"> unlocks all SoundBytes — unlimited access to every clip</span>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">Upgrade</Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search SoundBytes..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>

        {/* Category Filter */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-[#189aa1] text-white"
                  : "bg-muted text-muted-foreground hover:bg-[#189aa1]/10 hover:text-[#189aa1]"
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === key
                    ? "bg-[#189aa1] text-white"
                    : "bg-muted text-muted-foreground hover:bg-[#189aa1]/10 hover:text-[#189aa1]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SoundBytes List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Music size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No SoundBytes found.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(sb => {
              const isLocked = sb.isPremium && !isPremium;
              return (
                <Card
                  key={sb.id}
                  className={`transition-all ${isLocked ? "opacity-75" : "hover:shadow-md hover:border-[#189aa1]/40"}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLocked ? "bg-muted" : ""}`}
                        style={isLocked ? undefined : { background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
                      >
                        {isLocked ? (
                          <Lock size={16} className="text-muted-foreground" />
                        ) : (
                          <Play size={16} className="text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm leading-tight">{sb.title}</div>
                          {isLocked && (
                            <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200 flex-shrink-0">
                              <Crown size={8} className="mr-0.5" /> Premium
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <Badge className={`text-[10px] ${CATEGORY_COLORS[sb.category] ?? "bg-gray-100 text-gray-800"}`}>
                            {CATEGORY_LABELS[sb.category] ?? sb.category}
                          </Badge>
                          {sb.duration && (
                            <Badge variant="outline" className="text-[10px]">{sb.duration}</Badge>
                          )}
                        </div>
                        {sb.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{sb.description}</p>
                        )}
                        {!isLocked && (sb as any).videoUrl && (
                          <a
                            href={(sb as any).videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#189aa1] mt-2 hover:underline"
                          >
                            <ExternalLink size={11} /> Watch Now
                          </a>
                        )}
                        {isLocked && (
                          <a
                            href={THINKIFIC_LINKS.premiumMonthly}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-yellow-600 mt-2 hover:underline"
                          >
                            <Crown size={11} /> Upgrade to All About Ultrasound™ Premium to access
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {!isAuthenticated && (
          <Card className="border-[#189aa1]/30 bg-[#f0fbfc]">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to track your learning progress with All About Ultrasound™</p>
              <a href={getLoginUrl()}>
                <Button size="sm" style={{ background: "#189aa1" }} className="text-white">Sign In</Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Footer attribution */}
        <p className="text-xs text-gray-400 text-center pb-2">
          SoundBytes are curated by the <strong>All About Ultrasound™</strong> education team. New clips added regularly.
        </p>
      </div>
    </Layout>
  );
}
