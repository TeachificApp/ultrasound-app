-- ============================================================
-- 300 AAUS Flashcards Seed — spread across 16 AAUS categories
-- type = 'quickReview', submissionStatus = 'draft', isActive = 1
-- ~18-19 cards per category
-- ============================================================

INSERT INTO quickfireQuestions
  (type, question, reviewAnswer, echoCategory, category, difficulty, isActive, submissionStatus)
VALUES

-- ============================================================
-- ABDOMINAL (19 cards)
-- ============================================================
('quickReview','What is the normal AP diameter of the common bile duct in adults?','≤6 mm (up to 8 mm post-cholecystectomy or in elderly patients)','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the normal length of the adult liver in the mid-clavicular line?','14–17 cm (>17 cm = hepatomegaly)','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the normal thickness of the gallbladder wall?','≤3 mm (fasting patient)','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the normal AP diameter of the pancreatic duct?','≤3 mm','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the normal length of the adult spleen?','≤12 cm','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the normal length of the adult right kidney?','9–12 cm','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What echogenicity is a normal liver relative to the right renal cortex?','Isoechoic or slightly hyperechoic','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the most common cause of a hyperechoic liver?','Hepatic steatosis (fatty liver)','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What sonographic sign indicates acute cholecystitis?','Sonographic Murphy sign (maximal tenderness directly over the gallbladder)','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the Courvoisier sign on ultrasound?','Painless distended gallbladder with biliary dilation — suggests pancreatic head malignancy','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the normal AP diameter of the abdominal aorta?','<3 cm (≥3 cm = aneurysm)','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the double-barrel shotgun sign?','Parallel dilation of the CBD and portal vein — indicates biliary obstruction','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the normal portal vein diameter?','≤13 mm','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the WES sign in gallbladder ultrasound?','Wall-Echo-Shadow sign — indicates a contracted gallbladder packed with stones','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the normal echogenicity of the pancreas relative to the liver?','Isoechoic to slightly hyperechoic','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the most common benign solid liver lesion?','Hepatic hemangioma (hyperechoic, well-defined, posterior acoustic enhancement)','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the normal IVC diameter at end-expiration?','1.5–2.5 cm','abdominal','Abdominal','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of acute pancreatitis?','Enlarged, hypoechoic pancreas with peripancreatic fluid','abdominal','Abdominal','intermediate',1,'draft'),
('quickReview','What is the main sonographic feature of renal hydronephrosis?','Anechoic dilation of the renal collecting system (calyces and pelvis)','abdominal','Abdominal','beginner',1,'draft'),

-- ============================================================
-- PELVIC/GYN (19 cards)
-- ============================================================
('quickReview','What is the normal endometrial thickness in a postmenopausal woman?','≤4–5 mm (>5 mm warrants further evaluation)','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the normal uterine length in a reproductive-age woman?','7–9 cm (length) × 4–5 cm (AP) × 5–6 cm (width)','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the normal ovarian volume in a reproductive-age woman?','≤10 mL (length × width × height × 0.523)','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the normal follicle size at ovulation?','18–28 mm (dominant follicle)','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a simple ovarian cyst?','Anechoic, thin-walled, posterior acoustic enhancement, no internal echoes','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is a corpus luteum cyst?','Post-ovulatory cyst with thick, echogenic wall and internal vascularity (ring of fire)','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the ring of fire sign?','Peripheral vascularity on Doppler around an ectopic pregnancy or corpus luteum','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of adenomyosis?','Heterogeneous myometrium, asymmetric uterine enlargement, subendometrial cysts, poor endometrial definition','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the most common uterine tumor?','Uterine fibroid (leiomyoma) — hypoechoic, well-defined, may shadow','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the normal endometrial thickness in the proliferative phase?','4–8 mm (trilaminar appearance)','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the normal endometrial thickness in the secretory phase?','7–14 mm (echogenic, homogeneous)','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is a Nabothian cyst?','Benign retention cyst of the cervix — anechoic, thin-walled, no flow','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the most common cause of a complex adnexal mass in a premenopausal woman?','Hemorrhagic ovarian cyst (reticular/fishnet internal pattern)','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of endometrioma?','Homogeneous low-level internal echoes ("ground glass"), thick wall, no flow inside','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the Doppler RI of a normal ovarian artery?','0.4–0.9 (low RI suggests malignancy)','pelvic_gyn','Pelvic/Gyn','advanced',1,'draft'),
('quickReview','What is the normal cervical length in a non-pregnant woman?','3–5 cm','pelvic_gyn','Pelvic/Gyn','beginner',1,'draft'),
('quickReview','What is the most common cause of postmenopausal bleeding?','Endometrial atrophy (thin endometrium) — but endometrial cancer must be excluded','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is polycystic ovarian morphology (PCOM) on ultrasound?','≥20 follicles per ovary (2–9 mm) and/or ovarian volume >10 mL','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a dermoid cyst (mature teratoma)?','Echogenic focus with posterior shadowing (Rokitansky nodule), tip-of-the-iceberg sign','pelvic_gyn','Pelvic/Gyn','intermediate',1,'draft'),

