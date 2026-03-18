import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Crown, Lock, RotateCcw, Shuffle } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, THINKIFIC_LINKS } from "@shared/appConstants";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

// Sample flashcard data (shown when no DB cards available)
const sampleCards = [
  { id: 1, question: "What is the normal portal vein diameter?", answer: "Normal portal vein diameter is <13 mm. Values >13 mm suggest portal hypertension.", category: "abdominal", difficulty: "basic" },
  { id: 2, question: "What is the normal gallbladder wall thickness?", answer: "Normal GB wall thickness is <3 mm. Wall >3 mm with positive Murphy's sign suggests acute cholecystitis.", category: "abdominal", difficulty: "basic" },
  { id: 3, question: "What is the normal endometrial stripe thickness in a postmenopausal woman?", answer: "≤4-5 mm. Thickness >5 mm in a postmenopausal woman warrants further evaluation for endometrial pathology.", category: "pelvic_gyn", difficulty: "basic" },
  { id: 4, question: "What is the normal fetal heart rate range?", answer: "120-160 bpm. Bradycardia <100 bpm; Tachycardia >160 bpm.", category: "fetal_echo", difficulty: "basic" },
  { id: 5, question: "What is the ICA/CCA PSV ratio threshold for ≥70% ICA stenosis?", answer: "ICA/CCA ratio >4.0 with PSV >230 cm/s indicates ≥70% ICA stenosis per SRU consensus criteria.", category: "extracranial_carotid", difficulty: "intermediate" },
  { id: 6, question: "What is the eFAST window for detecting pericardial effusion?", answer: "Subxiphoid (subcostal) 4-chamber view. Anechoic fluid appears between the heart and pericardium.", category: "pocus", difficulty: "basic" },
  { id: 7, question: "What is the ACR TIRADS score for a solid, hypoechoic, taller-than-wide thyroid nodule with punctate echogenic foci?", answer: "TIRADS 5 (Highly Suspicious): Solid (2) + Hypoechoic (2) + Taller-than-wide (3) + Punctate foci (3) = 10 points.", category: "thyroid", difficulty: "advanced" },
  { id: 8, question: "What is the normal NT measurement at 12 weeks (CRL ~55mm)?", answer: "Normal NT <3 mm. NT ≥3 mm is associated with increased risk of chromosomal abnormalities and CHD.", category: "obstetric_1st", difficulty: "basic" },
  { id: 9, question: "What B-line pattern suggests pulmonary edema?", answer: "≥3 B-lines per intercostal space (positive zone). Bilateral anterior B-lines suggest cardiogenic pulmonary edema.", category: "pocus", difficulty: "basic" },
  { id: 10, question: "What is the normal IVC diameter and collapsibility for euvolemia?", answer: "IVC 1.5-2.1 cm with >50% collapse = RAP 0-5 mmHg (euvolemic). IVC >2.1 cm with <50% collapse = elevated RAP.", category: "pocus", difficulty: "intermediate" },
  { id: 11, question: "What is the Lindegaard ratio and what value indicates severe vasospasm?", answer: "Lindegaard ratio = MCA mean velocity / ICA mean velocity. >6 indicates severe vasospasm (post-SAH).", category: "intracranial_tcd", difficulty: "advanced" },
  { id: 12, question: "What is the normal fetal cardiac axis?", answer: "45° ± 20° to the left (25-65°). The cardiac apex points to the left anterior chest wall.", category: "fetal_echo", difficulty: "basic" },
  { id: 13, question: "What is the ACR BIRADS 3 recommendation?", answer: "Probably benign. Recommend 6-month short-interval follow-up ultrasound. <2% risk of malignancy.", category: "breast", difficulty: "basic" },
  { id: 14, question: "What is the primary criterion for DVT on venous ultrasound?", answer: "Non-compressibility of the vein. The vein should fully collapse with gentle probe pressure. Failure to compress = DVT.", category: "venous", difficulty: "basic" },
  { id: 15, question: "What is the normal renal artery PSV range?", answer: "60-120 cm/s. PSV >200 cm/s or RAR (renal/aortic ratio) >3.5 suggests hemodynamically significant renal artery stenosis.", category: "abdominal_vascular", difficulty: "intermediate" },
];

