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
  | "fetal_chd"
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
  | "ecg"
  // Mechanical Circulatory Support
  | "mcs_lvad"
  | "mcs_ecmo"
  | "mcs_impella_25"
  | "mcs_impella_cp"
  | "mcs_impella_55"
  | "mcs_impella_ecp"
  | "mcs_impella_rp"
  | "mcs_lifevest"
  | "mcs_icd"
  // ─── AAUS modules ───────────────────────────────────────────────────────────
  | "abdominal"
  | "pelvic_gyn"
  | "ob1"
  | "ob23"
  | "thyroid"
  | "scrotum"
  | "venous"
  | "arterial"
  | "abdominal_vascular"
  | "aorta"
  | "carotid"
  | "tcd"
  | "msk"
  | "breast"
  | "appendix"
  | "invasive_procedures"
  | "pediatric";

export interface ScanCoachViewMeta {
  id: string;
  name: string;
  group?: string;
  /**
   * Number of independent clinical+reference image pairs for this view.
   * Defaults to 1. Set to 2 for views that need a second pair (e.g. SAX + LAX).
   */
  mediaPairs?: number;
}

export interface ScanCoachModuleMeta {
  key: ScanCoachModule;
  label: string;
  path: string;
  views: ScanCoachViewMeta[];
  brand: "iheartecho" | "aaus" | "both";
}

