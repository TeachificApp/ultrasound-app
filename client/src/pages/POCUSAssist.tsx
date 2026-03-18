import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, ChevronRight, Crown, Lock, Calculator, Zap } from "lucide-react";
import { THINKIFIC_LINKS } from "@shared/appConstants";

const pocusModules = [
  {
    id: "efast",
    label: "eFAST",
    color: "bg-red-500",
    premium: false,
    description: "Extended Focused Assessment with Sonography in Trauma",
    navigator: [
      { section: "eFAST Protocol Overview", steps: ["Phased array or curvilinear probe", "5 windows: RUQ, LUQ, Pelvic, Bilateral Anterior Chest", "Goal: identify life-threatening hemorrhage and pneumothorax", "Perform in <3 minutes in trauma bay"] },
      { section: "RUQ — Morrison's Pouch", steps: ["Coronal plane, right mid-axillary line", "Identify hepatorenal interface", "Evaluate subdiaphragmatic space", "Positive: anechoic stripe between liver and kidney"] },
      { section: "LUQ — Splenorenal Space", steps: ["Coronal plane, left posterior axillary line", "Identify splenorenal interface", "Evaluate subdiaphragmatic space", "More difficult — spleen smaller than liver"] },
      { section: "Pelvic Window", steps: ["Supine, transverse and sagittal", "Full bladder improves visualization", "Evaluate retrovesical/rectouterine space", "Positive: anechoic fluid posterior to bladder"] },
      { section: "Bilateral Anterior Chest", steps: ["Linear or phased array probe", "2nd intercostal space, mid-clavicular line", "Identify 'bat sign' (ribs + pleural line)", "Absent lung sliding + A-lines = pneumothorax", "Lung point = pathognomonic for pneumothorax"] },
    ],
    scancoach: [
      { view: "RUQ Morrison's Pouch", technique: ["Coronal plane at right mid-axillary line", "Probe marker toward head", "Identify liver-kidney interface"], findings: ["Positive: anechoic stripe between liver/kidney", ">200 mL needed to detect", "Clotted blood may appear echogenic"] },
      { view: "Anterior Chest (Pneumothorax)", technique: ["Longitudinal intercostal plane", "Identify 'bat sign'", "Assess lung sliding in real-time"], findings: ["Normal: lung sliding present (seashore sign on M-mode)", "Pneumothorax: absent lung sliding (barcode sign on M-mode)", "Lung point: transition between sliding and non-sliding"] },
    ],
    calculators: [
      { name: "eFAST Grader", description: "Score eFAST findings and guide management", fields: [
        { label: "RUQ (Morrison's Pouch)", key: "ruq", options: ["Negative", "Positive"] },
        { label: "LUQ (Splenorenal)", key: "luq", options: ["Negative", "Positive"] },
        { label: "Pelvic", key: "pelvic", options: ["Negative", "Positive"] },
        { label: "Pericardial", key: "pericardial", options: ["Negative", "Positive"] },
        { label: "Right Chest (PTX)", key: "rchest", options: ["Normal", "Pneumothorax"] },
        { label: "Left Chest (PTX)", key: "lchest", options: ["Normal", "Pneumothorax"] },
      ]},
    ],
  },
  {
    id: "cardiac",
    label: "Cardiac POCUS",
    color: "bg-pink-500",
    premium: false,
    description: "Focused cardiac ultrasound for rapid hemodynamic assessment",
    navigator: [
      { section: "Cardiac POCUS Views", steps: ["Subxiphoid 4-chamber", "Parasternal long axis (PLAX)", "Parasternal short axis (PSAX)", "Apical 4-chamber (A4C)", "IVC assessment"] },
      { section: "Focused Assessment Goals", steps: ["Global LV function (EF estimate)", "Pericardial effusion/tamponade", "RV size and function", "Gross valvular abnormalities", "Volume status (IVC)"] },
    ],
    scancoach: [
      { view: "Subxiphoid 4-Chamber", technique: ["Probe below xiphoid, angled toward left shoulder", "Use liver as acoustic window", "Identify all 4 chambers"], findings: ["Pericardial effusion: anechoic space around heart", "Tamponade: RV collapse in diastole", "Global hypokinesis: cardiogenic shock"] },
      { view: "IVC Assessment", technique: ["Subxiphoid or right lateral approach", "Longitudinal IVC at RA junction", "Measure at 2 cm from RA"], findings: ["IVC <2.1 cm + >50% collapse: RAP 0-5 mmHg (hypovolemia)", "IVC >2.1 cm + <50% collapse: RAP 10-20 mmHg (elevated)", "Plethoric IVC: tamponade, PE, RV failure"] },
    ],
    calculators: [
      { name: "IVC Collapsibility Index", description: "Calculate IVC-CI for volume status assessment", fields: [
        { label: "IVC Max Diameter (cm)", key: "ivc_max", type: "number" },
        { label: "IVC Min Diameter (cm)", key: "ivc_min", type: "number" },
      ]},
    ],
  },
  {
    id: "rush",
    label: "RUSH Protocol",
    color: "bg-orange-500",
    premium: true,
    description: "Rapid Ultrasound in Shock and Hypotension",
    navigator: [
      { section: "RUSH: The Pump", steps: ["Cardiac POCUS: EF, pericardial effusion", "Identify obstructive (tamponade, PE) vs. cardiogenic shock", "Assess RV for strain (D-sign, McConnell's sign)"] },
      { section: "RUSH: The Tank", steps: ["IVC: volume status (see IVC-CI)", "eFAST: hemorrhagic shock", "Lung: bilateral B-lines (cardiogenic), unilateral (pneumonia)", "Pneumothorax: absent lung sliding"] },
      { section: "RUSH: The Pipes", steps: ["Aorta: AAA (aneurysmal shock)", "DVT: bilateral femoral/popliteal compression", "Identify obstructive vs. distributive causes"] },
    ],
    scancoach: [
      { view: "RUSH Systematic Approach", technique: ["Start with cardiac (pump)", "Then IVC and lungs (tank)", "Finally aorta and DVT (pipes)"], findings: ["Cardiogenic: poor EF, B-lines, plethoric IVC", "Obstructive: tamponade or RV strain (PE)", "Distributive: hyperdynamic heart, flat IVC", "Hemorrhagic: positive eFAST, flat IVC"] },
    ],
    calculators: [],
  },
  {
    id: "lung",
    label: "Lung POCUS",
    color: "bg-sky-500",
    premium: true,
    description: "Lung ultrasound for pneumonia, effusion, pneumothorax, and pulmonary edema",
    navigator: [
      { section: "Lung Zones Protocol", steps: ["8-zone protocol: 4 zones per side", "Anterior: 2nd ICS MCL", "Lateral: 4th-5th ICS AAL", "Posterior: below scapula tip", "Use phased array or curvilinear probe"] },
      { section: "Lung Artifacts", steps: ["A-lines: horizontal, equidistant — normal or PTX", "B-lines: vertical, laser-like, reach bottom — interstitial fluid", "≥3 B-lines per zone: positive for interstitial syndrome", "Lung point: transition zone — pathognomonic for PTX", "Quad sign: effusion", "Sinusoid sign: effusion (M-mode)"] },
    ],
    scancoach: [
      { view: "Anterior Zone Assessment", technique: ["Longitudinal intercostal plane", "Identify 'bat sign'", "Assess for lung sliding and artifacts"], findings: ["A-lines only: normal or pneumothorax", "B-lines: pulmonary edema, pneumonia, fibrosis", "Absent sliding + A-lines: pneumothorax"] },
    ],
    calculators: [
      { name: "B-Line Scorer", description: "Quantify B-lines across lung zones", fields: [
        { label: "Right Anterior (B-lines)", key: "ra", type: "number" },
        { label: "Right Lateral (B-lines)", key: "rl", type: "number" },
        { label: "Left Anterior (B-lines)", key: "la", type: "number" },
        { label: "Left Lateral (B-lines)", key: "ll", type: "number" },
      ]},
    ],
  },
];

