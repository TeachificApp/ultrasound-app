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
import { useState, useEffect, useCallback, useRef } from "react";
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

  // ── OB FIRST TRIMESTER ──────────────────────────────────────────────────────
  ob1: [
    { sectionName: "Gestational Sac", probe: "Transabdominal or transvaginal", items: [
      { id: "ob1_gs_0", label: "Presence, location, and number of gestational sacs", detail: "Intrauterine vs ectopic; single vs multiple", critical: true },
      { id: "ob1_gs_1", label: "Mean sac diameter (MSD) — average of 3 orthogonal measurements", detail: "MSD ≥25 mm without embryo = failed pregnancy (anembryonic)", critical: true },
      { id: "ob1_gs_2", label: "Yolk sac — presence, size, morphology", detail: "Normal yolk sac 3–6 mm; absent or >6 mm = poor prognosis", critical: false },
    ]},
    { sectionName: "Embryo / Fetus", probe: "Transabdominal or transvaginal", items: [
      { id: "ob1_emb_0", label: "Presence of embryo and cardiac activity", detail: "Embryo ≥7 mm CRL without cardiac activity = failed pregnancy", critical: true },
      { id: "ob1_emb_1", label: "Crown-rump length (CRL) — longest axis, neutral position", detail: "CRL is the most accurate biometric parameter for GA in 1st trimester", critical: true },
      { id: "ob1_emb_2", label: "Fetal heart rate (FHR)", detail: "Normal FHR 6–8 wks: 90–110 bpm; 9–12 wks: 150–175 bpm; <100 bpm = poor prognosis", critical: true },
      { id: "ob1_emb_3", label: "Fetal number and chorionicity (if multiple)", detail: "Dichorionic = twin peak sign; monochorionic = T-sign", critical: true },
    ]},
    { sectionName: "Nuchal Translucency (NT)", probe: "Transabdominal or transvaginal, midsagittal plane", items: [
      { id: "ob1_nt_0", label: "NT measurement — maximum thickness of subcutaneous space", detail: "Measure at 11+0 to 13+6 wks (CRL 45–84 mm). NT ≥3.0 mm = increased risk T21/CHD", critical: true },
      { id: "ob1_nt_1", label: "Nasal bone — present or absent", detail: "Absent nasal bone at 11–14 wks: increased risk for trisomy 21", critical: false },
    ]},
    { sectionName: "Uterus and Adnexa", probe: "Transabdominal or transvaginal", items: [
      { id: "ob1_uterus_0", label: "Uterine morphology — fibroids, anomalies", detail: "Submucosal fibroids may affect implantation", critical: false },
      { id: "ob1_uterus_1", label: "Adnexa — corpus luteum, ovarian cysts, ectopic", detail: "Corpus luteum is normal in 1st trimester. Complex adnexal mass requires further evaluation.", critical: false },
    ]},
  ],

  // ── OB SECOND / THIRD TRIMESTER ─────────────────────────────────────────────
  ob23: [
    { sectionName: "Head and Neck", probe: "Axial transventricular and transcerebellar planes", items: [
      { id: "ob23_head_0", label: "Lateral cerebral ventricles — atrial width (normal <10 mm)", detail: "Ventriculomegaly: mild 10–12 mm, moderate 13–15 mm, severe >15 mm", critical: true },
      { id: "ob23_head_1", label: "Midline falx and cavum septi pellucidi (CSP)", detail: "Absent CSP = agenesis of corpus callosum, holoprosencephaly, or septo-optic dysplasia", critical: true },
      { id: "ob23_head_2", label: "BPD and head circumference (HC)", detail: "Measure BPD outer-to-inner at level of thalami and CSP", critical: true },
      { id: "ob23_head_3", label: "Cerebellum — transverse diameter, vermis, cisterna magna (2–10 mm)", detail: "Banana sign = spina bifida; cisterna magna >10 mm = Dandy-Walker", critical: true },
      { id: "ob23_head_4", label: "Nuchal fold (15–22 wks) — normal <6 mm", detail: "NF ≥6 mm at 15–22 wks = increased risk for trisomy 21", critical: true },
    ]},
    { sectionName: "Face", probe: "Coronal, sagittal, and axial planes", items: [
      { id: "ob23_face_0", label: "Upper lip — intact (rule out cleft lip)", detail: "Coronal view of nose and lips; cleft lip ± palate is the most common facial anomaly", critical: true },
      { id: "ob23_face_1", label: "Profile — nasal bone, forehead, chin", detail: "Absent nasal bone: T21 risk. Micrognathia: T18, Pierre Robin.", critical: false },
    ]},
    { sectionName: "Chest", probe: "Axial 4-chamber plane and outflow tracts", items: [
      { id: "ob23_chest_0", label: "Cardiac activity — regular rate and rhythm", detail: "Normal FHR 120–160 bpm at 20 wks", critical: true },
      { id: "ob23_chest_1", label: "4-chamber view — chamber size, AV valves, IVS, IAS", detail: "Apex toward left anterior chest wall; cardiac axis 45° ± 20°", critical: true },
      { id: "ob23_chest_2", label: "LVOT — aorta arising from LV, crosses pulmonary artery", detail: "Aortic-mitral continuity; no VSD", critical: true },
      { id: "ob23_chest_3", label: "RVOT and 3-vessel view", detail: "PA slightly larger than Ao; SVC smallest; normal V-shape of ductus + aortic arch", critical: true },
      { id: "ob23_chest_4", label: "Diaphragm integrity", detail: "CDH: stomach/bowel in chest, mediastinal shift, absent stomach bubble", critical: true },
    ]},
    { sectionName: "Abdomen", probe: "Axial and longitudinal planes", items: [
      { id: "ob23_abd_0", label: "Stomach — presence, size, and situs", detail: "Absent stomach: esophageal atresia, swallowing disorder", critical: true },
      { id: "ob23_abd_1", label: "Abdominal circumference (AC) measurement", detail: "Most sensitive biometric parameter for IUGR", critical: true },
      { id: "ob23_abd_2", label: "Kidneys — bilateral presence, size, echogenicity, pelvis", detail: "Renal pelvis AP >4 mm at 20 wks = pyelectasis", critical: true },
      { id: "ob23_abd_3", label: "Urinary bladder — present and normal size", detail: "Absent bladder: bilateral renal agenesis, bladder exstrophy", critical: true },
      { id: "ob23_abd_4", label: "Cord insertion site — normal (rule out omphalocele, gastroschisis)", detail: "Omphalocele: covered by membrane. Gastroschisis: uncovered, right of cord.", critical: true },
    ]},
    { sectionName: "Spine", probe: "Sagittal, coronal, and axial planes", items: [
      { id: "ob23_spine_0", label: "Lumbar and sacral spine — intact, skin covering", detail: "Open spina bifida: absent skin covering, lemon sign, banana sign", critical: true },
      { id: "ob23_spine_1", label: "Lemon sign and banana sign", detail: "Both signs indicate open neural tube defect in >95% of cases at 16–24 wks", critical: true },
    ]},
    { sectionName: "Extremities", probe: "Long axis and transverse planes", items: [
      { id: "ob23_ext_0", label: "Femur length (FL) — longest axis, calcified diaphysis only", detail: "Short FL: skeletal dysplasia, T21, IUGR", critical: true },
      { id: "ob23_ext_1", label: "Hands and feet — number of digits, position", detail: "Polydactyly: T13. Overlapping fingers: T18. Clubfoot: neural tube defect, T18.", critical: false },
    ]},
    { sectionName: "Placenta", probe: "Transabdominal or transvaginal", items: [
      { id: "ob23_plac_0", label: "Placental location and relationship to internal os", detail: "Placenta previa: placenta overlies or within 2 cm of internal os", critical: true },
      { id: "ob23_plac_1", label: "Cord insertion site — central, marginal, or velamentous", detail: "Velamentous cord insertion: unprotected vessels at risk for vasa previa", critical: true },
    ]},
    { sectionName: "Amniotic Fluid", probe: "Transabdominal", items: [
      { id: "ob23_af_0", label: "AFI or maximum vertical pocket (MVP)", detail: "AFI: normal 8–24 cm; oligohydramnios <5 cm; polyhydramnios >24 cm. MVP: normal 2–8 cm.", critical: true },
    ]},
    { sectionName: "Biometry", probe: "Axial and longitudinal planes", items: [
      { id: "ob23_biom_0", label: "BPD and HC", detail: "Measure BPD outer-to-inner at level of thalami and CSP", critical: true },
      { id: "ob23_biom_1", label: "Abdominal circumference (AC)", detail: "At level of umbilical vein–portal sinus junction", critical: true },
      { id: "ob23_biom_2", label: "Femur length (FL)", detail: "Calcified diaphysis only", critical: true },
      { id: "ob23_biom_3", label: "Estimated fetal weight (EFW) — Hadlock formula", detail: "EFW <10th percentile = SGA; <3rd percentile = severe SGA/IUGR", critical: true },
    ]},
    { sectionName: "Maternal Anatomy", probe: "Transabdominal or transvaginal", items: [
      { id: "ob23_mat_0", label: "Cervical length (transvaginal when indicated)", detail: "CL <25 mm at 16–24 wks = increased preterm birth risk", critical: true },
      { id: "ob23_mat_1", label: "Uterus — fibroids, anomalies, lower uterine segment", detail: "", critical: false },
    ]},
  ],

  // ── ABDOMINAL VASCULAR ───────────────────────────────────────────────────────
  abdominal_vascular: [
    { sectionName: "Portal Vein — Main", probe: "Curvilinear 2–5 MHz — transverse/oblique at porta hepatis", items: [
      { id: "av_pv_main_0", label: "Main portal vein diameter (normal <13 mm)", detail: "MPV diameter >13 mm = portal hypertension; >15 mm = significant dilation", critical: true },
      { id: "av_pv_main_1", label: "Portal vein flow direction — hepatopetal vs hepatofugal", detail: "Hepatofugal flow = portal hypertension. Always confirm with color Doppler.", critical: true },
      { id: "av_pv_main_2", label: "Portal vein mean velocity (normal 15–40 cm/s)", detail: "Velocity <12 cm/s = portal hypertension", critical: true },
      { id: "av_pv_main_3", label: "Thrombus — echogenicity, extent, and vascularity", detail: "Tumor thrombus (HCC): arterial flow within thrombus on color/spectral Doppler", critical: true },
    ]},
    { sectionName: "Hepatic Veins", probe: "Curvilinear 2–5 MHz — subcostal or intercostal, angled cephalad", items: [
      { id: "av_hv_0", label: "Hepatic vein waveform — triphasic (S, D, A waves)", detail: "Normal: triphasic. Monophasic: cirrhosis, congestion, Budd-Chiari.", critical: true },
      { id: "av_hv_1", label: "Hepatic vein patency — right, middle, left", detail: "Absent or reversed flow = Budd-Chiari syndrome or severe right heart failure", critical: true },
    ]},
    { sectionName: "Hepatic Artery", probe: "Curvilinear 2–5 MHz — transverse/oblique at porta hepatis", items: [
      { id: "av_ha_0", label: "Hepatic artery waveform and RI (normal 0.55–0.70)", detail: "RI >0.80 = stenosis or rejection (post-transplant)", critical: true },
      { id: "av_ha_1", label: "PSV at hepatic artery origin (normal 60–100 cm/s)", detail: "PSV >200 cm/s = hepatic artery stenosis", critical: false },
    ]},
    { sectionName: "Superior Mesenteric Artery (SMA) — Fasting", probe: "Curvilinear 2–5 MHz — midline longitudinal, patient fasted 4–6 hours", items: [
      { id: "av_sma_0", label: "SMA PSV (fasting normal 100–275 cm/s)", detail: "PSV >275 cm/s fasting = ≥70% stenosis", critical: true },
      { id: "av_sma_1", label: "SMA EDV and waveform morphology", detail: "Fasting SMA: high-resistance (reversed diastolic flow is normal fasting)", critical: true },
    ]},
    { sectionName: "Celiac Axis", probe: "Curvilinear 2–5 MHz — midline transverse at T12/L1 level", items: [
      { id: "av_ca_0", label: "Celiac axis PSV (normal 100–200 cm/s)", detail: "PSV >200 cm/s = ≥70% stenosis", critical: true },
      { id: "av_ca_1", label: "Median arcuate ligament compression (MALS) — respiratory variation", detail: "PSV increases with expiration = MALS. Hook-shaped celiac axis on sagittal view.", critical: false },
    ]},
    { sectionName: "Kidneys — B-mode Survey", probe: "Curvilinear 2–5 MHz — flank approach", items: [
      { id: "av_kid_0", label: "Kidney size — length (normal 9–12 cm)", detail: "Asymmetry >1.5 cm = unilateral renal artery disease", critical: true },
      { id: "av_kid_1", label: "Cortical thickness and echogenicity", detail: "Normal cortical thickness ≥1.0 cm. Increased echogenicity = CKD.", critical: true },
    ]},
    { sectionName: "Main Renal Arteries", probe: "Curvilinear 2–5 MHz — anterior midline or flank approach", items: [
      { id: "av_mra_0", label: "PSV at renal artery origin (>180–200 cm/s = ≥60% stenosis)", detail: "Most sensitive site for detecting renal artery stenosis", critical: true },
      { id: "av_mra_1", label: "Renal-Aortic Ratio (RAR = renal PSV ÷ aortic PSV; ≥3.5 = ≥60% stenosis)", detail: "RAR is particularly useful when absolute PSV is difficult to obtain", critical: true },
    ]},
    { sectionName: "Intrarenal Arteries", probe: "Curvilinear 2–5 MHz — flank approach", items: [
      { id: "av_ira_0", label: "Resistive Index (RI = (PSV−EDV)÷PSV; normal 0.60–0.70)", detail: "RI >0.80 = intrinsic renal parenchymal disease", critical: true },
      { id: "av_ira_1", label: "Acceleration time (AT) — normal <70 ms", detail: "AT >80 ms with parvus et tardus waveform = proximal renal artery stenosis", critical: true },
    ]},
  ],

  // ── AORTA ────────────────────────────────────────────────────────────────────
  aorta: [
    { sectionName: "Proximal Aorta — Longitudinal", probe: "Subxiphoid, sagittal plane", items: [
      { id: "aorta_prox_long_0", label: "Visualize aorta as it passes through the diaphragm", detail: "", critical: false },
      { id: "aorta_prox_long_1", label: "Diameter measurement — anterior-to-posterior (outer wall to outer wall)", detail: "Normal aorta <3 cm; AAA ≥3 cm; intervention threshold ≥5.5 cm (men) or ≥5.0 cm (women)", critical: true },
      { id: "aorta_prox_long_2", label: "Assess for plaque, thrombus, or dissection flap", detail: "", critical: true },
    ]},
    { sectionName: "Proximal Aorta — Transverse", probe: "Subxiphoid, transverse plane", items: [
      { id: "aorta_prox_trans_0", label: "Visualize celiac axis and SMA origins", detail: "Celiac axis at T12/L1; SMA ~1 cm below celiac", critical: false },
      { id: "aorta_prox_trans_1", label: "Transverse diameter measurement (AP and transverse)", detail: "Use the larger measurement for AAA classification", critical: true },
    ]},
    { sectionName: "Mid Aorta — Longitudinal", probe: "Mid-abdomen, sagittal plane", items: [
      { id: "aorta_mid_long_0", label: "Visualize aorta at level of renal arteries", detail: "Assess for juxtarenal or pararenal AAA", critical: true },
      { id: "aorta_mid_long_1", label: "Diameter measurement at renal artery level", detail: "", critical: true },
    ]},
    { sectionName: "Mid Aorta — Transverse", probe: "Mid-abdomen, transverse plane", items: [
      { id: "aorta_mid_trans_0", label: "Visualize renal arteries branching off the aorta", detail: "Use color Doppler to identify renal artery origins", critical: false },
      { id: "aorta_mid_trans_1", label: "Transverse diameter measurement", detail: "", critical: true },
    ]},
    { sectionName: "Distal Aorta — Longitudinal", probe: "Lower abdomen, sagittal plane", items: [
      { id: "aorta_dist_long_0", label: "Visualize aorta to the bifurcation", detail: "Aortic bifurcation at L4; infrarenal AAA is the most common location", critical: true },
      { id: "aorta_dist_long_1", label: "Maximum diameter measurement — infrarenal segment", detail: "", critical: true },
    ]},
    { sectionName: "Distal Aorta — Transverse", probe: "Lower abdomen, transverse plane", items: [
      { id: "aorta_dist_trans_0", label: "Visualize aortic bifurcation into common iliac arteries", detail: "", critical: true },
      { id: "aorta_dist_trans_1", label: "Transverse diameter measurement", detail: "", critical: true },
    ]},
    { sectionName: "Common Iliac Arteries — Longitudinal", probe: "Just inferior to aortic bifurcation, sagittal oblique for each iliac", items: [
      { id: "aorta_cia_long_0", label: "Visualize proximal common iliac arteries (bilateral)", detail: "CIA normal diameter <1.5 cm; CIA aneurysm ≥1.5 cm", critical: true },
      { id: "aorta_cia_long_1", label: "Assess for aneurysmal dilation", detail: "Isolated CIA aneurysm: intervention threshold ≥3.0 cm", critical: true },
    ]},
    { sectionName: "Common Iliac Arteries — Transverse", probe: "Just inferior to aortic bifurcation, transverse plane", items: [
      { id: "aorta_cia_trans_0", label: "Visualize proximal common iliac arteries in transverse", detail: "", critical: false },
      { id: "aorta_cia_trans_1", label: "Assess for aneurysmal dilation or occlusion", detail: "", critical: false },
    ]},
  ],

  // ── PERIPHERAL ARTERIAL ──────────────────────────────────────────────────────
  arterial: [
    { sectionName: "Duplex Ultrasound", probe: "Linear 5–12 MHz — follow artery from groin to ankle; color Doppler throughout", items: [
      { id: "art_dup_0", label: "Common femoral artery (CFA) — PSV and waveform morphology", detail: "Normal CFA: triphasic waveform. Blunted monophasic = proximal (aortoiliac) disease.", critical: true },
      { id: "art_dup_1", label: "Superficial femoral artery (SFA) — PSV at origin, mid, and distal segments", detail: "SFA is the most common site for PAD. PSV ratio >2.0 across stenosis = ≥50% stenosis.", critical: true },
      { id: "art_dup_2", label: "Popliteal artery — PSV and waveform", detail: "Popliteal aneurysm: diameter >1.5 cm. Bilateral in 50%; associated with AAA in 30%.", critical: true },
      { id: "art_dup_3", label: "Tibial arteries (anterior, posterior, peroneal) — patency and PSV", detail: "Assess all 3 tibial arteries for occlusion or stenosis", critical: true },
      { id: "art_dup_4", label: "PSV ratio at stenotic segments (>2.0 = ≥50%; >4.0 = ≥75%)", detail: "", critical: true },
      { id: "art_dup_5", label: "Doppler angle consistency (≤60°)", detail: "", critical: true },
    ]},
    { sectionName: "Segmental Limb Pressures", probe: "Pneumatic cuffs at upper thigh, lower thigh, calf, ankle — CW Doppler probe", items: [
      { id: "art_slp_0", label: "Ankle-Brachial Index (ABI) — bilateral", detail: "Normal 1.00–1.40; mild PAD 0.71–0.90; moderate 0.41–0.70; severe ≤0.40; >1.40 = non-compressible", critical: true },
      { id: "art_slp_1", label: "Segmental pressure measurements (upper thigh, lower thigh, calf, ankle)", detail: "Gradient >20 mmHg between adjacent segments = hemodynamically significant disease", critical: true },
      { id: "art_slp_2", label: "Toe-Brachial Index (TBI) when ABI >1.40", detail: "TBI = toe pressure ÷ brachial pressure; normal ≥0.70", critical: true },
    ]},
    { sectionName: "Pulse Volume Recordings (PVRs)", probe: "Pneumatic cuffs at upper thigh, lower thigh, calf, ankle, metatarsals", items: [
      { id: "art_pvr_0", label: "PVR waveform morphology at each level", detail: "Normal: sharp upstroke, narrow systolic peak, dicrotic notch. Abnormal: rounded peak, absent dicrotic notch.", critical: true },
      { id: "art_pvr_1", label: "Global tissue perfusion assessment", detail: "PVRs reflect global volume changes; useful in patients with calcified vessels", critical: true },
    ]},
    { sectionName: "Photoplethysmography (PPG)", probe: "Infrared sensor applied to digits (toes or fingers)", items: [
      { id: "art_ppg_0", label: "Digital waveform morphology", detail: "Normal: smooth upstroke, rounded peak, dicrotic notch. Abnormal: peaked, flat, or absent.", critical: true },
      { id: "art_ppg_1", label: "Perfusion of measured tissue bed", detail: "Compare bilateral digit waveforms; asymmetry = digital artery occlusion or vasospasm", critical: true },
    ]},
  ],

  // ── POCUS CARDIAC ────────────────────────────────────────────────────────────
  pocus_cardiac: [
    { sectionName: "Parasternal Long Axis (PLAX)", probe: "Phased array 2–4 MHz | 3rd–4th ICS, left sternal border", items: [
      { id: "poc_plax_lv", label: "LV systolic function — visual EF", detail: "Hyperdynamic (EF >70%): hypovolaemia, sepsis. Severely reduced (EF <30%): cardiogenic shock.", critical: true },
      { id: "poc_plax_pericardium", label: "Pericardial effusion — posterior stripe", detail: "Anechoic space posterior to LV. Descending aorta posterior to effusion distinguishes from pleural.", critical: true },
      { id: "poc_plax_mv", label: "Mitral valve — gross morphology", detail: "EPSS >10 mm = reduced LV function.", critical: false },
      { id: "poc_plax_aortic_root", label: "Aortic root diameter (normal <3.7 cm)", detail: "", critical: false },
    ]},
    { sectionName: "Parasternal Short Axis — Papillary Muscle Level (PSAX-PM)", probe: "Phased array 2–4 MHz | Rotate 90° clockwise from PLAX, tilt caudal", items: [
      { id: "poc_psax_pm_wma", label: "Regional wall motion — 6 segments", detail: "Akinetic/hypokinetic = ACS. Inferior/inferolateral = RCA. Anterior/anteroseptal = LAD.", critical: true },
      { id: "poc_psax_pm_dsign", label: "D-sign — septal flattening", detail: "Systolic D-sign = RV pressure overload (PE, PH). Diastolic D-sign = RV volume overload.", critical: true },
    ]},
    { sectionName: "Apical 4-Chamber (A4C)", probe: "Phased array 2–4 MHz | Cardiac apex, 5th–6th ICS, mid-clavicular line", items: [
      { id: "poc_a4c_lv_ef", label: "LV systolic function — biplane or visual EF", detail: "Biplane Simpson's preferred. Visual EF acceptable for POCUS screening.", critical: true },
      { id: "poc_a4c_rv_size", label: "RV size — basal diameter (normal ≤41 mm)", detail: "RV:LV ratio >1 = RV dilation. RV:LV ratio >1.5 = severe (PE, RV infarct).", critical: true },
      { id: "poc_a4c_rv_func", label: "RV systolic function — TAPSE (normal ≥17 mm)", detail: "TAPSE <17 mm = RV dysfunction. McConnell's sign = PE.", critical: true },
      { id: "poc_a4c_pericardium", label: "Pericardial effusion — RA/RV collapse", detail: "RA systolic collapse = early tamponade. RV diastolic collapse = tamponade physiology.", critical: true },
    ]},
    { sectionName: "Subcostal 4-Chamber", probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder", items: [
      { id: "poc_sub_pericardium", label: "Pericardial effusion — circumferential", detail: "Best view for tamponade assessment. RV diastolic collapse = tamponade.", critical: true },
      { id: "poc_sub_rv_collapse", label: "RV diastolic collapse (tamponade)", detail: "", critical: true },
    ]},
    { sectionName: "Subcostal IVC", probe: "Curvilinear or phased array | Subcostal, longitudinal", items: [
      { id: "poc_ivc_size", label: "IVC diameter — end-expiratory (normal <2.1 cm)", detail: "IVC <2.1 cm + >50% collapse = low RA pressure. IVC >2.1 cm + <50% collapse = elevated RA pressure.", critical: true },
      { id: "poc_ivc_collapse", label: "IVC collapsibility index — sniff test", detail: "CI >50% = volume responsive. CI <50% = non-responsive.", critical: true },
      { id: "poc_ivc_plethoric", label: "Plethoric IVC (>2.1 cm, non-collapsing)", detail: "Elevated RA pressure. Consider tamponade, RV failure, PE, tension PTX, severe TR.", critical: true },
    ]},
  ],

  // ── POCUS eFAST ──────────────────────────────────────────────────────────────
  pocus_efast: [
    { sectionName: "Right Upper Quadrant (RUQ) — Morison's Pouch", probe: "Curvilinear | Right mid-axillary line, 8th–11th ICS", items: [
      { id: "efast_ruq_0", label: "Morison's pouch — free fluid (anechoic stripe)", detail: "Even 200 mL detectable. Stripe ≥5 mm = significant.", critical: true },
      { id: "efast_ruq_1", label: "Right subphrenic space — free fluid", detail: "", critical: true },
      { id: "efast_ruq_2", label: "Right pleural space — hemothorax", detail: "", critical: true },
    ]},
    { sectionName: "Left Upper Quadrant (LUQ) — Splenorenal Space", probe: "Curvilinear | Left posterior axillary line, 8th–11th ICS", items: [
      { id: "efast_luq_0", label: "Splenorenal space — free fluid", detail: "", critical: true },
      { id: "efast_luq_1", label: "Left subphrenic space — free fluid", detail: "", critical: true },
      { id: "efast_luq_2", label: "Left pleural space — hemothorax", detail: "", critical: true },
    ]},
    { sectionName: "Pelvic / Suprapubic — Pouch of Douglas", probe: "Curvilinear | Suprapubic, transverse and longitudinal", items: [
      { id: "efast_pelvis_0", label: "Bladder identification", detail: "", critical: true },
      { id: "efast_pelvis_1", label: "Pelvic free fluid — posterior to bladder", detail: "Pouch of Douglas (females) or rectovesical pouch (males)", critical: true },
    ]},
    { sectionName: "Subxiphoid Cardiac — Pericardial Effusion", probe: "Curvilinear or phased array | Subxiphoid, angled toward left shoulder", items: [
      { id: "efast_sub_0", label: "Pericardial effusion — anechoic stripe around heart", detail: "", critical: true },
      { id: "efast_sub_1", label: "RV diastolic collapse (tamponade physiology)", detail: "", critical: true },
    ]},
    { sectionName: "Right Thorax — Pneumothorax", probe: "Linear 7–12 MHz | 2nd–3rd ICS, midclavicular line", items: [
      { id: "efast_rthorax_0", label: "Right pleural sliding — present / absent", detail: "Absent sliding = pneumothorax until proven otherwise.", critical: true },
      { id: "efast_rthorax_1", label: "A-lines with absent sliding (PTX)", detail: "", critical: true },
      { id: "efast_rthorax_2", label: "Lung point (PTX boundary)", detail: "Pathognomonic for PTX.", critical: true },
    ]},
    { sectionName: "Left Thorax — Pneumothorax", probe: "Linear 7–12 MHz | 2nd–3rd ICS, midclavicular line", items: [
      { id: "efast_lthorax_0", label: "Left pleural sliding — present / absent", detail: "Cardiac pulsation can mimic lung sliding — use M-mode to distinguish.", critical: true },
      { id: "efast_lthorax_1", label: "Lung point (PTX boundary)", detail: "", critical: true },
    ]},
  ],

  // ── POCUS LUNG ───────────────────────────────────────────────────────────────
  pocus_lung: [
    { sectionName: "Right Upper Anterior — Zone 1", probe: "Linear or curvilinear | 2nd–3rd ICS, midclavicular line", items: [
      { id: "lung_rua_0", label: "Pleural sliding — present / absent", detail: "Absent sliding = pneumothorax until proven otherwise.", critical: true },
      { id: "lung_rua_1", label: "A-lines — horizontal reverberation artefacts", detail: "A-lines + absent sliding = PTX.", critical: true },
      { id: "lung_rua_2", label: "B-lines — vertical laser-like artefacts (≥3 = interstitial syndrome)", detail: "Bilateral B-lines = pulmonary edema, ARDS, ILD.", critical: true },
    ]},
    { sectionName: "Right Lower Anterior — Zone 2", probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line", items: [
      { id: "lung_rla_0", label: "Pleural sliding — present / absent", detail: "", critical: true },
      { id: "lung_rla_1", label: "A-lines or B-lines", detail: "≥3 B-lines = interstitial syndrome.", critical: false },
    ]},
    { sectionName: "Right Lateral — PLAPS Point (Zone 3)", probe: "Curvilinear | 5th–6th ICS, posterior axillary line", items: [
      { id: "lung_rl_0", label: "Pleural effusion — anechoic collection above diaphragm", detail: "Spine sign = fluid present.", critical: true },
      { id: "lung_rl_1", label: "Consolidation — tissue-like pattern", detail: "Air bronchograms (dynamic = pneumonia, static = atelectasis).", critical: true },
    ]},
    { sectionName: "Left Upper Anterior — Zone 4", probe: "Linear or curvilinear | 2nd–3rd ICS, midclavicular line", items: [
      { id: "lung_lua_0", label: "Pleural sliding — present / absent", detail: "Cardiac pulsation can mimic lung sliding — use M-mode.", critical: true },
      { id: "lung_lua_1", label: "A-lines or B-lines", detail: "Bilateral anterior B-lines = pulmonary edema (BLUE protocol).", critical: false },
    ]},
    { sectionName: "Left Lower Anterior — Zone 5", probe: "Linear or curvilinear | 4th–5th ICS, midclavicular line", items: [
      { id: "lung_lla_0", label: "Pleural sliding — present / absent", detail: "", critical: true },
      { id: "lung_lla_1", label: "A-lines or B-lines", detail: "", critical: false },
    ]},
    { sectionName: "Left Lateral — PLAPS Point (Zone 6)", probe: "Curvilinear | 5th–6th ICS, posterior axillary line", items: [
      { id: "lung_ll_0", label: "Pleural effusion — anechoic collection above left diaphragm", detail: "Left effusions may be obscured by cardiac shadow.", critical: true },
      { id: "lung_ll_1", label: "Consolidation — tissue-like pattern", detail: "", critical: true },
    ]},
    { sectionName: "Right Diaphragm — M-mode Assessment", probe: "Curvilinear | Subcostal or right lateral", items: [
      { id: "lung_dr_0", label: "Diaphragm excursion — quiet breathing (normal ≥1.8 cm)", detail: "Reduced = dysfunction.", critical: true },
      { id: "lung_dr_1", label: "Paradoxical movement (cephalad during inspiration)", detail: "Paradoxical movement = diaphragm paralysis.", critical: false },
    ]},
    { sectionName: "Left Diaphragm — M-mode Assessment", probe: "Curvilinear | Subcostal or left lateral", items: [
      { id: "lung_dl_0", label: "Diaphragm excursion — quiet breathing (normal ≥1.6 cm)", detail: "Reduced = dysfunction.", critical: true },
      { id: "lung_dl_1", label: "Paradoxical movement", detail: "", critical: false },
    ]},
  ],

  // ── POCUS RUSH ───────────────────────────────────────────────────────────────
  pocus_rush: [
    { sectionName: "The Pump — Parasternal Long Axis (PLAX)", probe: "Phased array 2–4 MHz | 3rd–4th ICS, left sternal border", items: [
      { id: "rush_pump_plax_lv", label: "LV systolic function — visual EF", detail: "Hyperdynamic: hypovolaemia, sepsis. Severely reduced: cardiogenic shock.", critical: true },
      { id: "rush_pump_plax_pericardium", label: "Pericardial effusion — posterior stripe", detail: "", critical: true },
    ]},
    { sectionName: "The Pump — Parasternal Short Axis (PSAX)", probe: "Phased array 2–4 MHz | Rotate 90° clockwise from PLAX", items: [
      { id: "rush_pump_psax_lv", label: "LV cavity size — end-diastolic diameter", detail: "Small, hyperkinetic LV cavity = hypovolaemia. Kissing walls = severe hypovolaemia.", critical: true },
      { id: "rush_pump_psax_rv", label: "RV dilation — D-sign (septal flattening)", detail: "Systolic D-sign = pressure overload (PE, PH).", critical: true },
    ]},
    { sectionName: "The Pump — Apical 4-Chamber (A4C)", probe: "Phased array 2–4 MHz | Cardiac apex, 5th–6th ICS, mid-clavicular line", items: [
      { id: "rush_pump_a4c_lv", label: "LV systolic function — biplane or visual EF", detail: "", critical: true },
      { id: "rush_pump_a4c_rv", label: "RV size — basal diameter (normal ≤41 mm)", detail: "", critical: true },
      { id: "rush_pump_a4c_tapse", label: "RV systolic function — TAPSE (normal ≥17 mm)", detail: "McConnell's sign = PE.", critical: true },
    ]},
    { sectionName: "The Tank — IVC Collapsibility", probe: "Curvilinear or phased array | Subcostal, longitudinal", items: [
      { id: "rush_tank_ivc_size", label: "IVC diameter — end-expiratory (normal <2.1 cm)", detail: "", critical: true },
      { id: "rush_tank_ivc_ci", label: "IVC collapsibility index (CI) — sniff test", detail: "CI >50% = volume responsive.", critical: true },
    ]},
    { sectionName: "The Tank — RUQ Free Fluid", probe: "Curvilinear | Right mid-axillary line, 8th–11th ICS", items: [
      { id: "rush_tank_ruq_fluid", label: "Morison's pouch — free fluid", detail: "", critical: true },
      { id: "rush_tank_ruq_pleural", label: "Right pleural effusion", detail: "", critical: false },
    ]},
    { sectionName: "The Tank — LUQ Free Fluid", probe: "Curvilinear | Left posterior axillary line, 8th–11th ICS", items: [
      { id: "rush_tank_luq_fluid", label: "Splenorenal space — free fluid", detail: "", critical: true },
      { id: "rush_tank_luq_pleural", label: "Left pleural effusion", detail: "", critical: false },
    ]},
    { sectionName: "The Tank — Pelvic Free Fluid", probe: "Curvilinear | Suprapubic, transverse and longitudinal", items: [
      { id: "rush_tank_pelvis", label: "Pelvic free fluid — posterior to bladder", detail: "Most dependent site.", critical: true },
    ]},
    { sectionName: "The Pipes — Abdominal Aorta (AAA)", probe: "Curvilinear | Epigastric, longitudinal and transverse", items: [
      { id: "rush_pipes_aorta_size", label: "Aortic diameter — outer wall to outer wall (normal <3 cm)", detail: "AAA ≥3 cm. Ruptured AAA: diameter ≥5 cm + haemodynamic instability = surgical emergency.", critical: true },
      { id: "rush_pipes_aorta_thrombus", label: "Intraluminal thrombus / dissection flap", detail: "", critical: false },
    ]},
    { sectionName: "The Pipes — DVT Assessment (2-Point Compression)", probe: "Linear 7–12 MHz | CFV (groin) and popliteal vein (posterior knee)", items: [
      { id: "rush_pipes_dvt_cfv", label: "Common femoral vein — compressibility", detail: "Non-compressible CFV = proximal DVT.", critical: true },
      { id: "rush_pipes_dvt_pop", label: "Popliteal vein — compressibility", detail: "", critical: true },
    ]},
    { sectionName: "The Pipes — Pneumothorax", probe: "Linear 7–12 MHz | 2nd–3rd ICS, midclavicular line", items: [
      { id: "rush_pipes_ptx_sliding", label: "Pleural sliding — present / absent", detail: "Absent sliding = pneumothorax until proven otherwise.", critical: true },
      { id: "rush_pipes_ptx_alines", label: "A-lines with absent sliding", detail: "", critical: true },
      { id: "rush_pipes_ptx_lungpoint", label: "Lung point (PTX boundary)", detail: "Pathognomonic for PTX.", critical: true },
    ]},
  ],

  // ── FETAL ECHO ───────────────────────────────────────────────────────────────
  fetal: [
    { sectionName: "Situs / Abdominal", probe: "Transverse plane at fetal abdomen | Marker toward fetal left", items: [
      { id: "fetal_situs_0", label: "Situs determination (stomach, liver, IVC, Ao)", detail: "Stomach on left = situs solitus. Stomach on right = situs inversus or heterotaxy.", critical: true },
      { id: "fetal_situs_1", label: "Cardiac axis (normal 45° ± 20°)", detail: "Axis >60° = CHD or extracardiac anomaly.", critical: true },
      { id: "fetal_situs_2", label: "Cardiac position (levocardia, mesocardia, dextrocardia)", detail: "", critical: true },
    ]},
    { sectionName: "4-Chamber View (4CV)", probe: "Transverse plane at level of 4 chambers | Apex toward transducer", items: [
      { id: "fetal_4cv_0", label: "4 chambers roughly equal size", detail: "Ventricular disproportion: R>L suggests CoA/HLHS; L>R suggests PA/critical PS", critical: true },
      { id: "fetal_4cv_1", label: "Crux of heart — AV valves at same level", detail: "Offsetting of AV valves lost in AVSD", critical: true },
      { id: "fetal_4cv_2", label: "Pulmonary veins entering LA (color Doppler)", detail: "", critical: true },
    ]},
    { sectionName: "LVOT / 5-Chamber View", probe: "Slight anterior tilt from 4CV | Aortic root comes into view", items: [
      { id: "fetal_lvot_0", label: "Aorta arising from LV — aortic-mitral continuity", detail: "Overriding aorta (>50%) suggests TOF or DORV", critical: true },
      { id: "fetal_lvot_1", label: "LVOT color Doppler — obstruction or VSD with aortic override", detail: "", critical: false },
    ]},
    { sectionName: "RVOT / 3-Vessel View (3VV)", probe: "Slight further anterior tilt from LVOT | 3 vessels in a row", items: [
      { id: "fetal_rvot_0", label: "3 vessels in a row: PA (largest, left), Ao (middle), SVC (smallest, right)", detail: "PA should be slightly larger than Ao.", critical: true },
      { id: "fetal_rvot_1", label: "Color Doppler — antegrade flow in PA and Ao; ductus direction", detail: "Absent ductus: suggests TOF/PA or pulmonary atresia", critical: true },
    ]},
    { sectionName: "Aortic Arch View", probe: "Sagittal/oblique plane | Follow aorta from LV through arch", items: [
      { id: "fetal_aarch_0", label: "Hockey-stick shape of aortic arch", detail: "Left arch: curves to the left of trachea. Right arch: associated with CHD.", critical: true },
      { id: "fetal_aarch_1", label: "Isthmus size — retrograde flow on color Doppler?", detail: "Retrograde flow in isthmus = severe CoA.", critical: true },
    ]},
    { sectionName: "Ductal Arch View", probe: "Sagittal plane | Follow PA through ductus to descending aorta", items: [
      { id: "fetal_darch_0", label: "PA connecting to descending aorta via ductus", detail: "Both arches should be similar in size", critical: false },
      { id: "fetal_darch_1", label: "Color Doppler — L→R flow (normal); R→L = elevated PA pressure", detail: "", critical: true },
    ]},
    { sectionName: "Pulmonary Veins", probe: "Transverse or oblique plane | Posterior to LA", items: [
      { id: "fetal_pvein_0", label: "All 4 pulmonary veins draining to LA — crab-claw pattern on color Doppler", detail: "Color Doppler is essential — 2D alone is insufficient", critical: true },
      { id: "fetal_pvein_1", label: "Vertical vein above LA = TAPVR supracardiac type", detail: "TAPVR is easily missed without color Doppler", critical: true },
    ]},
    { sectionName: "Fetal Echo Protocol Checklist", probe: "All views as above", items: [
      { id: "fetal_check_situs", label: "Situs determination (stomach, liver, IVC, Ao)", detail: "", critical: true },
      { id: "fetal_check_axis", label: "Cardiac axis (normal 45° ± 20°)", detail: "", critical: true },
      { id: "fetal_check_4cv", label: "4-Chamber view: chamber size, AV valves, IVS, IAS", detail: "", critical: true },
      { id: "fetal_check_lvot", label: "LVOT / 5-Chamber view: aortic continuity, VSD", detail: "", critical: true },
      { id: "fetal_check_rvot", label: "RVOT / 3-Vessel view: PA, Ao, SVC, ductus", detail: "", critical: true },
      { id: "fetal_check_aarch", label: "Aortic arch: sidedness, isthmus size, retrograde flow?", detail: "", critical: true },
      { id: "fetal_check_pvein", label: "Pulmonary veins: all 4 draining to LA (color Doppler)", detail: "", critical: true },
      { id: "fetal_check_rhythm", label: "Cardiac rhythm: regular rate 120–160 bpm", detail: "", critical: true },
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
  const dragSectionIdx = useRef<number | null>(null);
  const dragItemKey = useRef<{ sectionIdx: number; itemIdx: number } | null>(null);

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
    const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
    setSections(reordered);
    // Keep the same section expanded after move
    if (expandedSection === sectionIdx) setExpandedSection(targetIdx);
    else if (expandedSection === targetIdx) setExpandedSection(sectionIdx);
    // Persist reorder if all sections are in DB
    const allInDb = reordered.every(s => s.id);
    if (allInDb) {
      try {
        await reorderSections.mutateAsync({
          module: selectedModule,
          orderedIds: reordered.map(s => s.id!),
        });
      } catch { /* non-fatal */ }
    }
  };

  // Drag-to-reorder: sections
  const handleSectionDragStart = (e: React.DragEvent, idx: number) => {
    dragSectionIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleSectionDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragSectionIdx.current;
    if (from === null || from === idx) return;
    const newSections = [...sections];
    const [moved] = newSections.splice(from, 1);
    newSections.splice(idx, 0, moved);
    const reordered = newSections.map((s, i) => ({ ...s, sortOrder: i, isDirty: true }));
    dragSectionIdx.current = idx;
    if (expandedSection === from) setExpandedSection(idx);
    else if (expandedSection === idx) setExpandedSection(from);
    setSections(reordered);
  };
  const handleSectionDragEnd = async () => {
    const allInDb = sections.every(s => s.id);
    if (allInDb) {
      try {
        await reorderSections.mutateAsync({
          module: selectedModule,
          orderedIds: sections.map(s => s.id!),
        });
      } catch { /* non-fatal */ }
    }
    dragSectionIdx.current = null;
  };

  // Drag-to-reorder: items within a section
  const handleItemDragStart = (e: React.DragEvent, sectionIdx: number, itemIdx: number) => {
    dragItemKey.current = { sectionIdx, itemIdx };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${sectionIdx}-${itemIdx}`);
    e.stopPropagation();
  };
  const handleItemDragOver = (e: React.DragEvent, sectionIdx: number, itemIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const key = dragItemKey.current;
    if (!key || key.sectionIdx !== sectionIdx || key.itemIdx === itemIdx) return;
    setSections(prev => prev.map((s, si) => {
      if (si !== sectionIdx) return s;
      const newItems = [...s.items];
      const [moved] = newItems.splice(key.itemIdx, 1);
      newItems.splice(itemIdx, 0, moved);
      dragItemKey.current = { sectionIdx, itemIdx };
      return { ...s, items: newItems.map((item, i) => ({ ...item, sortOrder: i })), isDirty: true };
    }));
  };
  const handleItemDragEnd = () => {
    dragItemKey.current = null;
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
              <div
                key={si}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${section.isDirty ? "border-amber-300" : "border-gray-100"}`}
                onDragOver={e => handleSectionDragOver(e, si)}
                onDrop={e => { e.preventDefault(); }}
              >
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span
                    draggable
                    onDragStart={e => handleSectionDragStart(e, si)}
                    onDragEnd={handleSectionDragEnd}
                    className="cursor-grab active:cursor-grabbing flex-shrink-0"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </span>
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
                        <div
                          key={item.id}
                          className={`border-b border-gray-50 last:border-0 ${item.critical ? "bg-amber-50/30" : ""}`}
                          onDragOver={e => handleItemDragOver(e, si, ii)}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          <div className="flex items-start gap-2 px-4 py-2.5">
                            <span
                              draggable
                              onDragStart={e => handleItemDragStart(e, si, ii)}
                              onDragEnd={handleItemDragEnd}
                              className="cursor-grab active:cursor-grabbing flex-shrink-0 mt-1"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </span>
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
