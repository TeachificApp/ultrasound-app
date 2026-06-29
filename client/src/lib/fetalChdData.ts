/*
  Fetal Echo — Congenital Heart Defects (CHD) ScanCoach Data
  © All About Ultrasound, Inc. / iHeartEcho™
  Each entry represents one CHD "view" in the CHD tab.
  Images are admin-uploaded with custom labels (no clinical/reference distinction).
*/

export interface ChdImageSlot {
  /** DB key used to store this image URL in scanCoachChdImages table */
  slotKey: string;
  /** Default label shown until admin overrides it */
  defaultLabel: string;
}

export interface ChdView {
  id: string;
  name: string;
  abbr: string;
  category: "Septal Defects" | "Outflow Tract" | "Valve Anomalies" | "Great Vessel" | "Complex / Conotruncal" | "Situs / Heterotaxy";
  prevalence: string;          // e.g. "1 in 500 live births"
  description: string;
  keyFindings2D: string[];
  colorDoppler: string[];
  spectralDoppler: string[];
  fetalEchoViews: string[];    // which standard views best show this CHD
  pitfalls: string[];
  associatedAnomalies: string[];
  prognosis: string;
  imageSlots: ChdImageSlot[];  // up to 6 admin-uploadable images per CHD
}

export const FETAL_CHD_VIEWS: ChdView[] = [
  // ─── SEPTAL DEFECTS ──────────────────────────────────────────────────────────
  {
    id: "chd_vsd",
    name: "Ventricular Septal Defect",
    abbr: "VSD",
    category: "Septal Defects",
    prevalence: "Most common CHD — ~2–3 per 1,000 live births",
    description: "A defect in the interventricular septum allowing communication between the ventricles. Fetal VSDs are frequently perimembranous (80%) or muscular. Small muscular VSDs often close spontaneously. Large defects cause significant left-to-right shunting postnatally.",
    keyFindings2D: [
      "Dropout or frank defect in the interventricular septum",
      "Perimembranous: defect just below the aortic valve in the membranous septum",
      "Muscular: defect within the trabecular septum — may be multiple ('Swiss cheese')",
      "Inlet VSD: near the AV valves — associated with AVSD",
      "Outlet (supracristal/doubly committed): just below the pulmonary valve",
      "Ventricular sizes typically equal in fetus (shunting is postnatal)",
    ],
    colorDoppler: [
      "Turbulent bidirectional flow across the defect in fetus (equal ventricular pressures)",
      "Color Doppler essential — small muscular VSDs invisible on 2D alone",
      "Perimembranous VSD: flow jet in LVOT/5CV view",
      "Muscular VSD: multiple small color jets in apical 4CV",
      "Absence of color flow does not exclude VSD — check multiple planes",
    ],
    spectralDoppler: [
      "PW/CW across defect: low-velocity bidirectional flow in fetus",
      "High-velocity unidirectional flow postnatally indicates restrictive VSD",
      "Absent flow may indicate equalization of pressures (large non-restrictive VSD)",
    ],
    fetalEchoViews: [
      "4-Chamber View (4CV) — best for inlet and muscular VSDs",
      "5-Chamber / LVOT View — best for perimembranous and outlet VSDs",
      "Short-axis views — confirm location relative to AV valves and great vessels",
    ],
    pitfalls: [
      "False-positive: apical 4CV angle causes apparent septal dropout — confirm in multiple planes",
      "Small muscular VSDs easily missed without color Doppler",
      "Perimembranous VSD may be overridden by aorta — exclude TOF",
      "Inlet VSD: always assess AV valve morphology to exclude AVSD",
    ],
    associatedAnomalies: [
      "Trisomy 21 (inlet VSD / AVSD)", "Trisomy 18 (multiple VSDs)", "Trisomy 13",
      "Tetralogy of Fallot (outlet VSD with aortic override)",
      "DORV", "Transposition of great arteries",
    ],
    prognosis: "Isolated small-moderate VSDs: excellent. Large VSDs require postnatal surgical or catheter-based repair. Prognosis depends on size, location, and associated anomalies.",
    imageSlots: [
      { slotKey: "vsd_4cv_2d", defaultLabel: "4CV — Septal Defect 2D" },
      { slotKey: "vsd_4cv_color", defaultLabel: "4CV — Color Doppler Flow" },
      { slotKey: "vsd_lvot_2d", defaultLabel: "LVOT View — Perimembranous VSD" },
      { slotKey: "vsd_lvot_color", defaultLabel: "LVOT — Color Doppler" },
      { slotKey: "vsd_sax_color", defaultLabel: "Short Axis — Color Doppler" },
      { slotKey: "vsd_spectral", defaultLabel: "Spectral Doppler — VSD Jet" },
    ],
  },
  {
    id: "chd_asd",
    name: "Atrial Septal Defect",
    abbr: "ASD",
    category: "Septal Defects",
    prevalence: "~1 in 1,500 live births (excluding PFO)",
    description: "A defect in the interatrial septum. In the fetus the foramen ovale is a normal structure; true secundum ASD is diagnosed when the foramen ovale flap is absent or the defect is excessively large. Primum ASD is part of the AVSD spectrum. Sinus venosus ASD is rare prenatally.",
    keyFindings2D: [
      "Secundum ASD: absent or hypermobile foramen ovale flap; large interatrial communication",
      "Primum ASD: defect in the lower atrial septum adjacent to the AV valves — part of AVSD spectrum",
      "Sinus venosus ASD: defect near SVC/IVC junction — difficult to visualize prenatally",
      "Foramen ovale flap should be visible in LA in normal fetus",
      "Atrial sizes typically equal in fetus",
    ],
    colorDoppler: [
      "Right-to-left flow across foramen ovale is NORMAL in fetus",
      "Secundum ASD: large unrestricted color flow across interatrial septum",
      "Primum ASD: color flow in lower atrial septum + assess for AV valve regurgitation",
      "Bidirectional flow across a large ASD may be seen",
    ],
    spectralDoppler: [
      "PW at foramen ovale: normal right-to-left flow pattern",
      "Turbulent or bidirectional flow suggests true ASD",
      "Assess for associated MV/TV regurgitation in primum ASD",
    ],
    fetalEchoViews: [
      "4-Chamber View — best for primum ASD and foramen ovale assessment",
      "Bicaval view — sinus venosus ASD near SVC",
      "Short-axis — confirms ASD location",
    ],
    pitfalls: [
      "Normal foramen ovale can appear as a large ASD — confirm flap mobility",
      "Primum ASD: always assess AV valve morphology for AVSD",
      "Isolated secundum ASD often not hemodynamically significant in fetus",
      "Sinus venosus ASD almost always missed prenatally",
    ],
    associatedAnomalies: [
      "Trisomy 21 (primum ASD / AVSD)", "Holt-Oram syndrome (secundum ASD)",
      "AVSD", "Partial anomalous pulmonary venous return (sinus venosus)",
    ],
    prognosis: "Isolated secundum ASD: excellent — many close spontaneously or are repaired by catheter in childhood. Primum ASD requires surgical repair.",
    imageSlots: [
      { slotKey: "asd_4cv_2d", defaultLabel: "4CV — Atrial Septum 2D" },
      { slotKey: "asd_4cv_color", defaultLabel: "4CV — Color Doppler" },
      { slotKey: "asd_primum_2d", defaultLabel: "Primum ASD — 2D" },
      { slotKey: "asd_primum_color", defaultLabel: "Primum ASD — Color Doppler" },
    ],
  },
  {
    id: "chd_avsd",
    name: "Atrioventricular Septal Defect",
    abbr: "AVSD",
    category: "Septal Defects",
    prevalence: "~1 in 2,000 live births; 40% associated with Trisomy 21",
    description: "Complete AVSD (CAVC) involves a primum ASD, inlet VSD, and a common AV valve. Partial AVSD has a primum ASD with two separate AV valve orifices. The hallmark is loss of the normal AV valve offset (crux of the heart) and a common AV valve.",
    keyFindings2D: [
      "Loss of normal AV valve offset — both AV valves at same level (crux sign absent)",
      "Common AV valve with 5 or 6 leaflets (complete AVSD)",
      "Primum ASD: defect in lower atrial septum",
      "Inlet VSD: defect in inlet portion of IVS",
      "Balanced vs. unbalanced AVSD: assess ventricular dominance",
      "Unbalanced AVSD: one ventricle hypoplastic — associated with heterotaxy",
    ],
    colorDoppler: [
      "Common AV valve regurgitation: central or eccentric jet — assess severity",
      "Color flow across primum ASD and inlet VSD",
      "Unbalanced AVSD: assess dominance and outflow tract patency",
      "Color Doppler essential to assess AV valve competence",
    ],
    spectralDoppler: [
      "PW/CW at common AV valve: assess regurgitation severity",
      "Regurgitant jet velocity reflects fetal ventricular pressure",
      "Assess for hydrops if severe AV valve regurgitation",
    ],
    fetalEchoViews: [
      "4-Chamber View — primary view; shows loss of crux and common AV valve",
      "LVOT View — assess for subaortic stenosis (common in AVSD)",
      "Short-axis — confirm AV valve morphology",
    ],
    pitfalls: [
      "Partial AVSD: AV valves appear separate — look carefully for primum ASD",
      "Unbalanced AVSD: may be mistaken for single ventricle",
      "Subaortic stenosis in AVSD: always assess LVOT",
      "Heterotaxy strongly associated with unbalanced AVSD",
    ],
    associatedAnomalies: [
      "Trisomy 21 (most common)", "Heterotaxy / situs ambiguus",
      "Tetralogy of Fallot", "Double outlet right ventricle",
      "Coarctation of aorta",
    ],
    prognosis: "Complete AVSD requires surgical repair (patch closure) in infancy. Prognosis depends on ventricular balance, AV valve competence, and associated anomalies. Trisomy 21 cases have excellent surgical outcomes.",
    imageSlots: [
      { slotKey: "avsd_4cv_2d", defaultLabel: "4CV — Common AV Valve 2D" },
      { slotKey: "avsd_4cv_color", defaultLabel: "4CV — AV Valve Regurgitation" },
      { slotKey: "avsd_lvot_2d", defaultLabel: "LVOT — Subaortic Assessment" },
      { slotKey: "avsd_spectral", defaultLabel: "Spectral — AV Valve Regurgitation" },
      { slotKey: "avsd_unbalanced", defaultLabel: "Unbalanced AVSD — Ventricular Sizes" },
    ],
  },

  // ─── OUTFLOW TRACT ANOMALIES ─────────────────────────────────────────────────
  {
    id: "chd_tof",
    name: "Tetralogy of Fallot",
    abbr: "TOF",
    category: "Outflow Tract",
    prevalence: "~1 in 2,500 live births; most common cyanotic CHD",
    description: "Classic tetrad: (1) large malalignment VSD, (2) overriding aorta (>50% over RV), (3) pulmonary stenosis/atresia, (4) RV hypertrophy (postnatal). In fetus: RV hypertrophy is absent. Key features are aortic override and pulmonary outflow obstruction.",
    keyFindings2D: [
      "Large perimembranous/outlet VSD with anterior malalignment of the outlet septum",
      "Aorta overrides the VSD — measure % override (>50% = DORV territory)",
      "Pulmonary artery smaller than aorta (normally PA ≥ Ao in fetus)",
      "RVOT narrowing — assess for pulmonary stenosis vs. atresia",
      "3VT view: PA smaller than Ao, may be absent in TOF/PA",
      "Aortic arch: right aortic arch in ~25% of TOF cases",
    ],
    colorDoppler: [
      "LVOT/5CV: aorta overrides VSD — color flow from both ventricles into aorta",
      "RVOT: turbulent or absent flow in pulmonary stenosis/atresia",
      "3VT view: absent or reversed ductal flow in TOF/PA",
      "Color Doppler essential to assess degree of pulmonary outflow obstruction",
    ],
    spectralDoppler: [
      "PW at RVOT/pulmonary valve: assess gradient and flow direction",
      "Reversed ductal flow (right-to-left) indicates severe pulmonary obstruction",
      "PW at VSD: bidirectional flow confirms large non-restrictive defect",
    ],
    fetalEchoViews: [
      "LVOT / 5-Chamber View — aortic override and VSD",
      "3-Vessel Trachea (3VT) View — PA/Ao size discrepancy and ductal flow",
      "RVOT View — pulmonary valve and main PA assessment",
      "Aortic Arch View — right arch in 25%",
    ],
    pitfalls: [
      "Mild TOF may appear as normal 4CV — always assess outflow tracts",
      "TOF vs. DORV: aortic override >50% suggests DORV — requires careful measurement",
      "TOF with pulmonary atresia: absent PA on color Doppler in RVOT",
      "Absent pulmonary valve syndrome (TOF/APV): dilated PA with regurgitation",
      "Right aortic arch: associated with 22q11 deletion (DiGeorge) — genetic counseling",
    ],
    associatedAnomalies: [
      "22q11.2 deletion (DiGeorge syndrome) — 15–20%",
      "Trisomy 21", "VACTERL association",
      "Right aortic arch", "Coronary artery anomalies",
    ],
    prognosis: "Excellent with surgical repair (complete repair in infancy). TOF/PA requires staged palliation. 22q11 deletion affects neurodevelopmental outcomes.",
    imageSlots: [
      { slotKey: "tof_lvot_2d", defaultLabel: "LVOT — Aortic Override 2D" },
      { slotKey: "tof_lvot_color", defaultLabel: "LVOT — Color Doppler Override" },
      { slotKey: "tof_3vt_2d", defaultLabel: "3VT — PA/Ao Size Comparison" },
      { slotKey: "tof_rvot_color", defaultLabel: "RVOT — Pulmonary Flow Color" },
      { slotKey: "tof_arch_2d", defaultLabel: "Aortic Arch — Right Arch" },
      { slotKey: "tof_spectral", defaultLabel: "Spectral — RVOT/Ductal Flow" },
    ],
  },
  {
    id: "chd_ps",
    name: "Pulmonary Stenosis / Atresia",
    abbr: "PS/PA",
    category: "Outflow Tract",
    prevalence: "PS: ~1 in 1,500; PA with intact IVS: ~1 in 10,000",
    description: "Pulmonary stenosis (PS) ranges from mild valvar stenosis to critical PS with RV hypoplasia. Pulmonary atresia with intact ventricular septum (PA/IVS) is a severe form with absent pulmonary valve opening, RV hypoplasia, and coronary sinusoids. Pulmonary atresia with VSD is part of the TOF spectrum.",
    keyFindings2D: [
      "Pulmonary valve: thickened, doming, or absent leaflets",
      "Main PA: post-stenotic dilation in moderate PS; hypoplastic in critical PS/PA",
      "RV size: normal in mild PS; hypoplastic in critical PS and PA/IVS",
      "Tricuspid valve: hypoplastic in PA/IVS (assess annulus Z-score)",
      "PA/IVS: absent pulmonary valve motion, RV hypertrophy/hypoplasia",
      "3VT view: small or absent PA",
    ],
    colorDoppler: [
      "Turbulent flow at pulmonary valve in PS",
      "Absent antegrade flow in PA/IVS — retrograde ductal flow fills PA",
      "Tricuspid regurgitation: common in PA/IVS — assess severity",
      "Coronary sinusoids: abnormal flow in RV myocardium in PA/IVS",
    ],
    spectralDoppler: [
      "PW/CW at pulmonary valve: assess peak velocity and gradient",
      "Reversed ductal flow (retrograde) = severe PS or PA",
      "TR velocity reflects RV pressure — elevated in PS",
      "PW at ductus: retrograde flow confirms PA",
    ],
    fetalEchoViews: [
      "RVOT View — pulmonary valve morphology and PA size",
      "3-Vessels Trachea (3VT) View — PA/Ao ratio and ductal flow direction",
      "4-Chamber View — RV and TV size assessment",
      "Ductal Arch View — retrograde ductal flow",
    ],
    pitfalls: [
      "Mild PS may be missed on 2D — always use color Doppler at RVOT",
      "PA/IVS vs. Ebstein anomaly: both have RV dilation and TR — assess pulmonary valve",
      "Coronary sinusoids in PA/IVS: RV-dependent coronary circulation — critical for management",
      "PA with VSD (TOF/PA): assess for VSD and aortic override",
    ],
    associatedAnomalies: [
      "Noonan syndrome (dysplastic pulmonary valve)", "Trisomy 21",
      "Williams syndrome (supravalvar PS)", "PA/IVS: isolated or with heterotaxy",
    ],
    prognosis: "Mild PS: excellent, may not require intervention. Critical PS/PA: requires urgent postnatal balloon valvuloplasty or surgical repair. PA/IVS with RV-dependent coronary circulation: high-risk, may require cardiac transplantation.",
    imageSlots: [
      { slotKey: "ps_rvot_2d", defaultLabel: "RVOT — Pulmonary Valve 2D" },
      { slotKey: "ps_rvot_color", defaultLabel: "RVOT — Color Doppler" },
      { slotKey: "ps_3vt_2d", defaultLabel: "3VT — PA Size" },
      { slotKey: "ps_spectral", defaultLabel: "Spectral — PV Velocity / TR" },
      { slotKey: "ps_4cv_rv", defaultLabel: "4CV — RV Hypoplasia" },
    ],
  },
  {
    id: "chd_as",
    name: "Aortic Stenosis / Critical AS",
    abbr: "AS",
    category: "Outflow Tract",
    prevalence: "~1 in 5,000 live births; critical AS with HLHS evolution ~1 in 10,000",
    description: "Fetal aortic stenosis ranges from mild valvar stenosis to critical AS with evolving HLHS. Critical AS causes LV pressure overload, endocardial fibroelastosis (EFE), and progressive LV dysfunction. Early fetal intervention (balloon valvuloplasty) may prevent HLHS evolution.",
    keyFindings2D: [
      "Aortic valve: thickened, doming, echogenic leaflets",
      "LV: dilated and dysfunctional in critical AS (EFE — bright endocardium)",
      "Ascending aorta: post-stenotic dilation in moderate AS",
      "Mitral valve: may be hypoplastic in evolving HLHS",
      "Endocardial fibroelastosis (EFE): bright echogenic endocardium — marker of LV damage",
      "Ventricular disproportion: LV > RV in early AS; LV < RV in evolving HLHS",
    ],
    colorDoppler: [
      "Turbulent flow at aortic valve in AS",
      "Retrograde flow in transverse aortic arch (retrograde isthmal flow) = critical AS",
      "Mitral regurgitation: common in LV dysfunction",
      "EFE: LV endocardium bright — confirm with color Doppler showing MR",
    ],
    spectralDoppler: [
      "PW/CW at aortic valve: assess peak velocity (>1.5 m/s abnormal in fetus)",
      "Retrograde ductal flow or retrograde arch flow = critical AS",
      "MR velocity reflects LV-LA pressure gradient",
      "Assess LV function: myocardial performance index (MPI/Tei index)",
    ],
    fetalEchoViews: [
      "LVOT / 5-Chamber View — aortic valve morphology",
      "Aortic Arch View — retrograde isthmal flow",
      "4-Chamber View — LV size, EFE, MV assessment",
      "3VT View — aorta/PA ratio",
    ],
    pitfalls: [
      "Mild AS may be missed — always assess aortic valve morphology in LVOT view",
      "EFE is a marker of severe LV damage — urgent referral to fetal cardiac center",
      "Evolving HLHS: serial monitoring essential — LV may progressively shrink",
      "Bicuspid aortic valve: may not be stenotic in fetus but warrants postnatal follow-up",
    ],
    associatedAnomalies: [
      "Turner syndrome (bicuspid AV + CoA)", "Williams syndrome (supravalvar AS)",
      "HLHS evolution", "Coarctation of aorta",
    ],
    prognosis: "Mild AS: excellent. Critical AS with EFE: poor without intervention. Fetal balloon aortic valvuloplasty at specialized centers may prevent HLHS evolution in selected cases.",
    imageSlots: [
      { slotKey: "as_lvot_2d", defaultLabel: "LVOT — Aortic Valve 2D" },
      { slotKey: "as_lvot_color", defaultLabel: "LVOT — Turbulent Flow Color" },
      { slotKey: "as_4cv_efe", defaultLabel: "4CV — EFE / LV Dilation" },
      { slotKey: "as_arch_color", defaultLabel: "Arch — Retrograde Flow Color" },
      { slotKey: "as_spectral", defaultLabel: "Spectral — AV Velocity / MR" },
    ],
  },

  // ─── VALVE ANOMALIES ─────────────────────────────────────────────────────────
  {
    id: "chd_ebstein",
    name: "Ebstein Anomaly",
    abbr: "Ebstein",
    category: "Valve Anomalies",
    prevalence: "~1 in 20,000 live births",
    description: "Apical displacement of the septal and posterior tricuspid valve leaflets into the RV, creating an 'atrialized' RV. Severity ranges from mild (good prognosis) to severe (massive cardiomegaly, hydrops, fetal demise). Associated with maternal lithium use.",
    keyFindings2D: [
      "Apical displacement of tricuspid valve septal leaflet ≥8 mm/m² (or >20 mm in fetus)",
      "Atrialized RV: portion of RV incorporated into enlarged RA",
      "Massively dilated RA — may fill most of the thorax",
      "Cardiomegaly: cardiothoracic ratio >0.5 (normal <0.35)",
      "Anterior TV leaflet: large, sail-like, may obstruct RVOT",
      "RV: small functional RV; pulmonary valve may be stenotic or atretic",
    ],
    colorDoppler: [
      "Severe tricuspid regurgitation: large mosaic jet filling RA",
      "TR onset: displaced TV — regurgitation begins within RV (not at AV groove)",
      "Pulmonary flow: assess for PS or PA (functional PA from RVOT obstruction)",
      "Assess for ASD/PFO with right-to-left shunting",
    ],
    spectralDoppler: [
      "CW at tricuspid valve: TR velocity reflects RV pressure",
      "Low TR velocity in severe Ebstein (low RV pressure due to large atrialized RV)",
      "Assess pulmonary valve flow: absent or reversed = functional PA",
    ],
    fetalEchoViews: [
      "4-Chamber View — primary view; apical TV displacement and RA enlargement",
      "RVOT View — pulmonary valve and RVOT assessment",
      "Apical 4CV — measure TV displacement (mm from MV annulus)",
    ],
    pitfalls: [
      "Mild Ebstein may be subtle — measure TV offset carefully",
      "Functional pulmonary atresia: absent pulmonary flow despite patent valve — check carefully",
      "Severe Ebstein with hydrops: extremely poor prognosis — counsel carefully",
      "Distinguish from tricuspid dysplasia (no apical displacement)",
    ],
    associatedAnomalies: [
      "Maternal lithium use", "Wolff-Parkinson-White syndrome (postnatal)",
      "ASD/PFO", "Pulmonary atresia (functional)",
    ],
    prognosis: "Wide spectrum. Mild: excellent postnatal outcome. Severe with cardiomegaly and hydrops: very poor prognosis. Fetal hydrops carries >80% mortality.",
    imageSlots: [
      { slotKey: "ebstein_4cv_2d", defaultLabel: "4CV — TV Displacement 2D" },
      { slotKey: "ebstein_4cv_color", defaultLabel: "4CV — TR Color Doppler" },
      { slotKey: "ebstein_rvot_2d", defaultLabel: "RVOT — Pulmonary Flow" },
      { slotKey: "ebstein_spectral", defaultLabel: "Spectral — TR Velocity" },
    ],
  },
  {
    id: "chd_tricuspid_atresia",
    name: "Tricuspid Atresia",
    abbr: "TA",
    category: "Valve Anomalies",
    prevalence: "~1 in 10,000 live births",
    description: "Absent tricuspid valve with no direct communication between RA and RV. Blood flows from RA to LA via ASD (obligatory), then to LV. RV is hypoplastic. Classification based on great vessel relationship (normally related, TGA, or DORV) and pulmonary blood flow.",
    keyFindings2D: [
      "Absent tricuspid valve — no AV valve on right side",
      "Echogenic/muscular tissue at expected TV position",
      "RV hypoplasia — small, non-apex-forming RV",
      "LV dominant — enlarged, apex-forming",
      "Obligatory ASD (primum or secundum) for RA decompression",
      "VSD may be present (determines pulmonary blood flow)",
    ],
    colorDoppler: [
      "No flow across right AV valve position",
      "Right-to-left flow at ASD (obligatory)",
      "Assess pulmonary blood flow: antegrade (VSD present) vs. retrograde ductal (PA/severe PS)",
      "Color Doppler at RVOT: assess pulmonary flow direction and velocity",
    ],
    spectralDoppler: [
      "No TV inflow signal",
      "PW at ASD: right-to-left flow",
      "PW at RVOT/ductus: assess pulmonary blood flow adequacy",
    ],
    fetalEchoViews: [
      "4-Chamber View — absent TV, RV hypoplasia, LV dominance",
      "RVOT View — pulmonary blood flow assessment",
      "3VT View — great vessel relationship",
    ],
    pitfalls: [
      "Distinguish from severe Ebstein (TV present but displaced)",
      "Distinguish from HLHS (left-sided hypoplasia)",
      "VSD size determines pulmonary blood flow — assess carefully",
      "TGA with TA: great vessels transposed — assess separately",
    ],
    associatedAnomalies: [
      "TGA (30% of TA cases)", "VSD", "ASD (obligatory)",
      "Pulmonary stenosis/atresia", "Coarctation of aorta",
    ],
    prognosis: "Requires staged palliation (Norwood/Glenn/Fontan pathway). Single ventricle physiology. Long-term outcomes improving with modern surgical techniques.",
    imageSlots: [
      { slotKey: "ta_4cv_2d", defaultLabel: "4CV — Absent TV / RV Hypoplasia" },
      { slotKey: "ta_4cv_color", defaultLabel: "4CV — No TV Flow / ASD Flow" },
      { slotKey: "ta_rvot_color", defaultLabel: "RVOT — Pulmonary Flow" },
      { slotKey: "ta_spectral", defaultLabel: "Spectral — ASD / Ductal Flow" },
    ],
  },

  // ─── GREAT VESSEL ANOMALIES ──────────────────────────────────────────────────
  {
    id: "chd_tga",
    name: "Transposition of the Great Arteries",
    abbr: "TGA / d-TGA",
    category: "Great Vessel",
    prevalence: "~1 in 3,500 live births; most common cyanotic CHD presenting in neonates",
    description: "The aorta arises from the RV (anterior, rightward) and the pulmonary artery from the LV (posterior, leftward) — ventriculoarterial discordance. The 4CV is normal. Diagnosis requires outflow tract assessment. Complete TGA (d-TGA) is a neonatal emergency.",
    keyFindings2D: [
      "4-Chamber View: NORMAL — diagnosis requires outflow tract views",
      "LVOT view: posterior vessel (PA) arises from LV — parallel course of great vessels",
      "RVOT view: anterior vessel (Ao) arises from RV",
      "Great vessels run PARALLEL (not crossing) — key diagnostic feature",
      "3VT view: aorta anterior and rightward of PA (reversed normal relationship)",
      "Intact IVS (simple TGA) or VSD (complex TGA)",
    ],
    colorDoppler: [
      "Color Doppler confirms parallel great vessel course",
      "LVOT: pulmonary artery arises from LV — confirm bifurcation",
      "RVOT: aorta arises from RV — confirm arch and head vessels",
      "Assess for associated VSD with color Doppler",
    ],
    spectralDoppler: [
      "PW at both outflow tracts: normal velocities in simple TGA",
      "Assess for LVOT/RVOT obstruction (subpulmonary stenosis)",
      "Ductal flow: assess direction and velocity",
    ],
    fetalEchoViews: [
      "LVOT / 5-Chamber View — posterior vessel from LV (PA)",
      "RVOT View — anterior vessel from RV (Ao)",
      "3-Vessels Trachea (3VT) View — parallel great vessels, reversed positions",
      "Aortic Arch View — confirm arch sidedness",
    ],
    pitfalls: [
      "MOST COMMONLY MISSED CHD on fetal echo — 4CV is normal",
      "Always assess outflow tracts in every fetal echo",
      "Parallel great vessels vs. normal crossing — key diagnostic feature",
      "Distinguish from DORV: both great vessels arise from RV in DORV",
      "Congenitally corrected TGA (cc-TGA): AV and VA discordance — different prognosis",
    ],
    associatedAnomalies: [
      "VSD (40%)", "Pulmonary stenosis (subvalvar) (30%)",
      "Coronary artery anomalies (critical for arterial switch surgery)",
    ],
    prognosis: "Excellent with arterial switch operation (Jatene procedure) in first 2 weeks of life. Neonatal prostaglandin E1 required to maintain ductal patency. Coronary anatomy critical for surgical planning.",
    imageSlots: [
      { slotKey: "tga_lvot_2d", defaultLabel: "LVOT — PA from LV (Parallel Vessels)" },
      { slotKey: "tga_rvot_2d", defaultLabel: "RVOT — Ao from RV" },
      { slotKey: "tga_3vt_2d", defaultLabel: "3VT — Reversed Great Vessel Positions" },
      { slotKey: "tga_color", defaultLabel: "Color Doppler — Parallel Vessels" },
      { slotKey: "tga_4cv_2d", defaultLabel: "4CV — Normal (TGA Pitfall)" },
    ],
  },
  {
    id: "chd_coa",
    name: "Coarctation of the Aorta",
    abbr: "CoA",
    category: "Great Vessel",
    prevalence: "~1 in 2,500 live births; often missed prenatally",
    description: "Narrowing of the aortic isthmus (between left subclavian artery and ductus arteriosus). Fetal diagnosis is challenging — the ductus masks the coarctation in utero. Key markers are ventricular disproportion (RV > LV), isthmus hypoplasia, and retrograde isthmal flow.",
    keyFindings2D: [
      "Ventricular disproportion: RV > LV (most sensitive fetal marker)",
      "Aortic isthmus hypoplasia: measure isthmus Z-score (<−2 suspicious)",
      "Transverse arch hypoplasia: measure each segment",
      "Ascending aorta may be smaller than pulmonary artery",
      "Bicuspid aortic valve: associated in 50–85% of CoA",
      "4CV: RV dominance — right heart larger than left",
    ],
    colorDoppler: [
      "Retrograde flow in aortic isthmus on color Doppler = significant CoA",
      "Color Doppler at isthmus: normally antegrade; retrograde = severe CoA",
      "Assess for associated VSD, ASD, bicuspid AV",
      "Ductal flow: assess direction and velocity",
    ],
    spectralDoppler: [
      "PW at aortic isthmus: retrograde diastolic flow = significant CoA",
      "Isthmus pulsatility index: elevated in CoA",
      "PW at ductus arteriosus: assess flow direction",
      "Assess for aortic valve stenosis if bicuspid AV present",
    ],
    fetalEchoViews: [
      "4-Chamber View — ventricular disproportion (RV > LV)",
      "Aortic Arch View — isthmus measurement and flow direction",
      "3VT View — aorta/PA ratio",
      "LVOT View — bicuspid aortic valve assessment",
    ],
    pitfalls: [
      "Most commonly missed CHD — subtle findings in fetus",
      "Ductus masks coarctation in utero — may only manifest postnatally",
      "Ventricular disproportion: RV > LV is the most sensitive marker",
      "Serial monitoring recommended if CoA suspected — may progress",
      "Interrupted aortic arch: complete discontinuity — more severe than CoA",
    ],
    associatedAnomalies: [
      "Turner syndrome (45,X)", "Bicuspid aortic valve (50–85%)",
      "VSD", "Aortic stenosis", "Interrupted aortic arch",
    ],
    prognosis: "Excellent with surgical repair (end-to-end anastomosis or subclavian flap) in neonatal period. Risk of recoarctation and hypertension in long-term follow-up.",
    imageSlots: [
      { slotKey: "coa_4cv_2d", defaultLabel: "4CV — Ventricular Disproportion" },
      { slotKey: "coa_arch_2d", defaultLabel: "Aortic Arch — Isthmus Hypoplasia" },
      { slotKey: "coa_arch_color", defaultLabel: "Arch — Retrograde Isthmal Flow" },
      { slotKey: "coa_spectral", defaultLabel: "Spectral — Isthmus PW Doppler" },
      { slotKey: "coa_3vt_2d", defaultLabel: "3VT — Ao/PA Size Comparison" },
    ],
  },
  {
    id: "chd_tapvr",
    name: "Total Anomalous Pulmonary Venous Return",
    abbr: "TAPVR",
    category: "Great Vessel",
    prevalence: "~1 in 15,000 live births; frequently missed prenatally",
    description: "All four pulmonary veins drain anomalously (not into LA). Types: supracardiac (vertical vein to SVC/innominate), cardiac (to coronary sinus or RA), infracardiac (to portal/hepatic vein), or mixed. Obstructed TAPVR is a neonatal emergency. Fetal diagnosis requires color Doppler.",
    keyFindings2D: [
      "Absent pulmonary vein connections to LA on 2D",
      "Supracardiac TAPVR: vertical vein visible above LA (in 3VT view)",
      "Cardiac TAPVR: dilated coronary sinus behind LA",
      "Infracardiac TAPVR: descending vertical vein below diaphragm",
      "LA may appear small (no pulmonary venous return)",
      "RA and RV may be dilated",
    ],
    colorDoppler: [
      "ESSENTIAL: color Doppler 'crab-claw' pattern of 4 veins entering LA — ABSENT in TAPVR",
      "Vertical vein: color flow above LA (supracardiac) or below diaphragm (infracardiac)",
      "Coronary sinus: dilated with color flow (cardiac TAPVR)",
      "Assess flow direction in vertical vein (descending = obstructed)",
    ],
    spectralDoppler: [
      "PW at vertical vein: assess flow direction and velocity",
      "Obstructed TAPVR: high-velocity, turbulent flow in vertical vein",
      "PW at ductus venosus: assess hepatic venous flow in infracardiac type",
    ],
    fetalEchoViews: [
      "4-Chamber View — absent PV connections to LA",
      "3-Vessels Trachea (3VT) View — vertical vein (4th vessel) in supracardiac TAPVR",
      "Pulmonary Veins View — color Doppler 'crab-claw' pattern",
      "Subcostal View — infracardiac vertical vein",
    ],
    pitfalls: [
      "Most commonly missed CHD — requires dedicated color Doppler PV assessment",
      "Normal 4CV does not exclude TAPVR",
      "Vertical vein may be mistaken for SVC or PLSVC",
      "Obstructed TAPVR: neonatal emergency — urgent surgical repair",
      "Mixed TAPVR: most complex — requires careful assessment of all 4 veins",
    ],
    associatedAnomalies: [
      "Heterotaxy / asplenia (bilateral right isomerism) — strong association",
      "ASD (obligatory for survival)", "Single ventricle",
    ],
    prognosis: "Unobstructed TAPVR: good with surgical repair. Obstructed TAPVR: neonatal emergency with high mortality without immediate surgery. Infracardiac type most commonly obstructed.",
    imageSlots: [
      { slotKey: "tapvr_4cv_2d", defaultLabel: "4CV — Absent PV Connections" },
      { slotKey: "tapvr_pv_color", defaultLabel: "PV View — Color Doppler (Absent Crab-Claw)" },
      { slotKey: "tapvr_3vt_2d", defaultLabel: "3VT — Vertical Vein (4th Vessel)" },
      { slotKey: "tapvr_vertical_color", defaultLabel: "Vertical Vein — Color Doppler" },
      { slotKey: "tapvr_spectral", defaultLabel: "Spectral — Vertical Vein Flow" },
    ],
  },

  // ─── COMPLEX / CONOTRUNCAL ───────────────────────────────────────────────────
  {
    id: "chd_hlhs",
    name: "Hypoplastic Left Heart Syndrome",
    abbr: "HLHS",
    category: "Complex / Conotruncal",
    prevalence: "~1 in 5,000 live births; most common cause of cardiac death in first week of life",
    description: "Spectrum of left heart underdevelopment: hypoplastic LV, mitral atresia/stenosis, aortic atresia/stenosis, and hypoplastic ascending aorta and arch. The RV supports both pulmonary and systemic circulation via the ductus arteriosus. Requires staged surgical palliation (Norwood/Glenn/Fontan).",
    keyFindings2D: [
      "Hypoplastic LV — small, non-apex-forming, echogenic (EFE)",
      "Mitral valve: atretic or hypoplastic — measure annulus Z-score",
      "Aortic valve: atretic or hypoplastic — measure annulus Z-score",
      "Ascending aorta: hypoplastic (often <3 mm) — retrograde filling from ductus",
      "RV dominant — enlarged, apex-forming",
      "Transverse arch: hypoplastic, often with coarctation",
    ],
    colorDoppler: [
      "Retrograde flow in ascending aorta and transverse arch (from ductus)",
      "No antegrade aortic valve flow in aortic atresia",
      "Mitral regurgitation if mitral valve present (not atretic)",
      "Assess foramen ovale: restrictive FO is a risk factor for pulmonary hypertension",
      "Pulmonary veins: assess for restriction at FO",
    ],
    spectralDoppler: [
      "Retrograde flow in aortic arch and ascending aorta",
      "Assess FO flow: restrictive FO = high-velocity left-to-right flow",
      "MR velocity if MV present",
      "Ductal flow: assess direction and velocity",
    ],
    fetalEchoViews: [
      "4-Chamber View — LV hypoplasia, RV dominance",
      "LVOT / 5-Chamber View — hypoplastic aortic valve",
      "Aortic Arch View — retrograde arch flow, arch hypoplasia",
      "3VT View — aorta/PA ratio",
      "Pulmonary Veins View — assess FO restriction",
    ],
    pitfalls: [
      "Evolving HLHS: LV may appear normal early — serial monitoring essential",
      "Restrictive FO: associated with severe pulmonary hypertension postnatally — high risk",
      "Distinguish from critical AS with evolving HLHS",
      "HLHS with intact atrial septum: neonatal emergency — requires urgent atrial septostomy",
    ],
    associatedAnomalies: [
      "Turner syndrome", "Trisomy 18", "Jacobsen syndrome (11q deletion)",
      "Restrictive/intact atrial septum (worst prognosis)",
    ],
    prognosis: "Requires staged palliation: Norwood (Stage 1) → Glenn (Stage 2) → Fontan (Stage 3). 5-year survival ~70% at experienced centers. Neurodevelopmental morbidity common.",
    imageSlots: [
      { slotKey: "hlhs_4cv_2d", defaultLabel: "4CV — LV Hypoplasia / RV Dominance" },
      { slotKey: "hlhs_lvot_2d", defaultLabel: "LVOT — Hypoplastic Aortic Valve" },
      { slotKey: "hlhs_arch_color", defaultLabel: "Arch — Retrograde Flow Color" },
      { slotKey: "hlhs_spectral", defaultLabel: "Spectral — Retrograde Arch / FO Flow" },
      { slotKey: "hlhs_4cv_color", defaultLabel: "4CV — Color Doppler (MR / FO)" },
    ],
  },
  {
    id: "chd_truncus",
    name: "Truncus Arteriosus",
    abbr: "Truncus",
    category: "Complex / Conotruncal",
    prevalence: "~1 in 10,000 live births",
    description: "A single arterial trunk arises from both ventricles via a large VSD, giving rise to the aorta, pulmonary arteries, and coronary arteries. The truncal valve has 2–4 leaflets (often dysplastic). Associated with 22q11 deletion in ~35% of cases.",
    keyFindings2D: [
      "Single large arterial trunk overriding a large VSD",
      "Truncal valve: 2–4 leaflets, often thickened/dysplastic",
      "Pulmonary arteries arise from the trunk (not from RV)",
      "No separate RVOT or pulmonary valve",
      "Aortic arch: right arch in ~30%",
      "VSD: large, outlet type — always present",
    ],
    colorDoppler: [
      "Single trunk with color flow from both ventricles",
      "Truncal valve regurgitation: assess severity",
      "Pulmonary arteries: color flow from trunk",
      "Assess for associated arch anomalies with color Doppler",
    ],
    spectralDoppler: [
      "PW/CW at truncal valve: assess regurgitation and stenosis",
      "Assess pulmonary artery flow from trunk",
    ],
    fetalEchoViews: [
      "LVOT / 5-Chamber View — single trunk overriding VSD",
      "RVOT View — absent separate RVOT/pulmonary valve",
      "3VT View — absent normal 3-vessel arrangement",
      "Aortic Arch View — right arch in 30%",
    ],
    pitfalls: [
      "Distinguish from TOF: TOF has separate RVOT; truncus does not",
      "Truncal valve regurgitation: may cause fetal hydrops",
      "22q11 deletion: genetic counseling essential",
      "Type I vs. II vs. III truncus: affects surgical approach",
    ],
    associatedAnomalies: [
      "22q11.2 deletion (DiGeorge) — 35%", "Right aortic arch (30%)",
      "Interrupted aortic arch (10–15%)", "Coronary artery anomalies",
    ],
    prognosis: "Requires surgical repair in neonatal period (VSD closure + RV-PA conduit). 10-year survival ~80% at experienced centers. Conduit replacement required as child grows.",
    imageSlots: [
      { slotKey: "truncus_lvot_2d", defaultLabel: "LVOT — Single Trunk Override" },
      { slotKey: "truncus_lvot_color", defaultLabel: "LVOT — Color Doppler" },
      { slotKey: "truncus_3vt_2d", defaultLabel: "3VT — Absent Normal Vessels" },
      { slotKey: "truncus_spectral", defaultLabel: "Spectral — Truncal Valve" },
    ],
  },
  {
    id: "chd_dorv",
    name: "Double Outlet Right Ventricle",
    abbr: "DORV",
    category: "Complex / Conotruncal",
    prevalence: "~1 in 10,000 live births",
    description: "Both great arteries arise entirely or predominantly (>50%) from the RV. A VSD is almost always present. DORV is a spectrum: DORV with subaortic VSD (TOF-type), DORV with subpulmonary VSD (Taussig-Bing — TGA-type), DORV with doubly committed VSD, or DORV with non-committed VSD.",
    keyFindings2D: [
      "Both great arteries arise from RV (parallel or side-by-side)",
      "VSD: always present — location determines surgical approach",
      "Subaortic VSD (TOF-type): VSD beneath aorta — aorta overrides >50%",
      "Subpulmonary VSD (Taussig-Bing): VSD beneath PA — TGA physiology",
      "Great vessel relationship: side-by-side, Ao anterior-right, or Ao anterior-left",
      "Pulmonary stenosis: common in TOF-type DORV",
    ],
    colorDoppler: [
      "Both great vessels receive color flow from RV",
      "VSD: color flow — assess direction and location",
      "Assess for pulmonary stenosis with color Doppler at RVOT",
    ],
    spectralDoppler: [
      "PW at both outflow tracts: assess for obstruction",
      "VSD flow: assess direction and velocity",
    ],
    fetalEchoViews: [
      "LVOT / 5-Chamber View — both vessels from RV",
      "RVOT View — great vessel relationship",
      "3VT View — great vessel positions",
      "4-Chamber View — VSD location",
    ],
    pitfalls: [
      "DORV vs. TOF: measure aortic override — >50% = DORV territory",
      "DORV vs. TGA: Taussig-Bing has subpulmonary VSD — TGA physiology",
      "VSD location is critical for surgical planning",
      "Associated with heterotaxy and other complex CHD",
    ],
    associatedAnomalies: [
      "Heterotaxy", "Trisomy 18", "Trisomy 13",
      "Pulmonary stenosis", "AV canal defects",
    ],
    prognosis: "Highly variable — depends on VSD location, great vessel relationship, and associated anomalies. TOF-type DORV: good prognosis with repair. Taussig-Bing: requires arterial switch + VSD closure.",
    imageSlots: [
      { slotKey: "dorv_lvot_2d", defaultLabel: "LVOT — Both Vessels from RV" },
      { slotKey: "dorv_3vt_2d", defaultLabel: "3VT — Great Vessel Relationship" },
      { slotKey: "dorv_color", defaultLabel: "Color Doppler — VSD / Outflow" },
      { slotKey: "dorv_spectral", defaultLabel: "Spectral — Outflow Assessment" },
    ],
  },

  // ─── SITUS / HETEROTAXY ──────────────────────────────────────────────────────
  {
    id: "chd_heterotaxy",
    name: "Heterotaxy / Situs Ambiguus",
    abbr: "Heterotaxy",
    category: "Situs / Heterotaxy",
    prevalence: "~1 in 10,000 live births",
    description: "Abnormal arrangement of thoracic and abdominal organs. Right isomerism (asplenia): bilateral right-sidedness — bilateral SVC, bilateral morphologic right atria, asplenia, complex CHD (AVSD, TAPVR, DORV). Left isomerism (polysplenia): bilateral left-sidedness — interrupted IVC, polysplenia, AV block, less severe CHD.",
    keyFindings2D: [
      "Abdominal situs: stomach and aorta on same side (both left or both right)",
      "IVC: absent (interrupted) in left isomerism — azygos continuation",
      "Bilateral SVC: right isomerism — look for left SVC in 3VT view",
      "Cardiac position: mesocardia or dextrocardia common",
      "AVSD: very common in right isomerism",
      "Unbalanced AVSD: one ventricle dominant",
    ],
    colorDoppler: [
      "IVC: absent in left isomerism — azygos vein drains to SVC",
      "Bilateral SVC: color flow on both sides in 3VT view",
      "TAPVR: common in right isomerism — assess all pulmonary veins",
      "AV valve regurgitation in AVSD",
    ],
    spectralDoppler: [
      "Assess AV valve regurgitation severity",
      "Assess pulmonary blood flow (PS/PA common in right isomerism)",
      "Ductus venosus: assess in left isomerism (hepatic vein anomalies)",
    ],
    fetalEchoViews: [
      "Abdominal Situs View — stomach/liver/aorta/IVC positions",
      "4-Chamber View — AVSD, ventricular balance",
      "3VT View — bilateral SVC, great vessel relationship",
      "Pulmonary Veins View — TAPVR assessment",
      "Bicaval View — IVC/SVC assessment",
    ],
    pitfalls: [
      "Heterotaxy is a spectrum — always complete full cardiac survey",
      "Left isomerism: AV block may develop — assess fetal heart rate and rhythm",
      "Right isomerism: TAPVR almost always present — dedicated PV assessment essential",
      "Interrupted IVC: azygos continuation may be mistaken for normal IVC",
    ],
    associatedAnomalies: [
      "Right isomerism: AVSD, TAPVR, DORV, PS/PA, asplenia",
      "Left isomerism: interrupted IVC, polysplenia, AV block, partial AVSD",
      "Extracardiac: biliary atresia (left isomerism), intestinal malrotation",
    ],
    prognosis: "Highly variable. Right isomerism with complex CHD: poor prognosis, often single ventricle palliation. Left isomerism: better prognosis if CHD is less complex. AV block in left isomerism may require pacemaker.",
    imageSlots: [
      { slotKey: "het_situs_2d", defaultLabel: "Abdominal Situs — Stomach/Liver/Ao/IVC" },
      { slotKey: "het_4cv_2d", defaultLabel: "4CV — AVSD / Ventricular Balance" },
      { slotKey: "het_3vt_2d", defaultLabel: "3VT — Bilateral SVC" },
      { slotKey: "het_pv_color", defaultLabel: "PV View — TAPVR Color Doppler" },
      { slotKey: "het_spectral", defaultLabel: "Spectral — AV Valve / IVC Flow" },
    ],
  },
];

/** All unique CHD categories in display order */
export const CHD_CATEGORIES: ChdView["category"][] = [
  "Septal Defects",
  "Outflow Tract",
  "Valve Anomalies",
  "Great Vessel",
  "Complex / Conotruncal",
  "Situs / Heterotaxy",
];

/** All slot keys used across all CHD views (for DB schema and server enum) */
export const ALL_CHD_SLOT_KEYS: string[] = FETAL_CHD_VIEWS.flatMap(v => v.imageSlots.map(s => s.slotKey));
