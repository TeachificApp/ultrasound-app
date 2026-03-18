/**
 * scanCoachRegistry.ts
 * Static registry of all ScanCoach modules and their views.
 * Used by the WYSIWYG editor to enumerate views and by the override hook
 * to know which fields are editable per module.
 */

export type ScanCoachModule =
  | "tte"
  | "tee"
  | "ice"
  | "uea"
  | "strain"
  | "hocm"
  | "stress"
  | "structural"
  | "fetal"
  | "chd"
  | "diastolic"
  | "pulm"
  // POCUS-Assist™ modules
  | "pocus_efast"
  | "pocus_rush"
  | "pocus_cardiac"
  | "pocus_lung"
  // ACHD & ECG
  | "achd"
  | "ecg";

export interface ScanCoachViewMeta {
  id: string;
  name: string;
  group?: string;
}

export interface ScanCoachModuleMeta {
  key: ScanCoachModule;
  label: string;
  path: string;
  views: ScanCoachViewMeta[];
}

export const SCANCOACH_MODULES: ScanCoachModuleMeta[] = [
  // ─── Adult TTE ────────────────────────────────────────────────────────────
  {
    key: "tte",
    label: "Adult TTE ScanCoach",
    path: "/scan-coach?tab=tte",
    views: [
      { id: "plax",        name: "Parasternal Long Axis",                   group: "Parasternal" },
      { id: "psax_av",     name: "PSAX — Aortic Valve Level",               group: "Parasternal" },
      { id: "psax_mv",     name: "PSAX — Mitral Valve Level",               group: "Parasternal" },
      { id: "psax_pm",     name: "PSAX — Papillary Muscle Level",           group: "Parasternal" },
      { id: "a4c",         name: "Apical 4-Chamber",                        group: "Apical" },
      { id: "a5c",         name: "Apical 5-Chamber",                        group: "Apical" },
      { id: "a2c",         name: "Apical 2-Chamber",                        group: "Apical" },
      { id: "a3c",         name: "Apical 3-Chamber (APLAX)",                group: "Apical" },
      { id: "subcostal",   name: "Subcostal",                               group: "Other" },
      { id: "suprasternal",name: "Suprasternal",                            group: "Other" },
    ],
  },
  // ─── TEE ──────────────────────────────────────────────────────────────────
  {
    key: "tee",
    label: "TEE ScanCoach",
    path: "/tee-scan-coach",
    views: [
      { id: "me4c",         name: "ME 4-Chamber",                           group: "Mid-Esophageal" },
      { id: "me2c",         name: "ME 2-Chamber",                           group: "Mid-Esophageal" },
      { id: "melax",        name: "ME Long Axis (LAX)",                     group: "Mid-Esophageal" },
      { id: "meavsax",      name: "ME AV Short Axis",                       group: "Mid-Esophageal" },
      { id: "mebicaval",    name: "ME Bicaval",                             group: "Mid-Esophageal" },
      { id: "mervio",       name: "ME RV Inflow-Outflow",                   group: "Mid-Esophageal" },
      { id: "meaorta",      name: "ME Ascending Aorta SAX/LAX",             group: "Mid-Esophageal" },
      { id: "tgsax",        name: "TG Mid SAX",                             group: "Transgastric" },
      { id: "tg2c",         name: "TG 2-Chamber",                           group: "Transgastric" },
      { id: "tglax",        name: "TG Long Axis (LAX)",                     group: "Transgastric" },
      { id: "tgrvio",       name: "TG RV Inflow",                           group: "Transgastric" },
      { id: "ueaorticarch", name: "UE Aortic Arch",                         group: "Upper Esophageal" },
      { id: "uepv",         name: "UE Pulmonary Veins",                     group: "Upper Esophageal" },
    ],
  },
  // ─── ICE ──────────────────────────────────────────────────────────────────
  {
    key: "ice",
    label: "ICE ScanCoach",
    path: "/ice-scan-coach",
    views: [
      { id: "home",           name: "Home View",                            group: "Standard Views" },
      { id: "avview",         name: "Aortic Valve View",                    group: "Standard Views" },
      { id: "mvlhview",       name: "Mitral Valve / Left Heart View",       group: "Standard Views" },
      { id: "esophagusview",  name: "Esophagus View",                       group: "Standard Views" },
      { id: "leftpvview",     name: "Left Pulmonary Veins View",            group: "Standard Views" },
      { id: "rightpvview",    name: "Right Pulmonary Veins View",           group: "Standard Views" },
      { id: "pericardialview",name: "Pericardial Monitoring View",          group: "Standard Views" },
      { id: "transseptal",    name: "Transseptal View",                     group: "Procedural" },
      { id: "laaview",        name: "Left Atrial Appendage View",           group: "Procedural" },
    ],
  },
  // ─── UEA (Contrast Echo) ──────────────────────────────────────────────────
  {
    key: "uea",
    label: "UEA ScanCoach",
    path: "/uea-scan-coach",
    views: [
      { id: "plax",     name: "Parasternal Long Axis (PLAX)",               group: "Standard Views" },
      { id: "psax_mv",  name: "PSAX — Mitral Valve Level",                  group: "Standard Views" },
      { id: "psax_pap", name: "PSAX — Mid-Papillary Level",                 group: "Standard Views" },
      { id: "a4c",      name: "Apical 4-Chamber (A4C)",                     group: "Standard Views" },
      { id: "a2c",      name: "Apical 2-Chamber (A2C)",                     group: "Standard Views" },
      { id: "a3c",      name: "Apical 3-Chamber / Long Axis (A3C)",         group: "Standard Views" },
      { id: "subcostal",name: "Subcostal 4-Chamber",                        group: "Standard Views" },
    ],
  },
  // ─── Strain ───────────────────────────────────────────────────────────────
  {
    key: "strain",
    label: "Strain ScanCoach",
    path: "/strain-scan-coach",
    views: [
      { id: "psax_base", name: "PSAX — Basal Level (Mitral Valve)",          group: "Radial & Circumferential" },
      { id: "psax_mid",  name: "PSAX — Mid Level (Papillary Muscles)",       group: "Radial & Circumferential" },
      { id: "psax_apex", name: "PSAX — Apical Level",                        group: "Radial & Circumferential" },
      { id: "a4c",       name: "Apical 4-Chamber (A4C)",                     group: "Longitudinal" },
      { id: "a2c",       name: "Apical 2-Chamber (A2C)",                     group: "Longitudinal" },
      { id: "a3c",       name: "Apical 3-Chamber (APLAX)",                   group: "Longitudinal" },
    ],
  },
  // ─── HOCM ─────────────────────────────────────────────────────────────────
  {
    key: "hocm",
    label: "HOCM ScanCoach",
    path: "/hocm-scan-coach",
    views: [
      { id: "plax",          name: "Parasternal Long Axis (PLAX)",          group: "2D Assessment" },
      { id: "psax_mv",       name: "PSAX — Mitral Valve Level",             group: "2D Assessment" },
      { id: "psax_pap",      name: "PSAX — Papillary Muscle Level",         group: "2D Assessment" },
      { id: "a4c",           name: "Apical 4-Chamber (A4C)",                group: "2D Assessment" },
      { id: "a5c",           name: "Apical 5-Chamber (A5C) — LVOT CW",     group: "Doppler / LVOT" },
      { id: "a3c",           name: "Apical 3-Chamber (APLAX) — LVOT CW",   group: "Doppler / LVOT" },
      { id: "a2c",           name: "Apical 2-Chamber (A2C)",                group: "2D Assessment" },
      { id: "subcostal",     name: "Subcostal 4-Chamber",                   group: "2D Assessment" },
      { id: "valsalva_pos",  name: "Valsalva — Patient Positioning",        group: "Provocation" },
      { id: "cw_lvot",       name: "CW Doppler — LVOT Dagger Waveform",    group: "Doppler / LVOT" },
      { id: "pw_lvot",       name: "PW Doppler — LVOT Sample Site",        group: "Doppler / LVOT" },
      { id: "mr_jet",        name: "MR Jet — CW Doppler",                  group: "Doppler / LVOT" },
      { id: "sam_plax",      name: "SAM — PLAX M-Mode",                    group: "SAM Assessment" },
      { id: "sam_zoom",      name: "SAM — Zoomed PLAX",                    group: "SAM Assessment" },
    ],
  },
  // ─── Stress Echo ──────────────────────────────────────────────────────────
  {
    key: "stress",
    label: "Stress Echo ScanCoach",
    path: "/stress-scan-coach",
    views: [
      { id: "rest-plax",         name: "PLAX (Rest)",                       group: "Baseline — Rest" },
      { id: "rest-psax-mv",      name: "PSAX — Mitral Valve Level (Rest)",  group: "Baseline — Rest" },
      { id: "rest-psax-pm",      name: "PSAX — Papillary Muscle Level (Rest)", group: "Baseline — Rest" },
      { id: "rest-a4c",          name: "Apical 4-Chamber (Rest)",           group: "Baseline — Rest" },
      { id: "rest-a2c",          name: "Apical 2-Chamber (Rest)",           group: "Baseline — Rest" },
      { id: "rest-a3c",          name: "Apical 3-Chamber / APLAX (Rest)",   group: "Baseline — Rest" },
      { id: "peak-psax-pm",      name: "PSAX — PM Level (Peak)",            group: "Peak Stress" },
      { id: "peak-a4c",          name: "Apical 4-Chamber (Peak)",           group: "Peak Stress" },
      { id: "peak-a2c",          name: "Apical 2-Chamber (Peak)",           group: "Peak Stress" },
      { id: "recovery-a4c",      name: "Apical 4-Chamber (Recovery)",       group: "Recovery" },
      { id: "dse-low-dose",      name: "DSE — Low-Dose Dobutamine",         group: "DSE Protocol" },
      { id: "dse-peak",          name: "DSE — Peak Dose",                   group: "DSE Protocol" },
      { id: "diastolic-stress",  name: "Diastolic Stress Assessment",       group: "Diastolic" },
    ],
  },
  // ─── Structural Heart ─────────────────────────────────────────────────────
  {
    key: "structural",
    label: "Structural Heart ScanCoach",
    path: "/structural-heart-scan-coach",
    views: [
      { id: "tavr-sizing",       name: "TAVR — Annulus Sizing (ME LAX)",    group: "TAVR" },
      { id: "tavr-deployment",   name: "TAVR — Valve Deployment Guidance",  group: "TAVR" },
      { id: "teer-iasn",         name: "TEER — Transseptal Puncture Guidance", group: "TEER / MitraClip" },
      { id: "teer-guidance",     name: "TEER — Clip Delivery and Grasping", group: "TEER / MitraClip" },
      { id: "laao-sizing",       name: "LAAO — LAA Sizing",                 group: "LAAO (Watchman / Amulet)" },
      { id: "laao-deployment",   name: "LAAO — Device Deployment and Assessment", group: "LAAO (Watchman / Amulet)" },
      { id: "asd-sizing",        name: "ASD / PFO — Sizing and Rims",       group: "ASD / PFO Closure" },
      { id: "asd-deployment",    name: "ASD / PFO — Device Deployment",     group: "ASD / PFO Closure" },
      { id: "tteer-guidance",    name: "Tricuspid TEER — Clip Guidance",    group: "Tricuspid TEER" },
      { id: "tmvr-sizing",       name: "TMVR — Sizing and LVOTO Assessment",group: "TMVR" },
    ],
  },
  // ─── Fetal Echo ───────────────────────────────────────────────────────────
  {
    key: "fetal",
    label: "Fetal Echo ScanCoach",
    path: "/scan-coach?tab=fetal",
    views: [
      { id: "abdominal-situs",   name: "Abdominal Situs",                   group: "Fetal Protocol" },
      { id: "4cv",               name: "4-Chamber View (4CV)",              group: "Fetal Protocol" },
      { id: "lvot",              name: "LVOT View",                         group: "Fetal Protocol" },
      { id: "rvot",              name: "RVOT View",                         group: "Fetal Protocol" },
      { id: "rvot-bifurcation",  name: "RVOT Bifurcation",                  group: "Fetal Protocol" },
      { id: "3vv-ductal",        name: "3-Vessel View / Ductal Arch",       group: "Fetal Protocol" },
      { id: "3vt",               name: "3-Vessel Trachea (3VT)",            group: "Fetal Protocol" },
      { id: "lbvc",              name: "Long-Axis Bicaval View (LBVC)",     group: "Fetal Protocol" },
      { id: "lv-short-axis",     name: "LV Short Axis",                     group: "Fetal Protocol" },
      { id: "rvot-short-axis",   name: "RVOT Short Axis",                   group: "Fetal Protocol" },
      { id: "bicaval",           name: "Bicaval View",                      group: "Fetal Protocol" },
      { id: "aortic-arch",       name: "Aortic Arch",                       group: "Fetal Protocol" },
      { id: "ductal-arch",       name: "Ductal Arch",                       group: "Fetal Protocol" },
    ],
  },
  // ─── Pediatric / CHD ──────────────────────────────────────────────────────
  {
    key: "chd",
    label: "Pediatric CHD ScanCoach",
    path: "/scan-coach?tab=chd",
    views: [
      // ASD
      { id: "asd",                    name: "Atrial Septal Defect (ASD)",                        group: "Shunt Lesions" },
      { id: "asd-diagnosis",          name: "ASD — Diagnosis & Sizing",                          group: "Shunt Lesions" },
      { id: "asd-post-closure",       name: "ASD — Post-Closure Surveillance",                   group: "Shunt Lesions" },
      // VSD
      { id: "vsd",                    name: "Ventricular Septal Defect (VSD)",                   group: "Shunt Lesions" },
      { id: "vsd-diagnosis",          name: "VSD — Diagnosis & Sizing",                          group: "Shunt Lesions" },
      { id: "vsd-post-closure",       name: "VSD — Post-Closure Surveillance",                   group: "Shunt Lesions" },
      // Tetralogy of Fallot
      { id: "tof",                    name: "Tetralogy of Fallot",                              group: "Tetralogy of Fallot" },
      { id: "tof-preop",              name: "ToF — Pre-Op Assessment",                          group: "Tetralogy of Fallot" },
      { id: "tof-postop",             name: "ToF — Post-Op: Complete Repair",                   group: "Tetralogy of Fallot" },
      { id: "tof-surveillance",       name: "ToF — Long-Term Surveillance",                     group: "Tetralogy of Fallot" },
      // HLHS
      { id: "hlhs",                   name: "Hypoplastic Left Heart Syndrome",                  group: "HLHS" },
      { id: "hlhs-prenatal-neonatal", name: "HLHS — Pre-Op: Neonatal",                          group: "HLHS" },
      { id: "hlhs-post-norwood",      name: "HLHS — Post-Op: Norwood Stage 1",                  group: "HLHS" },
      { id: "hlhs-interstage",        name: "HLHS — Inter-Stage: Norwood → Glenn",              group: "HLHS" },
      { id: "hlhs-post-glenn",        name: "HLHS — Post-Op: Bidirectional Glenn (Stage 2)",    group: "HLHS" },
      { id: "hlhs-post-fontan",       name: "HLHS — Post-Op: Fontan Completion (Stage 3)",      group: "HLHS" },
      // d-TGA
      { id: "dtga",                   name: "d-Transposition of the Great Arteries",            group: "d-TGA" },
      { id: "dtga-preop",             name: "d-TGA — Pre-Op Assessment",                        group: "d-TGA" },
      { id: "dtga-post-aso",          name: "d-TGA — Post-Op: Arterial Switch Operation",       group: "d-TGA" },
      // AV Septal Defect
      { id: "cavsd",                  name: "AV Septal Defect (AVSD)",                          group: "AV Septal Defect" },
      { id: "cavsd-preop",            name: "AVSD — Pre-Op Assessment",                         group: "AV Septal Defect" },
      { id: "cavsd-postop",           name: "AVSD — Post-Op: Complete Repair",                  group: "AV Septal Defect" },
      // Coarctation
      { id: "coa",                    name: "Coarctation of the Aorta",                         group: "Coarctation" },
      { id: "coa-diagnosis",          name: "CoA — Diagnosis / Pre-Intervention",               group: "Coarctation" },
      { id: "coa-postop",             name: "CoA — Post-Op / Post-Intervention",                group: "Coarctation" },
      // TAPVR
      { id: "tapvr",                  name: "Total Anomalous Pulmonary Venous Return",          group: "TAPVR" },
      { id: "tapvr-preop",            name: "TAPVR — Pre-Op Assessment",                        group: "TAPVR" },
      { id: "tapvr-postop",           name: "TAPVR — Post-Op: Surgical Repair",                 group: "TAPVR" },
      // Truncus Arteriosus
      { id: "truncus",                name: "Truncus Arteriosus",                               group: "Truncus Arteriosus" },
      { id: "truncus-preop",          name: "Truncus — Pre-Op Assessment",                      group: "Truncus Arteriosus" },
      { id: "truncus-postop",         name: "Truncus — Post-Op: Rastelli-Type Repair",          group: "Truncus Arteriosus" },
      // Ebstein's Anomaly
      { id: "ebstein",                name: "Ebstein's Anomaly",                                group: "Ebstein's Anomaly" },
      { id: "ebstein-assessment",     name: "Ebstein — Initial Assessment",                     group: "Ebstein's Anomaly" },
      { id: "ebstein-postop",         name: "Ebstein — Post-Op: TV Repair (Cone Procedure)",    group: "Ebstein's Anomaly" },
      // PA-IVS
      { id: "paivs",                  name: "Pulmonary Atresia with Intact Ventricular Septum", group: "PA-IVS" },
      { id: "paivs-preop",            name: "PA-IVS — Pre-Op Assessment",                       group: "PA-IVS" },
      { id: "paivs-postop",           name: "PA-IVS — Post-Op / Staged Management",             group: "PA-IVS" },
      // DORV
      { id: "dorv",                   name: "Double Outlet Right Ventricle",                    group: "DORV" },
      { id: "dorv-preop",             name: "DORV — Pre-Op Assessment",                         group: "DORV" },
      { id: "dorv-postop",            name: "DORV — Post-Op: Repair",                           group: "DORV" },
      // Tricuspid Atresia
      { id: "tricuspid-atresia",      name: "Tricuspid Atresia",                                group: "Tricuspid Atresia" },
      { id: "ta-preop",               name: "TA — Pre-Op Assessment",                           group: "Tricuspid Atresia" },
      { id: "ta-fontan",              name: "TA — Post-Fontan Surveillance",                     group: "Tricuspid Atresia" },
      // IAA
      { id: "iaa",                    name: "Interrupted Aortic Arch",                          group: "IAA" },
      { id: "iaa-preop",              name: "IAA — Pre-Op Assessment",                          group: "IAA" },
      { id: "iaa-postop",             name: "IAA — Post-Op: Arch Reconstruction + VSD Closure", group: "IAA" },
      // Heterotaxy
      { id: "heterotaxy",             name: "Heterotaxy / Isomerism",                           group: "Heterotaxy" },
      { id: "heterotaxy-assessment",  name: "Heterotaxy — Segmental Assessment",                group: "Heterotaxy" },
    ],
  },
  // ─── Diastolic Function ───────────────────────────────────────────────────
  {
    key: "diastolic",
    label: "Diastolic Function ScanCoach",
    path: "/scan-coach?tab=diastolic",
    views: [
      { id: "tdi-e-prime",       name: "TDI — e' Velocity (A4C)",           group: "TDI" },
      { id: "mitral-inflow",     name: "Mitral Inflow — E/A Ratio",         group: "Mitral Inflow" },
      { id: "e-e-prime-ratio",   name: "E/e' Ratio",                        group: "Filling Pressures" },
      { id: "tr-velocity",       name: "TR Velocity (CW Doppler)",          group: "Filling Pressures" },
      { id: "lavi",              name: "LA Volume Index (LAVI)",             group: "LA Assessment" },
      { id: "pulm-venous",       name: "Pulmonary Venous Flow",             group: "Advanced" },
      { id: "la-strain",         name: "LA Strain (LARS)",                  group: "Advanced" },
    ],
  },
  // ─── Pulmonary HTN & PE ───────────────────────────────────────────────────
  {
    key: "pulm",
    label: "Pulmonary HTN & PE ScanCoach",
    path: "/scan-coach?tab=pulm",
    views: [
      { id: "psax-av",           name: "PSAX — Aortic Valve Level",         group: "RV Assessment" },
      { id: "a4ch-rv",           name: "Apical 4-Chamber — RV Focus",       group: "RV Assessment" },
      { id: "a5ch-cw",           name: "Apical 5-Chamber — TR CW",          group: "RV Assessment" },
      { id: "psax-pap",          name: "PSAX — Papillary Muscle Level",     group: "RV Assessment" },
      { id: "subcostal-ivc",     name: "Subcostal — IVC",                   group: "RV Assessment" },
      { id: "subcostal-rv",      name: "Subcostal — RV",                    group: "RV Assessment" },
      { id: "plax-rv",           name: "PLAX — RV Focus",                   group: "RV Assessment" },
      { id: "suprasternal",      name: "Suprasternal — PA Flow",            group: "RV Assessment" },
    ],
  },
  // ─── POCUS-Assist™ — eFAST ─────────────────────────────────────────────────
  {
    key: "pocus_efast",
    label: "eFAST ScanCoach",
    path: "/pocus-efast-scan-coach",
    views: [
      { id: "ruq",          name: "RUQ — Morison's Pouch",          group: "Abdominal" },
      { id: "luq",          name: "LUQ — Splenorenal Space",         group: "Abdominal" },
      { id: "pelvis",       name: "Pelvic / Suprapubic",             group: "Abdominal" },
      { id: "subxiphoid",   name: "Subxiphoid Cardiac",              group: "Cardiac" },
      { id: "rthorax",      name: "Right Thorax (Hemothorax/PTX)",   group: "Thoracic" },
      { id: "lthorax",      name: "Left Thorax (Hemothorax/PTX)",    group: "Thoracic" },
    ],
  },
  // ─── POCUS-Assist™ — RUSH ──────────────────────────────────────────────────
  {
    key: "pocus_rush",
    label: "RUSH ScanCoach",
    path: "/pocus-rush-scan-coach",
    views: [
      { id: "pump_plax",    name: "The Pump — PLAX",                 group: "Pump" },
      { id: "pump_psax",    name: "The Pump — PSAX",                 group: "Pump" },
      { id: "pump_a4c",     name: "The Pump — Apical 4-Chamber",     group: "Pump" },
      { id: "pump_subcostal",name: "The Pump — Subcostal",           group: "Pump" },
      { id: "tank_ivc",     name: "The Tank — IVC Collapsibility",   group: "Tank" },
      { id: "tank_ruq",     name: "The Tank — RUQ Free Fluid",       group: "Tank" },
      { id: "tank_luq",     name: "The Tank — LUQ Free Fluid",       group: "Tank" },
      { id: "tank_pelvis",  name: "The Tank — Pelvic Free Fluid",    group: "Tank" },
      { id: "pipes_aorta",  name: "The Pipes — Aorta (AAA)",         group: "Pipes" },
      { id: "pipes_dvt",    name: "The Pipes — DVT Assessment",      group: "Pipes" },
      { id: "pipes_ptx",    name: "The Pipes — Pneumothorax",        group: "Pipes" },
    ],
  },
  // ─── POCUS-Assist™ — Cardiac ────────────────────────────────────────────────
  {
    key: "pocus_cardiac",
    label: "Cardiac POCUS ScanCoach",
    path: "/pocus-cardiac-scan-coach",
    views: [
      { id: "plax",         name: "Parasternal Long Axis (PLAX)",    group: "Parasternal" },
      { id: "psax_mv",      name: "PSAX — Mitral Valve Level",       group: "Parasternal" },
      { id: "psax_pm",      name: "PSAX — Papillary Muscle Level",   group: "Parasternal" },
      { id: "a4c",          name: "Apical 4-Chamber",                group: "Apical" },
      { id: "subcostal",    name: "Subcostal 4-Chamber",             group: "Subcostal" },
      { id: "ivc",          name: "Subcostal IVC",                   group: "Subcostal" },
    ],
  },
  // ─── POCUS-Assist™ — Lung ───────────────────────────────────────────────────
  {
    key: "pocus_lung",
    label: "Lung POCUS ScanCoach",
    path: "/pocus-lung-scan-coach",
    views: [
      { id: "rua",          name: "Right Upper Anterior (Zone 1)",   group: "Right Lung" },
      { id: "rla",          name: "Right Lower Anterior (Zone 2)",   group: "Right Lung" },
      { id: "rl_plaps",     name: "Right Lateral — PLAPS Point",     group: "Right Lung" },
      { id: "lua",          name: "Left Upper Anterior (Zone 4)",    group: "Left Lung" },
      { id: "lla",          name: "Left Lower Anterior (Zone 5)",    group: "Left Lung" },
      { id: "ll_plaps",     name: "Left Lateral — PLAPS Point",      group: "Left Lung" },
      { id: "diaphragm_r",  name: "Right Diaphragm",                 group: "Diaphragm" },
      { id: "diaphragm_l",  name: "Left Diaphragm",                  group: "Diaphragm" },
    ],
  },
  // ─── ACHD ─────────────────────────────────────────────────────────────────────────────────
  {
    key: "achd",
    label: "ACHD ScanCoach",
    path: "/scan-coach?tab=achd",
    views: [
      { id: "asd",             name: "ASD Assessment",                      group: "Shunt Lesions" },
      { id: "vsd",             name: "VSD Assessment",                      group: "Shunt Lesions" },
      { id: "tof",             name: "Tetralogy of Fallot (ToF)",           group: "Complex CHD" },
      { id: "coa",             name: "Coarctation of the Aorta (CoA)",      group: "Obstructive" },
      { id: "tga",             name: "d-TGA / Mustard / Senning",           group: "Complex CHD" },
      { id: "fontan",          name: "Fontan Circulation",                  group: "Complex CHD" },
      { id: "ebstein",         name: "Ebstein Anomaly",                     group: "Complex CHD" },
      { id: "psax-av",         name: "PSAX — Aortic Valve Level",           group: "Key Views" },
      { id: "a4c-rv",          name: "Apical 4-Chamber — RV Focus",         group: "Key Views" },
      { id: "subcostal-ivc",   name: "Subcostal — IVC",                     group: "Key Views" },
      { id: "suprasternal",    name: "Suprasternal — Aortic Arch",          group: "Key Views" },
    ],
  },
  // ─── ECG ScanCoach (Lead Placement & Reference) ───────────────────────────────────────────
  {
    key: "ecg",
    label: "ECG ScanCoach",
    path: "/ecg-navigator",
    views: [
      { id: "limb-leads",       name: "Limb Lead Placement (I, II, III, aVR, aVL, aVF)",   group: "Lead Placement" },
      { id: "precordial-leads", name: "Precordial Lead Placement (V1–V6)",                group: "Lead Placement" },
      { id: "right-sided",      name: "Right-Sided Leads (V3R, V4R)",                      group: "Supplemental Leads" },
      { id: "posterior-leads",  name: "Posterior Leads (V7, V8, V9)",                      group: "Supplemental Leads" },
      { id: "neonatal-leads",   name: "Neonatal / Pediatric Lead Placement",               group: "Supplemental Leads" },
      { id: "normal-ecg",       name: "Normal 12-Lead ECG Reference",                      group: "ECG Reference" },
      { id: "stemi-patterns",   name: "STEMI Territory Reference",                         group: "ECG Reference" },
      { id: "lbbb-rbbb",        name: "LBBB vs RBBB Morphology Reference",                 group: "ECG Reference" },
      { id: "brugada-pattern",  name: "Brugada Pattern (Type 1, 2, 3)",                    group: "ECG Reference" },
      { id: "sgarbossa",        name: "Sgarbossa Criteria Reference",                      group: "ECG Reference" },
    ],
  },
];

