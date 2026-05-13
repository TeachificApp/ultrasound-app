/**
 * ScanCoach Billing Codes — CPT Procedure Codes Only
 *
 * CPT codes relevant to each ScanCoach view/module.
 * Only applied to billable exam modules: TTE, TEE, Strain.
 * NOT applied to: HOCM-Assist™, Diastology, Fetal, Pediatric/CHD, POCUS, MCS.
 *
 * CPT reference (2025 AMA):
 *   93306 — TTE complete with spectral + color Doppler (M-mode, 2D, Doppler)
 *   93307 — TTE without Doppler
 *   93308 — TTE follow-up / limited
 *   93312 — TEE diagnostic (probe placement + image acquisition + interpretation)
 *   93313 — TEE probe placement only
 *   93314 — TEE image acquisition only
 *   93315 — TEE congenital cardiac anomalies
 *   93316 — TEE congenital probe placement only
 *   93317 — TEE congenital image acquisition only
 *   93318 — TEE intraoperative monitoring
 *   93319 — 3D echocardiography add-on (real-time volumetric)
 *   76376 — 3D rendering without post-processing (add-on)
 *   76377 — 3D rendering with post-processing (add-on)
 *   93320 — Doppler echocardiography PW and/or CW (add-on)
 *   93321 — Doppler echocardiography follow-up (add-on)
 *   93325 — Doppler color flow velocity mapping (add-on)
 *   93356 — Myocardial strain imaging (speckle tracking) add-on
 */

export interface CptCode {
  code: string;
  description: string;
  type: "base" | "addon" | "alternative";
  note?: string;
}

export interface BillingSection {
  codes: CptCode[];
  clinicalNote?: string;
}

// ─── TTE Billing Codes by View ID ─────────────────────────────────────────────

export const TTE_BILLING: Record<string, BillingSection> = {
  plax: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93307", description: "TTE without Doppler", type: "alternative", note: "Use only if Doppler not performed" },
      { code: "93308", description: "TTE follow-up or limited study", type: "alternative", note: "Use for repeat/limited exams" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "PLAX is typically part of a complete TTE (93306). Use 93308 only when a limited study is medically necessary and documented.",
  },

  psax_av: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For AV CW Doppler / RVOT PW" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "PSAX-AV is used for AV planimetry, RVOT assessment, and PA evaluation. Add 93320 when CW/PW Doppler is performed.",
  },

  psax_mv: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "PSAX-MV is used for MV planimetry in mitral stenosis and regional wall motion assessment.",
  },

  psax_pm: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
    ],
    clinicalNote: "PSAX-PM is the primary view for 6-segment regional wall motion assessment and papillary muscle evaluation.",
  },

  a4c: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For mitral inflow, TR CW, TV Doppler" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93356", description: "Myocardial strain imaging — speckle tracking (add-on)", type: "addon", note: "When GLS is performed from A4C" },
    ],
    clinicalNote: "A4C is required for biventricular function, MV/TV assessment, and GLS acquisition. Add 93356 when speckle-tracking strain is performed.",
  },

  a5c: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For LVOT PW VTI and AV CW Doppler" },
    ],
    clinicalNote: "A5C is used for LVOT PW Doppler (stroke volume/VTI) and CW Doppler for aortic stenosis severity.",
  },

  a2c: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93356", description: "Myocardial strain imaging — speckle tracking (add-on)", type: "addon", note: "When GLS is performed from A2C" },
    ],
    clinicalNote: "A2C provides inferior and anterior wall segments and is required for biplane EF and GLS acquisition.",
  },

  a3c: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For AR CW Doppler and PHT" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93356", description: "Myocardial strain imaging — speckle tracking (add-on)", type: "addon", note: "When GLS is performed from A3C" },
    ],
    clinicalNote: "A3C (APLAX) is used for AR CW Doppler, PHT calculation, and inferolateral/anteroseptal wall motion.",
  },

  subcostal: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93308", description: "TTE follow-up or limited study", type: "alternative", note: "If only subcostal window available" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "Subcostal is essential for IVC collapsibility (RA pressure), pericardial effusion, and ASD/VSD with agitated saline contrast.",
  },

  suprasternal: {
    codes: [
      { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For coarctation gradient and descending aorta diastolic reversal" },
    ],
    clinicalNote: "Suprasternal notch view is used for aortic arch assessment, coarctation gradient, and descending aorta diastolic reversal in AR.",
  },

};

