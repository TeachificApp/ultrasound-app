/*
  iHeartEcho™ — Pediatric CHD Scan Coach
  Brand: Teal #189aa1, Aqua #4ad9e0
  Design: Teal/aqua graduated palette, Merriweather headings, Open Sans body
  Focus: CHD scanning tips, criteria, staged palliation surveillance
*/
import { useState, useRef, useMemo, useEffect } from "react";
import { AlertTriangle, ChevronRight, ChevronLeft, Heart, Activity, Eye, Info, Stethoscope } from "lucide-react";
import { useScanCoachOverrides } from "@/hooks/useScanCoachOverrides";
import { PremiumPearlGate } from "@/components/PremiumPearlGate";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScanStage {
  id: string;
  label: string;          // e.g. "Pre-Op", "Post-Norwood", "Inter-Stage (Norwood→Glenn)"
  timing: string;         // e.g. "Neonatal", "3–6 months"
  overview: string;
  keyViews: string[];
  keyMeasurements: string[];
  doppler: string[];
  normalCriteria: string[];
  redFlags: string[];
  tips: string[];
}

interface CHDDefect {
  id: string;
  name: string;
  abbr: string;
  category: string;
  color: string;
  anatomy: string;
  stages: ScanStage[];
}

// ─── CHD Data ─────────────────────────────────────────────────────────────────
const chdDefects: CHDDefect[] = [
  // ── ASD ──────────────────────────────────────────────────────────────────────
  {
    id: "asd",
    name: "Atrial Septal Defect",
    abbr: "ASD",
    category: "Shunt Lesion",
    color: "#189aa1",
    anatomy: "Defect in the interatrial septum allowing left-to-right shunting. Ostium secundum (70%) is the most common type, located in the fossa ovalis. Ostium primum (15–20%) is an atrioventricular septal defect variant at the inferior IAS near the AV valves. Sinus venosus (5–10%) is located at the SVC–RA or IVC–RA junction and is associated with partial anomalous pulmonary venous return (PAPVR). Coronary sinus ASD is rare. Haemodynamic significance depends on defect size, shunt direction, and RV compliance. Qp:Qs >1.5 with RV dilation is the threshold for closure.",
    stages: [
      {
        id: "asd-diagnosis",
        label: "Diagnosis & Sizing",
        timing: "Any age — often incidental or at routine screening",
        overview: "Characterise ASD type, size, and location. Assess shunt direction and magnitude. Evaluate RV dilation and function. Identify associated anomalies (PAPVR, cleft MV in primum ASD).",
        keyViews: [
          "Subcostal — best view for IAS; perpendicular beam avoids dropout artefact",
          "A4C — RV dilation, TR, shunt direction on color Doppler",
          "PSAX — secundum ASD at fossa ovalis; primum at inferior IAS near AV valves",
          "Subcostal bicaval — sinus venosus ASD at SVC–RA junction; PAPVR",
          "PSAX high — right pulmonary veins for PAPVR assessment",
        ],
        keyMeasurements: [
          "ASD diameter (subcostal — maximum dimension)",
          "Rim measurements: aortic rim, posterior rim, inferior rim, superior rim, AV valve rim (all ≥5 mm required for device closure)",
          "RV end-diastolic dimension (Z-score)",
          "RV FAC and TAPSE",
          "Qp:Qs (RVOT VTI × RVOT area / LVOT VTI × LVOT area)",
          "TR Vmax (RV systolic pressure estimate)",
        ],
        doppler: [
          "Color Doppler across IAS — direction and extent of shunt (L→R = left-to-right; R→L = Eisenmenger)",
          "CW across ASD — mean gradient (low velocity = unrestricted shunt)",
          "TR CW — RVSP estimate (elevated RVSP = pulmonary hypertension)",
          "PW RVOT and LVOT — Qp:Qs calculation",
          "PW at right pulmonary veins — assess for PAPVR (anomalous drainage to SVC or RA)",
        ],
        normalCriteria: [
          "Secundum ASD: all rims ≥5 mm (suitable for device closure)",
          "RV dilation proportional to shunt size",
          "RVSP <40 mmHg (no significant pulmonary hypertension)",
          "L→R shunt direction (no R→L component)",
        ],
        redFlags: [
          "R→L shunt or bidirectional shunt → pulmonary hypertension / Eisenmenger — urgent cardiology review",
          "RVSP >50 mmHg → elevated PA pressure — catheterisation before closure",
          "Deficient aortic rim (<5 mm) — may still be closeable with device but requires careful assessment",
          "Cleft anterior MV leaflet (primum ASD) — must be repaired surgically, not suitable for device closure",
          "PAPVR (sinus venosus ASD) — requires surgical repair, not device closure",
        ],
        tips: [
          "Subcostal view is the gold standard for IAS assessment — the ultrasound beam is perpendicular to the septum, eliminating dropout artefact that can mimic an ASD from the A4C view.",
          "Always measure all rims before recommending device closure — a deficient aortic rim (<5 mm) is the most common reason for surgical referral in secundum ASD.",
          "Sinus venosus ASD is frequently missed — always interrogate the SVC–RA junction from the subcostal bicaval view and look for anomalous right pulmonary veins draining to the SVC.",
          "Qp:Qs >1.5 with RV dilation is the standard threshold for closure — below this, haemodynamic benefit is uncertain.",
        ],
      },
      {
        id: "asd-post-closure",
        label: "Post-Closure Surveillance",
        timing: "1 month, 6 months, 12 months, then annually",
        overview: "Confirm device position and IAS integrity. Assess for residual shunt, device erosion, and RV remodeling. Monitor for late complications including device embolisation, aortic erosion, and new arrhythmia.",
        keyViews: [
          "Subcostal — device position, residual shunt",
          "A4C — RV size regression, TR",
          "PSAX — device position relative to aortic root (erosion risk)",
          "A4C + PSAX color Doppler — residual shunt assessment",
        ],
        keyMeasurements: [
          "RV end-diastolic dimension (serial — should regress after closure)",
          "TAPSE and FAC (serial)",
          "TR severity (serial)",
          "Residual shunt size (if present)",
        ],
        doppler: [
          "Color Doppler across device — residual shunt (trivial residual is acceptable early)",
          "TR CW — RVSP (should normalise after closure)",
          "Color at aortic root — device erosion causes pericardial effusion or aortic regurgitation",
        ],
        normalCriteria: [
          "No residual shunt at 1 month (or trivial)",
          "RV size regression toward normal within 6–12 months",
          "RVSP normalisation",
          "Device in stable position — no impingement on AV valves or aorta",
        ],
        redFlags: [
          "Pericardial effusion post-device closure → device erosion — urgent surgical review",
          "New aortic regurgitation → aortic root erosion by device",
          "Persistent RV dilation at 12 months → residual shunt or pulmonary hypertension",
          "Device embolisation (loss of device position) — emergency retrieval",
        ],
        tips: [
          "RV remodeling after ASD closure takes 6–12 months — do not be alarmed by persistent mild RV dilation at the 1-month visit.",
          "Device erosion is rare (<0.1%) but life-threatening — educate patients and families about symptoms (chest pain, palpitations, haemodynamic collapse) and the importance of follow-up.",
          "Persistent pulmonary hypertension after closure suggests pre-existing pulmonary vascular disease — these patients need ongoing PA pressure surveillance.",
        ],
      },
    ],
  },
  // ── VSD ──────────────────────────────────────────────────────────────────────
  {
    id: "vsd",
    name: "Ventricular Septal Defect",
    abbr: "VSD",
    category: "Shunt Lesion",
    color: "#1ba8b0",
    anatomy: "Defect in the interventricular septum. Perimembranous (70–80%) is the most common type, located at the membranous septum below the aortic valve, often with a tricuspid valve aneurysm that may partially close the defect. Muscular VSDs (5–20%) are located in the trabecular septum and may be multiple ('Swiss cheese'). Outlet/subarterial VSDs (5–7% in Western populations; up to 30% in Asian populations) are located beneath the pulmonary and aortic valves and carry a risk of progressive aortic valve prolapse and AR. Inlet VSDs are associated with AV septal defects. Haemodynamic significance depends on size, location, and pulmonary vascular resistance.",
    stages: [
      {
        id: "vsd-diagnosis",
        label: "Diagnosis & Sizing",
        timing: "Neonatal to infant — often detected on newborn examination or at routine screening",
        overview: "Characterise VSD type, size, and location. Assess shunt direction and magnitude. Evaluate LV volume loading and function. Identify associated anomalies (AR in outlet VSD, AV valve abnormalities in inlet VSD). Determine suitability for device closure vs. surgical repair.",
        keyViews: [
          "PLAX — perimembranous VSD below aortic valve; outlet VSD beneath pulmonary valve",
          "PSAX — perimembranous VSD at 9–11 o'clock; outlet VSD at 12 o'clock; inlet VSD at 5–7 o'clock",
          "A4C — inlet VSD, LV dilation, MV/TV morphology",
          "A5C — perimembranous VSD, LVOT, aortic valve prolapse (outlet VSD)",
          "Subcostal — muscular VSDs; multiple defects",
        ],
        keyMeasurements: [
          "VSD diameter (multiple views — largest dimension)",
          "VSD CW gradient (high gradient = restrictive; low gradient = non-restrictive with elevated PA pressure)",
          "LV end-diastolic dimension (Z-score) — LV dilation = significant shunt",
          "LA:Ao ratio (>1.5 = significant left heart dilation)",
          "Qp:Qs (RVOT VTI × RVOT area / LVOT VTI × LVOT area)",
          "RVSP from TR CW (TR Vmax² × 4 + RAP)",
          "Aortic valve morphology and AR (outlet VSD)",
        ],
        doppler: [
          "Color Doppler across VSD — direction (L→R = normal; R→L = Eisenmenger or elevated RVSP)",
          "CW across VSD — peak gradient (>64 mmHg = restrictive, RV pressure <40 mmHg; <25 mmHg = non-restrictive)",
          "TR CW — RVSP estimate",
          "Color at aortic valve (PLAX, A5C) — AR from cusp prolapse into VSD (outlet VSD)",
          "PW RVOT and LVOT — Qp:Qs calculation",
        ],
        normalCriteria: [
          "Restrictive VSD: CW gradient >64 mmHg, normal LV size, RVSP <40 mmHg",
          "No AR (no aortic cusp prolapse)",
          "L→R shunt direction",
          "Normal LV dimensions (no volume overload)",
        ],
        redFlags: [
          "Non-restrictive VSD (gradient <25 mmHg) with elevated RVSP → urgent cardiology review; Eisenmenger risk",
          "R→L or bidirectional shunt → Eisenmenger physiology — closure contraindicated",
          "Aortic valve prolapse into VSD with AR → surgical repair regardless of VSD size",
          "LV dilation (Z-score >+3) with Qp:Qs >2 → closure indicated",
          "Multiple muscular VSDs ('Swiss cheese') → surgical repair; device closure challenging",
        ],
        tips: [
          "The PSAX view is the best single view for VSD location — use the clock-face analogy: perimembranous at 9–11 o'clock, outlet at 12 o'clock, inlet at 5–7 o'clock, muscular in the trabecular septum.",
          "A high CW gradient across the VSD (>64 mmHg) means the RV pressure is low and the VSD is restrictive — this is reassuring. A low gradient means either the VSD is large (non-restrictive) or the PA pressure is elevated.",
          "Always look for aortic valve prolapse in outlet VSDs — even mild AR is an indication for surgical repair because it will progress.",
          "Spontaneous closure is common in small perimembranous and muscular VSDs in the first 2 years of life — serial surveillance is appropriate for small restrictive VSDs without LV dilation.",
        ],
      },
      {
        id: "vsd-post-closure",
        label: "Post-Closure Surveillance",
        timing: "1 month, 6 months, 12 months, then annually",
        overview: "Confirm closure (surgical patch or device). Assess for residual VSD, LV remodeling, and late complications. Monitor for aortic regurgitation (outlet VSD), complete heart block (perimembranous surgical repair), and device-related complications.",
        keyViews: [
          "PLAX — residual VSD, aortic valve (AR)",
          "PSAX — residual VSD, pulmonary valve",
          "A4C — LV size regression, MV/TV function",
          "A5C — LVOT, aortic valve",
        ],
        keyMeasurements: [
          "LV end-diastolic dimension (serial — should regress after closure)",
          "LVEF (serial)",
          "Residual VSD gradient (CW)",
          "AR severity (serial — especially outlet VSD)",
          "RVSP from TR CW (serial)",
        ],
        doppler: [
          "Color Doppler across patch/device — residual shunt",
          "CW residual VSD — gradient",
          "Color at aortic valve — AR (outlet VSD repair)",
          "TR CW — RVSP normalisation",
        ],
        normalCriteria: [
          "No residual VSD (or trivial with gradient >25 mmHg)",
          "LV size regression toward normal within 6–12 months",
          "RVSP normalisation",
          "No new AR",
        ],
        redFlags: [
          "Residual VSD with Qp:Qs >1.5 → reintervention",
          "Progressive AR → aortic valve repair or replacement",
          "Persistent LV dilation at 12 months → residual shunt or other cause",
          "New complete heart block (perimembranous repair) → pacemaker",
        ],
        tips: [
          "LV remodeling after VSD closure takes 6–12 months — serial measurements are more informative than a single post-operative study.",
          "Outlet VSD repair: always follow the aortic valve long-term — AR can develop or progress years after repair due to cusp deformity from the original prolapse.",
          "Trivial residual shunts through the patch are common and usually close spontaneously — a gradient >25 mmHg confirms the RV pressure is not elevated.",
        ],
      },
    ],
  },
  {
    id: "tof",
    name: "Tetralogy of Fallot",
    abbr: "TOF",
    category: "Conotruncal",
    color: "#189aa1",
    anatomy: "Four components unified by anterior malalignment of the outlet septum: perimembranous or subarterial VSD, right ventricular outflow tract obstruction (subvalvar, valvar, or supravalvar), overriding aorta, and right ventricular hypertrophy. Pulmonary annulus Z-score is the central determinant of surgical strategy.",
    stages: [
      {
        id: "tof-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal / Infant",
        overview: "Establish anatomy, quantify RVOTO severity, assess pulmonary annulus and branch PA sizes, identify coronary anomalies, and determine arch sidedness before surgical planning.",
        keyViews: ["PLAX — VSD, aortic override, RVOTO", "PSAX — pulmonary valve, MPA, RPA/LPA", "A4C/A5C — VSD size, RV function", "SSN — aortic arch sidedness, branch PA sizes", "PSAX high — coronary artery anatomy"],
        keyMeasurements: ["Pulmonary annulus Z-score (critical for transannular patch decision)", "MPA, RPA, LPA diameters (Z-scores)", "VSD size and location", "Aortic override % (>50% = DORV territory)", "McGoon ratio (RPA + LPA / descending Ao)", "Nakata index (RPA + LPA cross-sectional area / BSA — normal >330 mm²/m²)"],
        doppler: ["CW through RVOT — peak gradient (severe if >60 mmHg)", "Color Doppler across VSD — direction of shunt (R→L = cyanosis)", "PW in branch PAs — assess for stenosis", "Color at coronary origins — LAD from RCA crossing RVOT = contraindication to transannular patch"],
        normalCriteria: ["PA annulus Z-score > -2 (favors transannular patch avoidance)", "McGoon ratio > 1.5", "Nakata index > 250 mm²/m²", "No coronary anomaly crossing RVOT"],
        redFlags: ["PA annulus Z-score < -3 (severe hypoplasia — may need staged repair or conduit)", "LAD from RCA crossing RVOT (contraindication to transannular patch)", "Right aortic arch (25% — note for surgical planning)", "Absent left PA (unifocal pulmonary blood supply)"],
        tips: ["Use PSAX high to trace coronary origins before every TOF repair — the LAD-from-RCA anomaly is present in ~5% and is a surgical game-changer.", "McGoon ratio and Nakata index predict suitability for complete repair; values below threshold may require staged palliation (BT shunt first).", "Measure branch PAs at the hilum, not at the origin, for the most reproducible Z-scores."]
      },
      {
        id: "tof-postop",
        label: "Post-Op: Complete Repair",
        timing: "3–6 months (primary); older if staged",
        overview: "VSD closure + RVOT reconstruction (transannular patch, conduit, or valve-sparing). Key post-op questions: residual VSD, pulmonary regurgitation severity, RV dilation, RVOT/PA gradient, and branch PA stenosis.",
        keyViews: ["PLAX — residual VSD, RVOT", "PSAX — pulmonary valve, MPA, branch PAs", "A4C — RV size and function, TR", "A2C — LV function", "SSN — branch PA velocities"],
        keyMeasurements: ["RV end-diastolic area (RV/LV ratio — normal <0.6)", "TAPSE (normal >14mm)", "RV FAC (normal >35%)", "RVOT gradient (CW — >40 mmHg warrants reintervention)", "PR pressure half-time (PHT <100ms = severe PR)", "RPA/LPA Z-scores", "Residual VSD size and CW gradient"],
        doppler: ["CW through RVOT/MPA — peak gradient", "Color + CW at pulmonary valve — PR severity (PHT, diastolic flow reversal in MPA)", "Color across VSD patch — residual shunt", "CW at RPA/LPA origins — branch PA stenosis (>2 m/s suspicious)", "TDI at RV free wall — RV myocardial performance"],
        normalCriteria: ["No residual VSD (or trivial with gradient >25 mmHg)", "PR mild or less", "RVOT gradient <25 mmHg", "RV/LV ratio <0.6", "TAPSE >14mm, FAC >35%"],
        redFlags: ["Severe PR with RV dilation (RVEDVI >160 mL/m² on MRI) → pulmonary valve replacement", "RVOT/PA gradient >40–50 mmHg → catheter or surgical reintervention", "Residual VSD with Qp:Qs >1.5", "Progressive RV dysfunction (TAPSE <14mm, FAC <35%)", "Sustained VT on Holter (scar-related re-entry)"],
        tips: ["Severe PR is the leading cause of late morbidity after TOF repair — track RV size serially and refer for PVR before irreversible RV dysfunction.", "PHT <100ms is a reliable echo marker of severe PR when formal MRI is not available.", "Branch PA stenosis at the RPA origin is common after LeCompte maneuver (in TGA-type repairs) and after TOF repair — always interrogate with CW."]
      },
      {
        id: "tof-surveillance",
        label: "Long-Term Surveillance",
        timing: "Annual (or more frequent if PR severe / RV dilated)",
        overview: "Track RV remodeling, PR progression, and RVOT gradient over time. Identify the optimal window for pulmonary valve replacement before irreversible RV dysfunction.",
        keyViews: ["A4C — RV size, TR, LV function", "PSAX — PR, RVOT gradient", "SSN — branch PA velocities"],
        keyMeasurements: ["RV/LV ratio (serial)", "TAPSE, FAC (serial)", "PR PHT (serial)", "RVOT gradient (serial)", "LV EF (GLS if available)", "TR severity"],
        doppler: ["CW RVOT — gradient trend", "PR PHT trend", "TR Vmax (PA pressure estimate)", "LV GLS (early LV dysfunction common in severe PR)"],
        normalCriteria: ["Stable RV size (no progressive dilation)", "PR mild–moderate", "RVOT gradient <25 mmHg", "LV EF >55%"],
        redFlags: ["RV/LV ratio >1.0 (progressive dilation)", "PR PHT <100ms (severe)", "New LV dysfunction (GLS worse than -18%)", "Increasing TR (annular dilation from RV dilation)", "Syncope or sustained arrhythmia"],
        tips: ["Refer for cardiac MRI when RV dilation is suspected — echo underestimates RV volumes. MRI RVEDVI >160 mL/m² is the standard PVR threshold.", "LV dysfunction in TOF is underappreciated — GLS detects subclinical LV disease before EF drops.", "Tricuspid annular dilation secondary to RV dilation causes progressive TR — this is a marker of advanced RV disease, not a primary TV problem."]
      }
    ]
  },
  {
    id: "hlhs",
    name: "Hypoplastic Left Heart Syndrome",
    abbr: "HLHS",
    category: "Single Ventricle",
    color: "#1ba8b0",
    anatomy: "Spectrum of left-sided hypoplasia: aortic atresia or critical stenosis, mitral atresia or stenosis, hypoplastic LV, and hypoplastic ascending aorta. The RV supports both systemic and pulmonary circulations via the PDA. Coronary perfusion is retrograde via the diminutive ascending aorta. Survival depends on unrestricted atrial communication and a widely patent PDA.",
    stages: [
      {
        id: "hlhs-prenatal-neonatal",
        label: "Pre-Op: Neonatal",
        timing: "Birth to Norwood (days 3–7 of life)",
        overview: "Establish anatomy, assess atrial communication (restrictive IAS = emergency), evaluate RV function and TR severity, confirm PDA patency, and identify coronary sinusoids in aortic atresia.",
        keyViews: ["A4C — RV function, TR, ASD/PFO", "Subcostal — IAS (most important view for restriction)", "SSN — aortic arch, PDA size and direction", "PSAX — PA, PDA", "PLAX — ascending Ao size, aortic valve"],
        keyMeasurements: ["ASD/PFO size and mean gradient (>5 mmHg = restrictive — emergency)", "PDA size and direction of flow (L→R = unrestricted; R→L = restricted)", "RV FAC (normal >35%)", "TAPSE", "TR severity (vena contracta, PISA)", "Ascending aorta diameter (Z-score)", "Aortic annulus diameter"],
        doppler: ["Color + CW across ASD/PFO — gradient and direction", "Color + CW across PDA — direction and velocity", "TR CW — severity and RV pressure", "Coronary fistula CW — if aortic atresia, assess for RVDCC"],
        normalCriteria: ["ASD/PFO gradient <5 mmHg (unrestricted)", "PDA widely patent with bidirectional or L→R flow", "RV FAC >35%, TAPSE >10mm", "TR mild or less"],
        redFlags: ["Restrictive/intact IAS (ASD gradient >5 mmHg) — requires urgent balloon atrial septostomy", "Severe TR (vena contracta >7mm) — major risk factor for Norwood mortality", "RV dysfunction (FAC <30%) — poor Norwood candidate", "Coronary sinusoids with RVDCC — affects surgical strategy"],
        tips: ["The atrial septum is the single most important structure to assess in HLHS — a restrictive IAS causes pulmonary venous hypertension and is a neonatal emergency.", "Severe TR before Norwood is the strongest predictor of early mortality — assess with multiple methods (vena contracta, PISA, hepatic vein flow reversal).", "In aortic atresia, look carefully for coronary-cameral fistulae in PSAX — RVDCC means the coronary circulation depends on high RV pressure, and decompression of the RV may cause coronary steal."]
      },
      {
        id: "hlhs-post-norwood",
        label: "Post-Op: Norwood Stage 1",
        timing: "Post-Norwood (days to weeks)",
        overview: "Neo-aorta (MPA + homograft + native Ao), atrial septectomy, and systemic-to-PA shunt (modified BT shunt or Sano RV-PA conduit). Key questions: shunt patency, neo-aortic function, RV function, TR, and arch obstruction.",
        keyViews: ["A4C — RV function, TR, ASD (must be unrestrictive)", "SSN — neo-aortic arch, shunt origin, branch PAs", "PSAX — shunt (BT or Sano), PA confluence", "Subcostal — IVC, hepatic veins, ASD"],
        keyMeasurements: ["Shunt velocity (BT shunt: >3 m/s = stenosis; Sano: gradient across conduit)", "Neo-aortic arch gradient (CW — >20 mmHg = obstruction)", "RV FAC, TAPSE", "TR severity", "ASD gradient (must be <2 mmHg)", "RPA/LPA Z-scores"],
        doppler: ["CW across BT shunt or Sano conduit — peak velocity and gradient", "Color + CW at neo-aortic arch — obstruction", "TR CW — severity", "PW in branch PAs — forward diastolic flow = adequate shunt", "Color across ASD — must be unobstructed"],
        normalCriteria: ["BT shunt velocity <3 m/s (no stenosis)", "Sano conduit gradient <20 mmHg", "Neo-arch gradient <20 mmHg", "ASD gradient <2 mmHg", "RV FAC >35%", "TR mild or less"],
        redFlags: ["Shunt stenosis (BT >3 m/s or Sano >20 mmHg gradient) — urgent catheterization", "Neo-arch obstruction (gradient >20 mmHg) — reintervention", "Severe TR — major risk factor for interstage mortality", "RV dysfunction (FAC <30%)", "Absent diastolic PA flow (shunt thrombosis — emergency)"],
        tips: ["In BT shunt patients, loss of the continuous shunt murmur or sudden desaturation = shunt thrombosis until proven otherwise — echo immediately.", "Neo-aortic arch obstruction is common at the anastomosis site — always interrogate with CW from SSN view and look for diastolic runoff pattern in descending Ao.", "Sano conduits are prone to stenosis at the RV insertion — use PSAX and A4C to interrogate both ends."]
      },
      {
        id: "hlhs-interstage",
        label: "Inter-Stage: Norwood → Glenn",
        timing: "Monthly surveillance, 3–6 months",
        overview: "The highest-risk period in HLHS management. Monthly echo surveillance is standard of care. Key concerns: shunt stenosis/thrombosis, RV dysfunction, TR progression, neo-arch obstruction, and PA growth.",
        keyViews: ["A4C — RV function, TR", "SSN — arch gradient, shunt, branch PAs", "PSAX — shunt velocity, PA confluence"],
        keyMeasurements: ["Shunt velocity (trend — rising velocity = stenosis)", "Neo-arch gradient (trend)", "RV FAC, TAPSE (serial)", "TR severity (serial)", "RPA/LPA diameters (Z-scores — must grow for Glenn eligibility)", "Oxygen saturation correlation"],
        doppler: ["CW shunt — velocity trend", "CW neo-arch — gradient trend", "TR CW — severity trend", "PW branch PAs — forward flow in diastole"],
        normalCriteria: ["Stable or improving shunt velocity", "Stable arch gradient", "Stable or improving RV function", "TR stable or improving", "Branch PA growth (Z-scores improving toward 0)"],
        redFlags: ["Rising shunt velocity (>3 m/s BT) — urgent catheterization", "Worsening RV function (FAC <30%) — reassess surgical strategy", "Progressive TR — consider early Glenn or TV repair", "Branch PA hypoplasia (Z-score < -2) — may need PA augmentation at Glenn", "Sudden desaturation — shunt thrombosis emergency"],
        tips: ["Monthly echo is the standard of care during interstage — do not extend intervals without clinical justification.", "Correlate echo findings with oxygen saturations (goal 75–85%) and weight gain — failure to thrive + low sats = shunt problem until proven otherwise.", "Branch PA growth is a prerequisite for Glenn — if PAs are not growing, consider earlier palliation or catheter intervention."]
      },
      {
        id: "hlhs-post-glenn",
        label: "Post-Op: Bidirectional Glenn (Stage 2)",
        timing: "3–6 months of age",
        overview: "SVC anastomosed to RPA. Shunt taken down. Pulmonary blood flow is passive (superior vena cava pressure drives PA flow). Key questions: Glenn anastomosis patency, PA pressures, RV function, TR, and neo-aortic valve.",
        keyViews: ["SSN — SVC-RPA anastomosis, branch PAs", "A4C — RV function, TR, ASD", "PSAX — PA confluence", "Subcostal — IVC, hepatic veins (hepatic veins excluded from pulmonary circulation)"],
        keyMeasurements: ["SVC-RPA anastomosis velocity (CW — should be <1.5 m/s)", "Estimated Glenn pressure (TR Vmax + RAP — goal <15 mmHg)", "RV FAC, TAPSE", "TR severity", "Neo-aortic regurgitation severity", "RPA/LPA Z-scores"],
        doppler: ["CW at SVC-RPA anastomosis — obstruction", "TR CW — PA pressure estimate", "Neo-aortic valve Color + CW — AR severity", "PW hepatic veins — pulsatility (elevated = high Glenn pressure)", "Color across ASD — direction and gradient"],
        normalCriteria: ["SVC-RPA velocity <1.5 m/s (no obstruction)", "Estimated Glenn pressure <15 mmHg", "RV FAC >35%", "TR mild or less", "Neo-AR mild or less"],
        redFlags: ["Glenn obstruction (velocity >2 m/s) — catheter dilation", "High Glenn pressures (>15 mmHg) — may develop pulmonary AV malformations over time", "Progressive TR ≥ moderate — poor Fontan candidate", "RV dysfunction (FAC <30%) — reassess Fontan candidacy", "Hepatic vein pulsatility (elevated Glenn pressure)"],
        tips: ["Pulmonary AV malformations develop when hepatic venous blood is excluded from the pulmonary circulation (as in Glenn) — this is why Fontan completion is necessary.", "Elevated Glenn pressures (>15 mmHg) predict Fontan failure — identify and treat causes (PA stenosis, AV valve regurgitation, RV dysfunction) before Fontan.", "Azygos vein decompression can reduce Glenn flow — if present, look for it in SSN view and correlate with oxygen saturations."]
      },
      {
        id: "hlhs-post-fontan",
        label: "Post-Op: Fontan Completion (Stage 3)",
        timing: "18 months – 4 years",
        overview: "IVC flow directed to PAs via extracardiac conduit (most common) or lateral tunnel. Complete separation of systemic and pulmonary circulations. Key questions: Fontan conduit patency, fenestration, RV function, AV valve regurgitation, and PA pressures.",
        keyViews: ["Subcostal — Fontan conduit, IVC, hepatic veins", "A4C — RV function, TR, ASD/fenestration", "SSN — PA confluence, conduit-PA anastomosis", "PSAX — conduit, PA"],
        keyMeasurements: ["Fontan conduit velocity (CW — obstruction if >1.5 m/s)", "Fenestration size and gradient (R→L shunt = patent fenestration)", "RV FAC, TAPSE", "TR severity (vena contracta)", "Neo-AR severity", "Hepatic vein pulsatility index", "IVC diameter and collapsibility"],
        doppler: ["CW across Fontan conduit — peak velocity (obstruction)", "Color + CW at fenestration — R→L shunt (patent)", "TR CW — RV pressure estimate", "PW hepatic veins — pulsatility (elevated = Fontan obstruction or elevated PA pressures)", "Neo-AV Color + CW — AR severity"],
        normalCriteria: ["Fontan conduit velocity <1.5 m/s (no obstruction)", "Fenestration patent with R→L shunt (if present)", "RV FAC >35%", "TR mild or less", "Hepatic veins non-pulsatile"],
        redFlags: ["Fontan conduit obstruction (velocity >1.5–2 m/s) — catheter or surgical reintervention", "Thrombus in Fontan pathway — anticoagulation ± catheter intervention", "TR ≥ moderate — major risk factor for Fontan failure", "Progressive RV dysfunction (FAC <30%, TAPSE <14mm)", "Hepatic vein pulsatility (elevated Fontan pressures → protein-losing enteropathy risk)", "Pleural effusions (indirect — assess IVC/hepatic vein dilation)"],
        tips: ["The Fontan conduit is best seen from subcostal views — sweep from IVC to PA confluence to identify the full conduit course.", "Hepatic vein pulsatility is a sensitive marker of elevated Fontan pressures — normal Fontan veins are non-pulsatile.", "Protein-losing enteropathy (PLE) is a serious Fontan complication — echo shows dilated, pulsatile hepatic veins and IVC. Correlate with albumin levels.", "Fenestration closure (catheter) is considered when R→L shunt causes significant desaturation without hemodynamic benefit."]
      }
    ]
  },
  {
    id: "dtga",
    name: "d-Transposition of the Great Arteries",
    abbr: "d-TGA",
    category: "Conotruncal",
    color: "#1db6bf",
    anatomy: "The aorta arises from the morphologic RV (anterior, rightward) and the pulmonary artery from the morphologic LV (posterior, leftward). Parallel circulations — systemic venous blood recirculates to the body and pulmonary venous blood recirculates to the lungs. Survival depends on mixing via ASD, VSD, or PDA. Most common: simple TGA with intact ventricular septum (IVS). VSD present in 30–40%.",
    stages: [
      {
        id: "dtga-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal (first days of life)",
        overview: "Establish great artery relationship, assess mixing adequacy (ASD/PFO), identify VSD, define coronary anatomy (critical for arterial switch), and evaluate LV mass and function.",
        keyViews: ["PSAX — great artery relationship (parallel; Ao anterior/rightward; PA posterior/leftward), coronary origins", "A4C — ASD/PFO, VSD, LV function", "PLAX — great artery relationship, VSD", "SSN — arch, PDA", "PSAX high — coronary origins (most critical view)"],
        keyMeasurements: ["ASD/PFO size and gradient (<5 mmHg = adequate mixing)", "VSD size and location", "LV posterior wall thickness (LV mass — must be adequate to support systemic circulation after ASO)", "LV/RV pressure ratio (LV must be ≥2/3 systemic pressure for ASO)", "Coronary pattern documentation (1L2R = most common; 2R = high-risk)"],
        doppler: ["Color + CW across ASD/PFO — gradient and direction", "Color across VSD — direction and size", "PW in PDA — direction and size", "Color at coronary origins — trace LAD and RCA from PSAX"],
        normalCriteria: ["ASD/PFO gradient <5 mmHg (adequate mixing)", "LV/RV pressure ratio ≥0.67 (LV prepared for systemic work)", "Standard coronary pattern (1L2R)"],
        redFlags: ["Restrictive PFO/ASD (gradient >5 mmHg) — urgent balloon atrial septostomy (Rashkind)", "Unusual coronary pattern (intramural, single coronary, 2R) — increases ASO risk", "LV hypoplasia or low LV/RV pressure ratio — may need LV retraining before ASO", "Associated LVOTO (subaortic obstruction) — affects surgical approach"],
        tips: ["Coronary anatomy is the most critical pre-op assessment for TGA — spend extra time in PSAX high view tracing both coronaries. Document the pattern using the Leiden convention.", "Balloon atrial septostomy is indicated if ASD gradient >5 mmHg — this can be done at the bedside under echo guidance.", "In TGA with IVS, the LV rapidly loses mass after birth (it pumps to the low-resistance pulmonary circuit) — ASO should be performed within the first 2 weeks of life."]
      },
      {
        id: "dtga-post-aso",
        label: "Post-Op: Arterial Switch Operation (ASO)",
        timing: "Neonatal (within 2 weeks of life)",
        overview: "Great arteries transected and switched. Coronary arteries reimplanted into neo-aortic root. LeCompte maneuver brings PA anterior to aorta. Key post-op questions: coronary patency (wall motion), neo-aortic root dilation, neo-pulmonary stenosis, and branch PA stenosis.",
        keyViews: ["PSAX — neo-pulmonary valve, MPA, branch PAs (RPA often stenosed at LeCompte site)", "A4C — LV function, regional wall motion, LV/RV size", "PLAX — neo-aortic root size, neo-AR", "SSN — branch PA velocities", "A2C/A3C — inferior and lateral wall motion (LAD territory)"],
        keyMeasurements: ["Neo-aortic root diameter (annulus, sinuses, STJ, ascending — serial)", "Neo-aortic regurgitation severity (PHT, vena contracta)", "RVOTO/neo-pulmonary gradient (CW — most common late complication)", "LV EF (biplane Simpson's)", "LV GLS (regional WMA detection)", "RPA/LPA Z-scores"],
        doppler: ["CW at neo-pulmonary valve/RVOT — gradient (>40 mmHg = significant)", "Color + CW neo-aortic valve — AR severity", "LV regional wall motion assessment (all 17 segments)", "CW at RPA/LPA — branch PA stenosis (>2 m/s suspicious)", "TDI at LV lateral wall — myocardial velocity"],
        normalCriteria: ["No regional wall motion abnormality (coronaries patent)", "Neo-aortic root stable (no rapid dilation)", "Neo-AR mild or less", "RVOTO gradient <25 mmHg", "LV EF >55%"],
        redFlags: ["Regional wall motion abnormality — coronary stenosis/occlusion (urgent catheterization)", "Neo-aortic root dilation (>4 cm or rapid progression) — surgical referral", "RVOTO gradient >40–50 mmHg — catheter or surgical reintervention", "LV dysfunction (EF <55%) — coronary problem until proven otherwise", "Branch PA stenosis (RPA velocity >2 m/s) — catheter dilation/stenting"],
        tips: ["Any new regional wall motion abnormality after ASO is a coronary event until proven otherwise — urgent catheterization is indicated.", "Neo-aortic root dilation is a progressive late complication affecting up to 20% of ASO patients — measure at all four levels (annulus, sinuses, STJ, ascending) at every visit.", "RPA stenosis at the LeCompte maneuver site is the most common indication for catheter reintervention after ASO — always interrogate with CW from SSN view.", "LV GLS is more sensitive than EF for detecting early coronary dysfunction — use it routinely in ASO follow-up."]
      }
    ]
  },
  {
    id: "cavsd",
    name: "AV Septal Defect",
    abbr: "AVSD",
    category: "Septal Defects",
    color: "#20c4ce",
    anatomy: "Common AV valve (5 leaflets: superior bridging, inferior bridging, left lateral, right anterosuperior, right inferior), primum ASD, and inlet VSD. Associated with Down syndrome in >50% of cases. The left AV valve (LAVV) has a cleft between the superior and inferior bridging leaflets — the primary source of regurgitation. Rastelli classification (A, B, C) based on superior bridging leaflet chordal attachment to the ventricular septum.",
    stages: [
      {
        id: "cavsd-preop",
        label: "Pre-Op Assessment",
        timing: "Infant (repair typically 3–6 months)",
        overview: "Assess ventricular balance (balanced vs unbalanced), LAVV regurgitation severity and mechanism, VSD and ASD sizes, and identify subaortic anatomy. Unbalanced AVSD (dominant RV or LV) may require single ventricle palliation.",
        keyViews: ["A4C — common AV valve, VSD, ASD, ventricular balance", "PSAX — AV valve anatomy, cleft identification", "A2C/A3C — LAVV regurgitation jet direction and mechanism", "PLAX — subaortic anatomy, LVOTO", "Subcostal — ASD, IAS"],
        keyMeasurements: ["RV/LV dominance ratio (balanced: RV/LV = 1.0; unbalanced if ratio >1.5 or <0.7)", "LAVV annulus Z-score", "LAVV regurgitation severity (vena contracta, PISA, pulmonary vein flow)", "VSD size and location", "ASD size and gradient", "Subaortic distance (LVOT width — narrow = LVOTO risk)"],
        doppler: ["Color across LAVV — regurgitation jet origin (cleft vs annular vs leaflet)", "PISA for LAVV regurgitation quantification", "CW across LVOT — subaortic gradient", "Color across VSD — direction and size", "Pulmonary vein PW — systolic blunting or reversal (severe MR)"],
        normalCriteria: ["Balanced ventricles (RV/LV ratio 0.7–1.3)", "LAVV regurgitation mild or less", "No subaortic obstruction (LVOT gradient <10 mmHg)", "Adequate ASD and VSD for mixing"],
        redFlags: ["Unbalanced AVSD (RV or LV dominant) — single ventricle pathway", "Severe LAVV regurgitation — may need TV repair at time of complete repair", "Subaortic stenosis (LVOT gradient >20 mmHg) — may need subaortic resection", "Hypoplastic left heart component — assess for LVOTO carefully"],
        tips: ["The cleft in the LAVV is best seen in PSAX — it opens toward the ventricular septum (unlike a true mitral cleft which opens toward the LVFW). Color Doppler through the cleft confirms regurgitation origin.", "Ventricular balance is the most important determinant of surgical strategy — use multiple views and measure both ventricular volumes.", "Down syndrome patients tolerate LAVV regurgitation less well — repair the cleft at the time of complete repair even if regurgitation appears mild."]
      },
      {
        id: "cavsd-postop",
        label: "Post-Op: Complete Repair",
        timing: "3–6 months of age",
        overview: "VSD and ASD closed with two-patch or single-patch technique. LAVV cleft repaired. Key post-op questions: residual VSD, LAVV regurgitation (severity and mechanism), LAVV stenosis, LVOTO, and LV function.",
        keyViews: ["A4C — residual VSD, LAVV function, LV function", "PSAX — LAVV anatomy, residual cleft", "PLAX — LVOTO, subaortic membrane", "A2C/A3C — LAVV regurgitation jet"],
        keyMeasurements: ["Residual VSD size and CW gradient", "LAVV mean gradient (stenosis if >5 mmHg)", "LAVV regurgitation severity (vena contracta, PISA)", "LVOTO gradient (CW — subaortic membrane develops in 5–10% late)", "LV EF"],
        doppler: ["Color across VSD patch — residual shunt", "Color + CW across LAVV — regurgitation and stenosis", "CW across LVOT — subaortic gradient (serial — late complication)", "Pulmonary vein PW — systolic blunting (severe MR)"],
        normalCriteria: ["No residual VSD (or trivial with gradient >25 mmHg)", "LAVV mean gradient <5 mmHg", "LAVV regurgitation mild or less", "LVOTO gradient <20 mmHg"],
        redFlags: ["LAVV regurgitation ≥ moderate — reoperation for cleft re-repair or valve replacement", "LAVV stenosis (mean gradient >5 mmHg) — reoperation", "LVOTO gradient >30 mmHg — subaortic resection", "Residual VSD with Qp:Qs >1.5"],
        tips: ["Subaortic stenosis is a late complication in 5–10% of AVSD repairs — always measure LVOTO gradient at every follow-up visit.", "LAVV stenosis after repair is often caused by over-aggressive cleft closure — mean gradient >5 mmHg warrants reoperation.", "LAVV regurgitation after repair is the most common indication for reoperation — identify the mechanism (residual cleft, annular dilation, leaflet prolapse) to guide surgical planning."]
      }
    ]
  },
  {
    id: "coa",
    name: "Coarctation of the Aorta",
    abbr: "CoA",
    category: "Left Heart Obstruction",
    color: "#24d2d8",
    anatomy: "Discrete or long-segment narrowing at the aortic isthmus (juxtaductal), typically just distal to the left subclavian artery. Associated with bicuspid aortic valve (50–80%), aortic stenosis, VSD, and Turner syndrome. Collateral vessels (intercostal, internal mammary) develop over time in older patients, masking the true gradient.",
    stages: [
      {
        id: "coa-diagnosis",
        label: "Diagnosis / Pre-Intervention",
        timing: "Neonatal or any age",
        overview: "Quantify obstruction severity, assess LV function, identify associated lesions (bicuspid AV, VSD, aortic stenosis), and measure arch dimensions for surgical or catheter planning.",
        keyViews: ["SSN — aortic arch, isthmus (primary view)", "PSAX — ductal arch (neonatal)", "A4C — LV function, MR (pressure overload)", "PLAX — aortic valve (bicuspid), ascending Ao", "Subcostal — abdominal Ao pulsatility"],
        keyMeasurements: ["Isthmus diameter (Z-score — <-2 = significant)", "Transverse arch diameter (Z-score)", "Ascending Ao diameter", "CW peak and mean gradient at isthmus", "Abdominal Ao pulsatility (diastolic runoff pattern = significant CoA)", "LV mass index (hypertrophy)", "LV EF"],
        doppler: ["CW at isthmus — peak gradient (>20 mmHg at rest = significant)", "Diastolic tail on CW (continuous antegrade diastolic flow = significant obstruction)", "Abdominal Ao PW — pulsatility index (blunted upstroke + diastolic runoff = significant CoA)", "Color across AV — bicuspid morphology, AS/AR", "CW across AV — gradient"],
        normalCriteria: ["Isthmus Z-score > -2", "CW peak gradient <20 mmHg", "No diastolic tail on CW Doppler", "Normal abdominal Ao pulsatility"],
        redFlags: ["CW peak gradient >20 mmHg at rest — intervention indicated", "Diastolic tail on CW (significant obstruction even if gradient appears low due to collaterals)", "Neonatal CoA with LV dysfunction — emergency intervention", "Abdominal Ao blunted pulsatility (severe CoA with collaterals — gradient may be underestimated by echo)"],
        tips: ["The 'diastolic tail' (continuous antegrade diastolic flow on CW at the isthmus) is the most reliable echo marker of hemodynamically significant CoA — look for it even when the peak gradient appears low.", "In older patients with established collaterals, the CW gradient underestimates true obstruction — correlate with blood pressure differential (arm-leg gradient >20 mmHg) and refer for MRI/catheterization.", "Always assess the abdominal aorta from subcostal view — blunted upstroke and diastolic runoff pattern confirms significant proximal obstruction."]
      },
      {
        id: "coa-postop",
        label: "Post-Op / Post-Intervention",
        timing: "Lifelong surveillance",
        overview: "Monitor for re-coarctation (most common late complication), aneurysm formation, bicuspid AV progression, and LV hypertrophy regression.",
        keyViews: ["SSN — repair site, arch", "PLAX — aortic valve, ascending Ao", "A4C — LV function, LV mass"],
        keyMeasurements: ["CW gradient at repair site (>20 mmHg = re-coarctation)", "Arch diameter at repair site (aneurysm)", "Bicuspid AV gradient and AR severity", "LV mass index (regression)", "LV EF"],
        doppler: ["CW at repair site — peak gradient (diastolic tail = re-coarctation)", "Color + CW bicuspid AV — AS and AR progression", "Abdominal Ao PW — pulsatility (should normalize after repair)"],
        normalCriteria: ["CW gradient at repair site <20 mmHg", "No diastolic tail", "Normal abdominal Ao pulsatility", "LV mass regression over time"],
        redFlags: ["Re-coarctation (peak gradient >20 mmHg) — catheter balloon/stent or reoperation", "Aneurysm at repair site (echo limited — CT/MRI preferred)", "Progressive bicuspid AV stenosis or regurgitation", "Persistent LV hypertrophy despite repair (residual hypertension)"],
        tips: ["Re-coarctation is the most common late complication — occurs in up to 10% of surgical repairs and 20% of balloon dilations in neonates.", "Bicuspid AV requires lifelong surveillance regardless of CoA repair — AS and AR both progress over decades.", "Aortic aneurysm at the repair site is a known complication of patch aortoplasty (Dacron patch) — echo is limited for this; refer for CT/MRI every 5 years."]
      }
    ]
  },
  {
    id: "tapvr",
    name: "Total Anomalous Pulmonary Venous Return",
    abbr: "TAPVR",
    category: "Venous Anomalies",
    color: "#28dce0",
    anatomy: "All four pulmonary veins drain to the systemic venous system rather than the left atrium. Types: Supracardiac (vertical vein to SVC/innominate — 45%), Cardiac (coronary sinus or RA — 25%), Infracardiac (portal/hepatic veins — 25%), Mixed (5%). Obstruction is most common with infracardiac type and constitutes a surgical emergency. The LA is small; survival depends on an adequate ASD/PFO.",
    stages: [
      {
        id: "tapvr-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal (emergency if obstructed)",
        overview: "Identify TAPVR type, assess for obstruction (emergency if present), evaluate ASD/PFO adequacy, estimate PA pressures, and assess RV function.",
        keyViews: ["Subcostal — PV confluence behind LA (most important view)", "A4C — small LA, dilated RA/RV, ASD", "SSN — vertical vein (supracardiac type)", "PSAX — coronary sinus dilation (cardiac type)", "Subcostal sagittal — infracardiac vertical vein descending through diaphragm"],
        keyMeasurements: ["PV confluence size and velocity (obstruction if >1.5 m/s)", "Vertical vein velocity (obstruction if >1.5 m/s)", "ASD/PFO size and gradient (must be adequate for survival)", "TR Vmax (PA pressure estimate)", "RV FAC", "LA size (small = TAPVR)"],
        doppler: ["Color + CW at PV confluence — obstruction", "Color + CW at vertical vein — direction and velocity", "Color + CW at ASD — direction (R→L = survival shunt)", "TR CW — PA pressure estimate", "PW at individual PVs — pulsatility (obstructed = non-pulsatile, high velocity)"],
        normalCriteria: ["PV confluence velocity <1.5 m/s (no obstruction)", "ASD/PFO gradient <5 mmHg (adequate mixing)", "TR Vmax <3 m/s (PA pressure near systemic = obstructed TAPVR)"],
        redFlags: ["PV confluence or vertical vein velocity >1.5 m/s — obstructed TAPVR (surgical emergency)", "Intact or restrictive IAS (gradient >5 mmHg) — requires urgent balloon septostomy", "TR Vmax >3.5 m/s (near-systemic PA pressures) — obstructed TAPVR", "Absent pulsatility in PVs — obstruction"],
        tips: ["Obstructed TAPVR is a neonatal surgical emergency — these babies present with severe cyanosis and respiratory distress at birth. Do not delay surgery for further workup.", "The PV confluence is best seen from the subcostal sagittal view — sweep posterior to the LA to find the confluence. Color Doppler will show flow toward the vertical vein.", "In infracardiac TAPVR, the vertical vein descends through the diaphragm to the portal system — look for it from subcostal view sweeping inferiorly.", "Coronary sinus dilation in PSAX is a clue to cardiac-type TAPVR — the dilated CS drains all four PVs."]
      },
      {
        id: "tapvr-postop",
        label: "Post-Op: Surgical Repair",
        timing: "Neonatal (urgent/emergent)",
        overview: "PV confluence anastomosed to LA. Key post-op concern: pulmonary vein stenosis (PVS) — the most feared complication, can develop rapidly and is often progressive.",
        keyViews: ["Subcostal — PV anastomosis, individual PV ostia", "A4C — LA size (should grow), RV function", "PSAX — individual PV velocities"],
        keyMeasurements: ["Individual PV velocities (CW — >1.5 m/s = stenosis)", "LA size (should increase post-repair)", "TR Vmax (PA pressure — should normalize)", "RV FAC (should improve)", "PV pulsatility (normal = pulsatile; stenotic = non-pulsatile, high velocity)"],
        doppler: ["CW at each PV ostium — velocity (stenosis if >1.5 m/s)", "Color at PV-LA anastomosis — turbulence", "TR CW — PA pressure trend", "PW individual PVs — pulsatility"],
        normalCriteria: ["All PV velocities <1.5 m/s", "Pulsatile PV flow", "LA growth over time", "PA pressure normalization"],
        redFlags: ["Any PV velocity >1.5 m/s — PV stenosis (urgent evaluation)", "Progressive PV stenosis — poor prognosis; sutureless repair may be required", "Persistent pulmonary hypertension (TR Vmax >3 m/s) — PV stenosis or residual obstruction", "Non-pulsatile PV flow — stenosis"],
        tips: ["PV stenosis after TAPVR repair is the most feared complication and can develop within weeks of repair — surveillance every 3 months in the first year.", "PV stenosis is often progressive and bilateral — once started, it tends to worsen despite reintervention. Early referral to a high-volume center is critical.", "Sutureless repair (pericardial in-situ technique) is the preferred approach for post-repair PV stenosis — it avoids anastomotic tension.", "Correlate echo PV velocities with CT angiography for accurate stenosis assessment — echo may underestimate severity in tortuous veins."]
      }
    ]
  },
  {
    id: "truncus",
    name: "Truncus Arteriosus",
    abbr: "Truncus",
    category: "Conotruncal",
    color: "#30e0e4",
    anatomy: "A single arterial trunk arises from the heart, giving rise to the aorta, pulmonary arteries, and coronary arteries. The truncal valve has 3–6 leaflets and is often dysplastic. A VSD (outlet/conoventricular) is always present. Collett-Edwards classification: Type I (MPA from truncus then bifurcates — most common), Type II (RPA and LPA arise separately from posterior truncus), Type III (PAs arise laterally), Type IV (no true PAs — pulmonary blood flow from bronchial arteries = pulmonary atresia with MAPCAs, not true truncus).",
    stages: [
      {
        id: "truncus-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal",
        overview: "Identify PA origin type, assess truncal valve morphology and regurgitation, quantify VSD, identify coronary origins, and determine arch sidedness.",
        keyViews: ["PLAX — truncal valve, VSD, single trunk", "PSAX — PA origins from truncus, coronary origins", "A4C — VSD, biventricular function", "SSN — arch sidedness, PA origins"],
        keyMeasurements: ["Truncal valve annulus Z-score", "Truncal regurgitation severity (PHT, vena contracta)", "Truncal stenosis gradient (CW)", "VSD size", "PA diameters (Z-scores)", "Coronary origins"],
        doppler: ["Color + CW truncal valve — regurgitation and stenosis", "Color across VSD — direction and size", "CW at PA origins — stenosis", "Color at coronary origins — trace from PSAX"],
        normalCriteria: ["Truncal valve regurgitation mild or less", "No truncal stenosis", "Adequate PA sizes (Z-score > -2)"],
        redFlags: ["Truncal valve regurgitation ≥ moderate — may need valve repair/replacement at time of repair", "Truncal stenosis — rare but increases surgical complexity", "PA hypoplasia (Z-score < -2) — may need PA augmentation", "Interrupted aortic arch (10% of truncus) — requires arch reconstruction"],
        tips: ["Type I truncus is most amenable to repair — the MPA is detached from the truncus and used to reconstruct the RVOT with a conduit.", "Truncal valve regurgitation is the most important determinant of long-term outcome — moderate or greater regurgitation at diagnosis is a risk factor for poor outcome.", "Always look for interrupted aortic arch in truncus — it occurs in 10% and requires simultaneous arch reconstruction."]
      },
      {
        id: "truncus-postop",
        label: "Post-Op: Rastelli-Type Repair",
        timing: "Neonatal (within first weeks of life)",
        overview: "VSD closed directing LV to truncus (neo-aorta). RV-PA conduit placed. Key post-op questions: conduit function (stenosis and regurgitation), truncal (neo-aortic) valve regurgitation, residual VSD, and branch PA stenosis.",
        keyViews: ["PSAX — RV-PA conduit, branch PAs", "A4C — residual VSD, LV function", "PLAX — neo-aortic valve, ascending Ao", "SSN — branch PA velocities"],
        keyMeasurements: ["RV-PA conduit gradient (CW — >40 mmHg = significant stenosis)", "Conduit regurgitation severity (PHT)", "Neo-aortic (truncal) valve regurgitation severity", "Residual VSD size and gradient", "LV EF", "RPA/LPA Z-scores"],
        doppler: ["CW across RV-PA conduit — peak gradient", "Color + CW conduit valve — regurgitation (PHT)", "Color + CW neo-aortic valve — AR severity", "Color across VSD patch — residual shunt", "CW at branch PAs — stenosis"],
        normalCriteria: ["Conduit gradient <25 mmHg", "Conduit regurgitation mild or less", "Neo-AR mild or less", "No residual VSD"],
        redFlags: ["Conduit gradient >40 mmHg — reintervention (balloon/stent or conduit replacement)", "Conduit regurgitation severe (PHT <100ms) — conduit replacement", "Neo-AR ≥ moderate — truncal valve repair/replacement", "Residual VSD with Qp:Qs >1.5"],
        tips: ["Conduits require replacement every 5–10 years (sooner in infants due to somatic growth) — track conduit gradient and regurgitation serially.", "Transcatheter pulmonary valve replacement (Melody/Sapien) is now the preferred approach for conduit dysfunction in eligible patients — refer when gradient >40 mmHg.", "Neo-aortic root dilation is a late complication similar to ASO — measure at all four levels at every visit."]
      }
    ]
  },
  {
    id: "ebstein",
    name: "Ebstein's Anomaly",
    abbr: "Ebstein's",
    category: "Right Heart",
    color: "#38e4e8",
    anatomy: "Apical displacement of the septal and posterior tricuspid valve leaflets (>8 mm/m² below the AV junction). The anterior leaflet is large and sail-like. The 'atrialized' portion of the RV is incorporated into the right atrium. Spectrum from mild (minimal displacement, normal RV) to severe (massive atrialization, tiny functional RV). Associated with ASD/PFO (80%), WPW (25%), and RVOTO.",
    stages: [
      {
        id: "ebstein-assessment",
        label: "Initial Assessment",
        timing: "Any age (neonatal to adult)",
        overview: "Quantify TV displacement, assess TR severity and mechanism, evaluate functional RV size, assess LV function (compressed by dilated RV), identify ASD/PFO, and screen for RVOTO.",
        keyViews: ["A4C — TV displacement, TR, RV/LV ratio (key view)", "PSAX — TV anatomy, RVOTO, PA", "Subcostal — ASD, IVC", "A4C — functional RV assessment"],
        keyMeasurements: ["TV displacement index (distance from MV annulus to TV hinge point / BSA — normal <8 mm/m²; Ebstein's if >8 mm/m²)", "Great Ormond Street (GOS) ratio: (RA area + atrialized RV area) / (functional RV + LA + LV areas) — ratio >1.5 = severe", "TV annulus Z-score", "TR vena contracta (severe if >7mm)", "TAPSE (functional RV — often reduced)", "LV EF (LV compressed by dilated RV)", "ASD/PFO size and gradient"],
        doppler: ["Color + CW TR — severity, jet direction", "PISA for TR quantification", "Color across ASD — R→L shunt (cyanosis)", "CW across RVOT — obstruction", "PW hepatic veins — systolic reversal (severe TR)"],
        normalCriteria: ["TV displacement <8 mm/m²", "TR mild or less", "GOS ratio <1.0", "TAPSE >14mm", "LV EF >55%"],
        redFlags: ["GOS ratio >1.5 (severe Ebstein's) — surgical referral", "TR severe (vena contracta >7mm) — surgical referral", "Cyanosis from R→L ASD shunt — surgical referral", "TAPSE <10mm (functional RV failure)", "LV dysfunction (compressed by dilated RV)", "Hydrops fetalis (neonatal — very poor prognosis)"],
        tips: ["The GOS ratio is the best predictor of surgical outcome in Ebstein's — calculate it from the A4C view by tracing the four chambers.", "The 'sail-like' anterior leaflet is pathognomonic — it is large, redundant, and may prolapse into the RVOT causing functional obstruction.", "WPW is present in 25% of Ebstein's — correlate with ECG. Delta waves + cyanosis = Ebstein's until proven otherwise.", "In neonates with severe Ebstein's, the massively dilated RA/RV can compress the lungs causing pulmonary hypoplasia — the 'wall-to-wall heart' on CXR."]
      },
      {
        id: "ebstein-postop",
        label: "Post-Op: TV Repair (Cone Procedure)",
        timing: "Variable (elective in childhood/adulthood)",
        overview: "Cone procedure: anterior and posterior leaflets detached, rotated, and reattached to form a cone-shaped valve at the true AV annulus. Key post-op questions: TR severity, TV stenosis, RV function, and residual ASD.",
        keyViews: ["A4C — TV function, RV size, LV function", "PSAX — TV anatomy", "Subcostal — residual ASD"],
        keyMeasurements: ["TR severity (vena contracta, PISA)", "TV mean gradient (stenosis if >5 mmHg)", "TAPSE (RV function — often remains depressed post-repair)", "LV EF", "Residual ASD size and gradient"],
        doppler: ["Color + CW TV — TR severity and stenosis", "PISA for TR quantification", "Color across ASD — residual shunt", "PW hepatic veins — systolic reversal (severe TR)"],
        normalCriteria: ["TR mild or less", "TV mean gradient <5 mmHg", "TAPSE >10mm (may remain reduced)", "No significant residual ASD"],
        redFlags: ["TR ≥ moderate (residual or recurrent) — reoperation", "TV stenosis (mean gradient >5 mmHg) — reoperation", "Progressive RV failure (TAPSE <8mm)", "Paradoxical septal motion (RV pressure overload)"],
        tips: ["TAPSE often remains reduced after Cone repair due to chronic RV remodeling — do not use TAPSE alone to assess RV function. Use FAC and 3D RV volumes if available.", "TR recurrence after Cone repair occurs in 10–15% at 10 years — annual surveillance is essential.", "Residual ASD closure is often performed at the time of Cone repair — if left open as a 'pop-off,' it may cause persistent cyanosis."]
      }
    ]
  },
  {
    id: "paivs",
    name: "Pulmonary Atresia with Intact Ventricular Septum",
    abbr: "PA/IVS",
    category: "Right Heart",
    color: "#3de8e8",
    anatomy: "Atretic pulmonary valve with intact ventricular septum and variable RV hypoplasia. Tricuspid valve Z-score predicts RV adequacy for biventricular repair. Coronary sinusoids (RV-to-coronary fistulae) occur in 10–15% and may cause RV-dependent coronary circulation (RVDCC) — a critical finding that affects surgical strategy.",
    stages: [
      {
        id: "paivs-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal",
        overview: "Assess TV Z-score (determines repair strategy), RV morphology (tripartite vs bipartite vs unipartite), coronary sinusoids/fistulae, ASD/PFO adequacy, and PDA patency.",
        keyViews: ["PSAX — pulmonary valve (atretic — no forward flow), coronary fistulae", "A4C — TV size, RV size and morphology", "Subcostal — ASD/PFO", "SSN — PDA size"],
        keyMeasurements: ["TV annulus Z-score (critical: >-2 = biventricular candidate; -2 to -4 = 1.5 ventricle; <-4 = single ventricle pathway)", "RV length (Z-score)", "RV morphology (tripartite = inlet + trabecular + infundibulum; bipartite = no trabecular; unipartite = infundibulum only)", "PDA size", "ASD/PFO gradient"],
        doppler: ["Color at pulmonary valve — confirm atresia (no forward flow)", "Color at coronary fistulae — high-velocity flow from RV to coronaries (RVDCC)", "CW at coronary fistulae — velocity (high = high RV pressure)", "Color + CW at ASD — direction and gradient", "PW in PDA — direction and size"],
        normalCriteria: ["TV Z-score > -2 (adequate RV for biventricular repair)", "Tripartite RV morphology", "No coronary sinusoids/fistulae", "Adequate ASD/PFO"],
        redFlags: ["TV Z-score < -4 — single ventricle pathway (Norwood/Glenn/Fontan)", "RVDCC (coronary sinusoids with coronary stenosis) — decompression of RV may cause coronary steal and myocardial ischemia", "Unipartite RV — single ventricle pathway", "Restrictive ASD (gradient >5 mmHg) — urgent balloon septostomy"],
        tips: ["RVDCC is the most critical finding in PA/IVS — if present, decompression of the RV (RVOT reconstruction) may be contraindicated because the coronary circulation depends on high RV pressure.", "TV Z-score is the single most important measurement — use the Boston Children's Hospital nomogram and measure at the annular hinge points in A4C.", "Coronary sinusoids are best seen in PSAX with color Doppler — look for high-velocity jets from the RV cavity into the coronary arteries."]
      },
      {
        id: "paivs-postop",
        label: "Post-Op / Staged Management",
        timing: "Variable based on TV Z-score",
        overview: "Biventricular repair: RVOT reconstruction + TV repair. 1.5-ventricle: BDG + RVOT reconstruction. Single ventricle: Norwood/Glenn/Fontan pathway. Key questions: RV growth, RVOT gradient, TR severity, and coronary flow.",
        keyViews: ["PSAX — RVOT gradient, pulmonary valve", "A4C — TV, RV size, RV function", "SSN — branch PAs (if Glenn/Fontan)"],
        keyMeasurements: ["TV Z-score (serial — should improve with RV decompression)", "RVOT gradient (CW)", "TR severity", "RV FAC, TAPSE", "Coronary flow (if RVDCC — assess for ischemia)"],
        doppler: ["CW across RVOT — gradient", "Color + CW TV — TR severity", "Regional wall motion assessment (if RVDCC — ischemia)", "CW at coronary fistulae — velocity trend (should decrease as RV pressure normalizes)"],
        normalCriteria: ["TV Z-score improving toward 0 over time", "RVOT gradient <25 mmHg", "TR mild or less", "No regional wall motion abnormality"],
        redFlags: ["TV Z-score not improving — reassess surgical strategy", "RVOT gradient >40 mmHg — reintervention", "Regional wall motion abnormality (RVDCC with coronary ischemia)", "RV failure post-repair"],
        tips: ["Serial TV Z-score measurement is essential — RV growth after RVOT decompression determines whether biventricular repair is achievable.", "If RVDCC is present and RVOT decompression is performed, monitor for regional wall motion abnormalities indicating coronary ischemia.", "The 1.5-ventricle repair (BDG + RVOT reconstruction) is an excellent option for borderline RV — it offloads the RV while maintaining biventricular circulation."]
      }
    ]
  },
  {
    id: "dorv",
    name: "Double Outlet Right Ventricle",
    abbr: "DORV",
    category: "Conotruncal",
    color: "#42e8e4",
    anatomy: "Both great arteries arise predominantly from the morphologic RV (>50% of each great artery committed to the RV). VSD position determines physiology: subaortic VSD (TOF-like physiology), subpulmonary VSD (Taussig-Bing anomaly = TGA-like physiology), doubly committed VSD, or non-committed VSD. Great artery relationship is variable.",
    stages: [
      {
        id: "dorv-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal / Infant",
        overview: "Define VSD position relative to great arteries, establish great artery relationship, assess RVOTO, identify coronary anatomy, and determine AV valve anatomy. VSD position is the most critical determinant of surgical approach.",
        keyViews: ["PLAX/PSAX — great artery relationship (side-by-side, Ao right/anterior, PA left/posterior)", "A4C/A5C — VSD position relative to great arteries", "PSAX — coronary origins", "SSN — arch, PA sizes"],
        keyMeasurements: ["VSD size and position (subaortic vs subpulmonary vs doubly committed vs non-committed)", "Great artery relationship (Ao-PA distance, side-by-side vs anterior-posterior)", "RVOTO gradient (CW)", "PA annulus Z-score (if RVOTO)", "Coronary pattern"],
        doppler: ["Color across VSD — direction and committed great artery", "CW across RVOT — gradient (if RVOTO)", "Color at great artery origins — confirm both from RV", "CW at branch PAs — stenosis"],
        normalCriteria: ["VSD clearly committed to one great artery", "Adequate PA sizes (Z-score > -2)", "No significant RVOTO (if subaortic VSD type)"],
        redFlags: ["Non-committed VSD — complex repair, may need conduit", "Severe RVOTO with subaortic VSD (TOF-like) — may need staged repair", "Taussig-Bing with arch obstruction — common association, always check arch", "Coronary anomaly crossing RVOT"],
        tips: ["VSD position is the key to surgical planning — subaortic VSD allows intraventricular tunnel repair directing LV to Ao; subpulmonary VSD (Taussig-Bing) requires arterial switch + VSD closure.", "In Taussig-Bing anomaly, always check for aortic arch obstruction — it is present in 50% and requires simultaneous arch repair.", "Non-committed VSD is the most surgically challenging — the LV-to-great artery tunnel must traverse a long distance, risking LVOTO."]
      },
      {
        id: "dorv-postop",
        label: "Post-Op: Repair",
        timing: "Variable based on VSD type",
        overview: "Repair type depends on VSD position: intraventricular tunnel (subaortic VSD), REV procedure, Rastelli (subpulmonary VSD with RVOTO), or arterial switch + VSD closure (Taussig-Bing). Key post-op questions: LVOTO (tunnel obstruction), residual VSD, conduit function, and great artery stenosis.",
        keyViews: ["A4C/A5C — LVOTO (tunnel obstruction), residual VSD, LV function", "PSAX — conduit (if Rastelli), branch PAs", "PLAX — LVOTO, neo-aortic valve"],
        keyMeasurements: ["LVOTO gradient (CW — tunnel obstruction)", "Residual VSD size and gradient", "Conduit gradient and regurgitation (if Rastelli)", "LV EF", "Neo-aortic root size (if ASO-type repair)"],
        doppler: ["CW across LVOT — tunnel obstruction", "Color across VSD patch — residual shunt", "CW across conduit — gradient", "Color + CW neo-aortic valve — AR (if ASO-type)"],
        normalCriteria: ["LVOTO gradient <20 mmHg", "No residual VSD", "Conduit gradient <25 mmHg"],
        redFlags: ["LVOTO gradient >30 mmHg — tunnel obstruction, reoperation", "Residual VSD with Qp:Qs >1.5", "Conduit gradient >40 mmHg — reintervention"],
        tips: ["LVOTO from intraventricular tunnel obstruction is the most common late complication of DORV repair — always measure LVOT gradient at every follow-up.", "Conduit-dependent repairs (Rastelli) require conduit replacement every 5–10 years — track conduit gradient serially.", "In Taussig-Bing with ASO-type repair, follow the same surveillance protocol as d-TGA post-ASO (coronary patency, neo-aortic root, RVOTO)."]
      }
    ]
  },
  {
    id: "tricuspid-atresia",
    name: "Tricuspid Atresia",
    abbr: "TA",
    category: "Single Ventricle",
    color: "#4ad9e0",
    anatomy: "Absent tricuspid valve with hypoplastic or absent RV. ASD is obligatory (only exit from RA). VSD usually present (restrictive = subaortic obstruction). Most common: normally related great arteries with small restrictive VSD (type Ic). Single ventricle pathway (Glenn → Fontan). Great artery relationship determines physiology: normally related (pulmonary blood flow limited by VSD/RVOTO) vs transposed (pulmonary blood flow unrestricted, systemic blood flow limited by subaortic obstruction).",
    stages: [
      {
        id: "ta-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal",
        overview: "Confirm absent TV, assess ASD adequacy, quantify VSD size (restrictive = subaortic obstruction), determine great artery relationship, and assess PA sizes.",
        keyViews: ["A4C — absent TV (echogenic plate), ASD, VSD, LV function", "PSAX — PA, RVOTO, great artery relationship", "SSN — arch, PA sizes", "Subcostal — ASD, IVC"],
        keyMeasurements: ["ASD size and gradient (must be unrestrictive)", "VSD size (restrictive if <5mm — subaortic obstruction)", "LVOTO gradient (CW — if transposed great arteries)", "PA diameters (Z-scores)", "LV EF"],
        doppler: ["Color + CW across ASD — gradient and direction", "Color + CW across VSD — direction and gradient (restrictive VSD = subaortic obstruction)", "CW across LVOT — gradient (if transposed)", "CW at PA — forward flow (depends on VSD and PDA)"],
        normalCriteria: ["ASD gradient <5 mmHg (unrestrictive)", "VSD adequate for pulmonary blood flow (normally related GA)", "PA sizes adequate for Glenn (Z-score > -2)"],
        redFlags: ["Restrictive ASD (gradient >5 mmHg) — urgent balloon septostomy", "Restrictive VSD with normally related GA (subaortic obstruction) — may need Damus-Kaye-Stansel or arch reconstruction", "Restrictive VSD with transposed GA (pulmonary overcirculation) — PA banding", "PA hypoplasia (Z-score < -2) — may need BT shunt before Glenn"],
        tips: ["In tricuspid atresia with normally related great arteries, the VSD is the source of pulmonary blood flow — a restrictive VSD causes cyanosis and may require a BT shunt.", "In tricuspid atresia with transposed great arteries, the VSD is the source of systemic blood flow — a restrictive VSD causes subaortic obstruction and may require DKS procedure.", "Always assess ASD adequacy — a restrictive ASD causes RA hypertension and is a neonatal emergency."]
      },
      {
        id: "ta-fontan",
        label: "Post-Fontan Surveillance",
        timing: "Annual (lifelong)",
        overview: "Same surveillance protocol as HLHS post-Fontan. Key questions: Fontan conduit patency, fenestration, LV function, AV valve regurgitation (MR), and PA pressures.",
        keyViews: ["Subcostal — Fontan conduit, IVC, hepatic veins", "A4C — LV function, MR, ASD/fenestration", "SSN — PA confluence"],
        keyMeasurements: ["Fontan conduit velocity (CW — obstruction if >1.5 m/s)", "MR severity (vena contracta, PISA)", "LV EF", "Hepatic vein pulsatility", "Fenestration size and gradient"],
        doppler: ["CW across Fontan conduit — obstruction", "Color + CW MV — MR severity", "PW hepatic veins — pulsatility", "Color + CW fenestration — R→L shunt"],
        normalCriteria: ["Fontan conduit velocity <1.5 m/s", "MR mild or less", "LV EF >55%", "Non-pulsatile hepatic veins"],
        redFlags: ["Fontan obstruction (velocity >1.5 m/s)", "MR ≥ moderate — reoperation", "LV dysfunction (EF <55%)", "Hepatic vein pulsatility (elevated Fontan pressures)"],
        tips: ["MR is the most common AV valve problem in tricuspid atresia post-Fontan — track severity serially.", "Fontan failure presents with elevated hepatic vein pulsatility, ascites, and protein-losing enteropathy — echo is the first-line tool.", "Fenestration closure is considered when R→L shunt causes significant desaturation without hemodynamic benefit."]
      }
    ]
  },
  {
    id: "iaa",
    name: "Interrupted Aortic Arch",
    abbr: "IAA",
    category: "Left Heart Obstruction",
    color: "#189aa1",
    anatomy: "Complete discontinuity of the aortic arch. Type A: interruption distal to left subclavian artery (30%). Type B: interruption between left common carotid and left subclavian arteries (53%) — strongly associated with DiGeorge syndrome / 22q11 deletion. Type C: interruption between innominate and left common carotid arteries (17%). Associated with VSD in >95%, subaortic stenosis, and bicuspid AV. Systemic circulation distal to interruption depends entirely on PDA.",
    stages: [
      {
        id: "iaa-preop",
        label: "Pre-Op Assessment",
        timing: "Neonatal Emergency",
        overview: "Identify interruption type, assess VSD size and location, evaluate subaortic anatomy (LVOTO), confirm PDA patency, and assess LV function. Neonatal emergency — PDA closure = cardiovascular collapse.",
        keyViews: ["SSN — aortic arch (identify interruption site, gap between proximal and distal arch)", "PLAX — VSD, subaortic anatomy, aortic valve", "A4C — LV function, VSD", "PSAX — coronary origins, PA"],
        keyMeasurements: ["Interruption site (Type A/B/C)", "Ascending Ao diameter (Z-score)", "VSD size and location", "Subaortic distance (LVOT width — narrow = LVOTO risk)", "LVOTO gradient (CW)", "PDA size and direction of flow", "LV EF"],
        doppler: ["Color + CW across VSD — direction and gradient", "CW across LVOT — subaortic gradient", "Color + CW across PDA — direction (R→L = distal arch perfusion)", "Color at aortic valve — bicuspid morphology"],
        normalCriteria: ["PDA widely patent (distal arch perfusion)", "VSD adequate (LV-to-PA mixing)", "No significant LVOTO (<20 mmHg)"],
        redFlags: ["PDA closure — cardiovascular collapse (emergency prostaglandin E1)", "Subaortic stenosis (LVOTO gradient >20 mmHg) — requires simultaneous subaortic resection", "Small VSD with subaortic obstruction — DKS procedure may be needed", "Type B IAA — screen for DiGeorge (22q11) — calcium and immune function"],
        tips: ["IAA is a neonatal emergency — prostaglandin E1 must be started immediately to maintain PDA patency.", "Type B IAA is strongly associated with DiGeorge syndrome (22q11) — check calcium levels and send chromosomes on all Type B patients.", "Subaortic stenosis is the most common late complication after IAA repair — occurs in up to 30% and requires reoperation. Measure LVOT gradient at every visit."]
      },
      {
        id: "iaa-postop",
        label: "Post-Op: Arch Reconstruction + VSD Closure",
        timing: "Neonatal",
        overview: "Arch reconstruction (direct anastomosis or patch) and VSD closure. Key post-op questions: re-coarctation at repair site, subaortic stenosis (most common late complication), residual VSD, and LV function.",
        keyViews: ["SSN — arch, anastomosis site", "PLAX — subaortic anatomy, LVOTO", "A4C — residual VSD, LV function"],
        keyMeasurements: ["Arch gradient at repair site (CW — >20 mmHg = re-coarctation)", "LVOTO gradient (CW — serial — late complication)", "Residual VSD size and gradient", "LV EF", "LV mass index"],
        doppler: ["CW at arch repair site — gradient (diastolic tail = re-coarctation)", "CW across LVOT — subaortic gradient (serial)", "Color across VSD patch — residual shunt", "Abdominal Ao PW — pulsatility"],
        normalCriteria: ["Arch gradient <20 mmHg", "LVOTO gradient <20 mmHg", "No residual VSD", "Normal abdominal Ao pulsatility"],
        redFlags: ["Re-coarctation (arch gradient >20 mmHg) — catheter balloon/stent or reoperation", "Subaortic stenosis (LVOTO gradient >30 mmHg) — reoperation", "Residual VSD with Qp:Qs >1.5"],
        tips: ["Subaortic stenosis develops in up to 30% of IAA repairs — measure LVOTO gradient at every visit from early childhood.", "Re-coarctation at the arch anastomosis is common — interrogate with CW from SSN view and look for diastolic tail.", "Bicuspid AV is common in IAA — track AS and AR progression lifelong."]
      }
    ]
  },
  {
    id: "heterotaxy",
    name: "Heterotaxy / Isomerism",
    abbr: "Heterotaxy",
    category: "Situs Anomalies",
    color: "#1ba8b0",
    anatomy: "Failure of normal left-right asymmetry. Right isomerism (asplenia): bilateral right-sidedness — bilateral SVC, TAPVR (often obstructed), common AV valve, AVSD, pulmonary atresia, DORV, bilateral morphologic right atria. Left isomerism (polysplenia): bilateral left-sidedness — interrupted IVC (azygos continuation to SVC), AV block, AVSD, partial AVSD, bilateral morphologic left atria. Both require a segmental approach to define the anatomy.",
    stages: [
      {
        id: "heterotaxy-assessment",
        label: "Segmental Assessment",
        timing: "Any age (neonatal diagnosis)",
        overview: "Use the segmental approach to define atrial situs, AV connection, ventriculoarterial connection, systemic veins, pulmonary veins, and associated lesions. Right isomerism is more complex and has higher mortality.",
        keyViews: ["Subcostal — IVC/aorta relationship (situs), abdominal situs", "A4C — atrial morphology, AV valve, ventricular morphology", "SSN — systemic veins (bilateral SVC, azygos continuation)", "Subcostal sagittal — PV return (TAPVR type and obstruction)", "PSAX — great artery relationship, RVOTO"],
        keyMeasurements: ["Atrial situs (RA morphology: broad-based appendage = right; narrow = left)", "IVC position relative to aorta (IVC right of Ao = normal; IVC left = L-isomerism; absent IVC = azygos continuation)", "AV valve morphology (common vs two AV valves)", "Ventricular loop (D-loop vs L-loop)", "TAPVR type and obstruction (if right isomerism)", "AV valve regurgitation severity"],
        doppler: ["Color + CW at PV confluence — TAPVR obstruction (right isomerism)", "Color + CW at AV valve — regurgitation severity", "CW at RVOT — obstruction", "Color at systemic veins — bilateral SVC, azygos continuation"],
        normalCriteria: ["Fully defined segmental anatomy", "No TAPVR obstruction", "AV valve regurgitation mild or less"],
        redFlags: ["Obstructed TAPVR (right isomerism) — surgical emergency", "Common AV valve with severe regurgitation — poor prognosis", "Complete AV block (left isomerism) — pacemaker may be needed", "Bilateral SVC without bridging vein — affects Glenn/Fontan planning", "Interrupted IVC (azygos continuation) — affects Fontan routing"],
        tips: ["Always use the segmental approach in heterotaxy — describe atrial situs, AV connection, and VA connection separately. Do not assume normal anatomy.", "In right isomerism, TAPVR is almost universal — always look for the PV confluence from subcostal view.", "Interrupted IVC (azygos continuation) in left isomerism means the IVC does not connect to the RA — the hepatic veins drain separately. This has major implications for Fontan planning.", "Bilateral SVC without a bridging vein requires bilateral Glenn anastomoses — identify this pre-operatively.", "Complete AV block in left isomerism may require pacing — correlate with ECG and Holter."]
      }
    ]
  }
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function CHDCard({ defect, isSelected, onClick }: { defect: CHDDefect; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg transition-all mb-1"
      style={isSelected
        ? { background: defect.color, color: "white" }
        : { background: "transparent", color: "#374151", border: "1px solid #f0f0f0" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-bold text-sm" style={{ fontFamily: "Merriweather, serif" }}>{defect.abbr}</span>
          <span className="text-xs ml-2 opacity-80">{defect.category}</span>
        </div>
        <ChevronRight size={14} className={isSelected ? "opacity-80" : "opacity-30"} />
      </div>
      <div className="text-xs opacity-75 mt-0.5 truncate">{defect.name}</div>
    </button>
  );
}

function StageTab({ stage, isSelected, color, onClick }: { stage: ScanStage; isSelected: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
      style={isSelected
        ? { background: color, color: "white" }
        : { background: "white", color: color, border: `1px solid ${color}` }}
    >
      {stage.label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PedCHDCoach({ isPremium = false }: { isPremium?: boolean }) {
  // Support deep-linking via URL params: ?defect=tof&stage=tof-preop
  const getInitialFromParams = () => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const defectId = params.get('defect');
    const stageId = params.get('stage');
    const defect = (defectId ? chdDefects.find(d => d.id === defectId) : null) ?? chdDefects[0];
    const stage = (stageId ? defect.stages.find(s => s.id === stageId) : null) ?? defect.stages[0];
    return { defect, stage };
  };
  const { defect: _initDefect, stage: _initStage } = getInitialFromParams();
  const [selectedDefect, setSelectedDefect] = useState(_initDefect);
  const [selectedStage, setSelectedStage] = useState(_initStage);
  // Re-sync when URL params change (e.g. iframe src update)
  useEffect(() => {
    const { defect, stage } = getInitialFromParams();
    setSelectedDefect(defect);
    setSelectedStage(stage);
  }, [typeof window !== 'undefined' ? window.location.search : '']);
  const detailRef = useRef<HTMLDivElement>(null);
  const scrollOnChange = useRef(false);

  const handleDefectSelect = (defect: CHDDefect) => {
    scrollOnChange.current = true;
    setSelectedDefect(defect);
    setSelectedStage(defect.stages[0]);
  };

  const handleStageSelect = (stage: ScanStage) => {
    setSelectedStage(stage);
  };

  const { mergeView: mergeCHDView } = useScanCoachOverrides("chd");
  // Merge admin overrides into the selected defect (for image URLs at the defect level)
  const selectedDefectMerged = useMemo(() => mergeCHDView({ ...selectedDefect, id: selectedDefect.id } as any), [selectedDefect, mergeCHDView]);
  // Merge admin overrides into the selected stage (for text content).
  // applyOverride maps DB columns to CHD stage fields:
  //   description→overview, howToGet→keyViews, measurements→keyMeasurements,
  //   structures→doppler, pitfalls→normalCriteria, criticalFindings→redFlags, tips→tips
  const selectedStageMerged = useMemo(() => mergeCHDView({ ...selectedStage, id: selectedStage.id } as any) as typeof selectedStage, [selectedStage, mergeCHDView]);

  const currentIndex = chdDefects.findIndex(d => d.id === selectedDefect.id);
  const handlePrev = () => {
    if (currentIndex > 0) {
      const prev = chdDefects[currentIndex - 1];
      setSelectedDefect(prev);
      setSelectedStage(prev.stages[0]);
    }
  };
  const handleNext = () => {
    if (currentIndex < chdDefects.length - 1) {
      const next = chdDefects[currentIndex + 1];
      setSelectedDefect(next);
      setSelectedStage(next.stages[0]);
    }
  };

  return (
    <div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
      {/* Detail panel — order-first on mobile */}
      <div ref={detailRef} className="lg:col-span-3 lg:order-2 order-1 space-y-4">

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${selectedDefect.color}18, ${selectedDefect.color}08)` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: selectedDefect.color }}>{selectedDefect.category}</span>
                <span className="text-xs text-gray-400">{selectedDefect.stages.length} scan stage{selectedDefect.stages.length > 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrev} disabled={currentIndex === 0}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                  style={{ background: "white", color: selectedDefect.color, border: `1px solid ${selectedDefect.color}` }}>
                  ← Prev
                </button>
                <button onClick={handleNext} disabled={currentIndex === chdDefects.length - 1}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                  style={{ background: selectedDefect.color, color: "white" }}>
                  Next →
                </button>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>{selectedDefect.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{selectedDefect.abbr} · {selectedStage.label} · {selectedStage.timing}</p>
          </div>

          {/* Stage tabs */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2 flex-wrap">
            {selectedDefect.stages.map(stage => (
              <StageTab key={stage.id} stage={stage} isSelected={selectedStage.id === stage.id} color={selectedDefect.color} onClick={() => handleStageSelect(stage)} />
            ))}
          </div>
        </div>

        {/* Anatomy */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: `${selectedDefect.color}10` }}>
            <Info size={14} style={{ color: selectedDefect.color }} />
            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Anatomy & Pathophysiology</h3>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-gray-600 leading-relaxed">{selectedDefect.anatomy}</p>
          </div>
        </div>

        {/* Admin-uploaded reference images */}
        {((selectedDefectMerged as any).echoImageUrl || (selectedDefectMerged as any).anatomyImageUrl) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Reference Images</h3>
              <span className="text-xs text-gray-400">Diagram · Clinical Echo</span>
            </div>
            <div className={`grid gap-0 bg-gray-950 ${ (selectedDefectMerged as any).echoImageUrl && (selectedDefectMerged as any).anatomyImageUrl ? 'grid-cols-2' : 'grid-cols-1' }`}>
              {(selectedDefectMerged as any).anatomyImageUrl && (
                <div className="flex justify-center items-center p-3 border-r border-gray-800">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1.5">Anatomy Diagram</p>
                    <img src={(selectedDefectMerged as any).anatomyImageUrl} alt={`${selectedDefect.name} diagram`} className="max-h-60 object-contain rounded" style={{ background: "#030712" }} />
                  </div>
                </div>
              )}
              {(selectedDefectMerged as any).echoImageUrl && (
                <div className="flex justify-center items-center p-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1.5">Clinical Echo Image</p>
                    <img src={(selectedDefectMerged as any).echoImageUrl} alt={`${selectedDefect.name} echo`} className="max-h-60 object-contain rounded" style={{ background: "#030712" }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage Overview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: `${selectedDefect.color}10` }}>
            <Eye size={14} style={{ color: selectedDefect.color }} />
            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Stage Overview — {selectedStage.label}</h3>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-gray-600 leading-relaxed">{selectedStageMerged.overview}</p>
          </div>
        </div>

        {/* 3-column grid: Views + Measurements + Doppler */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Key Views */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ background: `${selectedDefect.color}10` }}>
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Key Views</h3>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {selectedStageMerged.keyViews.map((v, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ background: selectedDefect.color }}>{i + 1}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Measurements */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ background: `${selectedDefect.color}10` }}>
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Key Measurements</h3>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {selectedStageMerged.keyMeasurements.map((m, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: selectedDefect.color }}>▸</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Doppler */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100" style={{ background: `${selectedDefect.color}10` }}>
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Doppler Protocol</h3>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {selectedStageMerged.doppler.map((d, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: selectedDefect.color }}>◆</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Normal Criteria + Red Flags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Normal Criteria */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: "#f0fdf4" }}>
              <Activity size={14} className="text-green-600" />
              <h3 className="font-bold text-sm text-green-700" style={{ fontFamily: "Merriweather, serif" }}>Normal / Acceptable Criteria</h3>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {selectedStageMerged.normalCriteria.map((c, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="mt-0.5 text-green-500 flex-shrink-0">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Red Flags */}
          <PremiumPearlGate isPremium={isPremium} label="Red Flags" count={selectedStageMerged.redFlags.length} context="Unlock reintervention criteria and red flags for every CHD stage with Premium.">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: "#fff1f2" }}>
              <AlertTriangle size={14} className="text-red-500" />
              <h3 className="font-bold text-sm text-red-600" style={{ fontFamily: "Merriweather, serif" }}>Red Flags / Reintervention Criteria</h3>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {selectedStageMerged.redFlags.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600">
                  <span className="mt-0.5 text-red-400 flex-shrink-0">⚠</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          </PremiumPearlGate>
        </div>

        {/* Clinical Tips */}
        <PremiumPearlGate isPremium={isPremium} label="Clinical Scanning Tips" count={selectedStageMerged.tips.length} context="Unlock expert clinical scanning tips for every CHD defect and stage with Premium.">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ background: `${selectedDefect.color}10` }}>
            <Stethoscope size={14} style={{ color: selectedDefect.color }} />
            <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>Clinical Scanning Tips</h3>
          </div>
          <div className="px-4 py-4 space-y-3">
            {selectedStageMerged.tips.map((tip, i) => (
              <div key={i} className="flex gap-3 text-sm text-gray-600">
                <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold" style={{ background: selectedDefect.color }}>{i + 1}</span>
                <p className="leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
        </PremiumPearlGate>

      </div>

      {/* Sidebar — CHD list */}
      <div className="lg:col-span-1 lg:order-1 order-2 lg:sticky lg:top-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100" style={{ background: "linear-gradient(135deg, #189aa110, #4ad9e008)" }}>
            <div className="flex items-center gap-2">
              <Heart size={14} style={{ color: "#189aa1" }} />
              <h3 className="font-bold text-sm text-gray-700" style={{ fontFamily: "Merriweather, serif" }}>CHD Defects</h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{chdDefects.length} major congenital defects</p>
          </div>
          <div className="p-3 space-y-0.5 max-h-[calc(100vh-180px)] overflow-y-auto">
            {chdDefects.map(defect => (
              <CHDCard key={defect.id} defect={defect} isSelected={selectedDefect.id === defect.id} onClick={() => handleDefectSelect(defect)} />
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