function IVCCalculator() {
  const [ivcMax, setIvcMax] = useState("");
  const [ivcMin, setIvcMin] = useState("");
  const ci = ivcMax && ivcMin ? ((parseFloat(ivcMax) - parseFloat(ivcMin)) / parseFloat(ivcMax) * 100).toFixed(1) : null;
  const interpretation = ci !== null ? (
    parseFloat(ci) > 50 ? "Hypovolemia likely (RAP 0-5 mmHg)" :
    parseFloat(ci) > 35 ? "Indeterminate (RAP ~8 mmHg)" :
    "Elevated RAP (10-20 mmHg) — consider fluid overload"
  ) : null;

  return (
    <Card className="border-sky-200 bg-sky-50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator size={14} className="text-sky-600" />
          IVC Collapsibility Index
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">IVC Max (cm)</label>
            <input type="number" step="0.1" value={ivcMax} onChange={e => setIvcMax(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background" placeholder="e.g. 2.1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">IVC Min (cm)</label>
            <input type="number" step="0.1" value={ivcMin} onChange={e => setIvcMin(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background" placeholder="e.g. 0.8" />
          </div>
        </div>
        {ci !== null && (
          <div className="rounded-lg bg-white border border-sky-200 p-3">
            <div className="text-2xl font-bold text-sky-600">{ci}%</div>
            <div className="text-xs text-muted-foreground">IVC-CI</div>
            <div className="text-sm font-medium mt-1">{interpretation}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BLineScorer() {
  const [zones, setZones] = useState({ ra: "", rl: "", la: "", ll: "" });
  const total = Object.values(zones).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  const interpretation = total >= 3 ? (total >= 10 ? "Severe interstitial syndrome" : "Moderate interstitial syndrome") : "Normal or minimal B-lines";

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator size={14} className="text-blue-600" />
          B-Line Scorer
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[["ra", "R Anterior"], ["rl", "R Lateral"], ["la", "L Anterior"], ["ll", "L Lateral"]].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input type="number" min="0" max="10" value={zones[key as keyof typeof zones]}
                onChange={e => setZones(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background" placeholder="0" />
            </div>
          ))}
        </div>
        {Object.values(zones).some(v => v !== "") && (
          <div className="rounded-lg bg-white border border-blue-200 p-3">
            <div className="text-2xl font-bold text-blue-600">{total}</div>
            <div className="text-xs text-muted-foreground">Total B-Lines</div>
            <div className="text-sm font-medium mt-1">{interpretation}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function POCUSAssist() {
  const { user, isAuthenticated } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const [activeModule, setActiveModule] = useState("efast");

  const currentModule = pocusModules.find(m => m.id === activeModule)!;
  const isLocked = currentModule.premium && !isPremium;

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Zap size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>POCUS-Assist™</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Point-of-Care Ultrasound Navigator & ScanCoach</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Module Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {pocusModules.map(mod => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeModule === mod.id
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${mod.color} flex items-center justify-center text-white mb-1.5`}>
                <Zap size={14} />
              </div>
              <div className="text-xs font-semibold leading-tight">{mod.label}</div>
              {mod.premium && !isPremium && <Crown size={10} className="text-yellow-500 mt-0.5" />}
            </button>
          ))}
        </div>

        {/* Locked State */}
        {isLocked && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock size={18} className="text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Premium Content</div>
                <div className="text-xs text-muted-foreground">Upgrade to access {currentModule.label}</div>
              </div>
              <a href={THINKIFIC_LINKS.premiumMonthly} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs">
                  <Crown size={12} className="mr-1" /> Upgrade
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="navigator">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="navigator">Navigator</TabsTrigger>
            <TabsTrigger value="scancoach">ScanCoach</TabsTrigger>
            <TabsTrigger value="calculators">Calculators</TabsTrigger>
          </TabsList>

          <TabsContent value="navigator" className="space-y-3">
            {(isLocked ? currentModule.navigator.slice(0, 1) : currentModule.navigator).map((section, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{idx + 1}</div>
                    {section.section}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {section.steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/80">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="scancoach" className="space-y-3">
            {(isLocked ? currentModule.scancoach.slice(0, 1) : currentModule.scancoach).map((view, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-primary">{view.view}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Technique</div>
                    {view.technique.map((t, tIdx) => (
                      <div key={tIdx} className="flex items-start gap-2 text-sm mb-1">
                        <ChevronRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Findings</div>
                    {view.findings.map((f, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-sm mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="calculators" className="space-y-3">
            {!isAuthenticated ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Sign in to use calculators</p>
                  <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
                </CardContent>
              </Card>
            ) : currentModule.id === "cardiac" || currentModule.id === "efast" ? (
              <IVCCalculator />
            ) : currentModule.id === "lung" ? (
              <BLineScorer />
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-sm text-muted-foreground">
                  No calculators available for this module.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