// ─── TEE Billing Codes by View ID ─────────────────────────────────────────────

export const TEE_BILLING: Record<string, BillingSection> = {
  "me-4c": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93319", description: "3D echocardiography add-on (real-time volumetric)", type: "addon", note: "If 3D acquisition performed" },
    ],
    clinicalNote: "ME 4-Chamber is the primary TEE view for biventricular function, MV/TV morphology, and LA/LAA assessment.",
  },

  "me-2c": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "ME 2-Chamber provides inferior and anterior wall segments (RCA/LAD territory) and is used for biplane EF.",
  },

  "me-lax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "For LVOT PW VTI and AR CW Doppler" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93319", description: "3D echocardiography add-on", type: "addon", note: "For 3D MV/AV assessment" },
    ],
    clinicalNote: "ME LAX (120–135°) is the primary TEE view for AV/MV morphology, LVOT measurement, and proximal ascending aorta.",
  },

  "me-asc-ao-sax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
    ],
    clinicalNote: "ME Ascending Aorta SAX (0°) is used for true vs. false lumen identification in aortic dissection and ascending aorta diameter.",
  },

  "me-av-sax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93319", description: "3D echocardiography add-on", type: "addon", note: "For 3D en-face AV assessment" },
    ],
    clinicalNote: "ME AV SAX (30–45°) provides en-face view of the aortic valve for leaflet morphology, planimetry, and vegetation assessment.",
  },

  "me-bicaval": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93315", description: "TEE for congenital cardiac anomalies", type: "alternative", note: "Use when primary indication is congenital (ASD, etc.)" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
    ],
    clinicalNote: "ME Bicaval (90–110°) is the primary view for ASD sizing, SVC/IVC assessment, and device guidance (ASD closure, ECMO cannula, Impella RP).",
  },

  "me-mv-comm": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
      { code: "93319", description: "3D echocardiography add-on", type: "addon", note: "For 3D en-face MV commissural assessment" },
    ],
    clinicalNote: "ME Mitral Commissural (60–70°) provides en-face view of both commissures for MV prolapse localization and MitraClip guidance.",
  },

  "tg-mid-sax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93318", description: "TEE intraoperative monitoring", type: "alternative", note: "Use for intraoperative cardiac surgery monitoring" },
    ],
    clinicalNote: "TG Mid SAX is the primary intraoperative view for real-time LV filling and regional wall motion monitoring during cardiac surgery.",
  },

  "tg-2c": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93318", description: "TEE intraoperative monitoring", type: "alternative", note: "Use for intraoperative monitoring" },
    ],
    clinicalNote: "TG 2-Chamber provides inferior and anterior wall assessment and is used for LV volume estimation in the TG plane.",
  },

  "tg-deep-lax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
      { code: "93320", description: "Doppler PW and/or CW (add-on)", type: "addon", note: "Required for CW Doppler alignment with LVOT/AV" },
    ],
    clinicalNote: "TG Deep LAX is the only TEE view allowing CW Doppler alignment with the LVOT/AV for aortic stenosis severity quantification.",
  },

  "ue-arch-lax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
    ],
    clinicalNote: "UE Arch LAX (0°) provides the aortic arch in long axis for dissection flap, aneurysm, and atheroma assessment.",
  },

  "ue-arch-sax": {
    codes: [
      { code: "93312", description: "TEE diagnostic — probe placement, acquisition + interpretation", type: "base" },
    ],
    clinicalNote: "UE Arch SAX (90°) provides the main pulmonary artery and arch in short axis — useful for PA thrombus and arch anatomy.",
  },
};

