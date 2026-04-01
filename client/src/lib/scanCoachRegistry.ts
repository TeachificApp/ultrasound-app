/**
 * scanCoachRegistry.ts
 * Static registry of ALL ScanCoach modules and their views.
 * Used by the WYSIWYG ScanCoach Editor (admin) to enumerate modules/views
 * and by the override hook to know which fields are editable per module.
 *
 * Modules:
 *   General & Small Parts: abdominal, pelvic_gyn, ob1, ob23, thyroid, scrotum
 *   Breast: breast
 *   Vascular: venous, arterial, abdominal_vascular, aorta, carotid, tcd
 *   MSK: msk
 *   Fetal Echo: fetal
 *   POCUS-Assist™: pocus_efast, pocus_rush, pocus_cardiac, pocus_lung
 */

export type ScanCoachModule =
  // General & Small Parts
  | "abdominal"
  | "pelvic_gyn"
  | "ob1"
  | "ob23"
  | "thyroid"
  | "scrotum"
  // Breast
  | "breast"
  // Vascular
  | "venous"
  | "arterial"
  | "abdominal_vascular"
  | "aorta"
  | "carotid"
  | "tcd"
  // MSK
  | "msk"
  // Fetal Echo
  | "fetal"
  // POCUS-Assist™
  | "pocus_efast"
  | "pocus_rush"
  | "pocus_cardiac"
  | "pocus_lung"
  // Procedures
  | "appendix"
  | "invasive_procedures";

export interface ScanCoachViewMeta {
  id: string;
  name: string;
  group?: string;
}

export interface ScanCoachModuleMeta {
  key: ScanCoachModule;
  label: string;
  path: string;
  category: string;
  views: ScanCoachViewMeta[];
}

