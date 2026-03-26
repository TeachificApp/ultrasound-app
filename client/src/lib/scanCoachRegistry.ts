/**
 * scanCoachRegistry.ts
 * Static registry of all ScanCoach modules and their views.
 * Used by the WYSIWYG editor to enumerate views and by the override hook
 * to know which fields are editable per module.
 *
 * Modules shown in the ScanCoach Editor:
 *   - Fetal Echo
 *   - POCUS-Assist™: eFAST, RUSH, Cardiac POCUS, Lung POCUS
 */

export type ScanCoachModule =
  | "fetal"
  // POCUS-Assist™ modules
  | "pocus_efast"
  | "pocus_rush"
  | "pocus_cardiac"
  | "pocus_lung";

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
      { id: "pump_plax",     name: "The Pump — PLAX",                 group: "Pump" },
      { id: "pump_psax",     name: "The Pump — PSAX",                 group: "Pump" },
      { id: "pump_a4c",      name: "The Pump — Apical 4-Chamber",     group: "Pump" },
      { id: "pump_subcostal",name: "The Pump — Subcostal",            group: "Pump" },
      { id: "tank_ivc",      name: "The Tank — IVC Collapsibility",   group: "Tank" },
      { id: "tank_ruq",      name: "The Tank — RUQ Free Fluid",       group: "Tank" },
      { id: "tank_luq",      name: "The Tank — LUQ Free Fluid",       group: "Tank" },
      { id: "tank_pelvis",   name: "The Tank — Pelvic Free Fluid",    group: "Tank" },
      { id: "pipes_aorta",   name: "The Pipes — Aorta (AAA)",         group: "Pipes" },
      { id: "pipes_dvt",     name: "The Pipes — DVT Assessment",      group: "Pipes" },
      { id: "pipes_ptx",     name: "The Pipes — Pneumothorax",        group: "Pipes" },
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