// ─── Strain ScanCoach Billing Codes ───────────────────────────────────────────

export const STRAIN_BILLING: BillingSection = {
  codes: [
    { code: "93306", description: "TTE complete — M-mode, 2D, spectral + color Doppler (base code)", type: "base" },
    { code: "93356", description: "Myocardial strain imaging — speckle tracking echocardiography (add-on)", type: "addon", note: "Must be billed with 93306" },
    { code: "93325", description: "Doppler color flow velocity mapping (add-on)", type: "addon" },
  ],
  clinicalNote: "CPT 93356 (myocardial strain imaging) is an add-on code and must be billed with the base TTE code 93306. Requires documentation of clinical indication and interpretation of segmental and global strain values in the final report.",
};
export const abdominalBilling: ScanCoachBillingData = [
  {
    heading: "Abdominal Ultrasound",
    codes: [
      { code: "76700", description: "Ultrasound, abdominal, real time with image documentation; complete", note: "Requires evaluation of liver, gallbladder, CBD, pancreas, spleen, kidneys, and aorta/IVC" },
      { code: "76705", description: "Ultrasound, abdominal, real time with image documentation; limited (single organ or quadrant)", note: "Use when only one or a few structures are evaluated" },
    ],
  },
  {
    heading: "Liver Elastography",
    codes: [
      { code: "91200", description: "Liver elastography, mechanically induced shear wave (e.g., ARFI, pSWE, 2D-SWE)", note: "Reported separately when performed in addition to standard abdominal ultrasound" },
    ],
  },
  {
    heading: "Retroperitoneum / Renal",
    codes: [
      { code: "76770", description: "Ultrasound, retroperitoneal (e.g., renal, aorta, nodes); complete", note: "Requires bilateral kidneys, aorta, and retroperitoneal structures" },
      { code: "76775", description: "Ultrasound, retroperitoneal; limited", note: "Single organ or limited study" },
    ],
  },
];

