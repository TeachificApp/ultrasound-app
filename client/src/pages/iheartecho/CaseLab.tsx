/*
  iHeartEcho™ — Echo Case Lab
  Gamified daily echo cases
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { BookOpen, Trophy, Flame, Star, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { UpgradeTriggerModal, useUpgradeTrigger } from "@/components/UpgradeTriggerModal";

const cases = [
  {
    id: 1,
    title: "Case 1 — Apical 4-Chamber",
    difficulty: "Intermediate",
    findings: [
      "Severely dilated LV (LVEDD 7.2 cm)",
      "EF visually estimated 20–25%",
      "Functional MR — moderate",
      "Dilated LA",
      "RV mildly dilated",
    ],
    question: "What is the most likely diagnosis?",
    options: [
      "Hypertrophic Cardiomyopathy",
      "Dilated Cardiomyopathy",
      "Cardiac Tamponade",
      "Severe Aortic Stenosis",
    ],
    correct: 1,
    explanation: "The findings of severely dilated LV with markedly reduced EF, functional MR, and dilated LA are classic for Dilated Cardiomyopathy (DCM). HCM would show hypertrophy, not dilation. Tamponade would show pericardial effusion. AS would show LVH with preserved or reduced EF.",
    points: 150,
    category: "Cardiomyopathy",
  },
  {
    id: 2,
    title: "Case 2 — CW Doppler through AV",
    difficulty: "Advanced",
    findings: [
      "AV Vmax: 4.6 m/s",
      "Mean gradient: 52 mmHg",
      "AVA: 0.7 cm²",
      "Heavily calcified AV on 2D",
    ],
    question: "What severity of aortic stenosis is present?",
    options: [
      "Mild AS",
      "Moderate AS",
      "Severe AS",
      "Very Severe AS",
    ],
    correct: 2,
    explanation: "Severe AS criteria (ASE): Vmax ≥ 4 m/s, mean gradient ≥ 40 mmHg, AVA ≤ 1.0 cm². This patient meets ALL three criteria. Very severe AS is defined as Vmax > 5 m/s by some guidelines, which is not met here.",
    points: 200,
    category: "Valvular Disease",
  },
  {
    id: 3,
    title: "Case 3 — Subcostal View",
    difficulty: "Beginner",
    findings: [
      "IVC diameter: 2.8 cm",
      "IVC collapsibility: < 20% with sniff",
      "RA enlarged",
      "RV enlarged with paradoxical septal motion",
    ],
    question: "What is the estimated RAP?",
    options: [
      "0–5 mmHg (normal)",
      "5–10 mmHg (mildly elevated)",
      "≥ 15 mmHg (severely elevated)",
      "Cannot be determined",
    ],
    correct: 2,
    explanation: "IVC > 2.1 cm with < 50% collapse with sniff indicates elevated RAP ≥ 15 mmHg (ASE 2015 guidelines). The dilated, non-collapsing IVC with enlarged RA and RV is consistent with right heart failure or severe TR.",
    points: 100,
    category: "Right Heart",
  },
  {
    id: 4,
    title: "Case 4 — Fetal Echo 3VV",
    difficulty: "Advanced",
    findings: [
      "4 vessels visible in 3-vessel view",
      "Extra vessel posterior to PA",
      "Normal cardiac situs",
      "Normal 4-chamber view",
    ],
    question: "What is the most likely cause of the extra vessel?",
    options: [
      "Double aortic arch",
      "Persistent left SVC / vertical vein (TAPVR)",
      "Pulmonary arteriovenous malformation",
      "Normal variant",
    ],
    correct: 1,
    explanation: "A 4th vessel in the 3-vessel view, particularly posterior to the PA, raises concern for a persistent left SVC or a vertical vein draining anomalous pulmonary veins (TAPVR). This requires full fetal echo evaluation and fetal cardiologist referral.",
    points: 250,
    category: "Fetal Echo",
  },
];

const leaderboard = [
  { rank: 1, name: "EchoNinja_Pro", points: 4820, streak: 45 },
  { rank: 2, name: "CardioSono", points: 4210, streak: 32 },
  { rank: 3, name: "SonographerX", points: 3950, streak: 28 },
  { rank: 4, name: "You", points: 1200, streak: 3, isUser: true },
];

export default function CaseLab() {
  const { isPremium } = usePremium();
  const { triggerType, moduleName, showUpgrade, closeUpgrade } = useUpgradeTrigger();
  const [caseIdx, setCaseIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [totalPoints, setTotalPoints] = useState(1200);
  const [streak, setStreak] = useState(3);
  const [view, setView] = useState<"cases" | "leaderboard">("cases");
  const [streakPromptShown, setStreakPromptShown] = useState(false);

  // Show streak upgrade prompt once per session when streak >= 3 and user is not premium
  useEffect(() => {
    if (!isPremium && streak >= 3 && !streakPromptShown) {
      const timer = setTimeout(() => {
        showUpgrade("streak");
        setStreakPromptShown(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [streak, isPremium, streakPromptShown]);

  const currentCase = cases[caseIdx];

  const handleAnswer = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (idx === currentCase.correct) {
      setTotalPoints(p => p + currentCase.points);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
  };

  const nextCase = () => {
    setCaseIdx(i => (i + 1) % cases.length);
    setSelected(null);
    setRevealed(false);
  };

  return (
    <Layout>
      <div className="container py-6">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: "Merriweather, serif" }}>
              Echo Case Lab
            </h1>
            <p className="text-sm text-gray-500">Daily echo cases with gamified learning. Earn Echo Ninja points!</p>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <Flame className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-amber-700">{streak} day streak</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/20">
              <Star className="w-4 h-4" style={{ color: "#189aa1" }} />
              <span className="text-sm font-bold" style={{ color: "#189aa1" }}>{totalPoints.toLocaleString()} pts</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[{ id: "cases", label: "Cases" }, { id: "leaderboard", label: "Leaderboard" }].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                view === tab.id ? "text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-[#189aa1] hover:text-[#189aa1]"
              }`}
              style={view === tab.id ? { background: "#189aa1" } : {}}>
              {tab.label}
            </button>
          ))}
        </div>

        {view === "leaderboard" ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="teal-header px-5 py-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-white" />
              <h3 className="font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>Echo Ninja Leaderboard</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {leaderboard.map(entry => (
                <div key={entry.rank} className={`flex items-center gap-4 px-5 py-4 ${entry.isUser ? "bg-[#f0fbfc]" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    entry.rank === 1 ? "bg-amber-400 text-white" :
                    entry.rank === 2 ? "bg-gray-300 text-gray-700" :
                    entry.rank === 3 ? "bg-amber-700 text-white" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-800">{entry.name} {entry.isUser && <span className="text-xs text-[#189aa1]">(You)</span>}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Flame className="w-3 h-3 text-amber-400" />
                      {entry.streak} day streak
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold data-value" style={{ fontFamily: "JetBrains Mono, monospace", color: "#189aa1" }}>
                      {entry.points.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">points</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Case list */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Available Cases</div>
              {cases.map((c, i) => (
                <button key={c.id} onClick={() => { setCaseIdx(i); setSelected(null); setRevealed(false); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    caseIdx === i ? "border-[#189aa1] bg-[#f0fbfc]" : "border-gray-100 bg-white hover:border-[#189aa1]/30"
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: "#189aa1" }}>{c.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.difficulty === "Beginner" ? "bg-green-50 text-green-700" :
                      c.difficulty === "Intermediate" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>{c.difficulty}</span>
                  </div>
                  <div className="text-xs font-semibold text-gray-700">{c.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">+{c.points} pts</div>
                </button>
              ))}
            </div>

            {/* Active case */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="teal-header px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/70">{currentCase.category} · {currentCase.difficulty}</div>
                    <h3 className="font-bold text-white" style={{ fontFamily: "Merriweather, serif" }}>{currentCase.title}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                    <Star className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-bold">+{currentCase.points} pts</span>
                  </div>
                </div>
                <div className="p-5">
                  {/* Findings */}
                  <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Echo Findings</div>
                    <div className="p-4 rounded-lg bg-[#f0fbfc] border border-[#189aa1]/10 space-y-1.5">
                      {currentCase.findings.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#189aa1] flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Question */}
                  <div className="mb-4">
                    <div className="text-sm font-bold text-gray-700 mb-3">{currentCase.question}</div>
                    <div className="space-y-2">
                      {currentCase.options.map((opt, i) => {
                        const isCorrect = i === currentCase.correct;
                        const isSelected = i === selected;
                        let cls = "border-gray-100 bg-white hover:border-[#189aa1]/40";
                        if (revealed) {
                          if (isCorrect) cls = "border-green-400 bg-green-50";
                          else if (isSelected && !isCorrect) cls = "border-red-300 bg-red-50";
                        }
                        return (
                          <button key={i} onClick={() => handleAnswer(i)}
                            disabled={revealed}
                            className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${cls} ${revealed ? "cursor-default" : "cursor-pointer"}`}>
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                              revealed && isCorrect ? "border-green-500 bg-green-500 text-white" :
                              revealed && isSelected ? "border-red-400 bg-red-400 text-white" :
                              "border-gray-300 text-gray-400"
                            }`}>
                              {revealed && isCorrect ? <CheckCircle2 className="w-3 h-3" /> :
                               revealed && isSelected ? <XCircle className="w-3 h-3" /> :
                               String.fromCharCode(65 + i)}
                            </span>
                            <span className="text-sm text-gray-700">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  {revealed && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className={`p-4 rounded-lg border mb-4 ${selected === currentCase.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {selected === currentCase.correct
                            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                            : <XCircle className="w-4 h-4 text-red-500" />}
                          <span className={`text-sm font-bold ${selected === currentCase.correct ? "text-green-700" : "text-red-700"}`}>
                            {selected === currentCase.correct ? `Correct! +${currentCase.points} points` : "Incorrect"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{currentCase.explanation}</p>
                      </div>
                      <button onClick={nextCase}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all hover:opacity-90"
                        style={{ background: "#189aa1" }}>
                        Next Case <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Streak upgrade trigger modal */}
      <UpgradeTriggerModal triggerType={triggerType} moduleName={moduleName} onClose={closeUpgrade} />
    </Layout>
  );
}