/** Lookup a module by key */
export function getModuleMeta(key: ScanCoachModule): ScanCoachModuleMeta | undefined {
  return SCANCOACH_MODULES.find((m) => m.key === key);
}

/** Lookup a view within a module */
export function getViewMeta(module: ScanCoachModule, viewId: string): ScanCoachViewMeta | undefined {
  return getModuleMeta(module)?.views.find((v) => v.id === viewId);
}

/** All editable image slots */
export const IMAGE_SLOTS = [
  { key: "echoImageUrl",       label: "Clinical Echo Image",      hint: "The echo image shown in the view reference panel" },
  { key: "anatomyImageUrl",    label: "Anatomy Reference Image",  hint: "Anatomy diagram or labelled schematic" },
  { key: "transducerImageUrl", label: "Transducer Position Image",hint: "Probe/transducer positioning photograph or diagram" },
] as const;

export type ImageSlotKey = typeof IMAGE_SLOTS[number]["key"];

/** All editable text fields */
export const TEXT_FIELDS = [
  { key: "description",      label: "Description",       multiline: true,  isArray: false },
  { key: "howToGet",         label: "How To Get",        multiline: true,  isArray: true  },
  { key: "tips",             label: "Tips",              multiline: false, isArray: true  },
  { key: "pitfalls",         label: "Pitfalls",          multiline: false, isArray: true  },
  { key: "structures",       label: "Structures",        multiline: false, isArray: true  },
  { key: "measurements",     label: "Key Measurements",  multiline: false, isArray: true  },
  { key: "criticalFindings", label: "Critical Findings", multiline: false, isArray: true  },
] as const;

export type TextFieldKey = typeof TEXT_FIELDS[number]["key"];