// ─── ABDOMINAL VASCULAR ───────────────────────────────────────────────────────
export const abdominalVascularBillingByTab: Record<string, ScanCoachBillingData> = {
  liver: [
    {
      heading: "Hepatic / Portal Duplex Ultrasound",
      codes: [
        { code: "93975", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; complete study", note: "Includes color Doppler, spectral waveform analysis of portal vein, hepatic veins, and hepatic artery" },
        { code: "93976", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; limited study", note: "Use when only one vessel or limited interrogation is performed" },
      ],
    },
  ],
  tips: [
    {
      heading: "TIPS Surveillance Duplex Ultrasound",
      codes: [
        { code: "93975", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; complete study", note: "Standard code for TIPS surveillance — includes spectral Doppler at three stent points, portal vein, and hepatic veins" },
        { code: "93976", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; limited study", note: "Use if only partial TIPS assessment is performed" },
      ],
    },
  ],
  mesenteric: [
    {
      heading: "Mesenteric Artery Duplex Ultrasound",
      codes: [
        { code: "93975", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; complete study", note: "Covers celiac axis, SMA, IMA, and splenic artery Doppler interrogation" },
        { code: "93976", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; limited study", note: "Use when only one mesenteric vessel is evaluated" },
      ],
    },
  ],
  renal: [
    {
      heading: "Renal Artery Duplex Ultrasound",
      codes: [
        { code: "93975", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; complete study", note: "Includes bilateral renal artery origin, intrarenal Doppler, and renal vein assessment" },
        { code: "93976", description: "Duplex scan of arterial inflow and venous outflow of abdominal, pelvic, scrotal contents and/or retroperitoneal organs; limited study", note: "Use for unilateral or limited renal artery study" },
      ],
    },
  ],
};

// ─── AORTA ────────────────────────────────────────────────────────────────────
export const aortaBilling: ScanCoachBillingData = [
  {
    heading: "Aorta Duplex Ultrasound",
    codes: [
      { code: "93978", description: "Duplex scan of aorta, iliac vasculature, or bypass grafts; complete study", note: "Includes B-mode, color Doppler, and spectral waveform analysis of the aorta and iliac arteries" },
      { code: "93979", description: "Duplex scan of aorta, iliac vasculature, or bypass grafts; unilateral or limited study", note: "Use when only the aorta or one iliac system is evaluated" },
      { code: "76770", description: "Ultrasound, retroperitoneal (e.g., renal, aorta, nodes); complete", note: "Use for B-mode AAA screening without Doppler" },
      { code: "76775", description: "Ultrasound, retroperitoneal; limited", note: "Use for limited aorta B-mode only (e.g., AAA surveillance single measurement)" },
    ],
  },
  {
    heading: "AAA Screening (One-Time Medicare Benefit)",
    codes: [
      { code: "G0389", description: "Ultrasound B-scan and/or real time with image documentation; abdominal aortic aneurysm (AAA) screening", note: "Medicare one-time benefit for qualifying beneficiaries referred by their physician" },
    ],
  },
];

// ─── APPENDIX ─────────────────────────────────────────────────────────────────
export const appendixBilling: ScanCoachBillingData = [
  {
    heading: "Appendix / Abdominal Ultrasound",
    codes: [
      { code: "76705", description: "Ultrasound, abdominal, real time with image documentation; limited", note: "Most commonly used for targeted appendix evaluation" },
      { code: "76700", description: "Ultrasound, abdominal, real time with image documentation; complete", note: "Use when a complete abdominal survey is performed in addition to appendix evaluation" },
    ],
  },
];

// ─── ARTERIAL (PERIPHERAL) ────────────────────────────────────────────────────
export const arterialBilling: ScanCoachBillingData = [
  {
    heading: "Peripheral Arterial Duplex Ultrasound",
    codes: [
      { code: "93925", description: "Duplex scan of lower extremity arteries or arterial bypass grafts; complete bilateral study", note: "Includes spectral Doppler waveform analysis at multiple levels bilaterally" },
      { code: "93926", description: "Duplex scan of lower extremity arteries or arterial bypass grafts; unilateral or limited study", note: "Use for unilateral lower extremity or limited arterial evaluation" },
      { code: "93930", description: "Duplex scan of upper extremity arteries or arterial bypass grafts; complete bilateral study" },
      { code: "93931", description: "Duplex scan of upper extremity arteries or arterial bypass grafts; unilateral or limited study" },
    ],
  },
  {
    heading: "Physiologic Studies (ABI / PVR)",
    codes: [
      { code: "93922", description: "Limited bilateral noninvasive physiologic studies of upper or lower extremity arteries (e.g., ABI with Doppler waveform analysis, 2 levels)", note: "Includes ABI measurement with Doppler waveforms at two levels" },
      { code: "93923", description: "Complete bilateral noninvasive physiologic studies of upper or lower extremity arteries (e.g., ABI with PVR, 3 or more levels)", note: "Includes ABI, PVR, and segmental pressures at three or more levels" },
      { code: "93924", description: "Noninvasive physiologic studies of lower extremity arteries, at rest and following treadmill stress testing, complete bilateral study", note: "Use when exercise ABI testing is performed" },
    ],
  },
];

// ─── BREAST ───────────────────────────────────────────────────────────────────
export const breastBilling: ScanCoachBillingData = [
  {
    heading: "Breast Ultrasound",
    codes: [
      { code: "76641", description: "Ultrasound, breast, unilateral, real time with image documentation, including axilla when performed; complete", note: "Complete study of one breast including all quadrants and axilla" },
      { code: "76642", description: "Ultrasound, breast, unilateral, real time with image documentation, including axilla when performed; limited", note: "Targeted evaluation of a specific lesion or area — one breast" },
    ],
  },
  {
    heading: "Breast Elastography",
    codes: [
      { code: "76645", description: "Ultrasound, breast(s), real time with image documentation; add-on for elastography", note: "Reported in addition to 76641 or 76642 when strain or shear wave elastography is performed" },
    ],
  },
];

// ─── CAROTID ──────────────────────────────────────────────────────────────────
export const carotidBilling: ScanCoachBillingData = [
  {
    heading: "Extracranial Carotid / Vertebral Duplex Ultrasound",
    codes: [
      { code: "93880", description: "Duplex scan of extracranial arteries; complete bilateral study", note: "Includes B-mode, color Doppler, and spectral waveform analysis of bilateral CCA, ICA, ECA, and vertebral arteries" },
      { code: "93882", description: "Duplex scan of extracranial arteries; unilateral or limited study", note: "Use for unilateral carotid or limited evaluation" },
    ],
  },
  {
    heading: "Subclavian / Innominate Artery",
    codes: [
      { code: "93930", description: "Duplex scan of upper extremity arteries or arterial bypass grafts; complete bilateral study", note: "Use when subclavian or innominate arteries are the primary focus" },
      { code: "93931", description: "Duplex scan of upper extremity arteries or arterial bypass grafts; unilateral or limited study" },
    ],
  },
];

// ─── FETAL ECHO ───────────────────────────────────────────────────────────────
export const fetalBilling: ScanCoachBillingData = [
  {
    heading: "Fetal Echocardiography",
    codes: [
      { code: "76825", description: "Echocardiography, fetal, cardiovascular system, real time with image documentation (2D), with or without M-mode recording; complete", note: "Complete fetal echo — requires evaluation of all four cardiac chambers, great vessels, and rhythm" },
      { code: "76826", description: "Echocardiography, fetal, cardiovascular system, real time with image documentation (2D), with or without M-mode recording; follow-up or repeat study", note: "Use for follow-up fetal echo after a prior complete study" },
      { code: "76827", description: "Doppler echocardiography, fetal, pulsed wave and/or continuous wave with spectral display; complete", note: "Add-on for pulsed wave and/or CW Doppler — reported with 76825 or 76826" },
      { code: "76828", description: "Doppler echocardiography, fetal, pulsed wave and/or continuous wave with spectral display; follow-up or repeat study", note: "Follow-up Doppler fetal echo" },
    ],
  },
  {
    heading: "Obstetric Ultrasound (if performed concurrently)",
    codes: [
      { code: "76811", description: "Ultrasound, pregnant uterus, real time with image documentation, fetal and maternal evaluation, first trimester (< 14 weeks 0 days), transabdominal approach; each fetus", note: "Use only if a standard OB survey is also performed during the same encounter" },
      { code: "76805", description: "Ultrasound, pregnant uterus, real time with image documentation; after first trimester (≥ 14 weeks 0 days), fetal and maternal evaluation; each fetus", note: "Standard OB survey if performed concurrently with fetal echo" },
    ],
  },
];

// ─── INVASIVE PROCEDURES ──────────────────────────────────────────────────────
export const invasiveProceduresBilling: ScanCoachBillingData = [
  {
    heading: "Ultrasound Guidance for Procedures",
    codes: [
      { code: "76942", description: "Ultrasonic guidance for needle placement (e.g., biopsy, aspiration, injection, localization device), imaging supervision and interpretation, with permanent record", note: "Use for ultrasound guidance during paracentesis, thoracentesis, or other needle-guided procedures — reported in addition to the procedure code" },
    ],
  },
  {
    heading: "Paracentesis",
    codes: [
      { code: "49083", description: "Abdominal paracentesis (diagnostic or therapeutic); with imaging guidance", note: "Includes ultrasound guidance — do not separately report 76942 when using this code" },
      { code: "49082", description: "Abdominal paracentesis (diagnostic or therapeutic); without imaging guidance", note: "Use only when ultrasound guidance is not employed" },
    ],
  },
  {
    heading: "Thoracentesis",
    codes: [
      { code: "32557", description: "Pleural drainage, percutaneous, with insertion of indwelling catheter; with imaging guidance", note: "Includes ultrasound guidance — do not separately report 76942" },
      { code: "32554", description: "Thoracentesis, needle or catheter, aspiration of the pleural space; without imaging guidance" },
      { code: "32555", description: "Thoracentesis, needle or catheter, aspiration of the pleural space; with imaging guidance", note: "Includes ultrasound guidance" },
    ],
  },
];

// ─── MSK ──────────────────────────────────────────────────────────────────────
export const mskBilling: ScanCoachBillingData = [
  {
    heading: "Musculoskeletal Ultrasound",
    codes: [
      { code: "76881", description: "Ultrasound, complete joint (i.e., joint space and peri-articular soft-tissue structures), real-time with image documentation", note: "Complete joint study — includes all peri-articular structures of the joint" },
      { code: "76882", description: "Ultrasound, limited, joint or other nonvascular extremity structure(s) (e.g., joint space, peri-articular tendon[s], muscle[s], nerve[s], other soft-tissue structure[s], or soft-tissue mass[es]), real-time with image documentation", note: "Use for targeted evaluation of a specific tendon, nerve, or soft tissue structure" },
    ],
  },
  {
    heading: "Ultrasound-Guided Injection / Aspiration",
    codes: [
      { code: "76942", description: "Ultrasonic guidance for needle placement (e.g., biopsy, aspiration, injection, localization device), imaging supervision and interpretation, with permanent record", note: "Report in addition to the injection or aspiration procedure code" },
    ],
  },
];

// ─── OB 1ST TRIMESTER ─────────────────────────────────────────────────────────
export const ob1Billing: ScanCoachBillingData = [
  {
    heading: "First Trimester Obstetric Ultrasound (< 14 weeks)",
    codes: [
      { code: "76801", description: "Ultrasound, pregnant uterus, real time with image documentation, fetal and maternal evaluation, first trimester (< 14 weeks 0 days), transabdominal approach; single or first gestation", note: "Standard first trimester survey — gestational sac, CRL, cardiac activity, uterus, adnexa" },
      { code: "76802", description: "Ultrasound, pregnant uterus, real time with image documentation, fetal and maternal evaluation, first trimester; each additional gestation (List separately in addition to code for primary procedure)", note: "Add-on per additional fetus beyond the first" },
    ],
  },
  {
    heading: "Nuchal Translucency",
    codes: [
      { code: "76813", description: "Ultrasound, pregnant uterus, real time with image documentation, first trimester fetal nuchal translucency measurement; single or first gestation", note: "NT measurement 11–13+6 weeks — requires NT-certified sonographer and physician" },
      { code: "76814", description: "Ultrasound, pregnant uterus, real time with image documentation, first trimester fetal nuchal translucency measurement; each additional gestation (List separately in addition to code for primary procedure)" },
    ],
  },
  {
    heading: "Transvaginal Ultrasound",
    codes: [
      { code: "76817", description: "Ultrasound, pregnant uterus, real time with image documentation; transvaginal", note: "Use when a transvaginal approach is performed for first trimester evaluation" },
    ],
  },
];

// ─── OB 2ND / 3RD TRIMESTER ───────────────────────────────────────────────────
export const ob23Billing: ScanCoachBillingData = [
  {
    heading: "Standard Obstetric Ultrasound (≥ 14 weeks)",
    codes: [
      { code: "76805", description: "Ultrasound, pregnant uterus, real time with image documentation; after first trimester (≥ 14 weeks 0 days), fetal and maternal evaluation; each fetus", note: "Standard anatomy survey — includes fetal biometry, anatomy, placenta, AFI, and fetal presentation" },
      { code: "76810", description: "Ultrasound, pregnant uterus, real time with image documentation; after first trimester, fetal and maternal evaluation, each additional gestation (List separately in addition to code for primary procedure)" },
    ],
  },
  {
    heading: "Detailed / Targeted Anatomy Survey",
    codes: [
      { code: "76811", description: "Ultrasound, pregnant uterus, real time with image documentation, fetal and maternal evaluation plus detailed fetal anatomic examination; single or first gestation", note: "Level II / targeted anatomy survey — more comprehensive than 76805" },
      { code: "76812", description: "Ultrasound, pregnant uterus, real time with image documentation, fetal and maternal evaluation plus detailed fetal anatomic examination; each additional gestation" },
    ],
  },
  {
    heading: "Biophysical Profile",
    codes: [
      { code: "76818", description: "Fetal biophysical profile; with non-stress test", note: "BPP with NST — includes tone, movement, breathing, AFI, and NST" },
      { code: "76819", description: "Fetal biophysical profile; without non-stress test", note: "Modified BPP or BPP without NST component" },
    ],
  },
  {
    heading: "Umbilical / Fetal Doppler",
    codes: [
      { code: "76820", description: "Doppler velocimetry, fetal; umbilical artery", note: "Umbilical artery S/D ratio, RI, and PI — reported separately from the anatomic survey" },
      { code: "76821", description: "Doppler velocimetry, fetal; middle cerebral artery", note: "MCA PSV measurement — used for fetal anemia surveillance" },
      { code: "76819", description: "Fetal biophysical profile; without non-stress test" },
    ],
  },
  {
    heading: "Cervical Length",
    codes: [
      { code: "76817", description: "Ultrasound, pregnant uterus, real time with image documentation; transvaginal", note: "Use for transvaginal cervical length measurement — reported separately when performed" },
    ],
  },
];

// ─── PELVIC / GYN ─────────────────────────────────────────────────────────────
export const pelvicGynBilling: ScanCoachBillingData = [
  {
    heading: "Pelvic Ultrasound — Transabdominal",
    codes: [
      { code: "76856", description: "Ultrasound, pelvic (nonobstetric), real time with image documentation; complete", note: "Complete pelvic survey — uterus, endometrium, bilateral ovaries, adnexa, and cul-de-sac" },
      { code: "76857", description: "Ultrasound, pelvic (nonobstetric), real time with image documentation; limited or follow-up (e.g., for follicles)", note: "Use for targeted or follow-up pelvic evaluation" },
    ],
  },
  {
    heading: "Pelvic Ultrasound — Transvaginal",
    codes: [
      { code: "76830", description: "Ultrasound, transvaginal", note: "Transvaginal pelvic ultrasound — may be reported in addition to 76856 when both approaches are performed" },
    ],
  },
  {
    heading: "Saline Infusion Sonohysterography (SIS)",
    codes: [
      { code: "76831", description: "Saline infusion sonohysterography (SIS), including color flow Doppler, when performed", note: "Includes catheter placement, saline infusion, and real-time imaging — requires separate procedure code for catheter insertion if applicable" },
    ],
  },
];

// ─── SCROTUM / TESTICULAR ─────────────────────────────────────────────────────
export const scrotumBilling: ScanCoachBillingData = [
  {
    heading: "Scrotal / Testicular Ultrasound",
    codes: [
      { code: "76870", description: "Ultrasound, scrotum and contents", note: "Includes B-mode and color Doppler evaluation of bilateral testes, epididymides, and scrotal contents" },
    ],
  },
];

// ─── TCD ──────────────────────────────────────────────────────────────────────
export const tcdBilling: ScanCoachBillingData = [
  {
    heading: "Transcranial Doppler Ultrasound",
    codes: [
      { code: "93886", description: "Transcranial Doppler study of the intracranial arteries; complete study", note: "Bilateral evaluation of MCA, ACA, PCA, vertebral, and basilar arteries with spectral waveform analysis" },
      { code: "93888", description: "Transcranial Doppler study of the intracranial arteries; limited study", note: "Use when only selected vessels are evaluated or when the study is incomplete due to poor acoustic windows" },
    ],
  },
  {
    heading: "TCD with Emboli Detection / Bubble Study",
    codes: [
      { code: "93890", description: "Transcranial Doppler study of the intracranial arteries; with emboli detection, without provocative maneuvers", note: "Includes monitoring for microembolic signals — used for right-to-left shunt detection" },
      { code: "93892", description: "Transcranial Doppler study of the intracranial arteries; with emboli detection, with provocative maneuvers (e.g., Valsalva)", note: "Includes Valsalva or other provocative maneuvers for PFO/RLS detection" },
    ],
  },
  {
    heading: "TCD Vasoreactivity / CO₂ Reactivity",
    codes: [
      { code: "93893", description: "Transcranial Doppler study of the intracranial arteries; with vasoreactivity study", note: "Includes breath-holding or CO₂ inhalation challenge to assess cerebrovascular reserve" },
    ],
  },
];

// ─── THYROID ──────────────────────────────────────────────────────────────────
export const thyroidBilling: ScanCoachBillingData = [
  {
    heading: "Thyroid Ultrasound",
    codes: [
      { code: "76536", description: "Ultrasound, soft tissues of head and neck (e.g., thyroid, parathyroid, parotid), real time with image documentation", note: "Standard code for thyroid and parathyroid ultrasound — includes B-mode and color Doppler" },
    ],
  },
  {
    heading: "Ultrasound-Guided Thyroid Biopsy / FNA",
    codes: [
      { code: "76942", description: "Ultrasonic guidance for needle placement (e.g., biopsy, aspiration, injection, localization device), imaging supervision and interpretation, with permanent record", note: "Report in addition to the FNA or core biopsy procedure code" },
      { code: "10005", description: "Fine needle aspiration biopsy, including ultrasound guidance; first lesion", note: "FNA with ultrasound guidance — includes 76942; do not separately report guidance" },
      { code: "10006", description: "Fine needle aspiration biopsy, including ultrasound guidance; each additional lesion (List separately in addition to code for primary procedure)" },
    ],
  },
];

// ─── VENOUS ───────────────────────────────────────────────────────────────────
export const venousBilling: ScanCoachBillingData = [
  {
    heading: "Lower Extremity Venous Duplex Ultrasound",
    codes: [
      { code: "93971", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; unilateral or limited study", note: "Unilateral lower extremity DVT study — most common code for single-leg DVT evaluation" },
      { code: "93970", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; complete bilateral study", note: "Bilateral lower extremity venous duplex — use when both legs are evaluated" },
    ],
  },
  {
    heading: "Upper Extremity Venous Duplex Ultrasound",
    codes: [
      { code: "93971", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; unilateral or limited study", note: "Also used for upper extremity venous evaluation (subclavian, axillary, brachial, basilic, cephalic)" },
      { code: "93970", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; complete bilateral study", note: "Use for bilateral upper extremity venous duplex" },
    ],
  },
  {
    heading: "Superficial Venous Insufficiency / Varicose Veins",
    codes: [
      { code: "93971", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; unilateral or limited study", note: "Use for unilateral superficial venous reflux mapping (GSV, SSV, perforators)" },
      { code: "93970", description: "Duplex scan of extremity veins including responses to compression and other maneuvers; complete bilateral study", note: "Use for bilateral superficial venous insufficiency mapping" },
    ],
  },
];

// ─── POCUS (Point-of-Care) ────────────────────────────────────────────────────
export const pocusBilling: ScanCoachBillingData = [
  {
    heading: "POCUS — General",
    codes: [
      { code: "76604", description: "Ultrasound, chest (includes mediastinum), real time with image documentation", note: "Use for lung and pleural POCUS — includes B-lines, pleural effusion, and pneumothorax assessment" },
      { code: "76705", description: "Ultrasound, abdominal, real time with image documentation; limited", note: "Use for FAST/eFAST abdominal windows (RUQ, LUQ, pelvic)" },
      { code: "93308", description: "Echocardiography, transthoracic, real-time with image documentation (2D), includes M-mode recording, when performed, follow-up or limited study", note: "Use for limited cardiac POCUS — not a substitute for a complete echo" },
    ],
  },
  {
    heading: "POCUS — Critical Care / Emergency",
    codes: [
      { code: "76641", description: "Ultrasound, breast, unilateral, real time with image documentation, including axilla when performed; complete", note: "Not applicable to POCUS — listed for reference only" },
      { code: "76998", description: "Ultrasonic guidance, intraoperative", note: "Use for intraoperative or procedural POCUS guidance when applicable" },
    ],
  },
];
