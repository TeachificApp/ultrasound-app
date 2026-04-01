/**
 * scanCoachStaticContent.ts
 * Pre-computed static content for all general/vascular ScanCoach modules.
 * Used by the ScanCoach Editor to pre-populate text fields when no DB override exists.
 * Auto-generated from the static ScanCoach page data.
 */

export interface ScanCoachStaticViewContent {
  description: string;
  howToGet: string;
  tips: string;
  pitfalls: string;
}

export type ScanCoachStaticContent = Record<string, Record<string, ScanCoachStaticViewContent>>;

export const SCANCOACH_STATIC_CONTENT: ScanCoachStaticContent = {
  abdominal: {
    liver: {
      description: ``,
      howToGet: `Patient Positioning: Supine with the right arm extended above the head to widen the intercostal spaces. Left lateral decubitus positioning can improve visualization of the right lobe by moving the liver away from the ribs.
Transducer Positioning: Begin with a subcostal sweep from the midline to the right lateral margin. Use intercostal windows (typically 8th–10th intercostal spaces) to visualize the right lobe. Fan through the entire liver systematically in both transverse and longitudinal planes.
What to Assess: All hepatic lobes (right, left, caudate). Parenchymal echogenicity compared to the right renal cortex (normal: isoechoic or mildly hyperechoic). Surface contour (smooth vs. nodular). Focal lesions, masses, or cysts. Portal and hepatic veins, hepatic artery. Perihepatic spaces for free fluid.`,
      tips: `Scanning Tip: Use both subcostal and intercostal windows to visualize all segments of the liver. Have the patient take a deep breath and hold to bring the liver inferiorly and improve subcostal access. The right lobe dome is best seen via intercostal windows with the patient in deep inspiration.
Scanning Tip: Compare liver echogenicity to the right renal cortex on the same image. Liver echogenicity should be equal to or slightly greater than the kidney. Increased liver echogenicity relative to the kidney suggests hepatic steatosis (fatty liver).
Doppler: Evaluate portal vein flow direction (hepatopetal = toward liver = normal) and velocity (normal 15–40 cm/s). Hepatic vein waveforms should be triphasic. Reversal of portal flow or loss of hepatic vein phasicity suggests portal hypertension or cardiac disease.`,
      pitfalls: ``,
    },
    gallbladder: {
      description: ``,
      howToGet: `Patient Positioning: Supine initially. Left lateral decubitus (LLD) positioning is essential — it causes gallstones to roll to the dependent portion of the gallbladder and sludge to layer, confirming mobility and gravity dependence. Erect positioning can also be used to confirm stone mobility.
Transducer Positioning: Begin with a subcostal oblique approach along the long axis of the gallbladder. Rotate to obtain true long-axis and transverse views. Use intercostal windows if the gallbladder is high-lying. Always scan in at least two planes.
What to Assess: Gallbladder size (normal length ≤10 cm, AP diameter ≤4 cm), wall thickness (normal ≤3 mm in a fasted patient), intraluminal contents (stones, sludge, polyps). Sonographic Murphy's sign (maximal tenderness with transducer pressure over the gallbladder). Common bile duct (CBD) diameter (normal ≤6 mm; up to 8 mm post-cholecystectomy). Intrahepatic bile ducts for dilatation.`,
      tips: `Scanning Tip: Ensure the patient is fasted ≥8 hours before scanning. A contracted gallbladder from recent eating will be small, thick-walled, and filled with sludge — mimicking pathology. Fasting allows the gallbladder to distend and fill with bile, optimizing stone detection.
Scanning Tip: Gallstones produce three classic signs: echogenic focus, posterior acoustic shadowing, and gravity dependence (roll patient to confirm movement). Polyps do not shadow and do not move. Sludge layers dependently but does not shadow. Adenomyomatosis shows comet-tail artifacts (ring-down).`,
      pitfalls: ``,
    },
    pancreas: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Erect or semi-erect positioning may help displace bowel gas. Having the patient drink 8–16 oz of water immediately before scanning can act as an acoustic window to improve pancreatic visualization.
Transducer Positioning: Begin with a transverse sweep from the xiphoid process inferiorly. Angle the transducer cephalad to bring the pancreas into view anterior to the splenic vein. Follow the splenic vein as a landmark — the pancreatic body lies directly anterior to it.
What to Assess: Head, uncinate process, body, and tail. Parenchymal echotexture (normally isoechoic to slightly hyperechoic relative to liver), masses, calcifications, and ductal dilatation (normal main pancreatic duct ≤3 mm). Peripancreatic region for adenopathy or fluid collections.`,
      tips: `Scanning Tip: Use the splenic vein as a reliable posterior landmark — the pancreatic body lies directly anterior to it. If bowel gas is obscuring the pancreas, try applying gentle graded compression to displace the gas, or reposition the patient erect.
Scanning Tip: The pancreatic tail is the most difficult portion to visualize. Use the spleen as an acoustic window via a left lateral intercostal approach to image the tail. Color Doppler can help identify the splenic artery running along the superior border of the pancreas.`,
      pitfalls: ``,
    },
    spleen: {
      description: ``,
      howToGet: `Patient Positioning: Right lateral decubitus (patient lying on right side) is the optimal position — it moves the spleen away from the ribs and improves intercostal access. Supine can be used initially but the spleen is often obscured by ribs and bowel gas.
Transducer Positioning: Use the left posterior intercostal approach (typically 9th–11th intercostal spaces) with the transducer angled anteriorly. Obtain a true long-axis view for bipolar length measurement. Rotate 90° for transverse views. The left hemidiaphragm and left pleural space should be included in the survey.
What to Assess: Bipolar length (normal ≤12 cm; splenomegaly >13 cm). Parenchymal echogenicity (normally homogeneous, similar to or slightly more echogenic than the left kidney). Focal lesions, infarcts, cysts, or masses. Splenic hilum and vasculature. Left hemidiaphragm and adjacent pleural space for effusion. Perisplenic free fluid.`,
      tips: `Scanning Tip: The spleen is the most difficult abdominal organ to measure accurately due to its oblique orientation. Measure the maximum bipolar length in the true long axis — do not measure obliquely. Mild splenomegaly (13–15 cm) is a common incidental finding and may be normal in tall individuals.
Scanning Tip: The spleen is highly vascular and prone to laceration — handle with care during scanning. If free fluid is seen in the perisplenic space (Morrison's pouch equivalent on the left = splenorenal recess), consider traumatic injury or ascites. Color Doppler can assess splenic vein patency (thrombosis causes splenomegaly and varices).`,
      pitfalls: ``,
    },
    kidneys: {
      description: ``,
      howToGet: `Patient Positioning: Supine for right kidney (use liver as acoustic window). Left lateral decubitus for right kidney if supine access is limited. Right lateral decubitus or prone for left kidney (use spleen as acoustic window). Prone positioning can be used for both kidneys when other approaches fail.
Transducer Positioning: Right kidney: coronal approach from the right flank, using the liver as an acoustic window. Obtain long-axis (bipolar length) and transverse views. Left kidney: coronal approach from the left flank using the spleen. Both kidneys should be measured in the same plane for comparison.
What to Assess: Long-axis bipolar length (normal adult 9–12 cm), cortical thickness (normal ≥1 cm), and echogenicity compared to liver (right) and spleen (left). Collecting system for hydronephrosis (graded 1–4). Calculi (echogenic foci with posterior shadowing). Masses, cysts (Bosniak classification). Perirenal spaces. Renal vascularity with color Doppler.`,
      tips: `Scanning Tip: Compare right kidney echogenicity to the adjacent liver cortex — they should be equal or the kidney slightly hypoechoic. Compare left kidney to the spleen. Increased renal cortical echogenicity relative to the liver suggests medical renal disease (e.g., chronic kidney disease, glomerulonephritis).
Scanning Tip: To distinguish a parapelvic cyst from hydronephrosis: parapelvic cysts are discrete, round, anechoic structures that do not communicate with the collecting system. Hydronephrosis shows a connected fluid-filled system that fans out from the renal pelvis. Color Doppler of the ureterovesical junction can help assess for ureteral jets (absent jets suggest obstruction).`,
      pitfalls: ``,
    },
    aorta: {
      description: ``,
      howToGet: `Patient Positioning: Supine. If bowel gas is limiting, try left lateral decubitus or semi-erect positioning. A fasting state of ≥8 hours significantly reduces bowel gas interference.
Transducer Positioning: Begin with a transverse sweep from the xiphoid to the aortic bifurcation (approximately at the umbilicus). Then rotate 90° for longitudinal views. Measure the aorta in the anteroposterior dimension on transverse views (outer wall to outer wall).
What to Assess: Proximal (suprarenal), mid (infrarenal), and distal aorta to the bifurcation. Measure maximum AP diameter. Assess for aneurysm (>3.0 cm), mural thrombus, intimal flap, or calcification. Evaluate the iliac arteries if the aorta is dilated.`,
      tips: `Scanning Tip: Always measure the aorta in the true AP dimension on a transverse image — do not measure obliquely, as this overestimates diameter. The normal aorta tapers from approximately 2.0 cm at the diaphragm to 1.5 cm at the bifurcation.
Scanning Tip: Color Doppler is useful to distinguish the aorta from the IVC and to identify the celiac axis and SMA origins. Apply gentle compression to displace bowel gas if needed — the aorta lies posterior and will not compress.`,
      pitfalls: ``,
    },
    ivc: {
      description: ``,
      howToGet: `Patient Positioning: Supine. The IVC is best assessed with the patient in quiet respiration. Avoid deep inspiration or Valsalva maneuver during diameter measurement, as these alter IVC size significantly.
Transducer Positioning: Subcostal long-axis view: place the transducer just below the xiphoid, angled toward the right shoulder. The IVC is seen entering the right atrium. Parasagittal approach: transducer in the right parasagittal plane, just right of midline, to follow the IVC from the hepatic confluence to the right atrium.
What to Assess: Patency, diameter (normal ≤2.1 cm), and respiratory variation (collapsibility index >50% suggests low CVP). Presence of thrombus, tumor extension (e.g., renal cell carcinoma), or IVC filters. Hepatic vein confluence and flow direction with Doppler.`,
      tips: `Scanning Tip: Measure IVC diameter 2 cm distal to the hepatic vein confluence in the subcostal long-axis view. Measure at end-expiration for consistency. A collapsibility index (CI) >50% with a diameter <2.1 cm suggests low right atrial pressure (<5 mmHg).
Scanning Tip: Do not confuse the IVC with the aorta. The IVC is to the right of midline, has thin walls, is compressible, and shows triphasic flow with Doppler. The aorta is to the left, pulsatile, and non-compressible.`,
      pitfalls: ``,
    },
  },
  pelvic_gyn: {
    uterus_sag: {
      description: ``,
      howToGet: `Patient Positioning: Empty bladder (patient should void immediately before TVS). Lithotomy position (supine with hips flexed and abducted). A pillow or folded sheet under the buttocks improves access. The patient or sonographer may insert the probe. Explain the procedure to the patient before insertion.
Transducer Positioning: Insert the probe gently into the vagina with the marker pointing anteriorly (toward the ceiling). Sagittal plane: sweep from right to left to survey the entire uterus. Transverse plane: rotate 90° and sweep from fundus to cervix. The probe handle is moved in the opposite direction to the transducer tip — move the handle to the right to angle the tip to the left.
What to Assess: Uterine size (length × AP × width); orientation (anteverted, retroverted); myometrium (homogeneous, fibroids — location: submucosal, intramural, subserosal; size; vascularity); endometrium (DLET in sagittal plane; echogenicity; regularity; polyps; IUD location); cervix (length, nabothian cysts, polyps, cervical canal); lower uterine segment (adenomyosis signs: globular uterus, asymmetric myometrium, myometrial cysts, fan-shaped shadowing).`,
      tips: `Scanning Tip: Endometrial polyp vs. submucosal fibroid: polyps are echogenic, pedunculated, and show a feeding vessel on color Doppler. Submucosal fibroids are hypoechoic, distort the endometrial cavity, and show peripheral vascularity. Saline infusion sonohysterography (SIS) improves differentiation. Adenomyosis: globular uterus, asymmetric myometrial thickening, myometrial cysts (>3 mm), and fan-shaped acoustic shadowing are the most specific TVS signs.
Pearl: Endometrial thickness in postmenopausal women: a DLET <4 mm has a >99% negative predictive value for endometrial cancer in postmenopausal women with bleeding. If the endometrium is not adequately visualized on TVS (e.g., due to fibroids, adenomyosis, or poor visualization), SIS or hysteroscopy is recommended.`,
      pitfalls: `Retroverted uterus: in a retroverted uterus, the fundus is posterior and the endometrium may be difficult to visualize in the sagittal plane. Rotate the probe to obtain a true sagittal plane aligned with the uterine axis. The probe handle may need to be angled posteriorly (toward the floor) to align with the uterine axis in a retroverted uterus.`,
    },
    adnexa: {
      description: ``,
      howToGet: `Patient Positioning: Empty bladder. Lithotomy position. TVS provides superior resolution for ovarian assessment compared to TA, especially in obese patients or when the ovaries are not well seen on TA.
Transducer Positioning: From the sagittal plane, rotate the probe to the transverse plane and sweep laterally to identify each ovary. The ovary is typically located lateral to the uterus, medial to the iliac vessels. Angle the probe laterally (move the handle medially) to visualize the lateral adnexa. Color Doppler: assess ovarian and adnexal vascularity.
What to Assess: Ovarian size and volume (normal: <10 mL premenopausal, <8 mL postmenopausal); follicles (antral follicle count — AFC — for fertility assessment; normal AFC 5–15 per ovary); dominant follicle (periovulatory: 18–25 mm); corpus luteum (thick-walled cyst with peripheral 'ring of fire' on color Doppler); ovarian cysts (O-RADS classification); fallopian tubes (normally not seen unless dilated — hydrosalpinx, pyosalpinx).`,
      tips: `Scanning Tip: Antral follicle count (AFC): count all follicles 2–10 mm in diameter in each ovary in the early follicular phase (days 2–5 of the menstrual cycle). AFC is the best predictor of ovarian reserve. Low AFC (<5 per ovary) suggests diminished ovarian reserve (DOR). High AFC (>12 per ovary) suggests polycystic ovary morphology (PCOM) — assess in conjunction with serum AMH and clinical criteria.
Pearl: Ovarian torsion: TVS signs include enlarged ovary (>4 cm), peripheral follicles displaced to the periphery (edematous stroma), absent or reduced Doppler flow (absent flow is specific but not sensitive — torsion can occur with preserved Doppler flow), free fluid, and a twisted vascular pedicle (whirlpool sign on color Doppler). Clinical suspicion is paramount — do not exclude torsion based on normal Doppler alone.`,
      pitfalls: `Hemorrhagic corpus luteum cyst: appears as a complex cystic mass with internal echoes (reticular or lace-like pattern), thick wall, and peripheral vascularity on color Doppler (no internal flow). It can mimic an ectopic pregnancy or endometrioma. Correlate with beta-hCG and follow-up ultrasound in 6–8 weeks — hemorrhagic corpus luteum cysts typically resolve spontaneously.`,
    },
    cul_de_sac: {
      description: ``,
      howToGet: `Patient Positioning: Empty bladder. Lithotomy position. TVS provides superior visualization of the cul-de-sac compared to TA, especially for small amounts of free fluid and posterior DIE.
Transducer Positioning: Sagittal plane: tilt the probe posteriorly (move the handle anteriorly) to visualize the cul-de-sac posterior to the uterus. Assess the rectovaginal septum and the anterior rectal wall. Transverse plane: sweep inferiorly to assess the entire cul-de-sac. Apply gentle pressure with the probe to assess mobility of pelvic structures (sliding sign).
What to Assess: Free fluid (simple vs. complex; volume estimate); loculated fluid (endometrioma — 'ground glass' appearance, thick wall, no internal flow; pyosalpinx — tubular, thick-walled, internal echoes; hematoma); peritoneal implants; rectovaginal septum (thickening, nodularity — DIE); anterior rectal wall (thickening, tethering — DIE); 'kissing ovaries' (ovaries adherent to each other in the cul-de-sac — severe endometriosis).`,
      tips: `Scanning Tip: Endometrioma identification: the classic TVS appearance is a unilocular cyst with homogeneous 'ground glass' low-level internal echoes, thick wall, and no internal vascularity on color Doppler. Multiple endometriomas, bilateral endometriomas, and associated DIE (rectovaginal nodule, uterosacral ligament thickening) suggest severe endometriosis (stage III–IV).
Pearl: Sliding sign for posterior DIE: with the probe in the sagittal plane, gently push the uterus anteriorly with the probe tip while observing the posterior uterine wall and rectum. In normal women, the uterus slides freely over the rectum. In posterior DIE, the uterus and rectum are adherent and do not slide. This sign has >80% sensitivity and specificity for posterior DIE.`,
      pitfalls: ``,
    },
    endometrium: {
      description: ``,
      howToGet: `Patient Positioning: Empty bladder. Lithotomy position. TVS is the gold standard for endometrial assessment. Obtain the sagittal plane of the uterus aligned with the uterine axis for accurate DLET measurement.
Transducer Positioning: Sagittal plane aligned with the uterine long axis. The endometrium should appear as a central echogenic stripe. Measure the DLET at the thickest point, perpendicular to the midline, excluding any fluid in the cavity. If fluid is present, measure each layer separately and add them together.
What to Assess: DLET (double-layer endometrial thickness): normal values by phase (proliferative 4–8 mm, secretory 8–14 mm, postmenopausal <4 mm without HRT, <8 mm with HRT); echogenicity (hypoechoic = proliferative; hyperechoic = secretory; heterogeneous = polyp, hyperplasia, cancer); regularity (smooth vs. irregular); endometrial cavity (fluid, polyps, IUD, synechiae); cervical canal (polyps, stenosis).`,
      tips: `Scanning Tip: Endometrial polyp detection: polyps are best seen in the early proliferative phase (days 4–8) when the endometrium is thin and hypoechoic. Polyps appear as echogenic, well-defined lesions within the endometrial cavity with a feeding vessel on color Doppler. SIS (saline infusion sonohysterography) significantly improves polyp detection and characterization.
Pearl: Postmenopausal endometrial assessment: a DLET <4 mm has a >99% NPV for endometrial cancer. If DLET \\u22654 mm or the endometrium is not adequately visualized, endometrial biopsy is recommended. If the endometrium is not visualized (e.g., due to cervical stenosis or poor visualization), SIS or hysteroscopy is recommended. Do not report the endometrium as 'normal' if it is not adequately visualized.`,
      pitfalls: `Submucosal fibroids can distort the endometrial cavity and make DLET measurement inaccurate. In these cases, describe the fibroid location (FIGO classification: Type 0 = pedunculated intracavitary; Type 1 = <50% intramural; Type 2 = \\u226550% intramural) and note that DLET measurement is limited. SIS is recommended for further evaluation.`,
    },
    cervix: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    transvaginal_survey: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    ectopic_pregnancy: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  ob1: {
    gest_sac: {
      description: ``,
      howToGet: `Patient Positioning: Transabdominal (TA): supine with a comfortably full bladder. Transvaginal (TVS): lithotomy position with the bladder emptied — a full bladder is not required and may impair TVS image quality. TVS is preferred for early first trimester (<7 weeks) due to superior resolution.
Transducer Positioning: TA: midline sagittal and transverse planes through the lower uterus. TVS: insert probe gently into the anterior vaginal fornix; angle anteriorly for the uterus. Identify the uterine cavity and locate the gestational sac within the endometrium (not in the cervix or adnexa).
What to Assess: Gestational sac (GS) location (intrauterine vs. ectopic); GS size (mean sac diameter = [length + width + height] / 3); shape (round/oval is normal); double decidual sac sign (two concentric echogenic rings — confirms IUP); yolk sac presence (confirms IUP when visible); number of GS (multiple gestation).`,
      tips: `Scanning Tip: Mean Sac Diameter (MSD) thresholds: GS should be visible on TVS when β-hCG >1,500–2,000 mIU/mL (discriminatory zone). A GS >25 mm MSD without a yolk sac (empty sac) is diagnostic of failed pregnancy. A GS >25 mm MSD without an embryo is also diagnostic of failed pregnancy per SMFM/ACOG criteria.
Pearl: The double decidual sac sign (DDSS) — two concentric echogenic rings around the GS — is the earliest reliable sign of an intrauterine pregnancy and helps distinguish IUP from a pseudogestational sac (seen in ectopic pregnancy). A pseudogestational sac is a single echogenic ring (decidual reaction) without a true choriodecidual interface.`,
      pitfalls: `An interstitial (cornual) ectopic pregnancy is located in the intramural portion of the fallopian tube and may appear to be within the uterus. Key features: GS is eccentric (not central in the endometrium), surrounded by <5 mm of myometrium, and the 'interstitial line sign' may be present. Rupture risk is high — consult immediately.`,
    },
    yolk_sac: {
      description: ``,
      howToGet: `Patient Positioning: TVS with empty bladder. The yolk sac is the first structure visible within the gestational sac, appearing at approximately 5.5 weeks GA. It is the primary source of nutrition for the embryo before the placenta is established.
Transducer Positioning: Center the gestational sac in the field of view. The yolk sac appears as a round, echogenic ring with an anechoic center within the gestational sac, adjacent to the embryo (when visible). Normal yolk sac diameter: 3–6 mm at 6–10 weeks.
What to Assess: Yolk sac presence (confirms IUP); size (normal 3–6 mm; >6 mm or <3 mm at 6–10 weeks is abnormal); shape (round/oval is normal; irregular shape is associated with poor outcome); echogenicity (normal = thin echogenic ring; calcified or hyperechoic yolk sac is abnormal).`,
      tips: `Scanning Tip: The yolk sac should be visible on TVS when the GS MSD is ≥10 mm. Absence of a yolk sac when the GS MSD is ≥10 mm is suspicious for failed pregnancy. An abnormal yolk sac (>6 mm, irregular, or calcified) is associated with increased risk of pregnancy loss even when cardiac activity is present.
Pearl: The yolk sac is connected to the embryo by the vitelline duct. At 6–7 weeks, the embryo is visible adjacent to the yolk sac. The amnion (thin membrane surrounding the embryo) is separate from the yolk sac — the embryo is within the amnion, and the yolk sac is outside the amnion but inside the chorionic cavity.`,
      pitfalls: ``,
    },
    embryo: {
      description: ``,
      howToGet: `Patient Positioning: TVS with empty bladder. The embryo is first visible at approximately 6 weeks GA as a small echogenic structure adjacent to the yolk sac. Cardiac activity (flickering motion) should be visible when the CRL is ≥7 mm on TVS.
Transducer Positioning: Center the embryo in the field of view. Magnify the image so the embryo occupies at least 50–75% of the screen. Measure the CRL (crown-rump length) in the longest axis of the embryo, with the embryo in a neutral position (neither flexed nor extended).
What to Assess: Embryo presence; cardiac activity (normal FHR at 6–7 weeks: 90–110 bpm; at 8–10 weeks: 150–175 bpm); CRL measurement (most accurate dating method in 1st trimester); embryo morphology (head, body, limb buds visible by 8–9 weeks); amnion (thin membrane surrounding embryo, separate from yolk sac).`,
      tips: `Scanning Tip: CRL measurement technique: (1) Magnify so the embryo fills 50–75% of the screen; (2) Measure in the longest axis with the embryo in a neutral position; (3) Do not include the yolk sac in the measurement; (4) Take 3 measurements and use the largest; (5) CRL is the most accurate dating method — use it to establish EDD in the 1st trimester.
Pearl: Cardiac activity thresholds: Absence of cardiac activity when CRL ≥7 mm on TVS is diagnostic of embryonic demise (per SMFM/ACOG 2012 criteria). A slow FHR (<90 bpm at 6–8 weeks) is associated with increased risk of miscarriage but is not immediately diagnostic of demise — follow-up in 7–10 days is recommended.`,
      pitfalls: `The amnion is a thin membrane that surrounds the embryo and may be mistaken for a second gestational sac. The amnion is always smaller than the chorionic cavity and is closely applied to the embryo. The yolk sac is outside the amnion but inside the chorionic cavity — this 'double bubble' appearance is normal.`,
    },
    nt: {
      description: ``,
      howToGet: `Patient Positioning: TVS preferred for NT measurement. The NT measurement is performed between 11+0 and 13+6 weeks (CRL 45–84 mm). The fetus must be in a neutral position (not hyperflexed or hyperextended). Fetal movement may be needed to achieve the correct position — wait for the fetus to move or gently tap the maternal abdomen.
Transducer Positioning: True midsagittal plane of the fetal face and neck — the nasal bone tip, palate, and posterior fossa should all be visible in the same plane. The NT is measured at the widest point of the translucent space between the skin and the cervical spine. Calipers are placed on the inner borders of the echogenic lines (skin and spine).
What to Assess: NT thickness (normal <3.0 mm at any CRL; MoM-based risk calculation is preferred); nasal bone (present/absent — absent nasal bone increases T21 risk); ductus venosus waveform (reversed a-wave increases T21/T18 risk); tricuspid regurgitation (increases T21 risk); fetal anatomy survey (early anomaly scan).`,
      tips: `Scanning Tip: NT measurement technique (FMF/NTQR standards): (1) True midsagittal plane — nasal bone tip, palate, and posterior fossa all visible; (2) Magnify so the fetal head and upper thorax fill the screen; (3) Neutral position — neither flexed nor extended; (4) Amnion must be separate from the fetal skin; (5) Measure the widest part of the NT; (6) Inner-to-inner caliper placement; (7) Take 3 measurements — use the largest.
Pearl: Increased NT (≥3.0 mm or ≥95th percentile for CRL) is associated with: Down syndrome (T21), Turner syndrome (45,X), other chromosomal abnormalities, and structural cardiac defects even with normal karyotype. An NT ≥3.5 mm warrants detailed fetal echocardiography at 18–22 weeks regardless of karyotype result.`,
      pitfalls: `The amnion can be mistaken for the fetal skin, leading to falsely elevated NT measurement. The amnion is a thin membrane that runs parallel to the fetal skin — if the amnion is adherent to the fetal neck, wait for fetal movement to separate it. The NT is measured between the fetal skin (not the amnion) and the cervical spine.`,
    },
    adnexa_1st: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    uterus_cervix_1st: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  ob23: {
    head_brain: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Optimal brain views require the fetal head in an occiput-lateral position. If the fetal occiput is posterior (OP), the calvarium may shadow — reposition the patient (lateral decubitus) or wait for fetal movement.
Transducer Positioning: Three axial planes: (1) Transventricular plane — for lateral ventricle atrial measurement; (2) Transthalamic plane — for BPD, HC, and cavum septi pellucidi; (3) Transcerebellar plane — for cerebellum, vermis, and cisterna magna.
What to Assess: Lateral ventricles (atrial width ≤10 mm); choroid plexus (fills ventricle, no cysts >10 mm); midline falx (present, midline); cavum septi pellucidi (present 18–37 weeks); cerebellum (bilobed, normal diameter for GA); vermis (present); cisterna magna (2–10 mm); 3rd ventricle (<3 mm); posterior fossa (no fluid).`,
      tips: `Scanning Tip: Lateral ventricle atrial measurement: measure at the level of the glomus of the choroid plexus, perpendicular to the long axis of the ventricle. Normal ≤10 mm at any GA. Ventriculomegaly: mild 10–12 mm, moderate 13–15 mm, severe >15 mm. Always measure the distal (far-field) ventricle — the near-field ventricle is often obscured by reverberation artifact.
Pearl: The cisterna magna (CM) is measured in the transcerebellar plane from the posterior vermis to the inner occipital bone. Normal CM: 2–10 mm. A CM >10 mm (mega cisterna magna) or absent CM with a 'banana sign' (cerebellum pulled anteriorly) suggests Chiari II malformation associated with open spina bifida.`,
      pitfalls: `The 'lemon sign' (frontal bone scalloping) is associated with open spina bifida (Chiari II) and is best seen at 16–24 weeks. It may be subtle or absent after 24 weeks. Always assess the posterior fossa and spine when a lemon sign is suspected.`,
    },
    face: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Fetal face assessment requires the fetal face to be anterior or in a lateral position. If the fetal face is posterior, wait for fetal movement or reposition the patient.
Transducer Positioning: Coronal plane through the face: for upper lip assessment (cleft lip detection) and nasal bone. Sagittal (profile) plane: for facial profile, nasal bone, and prognathism/micrognathia. Axial plane: for orbits (binocular distance, lens).
What to Assess: Upper lip (intact — no cleft lip); nasal bone (present/absent — absent nasal bone at 15–22 weeks increases T21 risk); facial profile (normal = flat/slightly convex); orbits (present, symmetric, binocular distance normal for GA); palate (hard and soft palate — cleft palate); ears (position and size).`,
      tips: `Scanning Tip: Cleft lip detection: the coronal plane through the upper lip (nasal-labial plane) is the most sensitive view. A cleft lip appears as a defect in the echogenic line of the upper lip. Isolated cleft palate (without cleft lip) is very difficult to detect on routine ultrasound. 3D ultrasound improves cleft lip/palate detection.
Pearl: Micrognathia (small mandible) is associated with Pierre Robin sequence, trisomy 18, and other syndromes. It is best assessed in the sagittal (profile) view — the chin appears recessed relative to the forehead. Polyhydramnios is commonly associated (impaired swallowing). Refer for fetal MRI and genetic counseling if micrognathia is suspected.`,
      pitfalls: ``,
    },
    chest_heart: {
      description: ``,
      howToGet: `Patient Positioning: Supine. The fetal heart is best assessed when the fetal spine is lateral (3 or 9 o'clock position) or posterior. If the spine is anterior, the ribs shadow the heart — reposition the patient or wait for fetal movement.
Transducer Positioning: Axial planes through the fetal chest: (1) Four-chamber view (4CV); (2) LVOT view (tilt superiorly from 4CV); (3) RVOT/3-vessel view (tilt further superiorly); (4) 3-vessel and trachea view (3VT). Assess lungs for echogenicity and size.
What to Assess: Cardiac activity (present); 4CV (heart <1/3 of chest area; apex points left at ~45°; two equal atria and ventricles; intact IVS; two AV valves); LVOT (aorta from LV, no VSD); RVOT (PA from RV, larger than Ao); 3VT (PA > Ao > SVC; normal alignment; no vascular ring); lungs (echogenic, symmetric, no masses).`,
      tips: `Scanning Tip: Four-chamber view technique: (1) Axial plane through the fetal chest; (2) Heart should occupy <1/3 of the chest area; (3) Apex points left at ~45° (levocardia); (4) Two atria and two ventricles equal in size; (5) Foramen ovale flap opens into the left atrium; (6) Moderator band is in the right ventricle (RV identification).
Pearl: The 3-vessel and trachea (3VT) view: normal PA > Ao > SVC, all in a straight line to the left of the trachea. Abnormalities: (1) Vascular ring (double aortic arch — vessels on both sides of trachea); (2) Right aortic arch (aorta to the right of trachea); (3) Absent PA or Ao; (4) Persistent left SVC (4 vessels instead of 3).`,
      pitfalls: `VSDs are the most common congenital heart defect and may be missed on routine 4CV if small. The LVOT and RVOT views are essential for detecting outflow tract abnormalities (TGA, TOF, truncus arteriosus). Color Doppler improves sensitivity for VSD and outflow tract abnormalities.`,
    },
    abdomen: {
      description: ``,
      howToGet: `Patient Positioning: Supine. The abdominal circumference (AC) measurement requires a true axial plane through the fetal abdomen at the level of the stomach and portal vein. Oblique planes will overestimate the AC.
Transducer Positioning: Axial plane at the level of the stomach and portal vein (J-shaped portal vein) for AC measurement. Sagittal and transverse planes for kidneys. Axial plane for cord insertion. Color Doppler for umbilical cord vessels (2 arteries + 1 vein = normal).
What to Assess: Stomach (present, normal size, left side — absence suggests esophageal atresia); kidneys (present, normal echogenicity, renal pelvis ≤10 mm AP diameter); urinary bladder (present); cord insertion (normal, no omphalocele/gastroschisis); umbilical cord (3 vessels — 2 arteries + 1 vein); bowel (non-dilated, non-echogenic).`,
      tips: `Scanning Tip: AC measurement technique: (1) True axial plane at the level of the stomach and J-shaped portal vein; (2) Spine visible posteriorly; (3) Ribs symmetric; (4) Measure the outer perimeter of the abdomen (outer-to-outer); (5) Use the ellipse function or average of two perpendicular diameters. AC is the most sensitive biometric parameter for FGR.
Pearl: Echogenic bowel (as echogenic as bone) is a soft marker for cystic fibrosis, T21, CMV infection, fetal swallowed blood, and FGR. Grade 1 (slightly echogenic) is a normal variant; Grade 2 (as echogenic as liver) warrants follow-up; Grade 3 (as echogenic as bone) requires further evaluation (amniocentesis, TORCH screen, CF testing).`,
      pitfalls: `Pyelectasis ≥4 mm before 28 weeks and ≥7 mm after 28 weeks is a soft marker for T21 and warrants follow-up. Isolated pyelectasis <10 mm is usually physiological and resolves postnatally. Pyelectasis ≥10 mm (hydronephrosis) requires postnatal follow-up and urology referral.`,
    },
    spine: {
      description: ``,
      howToGet: `Patient Positioning: Supine. The spine is best assessed when the fetal back is posterior (facing the transducer). If the fetal back is anterior, the spine is obscured by the ribs and vertebral bodies — wait for fetal movement or reposition the patient.
Transducer Positioning: Three planes required: (1) Sagittal — longitudinal view of the entire spine from cervical to sacral; (2) Coronal — parallel lines of posterior elements; (3) Axial — each vertebral level shows three ossification centers (vertebral body + two posterior elements) forming a closed ring. Assess the overlying skin for integrity.
What to Assess: Cervical, thoracic, lumbar, and sacral spine: intact posterior elements; closed skin overlying the spine; normal curvature (no kyphosis/scoliosis); conus medullaris (normally at L2–L3 level by 20 weeks); no mass or meningocele; sacrum (present — absent sacrum suggests sacral agenesis/caudal regression syndrome).`,
      tips: `Scanning Tip: Open spina bifida (myelomeningocele) signs: (1) Lemon sign (frontal bone scalloping in axial head view); (2) Banana sign (cerebellum pulled anteriorly, obliterating the cisterna magna); (3) Posterior element defect with skin disruption in the sagittal view; (4) Ventriculomegaly (secondary to Chiari II). The lemon and banana signs are present in >95% of open spina bifida cases at 16–24 weeks.
Pearl: Closed spina bifida (skin-covered) does not produce lemon/banana signs and is much harder to detect on routine ultrasound. Clues include: a skin-covered mass over the spine, tethered conus medullaris (below L3), and lower limb abnormalities. Fetal MRI is more sensitive for closed spinal dysraphism.`,
      pitfalls: ``,
    },
    extremities: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Systematically assess all four limbs. Fetal movement may be needed to visualize all extremities.
Transducer Positioning: Long-axis plane for femur length (FL) and humerus length (HL) measurement. Axial planes for hands and feet. Assess each limb: upper arm (humerus), forearm (radius/ulna), hand (digits); thigh (femur), lower leg (tibia/fibula), foot (digits).
What to Assess: Four limbs present; long bone lengths (FL, HL normal for GA); bone echogenicity and shape (normal = straight, echogenic with acoustic shadow); hands (open/closed, digits present, polydactyly/syndactyly); feet (normal position — clubfoot = foot perpendicular to tibia in same plane); digits (count when possible).`,
      tips: `Scanning Tip: Femur length (FL) measurement: (1) Long-axis plane with the femur horizontal; (2) Measure the ossified diaphysis only (not the epiphyseal cartilage); (3) Both ends of the femur should be visible; (4) The femur should be at a 45° angle to the ultrasound beam for best measurement. Short femur (<5th percentile for GA) is a soft marker for T21 and skeletal dysplasia.
Pearl: Clubfoot (talipes equinovarus): the foot is seen in the same plane as the tibia/fibula (normally the foot is perpendicular and cannot be seen in the same plane as the lower leg). Isolated clubfoot has a good prognosis; clubfoot associated with other anomalies (spina bifida, trisomy 18) has a worse prognosis.`,
      pitfalls: ``,
    },
    placenta: {
      description: ``,
      howToGet: `Patient Positioning: Supine for TA assessment. TVS with empty bladder for cervical os assessment when placenta previa is suspected. TVS is more accurate than TA for measuring the distance from the placental edge to the internal os.
Transducer Positioning: TA: sagittal and transverse planes through the uterus to map the entire placenta. TVS: sagittal plane with the probe in the anterior fornix, angled toward the cervix — measure the distance from the placental edge to the internal os.
What to Assess: Placenta location (anterior, posterior, fundal, lateral); relationship to internal os (normal ≥20 mm from os; low-lying 1–19 mm; previa = covers os); appearance (normal = homogeneous; grade 0–III calcification; retroplacental clear zone); cord insertion (central, eccentric, marginal, velamentous); succenturiate lobe (risk of vasa previa); placental lakes (normal variant).`,
      tips: `Scanning Tip: Placenta previa: if the placenta appears low-lying on TA, always confirm with TVS — TVS is more accurate and safe. A placental edge-to-os distance ≥20 mm on TVS at 18–23 weeks predicts resolution of apparent previa in >95% of cases. Repeat TVS at 32–34 weeks if low-lying at 18–23 weeks.
Pearl: Vasa previa: fetal vessels run over the internal os (velamentous cord insertion or succenturiate lobe with connecting vessels). Risk of catastrophic fetal hemorrhage at membrane rupture. Color Doppler over the cervix is essential when a low-lying placenta, velamentous insertion, or succenturiate lobe is identified.`,
      pitfalls: `Placenta accreta spectrum (PAS): suspect when there is a low anterior placenta overlying a uterine scar (prior cesarean). Ultrasound signs: loss of retroplacental clear zone, placental lacunae (Swiss cheese appearance), thinning of the myometrium overlying the placenta, and bridging vessels on color Doppler.`,
    },
    amniotic_fluid: {
      description: ``,
      howToGet: `Patient Positioning: Supine. The amniotic fluid index (AFI) is measured with the patient supine and the uterus divided into four quadrants by the umbilicus (horizontal) and the linea nigra (vertical). The transducer is held perpendicular to the floor (not the maternal abdomen) for each measurement.
Transducer Positioning: AFI: measure the deepest vertical pocket in each of the four quadrants, avoiding the umbilical cord and fetal parts. The transducer is held perpendicular to the floor. Sum the four measurements. MVP: measure the single deepest pocket free of cord and fetal parts.
What to Assess: AFI: normal 8–24 cm (18–40 weeks); oligohydramnios <5 cm; borderline 5–8 cm; polyhydramnios >24 cm. MVP: normal 2–8 cm; oligohydramnios <2 cm; polyhydramnios >8 cm. MVP is preferred over AFI in many centers (lower false-positive rate for oligohydramnios).`,
      tips: `Scanning Tip: Oligohydramnios causes: (1) Fetal renal anomalies (bilateral renal agenesis, obstructive uropathy); (2) PPROM; (3) Uteroplacental insufficiency (FGR, post-dates). Polyhydramnios causes: (1) Fetal swallowing abnormalities (esophageal atresia, duodenal atresia); (2) Fetal diabetes (macrosomia); (3) Fetal anemia (hydrops); (4) Idiopathic (50%).
Pearl: The umbilical cord is often mistaken for a pocket of amniotic fluid. Always use color Doppler to confirm the absence of cord within the pocket being measured. A pocket containing cord should not be included in the AFI measurement.`,
      pitfalls: ``,
    },
    cervix_23: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    biometry: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Biometric measurements require specific standard planes — each measurement has a defined plane and caliper placement. Fetal position may require repositioning or waiting for fetal movement to obtain the correct plane.
Transducer Positioning: BPD/HC: axial plane at the level of the thalami and cavum septi pellucidi (transthalamic plane). AC: axial plane at the level of the stomach and J-shaped portal vein. FL: long-axis plane with the femur horizontal. HL: long-axis plane with the humerus horizontal.
What to Assess: BPD (outer-to-inner, leading edge to leading edge); HC (outer perimeter of the skull); AC (outer perimeter at the level of the stomach and portal vein); FL (ossified diaphysis only); HL (ossified diaphysis only). Estimated fetal weight (EFW) from Hadlock formula (BPD + HC + AC + FL).`,
      tips: `Scanning Tip: EFW calculation: the Hadlock formula using BPD + HC + AC + FL is the most widely used. EFW accuracy is ±15–20% (2 SD). SGA: EFW <10th percentile. FGR: EFW <10th percentile with abnormal Doppler (umbilical artery, MCA, ductus venosus) or AC <5th percentile. Serial biometry every 2–3 weeks is recommended for FGR surveillance.
Pearl: The AC is the most sensitive biometric parameter for detecting FGR. An AC <5th percentile has a sensitivity of ~80% for FGR. The HC/AC ratio is useful for distinguishing symmetric FGR (head and body equally small — early onset, chromosomal, infectious) from asymmetric FGR (head sparing — late onset, uteroplacental insufficiency).`,
      pitfalls: ``,
    },
    umbilical_cord: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  thyroid: {
    thyroid_trans_right: {
      description: ``,
      howToGet: `Patient Positioning: Supine with the neck hyperextended — place a pillow or rolled towel under the shoulders to extend the neck and bring the thyroid gland anteriorly. If the patient cannot tolerate full hyperextension (e.g., cervical arthritis), a semi-reclined position is acceptable.
Transducer Positioning: Begin at the superior pole of the right lobe and sweep inferiorly in the transverse plane through the superior, mid, and inferior thirds. The right lobe lies lateral to the trachea and anterior to the right carotid artery and internal jugular vein.
What to Assess: Lobe dimensions (AP × transverse at widest point); echogenicity (normal = homogeneous, isoechoic to adjacent strap muscle); any focal nodules (location, size, composition, echogenicity, margins, calcifications, vascularity); surrounding structures (carotid, IJV, strap muscles, trachea).`,
      tips: `Scanning Tip: Measure the right lobe AP and transverse dimensions in the transverse plane at its widest point. Normal thyroid lobe: 4–6 cm long, 1.5–2 cm AP, 1.5–2 cm transverse. Volume = 0.479 × length × width × depth (each lobe). Normal total volume: men <25 mL, women <18 mL.
Pearl: The right lobe is typically slightly larger than the left. The right inferior thyroid artery enters the posterior aspect of the right lobe and can be used to confirm the inferior pole. Always document the inferior pole — it may extend retrosternally.`,
      pitfalls: `The esophagus lies posterior-medial to the left lobe (occasionally posterior to the right). On transverse views, it appears as a round structure with a hyperechoic center (air). Do not mistake it for a parathyroid adenoma or lymph node — have the patient swallow to confirm.`,
    },
    thyroid_long_right: {
      description: ``,
      howToGet: `Patient Positioning: Supine with neck hyperextended. Rotate the transducer 90° from the transverse plane. Scan from the medial to lateral aspect of the right lobe in three sweeps: medial (near trachea), mid, and lateral.
Transducer Positioning: Longitudinal plane, parallel to the long axis of the right lobe. The lobe appears as an oval/elongated structure with pointed superior and inferior poles. Measure the craniocaudal length in this plane.
What to Assess: Craniocaudal length of the right lobe (normal 4–6 cm); superior and inferior pole definition; any nodules (measure in three planes in the view where the nodule is largest); pyramidal lobe (midline, superior to isthmus — present in ~50% of patients).`,
      tips: `Scanning Tip: Always measure the craniocaudal length in the longitudinal plane — this is the most accurate dimension for volume calculation. Ensure both poles are visible in the same image. If the inferior pole extends below the clavicle, document substernal extension and note the depth.
Pearl: The pyramidal lobe is a remnant of the thyroglossal duct and extends superiorly from the isthmus (usually to the left of midline). It is present in ~50% of patients and may be enlarged in Graves' disease. Do not mistake it for a midline neck mass.`,
      pitfalls: ``,
    },
    thyroid_trans_left: {
      description: ``,
      howToGet: `Patient Positioning: Supine with neck hyperextended. Mirror the right lobe technique. The left lobe lies lateral to the trachea and anterior to the left carotid artery and IJV. The esophagus is typically posterior-medial to the left lobe.
Transducer Positioning: Transverse plane, sweeping from superior to inferior through the left lobe. Identify the left carotid artery and IJV as landmarks. The esophagus is posterior-medial to the left lobe.
What to Assess: Same as right lobe: dimensions, echogenicity, nodules, vascularity. Compare symmetry with right lobe. Assess the posterior aspect carefully for parathyroid adenomas (oval, hypoechoic structures posterior to the lobe, <1 cm normally).`,
      tips: `Scanning Tip: The left recurrent laryngeal nerve runs in the tracheoesophageal groove — a critical surgical landmark. Nodules in the posterior medial aspect of the left lobe are at higher risk for RLN involvement. Document the relationship of any posterior nodule to the tracheoesophageal groove.`,
      pitfalls: `The esophagus posterior to the left lobe can be mistaken for a parathyroid adenoma or lymph node. Have the patient swallow — the esophagus will move and show peristalsis, confirming its identity. A true parathyroid adenoma will not move with swallowing.`,
    },
    thyroid_long_left: {
      description: ``,
      howToGet: `Patient Positioning: Supine with neck hyperextended. Longitudinal plane through the left lobe, medial to lateral sweeps. Measure craniocaudal length at the longest dimension.
Transducer Positioning: Longitudinal plane, parallel to the long axis of the left lobe. Three sweeps: medial (near trachea/esophagus), mid, and lateral. Identify the left carotid artery in the lateral sweep as a landmark.
What to Assess: Craniocaudal length; superior and inferior pole definition; any nodules (measure in three planes); pyramidal lobe (if present, arises from the isthmus and extends superiorly, typically to the left of midline).`,
      tips: `Scanning Tip: For any nodule identified, document: location (lobe, pole, isthmus), size in three planes, ACR TI-RADS category (composition, echogenicity, shape, margin, echogenic foci), and vascularity on color Doppler. Standardized reporting facilitates consistent follow-up recommendations.`,
      pitfalls: ``,
    },
    thyroid_isthmus: {
      description: ``,
      howToGet: `Patient Positioning: Supine with neck hyperextended. The isthmus is the bridge of thyroid tissue connecting the right and left lobes, lying anterior to the trachea at the level of the 2nd–4th tracheal rings.
Transducer Positioning: Transverse plane at the midline, anterior to the trachea. Measure the AP thickness of the isthmus. Normal isthmus thickness: <3 mm. Scan in longitudinal plane to assess for pyramidal lobe extending superiorly.
What to Assess: Isthmus thickness (AP dimension in transverse plane); any focal nodules; pyramidal lobe (extends superiorly from isthmus, present in ~50%); Delphian lymph node (prelaryngeal node — if enlarged, may indicate papillary thyroid cancer or Hashimoto's thyroiditis).`,
      tips: `Pearl: Isthmus thickness >3 mm is considered enlarged. Diffuse isthmus enlargement is seen in Hashimoto's thyroiditis and Graves' disease. A focal isthmus nodule should be characterized with the same TI-RADS criteria as lobe nodules. Isthmus nodules may be more palpable than lobe nodules.`,
      pitfalls: ``,
    },
    thyroid_nodule: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    parathyroid: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    thyroid_doppler: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    thyroid_lymph_nodes: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  scrotum: {
    scrotum_survey: {
      description: ``,
      howToGet: `Patient Positioning: Supine with the scrotum supported on a towel draped between the thighs. The penis should be retracted superiorly and taped to the abdomen. This position stabilizes the scrotum and allows bilateral comparison. Use copious warm gel to minimize patient discomfort.
Transducer Positioning: Begin with a split-screen transverse view of both testes simultaneously to compare size, echogenicity, and vascularity side-by-side. This bilateral comparison is essential for detecting subtle asymmetry in echogenicity or blood flow, particularly in torsion.
What to Assess: Confirm presence of two testes; compare size, echogenicity, and vascularity bilaterally; identify any gross asymmetry in testicular size (>20% difference is significant); assess the epididymis bilaterally; identify any hydrocele, hematocele, or pyocele.`,
      tips: `Scanning Tip: Always perform a bilateral comparison scan first, before focusing on the symptomatic side. In torsion, the affected testis may appear normal in echogenicity early — the key finding is absent or markedly reduced blood flow on color Doppler compared to the contralateral testis. A unilateral finding is more significant than an absolute measurement.
Pearl: Normal testicular volume: 12–20 mL (length × width × depth × 0.71). Testicular atrophy is defined as volume <12 mL or >20% smaller than the contralateral testis. Prepubertal testes are smaller (1–2 mL) and have less vascularity — do not mistake reduced flow for torsion in a child.`,
      pitfalls: ``,
    },
    right_testis_trans: {
      description: ``,
      howToGet: `Patient Positioning: Supine with scrotum supported. Scan the right testis in the transverse plane from the superior pole to the inferior pole in a systematic sweep. Document superior, mid, and inferior thirds.
Transducer Positioning: Transverse plane, sweeping from superior to inferior pole. The testis is an oval structure with homogeneous medium-level echogenicity. The mediastinum testis is a hyperechoic linear structure running along the posterior aspect of the testis in the longitudinal plane.
What to Assess: Testicular size (measure AP and transverse in transverse plane); echogenicity (normal = homogeneous, medium-level); any focal lesions (location, size, echogenicity, vascularity, calcifications); tunica albuginea integrity; hydrocele; color Doppler vascularity (centripetal arteries from mediastinum testis).`,
      tips: `Scanning Tip: Measure the testis in three dimensions: length (longitudinal), width (transverse), and AP (transverse plane). Calculate volume = L × W × AP × 0.71. Document any focal lesion in three planes. Use power Doppler for better sensitivity to low-flow states. Always compare vascularity to the contralateral testis.
Pearl: The mediastinum testis is a hyperechoic band running along the posterior aspect of the testis. It contains the rete testis and efferent ductules. Cysts of the rete testis (tubular ectasia) appear as tubular anechoic structures in the mediastinum — a benign finding associated with prior vasectomy or epididymal obstruction.`,
      pitfalls: `Testicular microlithiasis (TM) is defined as ≥5 echogenic foci per transducer field without acoustic shadowing. Classic TM (≥5 foci) is associated with a slightly increased risk of testicular germ cell tumor, but routine biopsy is not recommended. Annual ultrasound surveillance is recommended for classic TM with risk factors (personal/family history of testicular cancer, cryptorchidism, atrophy).`,
    },
    right_testis_long: {
      description: ``,
      howToGet: `Patient Positioning: Supine with scrotum supported. Rotate the transducer 90° to the longitudinal plane. Scan from the medial to lateral aspect of the right testis in three sweeps: medial, mid, and lateral.
Transducer Positioning: Longitudinal plane, parallel to the long axis of the testis. Measure the craniocaudal length in this plane. The mediastinum testis is visible as a hyperechoic linear structure along the posterior aspect.
What to Assess: Craniocaudal length (normal 3–5 cm); mediastinum testis (posterior hyperechoic band); any focal lesions; testicular appendage (appendix testis — small oval structure at the superior pole, may be visible when surrounded by hydrocele); blood flow on color Doppler (centripetal arteries).`,
      tips: `Scanning Tip: The appendix testis (hydatid of Morgagni) is a small oval structure at the superior pole of the testis, visible when surrounded by a hydrocele. Torsion of the appendix testis causes acute scrotal pain and a 'blue dot sign' clinically. On ultrasound, it appears as a small hyperechoic nodule with absent vascularity at the superior pole.`,
      pitfalls: ``,
    },
    left_testis_trans: {
      description: ``,
      howToGet: `Patient Positioning: Supine with scrotum supported. Mirror the right testis technique. Always compare the left testis to the right in terms of size, echogenicity, and vascularity.
Transducer Positioning: Same as right testis. Transverse (superior to inferior) and longitudinal (medial to lateral) sweeps. Measure in three dimensions and calculate volume.
What to Assess: Same parameters as right testis. The left testis is typically slightly lower than the right due to the longer left spermatic cord. The left pampiniform plexus is more prone to varicocele formation due to the perpendicular drainage into the left renal vein.`,
      tips: `Pearl: Varicocele is more common on the left (85–95% of cases) due to the perpendicular drainage of the left gonadal vein into the left renal vein (vs. oblique drainage of the right into the IVC). A right-sided varicocele without a left-sided varicocele should raise suspicion for a retroperitoneal mass compressing the right gonadal vein — evaluate with abdominal ultrasound.`,
      pitfalls: ``,
    },
    left_testis_long: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    epididymis: {
      description: ``,
      howToGet: `Patient Positioning: Supine with scrotum supported. The epididymis lies along the posterolateral aspect of the testis. The head (caput) is at the superior pole, the body (corpus) runs along the posterior aspect, and the tail (cauda) is at the inferior pole.
Transducer Positioning: Scan the epididymis in longitudinal and transverse planes. The head is the most easily identified — it is isoechoic to slightly hyperechoic relative to the testis, and measures 10–12 mm in the normal adult. The body and tail are smaller (2–4 mm) and may be difficult to visualize unless enlarged.
What to Assess: Epididymal head size (normal ≤12 mm); echogenicity (normal = isoechoic to slightly hyperechoic vs. testis); any focal lesions (epididymal cysts, spermatoceles); vascularity on color Doppler; signs of epididymitis (enlargement, heterogeneous echogenicity, increased vascularity, reactive hydrocele, scrotal wall thickening).`,
      tips: `Scanning Tip: Epididymitis is the most common cause of acute scrotal pain in adults. Key ultrasound findings: enlarged, heterogeneous epididymis (head >12 mm), increased vascularity on color Doppler, reactive hydrocele, and scrotal wall thickening. The epididymis is affected first — testicular involvement (epididymo-orchitis) indicates more severe infection.
Pearl: Epididymal cysts and spermatoceles are the most common epididymal masses. Epididymal cysts are anechoic, thin-walled, and located anywhere in the epididymis. Spermatoceles are similar but contain low-level echoes (spermatozoa) and are typically located in the epididymal head. Both are benign and require no treatment unless symptomatic.`,
      pitfalls: ``,
    },
    scrotum_doppler: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  breast: {
    breast_survey: {
      description: ``,
      howToGet: `Patient Positioning: Supine with ipsilateral arm elevated above the head. For large or pendulous breasts, a slight oblique position (30–45°) flattens the lateral breast tissue against the chest wall, reducing tissue thickness and improving visualization.
Transducer Positioning: Begin at the nipple and scan in a systematic radial/anti-radial or transverse/longitudinal grid pattern. Cover all quadrants (UOQ, UIQ, LOQ, LIQ) and the retroareolar region. Extend coverage to the axillary tail.
What to Assess: Breast tissue composition (homogeneous fat, scattered fibroglandular, heterogeneous, extremely dense); skin thickness (normal <2 mm); Cooper ligaments; ductal architecture; symmetry between sides; any focal mass, asymmetry, or architectural distortion.`,
      tips: `Scanning Tip: Use light, consistent transducer pressure throughout — excessive pressure compresses lesions and reduces their apparent size. Apply enough gel to maintain full contact. Adjust focal zone to the depth of interest and use tissue harmonic imaging to improve contrast resolution.
Pearl: Radial/anti-radial scanning (parallel to ductal anatomy) is preferred by many breast imagers because ducts run radially from the nipple. This approach is more sensitive for intraductal pathology (DCIS, papilloma) than a grid pattern.`,
      pitfalls: `Fat lobules can mimic oval hypoechoic masses. Confirm by scanning in two orthogonal planes — fat lobules will be isoechoic to surrounding fat and show no posterior features. Compressibility and lack of internal vascularity also favor fat lobule.`,
    },
    breast_lesion: {
      description: ``,
      howToGet: `Patient Positioning: Supine, ipsilateral arm elevated. For lesions in the lateral breast, slight oblique positioning brings the lesion closer to the transducer. Document clock position, distance from nipple, and depth (anterior/middle/posterior third).
Transducer Positioning: Center the lesion in the field of view. Scan in two orthogonal planes (radial/anti-radial or transverse/sagittal). Measure in three orthogonal dimensions: longest diameter, perpendicular diameter, and depth.
What to Assess: BI-RADS descriptors — Shape (oval, round, irregular); Orientation (parallel = wider than tall, not parallel = taller than wide); Margin (circumscribed vs. not circumscribed: indistinct, angular, microlobulated, spiculated); Echo pattern (anechoic, hyperechoic, complex, hypoechoic, isoechoic, heterogeneous); Posterior features (no features, enhancement, shadowing, combined); Associated features (architectural distortion, duct changes, skin changes, edema, vascularity, elasticity).`,
      tips: `Scanning Tip: Taller-than-wide orientation (not parallel) is the single most suspicious BI-RADS feature on ultrasound — it indicates the lesion is growing across tissue planes rather than along them. Always measure orientation in the radial plane where the lesion appears largest.
Pearl: Posterior acoustic shadowing is the most specific feature for malignancy (especially IDC). Posterior enhancement is most common in cysts and some fibroadenomas but can also occur in mucinous carcinoma. Combined pattern (mixed shadowing and enhancement) is indeterminate.`,
      pitfalls: `Microlobulated margins (≥3 lobulations) are suspicious (BI-RADS 4B) and should not be confused with macrolobulated margins, which are a feature of fibroadenomas. Use high-frequency (≥15 MHz) to resolve margin detail accurately.`,
    },
    breast_cyst: {
      description: ``,
      howToGet: `Patient Positioning: Supine, ipsilateral arm elevated. Cysts are most commonly found in the upper outer quadrant and retroareolar region.
Transducer Positioning: Center the cyst in the field of view. Scan in two orthogonal planes. Apply light pressure — cysts are compressible.
What to Assess: Simple cyst criteria (all must be met): anechoic, circumscribed margins, imperceptible wall, posterior acoustic enhancement. Complicated cyst: homogeneous low-level internal echoes, no solid component. Complex cystic and solid mass: thick wall (>0.5 mm), thick internal septations, solid component, intracystic mass.`,
      tips: `Scanning Tip: Simple cysts are BI-RADS 2 (benign) — no follow-up needed. Complicated cysts are BI-RADS 3 (probably benign) — 6-month follow-up is appropriate. Complex cystic and solid masses are BI-RADS 4 and require tissue sampling. Use high-frequency and harmonic imaging to differentiate internal echoes from artifact.
Pearl: Clustered microcysts (multiple anechoic foci <2–3 mm each in a cluster) are BI-RADS 3 if no solid component. Milk of calcium in microcysts shows dependent layering on decubitus views — this is a benign finding (BI-RADS 2).`,
      pitfalls: `Echogenic debris in a cyst (from hemorrhage or infection) can mimic a solid mass. Use color Doppler — absence of internal vascularity supports a cystic diagnosis. Aspiration may be needed for definitive diagnosis in ambiguous cases.`,
    },
    breast_mass: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    breast_axilla: {
      description: ``,
      howToGet: `Patient Positioning: Supine with ipsilateral arm abducted and externally rotated (hand behind head). This opens the axilla and brings lymph nodes into view. Scan from the anterior axillary fold to the apex of the axilla.
Transducer Positioning: Longitudinal and transverse planes through the axilla. Follow the axillary vessels (axillary artery and vein) as a guide — lymph nodes cluster around these vessels at levels I, II, and III.
What to Assess: Node size (short axis diameter); cortical thickness (normal ≤3 mm); cortical morphology (uniform vs. focal thickening); fatty hilum (present = normal); shape (oval/reniform = normal; round = suspicious); vascularity (hilar = normal; peripheral/cortical = suspicious).`,
      tips: `Scanning Tip: The most reliable criterion for pathologic lymphadenopathy is cortical thickness >3 mm (focal or diffuse). Loss of the fatty hilum combined with a round shape and peripheral vascularity is highly suspicious for metastatic involvement. Always measure the short axis diameter and cortical thickness.
Pearl: In breast cancer staging, axillary lymph node status is the most important prognostic factor. Ultrasound-guided FNA or core biopsy of suspicious nodes (cortex >3 mm, absent hilum) can upstage patients and change surgical management (sentinel node biopsy vs. axillary dissection).`,
      pitfalls: `Reactive lymphadenopathy (from infection, vaccination, or inflammatory conditions) can mimic metastatic nodes. Clinical correlation is essential — recent ipsilateral COVID-19 vaccination is a common cause of axillary lymphadenopathy that should be documented and followed at 4–6 weeks.`,
    },
    breast_nipple: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    breast_implant: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  venous: {
    cfv: {
      description: ``,
      howToGet: `Transducer Positioning: Transverse plane at the inguinal ligament. The CFV lies medial to the common femoral artery. Identify the saphenofemoral junction where the great saphenous vein joins the CFV from the anteromedial aspect.
What to Assess: Complete compressibility of the CFV in transverse plane. Obtain spectral Doppler waveform — normal shows spontaneous, phasic flow with respiration and augmentation with distal compression. Absent phasicity suggests proximal (iliac/IVC) obstruction.`,
      tips: ``,
      pitfalls: ``,
    },
    fv: {
      description: ``,
      howToGet: `Transducer Positioning: Transverse plane, tracing the femoral vein from the CFV distally through the thigh. The FV (previously called superficial femoral vein) runs with the superficial femoral artery in the adductor (Hunter's) canal. Apply compression every 2 cm throughout its length.
What to Assess: Complete compressibility every 2 cm along the entire length of the FV. The FV is the most common site for DVT. Assess for echogenic thrombus, partial compressibility, or absent colour Doppler flow.`,
      tips: ``,
      pitfalls: ``,
    },
    dfv: {
      description: ``,
      howToGet: `Transducer Positioning: Transverse plane at the proximal thigh, where the DFV (profunda femoris vein) joins the FV. The DFV is typically only assessed at its proximal portion near the confluence. It is not routinely traced distally.
What to Assess: Compressibility at the DFV origin. Isolated DFV DVT is uncommon but clinically significant. Assess for echogenic thrombus extending from the FV into the DFV at the confluence.`,
      tips: ``,
      pitfalls: ``,
    },
    popliteal: {
      description: ``,
      howToGet: `Patient Positioning: The patient may be positioned prone with the knee slightly flexed, or seated with the legs dependent. The prone or lateral decubitus position provides optimal access to the popliteal fossa.
Transducer Positioning: Transverse plane in the popliteal fossa. The popliteal vein lies superficial (posterior) to the popliteal artery in this position. The small saphenous vein (SSV) joins the popliteal vein at the saphenopopliteal junction — assess this junction for SVT extension.
What to Assess: Complete compressibility of the popliteal vein. Obtain spectral Doppler waveform — augment with calf squeeze. Assess the saphenopopliteal junction for SVT. The popliteal vein is the second most common site for DVT.`,
      tips: ``,
      pitfalls: ``,
    },
    posterior_tibial: {
      description: ``,
      howToGet: `Patient Positioning: The patient is seated with the legs dependent or in the reverse Trendelenburg position. Dependent positioning maximises venous filling in the calf veins and improves visualisation.
Transducer Positioning: Transverse plane along the medial calf, posterior to the tibia. The posterior tibial veins (paired) run with the posterior tibial artery. Trace from the ankle to the popliteal fossa. Use a high-frequency linear transducer.
What to Assess: Compressibility of the paired posterior tibial veins throughout their course. Calf DVT (isolated distal DVT) carries a 15–25% risk of proximal propagation if untreated. Current AIUM and SVU guidelines recommend documenting calf vein assessment.`,
      tips: ``,
      pitfalls: ``,
    },
    peroneal: {
      description: ``,
      howToGet: `Patient Positioning: The patient is seated with the legs dependent or in the reverse Trendelenburg position. Dependent positioning maximises venous filling in the calf veins and improves visualisation.
Transducer Positioning: Transverse plane along the posterior/lateral calf, adjacent to the fibula. The peroneal veins (paired) run with the peroneal artery. They are the deepest of the calf veins and can be challenging to visualise in obese patients.
What to Assess: Compressibility of the paired peroneal veins. The peroneal veins are a common site for isolated calf DVT. Use colour Doppler and augmentation to confirm patency when direct compression is difficult due to patient habitus.`,
      tips: ``,
      pitfalls: ``,
    },
    great_saphenous: {
      description: ``,
      howToGet: `Transducer Positioning: Transverse plane at the saphenofemoral junction (SFJ) in the groin. The GSV joins the CFV anteromedially. Assess the proximal 10 cm of the GSV for superficial vein thrombosis (SVT) that may extend to or through the SFJ.
What to Assess: Compressibility at the SFJ and proximal GSV. SVT within 3 cm of the SFJ carries significant risk of DVT extension and may require anticoagulation per current AIUM and SVU guidelines. Document the distance of any thrombus from the SFJ.`,
      tips: ``,
      pitfalls: ``,
    },
    small_saphenous: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  arterial: {
    segmental_pressures: {
      description: ``,
      howToGet: `Patient Positioning: The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins.
Transducer Positioning: Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Digits (toes and fingers). Place cuffs snugly — a loose cuff overestimates the pressure.
What to Assess: Segmental or digital blood pressure readings, Doppler waveforms at each level, return of blood flow as cuff deflates. A pressure gradient >20 mmHg between adjacent segments indicates significant disease at that level.`,
      tips: ``,
      pitfalls: ``,
    },
    cw_doppler: {
      description: ``,
      howToGet: `Patient Positioning: The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins.
Transducer Positioning: Common femoral, superficial femoral, popliteal, posterior tibial, dorsalis pedis (lower extremity); Subclavian, axillary, brachial, radial, ulnar (upper extremity). Maintain a consistent Doppler angle throughout the examination.
What to Assess: Arterial waveforms at each level — normal is triphasic (high-resistance). Biphasic waveforms indicate mild-moderate disease; monophasic indicates severe disease or proximal occlusion. Always compare bilaterally.`,
      tips: ``,
      pitfalls: ``,
    },
    pvr: {
      description: ``,
      howToGet: `Patient Positioning: The examination is best performed in a warm room to minimize the effects of peripheral vasoconstriction. The patient should be recumbent and ideally acclimatized for at least 10–15 minutes before testing begins.
Transducer Positioning: Upper thigh, lower thigh, calf, ankle, metatarsals (lower extremity); Upper arm, upper forearm, above the wrist (upper extremity); Toes and digits. Cuffs are inflated to 65 mmHg for PVR recording.
What to Assess: Global tissue perfusion at each level. Normal PVR shows a sharp upstroke, clear peak, and dicrotic notch. Flattened waveforms indicate reduced perfusion. PVRs are particularly useful when arteries are non-compressible due to calcification.`,
      tips: ``,
      pitfalls: ``,
    },
    abi: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    exercise_abi: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  abdominal_vascular: {
    portal_vein_main: {
      description: ``,
      howToGet: `Patient Positioning: Supine; left lateral decubitus (LLD) position improves intercostal access. Ask patient to hold deep inspiration to move liver inferiorly for subcostal windows.
Transducer Positioning: Transverse or oblique subcostal approach at the porta hepatis; angle superiorly toward the liver hilum. Intercostal approach (right 8th–10th ICS) if subcostal is limited.
What to Assess: Main portal vein (MPV) diameter at the porta hepatis; color Doppler flow direction (hepatopetal = normal); spectral Doppler waveform and mean velocity (normal 15–40 cm/s); assess for portal vein thrombosis.`,
      tips: `Scanning Tip: Measure MPV diameter in transverse at the porta hepatis, perpendicular to the vessel. A diameter >13 mm suggests portal hypertension. Always confirm flow direction with color Doppler before spectral sampling — color box orientation can be misleading.
Pearl: Hepatofugal portal flow (away from liver) is pathognomonic of portal hypertension. A flat, non-phasic waveform or velocity <12 cm/s also indicates elevated portal pressure.`,
      pitfalls: `Respiratory variation can cause the portal vein waveform to appear pulsatile in normal patients. True pathologic pulsatility (from right heart failure or tricuspid regurgitation) shows a more pronounced, synchronized pulsatile pattern.`,
    },
    hepatic_veins: {
      description: ``,
      howToGet: `Patient Positioning: Supine or slight left lateral decubitus. Subcostal approach angled superiorly toward the IVC confluence, or intercostal approach from the right side.
Transducer Positioning: Subcostal or intercostal, angled superiorly toward the diaphragm and IVC. All three hepatic veins (right, middle, left) converge at the IVC — use this as the landmark.
What to Assess: Hepatic vein diameter and patency; spectral Doppler waveform morphology (normal = triphasic with S, D, and A waves); assess for Budd-Chiari syndrome (absent/reversed flow, thrombus); IVC patency at hepatic vein confluence.`,
      tips: `Scanning Tip: The triphasic hepatic vein waveform reflects right heart phasicity. Loss of the A-wave reversal (biphasic) or a flat monophasic waveform suggests hepatic congestion, cirrhosis, or Budd-Chiari syndrome. Always obtain waveforms from all three hepatic veins.
Pearl: Caudate lobe hypertrophy is a classic finding in Budd-Chiari syndrome — the caudate lobe has independent venous drainage directly into the IVC and is spared from congestion.`,
      pitfalls: `The right hepatic vein can be mistaken for the right portal vein — confirm by tracing the vessel to the IVC (hepatic vein) vs. the portal hilum (portal vein). Color Doppler direction also differs: hepatic veins drain toward the IVC (away from liver parenchyma).`,
    },
    hepatic_artery: {
      description: ``,
      howToGet: `Patient Positioning: Supine; oblique subcostal approach along the hepatoduodenal ligament. LLD position may improve visualization.
Transducer Positioning: Transverse/oblique at the porta hepatis. The hepatic artery runs alongside the portal vein and common bile duct (portal triad). Use color Doppler to identify the pulsatile arterial signal within the triad.
What to Assess: Hepatic artery patency; spectral Doppler waveform (low-resistance, continuous forward diastolic flow); resistive index (RI) 0.55–0.70; PSV 60–100 cm/s; post-transplant: assess for stenosis (PSV >200 cm/s) or thrombosis (absent flow).`,
      tips: `Scanning Tip: In post-transplant patients, always document the hepatic artery RI. An RI >0.80 suggests rejection or stenosis; RI <0.50 suggests an AV fistula or post-stenotic dilation. Absent diastolic flow (RI approaching 1.0) is a surgical emergency.
Pearl: The 'Mickey Mouse sign' in transverse at the porta hepatis shows the portal vein (large circle), hepatic artery (small left circle), and common bile duct (small right circle). This is the most reliable landmark for hepatic artery identification.`,
      pitfalls: `The hepatic artery is tortuous and may be difficult to sample at a consistent angle. Use the highest PSV obtained along the accessible course and document the angle used. Avoid angles >60° for velocity measurements.`,
    },
    splenic_vein: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    smv: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    tips_bmode: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    tips_spectral: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    tips_portal: {
      description: ``,
      howToGet: `Patient Positioning: Supine; subcostal or right intercostal approach. The main portal vein is best visualized in the porta hepatis.
Transducer Positioning: Oblique subcostal approach along the long axis of the portal vein. Place the sample volume in the main portal vein proximal to the TIPS stent entry point.
What to Assess: Main portal vein PSV (≥30 cm/s post-TIPS indicates adequate decompression); flow direction (hepatopetal or hepatofugal); portal vein diameter (should decrease post-TIPS if adequately decompressed); assess for portal vein thrombosis.`,
      tips: `Scanning Tip: A main portal vein PSV <20 cm/s post-TIPS is a reliable indicator of shunt dysfunction. Compare to the patient's own post-procedure baseline — a decrease of >50 cm/s from baseline is more clinically significant than the absolute value alone.
Pearl: Successful TIPS decompression typically results in: (1) increased portal vein velocity, (2) decreased portal vein diameter, (3) resolution of varices on follow-up imaging, and (4) decreased spleen size over weeks to months. These indirect signs support adequate shunt function even when direct stent velocities are borderline.`,
      pitfalls: ``,
    },
    tips_hepatic: {
      description: ``,
      howToGet: `Patient Positioning: Supine or slight left lateral decubitus. Subcostal approach angled superiorly toward the IVC confluence, or intercostal approach from the right side.
Transducer Positioning: Subcostal or intercostal, angled superiorly toward the diaphragm and IVC. All three hepatic veins (right, middle, left) converge at the IVC — use this as the landmark.
What to Assess: Hepatic vein diameter and patency; spectral Doppler waveform morphology (normal = triphasic with S, D, and A waves); assess for Budd-Chiari syndrome (absent/reversed flow, thrombus); IVC patency at hepatic vein confluence.`,
      tips: `Scanning Tip: The triphasic hepatic vein waveform reflects right heart phasicity. Loss of the A-wave reversal (biphasic) or a flat monophasic waveform suggests hepatic congestion, cirrhosis, or Budd-Chiari syndrome. Always obtain waveforms from all three hepatic veins.
Pearl: Caudate lobe hypertrophy is a classic finding in Budd-Chiari syndrome — the caudate lobe has independent venous drainage directly into the IVC and is spared from congestion.`,
      pitfalls: `The right hepatic vein can be mistaken for the right portal vein — confirm by tracing the vessel to the IVC (hepatic vein) vs. the portal hilum (portal vein). Color Doppler direction also differs: hepatic veins drain toward the IVC (away from liver parenchyma).`,
    },
    sma: {
      description: ``,
      howToGet: `Patient Positioning: Supine; right lateral decubitus position if bowel gas obscures the SMA origin. Gentle transducer pressure and deep inspiration can displace bowel gas.
Transducer Positioning: Midline epigastric, transverse to identify the SMA in cross-section (round structure anterior to the aorta), then rotate to longitudinal. The SMA arises from the anterior aorta at approximately the L1 level, 1–2 cm below the celiac axis.
What to Assess: SMA patency; fasting waveform (high-resistance triphasic); PSV at origin (normal <275 cm/s); EDV (normal <45 cm/s); PSV ratio SMA/aorta >3.0 suggests significant stenosis.`,
      tips: `Scanning Tip: The fasting SMA has a high-resistance triphasic waveform (similar to peripheral arteries) with minimal or reversed diastolic flow. Obtain PSV within 1 cm of the aortic origin — this is the most sensitive site for detecting stenosis. Maintain Doppler angle ≤60°.
Pearl: PSV >275 cm/s OR EDV >45 cm/s at the SMA origin (fasting) indicates ≥70% stenosis per SVU criteria. Both criteria must be evaluated — EDV elevation is particularly specific for high-grade stenosis.`,
      pitfalls: `Bowel gas is the primary technical limitation for mesenteric duplex. If the SMA origin cannot be visualized, document this clearly and note the technical limitation. Do not estimate velocities from a suboptimal angle.`,
    },
    celiac: {
      description: ``,
      howToGet: `Patient Positioning: Supine; deep inspiration moves the liver inferiorly and may improve celiac axis visualization. The celiac axis is best seen in the epigastric region.
Transducer Positioning: Midline epigastric, transverse to identify the 'seagull sign' (celiac trifurcation), then rotate to longitudinal. The celiac axis arises from the anterior aorta at T12–L1, just above the SMA origin.
What to Assess: Celiac axis patency; low-resistance waveform (continuous forward diastolic flow); PSV at origin (normal <200 cm/s); assess for median arcuate ligament compression (MALS) — PSV increases on expiration.`,
      tips: `Scanning Tip: The 'seagull sign' in transverse view identifies the celiac trifurcation — the celiac body and its two main branches (splenic and common hepatic arteries) form the shape of a seagull in flight. This is the most reliable landmark for the celiac axis.
Pearl: For MALS assessment, obtain celiac axis PSV in both deep inspiration and expiration. A PSV that is significantly higher on expiration (>200 cm/s) and normalizes on inspiration suggests MALS rather than atherosclerotic stenosis.`,
      pitfalls: `The celiac axis is often calcified in older patients, causing acoustic shadowing that obscures the lumen. Use color Doppler to identify flow around calcified plaques and obtain spectral samples distal to the calcification.`,
    },
    ima: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_artery_right: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_artery_left: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_parenchyma_right: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_parenchyma_left: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_vein_right: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_vein_left: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    renal_resistive_index: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    intrarenal_doppler: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  aorta: {
    proximal_aorta_long: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization by displacing overlying bowel gas away from the midline.
Transducer Positioning: Subxiphoid, sagittal plane — angle superiorly to visualize the aorta as it passes through the diaphragmatic hiatus. The proximal aorta is identified just below the xiphoid process.
What to Assess: Visualize the aorta as it passes through the diaphragm. Assess for plaque, thrombus, or dissection. Note the relationship to the celiac axis origin.`,
      tips: ``,
      pitfalls: ``,
    },
    proximal_aorta_trans: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Subxiphoid, transverse plane — sweep inferiorly from the diaphragm to identify the celiac axis and superior mesenteric artery origins. The aorta appears as a round pulsatile structure anterior to the spine.
What to Assess: Visualize the celiac and superior mesenteric arteries. Assess for plaque, thrombus, or dissection. Measure the anteroposterior and transverse diameters.`,
      tips: ``,
      pitfalls: ``,
    },
    mid_aorta_long: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Mid-abdomen, sagittal plane — at the level of the umbilicus. The renal arteries arise from the lateral walls of the aorta at approximately L1–L2.
What to Assess: Visualize the aorta at the level of the renal arteries. Assess for plaque, thrombus, or dissection. This is the most common level for AAA formation.`,
      tips: ``,
      pitfalls: ``,
    },
    mid_aorta_trans: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Mid-abdomen, transverse plane — rotate 90° from the sagittal view. The left renal vein is a useful landmark, crossing anterior to the aorta at the level of the renal arteries.
What to Assess: Visualize the renal arteries branching off the aorta. Assess for plaque, thrombus, or dissection. Measure the maximum transverse diameter.`,
      tips: ``,
      pitfalls: ``,
    },
    distal_aorta_long: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Lower abdomen, sagittal plane — trace the aorta inferiorly from the mid-abdomen to the bifurcation. The bifurcation typically occurs at the L4 level, just below the umbilicus.
What to Assess: Visualize the aorta to the bifurcation. Assess for plaque, thrombus, or dissection. The distal aorta is a common site for AAA extension.`,
      tips: ``,
      pitfalls: ``,
    },
    distal_aorta_trans: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Lower abdomen, transverse plane — follow the aorta to where it divides into the two common iliac arteries. The bifurcation appears as a 'Y' shape in the transverse view.
What to Assess: Visualize the aortic bifurcation into the common iliac arteries. Assess for plaque, thrombus, or dissection. Note any extension of AAA into the iliac arteries.`,
      tips: ``,
      pitfalls: ``,
    },
    iliac_arteries: {
      description: ``,
      howToGet: `Patient Positioning: The patient should be in a supine position. A left lateral decubitus (LLD) or right lateral decubitus (RLD) position may be used as needed to improve visualization.
Transducer Positioning: Just inferior to the aortic bifurcation, sagittal oblique plane — angle obliquely to follow each common iliac artery laterally. Normal common iliac artery diameter is <1.5 cm.
What to Assess: Visualize the proximal common iliac arteries. Assess for aneurysmal dilation (>1.5 cm is considered aneurysmal). Color Doppler confirms patency.`,
      tips: ``,
      pitfalls: ``,
    },
    aorta_doppler: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  carotid: {
    cca: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    carotid_bifurcation: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    ica: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    eca: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    vertebral: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    subclavian: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  tcd: {
    transtemporal: {
      description: ``,
      howToGet: `Patient Positioning: Patient supine with head in neutral position or slight contralateral rotation. The transtemporal window is located at the thinnest portion of the temporal bone (pterion), cephalad to the zygomatic arch and anterior to the ear. Scan bilaterally for comparison.
Transducer Positioning: Place the transducer at the temporal window (just above the zygomatic arch, anterior to the ear). Angle slightly superiorly and medially. The ipsilateral cerebral peduncle (butterfly-shaped hyperechoic structure) is the key landmark for identifying the circle of Willis.
What to Assess: Middle Cerebral Artery (MCA): depth 45–65 mm, flow toward probe (positive), normal mean velocity 55–80 cm/s. Anterior Cerebral Artery (ACA): depth 60–75 mm, flow away from probe (negative). Posterior Cerebral Artery (PCA): P1 segment toward probe, P2 away; depth 60–70 mm. Assess for asymmetry, elevated velocities (vasospasm), or absent flow.`,
      tips: `Scanning Tip: The MCA is the most reliably insonated vessel via the transtemporal window. Start at depth 50–55 mm and optimize the signal before moving to other vessels. Use color Doppler to confirm vessel identity before spectral sampling. Always obtain bilateral MCA velocities for comparison.
Pearl: MCA mean velocity >120 cm/s with Lindegaard ratio >3 indicates vasospasm after subarachnoid hemorrhage. Lindegaard ratio = MCA mean velocity ÷ extracranial ICA mean velocity; ratio >3 = mild vasospasm, >6 = severe vasospasm. This distinguishes true vasospasm from hyperemia.`,
      pitfalls: `Up to 10–15% of adults (higher in elderly, women, and African Americans) have inadequate temporal bone windows. If no signal is obtained, try a more anterior or posterior position along the temporal squama. Document the window quality in the report.`,
    },
    transorbital: {
      description: ``,
      howToGet: `Patient Positioning: Patient supine with eyes closed. Apply gel to the closed eyelid. Use the minimum acoustic output necessary (MI <0.23 per AIUM guidelines) to minimize ocular exposure. Limit orbital scanning time to the minimum required.
Transducer Positioning: Place the transducer gently on the closed eyelid. Angle slightly medially to insonate the ophthalmic artery (OA) at depth 40–60 mm. Increase depth to 60–80 mm for the ICA siphon (carotid siphon).
What to Assess: Ophthalmic artery (OA): depth 40–60 mm, flow toward probe (positive), normal PSV 20–40 cm/s. ICA siphon: depth 60–80 mm, bidirectional flow. Reversed OA flow (away from probe) is a sign of ipsilateral severe ICA stenosis/occlusion with collateral flow reversal.`,
      tips: `Scanning Tip: Reversed ophthalmic artery flow is a critical finding indicating severe ipsilateral ICA disease with collateral supply from the contralateral ICA via the anterior communicating artery. Always compare OA flow direction bilaterally.`,
      pitfalls: `CRITICAL: Reduce acoustic output to MI <0.23 BEFORE placing the transducer on the eye. Do NOT use standard cardiac or abdominal presets for orbital scanning — these have much higher output levels that can cause thermal injury to the lens. Use a dedicated ophthalmic or TCD preset.`,
    },
    suboccipital: {
      description: ``,
      howToGet: `Patient Positioning: Patient seated with neck flexed (chin to chest), or lateral decubitus with neck flexed. The suboccipital window is located at the foramen magnum, between the occiput and C1 spinous process. This window provides access to the vertebral arteries (VA) and basilar artery (BA).
Transducer Positioning: Place the transducer at the suboccipital midline, angled superiorly toward the foramen magnum. The basilar artery is at depth 80–120 mm (flow away from probe). The vertebral arteries are at depth 60–80 mm, lateral to midline (flow away from probe).
What to Assess: Basilar artery (BA): depth 80–120 mm, flow away from probe, normal mean velocity 35–60 cm/s. Vertebral arteries (VA): depth 60–80 mm, flow away from probe, normal mean velocity 35–55 cm/s. Assess for asymmetry, absent flow (VA occlusion), or elevated velocities.`,
      tips: `Scanning Tip: The basilar artery is identified by its midline position and depth >80 mm. The vertebral arteries are lateral to the midline. Absent or reversed VA flow on one side with normal contralateral VA suggests VA occlusion or subclavian steal syndrome.
Pearl: Subclavian steal syndrome: reversed VA flow ipsilateral to a proximal subclavian artery stenosis/occlusion. The VA flow reversal may be intermittent (latent steal) or continuous (manifest steal). Provocative testing (arm exercise or reactive hyperemia) can unmask latent steal.`,
      pitfalls: ``,
    },
    submandibular: {
      description: ``,
      howToGet: `Patient Positioning: Patient supine with neck slightly extended and head rotated contralaterally. The submandibular window is located beneath the angle of the mandible. This window provides access to the distal extracranial ICA and the proximal intracranial ICA.
Transducer Positioning: Place the transducer beneath the angle of the mandible, angled superiorly and medially. The distal ICA is at depth 40–60 mm (flow toward probe). This window is used to obtain the extracranial ICA velocity for the Lindegaard ratio calculation.
What to Assess: Distal extracranial ICA: depth 40–60 mm, flow toward probe, normal PSV 40–80 cm/s. Used to calculate the Lindegaard ratio (MCA/ICA mean velocity) for vasospasm assessment. Also used to assess ICA patency in patients with poor temporal windows.`,
      tips: `Scanning Tip: The submandibular ICA velocity is required for accurate Lindegaard ratio calculation. Without the extracranial ICA velocity, elevated MCA velocities cannot be reliably distinguished from hyperemia vs. true vasospasm. Always obtain bilateral submandibular ICA velocities in SAH patients.
Pearl: Lindegaard Ratio interpretation: <3 = normal or hyperemia; 3–6 = mild-moderate vasospasm; >6 = severe vasospasm. A ratio <3 with elevated MCA velocity indicates global hyperemia (e.g., from fever, anemia, or hyperdynamic state), NOT vasospasm.`,
      pitfalls: ``,
    },
    tcd_emboli: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  msk: {
    shoulder: {
      description: ``,
      howToGet: `Patient Positioning: Seated on a stool or examination table with the arm at the side (neutral rotation). For the rotator cuff interval and long head of biceps: arm in neutral. For supraspinatus: arm in modified Crass position (hand on ipsilateral hip, elbow pointing posteriorly) to bring the tendon out from under the acromion. For infraspinatus/teres minor: arm across the chest (internal rotation). For subscapularis: arm externally rotated, then dynamically assess with internal/external rotation.
Transducer Positioning: Biceps tendon (LHB): transverse at the bicipital groove, then longitudinal. Subscapularis: transverse with arm externally rotated. Supraspinatus: longitudinal (coronal oblique) and transverse in modified Crass position. Infraspinatus/teres minor: posterior approach, longitudinal and transverse. Subacromial-subdeltoid (SASD) bursa: longitudinal over the supraspinatus. AC joint: longitudinal over the AC joint.
What to Assess: LHB tendon (tenosynovitis, subluxation, tear, rupture); subscapularis tendon (partial/full-thickness tear, calcific tendinopathy); supraspinatus tendon (partial/full-thickness tear — critical zone 1 cm from insertion; calcific tendinopathy); infraspinatus/teres minor (posterior cuff tear); SASD bursa (effusion >2 mm, thickening >2 mm, bursitis); AC joint (osteoarthritis, osteophytes, effusion); glenohumeral joint (posterior recess effusion >2 mm); dynamic impingement assessment.`,
      tips: `Scanning Tip: Anisotropy: always scan with the transducer perpendicular to the tendon fibers. Tendons appear hyperechoic when perpendicular and falsely hypoechoic (mimicking a tear) when the beam is angled. Heel-toe the transducer to maintain perpendicularity as the tendon curves over the humeral head. This is the most common pitfall in shoulder ultrasound.
Scanning Tip: Full-thickness rotator cuff tear: look for a focal defect (hypoechoic or anechoic gap) in the tendon extending from the articular to the bursal surface. The 'cartilage interface sign' (bare cartilage visible through the defect) confirms a full-thickness tear. Measure the tear size in two planes (AP and ML dimensions). Assess for retraction and muscle atrophy (fatty infiltration).
Pearl: Dynamic assessment: assess for dynamic subacromial impingement by asking the patient to abduct the arm while scanning longitudinally over the supraspinatus. Impingement is confirmed if the SASD bursa bunches up under the acromion during abduction. Also assess LHB tendon stability dynamically by rotating the arm — subluxation of the LHB out of the bicipital groove is diagnostic of a subscapularis tear.`,
      pitfalls: `Calcific tendinopathy: calcium deposits appear as hyperechoic foci with posterior acoustic shadowing. They can be focal (hard calcium) or diffuse (soft calcium — 'toothpaste' consistency). Soft calcium deposits may not shadow. Dynamic compression of soft calcium deposits with the transducer may cause them to move or extrude — this confirms soft calcium and predicts response to barbotage.`,
    },
    elbow: {
      description: ``,
      howToGet: `Patient Positioning: Anterior: elbow extended, forearm supinated (palm up). Medial: elbow flexed 90°, forearm supinated. Lateral: elbow flexed 90°, forearm pronated. Posterior: elbow flexed 90°, forearm pronated on the examination table.
Transducer Positioning: Anterior: longitudinal and transverse over the distal biceps tendon and brachialis. Medial: longitudinal over the common flexor tendon (CFT) and ulnar collateral ligament (UCL); transverse over the ulnar nerve in the cubital tunnel. Lateral: longitudinal and transverse over the common extensor tendon (CET) and lateral collateral ligament complex. Posterior: longitudinal and transverse over the triceps tendon and olecranon bursa; transverse over the posterior joint recess.
What to Assess: Common extensor tendon (CET): lateral epicondyle insertion — partial/full-thickness tear, calcific tendinopathy (lateral epicondylitis/'tennis elbow'); Common flexor tendon (CFT): medial epicondyle insertion — partial/full-thickness tear (medial epicondylitis/'golfer's elbow'); Ulnar nerve: cubital tunnel — thickening (>3.5 mm cross-sectional area), subluxation with elbow flexion; UCL: medial stability; Distal biceps tendon: distal insertion at radial tuberosity — tear, tendinopathy; Olecranon bursa: effusion, thickening, calcification; Joint recess: effusion, loose bodies, synovitis.`,
      tips: `Scanning Tip: Lateral epicondylitis (tennis elbow): the CET origin at the lateral epicondyle is the most common site of pathology. Look for focal hypoechoic areas, tendon thickening, calcification, and cortical irregularity at the lateral epicondyle. Color Doppler shows neovascularity in active tendinopathy. The CET is best assessed with the elbow flexed 90° and the forearm pronated.
Pearl: Ulnar nerve subluxation: assess the ulnar nerve in the cubital tunnel dynamically with elbow flexion. The nerve should remain in the groove. Subluxation (nerve moves anterior to the medial epicondyle with flexion) is seen in ~16% of the population and may cause ulnar neuropathy. Measure the nerve cross-sectional area (CSA) — >10 mm² suggests cubital tunnel syndrome.`,
      pitfalls: `Distal biceps tendon: the tendon inserts on the radial tuberosity and is best seen with the elbow extended and forearm fully supinated. The 'cobra head' view (transverse at the radial tuberosity with forearm pronated) brings the insertion into view. A complete distal biceps tear causes the tendon to retract proximally — look for an empty bicipital tunnel and a 'clapper-in-bell' sign (retracted tendon within the bicipital aponeurosis).`,
    },
    wrist: {
      description: ``,
      howToGet: `Patient Positioning: Dorsal (posterior): wrist in neutral or slight flexion, palm down on the table. Volar (anterior): wrist in slight extension, palm up. Radial: wrist in neutral, thumb side up. Ulnar: wrist in neutral, little finger side up.
Transducer Positioning: Volar: transverse (carpal tunnel view) and longitudinal over the median nerve, flexor tendons, and flexor retinaculum. Dorsal: transverse and longitudinal over the extensor compartments (1–6), DRUJ, and dorsal radiocarpal ligaments. Radial: longitudinal over the 1st extensor compartment (APL, EPB) for de Quervain's. Ulnar: longitudinal over the ECU tendon and TFCC region.
What to Assess: Carpal tunnel: median nerve CSA (normal <10 mm² at the pisiform level; >15 mm² = CTS); flexor tendon tenosynovitis; Extensor compartments: 1st (APL/EPB — de Quervain's tenosynovitis), 2nd (ECRL/ECRB), 3rd (EPL — rupture in RA), 4th (EDC/EIP), 5th (EDM), 6th (ECU — subluxation, tendinopathy); TFCC region: DRUJ effusion, ECU tendon; Ganglion cysts: dorsal (scapholunate ligament origin) and volar (radioscaphoid joint origin).`,
      tips: `Scanning Tip: Carpal tunnel syndrome (CTS): measure the median nerve CSA in the transverse plane at the level of the pisiform (proximal carpal tunnel). A CSA >10 mm² is abnormal; >15 mm² is diagnostic of CTS. Also assess the nerve echogenicity (hypoechoic in CTS), the wrist-to-forearm ratio (>1.4 is abnormal), and the presence of a bifid median nerve or persistent median artery (risk factors for CTS).
Pearl: De Quervain's tenosynovitis: look for thickening and hypoechogenicity of the APL and EPB tendons within the 1st extensor compartment, tenosynovial fluid, and neovascularity on color Doppler. A septum between the APL and EPB subcompartments is present in ~34% of patients and is associated with higher failure rates with corticosteroid injection — identify it before injection and guide the needle into the correct subcompartment.`,
      pitfalls: `Ganglion cysts: dorsal wrist ganglia arise from the scapholunate ligament and are the most common wrist mass. They appear as anechoic or hypoechoic cysts with posterior acoustic enhancement. They may be multilocular and have a neck connecting to the joint. Volar ganglia arise from the radioscaphoid joint and are adjacent to the radial artery — always identify the radial artery before aspiration to avoid inadvertent arterial puncture.`,
    },
    hip: {
      description: ``,
      howToGet: `Patient Positioning: Anterior hip (joint, iliopsoas): supine with leg in neutral rotation. For iliopsoas bursa: supine with hip slightly flexed and externally rotated. Lateral hip (greater trochanteric bursae, gluteal tendons): lateral decubitus with affected side up, hip slightly flexed. Posterior hip (sciatic nerve, hamstring origin): prone or lateral decubitus.
Transducer Positioning: Anterior: longitudinal (parallel to femoral neck) and transverse over the anterior joint recess and iliopsoas tendon/bursa. Lateral: longitudinal and transverse over the greater trochanter, gluteus medius/minimus tendons, and trochanteric bursae. Posterior: longitudinal over the ischial tuberosity (hamstring origin) and sciatic nerve.
What to Assess: Anterior joint recess: effusion (>7 mm depth or >2 mm difference from contralateral side); iliopsoas tendon: tendinopathy, bursitis (iliopsoas bursa — communicates with joint in ~15%); Greater trochanteric pain syndrome: gluteus medius/minimus tendinopathy (insertional thickening, hypoechogenicity, calcification), trochanteric bursitis (effusion in subgluteus medius or maximus bursa); Hamstring origin: proximal hamstring tendinopathy, partial/complete avulsion (ischial tuberosity); Sciatic nerve: neuritis, piriformis syndrome; Pediatric: developmental dysplasia (DDH) in infants <6 months (Graf method).`,
      tips: `Scanning Tip: Hip joint effusion: in the anterior longitudinal plane, measure the distance from the anterior femoral neck cortex to the posterior surface of the iliopsoas muscle. An anterior recess depth >7 mm or >2 mm asymmetry compared to the contralateral hip is abnormal. In children, >2 mm asymmetry is significant. Ultrasound-guided hip aspiration is the gold standard for confirming septic arthritis.
Pearl: Greater trochanteric pain syndrome (GTPS): the gluteus medius and minimus tendons insert on the greater trochanter and are the primary source of lateral hip pain (previously attributed to 'trochanteric bursitis'). Look for tendon thickening, hypoechogenicity, calcification, and partial tears at the insertion. True trochanteric bursitis (fluid in the subgluteus maximus bursa) is present in only ~20% of GTPS cases.`,
      pitfalls: ``,
    },
    knee: {
      description: ``,
      howToGet: `Patient Positioning: Anterior (quadriceps/patellar tendon): supine with knee flexed 30° (place a pillow under the knee). For patellar tendon: knee flexed 30° or extended. Medial (MCL, medial meniscus): supine with knee slightly externally rotated. Lateral (LCL, iliotibial band): supine with knee slightly internally rotated. Posterior (Baker's cyst, popliteal vessels): prone or supine with knee slightly flexed.
Transducer Positioning: Anterior: longitudinal and transverse over the quadriceps tendon (suprapatellar), patella, patellar tendon (infrapatellar), and Hoffa's fat pad. Medial: longitudinal over the MCL and medial joint line. Lateral: longitudinal over the LCL, popliteus tendon, and IT band. Posterior: transverse and longitudinal over the popliteal fossa (Baker's cyst, popliteal vessels, tibial nerve).
What to Assess: Quadriceps tendon: partial/full-thickness tear (especially in patients >40 years with acute pain and inability to extend the knee); Patellar tendon: patellar tendinopathy (jumper's knee — focal hypoechoic area at the proximal patellar insertion), partial/full-thickness tear; Suprapatellar recess: effusion (>4 mm depth), synovitis, loose bodies; MCL: sprain, partial/full-thickness tear, Pellegrini-Stieda lesion (calcification); Baker's cyst: between medial head of gastrocnemius and semimembranosus tendons — size, septations, rupture; Iliotibial band syndrome: IT band thickening and hypoechogenicity at the lateral femoral epicondyle.`,
      tips: `Scanning Tip: Quadriceps tendon tear: assess with the knee flexed 30°. A full-thickness tear appears as a complete hypoechoic/anechoic gap through the tendon with retraction of the quadriceps muscle proximally. Dynamic assessment (asking the patient to extend the knee) confirms the tear. The suprapatellar recess typically contains a large effusion. Partial tears appear as focal hypoechoic defects not extending through the full thickness.
Pearl: Baker's cyst: arises from the posterior joint capsule between the medial head of gastrocnemius and semimembranosus tendons. It communicates with the joint via a one-way valve mechanism. A ruptured Baker's cyst causes acute calf pain and swelling mimicking DVT — look for fluid tracking down the calf between the gastrocnemius and soleus muscles ('crescent sign'). Always perform DVT assessment in patients with acute calf symptoms.`,
      pitfalls: ``,
    },
    ankle_foot: {
      description: ``,
      howToGet: `Patient Positioning: Anterior (tibialis anterior, EHL, EDL, anterior ankle joint): supine with ankle in neutral or slight plantarflexion. Medial (tibialis posterior, FDL, FHL, deltoid ligament): supine with ankle in slight eversion. Lateral (peroneal tendons, ATFL, CFL): supine with ankle in slight inversion. Posterior (Achilles tendon, retrocalcaneal bursa): prone with foot hanging off the table.
Transducer Positioning: Achilles: longitudinal (posterior) and transverse from the musculotendinous junction to the calcaneal insertion. Peroneal tendons: transverse behind the lateral malleolus (assess for subluxation dynamically with dorsiflexion/eversion), then longitudinal. Tibialis posterior: longitudinal and transverse behind the medial malleolus. ATFL: longitudinal from the anterior fibula to the talus. Anterior ankle joint: longitudinal for joint recess effusion.
What to Assess: Achilles tendon: tendinopathy (midportion — 2–6 cm from insertion; insertional), partial/full-thickness tear, retrocalcaneal bursitis (>2 mm), Haglund deformity; Peroneal tendons: peroneus longus and brevis — tenosynovitis, longitudinal split tear (PB), subluxation (superior peroneal retinaculum tear); Tibialis posterior tendon: tendinopathy, partial/full-thickness tear (adult flatfoot deformity); ATFL: sprain, partial/full-thickness tear (most common ankle ligament injury); Ankle joint: effusion (anterior recess >3 mm), synovitis, loose bodies; Plantar fascia: plantar fasciitis (thickness >4 mm at calcaneal origin, hypoechogenicity).`,
      tips: `Scanning Tip: Achilles tendon assessment: scan with the ankle in neutral or slight dorsiflexion to avoid anisotropy. Normal Achilles tendon is hyperechoic with a fibrillar pattern. Tendinopathy appears as fusiform thickening (>6 mm AP diameter), hypoechogenicity, and loss of fibrillar pattern. A full-thickness tear shows a complete gap with retraction — measure the gap size and assess for plantaris tendon integrity (may be used for repair). Dynamic assessment with plantarflexion confirms complete rupture (Thompson test equivalent).
Pearl: Peroneal tendon subluxation: assess dynamically with the patient dorsiflexing and everting the ankle against resistance. The peroneal tendons should remain posterior to the lateral malleolus. Subluxation (tendons move anterior to the fibula) indicates a superior peroneal retinaculum (SPR) tear. Look for a 'flap' of the SPR on the fibular cortex (periosteal stripping sign) — this is pathognomonic of SPR avulsion.`,
      pitfalls: ``,
    },
    soft_tissue: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
    msk_guided: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  appendix: {
    rlq_survey: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Ask the patient to point to the area of maximal tenderness — begin scanning there. The appendix arises from the cecum, typically at McBurney's point (one-third of the way from the right anterior superior iliac spine to the umbilicus).
Transducer Positioning: Apply firm, gradual compression with the transducer to displace overlying bowel gas. Begin in the right iliac fossa and scan in a systematic grid pattern. Identify the psoas muscle, iliac vessels, and cecum as landmarks. Follow the cecum inferiorly to find the appendix.
What to Assess: Identify the cecum (blind-ending saccular structure with haustra). The appendix arises from the posteromedial cecum, 2–3 cm below the ileocecal valve. Scan in longitudinal and transverse planes. Measure the outer-wall-to-outer-wall diameter in the transverse plane. Normal: ≤6 mm, compressible, no periappendiceal fat changes.`,
      tips: `Scanning Tip: Graded compression is the key technique — apply slow, steady pressure to displace gas-filled bowel loops. If the appendix is not found in the RLQ, check retrocecal (posterior to the cecum), pelvic (in the pelvis, especially in women), and subhepatic (rare) positions. A retrocecal appendix requires the patient to roll to the left lateral decubitus position.
Pearl: The appendix is identified as a blind-ending, non-peristalsing tubular structure arising from the cecum. It does not show peristalsis (unlike small bowel). The terminal ileum (identified by peristalsis and a valvulae conniventes pattern) is a useful landmark — the ileocecal valve is just above the cecum, and the appendix arises 2–3 cm below it.`,
      pitfalls: `Failure to visualise the appendix does NOT exclude appendicitis — the appendix is not visualised in 10–30% of cases (due to gas, obesity, or retrocecal position). A non-visualised appendix with clinical suspicion should be reported as 'appendix not identified — CT recommended for further evaluation'. Never report a normal appendix if it was not directly visualised.`,
    },
    appendix_id: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Maintain graded compression throughout. If the appendix is not found in the standard RLQ position, ask the patient to roll to the left lateral decubitus position to assess for a retrocecal appendix.
Transducer Positioning: Once the cecum is identified, trace the posteromedial wall inferiorly to find the appendix. Scan in both longitudinal (sausage-shaped) and transverse (target sign) planes. The transverse plane is used for diameter measurement.
What to Assess: Outer-wall-to-outer-wall diameter (normal ≤6 mm); compressibility (normal appendix compresses with pressure); wall thickness (normal <3 mm); mural stratification (three layers: echogenic mucosa, hypoechoic muscularis, echogenic serosa); appendicolith (hyperechoic focus with posterior shadowing); periappendiceal fat echogenicity (normal = isoechoic).`,
      tips: `Scanning Tip: Measure the outer-wall-to-outer-wall diameter in the transverse plane at the widest point. Do not measure the lumen — the outer wall measurement is the standard. A diameter >6 mm in a non-compressible appendix is diagnostic of appendicitis (sensitivity 86%, specificity 81%). A diameter of 6–7 mm is equivocal — correlate clinically and consider CT.
Pearl: The 'target sign' in the transverse plane (concentric rings: hyperechoic mucosa, hypoechoic muscularis, hyperechoic serosa) confirms appendix identification. An appendicolith appears as a hyperechoic focus with posterior acoustic shadowing within the appendiceal lumen — its presence increases the risk of perforation and warrants urgent surgical consultation regardless of diameter.`,
      pitfalls: `The terminal ileum can mimic the appendix — distinguish by peristalsis (ileum peristalsises; appendix does not) and by tracing the structure to confirm it is blind-ending. The right ureter can also mimic the appendix — it is tubular, posterior, and shows ureteral jets on Doppler. Always confirm the structure is truly blind-ending before diagnosing appendicitis.`,
    },
    periappendiceal: {
      description: ``,
      howToGet: `Patient Positioning: Supine. Assess the periappendiceal fat and surrounding structures after identifying the appendix. Extend the survey to the right paracolic gutter and pelvis for free fluid.
Transducer Positioning: After identifying the appendix, reduce compression slightly and assess the surrounding fat. Scan the right paracolic gutter (lateral to the ascending colon) and the pelvis (pouch of Douglas in women, rectovesical pouch in men) for free fluid.
What to Assess: Periappendiceal fat echogenicity (hyperechoic fat = inflammation/phlegmon); free fluid (periappendiceal or pelvic — suggests perforation); loss of mural stratification (gangrenous appendicitis); appendiceal abscess (complex fluid collection adjacent to appendix); lymphadenopathy (mesenteric nodes >1 cm short axis); cecal wall thickening.`,
      tips: `Scanning Tip: Hyperechoic periappendiceal fat (fat stranding) is a secondary sign of appendicitis and is often the first finding when the appendix itself is not clearly visualised. Free fluid adjacent to the appendix is highly suspicious for perforation. A complex fluid collection (abscess) indicates complicated appendicitis requiring urgent management.
Pearl: Perforation signs: (1) loss of mural stratification (echogenic wall becomes indistinct); (2) periappendiceal fluid collection (abscess); (3) free intraperitoneal fluid; (4) appendicolith outside the appendix lumen. Perforated appendicitis has a higher complication rate — early identification changes management (non-operative vs. operative).`,
      pitfalls: `A phlegmon (solid inflammatory mass) can obscure the appendix and mimic a soft tissue tumour. If a complex RLQ mass is identified without a clearly visualised normal appendix, appendicitis with perforation and phlegmon formation should be the primary diagnosis. CT is required for surgical planning in this scenario.`,
    },
    appendix_doppler: {
      description: ``,
      howToGet: ``,
      tips: ``,
      pitfalls: ``,
    },
  },
  invasive_procedures: {
    thoracentesis_site: {
      description: ``,
      howToGet: `Patient Positioning: Seated upright, leaning forward with arms resting on a bedside table (tripod position). This position shifts the lung apex anteriorly and maximises the posterior pleural space. For patients who cannot sit, lateral decubitus (affected side up) is an acceptable alternative.
Transducer Positioning: Begin with a curvilinear transducer in the longitudinal plane over the posterior chest wall. Identify the diaphragm (hyperechoic curvilinear structure with respiratory motion), the liver or spleen below it, and the pleural fluid above. Scan superiorly to find the optimal fluid pocket — deepest, most accessible, and furthest from the diaphragm and lung.
What to Assess: Fluid depth (minimum ≥10 mm for safe thoracentesis); fluid echogenicity (anechoic = transudate; echogenic/septated = exudate/empyema); diaphragm position and excursion; lung position (confirm the lung is not in the needle path); rib position (needle should pass over the superior rib margin to avoid the neurovascular bundle).`,
      tips: `Scanning Tip: Mark the optimal entry site with a skin marker during real-time ultrasound with the patient in the procedural position. The site should be: (1) ≥10 mm fluid depth; (2) above the superior rib margin (to avoid the neurovascular bundle); (3) below the lung; (4) above the diaphragm. Re-scan immediately before needle insertion to confirm the site is still optimal.
Pearl: Ultrasound guidance reduces pneumothorax rates from 9–10% (landmark technique) to 1–2% (ultrasound-guided). Real-time ultrasound guidance (needle visualised during insertion) is preferred over site-marking alone. The 'bat sign' (rib shadows flanking the pleural line) confirms the intercostal space. Insert the needle just above the superior rib margin to avoid the neurovascular bundle.`,
      pitfalls: `The diaphragm rises significantly with expiration — always mark the site during the same phase of respiration as the procedure. A site that appears safe during inspiration may be at the level of the diaphragm during expiration. Instruct the patient to hold their breath or breathe shallowly during needle insertion.`,
    },
    thoracentesis_guidance: {
      description: ``,
      howToGet: `Patient Positioning: Seated upright in tripod position. Maintain the position throughout the procedure. Ensure the patient is stable and can remain still during needle insertion.
Transducer Positioning: Use a sterile transducer cover. Orient the transducer in the longitudinal plane over the intercostal space. The needle enters in-plane from the inferior aspect of the transducer, advancing toward the pleural fluid. Alternatively, use the transducer for site marking and perform the procedure freehand.
What to Assess: Real-time needle tip position — confirm the tip is within the fluid before aspirating. Confirm the needle is above the superior rib margin (neurovascular bundle runs in the subcostal groove). Monitor for lung re-expansion during aspiration. Assess for pneumothorax immediately post-procedure (lung sliding on B-mode).`,
      tips: `Scanning Tip: After the procedure, immediately assess for pneumothorax: place the transducer at the anterior chest wall (2nd intercostal space, midclavicular line) and confirm lung sliding (M-mode: 'seashore sign'). Absent lung sliding with a 'lung point' (transition from sliding to absent sliding) is diagnostic of pneumothorax. A chest X-ray is not required if lung sliding is confirmed on ultrasound.
Pearl: Ultrasound can identify the 'lung point' — the exact location where the visceral and parietal pleura separate — which is pathognomonic for pneumothorax and can be used to estimate its size. The lung point is found by scanning laterally until lung sliding reappears; the transition point is the lung point.`,
      pitfalls: `Absent lung sliding alone is not diagnostic of pneumothorax — it can also occur with pleural adhesions, main-stem intubation, or apnea. The 'lung point' is the only ultrasound finding pathognomonic for pneumothorax. Always correlate with clinical findings and consider chest X-ray if the diagnosis is uncertain.`,
    },
    paracentesis_site: {
      description: ``,
      howToGet: `Patient Positioning: Supine or slight lateral decubitus (affected side down) to pool ascitic fluid. The traditional landmark site (left lower quadrant, lateral to the rectus sheath, 3 cm medial and 3 cm superior to the ASIS) is the starting point. Ultrasound confirms the optimal site and identifies the inferior epigastric artery.
Transducer Positioning: Use a curvilinear transducer in the transverse and longitudinal planes over the planned entry site. Identify the fluid pocket depth, bowel position, and the inferior epigastric artery (use color Doppler). The inferior epigastric artery runs medially in the lateral rectus sheath — the needle should enter lateral to the rectus sheath to avoid it.
What to Assess: Fluid pocket depth (minimum ≥3 cm for safe paracentesis); bowel proximity (confirm no bowel loops in the needle path — bowel shows peristalsis and a layered wall); inferior epigastric artery position (use color Doppler — avoid this vessel); skin-to-fluid distance; fluid echogenicity (anechoic = transudate; echogenic = exudate/haemoperitoneum).`,
      tips: `Scanning Tip: Mark the optimal entry site with the patient in the procedural position. The optimal site has: (1) ≥3 cm fluid depth; (2) no bowel in the needle path; (3) lateral to the inferior epigastric artery; (4) avoids visible vessels on color Doppler. The left lower quadrant is preferred over the right (avoids the cecum and appendix). The midline (linea alba) is an alternative for large-volume ascites.
Pearl: Ultrasound guidance reduces complication rates for paracentesis (bowel perforation, haematoma) from 1–2% (landmark) to <0.1% (ultrasound-guided). Color Doppler identification of the inferior epigastric artery is the most important step — inadvertent puncture causes significant haematoma. Always use color Doppler before marking the site.`,
      pitfalls: `Bowel loops can be difficult to distinguish from ascitic fluid in patients with ileus or bowel wall oedema. Confirm bowel by identifying peristalsis, a layered wall (5 layers on high-frequency), and haustra (colon). If uncertain, reposition the transducer to find a clearer fluid pocket. Never proceed if bowel cannot be excluded from the needle path.`,
    },
    paracentesis_guidance: {
      description: ``,
      howToGet: `Patient Positioning: Supine or slight lateral decubitus. Maintain the position throughout the procedure. Ensure the patient is comfortable and can remain still during needle insertion.
Transducer Positioning: Use a sterile transducer cover. Orient the transducer in the longitudinal plane over the fluid pocket. The needle enters in-plane from the inferior aspect of the transducer. Alternatively, use the transducer for site marking and perform the procedure freehand with the marked site.
What to Assess: Real-time needle tip position — confirm the tip is within the fluid pocket before aspirating. Monitor for bowel injury (sudden loss of fluid, bowel contents in aspirate). Assess the fluid pocket size during drainage — reposition if the pocket becomes too small. Post-procedure: assess for haematoma at the entry site.`,
      tips: `Scanning Tip: For large-volume paracentesis (LVP), drain up to 5–6 litres safely with albumin replacement (6–8 g/L drained). Monitor the fluid pocket throughout — if the pocket becomes <2 cm, stop and reposition. Use a Z-track technique (displace the skin laterally before inserting the needle) to reduce post-procedure fluid leak.
Pearl: The Z-track technique (displace skin 2 cm laterally before needle insertion, then release after withdrawal) creates a non-linear tract that reduces post-procedure ascitic fluid leak — particularly important in patients with tense ascites and thin abdominal walls. This technique reduces the need for suturing the puncture site.`,
      pitfalls: `Catheter blockage during large-volume paracentesis is common — it is usually caused by omentum or bowel occluding the catheter tip. Repositioning the patient (slight lateral decubitus, opposite side) or rotating the catheter 90–180° usually resolves the blockage. Avoid withdrawing the catheter and re-inserting — this increases infection risk.`,
    },
  },
};

/** Get static content for a specific module+view, or empty strings if not found */
export function getStaticContent(module: string, viewId: string): ScanCoachStaticViewContent {
  return SCANCOACH_STATIC_CONTENT[module]?.[viewId] ?? {
    description: "",
    howToGet: "",
    tips: "",
    pitfalls: "",
  };
}