export const SCANCOACH_MODULES: ScanCoachModuleMeta[] = [
  // ─── General & Small Parts ────────────────────────────────────────────────
  {
    key: "abdominal",
    label: "Abdominal ScanCoach",
    path: "/abdominal-scan-coach",
    category: "General",
    views: [
      { id: "liver",       name: "Liver",                        group: "Solid Organs" },
      { id: "gallbladder", name: "Gallbladder and Biliary Tract", group: "Solid Organs" },
      { id: "pancreas",    name: "Pancreas",                     group: "Solid Organs" },
      { id: "spleen",      name: "Spleen",                       group: "Solid Organs" },
      { id: "kidneys",     name: "Kidneys",                      group: "Solid Organs" },
      { id: "aorta",       name: "Aorta",                        group: "Vascular" },
      { id: "ivc",         name: "Inferior Vena Cava (IVC)",     group: "Vascular" },
    ],
  },
  {
    key: "pelvic_gyn",
    label: "Pelvic/Gyn ScanCoach",
    path: "/pelvic-gyn-scan-coach",
    category: "General",
    views: [
      { id: "uterus_sag", name: "Uterus - Sagittal",                       group: "Pelvic" },
      { id: "adnexa",     name: "Adnexa (Ovaries and Fallopian Tubes)",     group: "Pelvic" },
      { id: "cul_de_sac", name: "Cul-de-Sac",                              group: "Pelvic" },
    ],
  },
  {
    key: "ob1",
    label: "OB 1st Trimester ScanCoach",
    path: "/ob1-scan-coach",
    category: "Obstetric",
    views: [
      { id: "gest_sac",   name: "Gestational Sac",          group: "1st Trimester" },
      { id: "embryo",     name: "Embryo/Fetus",             group: "1st Trimester" },
      { id: "nt",         name: "Nuchal Translucency (NT)", group: "1st Trimester" },
      { id: "fetal_head", name: "Fetal Anatomy - Head",     group: "1st Trimester" },
    ],
  },
  {
    key: "ob23",
    label: "OB 2nd/3rd Trimester ScanCoach",
    path: "/ob23-scan-coach",
    category: "Obstetric",
    views: [
      { id: "head_neck",     name: "Head and Neck",    group: "Anatomy Survey" },
      { id: "face",          name: "Face",             group: "Anatomy Survey" },
      { id: "chest",         name: "Chest",            group: "Anatomy Survey" },
      { id: "abdomen",       name: "Abdomen",          group: "Anatomy Survey" },
      { id: "spine",         name: "Spine",            group: "Anatomy Survey" },
      { id: "extremities",   name: "Extremities",      group: "Anatomy Survey" },
      { id: "genitalia",     name: "Genitalia",        group: "Anatomy Survey" },
      { id: "placenta",      name: "Placenta",         group: "Biophysical" },
      { id: "amniotic_fluid",name: "Amniotic Fluid",   group: "Biophysical" },
      { id: "biometry",      name: "Biometry",         group: "Biophysical" },
      { id: "maternal",      name: "Maternal Anatomy", group: "Maternal" },
    ],
  },
  {
    key: "thyroid",
    label: "Thyroid ScanCoach",
    path: "/thyroid-scan-coach",
    category: "Small Parts",
    views: [
      { id: "trans_right", name: "Transverse Right Lobe",   group: "Thyroid" },
      { id: "long_right",  name: "Longitudinal Right Lobe", group: "Thyroid" },
      { id: "trans_left",  name: "Transverse Left Lobe",    group: "Thyroid" },
      { id: "long_left",   name: "Longitudinal Left Lobe",  group: "Thyroid" },
      { id: "isthmus",     name: "Transverse Isthmus",      group: "Thyroid" },
      { id: "lymph_nodes", name: "Cervical Lymph Nodes",    group: "Adjacent Structures" },
      { id: "parathyroid", name: "Parathyroid Glands",      group: "Adjacent Structures" },
    ],
  },
  {
    key: "scrotum",
    label: "Scrotum ScanCoach",
    path: "/scrotum-scan-coach",
    category: "Small Parts",
    views: [
      { id: "global",         name: "Global View",    group: "Scrotal" },
      { id: "testis",         name: "Testis",         group: "Scrotal" },
      { id: "epididymis",     name: "Epididymis",     group: "Scrotal" },
      { id: "spermatic_cord", name: "Spermatic Cord", group: "Scrotal" },
      { id: "scrotal_wall",   name: "Scrotal Wall",   group: "Scrotal" },
    ],
  },
  // ─── Breast ───────────────────────────────────────────────────────────────
  {
    key: "breast",
    label: "Breast ScanCoach",
    path: "/breast-scan-coach",
    category: "Breast",
    views: [
      { id: "lesion",      name: "Breast Lesion Characterization",       group: "Breast" },
      { id: "axillary_ln", name: "Axillary Lymph Node Characterization", group: "Breast" },
    ],
  },
  // ─── Vascular ─────────────────────────────────────────────────────────────
  {
    key: "venous",
    label: "Venous ScanCoach",
    path: "/venous-scan-coach",
    category: "Vascular",
    views: [
      { id: "cfv",           name: "Common Femoral Vein (CFV)",      group: "Lower Extremity" },
      { id: "fv",            name: "Femoral Vein (FV)",              group: "Lower Extremity" },
      { id: "dfv",           name: "Deep Femoral Vein (DFV)",        group: "Lower Extremity" },
      { id: "gsv",           name: "Great Saphenous Vein (GSV)",     group: "Lower Extremity" },
      { id: "popliteal",     name: "Popliteal Vein",                 group: "Lower Extremity" },
      { id: "ptv",           name: "Posterior Tibial Veins (PTV)",   group: "Calf" },
      { id: "peroneal",      name: "Peroneal Veins",                 group: "Calf" },
      { id: "gastro_soleal", name: "Gastrocnemius and Soleal Veins", group: "Calf" },
    ],
  },
  {
    key: "arterial",
    label: "Arterial ScanCoach",
    path: "/arterial-scan-coach",
    category: "Vascular",
    views: [
      { id: "segmental",  name: "Segmental Limb Pressures and Waveforms",    group: "Non-Invasive" },
      { id: "cw_doppler", name: "CW Doppler Waveforms",                      group: "Non-Invasive" },
      { id: "pvr",        name: "Pulse Volume Recordings (PVRs)",            group: "Non-Invasive" },
      { id: "tcpo2",      name: "Transcutaneous Oxygen Tension (tcPO2)",     group: "Non-Invasive" },
      { id: "ppg",        name: "Photoplethysmography (PPG)",                group: "Non-Invasive" },
    ],
  },
  {
    key: "abdominal_vascular",
    label: "Abdominal Vascular ScanCoach",
    path: "/abdominal-vascular-scan-coach",
    category: "Vascular",
    views: [
      { id: "kidneys",           name: "Kidneys",             group: "Renal" },
      { id: "aorta",             name: "Aorta",               group: "Aorta" },
      { id: "main_renal_artery", name: "Main Renal Artery",   group: "Renal" },
      { id: "intrarenal",        name: "Intrarenal Arteries", group: "Renal" },
      { id: "renal_veins",       name: "Renal Veins",         group: "Renal" },
    ],
  },
  {
    key: "aorta",
    label: "Aorta ScanCoach",
    path: "/aorta-scan-coach",
    category: "Vascular",
    views: [
      { id: "prox_long",   name: "Proximal Aorta - Long",         group: "Aorta" },
      { id: "prox_trans",  name: "Proximal Aorta - Trans",        group: "Aorta" },
      { id: "mid_long",    name: "Mid Aorta - Long",              group: "Aorta" },
      { id: "mid_trans",   name: "Mid Aorta - Trans",             group: "Aorta" },
      { id: "dist_long",   name: "Distal Aorta - Long",           group: "Aorta" },
      { id: "dist_trans",  name: "Distal Aorta - Trans",          group: "Aorta" },
      { id: "iliac_long",  name: "Common Iliac Arteries - Long",  group: "Iliac" },
      { id: "iliac_trans", name: "Common Iliac Arteries - Trans", group: "Iliac" },
    ],
  },
  {
    key: "carotid",
    label: "Carotid ScanCoach",
    path: "/carotid-scan-coach",
    category: "Vascular",
    views: [
      { id: "cca",         name: "Common Carotid Artery (CCA)",  group: "Carotid" },
      { id: "bifurcation", name: "Carotid Bifurcation",          group: "Carotid" },
      { id: "ica",         name: "Internal Carotid Artery (ICA)",group: "Carotid" },
      { id: "eca",         name: "External Carotid Artery (ECA)",group: "Carotid" },
      { id: "vertebral",   name: "Vertebral Artery",             group: "Vertebral" },
    ],
  },
  {
    key: "tcd",
    label: "TCD ScanCoach",
    path: "/tcd-scan-coach",
    category: "Vascular",
    views: [
      { id: "ant_fontanelle", name: "Anterior Fontanelle (Infants)",              group: "Neonatal" },
      { id: "sup_sag_sinus",  name: "Superior Sagittal Sinus (Infants)",          group: "Neonatal" },
      { id: "post_circ",      name: "Posterior Circulation (Infants)",            group: "Neonatal" },
      { id: "transtemporal",  name: "Transtemporal Window (Adults/Children)",     group: "Adult/Pediatric" },
    ],
  },
  // ─── MSK ──────────────────────────────────────────────────────────────────
  {
    key: "msk",
    label: "MSK ScanCoach",
    path: "/msk-scan-coach",
    category: "MSK",
    views: [
      { id: "shoulder", name: "Shoulder", group: "Upper Extremity" },
      { id: "elbow",    name: "Elbow",    group: "Upper Extremity" },
      { id: "wrist",    name: "Wrist",    group: "Upper Extremity" },
      { id: "hand",     name: "Hand",     group: "Upper Extremity" },
      { id: "hip",      name: "Hip",      group: "Lower Extremity" },
      { id: "knee",     name: "Knee",     group: "Lower Extremity" },
      { id: "ankle",    name: "Ankle",    group: "Lower Extremity" },
      { id: "foot",     name: "Foot",     group: "Lower Extremity" },
    ],
  },
  // ─── Fetal Echo ───────────────────────────────────────────────────────────
  {
    key: "fetal",
    label: "Fetal Echo ScanCoach",
    path: "/fetal-echo-assist",
    category: "Fetal Echo",
    views: [
      { id: "situs",       name: "Situs / Abdominal",          group: "Fetal Protocol" },
      { id: "4cv",         name: "4-Chamber View (4CV)",       group: "Fetal Protocol" },
      { id: "lvot",        name: "LVOT / 5-Chamber View",      group: "Fetal Protocol" },
      { id: "rvot",        name: "RVOT / 3-Vessel View (3VV)", group: "Fetal Protocol" },
      { id: "aortic_arch", name: "Aortic Arch View",           group: "Fetal Protocol" },
      { id: "ductal_arch", name: "Ductal Arch View",           group: "Fetal Protocol" },
      { id: "pulm_veins",  name: "Pulmonary Veins",            group: "Fetal Protocol" },
    ],
  },
  // ─── POCUS-Assist™ ────────────────────────────────────────────────────────
  {
    key: "pocus_efast",
    label: "eFAST ScanCoach",
    path: "/pocus-efast-scan-coach",
    category: "POCUS",
    views: [
      { id: "ruq",        name: "RUQ — Morison's Pouch",   group: "Abdominal" },
      { id: "luq",        name: "LUQ — Splenorenal Space", group: "Abdominal" },
      { id: "pelvis",     name: "Pelvic / Suprapubic",     group: "Abdominal" },
      { id: "subxiphoid", name: "Subxiphoid Cardiac",      group: "Cardiac" },
      { id: "rthorax",    name: "Right Thorax",            group: "Thoracic" },
      { id: "lthorax",    name: "Left Thorax",             group: "Thoracic" },
    ],
  },
  {
    key: "pocus_rush",
    label: "RUSH ScanCoach",
    path: "/pocus-rush-scan-coach",
    category: "POCUS",
    views: [
      { id: "pump_subcostal", name: "Pump: Subcostal Cardiac",     group: "Pump" },
      { id: "pump_plax",      name: "Pump: Parasternal Long Axis", group: "Pump" },
      { id: "tank_ivc",       name: "Tank: IVC Assessment",        group: "Tank" },
      { id: "tank_ruq",       name: "Tank: RUQ / LUQ / Pelvis",   group: "Tank" },
      { id: "pipes_aorta",    name: "Pipes: Abdominal Aorta",      group: "Pipes" },
      { id: "pipes_dvt",      name: "Pipes: DVT Assessment",       group: "Pipes" },
    ],
  },
  {
    key: "pocus_cardiac",
    label: "Cardiac POCUS ScanCoach",
    path: "/pocus-cardiac-scan-coach",
    category: "POCUS",
    views: [
      { id: "plax",      name: "Parasternal Long Axis (PLAX)",  group: "Parasternal" },
      { id: "psax_mv",   name: "PSAX — Mitral Valve Level",     group: "Parasternal" },
      { id: "psax_pm",   name: "PSAX — Papillary Muscle Level", group: "Parasternal" },
      { id: "a4c",       name: "Apical 4-Chamber",              group: "Apical" },
      { id: "subcostal", name: "Subcostal 4-Chamber",           group: "Subcostal" },
      { id: "ivc",       name: "Subcostal IVC",                 group: "Subcostal" },
    ],
  },
  {
    key: "pocus_lung",
    label: "Lung POCUS ScanCoach",
    path: "/pocus-lung-scan-coach",
    category: "POCUS",
    views: [
      { id: "anterior_ptx",    name: "Anterior: Pneumothorax Assessment", group: "Anterior" },
      { id: "anterior_blines", name: "Anterior: B-line Assessment",       group: "Anterior" },
      { id: "plaps_right",     name: "Right PLAPS Point",                 group: "Lateral" },
      { id: "plaps_left",      name: "Left PLAPS Point",                  group: "Lateral" },
      { id: "diaphragm",       name: "Diaphragm — M-mode Assessment",     group: "Diaphragm" },
    ],
  },
  // ── Procedures ──────────────────────────────────────────────────────────────
  {
    key: "appendix",
    label: "Appendix ScanCoach",
    path: "/appendix-scan-coach",
    category: "Procedures",
    views: [
      { id: "rlq_survey",       name: "RLQ Survey — Graded Compression Technique",            group: "Appendix" },
      { id: "appendix_id",      name: "Appendix Identification and Measurement",               group: "Appendix" },
      { id: "periappendiceal",  name: "Periappendiceal Assessment (Inflammation / Perforation)", group: "Appendix" },
      { id: "alt_diagnoses",    name: "Alternative RLQ Diagnoses",                            group: "Appendix" },
    ],
  },
  {
    key: "invasive_procedures",
    label: "Invasive Procedures ScanCoach",
    path: "/invasive-procedures-scan-coach",
    category: "Procedures",
    views: [
      { id: "thoracentesis_site",      name: "Thoracentesis — Site Selection",           group: "Thoracentesis" },
      { id: "thoracentesis_guidance",  name: "Thoracentesis — Real-Time Needle Guidance", group: "Thoracentesis" },
      { id: "paracentesis_site",       name: "Paracentesis — Site Selection",            group: "Paracentesis" },
      { id: "paracentesis_guidance",   name: "Paracentesis — Real-Time Needle Guidance",  group: "Paracentesis" },
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
  { key: "echoImageUrl",        label: "Clinical Ultrasound Image",  hint: "The ultrasound image shown in the view reference panel" },
  { key: "anatomyImageUrl",     label: "Anatomy Reference Image",   hint: "Anatomy diagram or labelled schematic" },
  { key: "transducerImageUrl",  label: "Transducer Position Image", hint: "Probe/transducer positioning photograph or diagram" },
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
