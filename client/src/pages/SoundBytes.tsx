import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Crown, ExternalLink, Lock, Music, Play, Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";

// Sample soundbytes shown before DB content is added
const sampleSoundBytes = [
  { id: 1, title: "Abdominal Aorta Measurement Tips", category: "abdominal", duration: "3:42", isPremium: false, description: "Key tips for accurate AAA measurement including outer-to-outer technique and pitfalls to avoid." },
  { id: 2, title: "DVT Compression Technique", category: "venous", duration: "4:15", isPremium: false, description: "Step-by-step guide to proper vein compression technique for DVT evaluation." },
  { id: 3, title: "Thyroid TIRADS Scoring", category: "thyroid", duration: "5:20", isPremium: false, description: "Quick review of ACR TIRADS scoring system and FNA thresholds." },
  { id: 4, title: "Fetal Cardiac Axis Assessment", category: "fetal_echo", duration: "3:55", isPremium: false, description: "How to measure and interpret fetal cardiac axis in the 4-chamber view." },
  { id: 5, title: "POCUS B-Line Counting", category: "pocus", duration: "4:30", isPremium: false, description: "Systematic approach to counting B-lines and interpreting interstitial syndrome." },
  { id: 6, title: "Carotid Stenosis Grading", category: "extracranial_carotid", duration: "6:10", isPremium: true, description: "SRU consensus criteria for ICA stenosis grading with velocity thresholds." },
  { id: 7, title: "Endoleak Classification Post-EVAR", category: "abdominal_vascular", duration: "5:45", isPremium: true, description: "Types I-V endoleak: identification and clinical significance." },
  { id: 8, title: "Breast BIRADS Lexicon", category: "breast", duration: "7:00", isPremium: true, description: "ACR BIRADS ultrasound lexicon: shape, orientation, margin, echo pattern, posterior features." },
  { id: 9, title: "NT Measurement Technique", category: "obstetric_1st", duration: "4:00", isPremium: false, description: "Correct technique for nuchal translucency measurement at 11-14 weeks." },
  { id: 10, title: "IVC Assessment for Volume Status", category: "pocus", duration: "3:30", isPremium: false, description: "IVC diameter and collapsibility index for rapid hemodynamic assessment." },
];

export default function SoundBytes() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = !!(user as any)?.isPremium || user?.role === "admin";
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // SoundBytes content is managed via admin - use sample data until DB content is added
  const allSoundbytes = sampleSoundBytes;

  const filtered = allSoundbytes.filter(s => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch = !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Music size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>SoundBytes</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Short audio/video learning clips for ultrasound education</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Premium Banner */}
        {!isPremium && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <Crown size={14} className="inline text-yellow-500 mr-1" />
                <span className="font-semibold">Premium</span>
                <span className="text-muted-foreground"> unlocks all SoundBytes</span>
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
                selectedCategory === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
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
              const isLocked = (sb as any).isPremium && !isPremium;
              return (
                <Card key={sb.id} className={`transition-all ${isLocked ? "opacity-75" : "hover:shadow-md hover:border-primary/40"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isLocked ? "bg-muted" : "bg-primary/10"
                      }`}>
                        {isLocked ? (
                          <Lock size={16} className="text-muted-foreground" />
                        ) : (
                          <Play size={16} className="text-primary" />
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
                          {(sb as any).duration && (
                            <Badge variant="outline" className="text-[10px]">{(sb as any).duration}</Badge>
                          )}
                        </div>
                        {(sb as any).description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{(sb as any).description}</p>
                        )}
                        {!isLocked && (sb as any).videoUrl && (
                          <a href={(sb as any).videoUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                            <ExternalLink size={11} /> Watch Now
                          </a>
                        )}
                        {isLocked && (
                          <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-yellow-600 mt-2 hover:underline">
                            <Crown size={11} /> Upgrade to access
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
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to track your learning progress</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
