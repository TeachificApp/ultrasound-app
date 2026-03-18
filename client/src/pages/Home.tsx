import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  BookOpen,
  Brain,
  Crown,
  FileText,
  Heart,
  Trophy,
  Volume2,
  Zap,
  ArrowRight,
  Star,
  Users,
  TrendingUp,
} from "lucide-react";
import { AAUS_LOGO_URL, THINKIFIC_LINKS } from "@shared/appConstants";

const AAUS_LOGO = AAUS_LOGO_URL;

const quickLinks = [
  { label: "UltrasoundAssist™", href: "/ultrasound-assist", icon: <Activity size={20} />, color: "bg-teal-500", desc: "15 specialty modules" },
  { label: "POCUS-Assist™", href: "/pocus-assist", icon: <Zap size={20} />, color: "bg-blue-500", desc: "eFAST, RUSH, Lung, Cardiac" },
  { label: "Fetal EchoAssist™", href: "/fetal-echo-assist", icon: <Heart size={20} />, color: "bg-pink-500", desc: "Fetal echo calculators" },
  { label: "Daily Challenge", href: "/daily-challenge", icon: <Brain size={20} />, color: "bg-purple-500", desc: "Test your knowledge" },
  { label: "Flashcards", href: "/flashcards", icon: <BookOpen size={20} />, color: "bg-amber-500", desc: "Study & review" },
  { label: "Case Library", href: "/case-library", icon: <FileText size={20} />, color: "bg-emerald-500", desc: "Clinical cases" },
  { label: "SoundBytes™", href: "/soundbytes", icon: <Volume2 size={20} />, color: "bg-indigo-500", desc: "Video pearls" },
  { label: "Leaderboard", href: "/leaderboard", icon: <Trophy size={20} />, color: "bg-orange-500", desc: "Top performers" },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const challengeQuery = trpc.challenge.today.useQuery();
  const myResponseQuery = trpc.challenge.myResponse.useQuery(undefined, { enabled: isAuthenticated });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="aaus-gradient-light px-4 py-8 md:py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-4">
            <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-20 h-20 rounded-full object-cover shadow-lg" />
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
            UltrasoundAssist™
          </h1>
          <p className="text-white/90 text-sm md:text-base mb-1">
            All About Ultrasound™ Clinical Intelligence Platform
          </p>
          <p className="text-white/70 text-xs md:text-sm mb-6">
            General · OB/GYN · Vascular · Breast · POCUS · MSK
          </p>

          {!isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={getLoginUrl()}>
                <Button className="bg-white text-primary hover:bg-white/90 font-semibold px-6">
                  Sign In
                </Button>
              </a>
              <a href={THINKIFIC_LINKS.freeRegister} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="border-white text-white hover:bg-white/20 px-6">
                  Register Free
                </Button>
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <div className="text-white/90 text-sm">
                Welcome back, <span className="font-semibold">{user?.name ?? user?.email}</span>
              </div>
              {isPremium ? (
                <Badge className="bg-yellow-400 text-yellow-900 text-xs">
                  <Crown size={10} className="mr-1" /> PREMIUM
                </Badge>
              ) : (
                <Link href="/premium">
                  <Badge className="bg-white/20 text-white text-xs cursor-pointer hover:bg-white/30">
                    Upgrade to Premium
                  </Badge>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Daily Challenge Banner */}
        {challengeQuery.data && !myResponseQuery.data && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Brain size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Daily Challenge Available!</div>
                    <div className="text-xs text-muted-foreground">Answer today's question to earn points</div>
                  </div>
                </div>
                <Link href="/daily-challenge">
                  <Button size="sm" className="gap-1">
                    Take Challenge <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Stats */}
        {isAuthenticated && user && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-primary">{user.totalPoints ?? 0}</div>
                <div className="text-xs text-muted-foreground">Points</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-orange-500">{user.streakCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">Day Streak 🔥</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-emerald-500">{isPremium ? "PRO" : "FREE"}</div>
                <div className="text-xs text-muted-foreground">Membership</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Access Grid */}
        <div>
          <h2 className="text-lg font-bold mb-3 text-foreground">Quick Access</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="hover:shadow-md transition-all cursor-pointer hover:border-primary/40 group">
                  <CardContent className="p-4 text-center">
                    <div className={`w-10 h-10 rounded-xl ${link.color} flex items-center justify-center mx-auto mb-2 text-white group-hover:scale-110 transition-transform`}>
                      {link.icon}
                    </div>
                    <div className="text-xs font-semibold text-foreground leading-tight">{link.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{link.desc}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Premium Upgrade CTA */}
        {!isPremium && (
          <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Crown size={24} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-1">Unlock Premium Access</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Get unlimited flashcards, all 15 specialty modules, advanced calculators, and more.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                        $9.97/month
                      </Button>
                    </a>
                    <a href={THINKIFIC_LINKS.premiumAnnual} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-700 text-xs">
                        $99.97/year (Save 17%)
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* About Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star size={16} className="text-primary" />
              About UltrasoundAssist™
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              UltrasoundAssist™ is the clinical intelligence platform from <strong>All About Ultrasound™</strong>, 
              designed for sonographers, physicians, and ultrasound educators.
            </p>
            <p>
              Access ScanCoach protocols and Navigator guides for 15 ultrasound specialties, 
              including abdominal, OB/GYN, vascular, breast, POCUS, and MSK ultrasound.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["Abdominal", "OB/GYN", "Vascular", "Breast", "POCUS", "MSK", "Thyroid", "Fetal Echo"].map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-6">
          <p>© All About Ultrasound, Inc. dba iHeartEcho. All rights reserved.</p>
          <p className="mt-1">UltrasoundAssist™ is for educational purposes only.</p>
        </div>
      </div>
    </div>
  );
}
