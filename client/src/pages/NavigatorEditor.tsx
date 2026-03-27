/**
 * NavigatorEditor — Admin page for editing Navigator protocol checklists.
 * Features:
 *  - Module selector (all 19 navigator modules)
 *  - Loads current static content as seed data if no DB overrides exist
 *  - Section accordion with inline edit for probe description
 *  - Per-item: edit label, detail, critical flag, drag-to-reorder, delete
 *  - Add new items to any section
 *  - Add new sections to any module
 *  - Reorder sections via up/down arrows
 *  - Save / discard changes per section
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save, GripVertical,
  AlertTriangle, CheckCircle2, ArrowUp, ArrowDown, Edit3, X, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ─── Static seed data for all navigator modules ───────────────────────────────
// This is the fallback content shown when no DB overrides exist yet.
// Matches the data in each Navigator page.
const STATIC_NAVIGATOR_DATA: Record<string, Array<{
  sectionName: string;
  probe: string;
  items: Array<{ id: string; label: string; detail: string; critical: boolean }>;
}>> = {
  abdominal: [
    { sectionName: "Liver", probe: "Subcostal and intercostal approaches", items: [
      { id: "abdominalnavigator_0_0", label: "Long-axis and transverse views of all lobes (right, left, caudate)", detail: "", critical: false },
      { id: "abdominalnavigator_0_1", label: "Parenchymal echogenicity compared to right kidney, surface nodularity, focal lesions", detail: "", critical: false },
      { id: "abdominalnavigator_0_2", label: "Major hepatic and perihepatic vessels (IVC, hepatic veins, portal vein)", detail: "", critical: false },
      { id: "abdominalnavigator_0_3", label: "Right hemidiaphragm and adjacent pleural space", detail: "", critical: false },
    ]},
    { sectionName: "Gallbladder and Biliary Tract", probe: "Subcostal and intercostal approaches", items: [
      { id: "abdominalnavigator_1_0", label: "Long-axis and transverse views of the gallbladder", detail: "", critical: false },
      { id: "abdominalnavigator_1_1", label: "Wall thickness, presence of gallstones, sludge, or polyps", detail: "", critical: false },
      { id: "abdominalnavigator_1_2", label: "Intrahepatic and extrahepatic bile ducts for dilatation", detail: "", critical: false },
      { id: "abdominalnavigator_1_3", label: "Sonographic Murphy sign if pain is present", detail: "", critical: false },
    ]},
    { sectionName: "Pancreas", probe: "Transverse epigastric approach", items: [
      { id: "abdominalnavigator_2_0", label: "Head, uncinate process, body, and tail", detail: "", critical: false },
      { id: "abdominalnavigator_2_1", label: "Parenchymal echotexture, masses, calcifications, ductal dilatation", detail: "", critical: false },
      { id: "abdominalnavigator_2_2", label: "Peripancreatic region for adenopathy or collections", detail: "", critical: false },
    ]},
    { sectionName: "Spleen", probe: "Left lateral decubitus or coronal intercostal approach", items: [
      { id: "abdominalnavigator_3_0", label: "Size (craniocaudal length), echotexture, focal lesions", detail: "", critical: false },
      { id: "abdominalnavigator_3_1", label: "Perisplenic fluid or adenopathy", detail: "", critical: false },
    ]},
    { sectionName: "Kidneys", probe: "Posterior or lateral intercostal approach", items: [
      { id: "abdominalnavigator_4_0", label: "Long-axis and transverse views of both kidneys", detail: "", critical: false },
      { id: "abdominalnavigator_4_1", label: "Renal length, cortical thickness, echogenicity, collecting system", detail: "", critical: false },
      { id: "abdominalnavigator_4_2", label: "Hydronephrosis, calculi, masses", detail: "", critical: false },
    ]},
    { sectionName: "Aorta", probe: "Midline transverse and longitudinal approaches", items: [
      { id: "abdominalnavigator_5_0", label: "Proximal, mid, and distal segments for aneurysm or other abnormalities", detail: "", critical: false },
    ]},
    { sectionName: "Inferior Vena Cava (IVC)", probe: "Subcostal and parasagittal approaches", items: [
      { id: "abdominalnavigator_6_0", label: "Patency, diameter, and respiratory variation", detail: "", critical: false },
      { id: "abdominalnavigator_6_1", label: "Presence of thrombus or filters", detail: "", critical: false },
    ]},
    { sectionName: "Urinary Bladder", probe: "Suprapubic transverse and longitudinal", items: [
      { id: "abdominalnavigator_7_0", label: "Wall thickness, intraluminal lesions, post-void residual if indicated", detail: "", critical: false },
    ]},
  ],
  venous: [
    { sectionName: "External Iliac Vein (EIV)", probe: "Curvilinear 2–5 MHz; patient supine", items: [
      { id: "venous_eiv_0", label: "Transverse compression at inguinal ligament level", detail: "Compress every 2 cm along the vessel course", critical: true },
      { id: "venous_eiv_1", label: "Longitudinal color Doppler — confirm flow, respiratory phasicity", detail: "", critical: false },
      { id: "venous_eiv_2", label: "Spectral Doppler — phasic waveform with respiration", detail: "Loss of phasicity suggests proximal obstruction (iliac or IVC)", critical: false },
    ]},
    { sectionName: "Common Femoral Vein (CFV)", probe: "Linear 5–12 MHz; patient supine, hip externally rotated", items: [
      { id: "venous_cfv_0", label: "Transverse compression at inguinal crease", detail: "Vessel should fully collapse with gentle probe pressure", critical: true },
      { id: "venous_cfv_1", label: "Longitudinal color Doppler — augmentation with calf squeeze", detail: "", critical: false },
      { id: "venous_cfv_2", label: "Spectral Doppler — phasic waveform, Valsalva response", detail: "", critical: false },
      { id: "venous_cfv_3", label: "Saphenofemoral junction (SFJ) — assess for reflux if indicated", detail: ">0.5 s reflux on Valsalva = significant", critical: false },
    ]},
    { sectionName: "Femoral Vein (FV) / Superficial Femoral Vein", probe: "Linear 5–12 MHz; patient supine", items: [
      { id: "venous_fv_0", label: "Compression every 2–3 cm from CFV to adductor canal", detail: "", critical: true },
      { id: "venous_fv_1", label: "Color Doppler throughout — note any filling defects", detail: "", critical: false },
      { id: "venous_fv_2", label: "Spectral Doppler at mid-thigh level", detail: "", critical: false },
    ]},
    { sectionName: "Popliteal Vein (PopV)", probe: "Linear 5–12 MHz; patient prone or lateral decubitus", items: [
      { id: "venous_pop_0", label: "Transverse compression at popliteal fossa", detail: "", critical: true },
      { id: "venous_pop_1", label: "Color Doppler — augmentation with foot dorsiflexion", detail: "", critical: false },
      { id: "venous_pop_2", label: "Identify popliteal artery (pulsatile) adjacent to vein", detail: "", critical: false },
    ]},
    { sectionName: "Calf Veins (Tibial / Peroneal)", probe: "Linear 5–12 MHz; patient prone or lateral decubitus", items: [
      { id: "venous_calf_0", label: "Anterior tibial, posterior tibial, and peroneal veins — compression bilaterally", detail: "Calf DVT extends to popliteal in ~20% — follow-up in 5–7 days if isolated", critical: false },
      { id: "venous_calf_1", label: "Gastrocnemius and soleal sinuses — assess for muscular vein thrombosis", detail: "", critical: false },
    ]},
    { sectionName: "Great Saphenous Vein (GSV)", probe: "Linear 5–12 MHz; patient supine or standing", items: [
      { id: "venous_gsv_0", label: "GSV diameter at SFJ and mid-thigh — document for ablation planning", detail: ">3 mm at SFJ with reflux = significant insufficiency", critical: false },
      { id: "venous_gsv_1", label: "Reflux assessment: Valsalva at SFJ; cuff deflation at thigh/calf", detail: ">0.5 s reflux = pathologic", critical: false },
      { id: "venous_gsv_2", label: "Varicosities — map distribution and perforator connections", detail: "", critical: false },
    ]},
  ],
  carotid: [
    { sectionName: "Common Carotid Artery (CCA)", probe: "Linear 5–12 MHz; patient supine, neck extended", items: [
      { id: "carotid_cca_0", label: "Longitudinal and transverse views of proximal, mid, and distal CCA", detail: "", critical: false },
      { id: "carotid_cca_1", label: "IMT measurement at far wall of distal CCA (1 cm proximal to bulb)", detail: "Normal IMT <0.9 mm; >1.0 mm = increased cardiovascular risk", critical: false },
      { id: "carotid_cca_2", label: "PSV and EDV with spectral Doppler", detail: "Normal CCA PSV 60–100 cm/s", critical: false },
      { id: "carotid_cca_3", label: "Plaque characterization — location, echogenicity, surface morphology", detail: "", critical: false },
    ]},
    { sectionName: "Carotid Bulb", probe: "Linear 5–12 MHz", items: [
      { id: "carotid_bulb_0", label: "Transverse and longitudinal views of the carotid bulb", detail: "", critical: false },
      { id: "carotid_bulb_1", label: "Plaque burden — measure stenosis in transverse (area) and longitudinal (diameter)", detail: "", critical: true },
      { id: "carotid_bulb_2", label: "Color Doppler — flow separation at posterior wall is normal", detail: "", critical: false },
    ]},
    { sectionName: "Internal Carotid Artery (ICA)", probe: "Linear 5–12 MHz", items: [
      { id: "carotid_ica_0", label: "Longitudinal and transverse views of proximal, mid, and distal ICA", detail: "", critical: false },
      { id: "carotid_ica_1", label: "PSV, EDV, and ICA/CCA ratio at point of maximum stenosis", detail: "ICA/CCA PSV ratio >4.0 = severe stenosis (≥70% NASCET)", critical: true },
      { id: "carotid_ica_2", label: "Plaque characterization and percent diameter stenosis", detail: "NASCET criteria: stenosis = (1 − residual lumen / distal normal ICA) × 100", critical: true },
      { id: "carotid_ica_3", label: "Waveform morphology — tardus-parvus pattern suggests proximal obstruction", detail: "", critical: false },
    ]},
    { sectionName: "External Carotid Artery (ECA)", probe: "Linear 5–12 MHz", items: [
      { id: "carotid_eca_0", label: "Identify ECA by temporal tap maneuver and high-resistance waveform", detail: "", critical: false },
      { id: "carotid_eca_1", label: "PSV and waveform morphology", detail: "ECA has notch on spectral waveform from temporal tap", critical: false },
    ]},
    { sectionName: "Vertebral Arteries", probe: "Linear 5–12 MHz; angle probe posterolaterally", items: [
      { id: "carotid_vert_0", label: "Identify vertebral artery between transverse processes (V2 segment)", detail: "", critical: false },
      { id: "carotid_vert_1", label: "Flow direction — antegrade (normal) vs retrograde (subclavian steal)", detail: "Retrograde flow = subclavian steal; confirm with subclavian Doppler", critical: true },
      { id: "carotid_vert_2", label: "PSV — note if low velocity or absent flow", detail: "", critical: false },
    ]},
    { sectionName: "Subclavian Arteries", probe: "Linear 5–12 MHz; supraclavicular approach", items: [
      { id: "carotid_subclav_0", label: "Bilateral subclavian artery PSV and waveform morphology", detail: "", critical: false },
      { id: "carotid_subclav_1", label: "Document bilateral brachial blood pressures (right and left arm)", detail: "Difference >15–20 mmHg suggests subclavian stenosis or steal", critical: true },
      { id: "carotid_subclav_2", label: "Color Doppler — assess for stenosis at origin or proximal segment", detail: "", critical: false },
      { id: "carotid_subclav_3", label: "Vertebral artery flow direction — retrograde = subclavian steal", detail: "", critical: true },
    ]},
  ],
  tcd: [
    { sectionName: "Transtemporal Window — MCA", probe: "Phased array 1–2 MHz; temporal window above zygomatic arch", items: [
      { id: "tcd_mca_0", label: "MCA M1 segment at 45–65 mm depth — PSV, mean velocity, PI", detail: "Normal MCA mean velocity: 55±12 cm/s (adults)", critical: false },
      { id: "tcd_mca_1", label: "Direction of flow: toward probe (positive deflection)", detail: "", critical: false },
      { id: "tcd_mca_2", label: "Pulsatility Index (PI) = (PSV−EDV)/mean velocity", detail: "Normal PI 0.6–1.1; elevated PI suggests increased ICP or distal resistance", critical: false },
    ]},
    { sectionName: "Transtemporal Window — ACA/PCA", probe: "Phased array 1–2 MHz; same temporal window", items: [
      { id: "tcd_aca_0", label: "ACA A1 at 60–75 mm depth — flow away from probe (negative deflection)", detail: "Normal ACA mean velocity: 50±11 cm/s", critical: false },
      { id: "tcd_pca_0", label: "PCA P1 at 55–75 mm depth — flow toward probe (positive deflection)", detail: "Normal PCA mean velocity: 39±10 cm/s", critical: false },
      { id: "tcd_pca_1", label: "PCA P2 at 55–75 mm depth — flow away from probe", detail: "", critical: false },
    ]},
    { sectionName: "Transforaminal Window — Basilar / VA", probe: "Phased array 1–2 MHz; suboccipital approach, neck flexed", items: [
      { id: "tcd_ba_0", label: "Basilar artery at 75–110 mm depth — flow away from probe", detail: "Normal basilar mean velocity: 41±10 cm/s", critical: false },
      { id: "tcd_va_0", label: "Vertebral arteries at 40–75 mm depth — flow away from probe", detail: "Normal VA mean velocity: 38±10 cm/s", critical: false },
      { id: "tcd_ba_1", label: "Asymmetry between bilateral VA velocities >30% — note for steal", detail: "", critical: true },
    ]},
    { sectionName: "Transorbital Window — ICA Siphon / Ophthalmic", probe: "Phased array 1–2 MHz; REDUCED power (TI <0.23)", items: [
      { id: "tcd_oph_0", label: "Ophthalmic artery at 40–60 mm — flow toward probe (positive)", detail: "CRITICAL: Reduce MI/TI — eye is sensitive to ultrasound energy", critical: true },
      { id: "tcd_ica_siphon_0", label: "ICA siphon at 60–70 mm depth", detail: "", critical: false },
      { id: "tcd_oph_1", label: "Reversed ophthalmic flow suggests ICA occlusion with collateral supply", detail: "", critical: true },
    ]},
    { sectionName: "Submandibular Window — Distal ICA", probe: "Phased array 1–2 MHz; angle probe superiorly under jaw", items: [
      { id: "tcd_subm_0", label: "Distal extracranial ICA at 40–60 mm — flow away from probe", detail: "", critical: false },
      { id: "tcd_subm_1", label: "Compare velocity to ipsilateral MCA — low ICA + high MCA = stenosis", detail: "", critical: false },
    ]},
  ],
  msk: [
    { sectionName: "Shoulder", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_shoulder_0", label: "Supraspinatus tendon — long and short axis (dynamic internal rotation)", detail: "Assess for full vs partial thickness tear, tendinopathy, calcification", critical: false },
      { id: "msk_shoulder_1", label: "Infraspinatus and teres minor tendons", detail: "", critical: false },
      { id: "msk_shoulder_2", label: "Subscapularis tendon — transverse and longitudinal (dynamic external rotation)", detail: "", critical: false },
      { id: "msk_shoulder_3", label: "Long head of biceps tendon in bicipital groove", detail: "Assess for tendinopathy, tenosynovitis, subluxation, rupture", critical: false },
      { id: "msk_shoulder_4", label: "Subacromial-subdeltoid bursa — thickness and fluid", detail: "Normal bursa <2 mm; >2 mm = bursitis", critical: false },
      { id: "msk_shoulder_5", label: "AC joint — effusion, osteophytes, dynamic impingement", detail: "", critical: false },
      { id: "msk_shoulder_6", label: "Glenohumeral joint — posterior recess for effusion", detail: "", critical: false },
    ]},
    { sectionName: "Elbow", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_elbow_0", label: "Common extensor tendon (lateral epicondyle) — long and short axis", detail: "Assess for lateral epicondylosis (tennis elbow)", critical: false },
      { id: "msk_elbow_1", label: "Common flexor tendon (medial epicondyle)", detail: "Assess for medial epicondylosis (golfer's elbow)", critical: false },
      { id: "msk_elbow_2", label: "Distal biceps tendon at radial tuberosity", detail: "", critical: false },
      { id: "msk_elbow_3", label: "Ulnar nerve at cubital tunnel — measure CSA", detail: "Normal ulnar nerve CSA <9 mm²; >9 mm² = cubital tunnel syndrome", critical: false },
      { id: "msk_elbow_4", label: "Posterior joint recess — effusion, loose bodies", detail: "", critical: false },
    ]},
    { sectionName: "Wrist", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_wrist_0", label: "Median nerve at carpal tunnel inlet — measure CSA", detail: "Normal CSA <10 mm²; >15 mm² = carpal tunnel syndrome", critical: false },
      { id: "msk_wrist_1", label: "Flexor tendons — assess for tenosynovitis", detail: "", critical: false },
      { id: "msk_wrist_2", label: "Extensor tendons (6 compartments) — de Quervain's (1st compartment)", detail: "", critical: false },
      { id: "msk_wrist_3", label: "Ulnar nerve at Guyon's canal", detail: "", critical: false },
      { id: "msk_wrist_4", label: "Distal radioulnar joint — effusion, instability", detail: "", critical: false },
    ]},
    { sectionName: "Hip", probe: "Curvilinear 2–5 MHz (deep) or linear (superficial)", items: [
      { id: "msk_hip_0", label: "Anterior hip joint — measure anterior recess fluid depth", detail: "Normal <5 mm; >7 mm or >2 mm asymmetry = effusion", critical: false },
      { id: "msk_hip_1", label: "Iliopsoas tendon and bursa", detail: "", critical: false },
      { id: "msk_hip_2", label: "Greater trochanteric bursa and gluteal tendons", detail: "", critical: false },
      { id: "msk_hip_3", label: "Pediatric: bilateral comparison — femoral head position and coverage", detail: "", critical: false },
    ]},
    { sectionName: "Knee", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_knee_0", label: "Quadriceps tendon — long and short axis", detail: "", critical: false },
      { id: "msk_knee_1", label: "Patellar tendon — long and short axis (proximal, mid, distal)", detail: "Assess for patellar tendinopathy (jumper's knee)", critical: false },
      { id: "msk_knee_2", label: "Suprapatellar recess — effusion depth in longitudinal", detail: "Normal <4 mm; >4 mm = effusion", critical: false },
      { id: "msk_knee_3", label: "Medial and lateral collateral ligaments", detail: "", critical: false },
      { id: "msk_knee_4", label: "Posterior knee — Baker's cyst, popliteal vessels", detail: "", critical: false },
    ]},
    { sectionName: "Ankle", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_ankle_0", label: "Achilles tendon — long and short axis (full length)", detail: "Normal AP diameter 4–6 mm; >8 mm = tendinopathy", critical: false },
      { id: "msk_ankle_1", label: "Anterior tibiotalar joint — effusion", detail: "", critical: false },
      { id: "msk_ankle_2", label: "Lateral ligaments (ATFL, CFL) — dynamic stress views", detail: "", critical: false },
      { id: "msk_ankle_3", label: "Peroneal tendons — transverse at fibular groove (subluxation)", detail: "", critical: false },
      { id: "msk_ankle_4", label: "Posterior tibial tendon — longitudinal and transverse", detail: "", critical: false },
    ]},
    { sectionName: "Foot", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "msk_foot_0", label: "Plantar fascia at calcaneal insertion — thickness", detail: "Normal <4 mm; >5 mm = plantar fasciitis", critical: false },
      { id: "msk_foot_1", label: "Interdigital spaces — Morton's neuroma (3rd web space most common)", detail: "Hypoechoic mass >5 mm = significant neuroma", critical: false },
      { id: "msk_foot_2", label: "MTP joints — effusion, synovitis (gout, RA)", detail: "", critical: false },
    ]},
  ],
  thyroid: [
    { sectionName: "Right Thyroid Lobe", probe: "High-frequency linear 10–18 MHz; patient supine, neck extended", items: [
      { id: "thyroid_rt_0", label: "Longitudinal and transverse views — measure length, width, AP diameter", detail: "Normal lobe: length 4–6 cm, width 1.5–2 cm, AP 1.5–2 cm", critical: false },
      { id: "thyroid_rt_1", label: "Parenchymal echogenicity and vascularity (color Doppler)", detail: "Diffuse hypervascularity = Graves' disease; hypoechoic = thyroiditis", critical: false },
      { id: "thyroid_rt_2", label: "Nodule characterization — ACR TI-RADS: composition, echogenicity, shape, margin, echogenic foci", detail: "TR1=benign, TR2=not suspicious, TR3=mildly suspicious, TR4=moderately suspicious, TR5=highly suspicious", critical: false },
    ]},
    { sectionName: "Left Thyroid Lobe", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "thyroid_lt_0", label: "Longitudinal and transverse views — measure length, width, AP diameter", detail: "", critical: false },
      { id: "thyroid_lt_1", label: "Parenchymal echogenicity and vascularity", detail: "", critical: false },
      { id: "thyroid_lt_2", label: "Nodule characterization per ACR TI-RADS", detail: "", critical: false },
    ]},
    { sectionName: "Isthmus", probe: "High-frequency linear 10–18 MHz; transverse midline", items: [
      { id: "thyroid_isth_0", label: "AP thickness of isthmus", detail: "Normal <3 mm; >5 mm = enlarged (Hashimoto's, goiter)", critical: false },
      { id: "thyroid_isth_1", label: "Pyramidal lobe — assess if visible", detail: "", critical: false },
    ]},
    { sectionName: "Cervical Lymph Nodes", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "thyroid_ln_0", label: "Bilateral cervical chain levels II–VI — size, shape, echogenicity, vascularity", detail: "Suspicious: round shape, loss of fatty hilum, cystic change, microcalcifications", critical: true },
      { id: "thyroid_ln_1", label: "Short-axis diameter of largest node", detail: "Short axis >1 cm = abnormal; <1 cm with suspicious features = biopsy consideration", critical: false },
    ]},
  ],
  scrotum: [
    { sectionName: "Right Testis", probe: "High-frequency linear 10–18 MHz; patient supine, towel under scrotum", items: [
      { id: "scrotum_rt_0", label: "Longitudinal and transverse views — measure length, width, AP diameter", detail: "Normal adult testis: 3–5 cm × 2–3 cm × 2–3 cm", critical: false },
      { id: "scrotum_rt_1", label: "Parenchymal echogenicity — homogeneous medium-level echoes (normal)", detail: "Focal hypoechoic lesion = malignancy until proven otherwise", critical: true },
      { id: "scrotum_rt_2", label: "Color Doppler — symmetric vascularity bilaterally", detail: "Absent flow in symptomatic patient = torsion until proven otherwise", critical: true },
      { id: "scrotum_rt_3", label: "Epididymis — head (globus major), body, tail; size and echogenicity", detail: "Normal epididymal head <12 mm; enlarged + hyperemic = epididymitis", critical: false },
    ]},
    { sectionName: "Left Testis", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "scrotum_lt_0", label: "Longitudinal and transverse views — measure length, width, AP diameter", detail: "", critical: false },
      { id: "scrotum_lt_1", label: "Parenchymal echogenicity and focal lesions", detail: "", critical: true },
      { id: "scrotum_lt_2", label: "Color Doppler — compare to right side", detail: "", critical: true },
      { id: "scrotum_lt_3", label: "Epididymis — head, body, tail", detail: "", critical: false },
    ]},
    { sectionName: "Extratesticular Findings", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "scrotum_extra_0", label: "Hydrocele — simple vs complex fluid", detail: "Septations or debris = hematocele, pyocele, or malignant effusion", critical: false },
      { id: "scrotum_extra_1", label: "Varicocele — dilated pampiniform plexus >2–3 mm, augments with Valsalva", detail: "Grade I: palpable only with Valsalva; Grade III: visible at rest", critical: false },
      { id: "scrotum_extra_2", label: "Spermatocele / epididymal cyst — location, size", detail: "", critical: false },
      { id: "scrotum_extra_3", label: "Scrotal wall — thickening, edema, calcifications", detail: "", critical: false },
    ]},
  ],
  breast: [
    { sectionName: "Right Breast — Systematic Survey", probe: "High-frequency linear 10–18 MHz; patient supine, ipsilateral arm raised", items: [
      { id: "breast_rt_0", label: "Radial and anti-radial scan of all four quadrants (clock-face method)", detail: "Document each quadrant: UOQ, UIQ, LOQ, LIQ", critical: false },
      { id: "breast_rt_1", label: "Retroareolar region and nipple", detail: "", critical: false },
      { id: "breast_rt_2", label: "Axillary tail (tail of Spence)", detail: "", critical: false },
      { id: "breast_rt_3", label: "Axillary lymph nodes — cortical thickness, hilum", detail: "Cortex >3 mm or absent hilum = suspicious", critical: true },
    ]},
    { sectionName: "Left Breast — Systematic Survey", probe: "High-frequency linear 10–18 MHz", items: [
      { id: "breast_lt_0", label: "Radial and anti-radial scan of all four quadrants", detail: "", critical: false },
      { id: "breast_lt_1", label: "Retroareolar region and nipple", detail: "", critical: false },
      { id: "breast_lt_2", label: "Axillary tail", detail: "", critical: false },
      { id: "breast_lt_3", label: "Axillary lymph nodes — cortical thickness, hilum", detail: "", critical: true },
    ]},
    { sectionName: "Lesion Characterization (ACR BI-RADS)", probe: "High-frequency linear 10–18 MHz + SWE if available", items: [
      { id: "breast_lesion_0", label: "Shape: oval / round / irregular", detail: "Irregular shape = BI-RADS 4–5 feature", critical: false },
      { id: "breast_lesion_1", label: "Orientation: parallel (horizontal) vs not parallel (vertical)", detail: "Not parallel (taller-than-wide) = suspicious", critical: true },
      { id: "breast_lesion_2", label: "Margin: circumscribed / not circumscribed (indistinct, angular, microlobulated, spiculated)", detail: "Spiculated margin = BI-RADS 5", critical: true },
      { id: "breast_lesion_3", label: "Echo pattern: anechoic / hyperechoic / complex / hypoechoic / isoechoic / heterogeneous", detail: "", critical: false },
      { id: "breast_lesion_4", label: "Posterior features: no posterior features / enhancement / shadowing / combined", detail: "", critical: false },
      { id: "breast_lesion_5", label: "Calcifications: macrocalcifications / microcalcifications in mass", detail: "Microcalcifications in mass = BI-RADS 4B–5", critical: true },
      { id: "breast_lesion_6", label: "Vascularity: color Doppler — internal vs peripheral", detail: "", critical: false },
    ]},
  ],
  ob1: [
    { sectionName: "Gestational Sac", probe: "Transabdominal 3–5 MHz or transvaginal 5–9 MHz", items: [
      { id: "ob1_gs_0", label: "Mean sac diameter (MSD) — average of 3 orthogonal measurements", detail: "MSD <25 mm without yolk sac = possible failed pregnancy", critical: false },
      { id: "ob1_gs_1", label: "Location — intrauterine vs adnexal (ectopic)", detail: "Absence of IUP with positive βhCG = ectopic until proven otherwise", critical: true },
      { id: "ob1_gs_2", label: "Shape — round/oval (normal) vs irregular (abnormal)", detail: "", critical: false },
    ]},
    { sectionName: "Yolk Sac", probe: "Transvaginal 5–9 MHz preferred", items: [
      { id: "ob1_ys_0", label: "Presence and size — measure maximum diameter", detail: "Normal 3–6 mm; absent when MSD >25 mm = failed pregnancy", critical: true },
      { id: "ob1_ys_1", label: "Shape — round (normal) vs irregular/calcified (abnormal)", detail: "", critical: false },
    ]},
    { sectionName: "Embryo / CRL", probe: "Transvaginal 5–9 MHz preferred", items: [
      { id: "ob1_crl_0", label: "Crown-rump length (CRL) — measure 3 times, use largest", detail: "CRL ≥7 mm without cardiac activity = embryonic demise", critical: true },
      { id: "ob1_crl_1", label: "Cardiac activity — M-mode rate (normal 110–160 bpm)", detail: "FHR <100 bpm at 6–8 weeks = poor prognosis", critical: true },
      { id: "ob1_crl_2", label: "Embryo morphology — appropriate for gestational age", detail: "", critical: false },
    ]},
    { sectionName: "Nuchal Translucency (NT)", probe: "Transvaginal 5–9 MHz; CRL 45–84 mm (11+0 to 13+6 weeks)", items: [
      { id: "ob1_nt_0", label: "NT measurement — neutral head position, magnify to fill screen, inner-to-inner", detail: "Normal NT <3.0 mm; ≥3.5 mm = increased risk for chromosomal abnormality", critical: true },
      { id: "ob1_nt_1", label: "Nasal bone — present (normal) vs absent (T21 risk)", detail: "", critical: false },
      { id: "ob1_nt_2", label: "Ductus venosus waveform — absent/reversed A-wave = cardiac defect risk", detail: "", critical: false },
    ]},
    { sectionName: "Uterus and Adnexa", probe: "Transabdominal or transvaginal", items: [
      { id: "ob1_uterus_0", label: "Uterine size, shape, and myometrium — fibroids, anomalies", detail: "", critical: false },
      { id: "ob1_uterus_1", label: "Cervical length if indicated (≥16 weeks)", detail: "Short cervix <25 mm = preterm birth risk", critical: false },
      { id: "ob1_adnexa_0", label: "Bilateral adnexa — corpus luteum, free fluid, adnexal masses", detail: "", critical: false },
    ]},
  ],
  ob23: [
    { sectionName: "Fetal Biometry", probe: "Curvilinear 2–5 MHz; patient supine", items: [
      { id: "ob23_bio_0", label: "Biparietal diameter (BPD) — outer-to-inner at level of thalami and cavum septi pellucidi", detail: "", critical: false },
      { id: "ob23_bio_1", label: "Head circumference (HC) — ellipse around outer calvarium", detail: "", critical: false },
      { id: "ob23_bio_2", label: "Abdominal circumference (AC) — at level of stomach and umbilical vein/ductus venosus junction", detail: "AC most sensitive biometric parameter for IUGR", critical: true },
      { id: "ob23_bio_3", label: "Femur length (FL) — longest ossified diaphysis, exclude epiphyses", detail: "", critical: false },
      { id: "ob23_bio_4", label: "Estimated fetal weight (EFW) — Hadlock formula", detail: "", critical: false },
    ]},
    { sectionName: "Fetal Head and Brain", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_head_0", label: "Lateral ventricles — atrial width at level of glomus of choroid plexus", detail: "Normal <10 mm; 10–15 mm = mild ventriculomegaly; >15 mm = severe", critical: true },
      { id: "ob23_head_1", label: "Cerebellum — transverse diameter and vermis", detail: "Banana sign = Chiari II malformation (spina bifida)", critical: true },
      { id: "ob23_head_2", label: "Cisterna magna — AP depth", detail: "Normal 2–10 mm; >10 mm = Dandy-Walker or mega cisterna magna", critical: false },
      { id: "ob23_head_3", label: "Cavum septi pellucidi — present (normal) vs absent", detail: "Absent CSP = agenesis of corpus callosum, septo-optic dysplasia", critical: false },
      { id: "ob23_head_4", label: "Nuchal fold (15–22 weeks) — measure from outer calvarium to skin", detail: "≥6 mm = increased risk for trisomy 21", critical: true },
    ]},
    { sectionName: "Fetal Face", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_face_0", label: "Profile — nasal bone, forehead, chin", detail: "Absent nasal bone = T21 risk", critical: false },
      { id: "ob23_face_1", label: "Lips — coronal view for cleft lip", detail: "", critical: false },
      { id: "ob23_face_2", label: "Orbits — bilateral, symmetric", detail: "", critical: false },
    ]},
    { sectionName: "Fetal Chest and Heart", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_heart_0", label: "4-chamber view — cardiac axis (45° ± 20°), size (1/3 chest area), symmetry", detail: "Levocardia normal; dextrocardia = situs inversus or cardiac anomaly", critical: true },
      { id: "ob23_heart_1", label: "LVOT — aorta arising from left ventricle, crosses pulmonary artery", detail: "", critical: true },
      { id: "ob23_heart_2", label: "RVOT — pulmonary artery arising from right ventricle", detail: "", critical: true },
      { id: "ob23_heart_3", label: "3-vessel view — PA, Ao, SVC in correct size and alignment", detail: "", critical: false },
      { id: "ob23_chest_0", label: "Lungs — echogenicity, pleural effusion, masses", detail: "", critical: false },
      { id: "ob23_chest_1", label: "Diaphragm — intact (no herniation)", detail: "Bowel in chest = congenital diaphragmatic hernia", critical: true },
    ]},
    { sectionName: "Fetal Abdomen", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_abd_0", label: "Stomach — present and filled with fluid in left upper quadrant", detail: "Absent stomach = esophageal atresia, TE fistula, or swallowing disorder", critical: true },
      { id: "ob23_abd_1", label: "Abdominal wall — intact cord insertion, no omphalocele/gastroschisis", detail: "", critical: true },
      { id: "ob23_abd_2", label: "Kidneys — bilateral, normal echogenicity, no hydronephrosis", detail: "Renal pelvis AP >7 mm (2nd trimester) = pyelectasis", critical: false },
      { id: "ob23_abd_3", label: "Bladder — present and filled", detail: "Absent bladder = renal agenesis, severe LUTO, or oligohydramnios", critical: true },
    ]},
    { sectionName: "Fetal Spine", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_spine_0", label: "Longitudinal view — intact posterior elements, skin covering", detail: "", critical: true },
      { id: "ob23_spine_1", label: "Transverse views at cervical, thoracic, lumbar, sacral levels", detail: "Open neural tube defect: disrupted posterior elements with skin defect", critical: true },
      { id: "ob23_spine_2", label: "Lemon sign — frontal bossing of calvarium (Chiari II)", detail: "", critical: false },
    ]},
    { sectionName: "Placenta and Amniotic Fluid", probe: "Curvilinear 2–5 MHz", items: [
      { id: "ob23_plac_0", label: "Placental location — anterior, posterior, fundal, previa", detail: "Placenta previa: placental edge ≤20 mm from internal os", critical: true },
      { id: "ob23_plac_1", label: "Placental grade and echogenicity", detail: "", critical: false },
      { id: "ob23_plac_2", label: "Amniotic fluid index (AFI) or single deepest pocket (SDP)", detail: "AFI <5 cm = oligohydramnios; AFI >25 cm = polyhydramnios. SDP <2 cm = oligohydramnios", critical: true },
      { id: "ob23_plac_3", label: "Umbilical cord — 3 vessels (2 arteries, 1 vein), insertion site", detail: "2-vessel cord = single umbilical artery; associated with IUGR and anomalies", critical: false },
    ]},
  ],
  pelvic_gyn: [
    { sectionName: "Uterus (Transabdominal)", probe: "Curvilinear 3–5 MHz; full bladder required", items: [
      { id: "pgyn_ta_uterus_0", label: "Longitudinal and transverse views — length, width, AP diameter", detail: "Normal premenopausal uterus: length 6–9 cm, AP 3–5 cm", critical: false },
      { id: "pgyn_ta_uterus_1", label: "Endometrial thickness — measure double-layer in longitudinal", detail: "Postmenopausal: >4–5 mm = further evaluation; premenopausal varies by cycle phase", critical: true },
      { id: "pgyn_ta_uterus_2", label: "Myometrium — fibroids, adenomyosis, anomalies", detail: "", critical: false },
      { id: "pgyn_ta_uterus_3", label: "Cervix — length, nabothian cysts, masses", detail: "", critical: false },
    ]},
    { sectionName: "Adnexa and Ovaries (Transabdominal)", probe: "Curvilinear 3–5 MHz", items: [
      { id: "pgyn_ta_ovary_0", label: "Bilateral ovaries — size (length × width × AP), echogenicity, follicles", detail: "Normal ovary: 3–5 cm³ volume; postmenopausal <3 cm³", critical: false },
      { id: "pgyn_ta_ovary_1", label: "Adnexal masses — size, composition (cystic/solid/complex), vascularity", detail: "Simple cyst <3 cm = likely physiologic; complex = further evaluation", critical: true },
      { id: "pgyn_ta_ovary_2", label: "Free fluid in cul-de-sac — simple vs complex", detail: "Complex free fluid = hemorrhage, infection, malignancy", critical: false },
    ]},
    { sectionName: "Uterus (Transvaginal)", probe: "Endocavitary 5–9 MHz; empty bladder", items: [
      { id: "pgyn_tvs_uterus_0", label: "Longitudinal and transverse views — endometrial thickness and texture", detail: "", critical: false },
      { id: "pgyn_tvs_uterus_1", label: "Junctional zone — homogeneous vs thickened/irregular (adenomyosis)", detail: "JZ >12 mm = adenomyosis", critical: false },
      { id: "pgyn_tvs_uterus_2", label: "IUD location — position relative to endometrial cavity", detail: "", critical: false },
    ]},
    { sectionName: "Adnexa and Ovaries (Transvaginal)", probe: "Endocavitary 5–9 MHz", items: [
      { id: "pgyn_tvs_ovary_0", label: "Bilateral ovaries — follicle count, dominant follicle, corpus luteum", detail: "AFC (antral follicle count) for fertility assessment", critical: false },
      { id: "pgyn_tvs_ovary_1", label: "Ovarian morphology — PCOS criteria: ≥20 follicles per ovary or volume >10 cm³", detail: "", critical: false },
      { id: "pgyn_tvs_ovary_2", label: "Adnexal masses — IOTA simple rules or O-RADS classification", detail: "O-RADS 1=normal; 2=almost certainly benign; 3=low risk; 4=intermediate; 5=high risk", critical: true },
      { id: "pgyn_tvs_ovary_3", label: "Cul-de-sac — free fluid, endometrioma, adhesions", detail: "", critical: false },
    ]},
  ],
};

// ─── Helper: generate a unique item ID ───────────────────────────────────────
function genId(module: string, sectionName: string) {
  return `${module}_${sectionName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  critical: boolean;
  sortOrder: number;
}

interface SectionData {
  id?: number;
  sectionName: string;
  probe: string;
  items: ChecklistItem[];
  sortOrder: number;
  isDirty: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function NavigatorEditor() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const authLoading = false;
  const [selectedModule, setSelectedModule] = useState("abdominal");
  const [sections, setSections] = useState<SectionData[]>([]);
  const [expandedSection, setExpandedSection] = useState<number | null>(0);
  const [savingSection, setSavingSection] = useState<number | null>(null);
  const [deletingSection, setDeletingSection] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") navigate("/");
  }, [user, authLoading, navigate]);

  const { data: modules } = trpc.navigatorAdmin.listModules.useQuery();
  const { data: dbSections, refetch: refetchSections } = trpc.navigatorAdmin.listSections.useQuery(
    { module: selectedModule },
    { enabled: !!selectedModule }
  );

  const upsertSection = trpc.navigatorAdmin.upsertSection.useMutation();
  const deleteSection = trpc.navigatorAdmin.deleteSection.useMutation();
  const reorderSections = trpc.navigatorAdmin.reorderSections.useMutation();

  // Merge DB data with static seed data
  useEffect(() => {
    if (!dbSections) return;

    const staticData = STATIC_NAVIGATOR_DATA[selectedModule] ?? [];

    if (dbSections.length > 0) {
      // Use DB data
      setSections(
        dbSections.map((s, idx) => ({
          id: s.id,
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: item.sortOrder ?? i })),
          sortOrder: s.sortOrder,
          isDirty: false,
        }))
      );
    } else {
      // Use static seed data as starting point
      setSections(
        staticData.map((s, idx) => ({
          sectionName: s.sectionName,
          probe: s.probe,
          items: s.items.map((item, i) => ({ ...item, sortOrder: i })),
          sortOrder: idx,
          isDirty: false,
        }))
      );
    }
    setExpandedSection(0);
  }, [dbSections, selectedModule]);

  const markDirty = useCallback((sectionIdx: number) => {
    setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, isDirty: true } : s));
  }, []);

  const handleSaveSection = async (sectionIdx: number) => {
    const section = sections[sectionIdx];
    setSavingSection(sectionIdx);
    try {
      await upsertSection.mutateAsync({
        module: selectedModule,
        sectionName: section.sectionName,
        probe: section.probe,
        items: section.items,
        sortOrder: section.sortOrder,
      });
      setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, isDirty: false } : s));
      await refetchSections();
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < sections.length; i++) {
      await handleSaveSection(i);
    }
  };

  const handleDeleteSection = async (sectionIdx: number) => {
    const section = sections[sectionIdx];
    if (!section.id) {
      // Not yet in DB — just remove from local state
      setSections(prev => prev.filter((_, i) => i !== sectionIdx));
      return;
    }
    if (!confirm(`Delete section "${section.sectionName}"? This cannot be undone.`)) return;
    setDeletingSection(sectionIdx);
    try {
      await deleteSection.mutateAsync({ id: section.id });
      await refetchSections();
    } finally {
      setDeletingSection(null);
    }
  };

  const handleAddSection = () => {
    const newSection: SectionData = {
      sectionName: "New Section",
      probe: "",
      items: [],
      sortOrder: sections.length,
      isDirty: true,
    };
    setSections(prev => [...prev, newSection]);
    setExpandedSection(sections.length);
  };

  const handleMoveSection = async (sectionIdx: number, direction: "up" | "down") => {
    const newSections = [...sections];
    const targetIdx = direction === "up" ? sectionIdx - 1 : sectionIdx + 1;
    if (targetIdx < 0 || targetIdx >= newSections.length) return;
    [newSections[sectionIdx], newSections[targetIdx]] = [newSections[targetIdx], newSections[sectionIdx]];
    const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i }));
    setSections(reordered);
    setExpandedSection(targetIdx);
    // Persist reorder if all sections are in DB
    const allInDb = reordered.every(s => s.id);
    if (allInDb) {
      await reorderSections.mutateAsync({
        module: selectedModule,
        orderedIds: reordered.map(s => s.id!),
      });
    }
  };

  const handleUpdateSectionField = (sectionIdx: number, field: "sectionName" | "probe", value: string) => {
    setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, [field]: value, isDirty: true } : s));
  };

  const handleAddItem = (sectionIdx: number) => {
    const section = sections[sectionIdx];
    const newItem: ChecklistItem = {
      id: genId(selectedModule, section.sectionName),
      label: "",
      detail: "",
      critical: false,
      sortOrder: section.items.length,
    };
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx ? { ...s, items: [...s.items, newItem], isDirty: true } : s
    ));
    setEditingItem(newItem.id);
  };

  const handleUpdateItem = (sectionIdx: number, itemId: string, field: keyof ChecklistItem, value: string | boolean | number) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, items: s.items.map(item => item.id === itemId ? { ...item, [field]: value } : item), isDirty: true }
        : s
    ));
  };

  const handleDeleteItem = (sectionIdx: number, itemId: string) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, items: s.items.filter(item => item.id !== itemId).map((item, idx) => ({ ...item, sortOrder: idx })), isDirty: true }
        : s
    ));
  };

  const handleMoveItem = (sectionIdx: number, itemIdx: number, direction: "up" | "down") => {
    const section = sections[sectionIdx];
    const newItems = [...section.items];
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[itemIdx], newItems[targetIdx]] = [newItems[targetIdx], newItems[itemIdx]];
    const reordered = newItems.map((item, idx) => ({ ...item, sortOrder: idx }));
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx ? { ...s, items: reordered, isDirty: true } : s
    ));
  };

  const handleSeedModule = async () => {
    if (!confirm(`Seed all sections for "${selectedModule}" to the database? This will overwrite any existing DB data for this module.`)) return;
    setIsSeeding(true);
    try {
      for (let i = 0; i < sections.length; i++) {
        await upsertSection.mutateAsync({
          module: selectedModule,
          sectionName: sections[i].sectionName,
          probe: sections[i].probe,
          items: sections[i].items,
          sortOrder: i,
        });
      }
      await refetchSections();
    } finally {
      setIsSeeding(false);
    }
  };

  const dirtyCount = sections.filter(s => s.isDirty).length;

  if (authLoading) return <Layout><div className="container py-10 text-center text-gray-400">Loading…</div></Layout>;
  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }} className="py-8">
        <div className="container">
          <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "Merriweather, serif" }}>
            Navigator Editor
          </h1>
          <p className="text-[#4ad9e0] text-sm mt-1">Edit protocol checklists for all Navigator modules</p>
        </div>
      </div>

      <div className="container py-6">
        {/* Module selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(modules ?? []).map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedModule(m.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedModule === m.key ? "#189aa1" : "white",
                color: selectedModule === m.key ? "white" : "#189aa1",
                border: `1px solid ${selectedModule === m.key ? "#189aa1" : "#189aa1" + "40"}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-700">
              {sections.length} sections
              {dirtyCount > 0 && (
                <span className="ml-2 text-amber-600">· {dirtyCount} unsaved</span>
              )}
            </span>
          </div>
          {dirtyCount > 0 && (
            <Button
              size="sm"
              onClick={handleSaveAll}
              style={{ background: "#189aa1", color: "white" }}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save All Changes
            </Button>
          )}
          {sections.length > 0 && !sections[0]?.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedModule}
              disabled={isSeeding}
              className="border-[#189aa1] text-[#189aa1]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSeeding ? "animate-spin" : ""}`} />
              {isSeeding ? "Seeding…" : "Seed to Database"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSection}
            className="border-[#189aa1] text-[#189aa1]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Section
          </Button>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((section, si) => {
            const isExpanded = expandedSection === si;
            return (
              <div key={si} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${section.isDirty ? "border-amber-300" : "border-gray-100"}`}>
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <input
                      className="font-bold text-sm text-gray-800 bg-transparent border-none outline-none w-full"
                      style={{ fontFamily: "Merriweather, serif" }}
                      value={section.sectionName}
                      onChange={e => handleUpdateSectionField(si, "sectionName", e.target.value)}
                      placeholder="Section name"
                    />
                    <input
                      className="text-xs text-gray-400 bg-transparent border-none outline-none w-full mt-0.5"
                      value={section.probe}
                      onChange={e => handleUpdateSectionField(si, "probe", e.target.value)}
                      placeholder="Probe / approach description"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {section.isDirty && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">unsaved</Badge>
                    )}
                    <span className="text-xs text-gray-400 mr-1">{section.items.length} items</span>
                    <button onClick={() => handleMoveSection(si, "up")} disabled={si === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <ArrowUp className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={() => handleMoveSection(si, "down")} disabled={si === sections.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <ArrowDown className="w-3 h-3 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleSaveSection(si)}
                      disabled={savingSection === si || !section.isDirty}
                      className="p-1.5 rounded hover:bg-green-100 disabled:opacity-30 text-green-600"
                      title="Save section"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSection(si)}
                      disabled={deletingSection === si}
                      className="p-1.5 rounded hover:bg-red-100 text-red-400"
                      title="Delete section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExpandedSection(isExpanded ? null : si)} className="p-1.5 rounded hover:bg-gray-200">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                </div>

                {/* Items */}
                {isExpanded && (
                  <div>
                    {section.items.map((item, ii) => {
                      const isEditingThis = editingItem === item.id;
                      return (
                        <div key={item.id} className={`border-b border-gray-50 last:border-0 ${item.critical ? "bg-amber-50/30" : ""}`}>
                          <div className="flex items-start gap-2 px-4 py-2.5">
                            <GripVertical className="w-4 h-4 text-gray-200 flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              {isEditingThis ? (
                                <div className="space-y-1.5">
                                  <Input
                                    className="text-sm h-8"
                                    value={item.label}
                                    onChange={e => handleUpdateItem(si, item.id, "label", e.target.value)}
                                    placeholder="Checklist item label"
                                    autoFocus
                                  />
                                  <Textarea
                                    className="text-xs min-h-[60px] resize-none"
                                    value={item.detail}
                                    onChange={e => handleUpdateItem(si, item.id, "detail", e.target.value)}
                                    placeholder="Detail / explanation (optional)"
                                  />
                                  <label className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={item.critical}
                                      onChange={e => handleUpdateItem(si, item.id, "critical", e.target.checked)}
                                      className="accent-amber-500"
                                    />
                                    <AlertTriangle className="w-3 h-3" />
                                    Mark as critical item
                                  </label>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    {item.critical && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                                    <span className={`text-sm font-medium ${item.label ? "text-gray-700" : "text-gray-300 italic"}`}>
                                      {item.label || "Empty label — click edit"}
                                    </span>
                                  </div>
                                  {item.detail && (
                                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => handleMoveItem(si, ii, "up")} disabled={ii === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ArrowUp className="w-3 h-3 text-gray-400" />
                              </button>
                              <button onClick={() => handleMoveItem(si, ii, "down")} disabled={ii === section.items.length - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ArrowDown className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => setEditingItem(isEditingThis ? null : item.id)}
                                className="p-1.5 rounded hover:bg-blue-100 text-blue-500"
                                title={isEditingThis ? "Done editing" : "Edit item"}
                              >
                                {isEditingThis ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteItem(si, item.id)}
                                className="p-1.5 rounded hover:bg-red-100 text-red-400"
                                title="Delete item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add item button */}
                    <div className="px-4 py-2.5 bg-gray-50/50">
                      <button
                        onClick={() => handleAddItem(si)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:text-[#0e7a80] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add checklist item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sections.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No sections found for this module.</p>
              <button onClick={handleAddSection} className="mt-3 text-[#189aa1] text-sm font-semibold hover:underline">
                + Add first section
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
