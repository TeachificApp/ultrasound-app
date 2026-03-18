import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Crown, Lock, Activity, Heart, Microscope, Baby, Stethoscope, Waves } from "lucide-react";
import { THINKIFIC_LINKS } from "@shared/appConstants";

interface Specialty {
  id: string;
  label: string;
  shortLabel: string;
  category: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  premium: boolean;
  description: string;
}

const specialties: Specialty[] = [
  {
    id: "abdominal",
    label: "Abdominal Ultrasound",
    shortLabel: "Abdominal",
    category: "General",
    icon: <Activity size={22} />,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    premium: false,
    description: "Liver, gallbladder, pancreas, spleen, kidneys, aorta",
  },
  {
    id: "pelvic-gyn",
    label: "Pelvic/Gyn Ultrasound",
    shortLabel: "Pelvic/Gyn",
    category: "OB/GYN",
    icon: <Heart size={22} />,
    color: "text-pink-700",
    bgColor: "bg-pink-50 border-pink-200",
    premium: false,
    description: "Uterus, ovaries, adnexa, pelvic floor",
  },
  {
    id: "obstetric-1st",
    label: "Obstetric 1st Trimester",
    shortLabel: "OB 1st Trim",
    category: "OB/GYN",
    icon: <Baby size={22} />,
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    premium: false,
    description: "Dating, NT screening, early anatomy",
  },
  {
    id: "obstetric-2nd-3rd",
    label: "Obstetric 2nd/3rd Trimester",
    shortLabel: "OB 2nd/3rd Trim",
    category: "OB/GYN",
    icon: <Baby size={22} />,
    color: "text-violet-700",
    bgColor: "bg-violet-50 border-violet-200",
    premium: false,
    description: "Anatomy survey, growth, biophysical profile",
  },
  {
    id: "thyroid",
    label: "Small Parts - Thyroid",
    shortLabel: "Thyroid",
    category: "Small Parts",
    icon: <Microscope size={22} />,
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    premium: false,
    description: "Thyroid nodules, parathyroid, TIRADS",
  },
  {
    id: "scrotum",
    label: "Small Parts - Scrotum",
    shortLabel: "Scrotum",
    category: "Small Parts",
    icon: <Microscope size={22} />,
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    premium: false,
    description: "Testicular pathology, epididymis, varicocele",
  },
  {
    id: "breast",
    label: "Breast Ultrasound",
    shortLabel: "Breast",
    category: "Breast",
    icon: <Activity size={22} />,
    color: "text-rose-700",
    bgColor: "bg-rose-50 border-rose-200",
    premium: true,
    description: "Breast masses, BIRADS, axillary nodes",
  },
  {
    id: "venous",
    label: "Vascular - Venous (Upper & Lower)",
    shortLabel: "Venous",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    premium: true,
    description: "DVT, venous insufficiency, mapping",
  },
  {
    id: "arterial",
    label: "Vascular - Arterial (Upper & Lower)",
    shortLabel: "Arterial",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    premium: true,
    description: "PAD, ABI, arterial duplex",
  },
  {
    id: "abdominal-vascular",
    label: "Vascular - Abdominal/Renal/Mesenteric",
    shortLabel: "Abdominal Vascular",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50 border-cyan-200",
    premium: true,
    description: "Renal artery stenosis, mesenteric ischemia",
  },
  {
    id: "aorta-endoleak",
    label: "Vascular - Abdominal Aorta/EndoLeak",
    shortLabel: "Aorta/EndoLeak",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-teal-700",
    bgColor: "bg-teal-50 border-teal-200",
    premium: true,
    description: "AAA surveillance, EVAR endoleak detection",
  },
  {
    id: "carotid",
    label: "Vascular - Extracranial Carotid Artery",
    shortLabel: "Carotid",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200",
    premium: true,
    description: "Carotid stenosis, IMT, plaque characterization",
  },
  {
    id: "tcd",
    label: "Vascular - Intracranial Duplex/TCD",
    shortLabel: "Intracranial/TCD",
    category: "Vascular",
    icon: <Waves size={22} />,
    color: "text-slate-700",
    bgColor: "bg-slate-50 border-slate-200",
    premium: true,
    description: "TCD, vasospasm, emboli detection",
  },
  {
    id: "msk",
    label: "MSK Ultrasound",
    shortLabel: "MSK",
    category: "MSK",
    icon: <Stethoscope size={22} />,
    color: "text-lime-700",
    bgColor: "bg-lime-50 border-lime-200",
    premium: true,
    description: "Tendons, ligaments, joints, guided injections",
  },
  {
    id: "pocus",
    label: "POCUS (Lung, eFAST, RUSH)",
    shortLabel: "POCUS",
    category: "POCUS",
    icon: <Stethoscope size={22} />,
    color: "text-sky-700",
    bgColor: "bg-sky-50 border-sky-200",
    premium: false,
    description: "Point-of-care lung, eFAST, RUSH protocol",
  },
];

