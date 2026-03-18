import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { ArrowLeft, Calculator, CheckCircle, ChevronRight, Heart } from "lucide-react";

// Fetal Echo Navigator content
const fetalEchoNavigator = [
  { section: "Indications for Fetal Echo", steps: ["Maternal CHD or family history of CHD", "Maternal diabetes (pre-gestational)", "Maternal phenylketonuria", "Maternal rubella or viral illness", "Teratogen exposure (lithium, retinoic acid, alcohol)", "Abnormal obstetric screening (NT >3mm, abnormal 4-chamber)", "Fetal arrhythmia", "Fetal hydrops", "Chromosomal abnormality", "Monochorionic twinning"] },
  { section: "Optimal Timing", steps: ["Standard: 18-22 weeks gestation", "Early fetal echo: 14-16 weeks (limited)", "Follow-up: as clinically indicated"] },
  { section: "Systematic Approach", steps: ["Situs and cardiac position", "Cardiac axis (normal ~45° left)", "4-chamber view", "Left ventricular outflow tract (LVOT)", "Right ventricular outflow tract (RVOT)", "3-vessel view", "3-vessel trachea view", "Ductal arch", "Aortic arch", "Superior and inferior vena cava", "Pulmonary veins (2 right, 2 left)"] },
  { section: "4-Chamber View Assessment", steps: ["Cardiac size: ~1/3 of chest area", "Cardiac axis: 45° ± 20° to left", "Equal chamber sizes", "Intact interventricular septum", "Intact interatrial septum (foramen ovale flap)", "AV valves: mitral (left), tricuspid (right)", "Tricuspid valve more apical than mitral", "Normal myocardial thickness"] },
  { section: "Outflow Tracts", steps: ["LVOT: aorta arises from LV, crosses mitral valve", "RVOT: pulmonary artery arises from RV", "Great arteries cross each other", "Pulmonary artery bifurcates early", "Aorta continues as arch"] },
  { section: "Fetal Arrhythmia Assessment", steps: ["M-mode through atrium and ventricle", "Simultaneous atrial and ventricular rates", "Normal fetal HR: 120-160 bpm", "Irregular rhythm: PACs (most common, benign)", "Sustained tachycardia (>200 bpm): SVT, flutter", "Bradycardia (<100 bpm): heart block, sinus bradycardia"] },
];

const fetalEchoScanCoach = [
  { view: "4-Chamber View", technique: ["Transverse axial plane of fetal chest", "Identify spine position", "Evaluate cardiac axis and position", "Assess chamber sizes and septa"], findings: ["Normal: equal chambers, intact septa, normal axis", "VSD: defect in interventricular septum", "AVSD: common AV valve, primum ASD + inlet VSD", "Hypoplastic left heart: small LV, mitral atresia"] },
  { view: "LVOT View", technique: ["Rotate from 4-chamber toward fetal right shoulder", "Aorta should arise from LV", "Continuity between anterior aortic wall and IVS"], findings: ["Normal: aorta from LV, crosses mitral valve", "DORV: both great arteries from RV", "TGA: aorta from RV (parallel great arteries)", "Subaortic VSD: defect below aortic valve"] },
  { view: "RVOT View", technique: ["Continue rotation from LVOT", "Pulmonary artery from RV", "PA bifurcates early into branch PAs"], findings: ["Normal: PA larger than aorta, bifurcates", "Pulmonary atresia: no flow through pulmonary valve", "Tetralogy of Fallot: overriding aorta, RVOT obstruction"] },
  { view: "3-Vessel View", technique: ["Transverse plane above 4-chamber", "Identify PA, aorta, SVC from left to right", "PA largest, SVC smallest"], findings: ["Normal: PA > Ao > SVC, left to right alignment", "Transposition: aorta anterior to PA (parallel)", "Coarctation: small aorta relative to PA"] },
  { view: "Ductal Arch", technique: ["Sagittal plane, identify 'hockey stick' shape", "Ductus arteriosus connects PA to descending aorta"], findings: ["Normal: wide, hockey stick shape", "Ductal constriction: turbulent flow, elevated velocity"] },
  { view: "Aortic Arch", technique: ["Sagittal plane, identify 'candy cane' shape", "Three head/neck vessels arise from arch"], findings: ["Normal: smooth curve, three vessels", "Coarctation: shelf or narrowing at isthmus", "Interrupted arch: discontinuity of arch"] },
];

// Calculator definitions
interface CalcField {
  label: string;
  key: string;
  unit?: string;
  type?: string;
  min?: number;
  max?: number;
}

interface Calculator {
  id: string;
  name: string;
  description: string;
  fields: CalcField[];
  calculate: (values: Record<string, string>) => { result: string; interpretation: string } | null;
}