-- ============================================================
-- OB 1ST TRIMESTER (19 cards)
-- ============================================================
('quickReview','What is the earliest gestational sac visible on transvaginal ultrasound?','4–5 weeks (mean sac diameter ~2–3 mm, βhCG ~1000–2000 mIU/mL)','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the discriminatory zone for βhCG and gestational sac visibility?','~1500–2000 mIU/mL (TVS); ~3000–6500 mIU/mL (TAS)','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the normal fetal heart rate at 6–7 weeks?','90–110 bpm','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the normal fetal heart rate at 8–10 weeks?','150–175 bpm','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the crown-rump length (CRL) used for?','Gestational age estimation in the 1st trimester (most accurate method)','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the normal nuchal translucency (NT) cutoff at 11–14 weeks?','<3.0 mm (or <95th percentile for CRL)','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What does an absent or reversed nasal bone suggest on 1st trimester screen?','Increased risk of trisomy 21 (Down syndrome)','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the double decidual sac sign?','Two concentric echogenic rings around the gestational sac — confirms intrauterine pregnancy','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the intradecidual sign?','Gestational sac embedded within the decidua — earliest sign of IUP (~4.5 weeks)','obstetric_1st','OB 1st Trimester','advanced',1,'draft'),
('quickReview','What is the yolk sac and when is it first visible?','First structure visible inside the gestational sac; seen at ~5.5 weeks TVS','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the normal yolk sac diameter?','3–6 mm (>6 mm or <3 mm associated with poor outcome)','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a blighted ovum (anembryonic pregnancy)?','Gestational sac >25 mm mean diameter with no embryo on TVS','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the most common cause of 1st trimester bleeding?','Threatened miscarriage (subchorionic hematoma or cervical os changes)','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a molar pregnancy?','Snowstorm appearance — heterogeneous uterine mass with multiple cystic spaces','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the amnion-chorion fusion and when does it occur?','Fusion of the amnion and chorion at ~14–16 weeks; before this, a double-layer membrane is seen','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the normal CRL at 12 weeks?','~55–60 mm','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),
('quickReview','What is a subchorionic hematoma?','Collection of blood between the chorion and uterine wall — seen as a hypoechoic/anechoic crescent','obstetric_1st','OB 1st Trimester','intermediate',1,'draft'),
('quickReview','What is the ductus venosus and why is it important in 1st trimester screening?','Fetal vessel connecting the umbilical vein to the IVC; absent/reversed a-wave suggests aneuploidy or cardiac defect','obstetric_1st','OB 1st Trimester','advanced',1,'draft'),
('quickReview','What is the normal gestational age range for 1st trimester anatomy survey?','11 weeks 0 days to 13 weeks 6 days (CRL 45–84 mm)','obstetric_1st','OB 1st Trimester','beginner',1,'draft'),

-- ============================================================
-- OB 2ND/3RD TRIMESTER (19 cards)
-- ============================================================
('quickReview','What are the four standard biometric measurements in 2nd/3rd trimester ultrasound?','BPD (biparietal diameter), HC (head circumference), AC (abdominal circumference), FL (femur length)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the most accurate single biometric measurement for gestational age after 20 weeks?','Femur length (FL)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal amniotic fluid index (AFI)?','5–24 cm (oligohydramnios <5 cm, polyhydramnios >24 cm)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the single deepest pocket (SDP) cutoff for oligohydramnios?','<2 cm','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the normal cervical length in the 2nd trimester?','≥25 mm (short cervix <25 mm = risk of preterm birth)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is placenta previa?','Placenta overlying or within 2 cm of the internal cervical os','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of placental abruption?','Retroplacental or subchorionic hematoma (may be isoechoic acutely)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal umbilical artery S/D ratio at term?','<3.0 (absent or reversed end-diastolic flow = severe IUGR)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the MCA PSV cutoff for fetal anemia?','>1.5 MoM for gestational age','obstetric_2nd_3rd','OB 2nd/3rd Trimester','advanced',1,'draft'),
('quickReview','What is the biophysical profile (BPP) and its maximum score?','5-parameter fetal assessment (NST, breathing, movement, tone, AFI); maximum score = 10','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal fetal heart rate in the 2nd/3rd trimester?','110–160 bpm','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the banana sign in spina bifida?','Abnormal curvature of the cerebellum on axial view — associated with open spina bifida','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the lemon sign in spina bifida?','Scalloping of the frontal bones on axial view — associated with Arnold-Chiari II malformation','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal cisterna magna measurement?','2–10 mm (>10 mm = Dandy-Walker variant or mega cisterna magna)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal atrial width of the lateral ventricle?','<10 mm (≥10 mm = ventriculomegaly)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal nuchal fold thickness at 15–20 weeks?','<6 mm (≥6 mm = increased risk of trisomy 21)','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the estimated fetal weight (EFW) formula using Hadlock?','Uses BPD, HC, AC, FL — most accurate combination for EFW','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal placental location at the time of 2nd trimester anatomy scan?','Anywhere except over the internal os; low-lying if within 2 cm','obstetric_2nd_3rd','OB 2nd/3rd Trimester','beginner',1,'draft'),
('quickReview','What is the ductus venosus waveform and its significance in the 3rd trimester?','Triphasic waveform; absent or reversed a-wave = fetal cardiac compromise','obstetric_2nd_3rd','OB 2nd/3rd Trimester','advanced',1,'draft'),

-- ============================================================
-- FETAL ECHO (19 cards)
-- ============================================================
('quickReview','What is the normal fetal heart rate range throughout pregnancy?','110–160 bpm (varies by gestational age)','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is the normal cardiothoracic ratio (CTR) in the fetus?','0.25–0.35 (heart area/chest area); >0.35 = cardiomegaly','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the normal cardiac axis in the fetus?','45° ± 20° (pointing to the left)','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the 4-chamber view (4CV) used to assess?','Cardiac situs, chamber symmetry, AV valves, atrial and ventricular septal integrity','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is the LVOT view used to assess?','Aortic root continuity with the interventricular septum and anterior mitral leaflet','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the 3-vessel view (3VV) used to assess?','Alignment and size of the PA, Ao, and SVC; detects conotruncal anomalies','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the most common congenital heart defect?','Ventricular septal defect (VSD)','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of hypoplastic left heart syndrome (HLHS)?','Small LV, hypoplastic aortic root, mitral atresia or stenosis, dominant RV','fetal_echo','Fetal Echo','advanced',1,'draft'),
('quickReview','What is the normal MCA PSV in a fetus at 28 weeks?','~50–60 cm/s (>1.5 MoM = fetal anemia)','fetal_echo','Fetal Echo','advanced',1,'draft'),
('quickReview','What is the ductus arteriosus and what does it connect?','Connects the main pulmonary artery to the descending aorta; allows blood to bypass the lungs in utero','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is the foramen ovale and its function?','Opening in the atrial septum allowing right-to-left shunting of oxygenated blood in utero','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is the normal ductus venosus (DV) PI in the 2nd trimester?','<0.8 (elevated PI or reversed a-wave = cardiac dysfunction or aneuploidy)','fetal_echo','Fetal Echo','advanced',1,'draft'),
('quickReview','What is tetralogy of Fallot (TOF)?','VSD, overriding aorta, pulmonary stenosis, RV hypertrophy — conotruncal defect','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is transposition of the great arteries (TGA)?','Aorta arises from the RV and PA from the LV — parallel great vessels on 3VV','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the normal Ao:PA ratio in the fetus?','~1:1 (aorta and pulmonary artery should be equal in size)','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is an atrioventricular septal defect (AVSD)?','Combined ASD and VSD with a common AV valve — associated with trisomy 21','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the normal fetal cardiac axis deviation that suggests dextrocardia?','Cardiac axis >60° or pointing to the right (>+90°)','fetal_echo','Fetal Echo','intermediate',1,'draft'),
('quickReview','What is the abdominal situs view used for in fetal echo?','Confirms normal situs solitus (stomach left, liver right, descending aorta left, IVC right)','fetal_echo','Fetal Echo','beginner',1,'draft'),
('quickReview','What is Ebstein anomaly?','Apical displacement of the tricuspid valve leaflets into the RV — causes massive RA enlargement','fetal_echo','Fetal Echo','advanced',1,'draft'),

-- ============================================================
-- VENOUS (19 cards)
-- ============================================================
('quickReview','What are the three criteria for diagnosing DVT on compression ultrasound?','Non-compressibility, intraluminal thrombus, absent or abnormal Doppler flow','venous','Venous','beginner',1,'draft'),
('quickReview','What is the normal diameter of the common femoral vein?','Variable; compressibility is more important than diameter','venous','Venous','beginner',1,'draft'),
('quickReview','What is the augmentation maneuver in venous Doppler?','Distal limb compression to assess venous patency — normal = brisk increase in flow','venous','Venous','beginner',1,'draft'),
('quickReview','What is phasicity in venous Doppler?','Spontaneous variation in venous flow with respiration — loss suggests proximal obstruction','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the most common site of DVT in the lower extremity?','Calf veins (posterior tibial, peroneal, anterior tibial) — but femoral/popliteal are most clinically significant','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the Baker cyst and how does it appear on ultrasound?','Popliteal fossa cyst arising from the gastrocnemius-semimembranosus bursa — anechoic, may rupture','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the normal saphenofemoral junction (SFJ) reflux duration?','<0.5 seconds (>0.5 s = pathologic reflux)','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the Valsalva maneuver used for in venous duplex?','Assess for reflux at the SFJ and SPJ — normal = brief reversal then cessation','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the normal great saphenous vein (GSV) diameter?','<3 mm at the SFJ (>5 mm = significant varicosity)','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the CEAP classification?','Clinical-Etiology-Anatomy-Pathophysiology classification for chronic venous disease (C0–C6)','venous','Venous','advanced',1,'draft'),
('quickReview','What is the sonographic appearance of chronic DVT vs acute DVT?','Acute: hypoechoic, soft, distends vein. Chronic: echogenic, fibrotic, recanalized, collaterals','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the normal upper extremity venous flow pattern?','Phasic with respiration, augments with distal compression, no spontaneous pulsatility','venous','Venous','beginner',1,'draft'),
('quickReview','What is Paget-Schroetter syndrome?','Effort-induced axillosubclavian DVT (thoracic outlet syndrome)','venous','Venous','advanced',1,'draft'),
('quickReview','What is the normal IVC diameter and respiratory variation?','<2.1 cm; collapses >50% with sniff (normal RA pressure)','venous','Venous','intermediate',1,'draft'),
('quickReview','What is the small saphenous vein (SSV) and where does it drain?','Posterior calf vein draining into the popliteal vein at the saphenopopliteal junction (SPJ)','venous','Venous','beginner',1,'draft'),
('quickReview','What is the perforator vein reflux threshold?','Outward flow >0.5 seconds and diameter >3.5 mm','venous','Venous','advanced',1,'draft'),
('quickReview','What is the May-Thurner syndrome?','Left iliac vein compression by the right iliac artery — predisposes to left-sided DVT','venous','Venous','advanced',1,'draft'),
('quickReview','What is the normal venous refill time (VRT) on photoplethysmography?','>20 seconds (shorter = venous insufficiency)','venous','Venous','advanced',1,'draft'),
('quickReview','What is the difference between a thrombus and a phlebolith?','Phlebolith: calcified venous stone with posterior shadowing; thrombus: soft, non-calcified intraluminal echo','venous','Venous','intermediate',1,'draft'),

-- ============================================================
-- ARTERIAL (19 cards)
-- ============================================================
('quickReview','What is the ankle-brachial index (ABI) and what is normal?','Ankle systolic pressure / brachial systolic pressure; normal ≥1.0','arterial','Arterial','beginner',1,'draft'),
('quickReview','What ABI indicates severe peripheral arterial disease (PAD)?','<0.4 (rest pain or tissue loss)','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the normal triphasic waveform in the lower extremity arteries?','Forward systolic flow, brief reversal, late forward flow — indicates normal compliance','arterial','Arterial','beginner',1,'draft'),
('quickReview','What does a monophasic waveform in a peripheral artery indicate?','Significant proximal stenosis or occlusion','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What PSV ratio indicates a hemodynamically significant stenosis?','PSV ratio ≥2.0 (stenosis >50%)','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the normal PSV in the common femoral artery?','70–100 cm/s','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is the normal PSV in the popliteal artery?','50–70 cm/s','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is the normal PSV in the posterior tibial artery?','40–70 cm/s','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is the Doppler waveform appearance of a pseudoaneurysm?','To-and-fro flow in the neck; yin-yang swirling pattern in the sac','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the difference between a true aneurysm and a pseudoaneurysm?','True: all 3 wall layers involved. Pseudo: contained rupture with fibrous capsule (no true wall)','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the normal ABI in a diabetic patient with calcified vessels?','May be falsely elevated (>1.3) — use toe-brachial index (TBI) instead','arterial','Arterial','advanced',1,'draft'),
('quickReview','What is the normal toe-brachial index (TBI)?','≥0.7','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the Rutherford classification?','Staging system for chronic limb ischemia (0–6) based on symptoms and hemodynamics','arterial','Arterial','advanced',1,'draft'),
('quickReview','What is the normal PSV in the superficial femoral artery (SFA)?','70–100 cm/s','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is the normal PSV in the iliac arteries?','100–150 cm/s','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is a hemodynamically significant stenosis by PSV criteria?','PSV >200 cm/s in the SFA or >250 cm/s in the iliac arteries','arterial','Arterial','intermediate',1,'draft'),
('quickReview','What is the normal upper extremity ABI equivalent (wrist-brachial index)?','≥1.0','arterial','Arterial','beginner',1,'draft'),
('quickReview','What is Leriche syndrome?','Aortoiliac occlusion — claudication, impotence, absent femoral pulses','arterial','Arterial','advanced',1,'draft'),
('quickReview','What is the difference between claudication and rest pain?','Claudication: exercise-induced; rest pain: occurs at rest, ABI typically <0.4','arterial','Arterial','intermediate',1,'draft'),

-- ============================================================
-- ABDOMINAL VASCULAR (18 cards)
-- ============================================================
('quickReview','What is the normal PSV in the celiac artery?','100–200 cm/s','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What PSV in the celiac artery suggests hemodynamically significant stenosis?','>200 cm/s (>50% stenosis)','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the normal PSV in the superior mesenteric artery (SMA)?','<275 cm/s (fasting)','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What is the normal PSV in the renal artery?','<180 cm/s','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What RAR (renal-aortic ratio) suggests renal artery stenosis?','>3.5','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the normal renal artery RI?','0.5–0.7','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What RI suggests renal parenchymal disease?','>0.7','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the parvus-tardus waveform?','Dampened, delayed systolic upstroke — indicates significant proximal stenosis','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the normal portal vein velocity?','15–40 cm/s (hepatopetal flow)','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What is portal hypertension and its Doppler findings?','Portal vein velocity <15 cm/s, hepatofugal flow, splenomegaly, varices','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the normal hepatic artery RI after liver transplant?','0.5–0.7 (RI <0.5 suggests hepatic artery stenosis)','abdominal_vascular','Abdominal Vascular','advanced',1,'draft'),
('quickReview','What is median arcuate ligament syndrome (MALS)?','Celiac artery compression by the diaphragm — PSV increases with expiration','abdominal_vascular','Abdominal Vascular','advanced',1,'draft'),
('quickReview','What is the normal abdominal aorta diameter?','<3 cm (≥3 cm = AAA)','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),
('quickReview','What is the endoleak classification after EVAR?','Type I: attachment site leak. Type II: collateral flow. Type III: graft defect. Type IV: graft porosity. Type V: endotension','abdominal_vascular','Abdominal Vascular','advanced',1,'draft'),
('quickReview','What is the normal mesenteric artery waveform pattern?','High-resistance (triphasic) fasting; low-resistance (biphasic) postprandial','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the normal hepatic vein waveform?','Triphasic (two antegrade and one retrograde phase) — loss suggests hepatic congestion','abdominal_vascular','Abdominal Vascular','intermediate',1,'draft'),
('quickReview','What is the Budd-Chiari syndrome?','Hepatic vein thrombosis — absent or reversed hepatic vein flow, caudate lobe hypertrophy','abdominal_vascular','Abdominal Vascular','advanced',1,'draft'),
('quickReview','What is the normal splenic artery RI?','0.5–0.7','abdominal_vascular','Abdominal Vascular','beginner',1,'draft'),

-- ============================================================
-- EXTRACRANIAL CAROTID (18 cards)
-- ============================================================
('quickReview','What is the normal PSV in the internal carotid artery (ICA)?','<125 cm/s','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),
('quickReview','What PSV in the ICA indicates 50–69% stenosis (NASCET criteria)?','125–230 cm/s','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What PSV in the ICA indicates ≥70% stenosis (NASCET criteria)?','>230 cm/s','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the normal ICA/CCA PSV ratio?','<2.0 (≥2.0 suggests ≥50% stenosis)','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the normal intima-media thickness (IMT) of the carotid artery?','<0.9 mm (>1.0 mm = increased cardiovascular risk)','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the normal PSV in the common carotid artery (CCA)?','60–100 cm/s','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),
('quickReview','What is the normal PSV in the external carotid artery (ECA)?','70–130 cm/s','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),
('quickReview','How do you distinguish the ICA from the ECA on ultrasound?','ICA: larger, no branches, lower resistance, lateral/posterior. ECA: smaller, branches, higher resistance, medial/anterior. Temporal tap test','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the temporal tap test?','Tapping the superficial temporal artery causes oscillations in the ECA waveform — confirms ECA identity','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the carotid bulb and why is it important?','Widening at the ICA origin — common site of plaque formation and stenosis','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),
('quickReview','What is a string sign in carotid stenosis?','Near-total occlusion — very thin trickle of flow on color Doppler','extracranial_carotid','Extracranial Carotid','advanced',1,'draft'),
('quickReview','What is the vertebral artery waveform and normal PSV?','Low-resistance, antegrade; PSV 20–60 cm/s','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is subclavian steal syndrome?','Reversed vertebral artery flow due to proximal subclavian artery stenosis/occlusion','extracranial_carotid','Extracranial Carotid','advanced',1,'draft'),
('quickReview','What is the NASCET method for measuring carotid stenosis?','(1 − [residual lumen / normal distal ICA]) × 100%','extracranial_carotid','Extracranial Carotid','advanced',1,'draft'),
('quickReview','What is the EDV cutoff for ICA occlusion vs near-occlusion?','EDV = 0 or absent flow = occlusion; very low EDV with trickle = near-occlusion','extracranial_carotid','Extracranial Carotid','advanced',1,'draft'),
('quickReview','What is the normal carotid artery waveform pattern?','Low-resistance, continuous forward diastolic flow','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),
('quickReview','What is the significance of a hypoechoic plaque?','Lipid-rich, soft plaque — higher risk of embolization and stroke','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft'),
('quickReview','What is the normal CCA bifurcation level?','C3–C4 vertebral level (varies anatomically)','extracranial_carotid','Extracranial Carotid','beginner',1,'draft'),

-- ============================================================
-- INTRACRANIAL TCD (18 cards)
-- ============================================================
('quickReview','What is the normal MCA PSV on TCD?','50–100 cm/s (mean ~60 cm/s)','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What MCA PSV on TCD indicates vasospasm after subarachnoid hemorrhage?','>120 cm/s (severe >200 cm/s)','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the Lindegaard ratio and its significance?','MCA PSV / ICA PSV; >3 = vasospasm, >6 = severe vasospasm','intracranial_tcd','Intracranial Duplex/TCD','advanced',1,'draft'),
('quickReview','What is the normal ACA PSV on TCD?','40–80 cm/s','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What is the normal PCA PSV on TCD?','30–60 cm/s','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What is the normal basilar artery PSV on TCD?','30–60 cm/s','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What is the normal OA (ophthalmic artery) flow direction on TCD?','Antegrade (toward the probe in the orbital window)','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the significance of reversed OA flow on TCD?','Indicates severe ipsilateral ICA stenosis or occlusion with collateral flow via the OA','intracranial_tcd','Intracranial Duplex/TCD','advanced',1,'draft'),
('quickReview','What is the pulsatility index (PI) and its normal value on TCD?','(PSV − EDV) / mean velocity; normal 0.6–1.1','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What elevated PI on TCD suggests?','Increased intracranial pressure (ICP) or distal resistance','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the temporal window for TCD insonation?','Transtemporal window — above the zygomatic arch, anterior to the ear','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What is the depth of insonation for the MCA on TCD?','45–65 mm','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the depth of insonation for the ACA on TCD?','60–75 mm (flow away from probe = A1 segment)','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the emboli detection capability of TCD?','Detects HITS (high-intensity transient signals) — microemboli during cardiac surgery or carotid procedures','intracranial_tcd','Intracranial Duplex/TCD','advanced',1,'draft'),
('quickReview','What is the circle of Willis?','Arterial anastomotic ring at the base of the brain — MCA, ACA, PCA, ACoA, PCoA','intracranial_tcd','Intracranial Duplex/TCD','beginner',1,'draft'),
('quickReview','What is the normal TIBI (thrombolysis in brain ischemia) grade 5?','Normal flow — full systolic and diastolic flow with sharp systolic upstroke','intracranial_tcd','Intracranial Duplex/TCD','advanced',1,'draft'),
('quickReview','What is the suboccipital window used for in TCD?','Insonation of the vertebral arteries and basilar artery','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),
('quickReview','What is the transorbital window used for in TCD?','Insonation of the ophthalmic artery and carotid siphon (ICA)','intracranial_tcd','Intracranial Duplex/TCD','intermediate',1,'draft'),

-- ============================================================
-- POCUS (18 cards)
-- ============================================================
('quickReview','What is the normal IVC diameter and collapsibility index for low CVP?','<2.1 cm with >50% collapse on sniff = RAP <5 mmHg','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the FAST exam and what does it assess?','Focused Assessment with Sonography in Trauma — detects free fluid in Morrison pouch, splenorenal, pelvis, pericardium','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the eFAST exam?','Extended FAST — adds bilateral lung assessment for pneumothorax and hemothorax','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the lung sliding sign?','Normal pleural movement — rules out pneumothorax at that point','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the seashore sign on M-mode lung ultrasound?','Normal lung — granular pattern below pleural line (sand) with horizontal lines above (sea)','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is the stratosphere (barcode) sign on M-mode?','Absent lung sliding — horizontal lines throughout = pneumothorax','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What are B-lines and what do they indicate?','Hyperechoic vertical artifacts from the pleural line to the bottom of screen — indicate interstitial fluid (pulmonary edema, pneumonia)','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is the BLUE protocol?','Bedside Lung Ultrasound in Emergency — algorithm for diagnosing acute respiratory failure using A-lines, B-lines, and consolidation','pocus','POCUS','advanced',1,'draft'),
('quickReview','What is the normal LVEF estimation by POCUS?','Visual estimation: normal >55%; hyperdynamic >70%; reduced <40%','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is the E-point septal separation (EPSS) and its significance?','>7 mm suggests reduced LVEF (<40%)','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is the RUSH protocol?','Rapid Ultrasound in SHock — assesses pump (cardiac), tank (volume), pipes (vessels) in undifferentiated shock','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is a pericardial effusion and how is it graded?','Fluid around the heart: small <1 cm, moderate 1–2 cm, large >2 cm','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is cardiac tamponade on POCUS?','Large effusion + RV diastolic collapse + IVC plethora + respiratory variation in mitral/tricuspid inflow','pocus','POCUS','intermediate',1,'draft'),
('quickReview','What is the normal Morrison pouch?','Potential space between the liver and right kidney — free fluid appears as anechoic stripe','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the A-line on lung ultrasound?','Horizontal reverberation artifact from the pleural line — indicates normal aeration','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the lung point sign?','Transition between normal and absent lung sliding — pathognomonic for pneumothorax','pocus','POCUS','advanced',1,'draft'),
('quickReview','What is the normal bladder volume formula on POCUS?','Length × Width × Height × 0.52 (ellipsoid formula)','pocus','POCUS','beginner',1,'draft'),
('quickReview','What is the optic nerve sheath diameter (ONSD) cutoff for elevated ICP?','>5 mm (measured 3 mm behind the globe)','pocus','POCUS','advanced',1,'draft'),

-- ============================================================
-- PHYSICS (18 cards)
-- ============================================================
('quickReview','What is the speed of sound in soft tissue?','1540 m/s','physics','Physics','beginner',1,'draft'),
('quickReview','What is the relationship between frequency and resolution in ultrasound?','Higher frequency = better resolution but less penetration','physics','Physics','beginner',1,'draft'),
('quickReview','What is the relationship between frequency and penetration?','Lower frequency = greater penetration but worse resolution','physics','Physics','beginner',1,'draft'),
('quickReview','What is acoustic impedance?','Density × speed of sound in a medium — determines reflection at tissue interfaces','physics','Physics','intermediate',1,'draft'),
('quickReview','What is the piezoelectric effect?','Conversion of electrical energy to mechanical (sound) energy and vice versa — basis of ultrasound transducers','physics','Physics','beginner',1,'draft'),
('quickReview','What is the Doppler effect in ultrasound?','Change in frequency of reflected sound due to motion of a reflector (e.g., blood cells)','physics','Physics','beginner',1,'draft'),
('quickReview','What is the Nyquist limit?','Maximum detectable Doppler frequency shift = PRF/2; aliasing occurs when exceeded','physics','Physics','intermediate',1,'draft'),
('quickReview','What is aliasing in Doppler ultrasound?','Wrapping of high-velocity signals below the baseline — occurs when velocity exceeds Nyquist limit','physics','Physics','intermediate',1,'draft'),
('quickReview','What is the difference between specular and diffuse reflection?','Specular: smooth surface, angle-dependent. Diffuse: rough surface, scatters in all directions','physics','Physics','intermediate',1,'draft'),
('quickReview','What is acoustic shadowing?','Reduction of echoes deep to a highly reflective or attenuating structure (e.g., calculi, bone)','physics','Physics','beginner',1,'draft'),
('quickReview','What is posterior acoustic enhancement?','Increased echoes deep to a fluid-filled structure (e.g., cyst, bladder)','physics','Physics','beginner',1,'draft'),
('quickReview','What is the axial resolution in ultrasound?','Ability to distinguish two structures along the beam axis = 1/2 spatial pulse length','physics','Physics','intermediate',1,'draft'),
('quickReview','What is lateral resolution?','Ability to distinguish two structures perpendicular to the beam — depends on beam width (focus)','physics','Physics','intermediate',1,'draft'),
('quickReview','What is the mechanical index (MI) and its significance?','Estimate of cavitation risk; MI = peak negative pressure / √frequency. MI <0.3 = low risk','physics','Physics','advanced',1,'draft'),
('quickReview','What is harmonic imaging?','Uses second harmonic frequency (2× transmitted frequency) to reduce noise and improve image quality','physics','Physics','intermediate',1,'draft'),
('quickReview','What is the thermal index (TI)?','Estimate of temperature rise in tissue; TIS (soft tissue), TIB (bone), TIC (cranial bone)','physics','Physics','advanced',1,'draft'),
('quickReview','What is the ALARA principle?','As Low As Reasonably Achievable — minimize ultrasound exposure while maintaining diagnostic quality','physics','Physics','beginner',1,'draft'),
('quickReview','What is the difference between a linear, curvilinear, and phased array transducer?','Linear: high-frequency, superficial structures. Curvilinear: abdominal/OB. Phased array: cardiac/small footprint','physics','Physics','beginner',1,'draft'),

-- ============================================================
-- THYROID (18 cards)
-- ============================================================
('quickReview','What is the normal thyroid lobe size?','4–6 cm length × 1.5–2 cm AP × 2 cm width; isthmus <3 mm','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the normal echogenicity of the thyroid gland?','Homogeneous, hyperechoic relative to adjacent strap muscles','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the ACR TI-RADS classification?','Thyroid Imaging Reporting and Data System — risk stratification of thyroid nodules (TR1–TR5)','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What TI-RADS category warrants FNA biopsy?','TR4 (≥1.5 cm) and TR5 (≥1.0 cm); TR3 (≥2.5 cm)','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a benign thyroid cyst?','Anechoic, thin-walled, posterior acoustic enhancement, no solid component','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of Hashimoto thyroiditis?','Heterogeneous, hypoechoic gland with fibrous septations and increased vascularity','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of Graves disease?','Diffusely enlarged, hypoechoic gland with markedly increased vascularity (thyroid inferno)','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the most suspicious sonographic feature of a thyroid nodule?','Taller-than-wide shape (AP > transverse diameter)','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the significance of microcalcifications in a thyroid nodule?','Associated with papillary thyroid carcinoma — punctate echogenic foci without shadowing','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the comet-tail artifact in thyroid ultrasound?','Reverberation artifact from colloid crystals — indicates benign colloid cyst','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the normal thyroid volume?','8–25 mL (length × width × AP × 0.523 × 2 lobes + isthmus)','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the most common thyroid malignancy?','Papillary thyroid carcinoma (~80% of thyroid cancers)','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a parathyroid adenoma?','Hypoechoic oval nodule posterior to the thyroid, hypervascular on Doppler','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the normal number of parathyroid glands?','4 (2 superior, 2 inferior)','thyroid','Thyroid','beginner',1,'draft'),
('quickReview','What is the significance of a hypoechoic halo around a thyroid nodule?','May indicate a benign adenoma (peripheral vascularity) but not specific','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of subacute thyroiditis (de Quervain)?','Focal or diffuse hypoechoic areas with decreased vascularity, tender gland','thyroid','Thyroid','intermediate',1,'draft'),
('quickReview','What is the normal PSV in the inferior thyroid artery?','<40 cm/s (>40 cm/s in hyperthyroidism)','thyroid','Thyroid','advanced',1,'draft'),
('quickReview','What is the significance of a purely cystic thyroid nodule?','Almost always benign — no FNA required unless symptomatic or >4 cm','thyroid','Thyroid','beginner',1,'draft'),

-- ============================================================
-- SCROTUM (18 cards)
-- ============================================================
('quickReview','What is the normal testicular size?','3–5 cm length × 2–3 cm width × 2–3 cm AP','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is the normal echogenicity of the testis?','Homogeneous, medium-level echogenicity','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of testicular torsion?','Enlarged, hypoechoic testis with absent or decreased flow on Doppler (compare to contralateral side)','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the whirlpool sign in testicular torsion?','Twisting of the spermatic cord — seen on color Doppler as a swirling pattern','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the most common testicular tumor?','Seminoma (most common germ cell tumor in adults)','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a seminoma?','Homogeneous, hypoechoic intratesticular mass with increased vascularity','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is a hydrocele?','Anechoic fluid collection surrounding the testis in the tunica vaginalis','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is a varicocele and how is it diagnosed on ultrasound?','Dilated pampiniform plexus veins (>3 mm); increases with Valsalva; associated with infertility','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is an epididymal cyst vs spermatocele?','Epididymal cyst: anechoic, no internal echoes. Spermatocele: low-level internal echoes (sperm/debris)','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of epididymo-orchitis?','Enlarged, hyperemic epididymis and/or testis; reactive hydrocele; increased Doppler flow','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the tunica albuginea?','Fibrous capsule surrounding the testis — appears as an echogenic line','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is the mediastinum testis?','Echogenic band of fibrous tissue running through the testis — normal finding','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is a testicular microlithiasis (TML)?','≥5 punctate echogenic foci per field of view — associated with germ cell tumors','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the bell-clapper deformity?','High investment of the tunica vaginalis — predisposes to testicular torsion','scrotum','Scrotum','advanced',1,'draft'),
('quickReview','What is the normal epididymal head size?','≤12 mm in AP diameter','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is a hematocele?','Blood in the tunica vaginalis — complex fluid with internal echoes after trauma','scrotum','Scrotum','intermediate',1,'draft'),
('quickReview','What is the most common cause of acute scrotal pain in adolescents?','Testicular torsion (surgical emergency) — must be ruled out before epididymo-orchitis','scrotum','Scrotum','beginner',1,'draft'),
('quickReview','What is the normal resistive index (RI) in the testicular artery?','0.5–0.7','scrotum','Scrotum','intermediate',1,'draft'),

-- ============================================================
-- BREAST (18 cards)
-- ============================================================
('quickReview','What is the ACR BI-RADS classification for breast ultrasound?','BI-RADS 0: incomplete. 1: negative. 2: benign. 3: probably benign. 4: suspicious. 5: highly suspicious. 6: biopsy-proven malignancy','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a simple breast cyst?','Anechoic, thin-walled, posterior acoustic enhancement, compressible, oval or round','breast','Breast','beginner',1,'draft'),
('quickReview','What is the most common benign solid breast mass?','Fibroadenoma — oval, parallel, circumscribed, homogeneous, wider-than-tall','breast','Breast','beginner',1,'draft'),
('quickReview','What is the most suspicious sonographic feature of breast malignancy?','Taller-than-wide (not parallel) orientation','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of invasive ductal carcinoma (IDC)?','Irregular, spiculated, hypoechoic, taller-than-wide, posterior shadowing, angular margins','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the normal breast tissue echogenicity?','Heterogeneous — mixture of fat (hypoechoic) and fibroglandular tissue (hyperechoic)','breast','Breast','beginner',1,'draft'),
('quickReview','What is the Cooper ligament?','Fibrous suspensory ligament of the breast — appears as echogenic linear structure','breast','Breast','beginner',1,'draft'),
('quickReview','What is the significance of posterior acoustic shadowing in a breast mass?','Suggests malignancy (desmoplastic reaction) or calcifications','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the significance of posterior acoustic enhancement in a breast mass?','Suggests fluid-filled or low-attenuation lesion (cyst, mucinous carcinoma)','breast','Breast','intermediate',1,'draft'),
('quickReview','What is a complex cystic breast mass?','Mixed cystic-solid lesion — BI-RADS 4 or higher; requires biopsy','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the normal axillary lymph node appearance?','Oval, thin cortex (<3 mm), echogenic fatty hilum, reniform shape','breast','Breast','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a malignant axillary lymph node?','Rounded, cortical thickening >3 mm, absent fatty hilum, increased vascularity','breast','Breast','intermediate',1,'draft'),
('quickReview','What is a galactocele?','Milk-filled cyst in a lactating woman — variable echogenicity (fat/fluid level)','breast','Breast','intermediate',1,'draft'),
('quickReview','What is fat necrosis in the breast?','Post-traumatic or post-surgical lesion — oil cyst (anechoic) or echogenic mass with shadowing','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the normal breast skin thickness?','<2 mm (>2 mm = skin thickening, may indicate inflammatory carcinoma or edema)','breast','Breast','beginner',1,'draft'),
('quickReview','What is the HHUS (whole breast ultrasound) indication?','Dense breast tissue where mammography has limited sensitivity','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a breast abscess?','Irregular, thick-walled, complex fluid collection with internal debris and increased peripheral vascularity','breast','Breast','intermediate',1,'draft'),
('quickReview','What is the difference between a BI-RADS 3 and BI-RADS 4 lesion?','BI-RADS 3: probably benign (<2% malignancy risk), 6-month follow-up. BI-RADS 4: suspicious (2–95%), biopsy recommended','breast','Breast','intermediate',1,'draft'),

-- ============================================================
-- MSK (18 cards)
-- ============================================================
('quickReview','What is the normal thickness of the rotator cuff (supraspinatus tendon)?','5–7 mm (>7 mm = thickening; <4 mm = thinning/tear)','msk','MSK','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a full-thickness rotator cuff tear?','Non-visualization of the tendon, anechoic defect, bony cortex exposed','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a partial-thickness rotator cuff tear?','Focal hypoechoic or anechoic defect within the tendon (bursal or articular surface)','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the normal appearance of a tendon on ultrasound?','Fibrillar echotexture — parallel echogenic lines (fibrillar pattern)','msk','MSK','beginner',1,'draft'),
('quickReview','What is tendinosis vs tendinitis on ultrasound?','Tendinosis: hypoechoic thickening, loss of fibrillar pattern, no inflammation. Tendinitis: same + increased Doppler flow','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the normal appearance of a nerve on ultrasound?','Honeycomb pattern — hypoechoic fascicles surrounded by echogenic epineurium','msk','MSK','beginner',1,'draft'),
('quickReview','What is the normal cross-sectional area (CSA) of the median nerve at the wrist?','<10 mm² (>10–12 mm² = carpal tunnel syndrome)','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the anisotropy artifact in MSK ultrasound?','Tendon/nerve appears hypoechoic when the beam is not perpendicular — corrected by tilting the probe','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the normal appearance of a joint on ultrasound?','Thin anechoic stripe of synovial fluid (<2 mm in most joints)','msk','MSK','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of gout (tophus)?','Hyperechoic deposits with posterior shadowing; double contour sign on cartilage','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the double contour sign in gout?','Hyperechoic line on the surface of hyaline cartilage — urate crystal deposition','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the sonographic appearance of a ganglion cyst?','Anechoic or hypoechoic multiloculated cyst adjacent to a joint or tendon sheath','msk','MSK','beginner',1,'draft'),
('quickReview','What is the normal Achilles tendon thickness?','4–6 mm AP diameter at 2–6 cm above the calcaneal insertion','msk','MSK','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of plantar fasciitis?','Thickened plantar fascia (>4 mm) at the calcaneal insertion with hypoechoic changes','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the normal plantar fascia thickness?','<4 mm at the calcaneal origin','msk','MSK','beginner',1,'draft'),
('quickReview','What is the sonographic appearance of a Baker cyst?','Anechoic or hypoechoic cyst in the posteromedial popliteal fossa between the medial gastrocnemius and semimembranosus tendons','msk','MSK','beginner',1,'draft'),
('quickReview','What is the power Doppler finding in active synovitis?','Increased intra-articular vascularity (grade 1–3 on EULAR scoring)','msk','MSK','intermediate',1,'draft'),
('quickReview','What is the normal patellar tendon thickness?','3–5 mm','msk','MSK','beginner',1,'draft'),
-- 4 extra cards to reach 300 total
('quickReview','What is the OB 1st trimester nuchal fold measurement vs nuchal translucency?','NT is measured at 11–14 weeks (CRL 45–84 mm); nuchal fold is measured at 15–20 weeks on axial view of posterior fossa','obstetric_1st','OB 1st Trimester','advanced',1,'draft'),
('quickReview','What is the normal umbilical artery PSV at 20 weeks?','~40–60 cm/s; S/D ratio normally decreases with advancing gestation','obstetric_2nd_3rd','OB 2nd/3rd Trimester','intermediate',1,'draft'),
('quickReview','What is the normal PSV in the inferior mesenteric artery (IMA)?','<200 cm/s; IMA is smaller and harder to visualize than SMA/celiac','abdominal_vascular','Abdominal Vascular','advanced',1,'draft'),
('quickReview','What is the normal PSV in the vertebral artery on duplex?','20–60 cm/s; asymmetry >1:1.5 may indicate stenosis','extracranial_carotid','Extracranial Carotid','intermediate',1,'draft');
