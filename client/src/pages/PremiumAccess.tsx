import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, Crown, Star, Zap } from "lucide-react";
import { THINKIFIC_LINKS } from "@shared/appConstants";

const freeFeatures = [
  "Access to 5 free specialty modules (Abdominal, Pelvic/Gyn, OB 1st & 2nd/3rd Trimester, POCUS)",
  "Navigator & ScanCoach for free modules",
  "10 flashcards per day",
  "POCUS-Assist tools (eFAST, Cardiac POCUS)",
  "Fetal EchoAssist Navigator & ScanCoach",
  "Fetal Echo Calculators (6 calculators)",
  "Public case library access",
  "SoundBytes (free content)",
  "Learn Fetal Echo (free course)",
];

const premiumFeatures = [
  "All 15 specialty modules (including Vascular, Breast, MSK, Thyroid, Scrotum)",
  "Full Navigator & ScanCoach for all specialties",
  "Unlimited flashcards",
  "Full POCUS-Assist suite (RUSH, Lung POCUS)",
  "All Fetal EchoAssist calculators",
  "Full case library with all categories",
  "All SoundBytes content",
  "All Learn Fetal Echo courses",
  "Priority support",
  "New content as it's added",
];

export default function PremiumAccess() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";

  if (isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aaus-gradient px-4 py-4 text-white">
          <div className="max-w-3xl mx-auto">
            <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <Crown size={18} />
              <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Premium Access</h1>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <Crown size={28} className="text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">You have Premium Access!</h2>
          <p className="text-muted-foreground mb-6">All features are unlocked. Enjoy unlimited access to all UltrasoundAssist™ content.</p>
          <Link href="/">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Crown size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Upgrade to Premium</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Unlock all 15 specialty modules and unlimited access</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <Card className="border-primary/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-white text-[10px] px-2 py-1 rounded-bl-lg font-medium">Popular</div>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={18} className="text-primary" />
                <span className="font-bold text-sm">Monthly Premium</span>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold">$9.97</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-1">
                  <Crown size={14} /> Subscribe Monthly
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Annual */}
          <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-yellow-500 text-white text-[10px] px-2 py-1 rounded-bl-lg font-medium">Best Value</div>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star size={18} className="text-yellow-500" />
                <span className="font-bold text-sm">Annual Premium</span>
              </div>
              <div className="mb-1">
                <span className="text-3xl font-bold">$99.97</span>
                <span className="text-muted-foreground text-sm">/year</span>
              </div>
              <div className="text-xs text-green-600 font-medium mb-4">Save ~17% vs monthly</div>
              <a href={THINKIFIC_LINKS.premiumAnnual} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Star size={14} /> Subscribe Annual
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Free Membership */}
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="font-semibold text-sm mb-1">Free Membership</div>
            <p className="text-xs text-muted-foreground mb-3">Create a free account to access core features</p>
            <a href={THINKIFIC_LINKS.freeMembership} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full text-sm">Create Free Account</Button>
            </a>
          </CardContent>
        </Card>

        {/* Feature Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">F</div>
                Free
              </div>
              <div className="space-y-2">
                {freeFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle size={12} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Crown size={14} className="text-yellow-500" />
                Premium
              </div>
              <div className="space-y-2">
                {premiumFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle size={12} className="text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in first to link your membership</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
