# UltrasoundAssist™ App TODO

## Core Structure & Branding
- [x] Set up AAUS teal/aqua color scheme (#189aa1, #4ad9e0)
- [x] Configure Google Fonts (Merriweather + Inter)
- [x] Build mobile-first sidebar navigation
- [x] Dashboard/home page with app overview
- [x] AAUS logo integration (CDN)
- [x] Register/Sign In buttons with Thinkific links

## Database Schema
- [x] Users table with membership_tier (free/premium)
- [x] Thinkific webhook handler + user sync
- [x] Flashcards table with categories
- [x] Cases table with categories
- [x] SoundBytes table with categories
- [x] Daily challenge table
- [x] Leaderboard/points table
- [x] Admin management tables
- [x] Database migration applied

## Navigation Menu
- [x] OVERVIEW: Dashboard
- [x] CLINICAL TOOLS: UltrasoundAssist™ (hub)
- [x] CLINICAL TOOLS: POCUS-Assist™
- [x] CLINICAL TOOLS: Fetal EchoAssist™ Calculators
- [x] LEARNING: Daily Challenge
- [x] LEARNING: Ultrasound Flashcards
- [x] LEARNING: Case Library
- [x] LEARNING: Leaderboard
- [x] LEARNING: SoundBytes™
- [x] LEARNING: CME Hub
- [x] LEARNING: Learn Fetal Echo (link)
- [x] ACCREDITATION: Accreditation Navigator (hidden from public)
- [x] ACCREDITATION: DIY Accreditation (hidden from public)
- [x] COMMUNITY: Community link
- [x] PREMIUM: Premium Access

## UltrasoundAssist™ Hub (15 specialties)
- [x] Abdominal Ultrasound - Navigator + ScanCoach (Free)
- [x] Pelvic/Gyn Ultrasound - Navigator + ScanCoach (Free)
- [x] Obstetric 1st Trimester - Navigator + ScanCoach (Free)
- [x] Obstetric 2nd/3rd Trimester - Navigator + ScanCoach (Free)
- [x] Small Parts - Thyroid - Navigator + ScanCoach (Free)
- [x] Small Parts - Scrotum - Navigator + ScanCoach (Free)
- [x] Breast Ultrasound - Navigator + ScanCoach (Premium)
- [x] Vascular - Venous (Upper and Lower) - Navigator + ScanCoach (Premium)
- [x] Vascular - Arterial (Upper and Lower) - Navigator + ScanCoach (Premium)
- [x] Vascular - Abdominal/Renal Artery/Mesenteric - Navigator + ScanCoach (Premium)
- [x] Vascular - Abdominal Aorta/EndoLeak - Navigator + ScanCoach (Premium)
- [x] Vascular - Extracranial Carotid Artery - Navigator + ScanCoach (Premium)
- [x] Vascular - Intracranial Duplex/TCD - Navigator + ScanCoach (Premium)
- [x] MSK - Navigator + ScanCoach (Premium)
- [x] POCUS (Lung, eFAST, RUSH) - Navigator + ScanCoach (Free)

## POCUS-Assist™ (kept from original)
- [x] eFAST module - Navigator + ScanCoach (Free)
- [x] Cardiac POCUS module - Navigator + ScanCoach (Free)
- [x] RUSH Protocol module - Navigator + ScanCoach (Premium)
- [x] Lung POCUS module - Navigator + ScanCoach (Premium)
- [x] POCUS-Assist™ Calculators (IVC CI, B-line scorer, eFAST grader, RUSH grader)

## Fetal EchoAssist™ (kept from original)
- [x] Fetal Echo Navigator
- [x] Fetal Echo ScanCoach
- [x] FetalEchoAssist™ Calculators (6 calculators: CT ratio, cardiac axis, DV PI, MCA PSV, FHR, Ao/PA ratio)

## SoundBytes™ (Updated Mar 19)
- [x] SoundBytes page with category filters
- [x] All 16 categories available
- [x] Premium gating (sign-in required)
- [x] Admin: add/edit/delete SoundBytes

## Case Library
- [x] Case library page with category filters
- [x] All 16 categories available
- [x] Image/Video/Scenario case types
- [x] Premium gating (sign-in required)
- [x] Case submission by users
- [x] Admin: manage cases, publish/unpublish

## Ultrasound Flashcards
- [x] Flashcard page with category filters
- [x] All 16 categories available
- [x] 10 free cards/day limit for free members
- [x] Unlimited for premium members
- [x] Flip animation
- [x] Admin: add/edit/delete flashcards

## Daily Challenge
- [x] Daily challenge page
- [x] One question per day (MCQ A/B/C/D)
- [x] Streak tracking
- [x] Points system (10 correct, 2 wrong)
- [x] Leaderboard integration
- [x] Admin: create/manage challenges

## Leaderboard
- [x] Points-based leaderboard
- [x] User rankings with medals
- [x] Streak display

## Learn Fetal Echo
- [x] Course listing page with premium gating
- [x] Links to Thinkific Fetal Echo courses

## Premium Access
- [x] Premium upgrade page
- [x] Free membership info + registration link
- [x] $9.97/mo membership + registration link
- [x] $99.97/yr membership + registration link
- [x] Feature comparison table

## Auth & Membership
- [x] Thinkific webhook endpoint (/api/trpc/webhook.thinkific)
- [x] Membership tier sync from Thinkific (enrollment.created/updated/expired)
- [x] Premium gating logic throughout app
- [x] User profile available
- [x] Updated Thinkific product IDs to AAUS: premium=3714929, free=3714918
- [x] Updated Thinkific price IDs: free=4664963, monthly=4664974, annual=4664977

## Admin Panel
- [x] Admin dashboard with stats
- [x] User management
- [x] Content management (flashcards, cases, soundbytes, challenges)
- [x] Webhook configuration info
- [x] Accreditation Navigator (hidden from public)
- [x] DIY Accreditation (hidden from public)

## Testing
- [x] Auth/logout test
- [x] Thinkific webhook tests (free, premium, expiry)
- [x] Premium gating tests
- [x] Flashcard daily limit test
- [x] Case CRUD tests
- [x] SoundBytes tests
- [x] Daily challenge tests
- [x] Leaderboard tests
- [x] Admin stats tests
- [x] Category constants tests
- [x] All 33 tests passing
- [x] Thinkific API key verified (products fetch OK)
- [x] SendGrid API key verified (authenticated as Lara Williams / All About Ultrasound)
- [x] 733 tests passing across 36 test files (all credentials live)
- [x] Rewrote ultrasound.test.ts to match actual iHeartEcho router structure (40 tests)
- [x] Fixed auth.logout.test.ts sameSite assertion
- [x] Updated thinkific.test.ts to skip live API tests gracefully
- [x] Updated sendgrid.test.ts to skip gracefully when key not set
- [x] 733 total tests passing (36 test files)
- [x] Fixed quickfire.archiveEdit.test.ts category value (Adult Echo → Abdominal) after AAUS migration

## UI Exact Match Rebuild (Priority)
- [ ] Re-examine original EchoAssist Navigator UI (progress bars, step tracking, colors)
- [ ] Re-examine original EchoAssist ScanCoach UI (view cards, technique/findings layout)
- [ ] Re-examine original app sidebar colors and active states
- [ ] Re-examine original app hub/specialty card layout
- [ ] Rebuild Navigator component with exact progress bars and step-by-step UI
- [ ] Rebuild ScanCoach component with exact view card layout
- [ ] Match all colors to original (dark navy sidebar, card styles, etc.)
- [ ] Match specialty hub card grid to original
- [ ] Match POCUS-Assist UI to original
- [ ] Match Fetal EchoAssist UI to original

## Brand Colors
- [ ] All pages use AAUS brand colors: #189aa1 teal, #4ad9e0 aqua, #0e4a50 dark teal, #0e1e2e dark navy
- [ ] No off-brand colors in Navigator or ScanCoach pages

## SEO Fixes
- [x] Fix homepage title (30–60 chars)
- [x] Add meta description (50–160 chars)
- [x] Add keywords meta tag

## UI Changes
- [ ] Reorder all specialty lists to: Abdomen, Pelvic/Gyn, OB 1st Trimester, OB 2nd/3rd Trimester, Fetal Echo, Venous, Arterial, Abdominal Vascular, Extracranial Carotid, Intr- [x] Reorder specialties: Abdomen, Pelvic/Gyn, OB 1st, OB 2nd/3rd, Fetal Echo, Venous, Arterial, Abdominal Vascular, Extracranial Carotid, Intracranial/TCD, POCUS, Physics
- [x] Update navigator gating: Free=Abdomen,Pelvic/Gyn,OB1st,Fetal Echo,Extracranial Carotid,POCUS; Premium=others
- [x] Update ScanCoach gating: Free=Abdomen,Pelvic/Gyn,OB1st; Premium=all others
- [x] All navigators/ScanCoaches require minimum free registered user
- [x] Rename “UltrasoundAssist Community” → “All About Ultrasound Community” everywhere
- [x] Rename sidebar nav link “AAUS Community” → “Community Hub”
- [x] Remove “Learn Fetal Echo” dashboard card (keep sidebar nav link)
- [x] Rename POCUS Assist and Fetal Echo Calculators → “Ultrasound-Assist Calculators” across all pages
- [x] Rename sidebar nav link “AAUS Store” → “SonoShop”
- [x] Rename “Clinical Companion” → “Clinical Intelligence” everywhere
- [x] Update header: “All About Ultrasound” in white on top, “UltrasoundAssist™” below in smaller/secondary style
- [x] Upload new logo (SONORing4.webp) to CDN and update Layout.tsx + Enrolled.tsx (Login uses VITE_APP_LOGO — update via Settings → General)
- [x] Update app subtitle/description to: "Advanced, guideline-driven clinical intelligence app designed for sonographers, physicians, and ultrasound learners across general, vascular, and point-of-care imaging—serving as the ultimate pocket reference for real-time scanning and clinical decision support."t."
- [x] Remove Accreditation Navigator and DIY Accreditation cards from dashboard (hidden until requested)
- [x] Remove Accreditation Navigator and DIY Accreditation links from sidebar nav (hidden until requested)
- [x] Remove POCUS-Assist™ and Fetal EchoAssist™ direct dashboard cards (accessible via UltrasoundAssist™ pathway)
- [x] Remove POCUS-Assist™ and Fetal EchoAssist™ direct sidebar nav links (accessible via UltrasoundAssist™ pathway)

## Branding Fixes (Priority)
- [x] Fix login page: remove EchoAssist/echocardiography copy, updated to AAUS ultrasound branding
- [x] Fix sales/enrolled page: remove echo-specific copy, updated to AAUS ultrasound branding
- [x] Fix email templates: removed iHeartEcho/echo references, updated to AAUS, spam folder prompt mentions All About Ultrasound once
- [x] Fix all email links and page links to point to app.allaboutultrasound.com (not iheartecho)
- [x] Update PremiumLockOverlay, PremiumModal, CaseLibraryBanner upgrade URLs to member.allaboutultrasound.com
- [x] Fix test assertions: welcome-email logo CDN URL, footer URL, case rejection support email (733 tests passing)
- [ ] Update fetal echo navigator/references to cite ASE guidelines
- [ ] Update vascular navigators/references to cite SVU guidelines

## Reference Values (PubMed/PMC)
- Source: https://www.aliem.com/pv-card-ultrasound-measurements/ (ALIEM PV Card) + PMC cross-references
- [ ] Research PubMed/PMC normal reference values for all 12 anatomy categories
- [ ] Build reference value tables into each navigator page with PMC citations
  - [ ] Abdomen Navigator (liver, GB, bile ducts, pancreas, spleen, kidneys, aorta, IVC)
  - [ ] Pelvic/Gyn Navigator (uterus, endometrium, ovaries, follicles)
  - [ ] OB 1st Trimester Navigator (CRL, NT, GA, HR, GS, YS)
  - [ ] OB 2nd/3rd Trimester Navigator (BPD, HC, AC, FL, EFW, AFI, cervix)
  - [ ] Fetal Echo Navigator (cardiac dimensions, z-scores, CTR)
  - [ ] Venous Navigator (DVT criteria, vein diameters, waveforms)
  - [ ] Arterial Navigator (ABI, PSV, EDV, waveform criteria)
  - [ ] Abdominal Vascular Navigator (renal artery, celiac, SMA, portal vein)
  - [ ] Extracranial Carotid Navigator (IMT, PSV, EDV, stenosis grading)
  - [ ] Intracranial Duplex/TCD Navigator (MCA, ACA, PCA, basilar PSV)
  - [ ] POCUS Navigator (IVC, LVEF, lung B-lines, FAST criteria)
  - [ ] Physics (not applicable — conceptual content only)

## Admin & Feature Alignment
- [x] Audit admin features vs iHeartEcho and identify gaps
- [x] Fix premium gate transparency (same blur/overlay style as iHeartEcho)
- [x] Seed leaderboard with realistic pre-populated user profiles (RDMS/RVT/RVS/RMSK/RPVI/RPhS/RDCS/RCS/MD — 40% non-credentialed)
- [x] Generate and insert 300 flashcards spread across all 16 AAUS categories
- [x] Verify and fix AI case generator for AAUS category types (updated prompts, AIUM/SVU/ACR/ARDMS guidelines)

## Bugs
- [x] Fix magic link 404 — /auth/magic route returns 404 on published app (added /auth/magic route in App.tsx)
- [x] Magic link login fails on app.allaboutultrasound.com — "failed query" DB error (missing users columns — fixed via ALTER TABLE)
- [x] Thinkific webhook: new enrollments create free members only, welcome email suppressed
- [x] Migrate all users from iHeartEcho database to UltrasoundAssist database (11,753 users migrated, 0 errors)
- [x] Audit and align all auth gates to match iHeartEcho (protectedProcedure, premiumProcedure, adminProcedure)
- [x] Audit and align all access rules (premium gating, free limits, DIY roles)
- [x] Audit and align all notification rules (challenge reminders, email scheduler)
- [x] Fix Thinkific webhook product matchers for AAUS product names, suppress welcome email
- [x] Replace all iHeartEcho™ brand text with All About Ultrasound™ across entire codebase (UI, emails, logs, comments)

## Branding Copy Fixes (Mar 19 — continued)
- [x] SoundBytes: rebuilt with iHeartEcho-style hero banner + AAUS branding
- [x] Case Library: renamed Echo Case Library → Ultrasound Case Library throughout
- [x] CaseLibraryBanner: updated title, subtitle, and description copy
- [x] FlashcardsBanner: updated title (Echo Flashcards → Ultrasound Flashcards) and description
- [x] DailyChallengeBanner: updated subtitle and description (echo → ultrasound terminology)
- [x] Flashcards daily limit gate: updated premium copy to All About Ultrasound™

## Branding Copy Fixes (Mar 19)
- [x] Login page: normalize "All About Ultrasound" → "All About Ultrasound™" (no double TM or plain variant)
- [x] Login page: change sign-in CTA to "Sign in to All About Ultrasound™ — UltrasoundAssist™"
- [x] Login page: remove PMC-cited references from ad copy; use "guideline-based" only
- [x] Login page: remove "General & Vascular Ultrasound Clinical Intelligence" → "Ultrasound Clinical Intelligence"
- [x] Emails: change "General & Vascular Ultrasound Clinical Intelligence" → "Ultrasound Clinical Intelligence"
- [x] Emails: sign-in links say "Sign in to All About Ultrasound™ — UltrasoundAssist™"
- [x] Ad copy everywhere: replace specific guideline citations with "guideline-based"

## Navigator Progress Bar
- [x] Add ProtocolProgressBar shared component (sticky, animated fill, color transitions, Reset button)
- [x] Applied to all 20 navigators (16 specialty + 4 POCUS)

## Perinatology.com Ultrasound Calculators
- [ ] Audit perinatology.com/calculators2.htm and identify ultrasound-relevant calculators
- [ ] Implement identified calculators in the UltrasoundAssist Calculators section

## Calculator Hubs (Mar 19)
- [ ] OB/Gyn Calculator hub (perinatology.com ultrasound calcs + guideline-based)
- [ ] Abdominal/Small Parts Calculator hub (liver, GB, bile duct, spleen, kidney, thyroid, testis, aorta)
- [ ] Vascular Calculator hub (ABI, stenosis grading, IVC CI, DVT Wells, CIMT, RI)
- [ ] Breast Calculator hub (BI-RADS risk, lesion volume, malignancy probability)
- [ ] Wire all calculator hubs into the existing Calculators navigation entry

## SWE + UDFF Integration (Mar 19)
- [x] Add SWE protocol section to Abdominal Navigator (liver SWE, ARFI, 2D-SWE, pSWE — fibrosis staging)
- [x] Add UDFF section to Abdominal Navigator (steatosis grading S0-S3)
- [x] Add SWE to Abdominal ScanCoach (technique tips, vendor notes, pitfalls)
- [ ] Add SWE + UDFF to Abdominal Calculator hub (liver stiffness staging, UDFF % → steatosis grade)
- [x] Add SWE protocol section to Breast Navigator (lesion stiffness, BI-RADS SWE criteria)
- [x] Add SWE to Breast ScanCoach (technique tips, vendor notes, pitfalls)
- [ ] Add SWE to Breast Calculator hub (lesion stiffness kPa/m/s → malignancy risk)