const categoryColors: Record<string, string> = {
  General: "bg-emerald-100 text-emerald-800",
  "OB/GYN": "bg-pink-100 text-pink-800",
  "Small Parts": "bg-amber-100 text-amber-800",
  Breast: "bg-rose-100 text-rose-800",
  Vascular: "bg-blue-100 text-blue-800",
  MSK: "bg-lime-100 text-lime-800",
  POCUS: "bg-sky-100 text-sky-800",
};

export default function UltrasoundAssistHub() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";

  const categories = Array.from(new Set(specialties.map(s => s.category)));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="aaus-gradient px-4 py-6 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={20} />
            <h1 className="text-xl font-bold" style={{ fontFamily: "Merriweather, serif" }}>
              UltrasoundAssist™
            </h1>
          </div>
          <p className="text-white/80 text-sm">Select a specialty to access Navigator & ScanCoach</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Premium Banner */}
        {!isPremium && (
          <Card className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-yellow-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Unlock All 15 Specialties</div>
                  <div className="text-xs text-muted-foreground">Premium required for vascular, breast, MSK modules</div>
                </div>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs flex-shrink-0">
                  Upgrade
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Specialty Grid by Category */}
        {categories.map(category => (
          <div key={category} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`text-xs ${categoryColors[category] ?? "bg-gray-100 text-gray-800"}`}>
                {category}
              </Badge>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {specialties.filter(s => s.category === category).map(specialty => {
                const isLocked = specialty.premium && !isPremium;
                return (
                  <div key={specialty.id}>
                    {isLocked ? (
                      <Card className={`border ${specialty.bgColor} opacity-75`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl ${specialty.bgColor} flex items-center justify-center flex-shrink-0 ${specialty.color}`}>
                              {specialty.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-sm font-semibold text-foreground truncate">{specialty.shortLabel}</span>
                                <Lock size={12} className="text-muted-foreground flex-shrink-0" />
                              </div>
                              <p className="text-xs text-muted-foreground">{specialty.description}</p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Navigator</Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">ScanCoach</Badge>
                                <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-800 border-yellow-200">
                                  <Crown size={8} className="mr-0.5" /> Premium
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Link href={`/ultrasound-assist/${specialty.id}`}>
                        <Card className={`border ${specialty.bgColor} hover:shadow-md transition-all cursor-pointer group`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl ${specialty.bgColor} flex items-center justify-center flex-shrink-0 ${specialty.color} group-hover:scale-110 transition-transform`}>
                                {specialty.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-foreground mb-0.5">{specialty.shortLabel}</div>
                                <p className="text-xs text-muted-foreground">{specialty.description}</p>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Navigator</Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">ScanCoach</Badge>
                                  {!specialty.premium && (
                                    <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border-green-200">Free</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Sign in prompt */}
        {!isAuthenticated && (
          <Card className="border-primary/30 bg-primary/5 mt-4">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Sign in to access all specialty modules</p>
              <a href={getLoginUrl()}>
                <Button className="gap-2">Sign In to Continue</Button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