export const SCANCOACH_MODULES: ScanCoachModuleMeta[] = [
  // ─── Adult TTE ────────────────────────────────────────────────────────────
  {
    key: "tte",
    brand: "iheartecho",
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
    brand: "iheartecho",
    label: "TEE ScanCoach",
    path: "/tee-scan-coach",
    views: [
      // Overview (1)
      { id: "tee_overview",      name: "TEE Overview",                  group: "Overview" },
      // Mid-Esophageal (14)
      { id: "me5c",              name: "ME 5-Chamber",                  group: "Mid-Esophageal" },
      { id: "me4c",              name: "ME 4-Chamber",                  group: "Mid-Esophageal" },
      { id: "me_mc",             name: "ME Mitral Commissural",         group: "Mid-Esophageal" },
      { id: "me2c",              name: "ME 2-Chamber",                  group: "Mid-Esophageal" },
      { id: "melax",             name: "ME Long Axis",                  group: "Mid-Esophageal" },
      { id: "me_av_lax",         name: "ME AV Long Axis",               group: "Mid-Esophageal" },
      { id: "me_asc_ao_lax",     name: "ME Ascending Aorta LAX",       group: "Mid-Esophageal" },
      { id: "me_asc_ao_sax",     name: "ME Ascending Aorta SAX",       group: "Mid-Esophageal" },
      { id: "me_rpv",            name: "ME Right Pulmonary Vein",       group: "Mid-Esophageal" },
      { id: "meavsax",           name: "ME AV Short Axis",              group: "Mid-Esophageal" },
      { id: "mervio",            name: "ME RV Inflow-Outflow",          group: "Mid-Esophageal" },
      { id: "me_mod_bicaval_tv", name: "ME Modified Bicaval TV",        group: "Mid-Esophageal" },
      { id: "mebicaval",         name: "ME Bicaval",                    group: "Mid-Esophageal" },
      { id: "me_laa",            name: "ME Left Atrial Appendage",      group: "Mid-Esophageal" },
      // Transgastric (9)
      { id: "tgbasal",           name: "TG Basal SAX",                  group: "Transgastric" },
      { id: "tgsax",             name: "TG Mid Papillary SAX",          group: "Transgastric" },
      { id: "tg_apical_sax",     name: "TG Apical SAX",                 group: "Transgastric" },
      { id: "tg_rv_basal",       name: "TG RV Basal",                   group: "Transgastric" },
      { id: "tg_rv_io",          name: "TG RV Inflow-Outflow",          group: "Transgastric" },
      { id: "deep_tg_5c",        name: "Deep TG 5-Chamber",             group: "Transgastric" },
      { id: "tg2c",              name: "TG 2-Chamber",                  group: "Transgastric" },
      { id: "tg_rv_inflow",      name: "TG RV Inflow",                  group: "Transgastric" },
      { id: "tglax",             name: "TG Long Axis",                  group: "Transgastric" },
      // Upper Esophageal (4)
      { id: "ue_rpv",            name: "UE Right Pulmonary Veins",      group: "Upper Esophageal" },
      { id: "ue_lpv",            name: "UE Left Pulmonary Veins",       group: "Upper Esophageal" },
      { id: "ueaorticarch",      name: "UE Aortic Arch LAX",            group: "Upper Esophageal", mediaPairs: 2 },
      { id: "ue_arch_sax",       name: "UE Aortic Arch SAX",            group: "Upper Esophageal" },
      // Aorta (2)
      { id: "desc_ao_sax",       name: "Descending Aorta SAX",          group: "Aorta" },
      { id: "desc_ao_lax",       name: "Descending Aorta LAX",          group: "Aorta" },
    ],
  },
  // ─── ICE ──────────────────────────────────────────────────────────────────
  {
    key: "ice",
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
    label: "HOCM-Assist™ ScanCoach",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "both",
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
  // ─── Fetal Echo CHD ───────────────────────────────────────────────────────
  {
    key: "fetal_chd",
    brand: "iheartecho",
    label: "Fetal CHD ScanCoach",
    path: "/fetal-scan-coach",
    views: [
      { id: "chd_vsd",               name: "Ventricular Septal Defect (VSD)",                group: "Septal Defects" },
      { id: "chd_asd",               name: "Atrial Septal Defect (ASD)",                    group: "Septal Defects" },
      { id: "chd_avsd",              name: "Atrioventricular Septal Defect (AVSD)",          group: "Septal Defects" },
      { id: "chd_tof",               name: "Tetralogy of Fallot (TOF)",                     group: "Outflow Tract" },
      { id: "chd_ps",                name: "Pulmonary Stenosis / Atresia",                  group: "Outflow Tract" },
      { id: "chd_as",                name: "Aortic Stenosis / Critical AS",                 group: "Outflow Tract" },
      { id: "chd_ebstein",           name: "Ebstein Anomaly",                               group: "Valve Anomalies" },
      { id: "chd_tricuspid_atresia", name: "Tricuspid Atresia",                             group: "Valve Anomalies" },
      { id: "chd_tga",               name: "Transposition of the Great Arteries (TGA)",    group: "Great Vessel" },
      { id: "chd_coa",               name: "Coarctation of the Aorta (CoA)",               group: "Great Vessel" },
      { id: "chd_tapvr",             name: "Total Anomalous Pulmonary Venous Return (TAPVR)",group: "Great Vessel" },
      { id: "chd_hlhs",              name: "Hypoplastic Left Heart Syndrome (HLHS)",        group: "Complex / Conotruncal" },
      { id: "chd_truncus",           name: "Truncus Arteriosus",                            group: "Complex / Conotruncal" },
      { id: "chd_dorv",              name: "Double Outlet Right Ventricle (DORV)",          group: "Complex / Conotruncal" },
      { id: "chd_heterotaxy",        name: "Heterotaxy / Situs Ambiguus",                   group: "Situs / Heterotaxy" },
    ],
  },
  // ─── Pediatric / CHD ──────────────────────────────────────────────────────
  {
    key: "chd",
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
    brand: "iheartecho",
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
  // ─── Mechanical Circulatory Support ────────────────────────────────────────
  {
    key: "mcs_lvad",
    brand: "iheartecho",
    label: "LVAD ScanCoach",
    path: "/mechanical-support-scan-coach?device=lvad",
    views: [
      { id: "plax_cannula",    name: "PLAX — Inflow Cannula Position",          group: "LVAD" },
      { id: "a5c_cannula",     name: "A5C — Cannula Tip Confirmation",          group: "LVAD" },
      { id: "a4c_rv",          name: "A4C — RV Function",                       group: "LVAD" },
      { id: "a4c_lv",          name: "A4C — LV Decompression",                  group: "LVAD" },
      { id: "subcostal_ivc",   name: "Subcostal — IVC / RAP",                   group: "LVAD" },
      { id: "cw_ar",           name: "CW Doppler — AR Assessment",              group: "LVAD" },
      { id: "pw_cannula",      name: "PW Doppler — Inflow Cannula Velocity",    group: "LVAD" },
    ],
  },
  {
    key: "mcs_ecmo",
    brand: "iheartecho",
    label: "ECMO ScanCoach",
    path: "/mechanical-support-scan-coach?device=ecmo",
    views: [
      { id: "plax_lv",         name: "PLAX — LV Distension Assessment",         group: "VA-ECMO" },
      { id: "a4c_av",          name: "A4C — AV Opening",                        group: "VA-ECMO" },
      { id: "a4c_ef",          name: "A4C — LV EF (Weaning)",                   group: "VA-ECMO" },
      { id: "subcostal_ivc",   name: "Subcostal — IVC",                         group: "VA-ECMO" },
      { id: "tee_bicaval",     name: "TEE Bicaval — Venous Cannula",            group: "Cannula" },
      { id: "tee_melax",       name: "TEE ME LAX — Arterial Cannula",           group: "Cannula" },
      { id: "avalon_jet",      name: "Avalon Return Jet (VV-ECMO)",             group: "VV-ECMO" },
    ],
  },
  {
    key: "mcs_impella_25",
    brand: "iheartecho",
    label: "Impella 2.5 ScanCoach",
    path: "/mechanical-support-scan-coach?device=impella",
    views: [
      { id: "plax_inlet",      name: "PLAX — Inlet-to-AV Distance",             group: "Positioning" },
      { id: "a5c_outlet",      name: "A5C — Outlet Confirmation",               group: "Positioning" },
      { id: "tee_melax",       name: "TEE ME LAX — Inlet Confirmation",         group: "Positioning" },
      { id: "a4c_lv_unload",   name: "A4C — LV Unloading & MV",                group: "Monitoring" },
      { id: "plax_ar_serial",  name: "PLAX Color Doppler — AR Assessment",      group: "Monitoring" },
    ],
  },
  {
    key: "mcs_impella_cp",
    brand: "iheartecho",
    label: "Impella CP ScanCoach",
    path: "/mechanical-support-scan-coach?device=impella",
    views: [
      { id: "plax_inlet",      name: "PLAX — Inlet-to-AV Distance",             group: "Positioning" },
      { id: "a5c_outlet",      name: "A5C — Outlet Confirmation",               group: "Positioning" },
      { id: "tee_melax",       name: "TEE ME LAX — Inlet Confirmation",         group: "Positioning" },
      { id: "a4c_lv_unload",   name: "A4C — LV Unloading & MV",                group: "Monitoring" },
      { id: "plax_ar_serial",  name: "PLAX Color Doppler — AR Assessment",      group: "Monitoring" },
      { id: "ecpella_av",       name: "PLAX — ECPELLA AV Opening",               group: "ECPELLA" },
    ],
  },
  {
    key: "mcs_impella_55",
    brand: "iheartecho",
    label: "Impella 5.5 ScanCoach",
    path: "/mechanical-support-scan-coach?device=impella",
    views: [
      { id: "plax_inlet",      name: "PLAX — Inlet-to-AV Distance",             group: "Positioning" },
      { id: "a5c_outlet",      name: "A5C — Outlet Confirmation",               group: "Positioning" },
      { id: "tee_melax",       name: "TEE ME LAX — Inlet Confirmation",         group: "Positioning" },
      { id: "a4c_lv_unload",   name: "A4C — LV Unloading & MV",                group: "Monitoring" },
      { id: "plax_ar_serial",  name: "PLAX Color Doppler — AR Assessment (21Fr)", group: "Monitoring" },
      { id: "bridge_serial",   name: "Serial Echo — Bridge-to-LVAD/Transplant", group: "Bridge Assessment" },
    ],
  },
  {
    key: "mcs_impella_ecp",
    brand: "iheartecho",
    label: "Impella ECP ScanCoach",
    path: "/mechanical-support-scan-coach?device=impella",
    views: [
      { id: "plax_expansion",  name: "PLAX — Pump Expansion Confirmation",       group: "Positioning" },
      { id: "plax_inlet",      name: "PLAX — Inlet-to-AV Distance",             group: "Positioning" },
      { id: "a5c_outlet",      name: "A5C — Outlet Confirmation",               group: "Positioning" },
      { id: "tee_melax",       name: "TEE ME LAX — Inlet Confirmation",         group: "Positioning" },
      { id: "a4c_lv_unload",   name: "A4C — LV Unloading & MV",                group: "Monitoring" },
      { id: "plax_ar_serial",  name: "PLAX Color Doppler — AR Assessment",      group: "Monitoring" },
    ],
  },
  {
    key: "mcs_impella_rp",
    brand: "iheartecho",
    label: "Impella RP ScanCoach",
    path: "/mechanical-support-scan-coach?device=impella",
    views: [
      { id: "subcostal_inlet", name: "Subcostal IVC — Inlet Position",           group: "Positioning" },
      { id: "psax_outlet",     name: "PSAX at AV Level — Outlet in Main PA",     group: "Positioning" },
      { id: "tee_bicaval",     name: "TEE Bicaval — Inlet Confirmation",         group: "Positioning" },
      { id: "tee_rvio",        name: "TEE RV Inflow-Outflow — Outlet",          group: "Positioning" },
      { id: "a4c_rv_unload",   name: "A4C — RV Unloading (TAPSE, RV S')",       group: "Monitoring" },
    ],
  },
  {
    key: "mcs_lifevest",
    brand: "iheartecho",
    label: "LifeVest (WCD) ScanCoach",
    path: "/mechanical-support-scan-coach?device=lifevest",
    views: [
      { id: "a4c_ef",          name: "A4C — Biplane EF (Simpson's)",            group: "EF Assessment" },
      { id: "a2c_ef",          name: "A2C — Biplane EF (Simpson's)",            group: "EF Assessment" },
      { id: "plax_lv",         name: "PLAX — LV Dimensions (M-mode)",           group: "EF Assessment" },
      { id: "a4c_wma",         name: "A4C — Wall Motion Assessment",            group: "EF Assessment" },
      { id: "a4c_rv",          name: "A4C — RV Function",                       group: "Follow-Up" },
      { id: "a4c_diastolic",   name: "A4C — Diastolic Function",                group: "Follow-Up" },
    ],
  },
  {
    key: "mcs_icd",
    brand: "iheartecho",
    label: "ICD / CRT-D ScanCoach",
    path: "/mechanical-support-scan-coach?device=icd",
    views: [
      { id: "a4c_ef",          name: "A4C — Biplane EF (Simpson's)",            group: "ICD Decision" },
      { id: "a2c_ef",          name: "A2C — Biplane EF (Simpson's)",            group: "ICD Decision" },
      { id: "plax_lv",         name: "PLAX — LV Dimensions",                    group: "ICD Decision" },
      { id: "plax_mmode",      name: "PLAX M-Mode — SPWMD (CRT)",               group: "CRT Eligibility" },
      { id: "pw_ivmd",         name: "PW Doppler — IVMD (CRT)",                 group: "CRT Eligibility" },
      { id: "subcostal_lead",  name: "Subcostal — Post-Implant Effusion",       group: "Post-Implant" },
      { id: "a4c_lead",        name: "A4C — RV Lead Position",                  group: "Post-Implant" },
    ],
  },

  // ─── AAUS Modules ─────────────────────────────────────────────────────────
  {
    key: "abdominal",
    brand: "aaus",
    label: "Abdominal ScanCoach",
    path: "/abdominal-scan-coach",
    views: [
      { id: "pancreas",     name: "Pancreas",                        group: "Abdominal" },
      { id: "aorta",        name: "Aorta",                           group: "Abdominal" },
      { id: "ivc",          name: "Inferior Vena Cava (IVC)",        group: "Abdominal" },
      { id: "liver",        name: "Liver",                           group: "Abdominal" },
      { id: "gallbladder",  name: "Gallbladder and Biliary Tract",   group: "Abdominal" },
      { id: "kidneys",      name: "Kidneys",                         group: "Abdominal" },
      { id: "spleen",       name: "Spleen",                          group: "Abdominal" },
    ],
  },
  {
    key: "pelvic_gyn",
    brand: "aaus",
    label: "Pelvic / Gyn ScanCoach",
    path: "/pelvic-gyn-scan-coach",
    views: [
      { id: "uterus_sag",   name: "Uterus",                          group: "Pelvic" },
      { id: "adnexa",       name: "Adnexa / Ovaries",                group: "Pelvic" },
      { id: "cul_de_sac",   name: "Cul-de-Sac",                      group: "Pelvic" },
      { id: "endometrium",  name: "Endometrium",                     group: "Pelvic" },
    ],
  },
  {
    key: "ob1",
    brand: "aaus",
    label: "OB First Trimester ScanCoach",
    path: "/ob1-scan-coach",
    views: [
      { id: "gest_sac",     name: "Gestational Sac",                 group: "First Trimester" },
      { id: "yolk_sac",     name: "Yolk Sac",                        group: "First Trimester" },
      { id: "embryo",       name: "Embryo / CRL Measurement",        group: "First Trimester" },
      { id: "nt",           name: "Nuchal Translucency (NT)",        group: "First Trimester" },
      { id: "uterus",       name: "Uterus, Cervix & Adnexa",         group: "First Trimester" },
      { id: "anatomy",      name: "Early Anatomy Survey (11-14 wks)",group: "First Trimester" },
    ],
  },
  {
    key: "ob23",
    brand: "aaus",
    label: "OB 2nd/3rd Trimester ScanCoach",
    path: "/ob23-scan-coach",
    views: [
      { id: "head_neck",    name: "Head & Brain",                    group: "Anatomy Survey" },
      { id: "face",         name: "Face",                            group: "Anatomy Survey" },
      { id: "chest",        name: "Chest & Heart",                   group: "Anatomy Survey" },
      { id: "abdomen",      name: "Abdomen",                         group: "Anatomy Survey" },
      { id: "spine",        name: "Spine",                           group: "Anatomy Survey" },
      { id: "extremities",  name: "Extremities",                     group: "Anatomy Survey" },
      { id: "genitalia",    name: "Genitalia",                       group: "Anatomy Survey" },
      { id: "placenta",     name: "Placenta",                        group: "Anatomy Survey" },
      { id: "amniotic_fluid",name: "Amniotic Fluid",                 group: "Anatomy Survey" },
      { id: "biometry",     name: "Biometry",                        group: "Biometry" },
      { id: "maternal",     name: "Maternal Anatomy",                group: "Maternal" },
    ],
  },
  {
    key: "thyroid",
    brand: "aaus",
    label: "Thyroid ScanCoach",
    path: "/thyroid-scan-coach",
    views: [
      { id: "trans_right",  name: "Transverse Survey - Right Lobe",  group: "Thyroid" },
      { id: "long_right",   name: "Longitudinal Survey - Right Lobe",group: "Thyroid" },
      { id: "trans_left",   name: "Transverse Survey - Left Lobe",   group: "Thyroid" },
      { id: "long_left",    name: "Longitudinal Survey - Left Lobe", group: "Thyroid" },
      { id: "isthmus",      name: "Isthmus",                         group: "Thyroid" },
      { id: "nodule",       name: "Nodule Characterization (TI-RADS)",group: "Thyroid" },
      { id: "lymph_nodes",  name: "Cervical Lymph Nodes",            group: "Thyroid" },
      { id: "parathyroid",  name: "Parathyroid Glands",              group: "Thyroid" },
      { id: "fna",          name: "Ultrasound-Guided FNA / Biopsy",  group: "Thyroid" },
    ],
  },
  {
    key: "scrotum",
    brand: "aaus",
    label: "Scrotum ScanCoach",
    path: "/scrotum-scan-coach",
    views: [
      { id: "global",       name: "Survey - Both Testes",            group: "Scrotum" },
      { id: "testis_r_trans",name: "Right Testis - Transverse",      group: "Scrotum" },
      { id: "testis_r_long", name: "Right Testis - Longitudinal",    group: "Scrotum" },
      { id: "testis_l",     name: "Left Testis - Trans & Long",      group: "Scrotum" },
      { id: "epididymis",   name: "Epididymis",                      group: "Scrotum" },
      { id: "spermatic_cord",name: "Spermatic Cord & Varicocele",    group: "Scrotum" },
      { id: "scrotal_wall", name: "Scrotal Wall & Hydrocele",        group: "Scrotum" },
    ],
  },
  {
    key: "venous",
    brand: "aaus",
    label: "Venous ScanCoach",
    path: "/venous-scan-coach",
    views: [
      { id: "cfv",          name: "Common Femoral Vein (CFV)",       group: "Lower Extremity DVT" },
      { id: "fv",           name: "Femoral Vein (FV)",               group: "Lower Extremity DVT" },
      { id: "dfv",          name: "Deep Femoral Vein (DFV)",         group: "Lower Extremity DVT" },
      { id: "gsv",          name: "Great Saphenous Vein (GSV)",      group: "Lower Extremity DVT" },
      { id: "popliteal",    name: "Popliteal Vein",                  group: "Lower Extremity DVT" },
      { id: "ptv",          name: "Posterior Tibial Veins (PTV)",    group: "Lower Extremity DVT" },
      { id: "peroneal",     name: "Peroneal Veins",                  group: "Lower Extremity DVT" },
      { id: "gastro_soleal",name: "Gastrocnemius and Soleal Veins",  group: "Lower Extremity DVT" },
    ],
  },
  {
    key: "arterial",
    brand: "aaus",
    label: "Arterial ScanCoach",
    path: "/arterial-scan-coach",
    views: [
      { id: "segmental",    name: "Segmental Limb Pressures",        group: "Arterial" },
      { id: "cw_doppler",   name: "CW Doppler Waveforms",            group: "Arterial" },
      { id: "pvr",          name: "Pulse Volume Recordings (PVRs)",  group: "Arterial" },
      { id: "tcpo2",        name: "Transcutaneous Oxygen (tcPO2)",   group: "Arterial" },
      { id: "ppg",          name: "Photoplethysmography (PPG)",      group: "Arterial" },
    ],
  },
  {
    key: "abdominal_vascular",
    brand: "aaus",
    label: "Abdominal Vascular ScanCoach",
    path: "/abdominal-vascular-scan-coach",
    views: [
      { id: "portal_vein",  name: "Portal Vein - Main",              group: "Liver Vasculature" },
      { id: "hepatic_veins",name: "Hepatic Veins",                   group: "Liver Vasculature" },
      { id: "hepatic_artery",name: "Hepatic Artery",                 group: "Liver Vasculature" },
      { id: "liver_parenchyma",name: "Liver Parenchyma",             group: "Liver Vasculature" },
      { id: "sma",          name: "Superior Mesenteric Artery (SMA)",group: "Mesenteric" },
      { id: "celiac",       name: "Celiac Axis (CA)",                group: "Mesenteric" },
      { id: "ima",          name: "Inferior Mesenteric Artery (IMA)",group: "Mesenteric" },
      { id: "renal_arteries",name: "Renal Arteries",                 group: "Renal" },
    ],
  },
  {
    key: "aorta",
    brand: "aaus",
    label: "Aorta ScanCoach",
    path: "/aorta-scan-coach",
    views: [
      { id: "prox_long",    name: "Proximal Aorta - Long",           group: "Aorta" },
      { id: "prox_trans",   name: "Proximal Aorta - Trans",          group: "Aorta" },
      { id: "mid_long",     name: "Mid Aorta - Long",                group: "Aorta" },
      { id: "mid_trans",    name: "Mid Aorta - Trans",               group: "Aorta" },
      { id: "dist_long",    name: "Distal Aorta - Long",             group: "Aorta" },
      { id: "dist_trans",   name: "Distal Aorta - Trans",            group: "Aorta" },
      { id: "iliac_long",   name: "Common Iliac Arteries - Long",    group: "Aorta" },
      { id: "iliac_trans",  name: "Common Iliac Arteries - Trans",   group: "Aorta" },
    ],
  },
  {
    key: "carotid",
    brand: "aaus",
    label: "Carotid ScanCoach",
    path: "/carotid-scan-coach",
    views: [
      { id: "cca",          name: "Common Carotid Artery (CCA)",     group: "Carotid" },
      { id: "bifurcation",  name: "Carotid Bifurcation",             group: "Carotid" },
      { id: "ica",          name: "Internal Carotid Artery (ICA)",   group: "Carotid" },
      { id: "eca",          name: "External Carotid Artery (ECA)",   group: "Carotid" },
      { id: "vertebral",    name: "Vertebral Artery",                group: "Carotid" },
      { id: "subclavian",   name: "Subclavian Artery",               group: "Carotid" },
    ],
  },
  {
    key: "tcd",
    brand: "aaus",
    label: "TCD ScanCoach",
    path: "/tcd-scan-coach",
    views: [
      { id: "transtemporal",name: "Transtemporal - MCA/ACA/PCA",     group: "TCD" },
      { id: "transorbital", name: "Transorbital - Ophthalmic / ICA", group: "TCD" },
      { id: "post_circ",    name: "Suboccipital - Vertebral/Basilar",group: "TCD" },
      { id: "submandibular",name: "Submandibular - Distal ICA",      group: "TCD" },
      { id: "ant_fontanelle",name: "Anterior Fontanelle (Neonates)", group: "TCD" },
    ],
  },
  {
    key: "msk",
    brand: "aaus",
    label: "MSK ScanCoach",
    path: "/msk-scan-coach",
    views: [
      { id: "shoulder",     name: "Shoulder",                        group: "MSK" },
      { id: "elbow",        name: "Elbow",                           group: "MSK" },
      { id: "wrist",        name: "Wrist",                           group: "MSK" },
      { id: "hand",         name: "Hand",                            group: "MSK" },
      { id: "hip",          name: "Hip",                             group: "MSK" },
      { id: "knee",         name: "Knee",                            group: "MSK" },
      { id: "ankle",        name: "Ankle",                           group: "MSK" },
      { id: "foot",         name: "Foot",                            group: "MSK" },
    ],
  },
  {
    key: "breast",
    brand: "aaus",
    label: "Breast ScanCoach",
    path: "/breast-scan-coach",
    views: [
      { id: "whole_breast", name: "Whole-Breast Survey (Bilateral)", group: "Breast" },
      { id: "lesion_char",  name: "Breast Lesion Characterization",  group: "Breast" },
      { id: "cyst",         name: "Cyst Assessment",                 group: "Breast" },
      { id: "axillary_ln",  name: "Axillary Lymph Node Assessment",  group: "Breast" },
      { id: "doppler",      name: "Doppler Assessment of Lesions",   group: "Breast" },
      { id: "biopsy",       name: "Ultrasound-Guided Biopsy",        group: "Breast" },
      { id: "localisation", name: "Pre-Surgical Lumpectomy Localisation",group: "Breast" },
    ],
  },
  {
    key: "appendix",
    brand: "aaus",
    label: "Appendix ScanCoach",
    path: "/appendix-scan-coach",
    views: [
      { id: "rlq_survey",   name: "RLQ Survey - Graded Compression", group: "Appendix" },
      { id: "appendix_id",  name: "Appendix Identification",         group: "Appendix" },
      { id: "periappendiceal",name: "Periappendiceal Assessment",    group: "Appendix" },
      { id: "alt_diagnoses",name: "Alternative RLQ Diagnoses",       group: "Appendix" },
    ],
  },
  {
    key: "invasive_procedures",
    brand: "aaus",
    label: "Invasive Procedures ScanCoach",
    path: "/invasive-procedures-scan-coach",
    views: [
      { id: "thoracentesis_site",     name: "Thoracentesis - Site Selection",   group: "Procedures" },
      { id: "thoracentesis_guidance", name: "Thoracentesis - Needle Guidance",  group: "Procedures" },
      { id: "paracentesis_site",      name: "Paracentesis - Site Selection",    group: "Procedures" },
      { id: "paracentesis_guidance",  name: "Paracentesis - Needle Guidance",   group: "Procedures" },
    ],
  },
  {
    key: "pediatric",
    brand: "aaus",
    label: "Pediatric ScanCoach",
    path: "/pediatric-scan-coach",
    views: [
      { id: "appendix",        name: "Appendix",          group: "Pediatric" },
      { id: "intussusception", name: "Intussusception",   group: "Pediatric" },
      { id: "pyloric",         name: "Pyloric Stenosis",  group: "Pediatric" },
      { id: "kidneys",         name: "Kidneys",           group: "Pediatric" },
      { id: "spine",           name: "Spine",             group: "Pediatric" },
      { id: "hips",            name: "Hips",              group: "Pediatric" },
      { id: "neuro",           name: "Neuro",             group: "Pediatric" },
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
  { key: "echoImageUrl",        label: "Clinical Echo Image",        hint: "The echo image shown in the view reference panel" },
  { key: "anatomyImageUrl",     label: "Anatomy Reference Image",    hint: "Anatomy diagram or labelled schematic" },
  { key: "transducerImageUrl",  label: "Transducer Position Image",  hint: "Probe/transducer positioning photograph or diagram" },
  { key: "anatomy2ImageUrl",    label: "Clinical Image 2",           hint: "Second clinical image (pair 2)" },
  { key: "transducer2ImageUrl", label: "Reference Image 2",          hint: "Second reference image (pair 2)" },
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

/**
 * Dev-mode validation utility.
 * Call this at the module level of each ScanCoach page to detect when the
 * live page's `views` array is out of sync with the registry.
 *
 * Usage (in each ScanCoach page, outside the component):
 *   if (import.meta.env.DEV) validateViewsAgainstRegistry("hocm", views.map(v => v.id));
 *
 * This ensures any view added to the registry is also added to the live page,
 * and any view removed from the registry is removed from the live page.
 */
export function validateViewsAgainstRegistry(
  module: ScanCoachModule,
  liveViewIds: string[]
): void {
  if (!import.meta.env.DEV) return;
  const meta = getModuleMeta(module);
  if (!meta) {
    console.warn(`[ScanCoach] Module "${module}" not found in registry.`);
    return;
  }
  const registryIds = new Set(meta.views.map((v) => v.id));
  const liveIds = new Set(liveViewIds);

  const missingInLive = Array.from(registryIds).filter((id) => !liveIds.has(id));
  const extraInLive = Array.from(liveIds).filter((id) => !registryIds.has(id));

  if (missingInLive.length > 0) {
    console.warn(
      `[ScanCoach] Module "${module}": views in registry but MISSING from live page — add them to the views array:\n  ${missingInLive.join(", ")}`
    );
  }
  if (extraInLive.length > 0) {
    console.warn(
      `[ScanCoach] Module "${module}": views in live page but NOT in registry — add them to scanCoachRegistry.ts:\n  ${extraInLive.join(", ")}`
    );
  }
}