const calculators: Calculator[] = [
  {
    id: "cardiothoracic",
    name: "Cardiothoracic Ratio",
    description: "Assess cardiac size relative to chest",
    fields: [
      { label: "Cardiac Area (cm²)", key: "cardiac", unit: "cm²" },
      { label: "Thoracic Area (cm²)", key: "thoracic", unit: "cm²" },
    ],
    calculate: (v) => {
      const c = parseFloat(v.cardiac), t = parseFloat(v.thoracic);
      if (!c || !t) return null;
      const ratio = (c / t * 100).toFixed(1);
      return {
        result: `${ratio}%`,
        interpretation: parseFloat(ratio) > 33 ? "Cardiomegaly (>33%)" : "Normal (<33%)",
      };
    },
  },
  {
    id: "cardiac_axis",
    name: "Cardiac Axis",
    description: "Measure cardiac axis from midline",
    fields: [
      { label: "Cardiac Axis (degrees)", key: "axis", unit: "°", min: 0, max: 180 },
    ],
    calculate: (v) => {
      const axis = parseFloat(v.axis);
      if (isNaN(axis)) return null;
      const interp = axis < 25 ? "Levocardia — abnormal (too far left)" :
        axis > 65 ? "Levocardia — abnormal (too far right)" :
        "Normal (25-65°)";
      return { result: `${axis}°`, interpretation: interp };
    },
  },
  {
    id: "fetal_hr",
    name: "Fetal Heart Rate",
    description: "Calculate fetal HR from M-mode measurement",
    fields: [
      { label: "R-R Interval (ms)", key: "rr", unit: "ms" },
    ],
    calculate: (v) => {
      const rr = parseFloat(v.rr);
      if (!rr) return null;
      const hr = Math.round(60000 / rr);
      const interp = hr < 100 ? "Bradycardia (<100 bpm)" :
        hr > 160 ? "Tachycardia (>160 bpm)" :
        "Normal (100-160 bpm)";
      return { result: `${hr} bpm`, interpretation: interp };
    },
  },
  {
    id: "nt_zscore",
    name: "NT Z-Score",
    description: "Nuchal translucency Z-score by CRL",
    fields: [
      { label: "CRL (mm)", key: "crl", unit: "mm" },
      { label: "NT Measurement (mm)", key: "nt", unit: "mm" },
    ],
    calculate: (v) => {
      const crl = parseFloat(v.crl), nt = parseFloat(v.nt);
      if (!crl || !nt) return null;
      // Expected NT = 0.5445 × e^(0.02609 × CRL)
      const expected = 0.5445 * Math.exp(0.02609 * crl);
      const sd = 0.1791;
      const zscore = ((nt - expected) / sd).toFixed(2);
      const interp = parseFloat(zscore) > 3.5 ? "Significantly elevated (>3.5 SD) — high risk" :
        parseFloat(zscore) > 2.5 ? "Elevated (>2.5 SD) — increased risk" :
        "Within normal limits";
      return { result: `Z = ${zscore}`, interpretation: interp };
    },
  },
  {
    id: "pr_interval",
    name: "PR Interval (Fetal)",
    description: "Estimate fetal PR interval from M-mode",
    fields: [
      { label: "Atrial Contraction to Ventricular Contraction (ms)", key: "pr", unit: "ms" },
    ],
    calculate: (v) => {
      const pr = parseFloat(v.pr);
      if (!pr) return null;
      const interp = pr > 150 ? "Prolonged PR — consider 1st degree AV block" :
        pr < 70 ? "Short PR — consider pre-excitation" :
        "Normal PR interval (70-150 ms)";
      return { result: `${pr} ms`, interpretation: interp };
    },
  },
  {
    id: "vti",
    name: "Velocity Time Integral",
    description: "Calculate stroke volume from Doppler VTI",
    fields: [
      { label: "VTI (cm)", key: "vti", unit: "cm" },
      { label: "Valve Diameter (cm)", key: "diameter", unit: "cm" },
    ],
    calculate: (v) => {
      const vti = parseFloat(v.vti), d = parseFloat(v.diameter);
      if (!vti || !d) return null;
      const area = Math.PI * (d / 2) ** 2;
      const sv = (area * vti).toFixed(2);
      return { result: `${sv} mL`, interpretation: `Stroke Volume estimate` };
    },
  },
];

function CalculatorCard({ calc }: { calc: Calculator }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const result = calc.calculate(values);

  return (
    <Card className="border-pink-200">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator size={14} className="text-pink-600" />
          {calc.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{calc.description}</p>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {calc.fields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground">{field.label}</label>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={values[field.key] ?? ""}
                  onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="flex-1 px-2 py-1.5 text-sm border border-border rounded-md bg-background"
                  placeholder="0"
                />
                {field.unit && <span className="text-xs text-muted-foreground">{field.unit}</span>}
              </div>
            </div>
          ))}
        </div>
        {result && (
          <div className="rounded-lg bg-pink-50 border border-pink-200 p-3">
            <div className="text-2xl font-bold text-pink-600">{result.result}</div>
            <div className="text-sm font-medium mt-0.5">{result.interpretation}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FetalEchoAssist() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="aaus-gradient px-4 py-4 text-white">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="flex items-center gap-1 text-white/80 text-sm mb-2 hover:text-white">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Heart size={18} />
            <h1 className="text-lg font-bold" style={{ fontFamily: "Merriweather, serif" }}>Fetal EchoAssist™</h1>
          </div>
          <p className="text-white/80 text-xs mt-0.5">Fetal Echocardiography Navigator, ScanCoach & Calculators</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {!isAuthenticated && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Sign in to access full content and calculators</p>
              <a href={getLoginUrl()}><Button size="sm">Sign In</Button></a>
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
            {fetalEchoNavigator.map((section, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold">{idx + 1}</div>
                    {section.section}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-1.5">
                    {section.steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={14} className="text-pink-500 mt-0.5 flex-shrink-0" />
                        <span className="text-foreground/80">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="scancoach" className="space-y-3">
            {fetalEchoScanCoach.map((view, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold text-pink-600">{view.view}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Technique</div>
                    {view.technique.map((t, tIdx) => (
                      <div key={tIdx} className="flex items-start gap-2 text-sm mb-1">
                        <ChevronRight size={14} className="text-pink-500 mt-0.5 flex-shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Findings</div>
                    {view.findings.map((f, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-sm mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 mt-1.5 flex-shrink-0" />
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
            ) : (
              calculators.map(calc => <CalculatorCard key={calc.id} calc={calc} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