export default function Flashcards() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [viewedCount, setViewedCount] = useState(0);

  const dailyQuery = trpc.flashcards.getDaily.useQuery(
    { category: selectedCategory },
    { enabled: isAuthenticated }
  );
  const publicQuery = trpc.flashcards.list.useQuery(
    { category: selectedCategory },
    { enabled: !isAuthenticated }
  );
  const recordViewMutation = trpc.flashcards.recordView.useMutation();

  const dbCards = isAuthenticated ? (dailyQuery.data?.cards ?? []) : (publicQuery.data ?? []);
  const cards = dbCards.length > 0 ? dbCards : sampleCards.filter(c =>
    selectedCategory === "all" || c.category === selectedCategory
  );

  const displayCards = useMemo(() => {
    if (!shuffled) return cards;
    return [...cards].sort(() => Math.random() - 0.5);
  }, [cards, shuffled]);

  const dailyLimit = isAuthenticated ? (dailyQuery.data?.dailyLimit ?? null) : 10;
  const usedToday = isAuthenticated ? (dailyQuery.data?.usedToday ?? 0) : viewedCount;
  const isLimitReached = !isPremium && dailyLimit !== null && usedToday >= dailyLimit;

  const currentCard = displayCards[currentIndex];

  const handleNext = () => {
    if (currentIndex < displayCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
      if (!isPremium && !isAuthenticated) setViewedCount(prev => prev + 1);
      if (isAuthenticated) recordViewMutation.mutate();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setFlipped(false);
    }
  };

  const handleShuffle = () => {
    setShuffled(prev => !prev);
    setCurrentIndex(0);
    setFlipped(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setFlipped(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Ultrasound Flashcards</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Study with {displayCards.length} cards across 16 categories</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Daily Limit Banner */}
        {!isPremium && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold">{Math.max(0, (dailyLimit ?? 10) - usedToday)}</span>
                <span className="text-muted-foreground"> free cards remaining today</span>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                  <Crown size={12} className="mr-1" /> Unlimited
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Category Filter */}
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => { setSelectedCategory("all"); setCurrentIndex(0); setFlipped(false); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === "all" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
              }`}
            >
              All Categories
            </button>
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setCurrentIndex(0); setFlipped(false); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === cat ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {displayCards.length > 0 ? `${currentIndex + 1} / ${displayCards.length}` : "0 cards"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleShuffle} className="gap-1 text-xs">
              <Shuffle size={12} /> {shuffled ? "Unshuffle" : "Shuffle"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-xs">
              <RotateCcw size={12} /> Reset
            </Button>
          </div>
        </div>

        {/* Flashcard */}
        {displayCards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No flashcards in this category yet.</p>
            </CardContent>
          </Card>
        ) : isLimitReached ? (
          <Card className="border-yellow-200 bg-yellow-50 text-center py-8">
            <CardContent>
              <Lock size={32} className="text-yellow-500 mx-auto mb-3" />
              <p className="font-semibold mb-1">Daily limit reached</p>
              <p className="text-sm text-muted-foreground mb-4">Upgrade to Premium for unlimited flashcards</p>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Crown size={14} className="mr-1.5" /> Upgrade to Premium
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : currentCard ? (
          <div className="flashcard" onClick={() => setFlipped(prev => !prev)}>
            <div className={`flashcard-inner relative ${flipped ? "flipped" : ""}`} style={{ minHeight: "280px" }}>
              {/* Front */}
              <div className="flashcard-front absolute inset-0">
                <Card className="h-full border-primary/30 cursor-pointer hover:border-primary/60 transition-colors">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                      <Badge className={`text-[10px] ${CATEGORY_COLORS[currentCard.category] ?? "bg-gray-100 text-gray-800"}`}>
                        {CATEGORY_LABELS[currentCard.category] ?? currentCard.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{(currentCard as any).difficulty ?? "basic"}</Badge>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-center text-base font-medium leading-relaxed">{currentCard.question}</p>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-4">Tap to reveal answer</p>
                  </CardContent>
                </Card>
              </div>
              {/* Back */}
              <div className="flashcard-back absolute inset-0">
                <Card className="h-full border-primary bg-primary/5 cursor-pointer">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Answer</div>
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-center text-sm leading-relaxed">{currentCard.answer}</p>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-4">Tap to flip back</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        {displayCards.length > 0 && !isLimitReached && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="gap-1"
            >
              <ChevronLeft size={16} /> Prev
            </Button>
            <div className="flex gap-1">
              {displayCards.slice(Math.max(0, currentIndex - 2), Math.min(displayCards.length, currentIndex + 3)).map((_, i) => {
                const idx = Math.max(0, currentIndex - 2) + i;
                return (
                  <button
                    key={idx}
                    onClick={() => { setCurrentIndex(idx); setFlipped(false); }}
                    className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-primary w-4" : "bg-border"}`}
                  />
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentIndex === displayCards.length - 1}
              className="gap-1"
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {/* Sign in prompt */}
        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to track progress and unlock more cards</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
