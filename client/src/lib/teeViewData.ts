/**
 * ASE 28-View Comprehensive TEE Protocol
 * Source: Hahn et al., JASE 2013;26:921–965
 * Views listed in ASE protocol order (views 1–28 + Overview)
 */

export type TeeView = {
  id: string;
  aseNumber: string;        // "1", "2", ... "28", or "0" for overview
  group: string;
  groupColor: string;
  name: string;
  angle: string;
  depth: string;
  flexion: string;
  patientPosition: string;
  description: string;
  howToGet: string[];
  structures: string[];
  doppler: { label: string; detail: string }[];
  tips: string[];
  pitfalls: string[];
  measurements: string[];
  criticalFindings: string[];
};

const ME_COLOR = "#189aa1";
const TG_COLOR = "#0e7490";
const UE_COLOR = "#0f766e";
const AO_COLOR = "#134e4a";
const OV_COLOR = "#189aa1";

export const TEE_VIEWS: TeeView[] = [
  // ── Overview ─────────────────────────────────────────────────────────────
  {
    id: "tee_overview",
    aseNumber: "0",
    group: "Overview",
    groupColor: OV_COLOR,
    name: "TEE Overview",
    angle: "N/A",
    depth: "N/A",
    flexion: "N/A",
    patientPosition: "Supine; sedated/anaesthetised; bite block in situ",
    description: "A comprehensive introduction to the TEE procedure — covering patient preparation, probe insertion technique, and the fundamental principles of probe manipulation and multiplane imaging.",
    howToGet: [
      "Ensure patient is appropriately sedated/anaesthetised and airway is secured",
      "Insert bite block and lubricate the probe tip generously",
      "Advance probe with gentle forward pressure in the neutral position",
      "Once past the cricopharyngeus (~15–20 cm), advance to mid-esophagus (~30–35 cm)",
      "Confirm position by identifying all four cardiac chambers at 0°",
    ],
    structures: [
      "Esophagus", "Oropharynx", "Bite block",
      "Multiplane transducer (0–180°)", "Omniplane imaging",
    ],
    doppler: [],
    tips: [
      "Never force the probe — resistance suggests cricopharyngeal spasm or pathology",
      "Rotate the multiplane angle (0–180°) to sweep through imaging planes without moving the probe",
      "Anteflexion (forward) brings the transducer closer to anterior structures; retroflexion (backward) moves away",
      "Left/right lateral flexion (LAT) steers the probe tip toward the patient's left or right",
      "Clockwise rotation of the shaft turns the image plane to the patient's right; counter-clockwise to the left",
    ],
    pitfalls: [
      "Probe insertion without adequate sedation risks laryngospasm and oesophageal injury",
      "Excessive torque on the probe shaft can cause oesophageal trauma",
      "Failure to unlock the probe controls before withdrawal risks mucosal injury",
    ],
    measurements: [],
    criticalFindings: [],
  },

  // ── VIEW 1: ME 5-Chamber ─────────────────────────────────────────────────
  {
    id: "me5c",
    aseNumber: "1",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME 5-Chamber",
    angle: "0–10°",
    depth: "30–35 cm",
    flexion: "Slight anteflexion",
    patientPosition: "Supine; bite block in place; head neutral",
    description: "The first standard view of the comprehensive TEE exam. Obtained by slight anteflexion from the ME 4-chamber position, bringing the LVOT and aortic valve into view alongside all four chambers. Equivalent to the TTE apical 5-chamber.",
    howToGet: [
      "Advance probe to mid-esophagus (30–35 cm from incisors)",
      "Set multiplane angle to 0–10°",
      "Apply slight anteflexion to tilt the imaging plane anteriorly",
      "The LVOT and aortic valve will come into view between the mitral valve and the aorta",
      "Optimize depth to include the LV apex",
    ],
    structures: [
      "LV (all walls)", "RV", "LA", "RA",
      "Mitral valve", "Tricuspid valve",
      "LVOT", "Aortic valve (partially)",
      "Interatrial septum",
    ],
    doppler: [
      { label: "LVOT PW Doppler", detail: "Sample at LVOT just below AV. Normal VTI 18–22 cm. Used for stroke volume calculation" },
      { label: "AV CW Doppler", detail: "Align with LVOT flow. Peak gradient >64 mmHg = severe AS" },
      { label: "MV Color Doppler", detail: "Assess MR origin and direction" },
    ],
    tips: [
      "This view is ideal for LVOT PW Doppler — the beam is nearly parallel to LVOT flow",
      "Slight anteflexion from ME 4C brings the LVOT into view",
      "Avoid excessive anteflexion which foreshortens the LV",
    ],
    pitfalls: [
      "Over-anteflexion causes LV foreshortening and underestimates EF",
      "The LVOT may not be fully visible if the probe is too deep",
    ],
    measurements: ["LVOT VTI (stroke volume)", "AV peak velocity (AS severity)", "LVOT diameter"],
    criticalFindings: ["Severe AS (peak gradient >64 mmHg, AVA <1.0 cm²)", "Dynamic LVOT obstruction (SAM)"],
  },

  // ── VIEW 2: ME 4-Chamber ─────────────────────────────────────────────────
  {
    id: "me4c",
    aseNumber: "2",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME 4-Chamber",
    angle: "0–10°",
    depth: "30–35 cm",
    flexion: "Neutral to slight anteflexion; advance ± retroflex",
    patientPosition: "Supine; bite block in place; head neutral",
    description: "The foundational TEE view. Provides simultaneous assessment of all four cardiac chambers, both AV valves, and the interatrial septum. Equivalent to the TTE apical 4-chamber but with superior resolution.",
    howToGet: [
      "Advance probe to mid-esophagus (30–35 cm from incisors)",
      "Set multiplane angle to 0–10°",
      "Apply gentle anteflexion to bring all four chambers into view",
      "Advance slightly and retroflex to open up the LV apex — avoid foreshortening",
      "Rotate slightly left/right to center the IVS vertically",
    ],
    structures: [
      "LV (all walls, apex)", "RV", "LA", "RA",
      "Mitral valve (A2/P2 segments)", "Tricuspid valve",
      "Interatrial septum", "Moderator band (RV)",
    ],
    doppler: [
      { label: "MV Color Doppler", detail: "Assess MR jet — origin, direction, vena contracta" },
      { label: "TV Color Doppler", detail: "Assess TR jet — vena contracta ≥7 mm = severe" },
      { label: "TR CW Doppler", detail: "RVSP = 4v² + RAP. Normal TR Vmax <2.5 m/s" },
      { label: "PW at MV tips", detail: "E/A ratio, deceleration time for diastolic function" },
    ],
    tips: [
      "The RV should appear smaller than the LV — if equal or larger, suspect RV dilation",
      "Tilt the probe slightly posteriorly to visualise the coronary sinus",
      "Advance 1–2 cm to open up the LV apex and avoid foreshortening",
    ],
    pitfalls: [
      "Foreshortening of LV apex underestimates LV size and EF",
      "The RV free wall is not well seen — use TG views for RV assessment",
    ],
    measurements: ["LV dimensions (EDD, ESD)", "Biplane EF (Simpson's)", "LA area", "MV annulus diameter", "TR Vmax (RVSP)"],
    criticalFindings: ["LV systolic dysfunction (EF <35%)", "Severe MR or TR", "Large ASD/PFO with shunt", "RV dilation/dysfunction"],
  },

  // ── VIEW 3: ME Mitral Commissural ────────────────────────────────────────
  {
    id: "me_mc",
    aseNumber: "3",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Mitral Commissural",
    angle: "50–70°",
    depth: "30–35 cm",
    flexion: "Neutral",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by rotating the multiplane angle to 50–70° from the ME 4-chamber position. This view cuts through both mitral commissures simultaneously, displaying P1, A2, and P3 segments in a single plane — essential for precise MV prolapse localisation.",
    howToGet: [
      "From ME 4-Chamber (0°), rotate multiplane angle to 50–70°",
      "Keep probe position at mid-esophagus (30–35 cm)",
      "Maintain neutral flexion",
      "The image will show a 'fish-mouth' appearance of the MV with both commissures visible",
      "Fine-tune angle between 50–70° to see all three segments: P1 (near field), A2 (centre), P3 (far field)",
    ],
    structures: [
      "Mitral valve: P1 (anterolateral), A2 (central), P3 (posteromedial)",
      "Both commissures (anterolateral and posteromedial)",
      "Left ventricle (inferior and lateral walls)",
      "Left atrium",
    ],
    doppler: [
      { label: "MV Color Doppler", detail: "Identify which commissure the MR jet originates from — P1 vs P3 prolapse" },
      { label: "MV CW Doppler", detail: "Peak MR velocity for severity assessment" },
    ],
    tips: [
      "This is the key view for localising MV prolapse — P1 is near field, P3 is far field",
      "A flail P1 segment will appear as a leaflet tip pointing toward the LA in the near field",
      "Rotating slightly clockwise may improve P3 visualisation",
    ],
    pitfalls: [
      "Confusing P1 and P3 — P1 is always in the near field (anterolateral commissure)",
      "Excessive anteflexion can distort the commissural view",
    ],
    measurements: ["MV annulus diameter (commissure-to-commissure)", "Prolapse segment identification"],
    criticalFindings: ["Flail mitral leaflet (P1, A2, or P3)", "Commissural MR jet suggesting commissurotomy candidate"],
  },

  // ── VIEW 4: ME 2-Chamber ─────────────────────────────────────────────────
  {
    id: "me2c",
    aseNumber: "4",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME 2-Chamber",
    angle: "80–100°",
    depth: "30–35 cm",
    flexion: "Neutral",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by rotating the multiplane angle to 80–100° from the ME commissural view. Displays the LV anterior and inferior walls, the mitral valve (A1/A2 and P2/P3), and the left atrial appendage. Equivalent to the TTE apical 2-chamber.",
    howToGet: [
      "From ME Mitral Commissural (60°), rotate multiplane angle to 80–100°",
      "Keep probe at mid-esophagus (30–35 cm)",
      "The LV anterior wall will be in the near field, inferior wall in the far field",
      "The LAA is visible in the near field — assess for thrombus",
      "Optimize depth to include the LV apex",
    ],
    structures: [
      "LV anterior wall (LAD territory)", "LV inferior wall (RCA territory)",
      "LV apex", "Mitral valve (A1/A2 and P2/P3 segments)",
      "Left atrium", "Left atrial appendage (LAA)",
    ],
    doppler: [
      { label: "LAA PW Doppler", detail: "LAA emptying velocity. Normal >40 cm/s. <20 cm/s = high thrombus risk" },
      { label: "MV Color Doppler", detail: "Assess MR in 2-chamber plane — anterior vs posterior jet" },
    ],
    tips: [
      "The LAA is best seen in this view — always assess for thrombus or spontaneous echo contrast (SEC)",
      "The LV anterior wall is the near-field wall; inferior wall is far field",
      "Advance the probe slightly to open the LV apex",
    ],
    pitfalls: [
      "LAA thrombus can be missed if the LAA is not fully opened — rotate slightly counterclockwise",
      "The LAA ridge (ligament of Marshall) can mimic a thrombus",
    ],
    measurements: ["LV anterior and inferior wall motion scores", "LAA emptying velocity", "LAA dimensions"],
    criticalFindings: ["LAA thrombus", "LV anterior wall motion abnormality (LAD territory)", "Severe MR"],
  },

  // ── VIEW 5: ME Long Axis (LAX) ───────────────────────────────────────────
  {
    id: "melax",
    aseNumber: "5",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Long Axis",
    angle: "120–140°",
    depth: "30–35 cm",
    flexion: "Neutral",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by rotating the multiplane angle to 120–140°. Equivalent to the TTE parasternal long-axis view. Displays the LVOT, aortic valve, aortic root, and mitral valve in the same plane — the primary view for aortic root measurement and AR assessment.",
    howToGet: [
      "From ME 2-Chamber (90°), rotate multiplane angle to 120–140°",
      "Keep probe at mid-esophagus (30–35 cm)",
      "The LVOT and AV will appear in the near field; MV in the far field",
      "Adjust depth and gain to visualise the aortic root and proximal ascending aorta",
      "Fine-tune angle to align the LVOT parallel to the imaging plane",
    ],
    structures: [
      "LV (posterior and anterior walls)", "LVOT",
      "Aortic valve (right and non-coronary cusps)", "Aortic root",
      "Sinus of Valsalva", "Sinotubular junction (STJ)", "Proximal ascending aorta",
      "Mitral valve (anterior and posterior leaflets)", "Left atrium",
    ],
    doppler: [
      { label: "LVOT PW Doppler", detail: "Sample 0.5–1 cm below AV. VTI for stroke volume" },
      { label: "AR Color Doppler", detail: "Jet width/LVOT width. Severe AR: jet width >65% LVOT" },
      { label: "MV Color Doppler", detail: "Posterior leaflet prolapse best seen in this view" },
    ],
    tips: [
      "Measure aortic root at end-diastole: annulus, sinus of Valsalva, STJ, ascending aorta",
      "This is the best view for LVOT diameter measurement (for AVA calculation)",
      "Posterior MV leaflet prolapse (P2) is most clearly seen in this view",
    ],
    pitfalls: [
      "LVOT diameter measurement errors directly affect AVA calculation — measure carefully",
      "The ascending aorta may not be fully visible — withdraw slightly for better visualisation",
    ],
    measurements: ["Aortic annulus diameter", "Sinus of Valsalva diameter", "STJ diameter", "Ascending aorta diameter", "LVOT diameter", "LVOT VTI"],
    criticalFindings: ["Aortic root dilation (>4.5 cm)", "Severe AR", "Aortic dissection flap", "Posterior MV leaflet prolapse"],
  },

  // ── VIEW 6: ME AV Long Axis ──────────────────────────────────────────────
  {
    id: "me_av_lax",
    aseNumber: "6",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME AV Long Axis",
    angle: "120–140°",
    depth: "25–30 cm",
    flexion: "Slight anteflexion; withdraw ± anteflex",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by withdrawing the probe slightly from the ME LAX position and applying slight anteflexion. Focuses on the aortic valve and root in the long axis, with improved visualisation of the RVOT and pulmonary valve anteriorly.",
    howToGet: [
      "From ME Long Axis (120–140°), withdraw probe 1–2 cm",
      "Apply slight anteflexion to bring the AV and RVOT into optimal alignment",
      "The AV should be centred in the image with the RVOT visible anteriorly",
      "Fine-tune angle between 120–140° for best leaflet coaptation view",
    ],
    structures: [
      "Aortic valve (all three cusps in long axis)", "Aortic root",
      "RVOT", "Pulmonary valve",
      "Proximal ascending aorta", "LVOT",
    ],
    doppler: [
      { label: "AR Color Doppler", detail: "Assess AR jet width relative to LVOT. Holodiastolic flow reversal in descending aorta = severe AR" },
      { label: "RVOT Color Doppler", detail: "Assess RVOT obstruction or PR" },
    ],
    tips: [
      "This view complements ME AV SAX — use both to fully characterise AV pathology",
      "Bicuspid AV is best identified in ME AV SAX, but the doming and raphe are well seen here",
      "The RVOT is anterior to the AV — useful for RVOT obstruction assessment",
    ],
    pitfalls: [
      "Confusing ME LAX and ME AV LAX — the key difference is the RVOT visibility in ME AV LAX",
    ],
    measurements: ["AV leaflet opening (planimetry)", "AR vena contracta", "RVOT diameter"],
    criticalFindings: ["Severe AR", "AV perforation or vegetation", "RVOT obstruction"],
  },

  // ── VIEW 7: ME Ascending Aorta LAX ──────────────────────────────────────
  {
    id: "me_asc_ao_lax",
    aseNumber: "7",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Ascending Aorta LAX",
    angle: "90–110°",
    depth: "25–30 cm",
    flexion: "Neutral; withdraw",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by withdrawing the probe to the upper esophagus and rotating to 90–110°. Provides a long-axis view of the ascending aorta, allowing measurement of aortic diameter and assessment for dissection, aneurysm, or atheroma.",
    howToGet: [
      "From ME AV LAX, withdraw probe to upper esophagus (~25–30 cm)",
      "Rotate multiplane angle to 90–110°",
      "The ascending aorta should appear as a long tubular structure",
      "Adjust depth to include the full ascending aorta up to the arch",
    ],
    structures: [
      "Ascending aorta (proximal to mid)", "Aortic arch (partially)",
      "Right pulmonary artery (crosses posterior to ascending aorta)",
    ],
    doppler: [
      { label: "Ascending Aorta Color Doppler", detail: "Assess for dissection flap with color flow in false lumen" },
    ],
    tips: [
      "The right pulmonary artery crosses posterior to the ascending aorta — a useful landmark",
      "Withdraw slowly from ME LAX to trace the aorta from root to arch",
      "Atheroma grading: Grade I (normal) to Grade V (mobile plaque)",
    ],
    pitfalls: [
      "The distal ascending aorta and arch are often obscured by the trachea (blind spot) — use epiaortic scanning if needed",
      "Do not confuse the right pulmonary artery for the aorta",
    ],
    measurements: ["Ascending aorta diameter (at multiple levels)", "Atheroma grade"],
    criticalFindings: ["Type A aortic dissection", "Ascending aortic aneurysm (>5.5 cm)", "Mobile atheroma"],
  },

  // ── VIEW 8: ME Ascending Aorta SAX ──────────────────────────────────────
  {
    id: "me_asc_ao_sax",
    aseNumber: "8",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Ascending Aorta SAX",
    angle: "0–30°",
    depth: "25–30 cm",
    flexion: "Neutral; clockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained from the upper esophagus by rotating clockwise and setting the angle to 0–30°. Provides a short-axis cross-section of the ascending aorta, with the right pulmonary artery and SVC visible. Useful for dissection and pulmonary artery assessment.",
    howToGet: [
      "From ME Ascending Aorta LAX, rotate clockwise",
      "Set multiplane angle to 0–30°",
      "The ascending aorta appears as a circular structure",
      "The right pulmonary artery is seen posterior to the aorta",
      "The SVC is visible to the right of the aorta",
    ],
    structures: [
      "Ascending aorta (cross-section)", "Right pulmonary artery",
      "Superior vena cava (SVC)", "Main pulmonary artery (partially)",
    ],
    doppler: [
      { label: "PA Color Doppler", detail: "Assess pulmonary artery flow and detect PR" },
      { label: "Aorta Color Doppler", detail: "Detect false lumen flow in dissection" },
    ],
    tips: [
      "The right PA is seen as an elongated structure posterior to the ascending aorta",
      "This view is useful for detecting sinus venosus ASD near the SVC",
      "Clockwise rotation from ME Asc Ao LAX brings the SAX view into alignment",
    ],
    pitfalls: [
      "The ascending aorta blind spot (tracheal interposition) limits full visualisation",
    ],
    measurements: ["Ascending aorta diameter (SAX)", "Right PA diameter"],
    criticalFindings: ["Type A dissection flap in ascending aorta", "Pulmonary embolism (right PA thrombus)"],
  },

  // ── VIEW 9: ME Right Pulmonary Vein ─────────────────────────────────────
  {
    id: "me_rpv",
    aseNumber: "9",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Right Pulmonary Vein",
    angle: "0–30°",
    depth: "25–30 cm",
    flexion: "Clockwise rotation, advance",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by clockwise rotation from the ME Ascending Aorta SAX view and slight advancement. Allows visualisation of the right upper and lower pulmonary veins entering the left atrium — important for sinus venosus ASD and pulmonary vein Doppler.",
    howToGet: [
      "From ME Ascending Aorta SAX, rotate clockwise",
      "Advance probe slightly (1–2 cm)",
      "Set multiplane angle to 0–30°",
      "The right pulmonary veins will be seen entering the posterior LA",
      "Adjust to visualise both right upper (RUPV) and right lower (RLPV) pulmonary veins",
    ],
    structures: [
      "Right upper pulmonary vein (RUPV)", "Right lower pulmonary vein (RLPV)",
      "Left atrium (posterior wall)", "Interatrial septum",
    ],
    doppler: [
      { label: "PV PW Doppler", detail: "Normal: S>D, AR wave <35 cm/s. Blunted S/D ratio suggests elevated LA pressure or MR" },
      { label: "PV Color Doppler", detail: "Assess for anomalous pulmonary venous drainage or sinus venosus ASD" },
    ],
    tips: [
      "Pulmonary vein Doppler is used to assess diastolic function and MR severity",
      "Sinus venosus ASD near the SVC causes anomalous RUPV drainage — look carefully",
      "The RUPV is usually the easiest to align for Doppler",
    ],
    pitfalls: [
      "Confusing the RUPV with the SVC — the RUPV enters the posterior LA, SVC enters the RA",
    ],
    measurements: ["PV S/D ratio", "PV AR wave velocity and duration", "PV diameter"],
    criticalFindings: ["Anomalous pulmonary venous drainage", "Sinus venosus ASD with RUPV drainage to SVC"],
  },

  // ── VIEW 10: ME AV Short Axis ────────────────────────────────────────────
  {
    id: "meavsax",
    aseNumber: "10",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME AV Short Axis",
    angle: "25–45°",
    depth: "30–35 cm",
    flexion: "Counterclockwise, advance, anteflex",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by advancing and antiflexxing from the ME position with counterclockwise rotation, setting the angle to 25–45°. Provides a short-axis cross-section of the aortic valve showing all three cusps — the key view for AV morphology (bicuspid vs tricuspid) and planimetry.",
    howToGet: [
      "From ME 4-Chamber, rotate counterclockwise and advance slightly",
      "Apply anteflexion to bring the AV into view",
      "Set multiplane angle to 25–45°",
      "The three AV cusps (R, L, N) should appear as a 'Mercedes-Benz' sign in diastole",
      "Adjust angle and flexion to see all three commissures simultaneously",
    ],
    structures: [
      "Aortic valve: right (R), left (L), and non-coronary (N) cusps",
      "Coronary ostia: LMCA (from left cusp), RCA (from right cusp)",
      "RVOT (anterior)", "Pulmonary valve",
      "Tricuspid valve and RA (posterior right)",
      "Interatrial septum",
    ],
    doppler: [
      { label: "AV Color Doppler (SAX)", detail: "Identify which cusp is prolapsing, perforated, or has a vegetation" },
      { label: "AR Color Doppler", detail: "Identify origin of AR jet — which commissure is involved" },
    ],
    tips: [
      "Bicuspid AV: only two cusps visible, often with a raphe. The commissures are at 12 and 6 o'clock (anterior-posterior) or 10 and 4 o'clock",
      "Coronary ostia are visible — assess for dissection or anomalous origin",
      "The RVOT is anterior to the AV in this view",
    ],
    pitfalls: [
      "A bicuspid AV with a raphe can mimic a tricuspid AV — look for the 'fish-mouth' opening pattern",
      "Calcification can obscure cusp morphology — use 3D TEE if available",
    ],
    measurements: ["AV planimetry (AVA)", "Aortic root diameter at sinus level", "Coronary ostia position"],
    criticalFindings: ["Bicuspid AV", "AV vegetation or perforation", "Coronary artery anomaly or dissection"],
  },

  // ── VIEW 11: ME RV Inflow-Outflow ────────────────────────────────────────
  {
    id: "mervio",
    aseNumber: "11",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME RV Inflow-Outflow",
    angle: "50–70°",
    depth: "30–35 cm",
    flexion: "Clockwise rotation, advance",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by clockwise rotation from the ME AV SAX and advancing slightly, with the angle at 50–70°. Displays the tricuspid valve (inflow), RVOT, and pulmonary valve (outflow) in a single plane — the key view for RV outflow tract assessment.",
    howToGet: [
      "From ME AV SAX (25–45°), rotate clockwise and advance slightly",
      "Set multiplane angle to 50–70°",
      "The TV will appear on the right side of the image (inflow), RVOT and PV on the left (outflow)",
      "Adjust to see the TV, RVOT, and PV simultaneously",
    ],
    structures: [
      "Tricuspid valve (anterior and posterior leaflets)", "Right atrium",
      "RVOT", "Pulmonary valve", "Main pulmonary artery",
      "Aortic valve (partially, in centre)",
    ],
    doppler: [
      { label: "TV Color Doppler", detail: "TR jet direction and severity" },
      { label: "PV Color Doppler", detail: "PR assessment. Pulmonary hypertension signs" },
      { label: "RVOT PW Doppler", detail: "RVOT VTI for RV stroke volume. Normal RVOT VTI ~15–20 cm" },
    ],
    tips: [
      "This is the best view for RVOT PW Doppler — align beam parallel to RVOT flow",
      "Carcinoid heart disease: thickened, retracted TV and PV leaflets with fixed open position",
      "The PA can be followed from the PV to the bifurcation by withdrawing slightly",
    ],
    pitfalls: [
      "The TV and PV can be confused — the TV is on the right (inflow), PV on the left (outflow)",
    ],
    measurements: ["RVOT VTI (RV stroke volume)", "PA diameter", "TV annulus diameter", "TR Vmax"],
    criticalFindings: ["Pulmonary embolism (main PA thrombus)", "Carcinoid valve disease", "RVOT obstruction", "Severe PR"],
  },

  // ── VIEW 12: ME Modified Bicaval TV ─────────────────────────────────────
  {
    id: "me_mod_bicaval_tv",
    aseNumber: "12",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Modified Bicaval TV",
    angle: "50–70°",
    depth: "30–35 cm",
    flexion: "Clockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by clockwise rotation from the ME RV Inflow-Outflow view, maintaining the angle at 50–70°. Provides a modified bicaval view that includes the tricuspid valve, allowing simultaneous assessment of the IAS and TV.",
    howToGet: [
      "From ME RV Inflow-Outflow (50–70°), rotate clockwise",
      "Maintain multiplane angle at 50–70°",
      "The IAS should be visible with the TV on the right side",
      "Adjust to see SVC, IVC, and TV in the same view",
    ],
    structures: [
      "Interatrial septum", "Superior vena cava (SVC)", "Inferior vena cava (IVC)",
      "Tricuspid valve (anterior and septal leaflets)", "Right atrium", "Left atrium",
    ],
    doppler: [
      { label: "IAS Color Doppler", detail: "Detect shunting across ASD or PFO" },
      { label: "TV Color Doppler", detail: "TR assessment in this modified plane" },
    ],
    tips: [
      "This view bridges the ME RV Inflow-Outflow and ME Bicaval views",
      "Useful for assessing the TV in the context of IAS pathology (e.g., Ebstein's anomaly with ASD)",
    ],
    pitfalls: [
      "The TV can be partially obscured — rotate slightly to optimise",
    ],
    measurements: ["TV annulus diameter", "IAS shunt direction"],
    criticalFindings: ["Ebstein's anomaly (apically displaced TV)", "TV vegetation", "ASD with TV involvement"],
  },

  // ── VIEW 13: ME Bicaval ──────────────────────────────────────────────────
  {
    id: "mebicaval",
    aseNumber: "13",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Bicaval",
    angle: "90–110°",
    depth: "30–35 cm",
    flexion: "Clockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by clockwise rotation with the angle at 90–110°. Displays the full length of the interatrial septum with both the SVC and IVC entering the RA — the definitive view for ASD, PFO, and IAS pathology.",
    howToGet: [
      "From ME Modified Bicaval TV, rotate clockwise further",
      "Set multiplane angle to 90–110°",
      "The SVC should appear at the top right, IVC at the bottom right",
      "The IAS should be seen in full length between the two atria",
      "Apply colour Doppler across the IAS to detect shunting",
    ],
    structures: [
      "Interatrial septum (full length)", "Fossa ovalis",
      "Superior vena cava (SVC)", "Inferior vena cava (IVC)",
      "Right atrium", "Left atrium", "Eustachian valve (at IVC-RA junction)",
    ],
    doppler: [
      { label: "IAS Color Doppler", detail: "Shunt direction and size. L→R in ASD; R→L in PFO with elevated RA pressure" },
      { label: "Bubble study", detail: "IV agitated saline — bubbles crossing to LA within 3 beats = PFO" },
      { label: "SVC PW Doppler", detail: "Hepatic vein Doppler pattern for RA pressure estimation" },
    ],
    tips: [
      "Secundum ASD: central defect in the fossa ovalis. Sinus venosus ASD: near SVC or IVC",
      "PFO: tunnel-like defect at the fossa ovalis — use colour and bubble study",
      "The Eustachian valve at the IVC-RA junction can be mistaken for a mass",
    ],
    pitfalls: [
      "Sinus venosus ASD near the SVC can be missed — withdraw slightly and look at the SVC-RA junction",
      "The Eustachian valve is a normal structure — do not confuse with a mass or thrombus",
    ],
    measurements: ["ASD diameter", "ASD rim measurements (for device sizing)", "IAS length"],
    criticalFindings: ["Secundum ASD", "Sinus venosus ASD", "PFO (with R→L shunt)", "IAS aneurysm"],
  },

  // ── VIEW 14A: UE Right Pulmonary Veins ──────────────────────────────────
  {
    id: "ue_rpv",
    aseNumber: "14A",
    group: "Upper Esophageal",
    groupColor: UE_COLOR,
    name: "UE Right Pulmonary Veins",
    angle: "90–110°",
    depth: "20–25 cm",
    flexion: "Withdraw, clockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by withdrawing the probe to the upper esophagus and rotating clockwise with the angle at 90–110°. Provides a clear view of the right upper and lower pulmonary veins entering the posterior left atrium.",
    howToGet: [
      "From ME Bicaval, withdraw probe to upper esophagus (~20–25 cm)",
      "Rotate clockwise",
      "Set multiplane angle to 90–110°",
      "The right pulmonary veins should be seen entering the posterior LA",
      "Adjust clockwise rotation to see both RUPV and RLPV",
    ],
    structures: [
      "Right upper pulmonary vein (RUPV)", "Right lower pulmonary vein (RLPV)",
      "Left atrium (posterior wall)", "Interatrial septum",
    ],
    doppler: [
      { label: "RUPV PW Doppler", detail: "S/D ratio, AR wave. Blunted S = elevated LA pressure or severe MR" },
    ],
    tips: [
      "The RUPV is the most accessible pulmonary vein for Doppler in most patients",
      "Sinus venosus ASD: look for RUPV draining into the SVC rather than the LA",
    ],
    pitfalls: [
      "Confusing RUPV with SVC — RUPV enters the posterior LA, SVC enters the RA superiorly",
    ],
    measurements: ["RUPV S/D ratio", "RUPV AR wave velocity"],
    criticalFindings: ["Anomalous RUPV drainage (sinus venosus ASD)", "Pulmonary vein stenosis"],
  },

  // ── VIEW 14B: UE Left Pulmonary Veins ───────────────────────────────────
  {
    id: "ue_lpv",
    aseNumber: "14B",
    group: "Upper Esophageal",
    groupColor: UE_COLOR,
    name: "UE Left Pulmonary Veins",
    angle: "90–110°",
    depth: "20–25 cm",
    flexion: "Withdraw, counterclockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained from the upper esophagus by rotating counterclockwise from the right pulmonary vein view. Displays the left upper and lower pulmonary veins entering the posterior left atrium.",
    howToGet: [
      "From UE Right Pulmonary Veins, rotate counterclockwise",
      "Maintain multiplane angle at 90–110°",
      "The left pulmonary veins will be seen entering the posterior LA on the left side",
      "Adjust counterclockwise rotation to see both LUPV and LLPV",
    ],
    structures: [
      "Left upper pulmonary vein (LUPV)", "Left lower pulmonary vein (LLPV)",
      "Left atrium (posterior wall)", "Left atrial appendage (partially)",
    ],
    doppler: [
      { label: "LUPV PW Doppler", detail: "S/D ratio, AR wave. Compare with RUPV for asymmetric MR" },
    ],
    tips: [
      "The LUPV is adjacent to the LAA — distinguish carefully",
      "Asymmetric pulmonary vein Doppler (blunted on one side) suggests eccentric MR jet toward that side",
    ],
    pitfalls: [
      "The LAA ridge can be confused with the LUPV orifice",
    ],
    measurements: ["LUPV S/D ratio", "LUPV AR wave velocity"],
    criticalFindings: ["Anomalous left pulmonary venous drainage", "Pulmonary vein stenosis (post-ablation)"],
  },

  // ── VIEW 15: ME Left Atrial Appendage ───────────────────────────────────
  {
    id: "me_laa",
    aseNumber: "15",
    group: "Mid-Esophageal",
    groupColor: ME_COLOR,
    name: "ME Left Atrial Appendage",
    angle: "90–110°",
    depth: "30–35 cm",
    flexion: "Advance",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by advancing the probe from the ME position with the angle at 90–110°. Provides a direct view of the left atrial appendage — the most important view for LAA thrombus exclusion before cardioversion or AF ablation.",
    howToGet: [
      "From ME Bicaval or ME 2-Chamber, advance probe slightly",
      "Set multiplane angle to 90–110°",
      "The LAA should open up as a finger-like structure in the near field",
      "Rotate slightly counterclockwise to fully open the LAA",
      "Sweep through multiple angles (0°, 45°, 90°, 135°) to exclude thrombus in all lobes",
    ],
    structures: [
      "Left atrial appendage (LAA) — all lobes",
      "LAA ridge (ligament of Marshall)", "Left upper pulmonary vein (adjacent)",
      "Left atrium",
    ],
    doppler: [
      { label: "LAA PW Doppler", detail: "LAA emptying velocity. Normal >40 cm/s. <20 cm/s = high thrombus risk (stasis)" },
      { label: "LAA Color Doppler", detail: "Spontaneous echo contrast (SEC) — swirling pattern = stasis" },
    ],
    tips: [
      "Always image the LAA in at least two orthogonal planes (0° and 90°) to exclude thrombus",
      "The LAA ridge is a normal structure — do not confuse with thrombus (it moves with the ridge)",
      "Sweep from 0° to 135° to visualise all LAA lobes",
    ],
    pitfalls: [
      "The LAA ridge (ligament of Marshall) is the most common mimic of LAA thrombus",
      "A thrombus is fixed, echogenic, and does not move with the ridge",
      "LAA lobes can harbour thrombus even when the main body appears clear",
    ],
    measurements: ["LAA emptying velocity", "LAA dimensions (length, width)", "LAA orifice diameter (for occlusion device sizing)"],
    criticalFindings: ["LAA thrombus (contraindication to cardioversion)", "Dense SEC (high thrombus risk)", "LAA orifice diameter >25 mm"],
  },

  // ── VIEW 16: TG Basal SAX ────────────────────────────────────────────────
  {
    id: "tgbasal",
    aseNumber: "16",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG Basal SAX",
    angle: "0–20°",
    depth: "40–45 cm",
    flexion: "Advance ± anteflexion",
    patientPosition: "Supine; bite block in place; advance probe into stomach",
    description: "Obtained by advancing the probe into the stomach and applying anteflexion at 0–20°. Provides a short-axis view of the LV at the basal level (mitral valve level), showing all six basal segments and the mitral valve leaflets.",
    howToGet: [
      "Advance probe past the gastroesophageal junction into the stomach (~40–45 cm)",
      "Set multiplane angle to 0–20°",
      "Apply anteflexion to press the transducer against the gastric wall",
      "The mitral valve leaflets should be visible as a 'fish-mouth' opening",
      "The LV should appear as a circular structure with the MV in the centre",
    ],
    structures: [
      "LV basal segments (anteroseptal, anterior, anterolateral, inferolateral, inferior, inferoseptal)",
      "Mitral valve (anterior and posterior leaflets)", "Papillary muscles (partially)",
    ],
    doppler: [],
    tips: [
      "This view is used to assess basal LV wall motion and MV leaflet morphology from below",
      "The anterior leaflet is on the left side of the image, posterior leaflet on the right",
      "Advance slightly to move from basal to mid-papillary level",
    ],
    pitfalls: [
      "Inadequate anteflexion results in a poor acoustic window — ensure probe is pressed against the gastric wall",
      "The LV may appear foreshortened if the probe is not fully advanced",
    ],
    measurements: ["LV basal diameter", "MV leaflet morphology assessment"],
    criticalFindings: ["Basal LV wall motion abnormality", "MV leaflet restriction or prolapse"],
  },

  // ── VIEW 17: TG Mid Papillary SAX ────────────────────────────────────────
  {
    id: "tgsax",
    aseNumber: "17",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG Mid Papillary SAX",
    angle: "0–20°",
    depth: "40–45 cm",
    flexion: "Advance ± anteflexion",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "The most important transgastric view. Obtained by advancing slightly from TG Basal SAX. Provides a short-axis cross-section of the LV at the mid-papillary level — the gold standard for real-time LV wall motion monitoring and global systolic function assessment.",
    howToGet: [
      "From TG Basal SAX, advance probe 1–2 cm",
      "Maintain multiplane angle at 0–20°",
      "The two papillary muscles (anterolateral and posteromedial) should be visible",
      "The LV should appear as a symmetric circle with equal wall thickness",
      "Adjust anteflexion to maintain contact with the gastric wall",
    ],
    structures: [
      "LV mid segments (anteroseptal, anterior, anterolateral, inferolateral, inferior, inferoseptal)",
      "Anterolateral papillary muscle (ALPM)", "Posteromedial papillary muscle (PMPM)",
      "RV (partially, on the left side of image)",
    ],
    doppler: [],
    tips: [
      "This is the primary view for intraoperative LV monitoring — new wall motion abnormalities indicate ischaemia",
      "The ALPM is supplied by the LAD and LCx; the PMPM is supplied by the RCA (single supply — more vulnerable)",
      "A symmetric circle with equal wall thickness confirms correct mid-papillary level",
    ],
    pitfalls: [
      "Imaging at the wrong level (too basal or too apical) gives misleading wall motion data",
      "Foreshortening of the LV gives a falsely small cavity",
    ],
    measurements: ["LV EDD and ESD (M-mode or 2D)", "FAC (fractional area change) = (EDA-ESA)/EDA × 100", "Wall thickness (IVS, PW)"],
    criticalFindings: ["New regional wall motion abnormality (ischaemia)", "LV dilation (EDD >5.5 cm)", "Severe LV hypertrophy (wall >1.5 cm)"],
  },

  // ── VIEW 18: TG Apical SAX ───────────────────────────────────────────────
  {
    id: "tg_apical_sax",
    aseNumber: "18",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG Apical SAX",
    angle: "0–20°",
    depth: "40–45 cm",
    flexion: "Advance ± anteflexion",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained by advancing further from TG Mid SAX. Provides a short-axis view of the LV at the apical level — important for completing the three-level SAX assessment of LV wall motion (basal, mid, apical).",
    howToGet: [
      "From TG Mid Papillary SAX, advance probe 1–2 cm further",
      "Maintain multiplane angle at 0–20°",
      "The papillary muscles should disappear and the LV cavity should appear smaller",
      "The LV apex should be visible as a small circular structure",
    ],
    structures: [
      "LV apical segments (apical anteroseptal, apical anterior, apical anterolateral, apical inferolateral, apical inferior, apical inferoseptal)",
      "LV apex",
    ],
    doppler: [],
    tips: [
      "The apical segments are the most vulnerable to ischaemia in LAD territory disease",
      "The LV cavity is smallest at the apical level — do not confuse with a foreshortened mid-SAX",
    ],
    pitfalls: [
      "Over-advancing can result in imaging beyond the apex with no useful structures",
    ],
    measurements: ["Apical LV wall motion scores"],
    criticalFindings: ["Apical wall motion abnormality (LAD territory)", "Apical thrombus"],
  },

  // ── VIEW 19: TG RV Basal ─────────────────────────────────────────────────
  {
    id: "tg_rv_basal",
    aseNumber: "19",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG RV Basal",
    angle: "0–20°",
    depth: "40–45 cm",
    flexion: "Anteflexion",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained from the transgastric position with anteflexion at 0–20°. Provides a short-axis view of the RV at the basal level, showing the tricuspid valve and RV inflow — useful for RV size and TV assessment from below.",
    howToGet: [
      "From TG Basal SAX, apply anteflexion",
      "Maintain multiplane angle at 0–20°",
      "The RV will appear on the left side of the image",
      "The TV leaflets should be visible",
    ],
    structures: [
      "RV (basal level)", "Tricuspid valve (all three leaflets from below)",
      "Right atrium (partially)",
    ],
    doppler: [
      { label: "TV Color Doppler", detail: "TR assessment from transgastric approach" },
    ],
    tips: [
      "This view complements the ME RV Inflow-Outflow for TV assessment",
      "The TV leaflets are seen from the ventricular side in this view",
    ],
    pitfalls: [
      "The RV free wall is thin and may be difficult to visualise clearly",
    ],
    measurements: ["RV basal diameter", "TV annulus diameter (from below)"],
    criticalFindings: ["RV dilation", "TV leaflet abnormality"],
  },

  // ── VIEW 20: TG RV Inflow-Outflow ────────────────────────────────────────
  {
    id: "tg_rv_io",
    aseNumber: "20",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG RV Inflow-Outflow",
    angle: "0–20°",
    depth: "40–45 cm",
    flexion: "Right lateral flexion",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained from the transgastric position with right lateral flexion at 0–20°. Provides a view of the RV inflow (TV) and outflow (RVOT/PV) from the transgastric approach — an alternative to the ME RV Inflow-Outflow view.",
    howToGet: [
      "From TG RV Basal, apply right lateral flexion",
      "Maintain multiplane angle at 0–20°",
      "The TV (inflow) and RVOT/PV (outflow) should come into view",
    ],
    structures: [
      "Tricuspid valve", "Right atrium", "RVOT", "Pulmonary valve",
    ],
    doppler: [
      { label: "TV Color Doppler", detail: "TR assessment" },
      { label: "RVOT Color Doppler", detail: "RVOT obstruction assessment" },
    ],
    tips: [
      "This view is useful when the ME RV Inflow-Outflow is suboptimal",
    ],
    pitfalls: [
      "Right lateral flexion can be uncomfortable — ensure adequate sedation",
    ],
    measurements: ["RVOT VTI", "TV annulus diameter"],
    criticalFindings: ["RVOT obstruction", "Severe TR"],
  },

  // ── VIEW 21: Deep TG 5-Chamber ───────────────────────────────────────────
  {
    id: "deep_tg_5c",
    aseNumber: "21",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "Deep TG 5-Chamber",
    angle: "90–110°",
    depth: "40–45 cm",
    flexion: "Left lateral flexion, advance, anteflexion",
    patientPosition: "Supine; bite block in place; probe advanced deep into stomach",
    description: "Obtained by advancing the probe deep into the stomach with left lateral flexion and anteflexion, rotating to 90–110°. Provides a long-axis view of the LV from the apex, with the LVOT and aortic valve in the near field — the best view for LVOT/AV CW Doppler alignment.",
    howToGet: [
      "From TG Mid SAX, advance probe deep into the stomach",
      "Apply left lateral flexion and anteflexion",
      "Set multiplane angle to 90–110°",
      "The LV apex should be in the near field, LVOT and AV in the far field",
      "Align the Doppler beam parallel to LVOT flow for accurate velocity measurement",
    ],
    structures: [
      "LV (apex in near field)", "LVOT", "Aortic valve",
      "Mitral valve (partially)", "Left atrium (far field)",
    ],
    doppler: [
      { label: "AV CW Doppler", detail: "Best alignment for AV peak velocity. Normal <2 m/s. Severe AS >4 m/s" },
      { label: "LVOT PW Doppler", detail: "LVOT VTI for stroke volume. Best alignment in this view" },
      { label: "MR CW Doppler", detail: "Peak MR velocity for dP/dt calculation" },
    ],
    tips: [
      "This is the most important view for AV CW Doppler — the beam is nearly parallel to LVOT flow",
      "If AV gradients are underestimated in ME views, always check from Deep TG 5C",
      "dP/dt from MR CW Doppler: time from 1 to 3 m/s. Normal >1000 mmHg/s",
    ],
    pitfalls: [
      "Advancing the probe too deep can cause discomfort — use adequate sedation",
      "Poor image quality is common — optimise gain and focus",
    ],
    measurements: ["AV peak velocity and mean gradient", "LVOT VTI", "AVA (continuity equation)", "LV dP/dt"],
    criticalFindings: ["Severe AS (peak velocity >4 m/s, mean gradient >40 mmHg)", "Dynamic LVOT obstruction"],
  },

  // ── VIEW 22: TG 2-Chamber ────────────────────────────────────────────────
  {
    id: "tg2c",
    aseNumber: "22",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG 2-Chamber",
    angle: "90–110°",
    depth: "40–45 cm",
    flexion: "Neutral flexion, withdraw",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained from the transgastric position by withdrawing slightly with neutral flexion at 90–110°. Provides a long-axis view of the LV showing the anterior and inferior walls, equivalent to the TTE apical 2-chamber but from below.",
    howToGet: [
      "From TG Mid SAX, rotate multiplane angle to 90–110°",
      "Apply neutral flexion and withdraw slightly",
      "The LV anterior wall should be on the left, inferior wall on the right",
      "The MV should be visible in the far field",
    ],
    structures: [
      "LV anterior wall (LAD territory)", "LV inferior wall (RCA territory)",
      "LV apex", "Mitral valve", "Left atrium (partially)",
    ],
    doppler: [
      { label: "MV Color Doppler", detail: "MR assessment from transgastric approach" },
    ],
    tips: [
      "This view complements the ME 2-Chamber for complete LV wall motion assessment",
      "The LV anterior wall is on the left side of the image in this view",
    ],
    pitfalls: [
      "The image quality may be inferior to ME views — use as complementary",
    ],
    measurements: ["LV anterior and inferior wall motion scores"],
    criticalFindings: ["LV anterior or inferior wall motion abnormality"],
  },

  // ── VIEW 23: TG RV Inflow ────────────────────────────────────────────────
  {
    id: "tg_rv_inflow",
    aseNumber: "23",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG RV Inflow",
    angle: "90–110°",
    depth: "40–45 cm",
    flexion: "Clockwise rotation",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained from the transgastric position by clockwise rotation at 90–110°. Provides a long-axis view of the RV inflow, showing the tricuspid valve and RV body — useful for TV chordal and subvalvular apparatus assessment.",
    howToGet: [
      "From TG 2-Chamber, rotate clockwise",
      "Maintain multiplane angle at 90–110°",
      "The TV and RV inflow should come into view",
      "The RA should be visible in the far field",
    ],
    structures: [
      "Tricuspid valve (all three leaflets)", "RV body", "Right atrium",
      "TV chordae and papillary muscles",
    ],
    doppler: [
      { label: "TV Color Doppler", detail: "TR jet assessment from transgastric approach" },
      { label: "TV CW Doppler", detail: "TR Vmax for RVSP estimation" },
    ],
    tips: [
      "This view is useful for assessing TV chordal rupture or papillary muscle involvement",
      "Ebstein's anomaly: apically displaced TV leaflets are well seen in this view",
    ],
    pitfalls: [
      "The TV may be partially obscured — adjust clockwise rotation to optimise",
    ],
    measurements: ["TV annulus diameter", "TR Vmax (RVSP)"],
    criticalFindings: ["TV chordal rupture", "Ebstein's anomaly", "TV vegetation"],
  },

  // ── VIEW 24: TG LAX ──────────────────────────────────────────────────────
  {
    id: "tglax",
    aseNumber: "24",
    group: "Transgastric",
    groupColor: TG_COLOR,
    name: "TG Long Axis",
    angle: "120–140°",
    depth: "40–45 cm",
    flexion: "Counterclockwise rotation",
    patientPosition: "Supine; bite block in place; probe in stomach",
    description: "Obtained from the transgastric position by rotating counterclockwise to 120–140°. Provides a long-axis view of the LV from below, showing the LVOT and aortic valve — an alternative to the Deep TG 5C for LVOT/AV Doppler when the deep view is not achievable.",
    howToGet: [
      "From TG 2-Chamber (90–110°), rotate counterclockwise",
      "Set multiplane angle to 120–140°",
      "The LVOT and AV should come into view in the far field",
      "The LV posterior and anterior walls should be visible",
    ],
    structures: [
      "LV (posterior and anterior walls)", "LVOT", "Aortic valve",
      "Mitral valve", "Left atrium (far field)",
    ],
    doppler: [
      { label: "LVOT PW Doppler", detail: "LVOT VTI — alternative alignment to Deep TG 5C" },
      { label: "AV CW Doppler", detail: "AV peak velocity — use if Deep TG 5C is not achievable" },
    ],
    tips: [
      "This view is the transgastric equivalent of the ME LAX",
      "Use when Deep TG 5C is not achievable due to patient anatomy",
    ],
    pitfalls: [
      "The beam alignment for Doppler may not be as optimal as Deep TG 5C",
    ],
    measurements: ["LVOT VTI", "AV peak velocity"],
    criticalFindings: ["Severe AS", "Dynamic LVOT obstruction"],
  },

  // ── VIEW 25: Descending Aorta SAX ────────────────────────────────────────
  {
    id: "desc_ao_sax",
    aseNumber: "25",
    group: "Aorta",
    groupColor: AO_COLOR,
    name: "Descending Aorta SAX",
    angle: "0–10°",
    depth: "30–35 cm",
    flexion: "Neutral flexion; counterclockwise rotation",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by rotating counterclockwise from the ME 4-Chamber position with the angle at 0–10°. The descending thoracic aorta appears as a circular structure in the left posterior field. Used for aortic dissection, aneurysm, and atheroma assessment.",
    howToGet: [
      "From ME 4-Chamber (0°), rotate counterclockwise",
      "The descending aorta will appear as a circular structure in the near left field",
      "Maintain multiplane angle at 0–10°",
      "Apply neutral flexion",
      "Withdraw slowly from the stomach to the upper esophagus to trace the full descending aorta",
    ],
    structures: [
      "Descending thoracic aorta (cross-section)", "Aortic wall layers",
      "Periaortic tissue",
    ],
    doppler: [
      { label: "Aorta Color Doppler", detail: "Detect false lumen flow in dissection. Holodiastolic flow reversal = severe AR" },
      { label: "Aorta PW Doppler", detail: "Holodiastolic flow reversal in descending aorta = severe AR" },
    ],
    tips: [
      "Atheroma grading (Katz classification): Grade I (normal) to Grade V (mobile plaque ≥4 mm)",
      "Type B dissection: intimal flap in descending aorta without involvement of ascending aorta",
      "Withdraw from stomach to upper esophagus to survey the entire descending aorta",
    ],
    pitfalls: [
      "A normal aortic fold can mimic a dissection flap — confirm with colour Doppler",
      "The left pleural effusion can be confused with the aorta — look for the circular shape",
    ],
    measurements: ["Descending aorta diameter (at multiple levels)", "Atheroma grade", "Intimal flap thickness"],
    criticalFindings: ["Type B aortic dissection", "Descending aortic aneurysm (>5.5 cm)", "Mobile atheroma (embolic risk)", "Holodiastolic flow reversal (severe AR)"],
  },

  // ── VIEW 26: Descending Aorta LAX ────────────────────────────────────────
  {
    id: "desc_ao_lax",
    aseNumber: "26",
    group: "Aorta",
    groupColor: AO_COLOR,
    name: "Descending Aorta LAX",
    angle: "90–110°",
    depth: "30–35 cm",
    flexion: "Neutral flexion",
    patientPosition: "Supine; bite block in place",
    description: "Obtained from the same position as the Descending Aorta SAX by rotating the multiplane angle to 90–110°. Provides a long-axis view of the descending thoracic aorta — better for measuring aortic diameter and characterising dissection flaps.",
    howToGet: [
      "From Descending Aorta SAX, rotate multiplane angle to 90–110°",
      "The aorta will appear as a long tubular structure",
      "Maintain neutral flexion and counterclockwise rotation",
      "Withdraw slowly to trace the full length of the descending aorta",
    ],
    structures: [
      "Descending thoracic aorta (long axis)", "Aortic wall (intima, media, adventitia)",
      "Periaortic tissue",
    ],
    doppler: [
      { label: "Aorta Color Doppler", detail: "True vs false lumen flow in dissection" },
      { label: "Aorta PW Doppler", detail: "Holodiastolic flow reversal = severe AR" },
    ],
    tips: [
      "The long-axis view is better for measuring aortic diameter than the SAX view",
      "A dissection flap is seen as a linear echogenic structure within the aortic lumen",
      "Withdraw from mid-esophagus to upper esophagus to trace the full descending aorta",
    ],
    pitfalls: [
      "Reverberation artefacts from the aortic wall can mimic a dissection flap",
    ],
    measurements: ["Descending aorta diameter", "Atheroma grade", "Dissection flap extent"],
    criticalFindings: ["Type B aortic dissection", "Descending aortic aneurysm", "Penetrating aortic ulcer"],
  },

  // ── VIEW 27: UE Aortic Arch LAX ──────────────────────────────────────────
  {
    id: "ueaorticarch",
    aseNumber: "27",
    group: "Upper Esophageal",
    groupColor: UE_COLOR,
    name: "UE Aortic Arch LAX",
    angle: "0–10°",
    depth: "20–25 cm",
    flexion: "Neutral; withdraw to upper esophagus",
    patientPosition: "Supine; bite block in place",
    description: "Obtained by withdrawing the probe to the upper esophagus (~20–25 cm) with the angle at 0–10°. Provides a long-axis view of the aortic arch — important for arch aneurysm, atheroma, and coarctation assessment.",
    howToGet: [
      "From Descending Aorta views, withdraw probe to upper esophagus (~20–25 cm)",
      "Set multiplane angle to 0–10°",
      "The aortic arch should appear as a curved structure",
      "Adjust withdrawal to see the full arch from the ascending to descending aorta",
      "The left subclavian, left common carotid, and innominate arteries may be visible",
    ],
    structures: [
      "Aortic arch", "Left subclavian artery", "Left common carotid artery",
      "Innominate artery", "Proximal descending aorta",
    ],
    doppler: [
      { label: "Arch Color Doppler", detail: "Detect arch dissection or atheroma with mobile components" },
    ],
    tips: [
      "The left subclavian artery is the last branch before the descending aorta — a useful landmark",
      "Coarctation: narrowing at the isthmus (just distal to the left subclavian artery)",
      "Mobile arch atheroma (Grade V) carries the highest embolic risk",
    ],
    pitfalls: [
      "The trachea creates a blind spot in the distal ascending aorta — the arch is usually visible",
      "The arch branches can be difficult to identify — withdraw slowly",
    ],
    measurements: ["Aortic arch diameter", "Atheroma grade", "Coarctation gradient (if applicable)"],
    criticalFindings: ["Arch aneurysm", "Arch dissection", "Mobile atheroma (Grade IV–V)", "Coarctation of the aorta"],
  },

  // ── VIEW 28: UE Aortic Arch SAX ──────────────────────────────────────────
  {
    id: "ue_arch_sax",
    aseNumber: "28",
    group: "Upper Esophageal",
    groupColor: UE_COLOR,
    name: "UE Aortic Arch SAX",
    angle: "70–90°",
    depth: "20–25 cm",
    flexion: "Neutral",
    patientPosition: "Supine; bite block in place",
    description: "The final view of the ASE 28-view protocol. Obtained from the upper esophagus by rotating the multiplane angle to 70–90°. Provides a short-axis cross-section of the aortic arch and the main pulmonary artery — the best view for pulmonary artery assessment and arch SAX diameter measurement.",
    howToGet: [
      "From UE Aortic Arch LAX, rotate multiplane angle to 70–90°",
      "The aortic arch will appear as a circular structure",
      "The main pulmonary artery and its bifurcation should be visible anterior to the arch",
      "The left pulmonary artery can be seen to the left",
    ],
    structures: [
      "Aortic arch (cross-section)", "Main pulmonary artery",
      "Left pulmonary artery", "Right pulmonary artery (partially)",
      "Left subclavian artery (partially)",
    ],
    doppler: [
      { label: "PA Color Doppler", detail: "Pulmonary artery flow — detect pulmonary embolism or PR" },
      { label: "Arch Color Doppler", detail: "Arch dissection or atheroma assessment" },
    ],
    tips: [
      "The main pulmonary artery is anterior to the aortic arch in this view",
      "This view completes the aortic survey — always perform after the descending aorta views",
      "The pulmonary artery bifurcation is well seen here — assess for central PE",
    ],
    pitfalls: [
      "The PA and arch can be confused — the PA is anterior and has a lower-pressure waveform",
    ],
    measurements: ["Aortic arch diameter (SAX)", "Main PA diameter", "Arch atheroma grade"],
    criticalFindings: ["Arch aneurysm", "Central pulmonary embolism", "Arch dissection"],
  },
];

// ─── GROUP DEFINITIONS (ASE order) ───────────────────────────────────────────
export const TEE_GROUPS = [
  { key: "Overview",        color: OV_COLOR, label: "Overview",              count: 1  },
  { key: "Mid-Esophageal",  color: ME_COLOR, label: "Mid-Esophageal (ME)",   count: 14 },
  { key: "Transgastric",    color: TG_COLOR, label: "Transgastric (TG)",     count: 9  },
  { key: "Upper Esophageal",color: UE_COLOR, label: "Upper Esophageal (UE)", count: 4  },
  { key: "Aorta",           color: AO_COLOR, label: "Aorta",                 count: 2  },
];
