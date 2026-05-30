# UltrasoundAssist™ App TODO

## Lesson Quiz & Flashcard Blocks (May 2026)
- [x] Add lesson_quiz and lesson_flashcard to BlockType union in BlockPreview.tsx
- [x] Add lesson_quiz and lesson_flashcard to BLOCK_CATALOG in LandingPageBuilder.tsx
- [x] Create LessonQuizBlockEditor component with AI generation + manual entry + image uploads
- [x] Create LessonFlashcardBlockEditor component with AI generation + manual entry + image uploads
- [x] Add generateQuizFromLesson and generateFlashcardsFromLesson tRPC procedures in lmsRouter
- [x] Add BlockPreview rendering for lesson_quiz and lesson_flashcard block types
- [x] Add lesson_quiz and lesson_flashcard player in CoursePlayer (student view)

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
- [x] Fetal Echo ScanCoach (dedicated /fetal-scan-coach route — fixed 404 from FetalNavigator)
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
- [x] Redesign leaderboard: category tabs (Overall/Challenge/Cases/Flashcards), period tabs (All Time/Month/Week), points display, How Points Work sidebar
- [x] Backend: getLeaderboard uses userPointsTotals (all-time) and userPointsLog (month/week) with category filters
- [x] Fix FlashcardDeck.tsx IHE_CATEGORIES to use actual DB echoCategory values (adult, pocus, acs, pediatric_congenital, fetal)
- [x] Add brand-specific display offset to stats.userCount (iHeartEcho +3997)

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

## Features
- [x] Add Course Curriculum block to funnel pages — added getCurriculumById server procedure, CurriculumCourseSelector in BlockSettings, and FunnelCurriculumBlock renderer in PublicFunnelPage

## Bugs
- [x] Fix drag-and-drop in all page builders (LandingPageBuilder, DownloadLandingPageBuilder, ProductLandingPageBuilder, FunnelPageEditor, FunnelBuilder, LessonBlockEditor) — applied restrictToFirstScrollableAncestor modifier to fix overflow-y-auto parent issue
- [x] Fix save-as-template in all page builders — added proper dialog + mutation + onSaveAsTemplate prop to all builders (was missing or no-op in Download, Product, Lesson, Funnel builders)
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

## iHeartEcho-Style Gating Rules (Mar 19)
- [ ] Daily Challenge: not-logged-in → see banner + blurred preview, must sign in to play; free → today's challenge only (all categories); premium → today + full archive + leaderboard
- [ ] Daily Challenge: archive tab locked for free members with upgrade prompt overlay
- [ ] Daily Challenge: leaderboard tab locked for free members with upgrade prompt overlay
- [ ] Flashcards: not-logged-in → see banner + blurred card deck, must sign in; free → 10 cards/day randomized, after limit show upgrade overlay; premium → unlimited randomized
- [ ] Flashcards: daily limit counter visible in header for free members; resets at midnight
- [ ] Flashcards: category filter available to all logged-in members; premium badge on premium-only categories
- [ ] Case Library: not-logged-in → see banner + blurred case list, must sign in; free → can view all published cases; premium → can submit cases + access premium case types
- [ ] Case Library: case submission locked for free members with upgrade prompt
- [x] SoundBytes: not-logged-in → see banner + blurred list, must sign in; free → first 3 clips per category free; premium → all clips unlocked
- [ ] SoundBytes: rebuild card layout to match iHeartEcho (thumbnail, title, category badge, duration, lock icon for premium)
- [ ] All four pages: consistent lock overlay style — blurred content + teal upgrade CTA card centered

## Dashboard Banner Stats (Mar 19)
- [x] Remove Day Streak, Points, and Questions Answered stats from dashboard hero banner (keep on Daily Challenge page only)

## Dashboard Hero CTAs (Mar 19)
- [x] Add iHeartEcho-style CTA buttons to dashboard hero: "Open UltrasoundAssist™", "Daily Challenge", "allaboutultrasound.com"
- [x] Add stats row below hero (Calculators count, Cases count, Protocols covered, Members)

## Flashcards Fixes (Mar 19)
- [x] Rename "Echo Flashcards" to "Ultrasound Flashcards" everywhere (page heading, sidebar, banner)
- [x] Remove cards-available count from FlashcardsBanner
- [x] Match iHeartEcho random card rotation on page load (shuffle on mount, not just on category change)

## PWA "Get App" Install Banner (Mar 19)
- [ ] Add web app manifest (manifest.json) with app.allaboutultrasound.com start_url, AAUS icons, theme colors
- [ ] Add service worker registration for PWA installability
- [ ] Create GetAppBanner component — iHeartEcho-style bottom banner with "Add to Home Screen" CTA
- [ ] Show banner on first visit (after 3s delay), dismiss with X, remember dismissal in localStorage
- [ ] iOS Safari: show custom instructions overlay (iOS doesn't support beforeinstallprompt)
- [ ] Android/Chrome: use native beforeinstallprompt event for one-tap install
- [ ] Wire GetAppBanner into DashboardLayout so it appears on all pages

## PWA "Get App" Install Banner (Mar 19)
- [x] Create manifest.json with AAUS branding, start_url: https://app.allaboutultrasound.com/
- [x] Create sw.js service worker for PWA installability
- [x] Create GetAppBanner component — fixed bottom bar, 3s delay, Android native prompt + iOS instructions
- [x] Wire GetAppBanner into App.tsx
- [x] Dismiss remembered in localStorage for 30 days
- [x] Upload 192x192 and 512x512 AAUS icons to CDN for manifest

## TM Symbol & Description Fixes (Mar 19)
- [x] Add ™ to all uses of "All About Ultrasound" that are missing it (all files — 26 files fixed, 0 remaining)
- [x] Update dashboard hero description subtext to user-specified copy

## Live Member Counter (Mar 19)
- [x] Add tRPC publicProcedure to return live registered user count from DB
- [x] Wire Members stat on dashboard hero to live count with count-up animation
- [x] Match iHeartEcho behavior: animate on mount, show real number

## Calculators Route Fix (Mar 19)
- [ ] Fix Calculators page 404 — register route in App.tsx
- [ ] Add Calculators link to sidebar navigation under Clinical Tools

## Get App Banner & Calculators Route (Mar 19)
- [ ] Get App banner: show on every dashboard page load on mobile unless PWA already installed
- [ ] Remove 30-day dismiss localStorage — show every time on dashboard load
- [x] Fix Calculators 404 — registered /calculators route in App.tsx, fixed Home.tsx module card path
- [x] Add Calculators sidebar nav link under Clinical Tools

## Flashcard Daily Limit Fix (Mar 19)
- [x] Fix daily limit: 10 total cards per day across ALL categories (not 10 per category)
- [x] Server now queries global daily count (no cardIds filter) so switching categories does not reset the count

## Sidebar Calculators Link (Mar 19)
- [x] Add UltrasoundAssist™ Calculators link to sidebar under Clinical Tools

## Calculators Page Expansion (Mar 19)
- [x] Add Abdominal tab: liver stiffness 2D-SWE (kPa) + pSWE/ARFI (m/s), UDFF steatosis S0-S3, gallbladder wall, spleen size
- [x] Add Breast tab: SWE kPa + m/s malignancy risk, lesion-to-fat ratio, BI-RADS SWE adjunct
- [x] Add Vascular tab: ABI, IVC-CI, carotid stenosis (NASCET/SRU), RVSP, DVT Wells score
- [x] Add breadcrumb back-link to UltrasoundAssist™ hub on Calculators page
- [x] Refactored to per-card state (CalcCard component) so each calculator has independent inputs and results

## Daily Challenge Categories Update (Mar 19)
- [ ] Replace all Daily Challenge / QuickFire categories with: Abdominal, OB/Gyn, Small Parts, Breast, Vascular, MSK, POCUS
- [ ] Update Flashcards categories to match
- [ ] Update DB seed / router category enums
- [ ] Update QuickFire UI category filter buttons

## Profile Menu Updates (Mar 19)
- [x] Match iHeartEcho profile menu roles exactly: same role checks (diy_user, diy_admin, platform_admin, accreditation_manager)
- [x] Add EducatorAssist™ menu item — visible only for platform_admin / admin role users
- [x] Rename "Submit an Echo Case" → "Submit Ultrasound Case" in profile menu and anywhere else it appears

## iHeartEcho-Style Gating Rules (Mar 19)
- [x] Fix Flashcards.tsx: pass dynamic isPremium to FlashcardsBanner (not hardcoded false)
- [x] Fix UltrasoundAssist Hub: show proper lock overlay on locked navigator cards — amber corner badge + Lock icon + click-anywhere-to-upgrade
- [x] Verify BlurredOverlay premium CTA links to correct AAUS premium/upgrade page (/premium)
- [x] Add login-gate BlurredOverlay to Flashcards category selector page for unauthenticated users (already implemented)

## Registry Review Hub (Mar 19)
- [x] Build RegistryReviewHub.tsx page matching iHeartEcho structure
- [x] Add /registry-review route in App.tsx
- [x] Add Registry Review Hub link to sidebar nav in Layout.tsx

## Daily Challenge Category Fix (Mar 19)
- [ ] Rename "Thyroid" category → "Small Parts" in QuickFire frontend CATS array
- [ ] Update server-side category map to map "Small Parts" to both thyroid and scrotum question tags
- [ ] Ensure existing Thyroid questions are re-tagged to "Small Parts" in the DB
- [ ] Ensure existing Scrotum questions are tagged to "Small Parts" in the DB

## Daily Challenge Category Restructure (Mar 19)
- [ ] Rename OB 2nd/3rd Trimester → OB/Gyn in CHALLENGE_CATEGORIES and CAT_KEY
- [ ] Add Small Parts (Thyroid+Scrotum), Vascular (Venous+Arterial), MSK categories
- [ ] Update parseDailySetIds defaults and ensureTodaySet to use new 6-cat system
- [ ] Update getCategoryPrefs / updateCategoryPrefs prefs schema
- [x] Update QuickFire.tsx CATS array and prefs UI to use Vasculartry Review Hub to sidebar nav and App.tsx route

## Daily Challenge Full Category Restructure (Mar 19 - updated)
- [ ] Server: CHALLENGE_CATEGORIES = Abdominal, OB/Gyn, Small Parts, Vascular, MSK, POCUS
- [ ] Server: CAT_KEY maps obgyn, smallparts, vascular, msk
- [ ] Server: OB/Gyn fallback pool = pelvic_gyn + obstetric_1st + obstetric_2nd_3rd questions
- [ ] Server: Small Parts fallback pool = thyroid + scrotum questions
- [ ] Server: Vascular fallback pool = venous + arterial questions
- [ ] Server: Update parseDailySetIds defaults to new 6-key system
- [ ] Server: Update getCategoryPrefs / updateCategoryPrefs prefs schema
- [ ] Frontend: QuickFire.tsx CATS array updated to 6 new categories
- [ ] Frontend: Prefs UI updated (toggle labels)
- [ ] Frontend: Category filter labels updated
- [x] Registry Review Hub page created and route wired in App.tsx
- [x] Registry Review Hub sidebar link added (user explicitly requested)

## Admin QuickFire Category Update (Mar 19)
- [x] Update QuickFireAdmin.tsx category dropdown to include Vascular (alongside existing categories)
- [x] Update quickfireRouter.ts CHALLENGE_CATEGORIES and CAT_KEY to include Vascular
- [x] Migrate existing Venous quickfireQuestions → category "Vascular" in DB (0 questions, all were Arterial)
- [x] Migrate existing Venous quickfireChallenges → category "Vascular" in DB (20 challenges migrated)
- [x] Update server-side fallback pool for Vascular to pull from venous + arterial echoCategory questions

## Registry Review Hub Fix (Mar 19)
- [x] Remove category filter/list from Registry Review Hub — show all courses without category grouping

## Registry Review Hub Placement (Mar 19)
- [x] Move Registry Review Hub sidebar link to after CME Hub
- [x] Add/move Registry Review Hub dashboard card to after CME Hub card
- [x] Remove category filter/list from Registry Review Hub page (also removed category badge on course cards)

## Registry Review Hub Text Updates (Mar 19)
- [ ] Change description language to "comprehensive review courses and test & learn quizzes"
- [ ] Add ™ to all "All About Ultrasound" references on the Registry Review Hub page

## Registry Review Hub Text Updates (Mar 19)
- [x] Change description language to "comprehensive review courses and test & learn quizzes"
- [x] Add ™ to all "All About Ultrasound" references on the Registry Review Hub page
- [x] Remove all "email is pre-filled" / "checkout links are pre-filled" references
- [x] Updated Home.tsx dashboard card description to match

## Admin QuickFire Queue - Category Sort & Feature Parity (Mar 19)
- [x] Audit iHeartEcho admin QuickFire queue for all admin features vs UltrasoundAssist™ (full tRPC parity confirmed)
- [x] Add category filter dropdown to challenge queue header (filter by any category)
- [x] Category filter applied to queued challenges list (live challenges always shown)

## Admin Queue Randomize Order (Mar 19)
- [x] Add "Randomize Order" button to challenge queue — shuffles queued challenges within the selected category filter, interleaving sub-areas to avoid content clustering
- [x] Shuffle uses Fisher-Yates algorithm and calls adminReorderChallenges to persist the new order
- [x] Button label dynamically shows "Randomize Vascular" (or whichever category is selected) vs "Randomize All" when no filter is active

## Bug: Explanation Field Too Short (Mar 19)
- [x] Fix "Too big: expected string to have <=2000 characters" error on explanation field when adding challenge questions to queue — increased explanation/reviewAnswer to 50,000 chars, question to 10,000 chars across all procedures

## Bulk Select & Duplicate Prevention (Mar 19)
- [ ] Remove 20-item bulk-select cap in admin question bank (challenges)
- [ ] Enforce no-duplicate question IDs across challenges (server + UI warning)
- [ ] Apply same duplicate prevention to Flashcards admin
- [ ] Apply same duplicate prevention to Case Studies admin
- [ ] Match iHeartEcho question ID assignment rules

## Challenge Card Generator (Mar 21)
- [x] ChallengeCardGenerator.tsx component created with UltrasoundAssist branding
- [x] LOGO_URL and HERO_URL set to correct CDN assets
- [x] Hashtags and social post text updated for ultrasound (not echo)
- [x] Route /admin/challenge-cards registered in App.tsx (admin-only via RoleGuard)
- [x] Challenge Card Generator link added to PlatformAdmin admin tools hub

## Add MSK as 5th Daily Challenge Category (Mar 21)
- [ ] Server: Add "MSK" to CHALLENGE_CATEGORIES in quickfireRouter.ts
- [ ] Server: Add MSK fallback pool (msk echoCategory questions)
- [ ] Frontend: Add MSK to CATS array in QuickFire.tsx
- [ ] Frontend: Add MSK to category filter in QuickFireAdmin.tsx
- [ ] ChallengeCardGenerator: Add MSK to CATEGORY_HASHTAGS

## Challenge Card Generator — 30-Day Navigation (Mar 21)
- [ ] Server: Update adminGetCardGeneratorData to accept optional date param
- [ ] Server: Add adminGetCardGeneratorRange procedure — returns up to 30 days of sets
- [ ] ChallengeCardGenerator: Add date selector / next-set / previous-set navigation
- [x] ChallengeCardGenerator: Show date label (Today / Yesterday / Mar 20 etc.)
- [ ] ChallengeCardGenerator: Add MSK to CATEGORY_HASHTAGS

## Social Post Full Text (Mar 21)
- [x] Remove 160-char question preview truncation in buildSocialPost
- [x] Remove 200-char explanation truncation in buildSocialPost

## Challenge Card Generator — 30-Day Navigation (Mar 21 — implementing)
- [x] Server: Add adminGetCardGeneratorForDate procedure (accepts date param, returns per-category challenge+questions for that date's daily set)
- [x] Server: Add adminListCardGeneratorDates procedure (returns list of up to 30 available set dates)
- [x] ChallengeCardGenerator: Add selectedDate state (default = today)
- [x] ChallengeCardGenerator: Add Previous/Next set navigation buttons in header
- [x] ChallengeCardGenerator: Show date label (Today / Yesterday / Mar 20 etc.)
- [x] ChallengeCardGenerator: Disable Next when on today, disable Previous when at 30-day limit
- [x] ChallengeCardGenerator: Update batch download filename to include date

## Challenge Card Generator — Date Picker Dropdown (Mar 21)
- [x] Add date picker dropdown (select) next to navigation arrows to jump to any date in 30-day window

## Challenge Card Generator — Filename Convention (Mar 21)
- [x] Ensure individual card downloads include date in filename (category-date-question.png)
- [x] Ensure batch ZIP filename includes date (already done for batch, verify individual)
- [x] No date label added to card image itself

## Challenge Card Generator — Card Option Overflow Fix (Mar 21)
- [x] Remove fixed 1080x1080 height constraint so cards auto-size to content
- [x] Reduce font sizes and padding to fit long options without clipping
- [x] Ensure QuestionCard and AnswerCard both show all options at all times

## Challenge Queue — Per-Category Count Badges (Mar 21)
- [ ] Server: Add adminGetQueueCategoryCounts procedure returning count per category for queued challenges
- [ ] UI: Show per-category count badges in the QuickFireAdmin queue management view

## Category Standardisation (Mar 21)
New canonical list: Abdominal, Small Parts, Pelvic/Gyn, OB 1st Trimester, OB 2nd/3rd Trimester, Fetal Echo, Breast, Vascular, MSK, POCUS
- [ ] Update QuestionCategory type in QuickFireAdmin.tsx
- [ ] Update all category SelectItem lists in QuickFireAdmin.tsx (question bank filter, challenge form, flashcard filter)
- [ ] Update CHALLENGE_CATEGORIES in quickfireRouter.ts
- [ ] Update CAT_KEY mapping in quickfireRouter.ts
- [ ] Update category enum/type in drizzle/schema.ts for questions and challenges
- [ ] Update category lists in ChallengeCardGenerator.tsx (CATEGORY_HASHTAGS, CATS)
- [ ] Update case library category dropdowns in CaseAdmin / CaseLibrary pages
- [ ] Update flashcard category filter in QuickFireAdmin flashcard tab
- [ ] Run DB migration if enum columns need updating
- [x] Add CTA to social posts: "Get more challenges and take your place on the leaderboard 🏆 at app.allaboutultrasound.com"
- [ ] Relabel "Abdominal" calculator category to "Abdominal/Small Parts"
- [ ] Add TI-RADS Auto Calculator to the calculators section

## Clinical Interpretation Engine (Mar 21)
- [ ] Build ClinicalInterpretationEngine.tsx with all category tools
- [ ] Abdominal: LI-RADS, Liver Steatosis, Gallbladder Wall, Spleen Size, Renal Cortex Grader
- [ ] Small Parts: TI-RADS Auto-Calculator, Testicular Microlithiasis Risk
- [ ] Pelvic/Gyn: Endometrial Thickness, O-RADS, Uterine Fibroid FIGO, PCOM Detector
- [ ] OB 1st Trimester: Gestational Age/Viability, NT Risk, Ectopic Risk
- [ ] OB 2nd/3rd Trimester: Fetal Growth Percentile, AFI, Cervical Length, Placenta Previa
- [ ] Fetal Echo: Cardiac Axis, Four-Chamber Flagging, Ductus Venosus
- [ ] Breast: BI-RADS Auto-Classifier, Implant Integrity
- [ ] Vascular: Carotid Stenosis Grader, Renal Doppler Decision Tool, DVT Scorer, AAA Planner, Portal HTN
- [ ] MSK: Rotator Cuff Tear, Achilles Tendinopathy, Joint Effusion
- [ ] POCUS: B-Line Congestion, FAST Interpreter, IVC CI, Bladder Volume, ONSD
- [ ] Register /clinical-interpretation route in App.tsx
- [ ] Add Clinical Interpretation Engine link to sidebar Clinical Tools section
- [ ] Relabel "Abdominal" to "Abdominal/Small Parts" in ObGynCalculators

## Queue Editor Fix (Mar 21)
- [x] Fix: Challenge queue items now open edit form on click (content area clickable, drag handle and delete button isolated with stopPropagation)

## Category Taxonomy Fix (Mar 21)
- [ ] Fix: Small Parts = Scrotum + Thyroid only. Remap misclassified questions: Liver → Abdominal, MSK → MSK (not Small Parts)
- [ ] Update any AI generator prompts or category routing that incorrectly assigns Liver/MSK to Small Parts

## Physics Category (Mar 21)
- [x] Add Physics as 11th category (DB enum, server, frontend, card generator)
- [x] Remap misclassified Small Parts physics questions → Physics
- [x] Remap misclassified Small Parts MSK questions → MSK
- [x] Update CATEGORY_HASHTAGS in ChallengeCardGenerator for Physics
- [x] Update flashcard filter buttons in QuickFireAdmin for Physics
- [x] Update challengeCron categories list for Physics
- [x] Update drizzle/schema.ts category enums for Physics

## Enrolled Page Fixes (Mar 21)
- [ ] Change "Your free membership is active" → "Your membership is active"
- [ ] Update card title from "Clinical Intelligence" → "Clinical Intelligence App"
- [ ] Ensure /enrolled page is accessible to both Free and Premium members (no auth gate blocking)

## Admin Daily Challenge Queue (Mar 21)
- [ ] Add refresh button to QuickFireAdmin challenge queue panel

## AI Generator & Queue Refresh (Mar 21)
- [ ] Add Physics as a clinical focus topic in the AI question generator
- [ ] Add refresh button to challenge queue admin panel

## Category Completeness Audit (Mar 21)
- [ ] Ensure all 11 categories available in Flashcards filters
- [ ] Ensure all 11 categories available in Cases filters
- [ ] Ensure all 11 categories available in SoundBytes filters
- [ ] Ensure all 11 categories available in Daily Challenge filters

## No-Repeat Deduplication (Mar 21)
- [x] Add user_seen_questions table to track seen flashcard/challenge question IDs per user per category
- [x] Update getFlashcardDeck procedure to exclude already-seen questions (reset when all exhausted)
- [x] Update daily challenge question selection to exclude questions seen in recent challenges
- [ ] Add reset endpoint so users can manually restart their seen-question pool

## One Live Per Category Per Day (Mar 21)
- [x] Enforce exactly one live challenge per category per day in ensureTodaySet and adminPublishNextChallenge
- [x] Archive previous live challenge for a category before publishing a new one for the same category
- [x] Update getLiveChallenge to return all live challenges (one per category)

## Challenge Queue Admin (Mar 22)
- [x] Always show all live questions pinned at top of challenge queue regardless of category filter or search

## UltrasoundAssist Hub Fixes (Mar 22)
- [x] Remove Fetal Echo from premium specialties array (it is already in free section)
- [x] Restore clinical intelligence engines section to the hub
- [x] Fix only one MSK challenge showing in daily challenge (all categories now use quickReview fallback)
- [x] Change challenge category icons so ECG/Activity icon is only used for Vascular; assign appropriate icons to all other categories
- [x] Daily challenge should display one question per category per day (all 11 categories visible as cards)

## Challenge Queue Admin Fixes (Mar 22 - session 2)
- [x] Add MSK and Breast to admin challenge queue category filter (pill badges are dynamic — now show all 11 categories)
- [x] Ensure 11 live challenges generated daily (one per all 11 categories) — fallback now creates live rows for MSK, Breast, POCUS
- [x] Fix UI to display all 11 category cards with questions
- [x] Remove all remaining legacy challenge wording from DailyChallenge.tsx and QuickFireAdmin.tsx

## Challenge Empty Category Handling
- [x] Alert admin via owner notification when any category has no available questions during daily set generation
- [ ] Public UI: show most recent archived question for a category if no live question exists (never show empty card)

## DailyChallenge UI Fixes (Mar 22 - session 3)
- [x] Fix questions not populating in the public daily challenge UI for all 11 categories (trashedAt migration + currentIndex reset on category switch)
- [ ] Remove all remaining legacy text from DailyChallenge.tsx
- [x] Re-seed 300+ pre-built archived challenges so they appear in the challenge archive tab (501 archived challenges now available)
- [x] Remove published dates from the challenge archive display
- [x] Add Edit and Delete buttons to live challenge cards in admin queue
- [x] Add server procedures: adminUpdateLiveChallenge and adminDeleteLiveChallenge (soft-delete to trash)
- [x] Add 'trash' status to quickfireChallenges schema with trashedAt timestamp (DB migration applied)
- [x] Add adminTrashChallenge procedure (adminDeleteChallenge now soft-deletes to trash, auto-promotes next queued challenge if live)
- [x] Add adminRestoreFromTrash procedure (restoreTrashedChallenge)
- [x] Add adminPurgeTrash procedure (purgeExpiredTrash now purges both questions and challenges older than 30 days)
- [x] Add Trash tab to admin challenge queue with restore/permanent delete options (challenges + questions sections)
- [x] Add Edit and Delete (to trash) buttons to live challenge cards in admin queue
- [x] Add trashedAt column to quickfireChallenges schema and run migration (questions use deletedAt)
- [x] Add adminTrashQuestion and adminRestoreQuestion procedures (deleteQuestion/restoreQuestion already existed)
- [x] Wire question bank delete button to trash instead of permanent delete
- [x] Show trashed questions in Trash tab with restore option
- [x] When a live challenge is deleted (trashed), auto-promote the next scheduled challenge for that category to live

## Admin Queue Live Challenge Buttons (Mar 22 - session 4)
- [x] Add Edit and Delete (to Trash) buttons to live challenge cards in the admin challenge queue

## Auto-Promote Fix (Mar 22 - session 4)
- [x] Fix: auto-promote works correctly; no queued POCUS challenges existed when tested (POCUS questions were inactive — now activated)

## Daily Challenge QR Cleanup (Mar 22 - session 4)
- [x] Remove QR questions from live daily challenges (Breast trashed; POCUS already trashed)
- [x] Admin UI still allows QR questions to be added to challenges in the future (no restriction added)

## Queue Status & QR Cleanup (Mar 22 - session 4)
- [x] Mark all existing draft challenges as scheduled (active) in the DB (no drafts existed — all were already scheduled)
- [x] Fix challenge creation so new challenges added to queue default to 'scheduled' not 'draft' (already was scheduled; fixed restore-from-trash to also use scheduled)
- [x] Trashed live Breast challenge (no MCQ replacement available — user will add Breast scenario questions)
- [x] Filter quickReview type questions out of auto-selection in getTodaySet/ensureTodaySet (already filtered; activated all inactive scenario questions across all categories)

## Question Preview in Admin Queue (Mar 22 - session 4)
- [x] Add a Preview button to challenge queue cards so admins can see how the question will display to members

## Preview Modal & Live Category Fix (Mar 22 - session 4)
- [x] Fix TypeScript errors in QuestionPreviewModal (questionIds ref + missing props)
- [x] Fix daily challenge so all 11 categories show as live (Breast and POCUS promoted to live)
- [x] Add flashcard totals by category to the admin UI (Flashcard Management tab)
- [x] Create live challenges for Breast and POCUS using available scenario questions

## Physics Flashcard Category Fix (Mar 22 - session 4)
- [x] Add all 11 daily challenge categories as echoCategory options in flashcard form (Physics was missing)
- [x] Re-assign the 20 recently added Physics flashcards to echoCategory = 'physics'
- [x] Add echoCategory selector to flashcard creation/edit form (currently missing — all flashcards default to abdominal)
- [x] Re-assign recently added Fetal Echo flashcards to echoCategory = 'fetal_echo'
- [x] Fix AI flashcard generation to pass echoCategory from the form (Physics added to quick-topic buttons)
- [x] Fix flashcard edit button: now populates echoCategory from existing question data
- [x] Fix hub page challenge question display: getTodaySet now always syncs from live challenges, overriding stale stored IDs
- [x] Fix POCUS live challenge: updated daily set row to use correct question IDs from live challenges

## Daily Challenge Question Click Fix (Mar 22 - session 5)
- [x] Fix: clicking a category card on the daily challenge page shows no question or wrong question (removed && q guard from click handler, added loading spinner and sign-in CTA)
- [x] Add sign-in CTA when an unauthenticated user clicks a category card (daily challenge is free for all registered users)

## Definitive Daily Challenge Fix (Mar 22 - session 6)
- [x] Definitively fix daily challenge: store question object directly in state on click (eliminates re-derivation timing issue)

## MediaDropzone Integration (Mar 22 - session 7)
- [x] Create MediaDropzone reusable component with global drag-event prevention (window-level dragover/drop preventDefault)
- [x] Replace challenge image upload zone in QuickFireAdmin with MediaDropzone
- [x] Replace flashcard image upload zone in QuickFireAdmin with MediaDropzone
- [x] Replace flashcard video upload zone in QuickFireAdmin with MediaDropzone
- [x] MediaDropzone supports both image and video uploads with inline preview
- [x] MediaDropzone shows drag-over highlight state (teal border + scale)
- [x] MediaDropzone accessible (role=button, keyboard Enter/Space triggers file picker)
- [x] Unit tests for MediaDropzone upload logic (5 tests passing)
- [x] All 742 tests passing after integration

## Case Library Randomization (Mar 22 - session 7)
- [x] Add "random" as default sort option in listCases procedure (LCG hash on case ID)
- [x] Update sortBy enum to include "random" and default to "random"
- [x] Update CaseLibrary.tsx frontend to reflect new default sort ("Mixed Order" option)
- [x] Keep "newest" and "mostViewed" sort options available
- [x] Add 4 unit tests for sortBy enum validation (746 tests passing)

## Daily Challenge Auto-Posting Fix (Mar 23 - session 8)
- [x] Diagnose: 475 challenges in 'scheduled' status with NULL publishDate; cron only picked up 'queued' status
- [x] Fix cron to treat both 'queued' AND 'scheduled' (with null/past publishDate) as the publish pool
- [x] Remove strict 6:00-6:09 AM window; cron now publishes any time after 6 AM ET if today's challenges are missing (catch-up logic)
- [x] Immediately published 11 challenges for today (one per category) via SQL
- [x] Added adminTriggerDailyChallenges tRPC procedure for manual admin override
- [x] Cron confirmed working: logs show 'Already published challenges for 2026-03-23, skipping' on next run

## Thinkific Member Import Fix (Mar 23 - session 8)
- [x] Audit: webhook receives stub payloads {id:111} (test events); all 37 enrollment events were ignored
- [x] Root cause: 13,672 Thinkific users vs 11,754 in DB — ~1,918 members missing
- [x] Fixed upsertUser to activate pending accounts by email on first OAuth login (no duplicate rows)
- [x] Suppressed all welcome emails from webhook — emails only fire on explicit registration/login
- [x] Created thinkificMemberSync.ts: runs every 6 hours, imports all new Thinkific members as pending
- [x] Wired job to server startup (startThinkificMemberSync in _core/index.ts)
- [x] Updated syncAllThinkificMembers admin procedure to delegate to the shared job
- [x] First sync run started at 14:40 UTC — importing ~1,918 missing members
- [x] All 746 tests passing after changes

## Challenge Email Language Fix (Mar 24)
- [x] Fixed email subject: "Today's Echo Challenges" → "Today's Ultrasound Challenges"
- [x] Fixed fallback username: "Echo Enthusiast" → "Ultrasound Enthusiast"
- [x] Fixed fallback category: "Echo" → "Ultrasound"
- [x] Fixed HTML title: "Daily Echo Challenges" → "Daily Ultrasound Challenges"
- [x] Fixed physician over-read email: "echocardiogram study" → "ultrasound study"
- [x] All 746 tests passing after changes

## US English Spelling & Date Format Audit (Mar 24)
- [x] Fixed challenge email date format to "Month DD, YYYY" (e.g., March 24, 2026) using todayETLong()
- [x] Audited all email templates, client UI pages, and server strings for non-US English spelling
- [x] Fixed all occurrences across 12 files: oedema→edema, optimise→optimize, visualise→visualize, orthopaedic→orthopedic, colour→color, behaviour→behavior, labour→labor, favour→favor, programme→program, dialogue→dialog, defence→defense, licence→license, practise→practice
- [x] Zero non-US English spellings remain (verified with grep)

## Dashboard Card Addition (Mar 24)
- [x] Add Clinical Intelligence card between Calculators and Daily Challenge cards on dashboard

## Case Library Tiered Access (Mar 24) — SUPERSEDED by implementation below

## Case Library Tiered Access (Mar 24)
- [x] Created userCaseViews table (userId + caseId unique index) for tracking distinct cases opened per user
- [x] Applied DB migration: CREATE TABLE userCaseViews
- [x] Updated getCase to enforce tiered limits: free users (no thinkificEnrolledAt) = 1 case, non-premium Thinkific members = 10 cases, premium/admin = unlimited
- [x] Updated listCases to return accessStatus (isPremium, isFreeUser, caseLimit, casesViewed, limitReached) for frontend
- [x] Built upgrade prompt page in CaseDetail.tsx for FREE_LIMIT_REACHED and PREMIUM_LIMIT_REACHED errors
- [x] Added access status banner to CaseLibrary.tsx showing cases viewed / limit with upgrade CTA
- [x] Updated caseLibrary.auth.test.ts to cover new tiered access model (5 tests)
- [x] 747 tests passing after all changes

## SonoQuiz — Live Kahoot-Style Quiz Platform (Mar 25) — COMPLETED
- [x] Added 5 new DB tables: sonoQuizSessions, sonoQuizParticipants, sonoQuizAnswers, sonoQuizSessionEvents, sonoQuizMusicTracks
- [x] Applied DB migration for all new tables
- [x] Built sonoQuizRouter.ts: 18 procedures (listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz, upsertQuestion, deleteQuestion, reorderQuestions, createSession, getSession, joinSession, startSession, advanceQuestion, endSession, submitAnswer, getLeaderboard, getSessionByCode, listSessions)
- [x] Built sonoQuizHub.ts: WebSocket hub for real-time events (question_started, answer_locked, question_results, session_ended, participant_joined)
- [x] Built SonoQuizCreator.tsx: quiz list, create/edit quiz, question editor with media URL, per-question time limit, music selection, theme picker, answer options
- [x] Built SonoQuizHost.tsx: session launch, QR code (qrcode.react), participant list, advance questions, live results bar chart, leaderboard, end session
- [x] Built SonoQuizPlay.tsx: join by code, anonymous ultrasound-themed name picker, countdown timer, answer selection, score reveal, final leaderboard
- [x] Admin-only routes: /admin/sonoquiz (creator), /admin/sonoquiz/host/:sessionId (host) — platform_admin only
- [x] Student play route: /quiz/:joinCode — public (no auth required to play)
- [x] No public nav links or dashboard cards — hidden from all non-admin users
- [x] 747 tests passing after implementation

## Unsubscribe Link Fix & GIF Search (Mar 25)
- [ ] Diagnose broken unsubscribe link in challenge emails
- [ ] Fix unsubscribe endpoint and token generation
- [ ] Add GIF/media search widget to SonoQuiz question editor
- [x] Restrict daily challenge emails to users who have logged in at least once (isPending = false)
- [x] Fix broken unsubscribe link in challenge emails (shows Invalid Link)
- [x] Sync iHeartEcho unsubscribe list into UltrasoundAssist to prevent cross-posting (shared DB — already unified)
- [x] Add unsubscribed emails to SendGrid Global Unsubscribe list for cross-app suppression
- [x] SendGrid Event Webhook handler for unsubscribe/spamreport events
- [ ] Replace old iHeartEcho categories in ScanCoach editor with correct ScanCoach options
- [x] Replace old iHeartEcho categories in ScanCoach editor with correct ScanCoach options (keep only Fetal Echo + 4 POCUS modules)
- [x] Fix Vite HMR WebSocket connection error in sandboxed preview
- [x] Add all UltrasoundAssist ScanCoach modules to the editor registry (19 modules: 14 specialty + Fetal Echo + 4 POCUS)
- [ ] Fix ScanCoach editor admin page to show all 19 modules (not just old iHeartEcho ones)
- [x] Rename "Clinical Echo Image" to "Clinical Ultrasound Image" in ScanCoach editor
- [x] Reorder abdominal ScanCoach views: Pancreas, Aorta, IVC, Liver, Gallbladder/Biliary, Kidneys, Spleen
- [ ] Add Learn Echo and Learn POCUS sidebar nav links after Learn Fetal Echo
- [ ] Build admin panel "Menu Links" section to manage URLs for Learn Fetal Echo, Learn Echo, Learn POCUS
- [ ] Fix raw JSON tips rendering in AbdominalScanCoach (tips showing as objects not text)
- [ ] Move SWE/UDFF section to Liver only in AbdominalScanCoach (not Pancreas)
- [ ] Rename "General Scanning Tips" to "Exam Tips" with pre-filled relevant content
- [ ] Fix Fetal ScanCoach 404 - wrong route (/scan-coach?tab=fetal should go to correct Fetal ScanCoach page)
- [ ] Complete admin menu links UI in PlatformAdmin for Learn Fetal Echo, Learn Echo, Learn POCUS URLs

## ScanCoach Fixes (Mar 26)
- [x] AbdominalScanCoach: tips rendered as structured text (not raw JSON), SWE/UDFF under Liver only, section renamed to "Exam Tips"
- [x] FetalScanCoach: created dedicated /fetal-scan-coach page with 7 views (Situs, 4CV, LVOT, RVOT/3VV, Aortic Arch, Ductal Arch, Pulmonary Veins) + Exam Tips
- [x] FetalNavigator "Open in ScanCoach" button: fixed broken /scan-coach?tab=fetal link → now points to /fetal-scan-coach
- [x] PlatformAdmin: added Sidebar Learn Links panel (above user search) to manage Learn Fetal Echo / Learn Echo / Learn POCUS URLs

## Learn Vascular (Mar 26)
- [x] Add "Learn Vascular" sidebar nav link (external URL, configurable from admin)
- [x] Add learnVascularUrl key to menuLinksRouter (default empty)
- [x] Add Learn Vascular field to PlatformAdmin Sidebar Learn Links panel

## ScanCoach & Navigator Content Fill (Mar 26)
- [ ] BreastScanCoach: rewrite with full clinical tips (remove raw JSON strings)
- [ ] TCDScanCoach: rewrite with full clinical tips (remove raw JSON strings, fix truncated text)
- [ ] POCUSCardiacScanCoach: verify/fill clinical content
- [ ] POCUSEfastScanCoach: verify/fill clinical content
- [ ] POCUSLungScanCoach: verify/fill clinical content
- [ ] POCUSRushScanCoach: verify/fill clinical content
- [ ] FetalScanCoach: verify all 7 views have complete clinical content
- [ ] All other ScanCoaches: verify no raw JSON or truncated tips remain
- [ ] PelvicGynScanCoach: add TA / TVS approach tabs; rename "Uterus - Sagittal" to "Uterus"

## Carotid ScanCoach Additions (Mar 26)
- [ ] Add Subclavian Artery view to Extracranial Carotid ScanCoach (bilateral, proximal/distal, Doppler criteria)
- [ ] Add blood pressure documentation section to Carotid ScanCoach (bilateral arm BP, ABI context)
- [ ] Add inline ICA/CCA PSV ratio calculator to Carotid ScanCoach
- [ ] Fix Vite HMR WebSocket error permanently (clientPort + allowedHosts wildcard)
- [ ] Fix POCUS ScanCoach breadcrumb 404 — /pocus-assist-hub route missing or BackToEchoAssist points to wrong path
- [ ] Rename "General Scanning Tips" / "General Tips" to "Exam Tips" across ALL ScanCoach pages
- [x] Fix POCUS ScanCoach breadcrumb 404 — /pocus-assist-hub route missing
- [ ] OB23Navigator: expand protocol checklist — each comma-separated item becomes its own individual checkbox
- [ ] VenousNavigator: add External Iliac Vein section before Common Femoral Vein (CFV)
- [x] ArterialNavigator: rename "CW Doppler Waveforms" to "Duplex Ultrasound" and move to first position before Segmental Limb Pressures

## Abdominal Vascular Restructure (Mar 26)
- [x] AbdominalVascularNavigator: split into 3 tabs — Liver Duplex, Mesenteric Duplex, Renal Artery Duplex (Aorta stays standalone)
- [x] AbdominalVascularScanCoach: split into 3 tabs with view-specific tips, protocols, and exam criteria
- [x] Remove duplicate TCD card from UltrasoundAssist hub page (keep second one, remove first)

## Remaining ScanCoach/Navigator Rewrites (Mar 26)
- [x] BreastScanCoach: replace raw JSON tips with full clinical content
- [x] TCDScanCoach: replace raw JSON tips with full clinical content (4 adult windows + neonatal fontanelle)
- [x] ThyroidScanCoach: replace raw JSON tips with full clinical content (8 views, ACR TI-RADS)
- [x] ScrotumScanCoach: replace raw JSON tips with full clinical content
- [x] PelvicGynScanCoach: add TA/TVS tabs, replace raw JSON tips (TA: 3 views, TVS: 4 views)
- [x] OB1ScanCoach: replace raw JSON tips with full clinical content (6 views)
- [x] OB23ScanCoach: replace raw JSON tips with full clinical content (11 views)
- [x] MSKScanCoach: replace raw JSON tips with full clinical content (7 views + 7 Exam Tips)
- [x] TCDNavigator: replace thin single-item checklists with full protocol items (5 windows, 25 items)
- [ ] Verify POCUS ScanCoaches (eFAST, Lung, RUSH, Cardiac) — confirm no raw JSON
- [x] All other Navigators audited — content is complete and well-structured

## ScanCoach Editor Pre-Population (Mar 26)
- [ ] Seed DB with all static ScanCoach content so Editor pre-populates for every module/view
- [ ] Editor should show current static tips as editable default content for all 19 modules

## Navigator Editor & ScanCoach Pre-Population (Mar 26)
- [ ] Add navigatorOverrides table to DB schema (module, viewId, items JSON, referenceValues JSON, examTips JSON)
- [ ] Build navigatorAdminRouter.ts with listOverrides, upsertOverride, deleteOverride procedures
- [ ] Seed DB with all static ScanCoach content for all 19 modules (so Editor pre-populates)
- [ ] Build NavigatorEditor.tsx admin page with module selector, view accordion, checklist item CRUD
- [ ] Add reference value editing to NavigatorEditor (per-category tables)
- [ ] Wire all Navigator pages to use DB overrides when present, falling back to static content
- [ ] Add NavigatorEditor link to PlatformAdmin panel
- [x] MSKNavigator + MSKScanCoach: remove "Musculoskeletal 2023" verbiage from both pages

## Navigator Editor (Mar 26)
- [x] navigatorOverrides DB table created (module, sectionName, probe, items JSON, sortOrder)
- [x] navigatorAdminRouter: listSections, upsertSection, deleteSection, reorderSections, listModules
- [x] NavigatorEditor.tsx: module selector, section accordion, inline edit/delete/add/reorder per item
- [x] Static seed data for all 19 modules embedded — shows current content pre-loaded without DB
- [x] "Seed to Database" button to persist all static content to DB in one click
- [x] Route /admin/navigator registered in App.tsx with admin guard
- [x] Navigator Editor link added to PlatformAdmin admin tools grid
- [x] NavigatorEditor: fix drag-to-reorder for both main sections and subitems (HTML5 drag-and-drop on GripVertical handles + fixed arrow buttons to preserve expanded state)

## Carotid ScanCoach Additions (Mar 27)
- [ ] Add Subclavian Artery view to CarotidScanCoach with full clinical content (bilateral BP, subclavian steal)
- [ ] Add bilateral blood pressure documentation panel to CarotidScanCoach
- [ ] Add inline ICA/CCA PSV ratio calculator with SVU/SRU stenosis grading table

## Carotid ScanCoach Final (Mar 27)
- [x] CarotidScanCoach: full rewrite — all 6 views with complete SVU-aligned clinical content (no raw JSON)
- [x] CarotidScanCoach: add Subclavian Artery view (supraclavicular approach, subclavian steal, reactive hyperaemia test)
- [x] CarotidScanCoach: add bilateral brachial blood pressure documentation panel (inter-arm difference alert >15 mmHg)
- [x] CarotidScanCoach: add inline ICA/CCA PSV ratio calculator with SVU/SRU stenosis grading table (Grant et al. 2003)
- [x] NavigatorEditor: fix main section reordering — moved draggable/drag events from outer div to GripVertical handle only; arrow buttons now work without interference from drag events

## Navigator DB Live Wiring (Mar 27)
- [x] Create useNavigatorSections hook with DB fetch + static fallback
- [x] Export STATIC_NAVIGATOR_DATA from NavigatorEditor into a shared lib file
- [x] Refactor all 19 Navigator display pages to use the hook
- [x] Verify all pages compile and render correctly

## New Modules & Section Additions (Mar 27)
- [x] BreastNavigator: add Ultrasound-Guided Biopsy section (core biopsy, FNA, vacuum-assisted)
- [x] BreastNavigator: add Pre-Surgical Lumpectomy Localisation section
- [x] BreastScanCoach: add Ultrasound-Guided Biopsy view
- [x] BreastScanCoach: add Pre-Surgical Lumpectomy Localisation view
- [x] navigatorStaticData.ts: add breast biopsy/lumpectomy sections
- [x] ThyroidNavigator: add Ultrasound-Guided Biopsy/FNA section
- [x] ThyroidScanCoach: add Ultrasound-Guided Biopsy/FNA view
- [x] navigatorStaticData.ts: add thyroid biopsy/FNA section
- [x] Build AppendixNavigator page (appendix scanning protocol, graded compression, McBurney's, perforation signs)
- [x] Build AppendixScanCoach page (graded compression technique, RLQ survey, appendix identification)
- [x] Build InvasiveProceduresNavigator page (paracentesis, thoracentesis, pre-procedure checklist)
- [x] Build InvasiveProceduresScanCoach page (paracentesis site selection, thoracentesis site selection)
- [x] navigatorStaticData.ts: add appendix and invasive_procedures module data
- [x] navigatorAdminRouter.ts: register appendix and invasive_procedures module keys
- [x] UltrasoundAssistHub.tsx: add Appendix and Invasive Procedures specialty cards
- [x] App.tsx: register routes for all 4 new pages
- [x] Seed appendix and invasive_procedures modules to DB

## Hub UI Fixes (Mar 27)
- [x] Remove "Free — Available to All Members" section header from UltrasoundAssistHub
- [x] Remove "Free" badge from any specialty where ScanCoach is premium-gated
- [x] Merge free and premium specialties into a single unified grid (no section split)
- [x] Appendix and Invasive Procedures cards confirmed visible in hub

## Hub Ordering Fix (Mar 27)
- [x] Move MSK to second-to-last position (immediately before POCUS) in specialties array
- [x] Reorder hub: General → OB/Fetal → Vascular (all 6) → Small Parts → Appendix/Invasive → MSK → POCUS

## Hub Card Access Badges (Mar 27)
- [x] Add green "Free" badge on cards where both navigatorFree and scanCoachFree are true
- [x] Add amber/gold "Premium" badge on cards where both navigatorFree and scanCoachFree are false
- [x] Partially-gated cards (mixed) show no card-level badge — per-button indicators only

## Hub Fixes Round 2 (Mar 27)
- [x] Fix Premium badge: use spec config (not isPremium state) so it always shows on fully-gated cards
- [x] Fix vascular ordering: confirmed correct in code but not reflecting in live site — full rewrite to ensure

## Navigator Editor & Hub CTA (Mar 27)
- [ ] Fix drag-and-drop section reorder in Navigator Editor (sections not persisting new order)
- [ ] Add iHeartEcho EchoAssist CTA at bottom of UltrasoundAssistHub linking to app.iheartecho.com
- [x] Add small Crown icon to locked ScanCoach buttons (instead of Lock icon) to signal premium gating

## Bug Fixes
- [x] Fix: Magic link login does not persist session — user is prompted to log in again when navigating to ScanCoach pages after signing in via email link
- [x] ScanCoach Editor WYSIWYG Redesign: show exact view names, tip categories, and content matching live UI with inline editing
- [ ] Module selector should show the same module names as the hub

## WYSIWYG Editor Extension
- [ ] Extend ScanCoach Editor WYSIWYG to POCUS and Fetal modules (currently use legacy textarea)
- [ ] Build WYSIWYG Navigator Editor: show exact section structure matching live Navigator UI with inline editing

## WYSIWYG Editor Extension (Apr 2026)
- [x] Extend WYSIWYG to POCUS/Fetal ScanCoach modules (accordion sections: How to Get This View, Structures to Identify, Scanning Tips, Pitfalls, Key Measurements, Critical Findings)
- [x] Update Navigator Editor SortableSectionCard to mirror live Navigator styling (teal numbered circle, Merriweather section name, probe text, amber circle when unsaved)
- [x] Update Navigator Editor SortableItemRow to mirror live Navigator item styling (circle icon, critical badge, detail text, hover-reveal edit controls)

## PediatricAssist Module (Apr 2026)
- [ ] PediatricAssist Navigator page with 7 tabs: Appendix, Intussusception, Pyloric, Kidneys, Spine, Hips, Neuro
- [ ] PediatricAssist ScanCoach page with 7 tabs: Appendix, Intussusception, Pyloric, Kidneys, Spine, Hips, Neuro
- [ ] PediatricAssist Calculators page with relevant pediatric ultrasound measurements
- [ ] Wire /pediatric-navigator and /pediatric-scan-coach routes in App.tsx
- [ ] Add PediatricAssist card to UltrasoundAssist Hub
- [ ] Add PediatricAssist to sidebar navigation
- [ ] Register pediatric module in scanCoachRegistry and navigatorStaticData
- [ ] Export pediatric views from ScanCoach page for WYSIWYG editor support

## PediatricAssist Module
- [x] PediatricAssist Navigator with 7 anatomy tabs (Appendix, Intussusception, Pyloric Stenosis, Kidneys, Spine, Hips, Neuro)
- [x] PediatricAssist ScanCoach with 7 anatomy tabs (structured tip cards: Patient Positioning, Transducer Positioning, What to Assess, Scanning Tip, Pearl, Pitfall)
- [x] PediatricAssist Calculators with all relevant pediatric measurements (Appendix, Intussusception, Pyloric Stenosis, Kidneys, Spine, Hips/Graf, Neuro)
- [x] Routes wired in App.tsx (/pediatric-navigator, /pediatric-scan-coach, /pediatric-calculators)
- [x] Hub card with Navigator, Calculators, and ScanCoach buttons
- [x] Sidebar navigation entries (PediatricAssist™, PediatricAssist™ Calculators)
- [x] ScanCoach Editor WYSIWYG support for pediatric module (STRUCTURED_TIP_MODULES)
- [x] Navigator Editor support for pediatric module (NAVIGATOR_MODULES)
- [x] Hub Calculators button added for all specialties with calculatorPath
- [x] All 771 tests passing after PediatricAssist addition

## PediatricAssist Gating
- [x] PediatricAssist Navigator: free (requires login only — any registered user)
- [x] PediatricAssist ScanCoach: premium (requires premium_user, diy_user, or diy_admin role)
- [x] Update hub card: navigatorFree: true, scanCoachFree: false

## 404 Audit & Fix
- [x] Audit all routes in App.tsx vs navigation links in hub/sidebar for 404s
- [x] Fix all broken routes
- [x] Added missing routes: /cme (CMEHub), /accreditation, /lab-admin, /accreditation-manager, /scan-coach-hub
- [x] Fixed POCUS ScanCoach back-links to use -navigator suffix
- [x] Fixed diy-lab-admin links to point to /lab-admin
- [x] Created CMEHub.tsx page for /cme route (Thinkific CME catalog)
- [x] All 771 tests still passing after route fixes

## Attribution Masking
- [ ] Replace owner username with "All About Ultrasound" in all contributor/attribution displays (cases, soundbytes, flashcards, challenges, etc.)
- [ ] Apply masking in CaseLibrary.tsx (By larawilliams0501 → By All About Ultrasound)
- [ ] Apply masking in CaseDetail.tsx
- [ ] Apply masking in any other pages that show contributor names

## PremiumPearlGate
- [x] Build PremiumPearlGate component — teaser preview + fade + upgrade card (premium/login/diy types)
- [x] Replace BlurredOverlay in RoleGuard (all 4 gate paths)
- [x] Replace PremiumGate in all ScanCoach pages (14 pages)
- [x] Replace PremiumLockOverlay and PremiumOverlay in Navigator pages
- [x] Replace BlurredOverlay in CaseDetail, CaseLibrary, ClinicalInterpretationEngine, DailyChallenge, QuickFire, POCUS ScanCoach pages
- [x] Fix mismatched JSX tags in ScrotumScanCoach, TCDScanCoach, ThyroidScanCoach, FetalNavigator, POCUSLungNavigator, POCUSRushNavigator
- [x] Zero TypeScript errors, 771 tests passing

## PremiumPearlGate
- [x] Build PremiumPearlGate component — teaser preview + fade + upgrade card (premium/login/diy types)
- [x] Replace BlurredOverlay in RoleGuard (all 4 gate paths)
- [x] Replace PremiumGate in all ScanCoach pages (14 pages)
- [x] Replace PremiumLockOverlay and PremiumOverlay in Navigator pages
- [x] Replace BlurredOverlay in CaseDetail, CaseLibrary, ClinicalInterpretationEngine, DailyChallenge, QuickFire, POCUS ScanCoach pages
- [x] Fix mismatched JSX tags in ScrotumScanCoach, TCDScanCoach, ThyroidScanCoach, FetalNavigator, POCUSLungNavigator, POCUSRushNavigator
- [x] Zero TypeScript errors, 771 tests passing

## Multi-Image Case Upload
- [x] Audit current single-image upload in case submission and admin case management
- [x] DB schema already supports multiple images via echoLibraryCaseMedia table (caption field = title)
- [x] Server router already supports multiple images with captions
- [x] S3 upload endpoint already handles multiple files
- [x] Updated case submission form UI: per-image title field with contextual placeholder, larger thumbnail, upload status
- [x] Updated admin case editor UI: title display with icon and counter
- [x] Updated case detail display: image title bar with icon, counter overlay, improved thumbnail strip
- [x] Zero TypeScript errors, 771 tests passing

## Vite HMR / Attribution / Drag-Reorder
- [x] Suppress Vite HMR WebSocket console error (set overlay: false in vite.config.ts)
- [x] Attribution masking already fully wired: maskOwnerName applied in all 3 submitter query locations in caseLibraryRouter + quickfireRouter leaderboard
- [x] Added drag-to-reorder images in SubmitCase: dnd-kit SortableMediaItem with grip handle, arrayMove on drag end, stable id per item

## Multi-Image Per Structure (Navigator/ScanCoach)
- [ ] Audit: find where single clinical image URL is stored per structure in DB schema and editor
- [ ] Update DB schema: change single imageUrl column to images JSON array (url + caption) per structure
- [ ] Update server router: accept and return images array per structure
- [ ] Update editor UI: add/remove multiple images per structure with captions, no longer replace-on-upload
- [ ] Update viewer/display: show image gallery (thumbnails + lightbox) per structure
- [ ] Run tests and save checkpoint

## Multi-Image Per Structure (Navigator Sections)
- [x] Added `images` JSON column to `navigatorOverrides` table (DB migration applied)
- [x] Updated `navigatorAdminRouter.ts` to accept and return `images` array in upsertSection/listSections
- [x] Created `/api/upload-navigator-image` endpoint (admin-only, images only, S3 storage)
- [x] Updated NavigatorEditor.tsx: multi-image upload with per-image title, spinner placeholder, remove button, drag-to-reorder (dnd-kit)
- [x] Updated `useNavigatorSections` hook to pass `images` array through to all Navigator pages
- [x] Added clinical image gallery to 16 Navigator pages (horizontal scrollable strip, click to open full size)
- [x] Zero TypeScript errors, 771 tests passing

## Bug Fix: Navigator Image Upload Replace vs Append
- [x] Fix NavigatorEditor: uploading a new image replaces existing instead of appending to list
  - Root cause: useEffect re-initialised all sections from DB on every refetch after save, wiping unsaved images
  - Fix: added initialisedModuleRef to skip re-init when module hasn't changed; reset ref on module switch

## ScanCoach Multi-Image Clinical Slot
- [ ] Update ScanCoach Editor: Clinical Ultrasound Image slot supports multiple images (add/append, not replace)
- [ ] Update DB schema/router: store array of clinical images per ScanCoach view
- [ ] Update ScanCoach viewer: show image gallery for clinical images

## ScanCoach Multi-Image Clinical Images
- [x] Added echoImages JSON column to scanCoachOverrides schema and migrated DB
- [x] Updated scanCoachAdminRouter: uploadEchoImage (appends to array), removeEchoImage, echoImages returned in getOverride
- [x] Updated ScanCoachEditor UI: replaced single replace-only slot with multi-image gallery (add/remove per image with title)
- [x] Updated useScanCoachOverrides hook to include echoImages in merged view
- [x] Updated all ScanCoach viewer pages with gallery display (single=full-width, multiple=horizontal scroll strip)
- [x] Added useScanCoachOverrides to AbdominalVascularScanCoach (was missing)
- [x] Zero TypeScript errors, 771 tests passing

## ScanCoach Editor — Image Label & Reorder
- [x] Add updateEchoImageCaption procedure to scanCoachAdminRouter (update caption for one image by fileKey)
- [x] Add reorderEchoImages procedure to scanCoachAdminRouter (accept new ordered array of fileKeys)
- [x] Rebuild ScanCoach Editor echoImages gallery: vertical list with drag-to-reorder (dnd-kit), inline label editing, and save buttons
- [x] Update viewer pages to display image captions/labels below each gallery image

## Media Repository (Admin-only)
- [ ] DB schema: media_assets table (id, slug, title, description, mimeType, mediaType, access, createdByUserId, createdAt, updatedAt)
- [ ] DB schema: media_versions table (id, assetId, versionNumber, s3Key, s3Url, fileSize, fileName, uploadedByUserId, createdAt)
- [ ] DB schema: media_access_grants table (id, assetId, email, token, expiresAt, usedAt, createdAt)
- [ ] tRPC mediaRepo router: uploadAsset, listAssets, getAsset, deleteAsset
- [ ] tRPC mediaRepo router: reuploadVersion, listVersions, restoreVersion
- [ ] tRPC mediaRepo router: setAccess (public/private), inviteByEmail, revokeGrant, listGrants
- [ ] Public serve endpoint: GET /media/:slug — validates token/session, proxies from S3
- [ ] Public embed page: GET /media/:slug/embed — responsive HTML embed viewer
- [ ] Admin UI: /admin/media-repository page (platform admin only)
- [ ] Admin UI: Upload modal (drag-drop, any file type, title/description/tags)
- [ ] Admin UI: Asset browser (grid/list view, filter by media type, search)
- [x] Admin UI: Asset detail panel (version history, re-upload, access control, embed code)
- [ ] Admin UI: Access control panel (public toggle, email invite list, revoke grants)
- [ ] Admin UI: Embed code snippets (direct link, iframe, video/audio/image/SCORM tag)
- [ ] Register /admin/media-repository route in App.tsx and sidebar nav

## Media Repository Enhancements
- [ ] Thumbnail previews for images and video in asset grid
- [ ] Folder/category column on media_assets; folder sidebar in admin UI
- [ ] media_view_events table to track embed/link views
- [ ] Embed endpoint records view events (assetId, grantId, IP, referer)
- [ ] Analytics panel in asset detail dialog (total views, unique viewers, daily chart)

## Media Repository — List View Column Sorting
- [x] Add sortKey + sortDir state (default: name asc)
- [x] Render clickable column headers (Name, Type, Folder, Size, Access) with sort arrow indicators
- [x] Client-side sort logic for all five columns
- [x] Sort arrows: up = asc, down = desc, neutral = unsorted

## Media Repository — Search Function
- [x] Debounce search input (300ms) so query fires only after user stops typing
- [x] Reset page to 1 on new search term
- [x] Server-side listAssets filters by title and tags using LIKE
- [x] queryInput memoized with useMemo to prevent infinite re-fetch
- [x] Search works in both list view and grid view

## LMS — Education Library (All About Ultrasound™)

### DB Schema
- [ ] lms_courses table (id, slug, title, subtitle, description, coverImageUrl, status: draft/public/hidden/private, type: course/quiz/download, price, isFree, brand: aaus/iheartecho, createdAt, updatedAt)
- [ ] lms_sections table (id, courseId, title, position, isPreview)
- [ ] lms_lessons table (id, sectionId, title, type: video/text/quiz/download, content, mediaAssetId, position, isPreview, dripDays)
- [ ] lms_quizzes table (id, lessonId, title, passingScore)
- [ ] lms_quiz_questions table (id, quizId, question, type: mcq/truefalse, options JSON, correctAnswer, explanation, position)
- [ ] lms_enrollments table (id, userId, courseId, enrolledAt, completedAt, progress JSON, groupId, affiliateCode)
- [ ] lms_lesson_progress table (id, enrollmentId, lessonId, completedAt, quizScore)
- [ ] lms_groups table (id, courseId, name, seats, managerId, createdAt)
- [ ] lms_group_seats table (id, groupId, email, assignedAt, enrollmentId)
- [ ] lms_instructors table (id, userId, bio, avatarUrl, title, website, isActive)
- [ ] lms_course_instructors table (courseId, instructorId, revenueSharePct)
- [ ] lms_affiliates table (id, userId, code, commissionPct, isActive)
- [ ] lms_affiliate_conversions table (id, affiliateId, enrollmentId, amount, paidAt)
- [ ] lms_landing_pages table (id, courseId, heroTitle, heroSubtitle, heroImageUrl, bodyContent, ctaText, isCustom)
- [ ] lms_orders table (id, userId, courseId, amount, stripePaymentIntentId, status, affiliateId, createdAt)

### Server Routers
- [ ] lmsPublicRouter: listCourses, getCourse, getLandingPage, getInstructor
- [ ] lmsLearnerRouter: getEnrollment, getLessonProgress, markLessonComplete, submitQuiz, getMyCourses
- [ ] lmsAdminRouter: createCourse, updateCourse, deleteCourse, publishCourse, listCourses (all statuses), manageSections, manageLessons, manageQuizzes, manageEnrollments, manageGroups, manageInstructors, manageAffiliates, updateLandingPage, getAnalytics
- [ ] lmsGroupRouter: getMyGroup, assignSeat, revokeSeat (group manager role)

### Stripe Integration
- [ ] Set up Stripe via webdev_add_feature
- [ ] Course checkout: create PaymentIntent, confirm, create enrollment on success
- [ ] Group seat purchase: quantity-based checkout
- [ ] Webhook: payment_intent.succeeded → create enrollment + affiliate conversion
- [ ] Affiliate commission tracking on purchase

### Public-Facing Education Library
- [ ] /learn route — public education library (course catalog grid)
- [ ] Course cards: cover image, title, instructor, price, rating, status badge
- [ ] Filter by brand (AAUS / iHeartEcho), type (course/quiz/download), price (free/paid)
- [ ] /learn/:slug — auto-generated course landing page (hero, curriculum, instructor, pricing, CTA)
- [ ] /learn/:slug/enroll — Stripe checkout or free enrollment
- [ ] Instructor public profile pages at /instructors/:id

### Course Player
- [ ] /learn/:slug/player — course player layout (sidebar lesson list + main content area)
- [ ] Video lesson: embed from Media Repository (inline player)
- [ ] Text/rich content lesson: rendered HTML
- [ ] Quiz lesson: MCQ/true-false runner with score and pass/fail
- [ ] Download lesson: download button linked to Media Repository asset
- [ ] Progress tracking: mark lesson complete, overall % progress
- [ ] Certificate of completion (auto-generated on 100% progress)

### Platform Admin LMS Panel
- [ ] /admin/lms — LMS admin dashboard (course list, enrollment stats, revenue)
- [ ] Course builder: create/edit course, add/reorder sections and lessons
- [ ] Rich text editor for lesson content (reuse existing rich text approach)
- [ ] Media Repository picker in lesson builder (pull in video/audio/PDF/SCORM)
- [ ] Quiz builder: add/edit/reorder questions, set passing score
- [ ] Landing page editor: edit hero, body, CTA per course
- [ ] Enrollment management: view/add/remove enrollments per course
- [ ] Group management: create groups, set seats, assign group manager
- [ ] Instructor management: add/edit instructors, set revenue share per course
- [ ] Affiliate management: create affiliate codes, view conversions, mark paid
- [ ] Course status control: draft → public / hidden / private

### Group Enrollment
- [ ] Group manager dashboard at /my-group
- [ ] Group manager can assign/revoke seats by email
- [ ] Email notification to assigned user with enrollment link
- [ ] Seat usage display (X of Y seats used)

### Instructor Profiles
- [ ] Instructor profile page at /instructors/:id
- [ ] Bio, avatar, title, courses taught, website link
- [ ] Admin can create/edit instructor profiles and link to user accounts

## LMS — Education Library (Completed Apr 23 2026)
- [x] DB schema: 15 LMS tables (courses, sections, lessons, quizzes, quiz_questions, enrollments, lesson_progress, groups, group_seats, instructors, course_instructors, affiliates, affiliate_conversions, landing_pages, orders)
- [x] tRPC routers: lms (public), lmsLearner (protected), lmsAdmin (admin-only)
- [x] Stripe checkout session creation for paid courses
- [x] Stripe webhook: checkout.session.completed → auto-enroll learner
- [x] Public Education Library page (/education-library) with filter by type/status
- [x] Course landing page with enroll/checkout CTA (/learn/:slug)
- [x] Course player: sidebar nav, lesson viewer, quiz runner, progress tracking (/learn/:slug/player)
- [x] Admin LMS panel (/admin/lms): course builder, section/lesson/quiz builder, enrollment management, group management, instructor management, affiliate management
- [x] Course status: draft, published, hidden, private (invite-only)
- [x] Group enrollments: seat count, group manager role, seat assignment by email
- [x] Instructor profiles with bio, avatar, and revenue share %
- [x] Affiliate tracking: code generation, commission %, conversion logging
- [x] Revenue sharing config per course instructor
- [x] LMS vitest tests: 16 tests passing (slugify, enrollment, commission, seats, visibility)
- [x] Routes registered in App.tsx (no sidebar link added per user preference)

## LMS — Quizzes, Downloads & Media Picker (Apr 23 2026)
- [ ] DB: lms_standalone_quizzes table (title, slug, description, price, status, passingScore, questions JSON)
- [ ] DB: lms_downloads table (title, slug, description, price, status, fileUrl, fileKey, mimeType, fileSize)
- [ ] Server: lmsAdmin procedures for standalone quiz CRUD and download CRUD
- [ ] Server: lmsLearner procedures for standalone quiz purchase/attempt and download purchase/access
- [ ] Admin LMS panel: Quizzes tab (create/edit standalone quizzes with question builder)
- [ ] Admin LMS panel: Downloads tab (create/edit digital downloads, upload file or pick from Media Repository)
- [ ] Course lesson builder: "Insert from Media Repository" picker (browse and select video/PDF/image)
- [ ] Course lesson builder: "Attach Standalone Quiz" picker (link a standalone quiz as a lesson)
- [ ] Course lesson builder: "Attach Download" picker (link a download as a lesson resource)
- [ ] Public Education Library: show Quizzes and Downloads cards alongside Courses
- [ ] Course landing page: show attached downloads and quizzes in the curriculum outline

## LMS — Quizzes, Downloads & Media Picker (Apr 23 2026)

- [x] Add type filter to lmsAdmin.listCourses server procedure
- [x] Add Quizzes tab to LMS Admin panel (pre-filtered by type=quiz)
- [x] Add Downloads tab to LMS Admin panel (pre-filtered by type=download)
- [x] CoursesTab accepts typeFilter prop — labels and empty states are type-aware
- [x] CreateCourseDialog defaultType prop — dialog title and button say "New Quiz" / "New Download" contextually
- [x] MediaPickerDialog component — search, type filter, paginated asset list from Media Repository
- [x] AddLessonDialog — "Pick from Media Repository" button for video/download lessons
- [x] EditLessonDialog — "Pick from Media Repository" button for video/download lessons
- [x] Education Library — type-aware count label, search placeholder, empty state icon, and CTA button
- [x] 817 tests passing, 0 TypeScript errors

## LMS — Extended Pricing Models (Apr 23 2026)

- [ ] DB migration: add pricingType enum (free/one_time/subscription/payment_plan), subscriptionInterval (monthly/annual/quarterly), installmentCount, installmentAmount, downPayment columns to lms_courses
- [ ] Server: update createCourse/updateCourse input to accept new pricing fields
- [ ] Server: Stripe checkout — one_time uses payment_mode, subscription uses subscription_mode with Price, payment_plan creates subscription with initial invoice for down payment
- [ ] Admin UI: replace simple price/isFree with full pricing section (type selector + conditional fields)
- [ ] Public CourseLanding: display correct pricing badge and CTA per pricing type
- [ ] 0 TypeScript errors, tests passing

## LMS — Cover Image via Media Library
- [x] Route uploadCourseCoverImage through Media Repository (creates a media asset record)
- [x] Add landing page hero image upload field (also stored via Media Repository)
- [x] Both uploads accessible and manageable from the Media Repository admin

## LMS — SCORM/HTML Import & AI Generate
- [ ] Server: importFromMediaLibrary mutation — accepts mediaAssetId, creates a lesson (type=scorm or html) linked to the asset URL
- [ ] Server: aiGenerateCourse mutation — accepts topic + type (course/quiz), calls LLM to produce sections/lessons or quiz questions, inserts them into the DB
- [ ] Admin UI: "Import from Media Library" button in course/quiz curriculum tab — opens asset picker filtered to scorm/html/zip, creates lesson on select
- [ ] Admin UI: "AI Generate" button in course/quiz builder header — opens dialog with topic input, type selector, generates and previews content before inserting
- [ ] AI Generate: streaming progress indicator while LLM generates content
- [ ] AI Generate: editable preview of generated outline before committing to DB
- [ ] AI Generate standalone quiz: topic input → LLM generates quiz questions + landing page, preview, commit

## Lesson Type Upgrade (Apr 24, 2026)
- [x] Allow lessons to be added without requiring sections (top-level / course-level lessons)
- [x] New lesson types: embed (iframe), video_text (video + rich text below)
- [x] New DB columns: courseId, videoContent, embedUrl, requireVideoCompletion, requireManualComplete
- [x] DB migration applied (lms_lessons table updated, section_id nullable)
- [x] Admin UI: LessonRow component with type badge, completion badges
- [x] Admin UI: AddLessonDialog — all 6 lesson types, completion toggles, course-level option
- [x] Admin UI: EditLessonDialog — all 6 lesson types, completion toggles
- [x] Admin UI: "Add Lesson (No Section)" button in curriculum tab
- [x] Admin UI: Course-Level Lessons panel in curriculum tab
- [x] CoursePlayer: render embed (iframe), video_text (video + text), top-level lessons in sidebar
- [x] CoursePlayer: video completion gating (requireVideoCompletion), manual complete toggle
- [x] 817 tests passing, 0 TypeScript errors

## Landing Page Builder (Apr 24 2026)
- [x] Add `blocks` JSON column to lms_landing_pages table
- [x] Add saveLandingPageBlocks / getLandingPageBlocks tRPC procedures
- [x] Build LandingPageBuilder drag-and-drop WYSIWYG editor component (25+ block types including FAQ, Gallery, Icon Grid, Countdown, Instructor, Logos, Reviews, Embed, CTA, Lead Capture, Numbered List, Alert, Flip Cards, Curriculum auto, Pricing auto)
- [x] Integrate builder into LMSAdmin Landing Page tab
- [x] Fix admin Preview button → course player (enrolled student view)
- [x] Add separate Landing Page preview link in admin
- [x] Fix banner default color to #179ca3
- [x] Update CourseLanding.tsx to render blocks-based layout
- [x] Fix upload timeout (multipart /api/upload-course-image endpoint already added)

## Course Pricing Enhancements (Apr 24 2026)
- [x] DB: add accessDurationDays (NULL=lifetime), trialDays, pricingType (free/one_time/subscription/payment_plan/trial_then_subscription) to lms_courses
- [x] Server: update createCourse/updateCourse to accept new pricing fields
- [x] Admin UI: pricing section — access duration selector (lifetime/30/60/90/180/365 days/custom), trial days field, pricing type selector
- [x] CourseLanding: show correct access duration badge (e.g. "30-day access" vs "Full lifetime access") and trial info ("7-day free trial, then $X/mo")

## Hero Block Enhancements (Apr 24, 2026)
- [x] Hero block: background type selector (color, gradient, image, video)
- [x] Hero block: gradient color picker (from/to colors)
- [x] Hero block: background image upload
- [x] Hero block: background video (embed URL or direct video URL)
- [x] Hero block: editable CTA buttons (add/remove/edit text, color, link, style)
- [x] CourseLanding.tsx: render blocks-based layout with #179ca3 default
- [x] CourseLanding.tsx: access duration label (e.g. "30-day access")
- [x] CourseLanding.tsx: trial pricing label (e.g. "7 days free, then $X/mo")

## Quiz Builder AI Generate (Apr 24 2026)
- [x] Add aiGenerateQuizQuestions tRPC procedure (topic, count, difficulty → LLM → questions JSON)
- [x] Add AI Generate button + dialog to quiz builder in LMSAdmin
- [x] Dialog: topic input, question count selector (5/10/15/20/custom), difficulty (beginner/intermediate/advanced), question type (MCQ/true-false/mixed)
- [x] Preview generated questions before inserting (accept all / edit individual / remove)
- [x] Insert accepted questions into the quiz question list

## Lesson Effects System (Apr 24, 2026)
- [x] DB: add effectEnabled, effectTrigger, effectBannerText, effectBannerBgColor, effectBannerTextColor, effectSound, effectSoundUrl, effectConfetti, effectConfettiColors columns to lms_lessons
- [x] tRPC: updateLessonEffect procedure (admin), getLessonEffect included in getLesson/getCoursePlayer
- [x] Admin UI: LessonEffectEditor panel in EditLessonDialog (banner text/colors, trigger, sound preset + custom URL, confetti toggle + color theme)
- [x] Player: LessonEffectPlayer component (canvas confetti, Audio sound, animated banner overlay)
- [x] Player: fire effects on lesson start and/or lesson complete based on trigger setting

## Certificate of Completion (Apr 24, 2026)
- [x] DB: lms_certificates table (id, userId, courseId, issuedAt, certificateUrl)
- [x] Server: PDF certificate generation using pdfkit/fpdf with course title, learner name, date, AAUS branding
- [x] Server: Upload certificate PDF to S3 and store URL in DB
- [x] Server: Send certificate email via SendGrid with PDF attachment or download link
- [x] tRPC: issueCertificate procedure (called when progressPct hits 100 in markLessonComplete)
- [x] tRPC: getMyCertificates procedure (learner can view/download past certificates)
- [x] Course player: auto-trigger certificate on 100% completion with congratulations dialog
- [x] Course player: "Download Certificate" button in sidebar/completion state

## Lesson Notes and Bookmarks (Apr 24, 2026)
- [x] DB: lms_lesson_notes table (id, userId, lessonId, courseId, note, createdAt, updatedAt)
- [x] DB: lms_lesson_bookmarks table (id, userId, lessonId, courseId, createdAt)
- [x] tRPC: saveNote, deleteNote, getNotes (per lesson + all course notes)
- [x] tRPC: toggleBookmark, getBookmarks (per course)
- [x] Course player: Notes panel in lesson content area (textarea + save + list of past notes with timestamps)
- [x] Course player: Bookmark icon button in lesson header (toggle)
- [x] Course player sidebar: "My Notes" tab listing all bookmarked and noted lessons

## Course Drip Scheduling (Apr 24, 2026)
- [x] DB: add dripDays column to lms_lessons and lms_sections (int, nullable — days after enrollment to unlock)
- [x] tRPC: update getCoursePlayer to include unlock date per lesson based on enrollment date + dripDays
- [x] tRPC: update getLesson to enforce drip lock (throw if not yet unlocked)
- [x] Admin UI: dripDays field in AddLessonDialog, EditLessonDialog, and section editor
- [x] Course player sidebar: locked lesson UI (lock icon, "Unlocks in X days" label)
- [x] Scheduled task / cron: daily job to email learners when new drip content unlocks
- [x] Email: "New content unlocked" notification via SendGrid
## Collections (Admin Course Grouping) (Apr 24, 2026)
- [x] DB: lms_collections table (id, title, description, label/color, coverImageUrl, position, createdAt) and lms_collection_courses join table (collectionId, courseId, position)
- [x] tRPC: admin CRUD for collections (create, update, delete, reorder, addCourse, removeCourse, setCourses)
- [x] tRPC: public/learner listCollections and getCollection procedures
- [x] Admin UI: Collections tab in LMSAdmin with create/edit/delete dialogs and course assignment picker
- [x] Learner UI: Collections section on Education Library page and /collections/:id detail page

## Fetal Echo Navigator & Scan Coach Rebuild (Apr 24, 2026)
- [ ] Extract all 13+ fetal echo views from iHeartEcho app with full clinical data
- [ ] Update FetalScanCoach.tsx with complete view data (structures, normal findings, abnormal findings, scanning tips, images)
- [ ] Update FetalNavigator.tsx with complete view data matching iHeartEcho content

## Fetal Echo ScanCoach Rebuild (from iHeartEcho™)
- [x] Replace 7-view FetalScanCoach with complete 13-view dataset from iHeartEcho™ source
- [x] Add all CDN image URLs (anatomy diagrams + clinical echo images/GIFs) from iHeartEcho
- [x] Add missing views: RVOT with MPA Bifurcation, 3VT, LBVC, LV Short Axis, RVOT Short Axis, Bicaval
- [x] Match iHeartEcho UI layout: sidebar view list with sweep image, side-by-side images, structures, normal findings, technique, doppler, pitfalls, red flags
- [x] Add prev/next navigation buttons and Diagram/Echo/Both image toggle

## Digital Downloads (File Repository) — May 5, 2026
- [x] DB: digital_products table (id, title, description, slug, price, thumbnailUrl, status, createdAt)
- [x] DB: digital_product_files table (id, productId, fileName, fileUrl, fileKey, fileSize, mimeType, sortOrder)
- [x] DB: digital_purchases table (id, userId, productId, stripePaymentIntentId, purchasedAt)
- [x] tRPC: admin CRUD for digital products (create, update, delete, list, upload files)
- [x] tRPC: public listing, product detail, purchase (Stripe checkout), download access
- [x] Admin UI: Digital Downloads tab in Platform Admin (separate from LMS courses)
- [x] Admin UI: product editor with file upload, landing page content, pricing
- [x] Public: digital downloads browse page with product cards
- [x] Public: product sales/landing page with purchase button
- [x] Public: file delivery/download page after purchase
- [x] Stripe webhook handler for digital download checkout completed
- [x] Free product auto-grant without Stripe checkout
- [x] Replace old LMS Downloads tab with new DigitalDownloadsAdmin component
- [ ] Course integration: courses can attach digital download files to lessons
- [x] Digital Downloads: Add rich text editor to product description and landing body fields
- [x] Digital Downloads: Add thumbnail image upload (not just URL paste)
- [x] Digital Downloads: Integrate drag-and-drop WYSIWYG landing page builder (same as LMS courses)
- [x] Digital Downloads: Price input should be in dollars and cents (not raw cents)
- [x] Digital Downloads: My Downloads page (/my-downloads) for users to access purchased products
- [x] Digital Downloads: Download analytics — track per-product download counts, show in admin
- [x] Digital Downloads: Email delivery — send confirmation email with file links after purchase
- [x] Digital Downloads: Bundle pricing — group products into discounted bundles with admin CRUD and public pages
- [x] Subdomain separation: Create useSubdomain hook to detect learn.allaboutultrasound.com
- [x] Subdomain separation: Create LMSLayout with dedicated nav (Education Library, Digital Downloads, Media Repository)
- [x] Subdomain separation: Conditionally render LMSLayout vs main Layout based on hostname
- [x] Subdomain separation: On learn subdomain, only show LMS routes (education-library, learn/*, downloads/*, my-downloads, media-repository)
- [x] LMS subdomain: Dedicated home page with hero, featured courses, new downloads, and enrollment CTAs
- [x] LMS subdomain: Admin can select/toggle featured courses (isFeatured toggle in course settings)
- [x] LMS subdomain: All landing pages (courses + downloads) use WYSIWYG editor
- [x] LMS subdomain: Platform Admin on main app can access/manage all LMS admin features (Digital Downloads link added)
- [x] Fix: Change all green buttons/elements to brand teal (#189aa1) across the site (overrode Tailwind teal palette in @theme, replaced green badges/buttons in LMS pages, Premium.tsx emerald→teal)
- [x] Landing Page Builder: Replace plain textarea in Text/Rich Text block with full WYSIWYG editor (bold, italic, headings, fonts, sizes, images, links, lists)

- [x] Fix bullet points / list styles not rendering on published landing pages (Tailwind preflight resets list-style)
- [x] FAQ editor: Replace JSON textarea with user-friendly Q&A input fields (add/remove individual items)
- [x] Add Embed HTML block type to page builder
- [x] Add Divided Columns block type for side-by-side elements
- [x] Ensure all block editors use friendly UI inputs (no raw JSON/HTML/code for end users)
- [x] Add live preview pane to DownloadLandingPageBuilder (real-time rendering as user edits)
- [x] Order Bumps: Database schema (orderBumps table with trigger timing, connected product/course/download)
- [x] Order Bumps: Backend routers for CRUD operations
- [x] Order Bumps: Admin UI for managing bumps (create, edit, delete, connect to products)
- [x] Order Bumps: Editable bump landing page (mini page builder for bump offer)
- [x] Order Bumps: Display bump offers in checkout flow (before checkout, after checkout/redirect)
- [x] Order Bumps: Handle bump purchase logic (add to cart, process payment)
- [x] Visibility Status: Add status field (draft, published, hidden, private, archived) to courses schema
- [x] Visibility Status: Add status field to downloads schema
- [x] Visibility Status: Add status field to quizzes schema
- [x] Visibility Status: Backend logic to filter by status on public pages
- [x] Visibility Status: Hidden items accessible via direct URL but not in directory
- [x] Visibility Status: Private items only accessible via email invite
- [x] Visibility Status: Admin UI for managing visibility status on all content types
- [x] Page builder layout fix: Preview takes entire right side, editor opens as overlay/drawer on top of preview
- [x] Hero/Banner block: Add second headline field (headline2) to allow text distribution across two lines
- [x] Hero/Banner: Add subtle fade-in/slide-up animation for headline text on page load
- [x] Hero/Banner: Add video background option to DownloadLandingPageBuilder
- [x] Hero/Banner: Direct file upload for image/video backgrounds (S3 upload)
- [x] Hero/Banner: Separate font color selection for headline 1 and headline 2
- [x] Hero/Banner: Inline image/video within banner with left/center/right placement option
- [x] Page builder: Add "Preview as Student/Member/Customer" toggle to see page from buyer's perspective
- [x] Page builder: "Back to Admin" should return to the specific product edit page (course/download/quiz) not generic admin
- [x] Add "Preview as Student" button to CourseEditor and ProductEditor (download) admin pages
- [x] Fix React Error #310 on DownloadFiles page (hooks order issue from preview mode)
- [x] Fix Preview as Student button URLs to use learn subdomain instead of app subdomain

## Railway Migration
- [x] Fix PORT binding for Railway (use process.env.PORT directly, no port scanning)
- [x] Add railway.toml deployment config
- [x] Centralize domain into VITE_APP_URL env var
- [ ] Replace hardcoded app.allaboutultrasound.com fallbacks with VITE_APP_URL
- [x] Fix manifest.json hardcoded URLs — dynamic server-side manifest per brand
- [ ] Fix media invite link construction in mediaRepoRouter.ts
- [ ] Clean up Manus-specific dev tooling for production build
- [x] Document required Railway env vars
- [ ] Document webhook/OAuth callback URL updates needed

## Railway/R2 Mirror Sync
- [x] Copy all media files from Manus S3 to Cloudflare R2 (30 unique files, all succeeded)
- [x] Refresh Railway MySQL with latest Manus database dump (124 tables, 14131 users)
- [x] Build periodic sync script for DB and media mirroring (server/jobs/mirrorSync.ts)
- [x] Integrate sync into the app as a scheduled task (6h interval, admin tRPC trigger, dual-write storage)
- [x] Store R2 credentials securely in project secrets (CF_R2_*, RAILWAY_MYSQL_URL)

## Social Content Generator - Image Toggle
- [x] Add image generation toggle to Social Content Generator
- [x] Add optional text prompt for image (e.g. "ultrasound of liver", "ultrasound machine")
- [x] Auto-generate image based on social content when prompt is left blank
- [x] Backend procedure for image generation via AI
- [x] Display generated image in the content preview

## Social Content Generator - Image Approach Overhaul
- [x] Replace anatomical AI prompts with abstract/decorative background prompts
- [x] Add image upload endpoint for custom clinical images
- [x] Add image source selector UI (Abstract AI Background / Upload Own Image)
- [x] Add drag-and-drop or file picker for image upload
- [x] Update card rendering to support both image sources
- [x] Write tests for new image upload and abstract prompt logic

## Social Content Generator - Infographic Redesign
- [x] Update LLM prompt to generate structured infographic content (sections, key findings, bullet points)
- [x] Redesign card renderer to AAU infographic style (multi-column, teal banners, icons, branded footer)
- [x] Add image source selector (Abstract AI / Upload Own Image / None)
- [x] Add drag-and-drop image upload UI for custom clinical images
- [x] Update card to support central image area for uploaded images
- [x] Add branded bottom banner with tagline
- [x] Write tests for new structured content schema (833 tests passing)

## Social Content Generator - Post-Generation Image Prompt
- [x] Add optional "Add Image" button on each generated card
- [x] Expandable text prompt input for custom image description
- [x] Allow generating image after content is already produced
- [x] Keep existing pre-generation image toggle as well

## Funnel Builder in Platform Admin
- [x] Add funnel/landing page builders to Platform Admin navigation (Funnel Builder card → /admin/lms?tab=orderbumps)

## Standalone Funnel Builder (/admin/funnels)
- [x] Database schema: funnels table (name, slug, status, settings)
- [x] Database schema: funnel_pages table (funnel_id, page_type, title, blocks JSON, sort_order)
- [x] Backend: tRPC router for funnel CRUD (create, list, update, delete, duplicate)
- [x] Backend: tRPC procedures for funnel page management (add/edit/reorder/delete pages)
- [x] Backend: Public funnel router (getBySlug, getPage) for visitor rendering
- [x] Frontend: /admin/funnels list page with funnel cards (name, status, pages, link)
- [x] Frontend: Funnel editor page with step-by-step page management
- [x] Frontend: Create funnel dialog with template selection
- [x] Update Platform Admin card to link to /admin/funnels
- [x] Update InlineOrderBumpBlock to match reference design (image left, title center, +Add button right)
- [x] Frontend: FunnelPageEditor — WYSIWYG block editor for funnel pages
- [x] Frontend: Public funnel page renderer at /f/:slug/:pageSlug
- [x] Backend: Lead capture form submission storage (funnel_leads table + submitLead procedure)
- [x] Backend: Checkout session creation for standalone funnel products (createCheckout procedure)
- [x] Frontend: Funnel checkout page with Stripe integration and order bumps
- [x] Write tests for funnel builder features (21 tests passing)

## Funnel Builder — New Content Blocks
- [x] Countdown Timer block (live HH:MM:SS with on_load/event modes, urgency header text, configurable duration)
- [x] Price Stack CTA block (value items list, strikethrough original price, final price underlined, CTA button)
- [x] Urgency Offer block (countdown + headline + italic description + rich body + emoji CTA link)
- [x] All blocks added to catalog, BlockPreview, BlockSettings, and PublicFunnelPage renderer

## Funnel Builder — Checkout Form Block
- [ ] New block type: checkout_form (inline on page or standalone /f/:slug/checkout route)
- [ ] Admin settings: display mode (inline vs standalone page), header text, accent color
- [ ] Admin settings: products list (name, description, image, price, type: course/quiz/product/external)
- [ ] Admin settings: order bumps (image, title, description, price, CTA text, external URL option)
- [ ] Contact info section (first name, last name, email, phone)
- [ ] Product selection section (radio buttons with price dropdown)
- [ ] Billing info section (address, country, state, city, postal code)
- [ ] Payment info section (Stripe card element)
- [ ] Order bumps section (inline between payment and submit, +Add button)
- [ ] Summary section (expandable)
- [ ] Terms checkbox with configurable link
- [ ] Submit button with Stripe checkout integration
- [ ] Standalone checkout page route at /f/:slug/checkout
- [ ] Backend: createFunnelCheckout procedure for processing payment

## Funnel Builder — Enhanced Contacts & Leads
- [ ] Enhance funnel_leads table: add ip_address, user_agent, referrer, timezone, source_page columns
- [ ] Update lead capture submission to collect IP, user agent, referrer, timezone, source page
- [ ] Update checkout form submission to also store rich contact data
- [ ] Build admin Contacts/Leads list page (/admin/contacts)
- [ ] Build admin Contact Detail view (name, email, phone, tags, timezone, source, activity, orders)
- [x] Add checkout_form BlockSettings to admin editor (products, order bumps, display mode, terms)

## Bug Fixes — Funnel Builder
- [x] Fix image/video upload to banner not working (moved hooks out of switch case, added upload buttons to image/instructor blocks)
- [x] Fix page publication not working (removed active status requirement — pages always viewable)

## Funnel Builder — Performance & Features
- [x] Lazy-load PublicFunnelPage to reduce initial bundle size
- [x] Edit page name and slug in funnel editor (Rename button on page cards)
- [x] Duplicate individual funnel pages (Duplicate button on page cards)
- [x] Save funnel as template (Save as Template button + listTemplates in create dialog)

## Bug Fixes — Block Editor Input Focus
- [x] Fix input fields in BlockSettings losing focus after each keystroke (DebouncedInput component with internal state + debounce)
- [x] Fix Textarea/Input onChange type mismatch bugs (replaced with DebouncedTextarea, fixed event handlers)
## Funnel Builder — Footer & Logo Blocks
- [x] Add "footer" block type (links, copyright text, social icons, background color)
- [x] Add "logo_strip" block type (logo image URL, max width, alignment, link, background color)
- [x] Add both to BLOCK_CATALOG with icons and category
- [x] Add BlockPreview for footer and logo_strip
- [x] Add BlockSettings for footer and logo_strip
- [x] Add public renderer for footer and logo_strip in PublicFunnelPage, CourseLanding, DownloadLanding
- [x] Add "hide buttons" toggle to hero/banner BlockSettings and respect it in preview + public renderer
- [x] Allow HTML (br, p) in banner/CTA headlines, subtitles, and block titles across all renderers (dangerouslySetInnerHTML with color picker still working)
- [x] Auto-scroll preview panel to selected block when clicking a block in the sidebar
- [x] Add inline image/video style controls: size (width/height), border-radius, border width + color picker
- [x] Apply image/video styles in BlockPreview and all public renderers
- [x] Add global margin and padding controls to every content block's settings panel
- [x] Apply margin/padding styles in BlockPreview and all public renderers
- [x] Enhance 2-column layout block with selectable content types per column (rich text, CTA, countdown, contact form, sales form)
- [x] Add animation features to buttons and CTA blocks (pulse, bounce, shake, glow, etc.)
- [x] Add 3-column content block with optional vertical dividers (color picker, style: solid/dashed/dotted)
- [x] Add border style option (solid/dashed/dotted) to all existing border controls (image, video, divider blocks)
- [x] Add border rounding options to all borders (image, video, divider, 3-column dividers)
- [x] Fix "Back to Funnel" navigation in FunnelPageEditor to return to the specific funnel being edited (not funnels list)
- [x] Add star rating option to testimonial block (settings, preview, and public renderers)
- [x] Fix banner/hero block inline media not displaying in admin preview and PublicFunnelPage renderer
- [x] Fix "Back to Funnel" navigation — URL-based routing so navigating back lands on the specific funnel detail view
- [x] Add Platform Admin breadcrumb to the Funnel Builder page (list view and detail view)
- [x] Increase topics character limit for AI course generation (2000 → 10000)
- [x] Fix pricingType validation error when creating AI-generated courses (was sending invalid "draft", now defaults to "free")
- [x] Account sharing monitoring: database schema for IP access logs and abuse flags
- [x] Account sharing monitoring: IP tracking middleware for paid content (courses, downloads, paid content)
- [x] Account sharing monitoring: detection logic for multiple IPs per account
- [x] Account sharing monitoring: SendGrid email alerts to support@allaboutultrasound.com
- [x] Account sharing monitoring: admin UI for viewing flagged accounts and IP activity
- [x] Account sharing monitoring: periodic job for pattern detection
- [x] Redesign course player to match reference: dark teal/navy sidebar with numbered modules, large video area, "In This Module" panel, progress bar, "Mark Complete" button
- [x] Fix "Add Instructor" button not working in course Instructors tab
- [x] Implement global instructor profiles that can be saved and reused across courses
- [x] Auto-populate CTA buttons on course/download/product landing pages with Stripe checkout link (empty = auto checkout for courses/downloads, auto next-page for funnels)
- [x] Fix "Show Course Price" checkbox in pricing_cta block not displaying the price
- [x] Add strikethrough discount pricing option to CTA/pricing blocks
- [x] Replace limited preset color grid in rich text editor with full color picker (hex input + color wheel)
- [x] Add landing page preview button for courses and digital downloads (preview before publish via ?preview=admin)
- [x] Create Instructor block type in landing page builder (pulls from saved profiles or allows creating new inline)
- [x] Fix mobile PDF viewing: /api/media/:key/view endpoint — mobile-aware PDF viewer with Open/Download fallback for iOS/Android
- [x] Fix SCORM/HTML iframe: remove sandbox attribute that blocks cross-origin CDN content (e.g. CloudFront)
- [x] Add mobile Desktop Site banner at top of SCORM/HTML embed pages (dismissible, doesn't cover bottom controls)

## Page Builder Unification (May 13 2026)
- [x] Rewrite DownloadLandingPageBuilder.tsx as thin wrapper importing shared components from LandingPageBuilder.tsx
- [x] Add all missing block cases to DownloadLanding.tsx public renderer (logos, countdown, flip_cards, lead_capture, urgency_offer, price_stack, checkout_form, pricing_options_auto, curriculum_auto, course, digital, physical)
- [x] Add CountdownTimer component to DownloadLanding.tsx
- [x] All three builders (Funnel, Course, Download) now share same BLOCK_CATALOG, BlockPreview, BlockSettings, SortableBlock

## Funnel/Builder Unification (May 2026)
- [x] Rewrite DownloadLandingPageBuilder as thin wrapper using shared LandingPageBuilder components
- [x] Add all missing block cases to DownloadLanding public renderer
- [x] Add BSLinkField smart CTA link picker (Auto Checkout / Pick Product / Custom URL)
- [x] Replace raw link inputs in hero buttons, cta_standalone, price_stack, urgency_offer, product_offer_stack, funnel_workflow with BSLinkField
- [x] Add ?checkout=1 auto-trigger to CourseLanding and DownloadLanding for direct checkout from cross-product links

## Related Products Cross-Sell Block
- [x] Add related_products block type to BLOCK_CATALOG, BlockPreview, BlockSettings
- [x] Build RelatedProductsBlock public component (auto-fetches published courses/downloads)
- [x] Add related_products case to CourseLanding, DownloadLanding, PublicFunnelPage renderers

## Course Player Redesign (2026-05-13)
- [x] Redesign CoursePlayer to match mockup: dark teal sidebar, numbered modules, video area, In This Lesson panel, Mark Complete bottom-right
- [x] Add contentBlocks and learningObjectives fields to lms_lessons table
- [x] Add contentBlocks and learningObjectives to updateLesson procedure
- [x] Build LessonBlockEditor WYSIWYG component (reuses LandingPageBuilder blocks)
- [x] Add "Edit Content" admin button in course player header
- [x] Add student preview toggle for admins in course player
- [x] Render contentBlocks in CoursePlayer public view
- [x] Render learningObjectives in "In This Lesson" right panel

## Lesson Editor Improvements (2026-05-13)
- [x] Replace EditLessonDialog modal with full-screen LessonEditorPage (Settings + Content Blocks tabs)
- [x] Remove Import Media button from curriculum section headers
- [x] LessonBlockEditor WYSIWYG accessible from Content Blocks tab in lesson editor

## Quiz Builder Enhancements
- [x] Add optional courseId parameter to aiGenerateQuizQuestions — injects course title, modules, and lesson list as AI context
- [x] Add Quiz Builder tab to LessonEditorPage for quiz-type lessons (QuizBuilderInline component)
- [x] AI Generate panel in QuizBuilderInline shows "Course context enabled" badge when courseId is present
- [x] All 854 tests passing after quiz builder changes

## Course Player & Lesson Editor Light Theme Conversion
- [x] Convert CoursePlayer.tsx sidebar from dark teal (bg-[#0a2a2f]) to light (bg-white, border-gray-200)
- [x] Convert CoursePlayer.tsx top header bar to light theme
- [x] Convert CoursePlayer.tsx sidebar header, module list, section headers to light
- [x] Convert CoursePlayer.tsx expanded lesson rows and sidebar footer tabs to light
- [x] Convert CoursePlayer.tsx main content area, right panel, QuizRunner, notes/bookmarks to light
- [x] Fix syntax error in CoursePlayer.tsx (missing opening paren in JSX conditional)
- [x] Convert LMSAdmin.tsx LessonEditorPage header from dark teal to light (bg-white, text-teal-700)
- [x] Local vite build passes cleanly after all light theme changes

## Funnel Builder Drag-and-Drop Reordering
- [x] Add reorderPages backend procedure (accepts funnelId + ordered page IDs, updates sortOrder)
- [x] Add reorderFunnels backend procedure (accepts ordered funnel IDs, updates sortOrder)
- [x] Add sort_order column to funnels table (migration applied)
- [x] Install @dnd-kit/core and @dnd-kit/sortable for drag-and-drop
- [x] Implement drag-and-drop for funnel steps (pages) in FunnelDetailView (SortableFunnelPageRow)
- [x] Implement drag-and-drop for funnel cards in FunnelListView (SortableFunnelCard)
- [x] Optimistic updates for instant reorder feedback (arrayMove + rollback on error)
- [x] All 854 tests passing, vite build clean

## Duplicate Support for Courses, Downloads, Products, Funnels
- [x] Add duplicateCourse backend procedure in lmsRouter (copies course, modules, lessons, quiz questions)
- [x] Add duplicateDownload backend procedure in downloadsRouter (copies download record + files list)
- [x] Add duplicateBundle backend procedure in downloadsRouter (copies bundle + item list)
- [x] Add duplicateOrderBump backend procedure in orderBumpsRouter (copies order bump, resets stats, marks inactive)
- [x] Wire Duplicate (Copy icon) button in LMSAdmin course list
- [x] Wire Duplicate (Copy icon) button in DigitalDownloadsAdmin
- [x] Wire Duplicate (Copy icon) button in OrderBumpsAdmin
- [x] Funnels already had duplicate for both funnel and page — confirmed wired
- [x] All 854 tests passing, vite build clean

## User Analytics Reporting
- [x] Create 4 new analytics tables: userLoginEvents, userPageViewEvents, userVideoEvents, userQuizAttempts
- [x] Apply migration SQL for all 4 tables
- [x] Wire login event tracking in OAuth callback (fire-and-forget, non-blocking)
- [x] Create useAnalytics.ts hook: usePageViewTracker (auto page view on route change) + useLmsAnalytics (video + quiz events)
- [x] Mount usePageViewTracker in Router and LMSRouter in App.tsx
- [x] Create analyticsRouter.ts with analyticsTrackRouter (pageView, videoEvent, quizAttempt) and analyticsAdminRouter (overview, dailySeries, topPages, topCourses, userList, userDetail)
- [x] Register analyticsTrackRouter and analyticsAdminRouter in routers.ts
- [x] Build UserAnalytics.tsx admin page: Overview tab (stat cards + daily trend chart + top pages + top courses), Users tab (searchable/sortable paginated table), User drill-down (Courses, Videos, Quizzes, Pages, Logins, Downloads tabs)
- [x] Add /admin/user-analytics route in App.tsx (platform_admin only)
- [x] Add "User Analytics" card to PlatformAdmin tools grid
- [x] All 854 tests passing, vite build clean

## CTA Opt-Out Link Feature
- [ ] Audit CTA block schema in funnel pages to understand current fields
- [ ] Extend CTA block JSON schema with optOutEnabled, optOutText, optOutLinkType (course/download/product/custom), optOutCourseId, optOutDownloadId, optOutCustomUrl
- [ ] Add opt-out link editor panel in FunnelPageEditor CTA block settings
- [ ] Render opt-out link below CTA button on public funnel pages
- [ ] Resolve redirect URL at render time (course slug, download slug, or custom URL)
- [ ] All tests passing, build clean

## CTA Opt-Out Link Rendering (Public Pages)
- [ ] Render opt-out link below CTA button on public funnel pages (pricing_cta, cta_standalone, price_stack, urgency_offer)
- [ ] resolveOptOutUrl helper: course→/courses/slug, download→/downloads/slug, custom→raw url

## URL/Slug Editing & Settings Tabs
- [ ] Backend: updateCourseSlug/settings procedure (validate uniqueness, sanitize)
- [ ] Backend: updateDownloadSlug/settings procedure
- [ ] Backend: updateFunnelSlug/settings procedure
- [ ] Backend: updateOrderBumpSlug/settings procedure
- [ ] LMSAdmin course editor: Settings tab (slug, SEO title/desc, visibility, enrollment cap, certificate toggle)
- [ ] DigitalDownloadsAdmin product editor: Settings tab (slug, SEO title/desc, visibility, file access expiry)
- [ ] FunnelBuilder funnel editor: Settings tab (slug, SEO title/desc, custom redirect after checkout)
- [ ] OrderBumpsAdmin: Settings tab (slug, display position, expiry date)

## iHeartEcho Multi-Tenant Migration
- [ ] Add brand infrastructure: brand detection middleware (server + client), brandMemberships table
- [ ] Migrate iHeartEcho-only schema tables (soundBytes, userPoints, abTestEvents, menuLinkConfig, navigatorProtocolOverrides, uploadJobs, educatorTemplates, accreditationChecklist)
- [ ] Migrate iHeartEcho inline server routers (accreditation, lab, strain, iqr, echoCorrelation, physicianPeerReview, notification, caseMix, cme, physicianOverRead, caseStudies, stats, demo, menuLinks)
- [ ] Copy iHeartEcho page components into client/src/pages/iheartecho/ namespace
- [ ] Create IHeartEchoLayout.tsx (sidebar nav, branding, role-based menu)
- [ ] Create IHeartEchoApp shell with all iHeartEcho routes
- [ ] Wire brand-aware App.tsx routing (subdomain detection → correct app shell)
- [ ] Add iHeartEcho-specific Stripe products and premium gating (separate from AAUS premium)
- [ ] Ensure shared auth: one login works across both subdomains
- [x] PWA manifests: dynamic server-side manifest per brand (AAUS, iHeartEcho, combined AAUS|iHE)
- [x] Brand-aware index.html meta tags (favicon, apple-touch-icon, theme-color, og:image, title)
- [x] Brand-aware service worker with isolated cache per domain
- [x] Brand-aware GetAppBanner (icon, name) for PWA install prompt
## Brand Membership Backfill for Existing Premium Users
- [x] Query all existing premium users (isPremium=true or premium_user role) and backfill brandMemberships records for iHeartEcho (27 users)
- [x] Ensure iHeartEcho premium users (from Thinkific) also get iheartecho brandMembership records
- [x] Add server-side auto-backfill logic so auth.me automatically creates brandMembership if user has legacy isPremium flag

## Brand-Aware Email Sending
- [x] Create brand email config: iheartecho.com → iHeartEcho sender; allaboutultrasound.com → AAUS sender; learn/member.allaboutultrasound.com → AAUS sender with combined "All About Ultrasound | iHeartEcho" branding
- [x] Update sendEmail to accept optional brand parameter for sender override
- [x] Update emailWrapper to render brand-specific header (logo, name, tagline, colors)
- [x] Update magic link, password reset, email change, welcome templates with brand-aware copy
- [x] Pass brand/ctx through auth procedures (magic link, password reset) to email builders

## Combined Branding for learn/member Subdomains
- [x] Update shared/brands.ts to add a "brandMode" concept: app-only (aaus/iheartecho) vs combined (learn/member)
- [x] Update frontend header/sidebar to show "All About Ultrasound | iHeartEcho" on learn/member subdomains
- [x] Update login page messaging for learn/member subdomains with combined branding
- [x] Ensure platform admin works independently on each app (AAUS, iHeartEcho, learn/members) — already correct via separate routers with RoleGuard

## Media Repository & Digital Downloads Improvements
- [x] Fix 404 on /media/jumpstart-business-quick-guide-a03dbc0f — works on dev server (200 OK), needs publish to deploy
- [x] Digital downloads: add bundle-only flag so they are listed but cannot be purchased standalone
- [x] In-browser PDF viewer: display PDF content in browser for media repo and digital download PDFs
- [ ] Allow direct linking to PDF viewer for embedding

## Bug Fixes - Auth & Content
- [x] Fix navigator auth gating - navigators accessible without login (should require auth)
- [x] Fix iHeartEcho daily challenges showing general ultrasound content instead of echo-specific challenges
- [x] Fix iHeartEcho flashcards showing AAUS content instead of echo-specific flashcards
- [x] Fix iHeartEcho case library showing AAUS cases instead of echo-specific cases
- [ ] Fix iHeartEcho leaderboard showing no entries (brand filtering or data issue)
- [ ] Fix iHeartEcho SoundBytes showing AAUS content instead of echo-specific SoundBytes

## iHeartEcho Database Migration
- [ ] Locate iHeartEcho source database connection string
- [ ] Audit all iHeartEcho content tables: challenges, flashcards, cases, SoundBytes, leaderboard
- [ ] Migrate iHeartEcho challenges with brand=iheartecho
- [ ] Migrate iHeartEcho flashcards with brand=iheartecho
- [ ] Migrate iHeartEcho cases with brand=iheartecho
- [ ] Migrate iHeartEcho SoundBytes with brand=iheartecho
- [ ] Migrate iHeartEcho leaderboard/user activity data
- [ ] Verify brand filtering works for all migrated content

## Bugs (May 13)
- [x] Fix iHeartEcho logo broken (CloudFront 403) - upload new logo and update all references
- [ ] Fix EchoFlashcards showing AAUS categories instead of echo-specific categories on iHeartEcho brand
- [ ] Fix iHeartEcho case library showing AAUS modality filters instead of echo modalities
- [ ] Fix leaderboard not working on iHeartEcho

## iHeartEcho Branding Fixes (Session 2)
- [x] Magic link email sends from "All About Ultrasound" and redirects to app.allaboutultrasound.com instead of iHeartEcho — FIXED: frontend passes origin, server uses it for URL + brand detection
- [ ] QuickFire.tsx shows AAUS categories instead of echo categories on iHeartEcho
- [ ] Layout.tsx sidebar footer hardcoded to www.allaboutultrasound.com / © All About Ultrasound™
- [ ] LMSLayout.tsx sidebar footer hardcoded to www.allaboutultrasound.com
- [ ] Leaderboard shows blank for unauthenticated users (needs login prompt)
- [ ] Case library brand filter verification

## Bugs (May 13 - Session 3)
- [x] User-created courses lost from LMS — FIXED: missing bundle_only column in lms_courses caused all queries to crash
- [ ] Quiz questions lost (SPI quiz has 0 questions)
- [x] PDF file 404 in media repository — FIXED in code (isServerRoute fix), needs production re-deploy
- [x] Investigate MirrorSync overwriting production data — MirrorSync is one-way TiDB→Railway, not the cause; root cause was missing DB column
- [x] Fix media /media/:slug 404 in production — moved media routes BEFORE SPA catch-all in index.ts
- [x] Ensure iHeartEcho media repository settings/assets are transferred and accessible — migrated 7 assets, 8 folders from iHeartEcho DB with SCORM entry URLs

## New Features (May 14)
- [x] Editable slugs for courses, downloads, media assets, and products
- [x] Inline Stripe checkout form with Stripe Elements (keep users on one page)
- [x] Multiple order bumps configurable per checkout page (any product can be a bump)
- [x] Funnel page hide option (hide page from funnel sequence)
- [x] Funnel page standalone landing page (pull page out as independent URL)

## Conditional Funnel Branching (May 14)
- [x] Schema: funnel_branch_rules table (pageId, priority, matchMode, targetPageId, targetUrl)
- [x] Schema: funnel_branch_conditions table (ruleId, variable, operator, value)
- [x] Server: rules engine evaluator (evaluateBranchRules)
- [x] Server: tRPC CRUD procedures (listRules, upsertRule, deleteRule)
- [x] Server: getNextPage public procedure uses rules engine
- [x] Admin UI: Branch Rules editor panel in FunnelPageEditor right panel
- [x] Admin UI: Condition builder (variable picker, operator, value)
- [x] Admin UI: Target page/URL selector per rule
- [x] Admin UI: Rule priority ordering (drag-to-reorder)
- [x] Public: Checkout form passes context (productId, bumpIds, email, price, sourceUrl) to next-page resolver
- [x] Public: PublicFunnelPage evaluates branch rules on page load for redirect

## Funnel Flow Diagram (May 14)
- [x] FunnelFlowDiagram component: pages as nodes, branch rules as labeled arrows
- [x] Auto-layout algorithm (top-down DAG layout)
- [x] SVG-based rendering with pan/zoom support
- [x] Node click navigates to page editor
- [x] Edge labels show rule name and condition summary
- [x] Default next-page edges shown as dashed arrows
- [x] Branch rule edges shown as solid colored arrows
- [x] Toggle between List view and Diagram view in FunnelBuilder
- [x] Diagram fetches branch rules for all pages in the funnel

## LMS Editor Save & Close (May 14)
- [x] Lesson editor: add "Save" and "Save & Close" buttons
- [x] Course content editor: add "Save" and "Save & Close" buttons
- [x] Module editor: keep "Save" only (no Save & Close)

## LMS Editor Save & Close + Admin Preview (May 14)
- [x] LessonEditorPage settings tab: add "Save" and "Save & Close" buttons
- [x] LessonBlockEditor content tab: add "Save" and "Save & Close" buttons
- [x] Module (section) editor: keep "Save" only — no Save & Close
- [x] Admin preview bypass: admins can preview courses/lessons without login prompt
- [x] CoursePlayer: skip auth gate when user is admin (render as preview mode)
- [x] Lesson viewer: skip premium/enrollment gate when user is admin
- [x] LessonBlockEditor: retheme from dark to light color scheme (white/gray background, dark text)
## Lesson Editor UI Cleanup + Templates (May 14)
- [x] Fix admin preview bypass: CoursePlayer redirected to login before auth loaded (race condition)
- [x] Fix Preview Course button: wrong URL /course/ → /learn/
- [x] DnD: add SortableSectionRow for drag-to-reorder sections in curriculum tab
- [x] createLesson: auto-append at end of section (max position + 1)
- [x] createSection: auto-append at end of course (max position + 1)
- [x] Content templates: lms_content_templates table + CRUD procedures
- [x] LessonBlockEditor: "Save Template" button (saves selected block or full page)
- [x] LessonBlockEditor: "Templates" button (insert saved template into lesson)
- [x] Rename "Content" label → "Lesson Description" in lesson settings
- [x] Rename "Content Blocks" tab → "Lesson Editor"
- [x] Remove "Rich Text" type label → renamed to "Text"
- [x] Remove "Blocks appear below the video in the player" subtitle from editor header
- [x] Remove hardcoded "In This Lesson" objectives section from LessonBlockEditor
- [x] Add "Learning Objectives" as optional content block in BLOCK_CATALOG (Content category)
- [x] Learning Objectives block: preview renders teal checklist
- [x] Learning Objectives block: settings panel to edit title, objectives list, and colors
## DnD Lesson Reorder Fix (May 14)
- [x] Import dnd-kit (DndContext, SortableContext, useSortable, arrayMove, sensors) in LMSAdmin
- [x] Replace static LessonRow with SortableLessonRow using useSortable hook
- [x] Wrap each section's lesson list in DndContext + SortableContext
- [x] Wire reorderLessons mutation on drag end (per section)
- [x] Wire reorderSections mutation on drag end (sections list)
- [x] Add PointerSensor with 5px activation distance to prevent accidental drags
## DnD Fixes Round 2 (May 14)
- [x] Fix lesson reorder not persisting (order reverts after drag)
- [x] Make sections (modules) draggable and reorderable
## Lesson Editor Fixes Round 3 (May 14)
- [x] Rename "Content" label to "Lesson Description" in lesson settings form (both create and edit dialogs)
- [x] Remove hardcoded "In This Lesson" objectives section from Lesson Editor canvas
- [x] Fix new lessons appending at wrong position — server now auto-calculates max(position)+1

## Cross-Module/Course Lesson Management (May 14)
- [x] Drag lessons across modules (sections) within a course
- [x] Copy lessons to other courses (with destination section picker)
- [x] Copy entire modules to other courses
- [x] New modules (sections) now append at end of course
- [x] Fix DragOverlay import, DialogDescription import, getCourses→listCourses in copy dialogs
- [x] Fix lmsRouter description column reference error

## Lesson Add Flow Fix (May 14)
- [ ] After adding a new lesson, open lesson editor instead of closing dialog

## Module Editing + Drip Content (May 14)
- [ ] Inline module name editing in curriculum tab (click pencil icon to rename)
- [ ] Drip content: per-section dripDays setting in admin UI
- [ ] Drip content: server gates lessons based on enrollment date + section dripDays
- [ ] Drip content: student player shows locked/upcoming sections with unlock date
- [ ] Drip content: admin preview bypasses drip lock

## Builder UX Improvements (May 14)
- [x] Fix "Content Blocks" label → "Lesson Editor" in LessonBlockEditor header
- [x] Fix auto-open lesson editor after adding new lesson (pass full lesson object directly, no secondary fetch)
- [x] Add up/down arrow reorder buttons to LessonBlockEditor blocks (alongside drag)
- [x] Add up/down arrow reorder buttons to SortableLessonRow in curriculum builder
- [x] Add up/down arrow reorder buttons to SortableSectionRow in curriculum builder
- [x] Add up/down arrow reorder buttons to LandingPageBuilder SortableBlock
- [x] Add up/down arrow reorder buttons to FunnelPageEditor SortableBlock
- [x] Add up/down arrow reorder buttons to DownloadLandingPageBuilder SortableBlock
- [x] Add up/down arrow reorder buttons to FunnelBuilder SortableFunnelCard and SortableFunnelPageRow
- [x] Add "Copy from other lessons" tab to LessonBlockEditor block picker (browse by course/lesson, copy blocks)
- [x] Add getLessonsWithBlocks procedure to lmsAdminRouter
- [x] Add inline module name editing to SortableSectionRow (click title to edit, Enter/blur to save)
- [x] Implement drip content system: SectionDripDialog with day-count input
- [x] Add isDrip toggle to CourseSettingsForm with description
- [x] Add lesson-level dripDays field to LessonEditorPage settings tab
- [x] Enforce lesson-level drip in CoursePlayer (locks individual lessons, shows unlock date)
- [x] Admin bypass for drip (admins see all content regardless of drip schedule)
- [x] drip.test.ts: 5 unit tests for drip unlock logic (all passing)

## Block Picker Improvements (May 14)
- [x] Show text preview (first few words) for each block in "Copy from other lessons" picker — strips HTML, handles all block types
- [x] Display blocks in position order in the picker (server orders by position, client preserves order)
- [x] Show block type icon + catalog label in picker row for quick identification

## Bugs (May 14 — Priority)
- [ ] Fix "Preview as Student" — redirects to dashboard instead of course player
- [ ] Fix "Preview Course" button — gives 404
- [ ] Fix section rename delay — add optimistic update so title updates instantly
- [ ] Fix lesson add/duplicate delay — add optimistic update so new lesson appears instantly
- [x] Fix up/down arrows in LessonBlockEditor being blocked/covered by overlapping elements — moved inside SortableBlock toolbar
- [x] Add "Add Block" button to top toolbar of LessonBlockEditor
- [x] Fix Preview Course button route (/course/ → /learn/) and open in new tab
- [x] Optimistic update for section rename — instant title update without refetch delay
- [x] Optimistic update for add section — immediately append new section row
- [x] Section rename: single-click pencil icon triggers inline edit (not just double-click)
- [ ] Add "Add Block" button to top toolbar of LessonBlockEditor

## Performance / UX Fixes (May 14)
- [ ] Fix lesson content area missing scrollbar (h-full on inner wrapper prevents scroll)
- [x] Fix slow course player load time

## Instructor Profile in Player Sidebar (May 14)
- [ ] Add "Instructor" tab to right-side panel in CoursePlayer
- [ ] Course-level toggle: showInstructor field on lmsCourses
- [ ] Lesson-level toggle: showInstructor field on lmsLessons (overrides course setting)
- [ ] Fetch instructor data in getCoursePlayer and getLesson
- [ ] Admin toggle in CourseSettingsForm and LessonEditorPage settings tab
- [ ] Hide legacy content/videoContent fields when contentBlocks exist (all lesson types)
- [ ] Fix Mark Complete checkmark not appearing in left and right sidebars after marking

## Course Overview Page + Prerequisite Gating (May 14)
- [x] Add prerequisiteOfLessonId column to lmsLessons schema + DB migration
- [x] Add showInstructor columns to lmsCourses + lmsLessons + DB migration
- [x] Build CourseOverview page: block editor + accordion curriculum + drip/prerequisite rules
- [x] Add prerequisite lesson setting in LessonEditorPage settings tab
- [x] Enforce prerequisite gating in CoursePlayer sidebar and lesson access
- [x] Add instructor profile panel to course player right sidebar (course + lesson level toggle)
- [x] Route: /learn/:slug/overview opens CourseOverview, /learn/:slug/player opens the player; sidebar has Overview link

## Hide Course Progress (May 14)
- [x] Add hideProgress boolean column to lms_courses schema + DB migration
- [x] Add hideProgress to updateCourse procedure input schema
- [x] Add hideProgress toggle to Course Settings UI (LMS Admin)
- [x] Suppress progress bar/percentage in CoursePlayer when hideProgress is true
- [x] Suppress progress bar/percentage in CourseOverview when hideProgress is true

## UX Improvements (May 14 - round 2)
- [x] Remove Edit Overview button from CourseOverview page
- [x] Add Edit Overview button + Preview Overview link to LMS Admin course editor (Overview tab)
- [x] Move Lesson Notes into CoursePlayer right panel (notes tab opens inline, not modal)
- [x] Mobile: hamburger menu for CoursePlayer left sidebar on small screens
- [x] Mobile: responsive layout polish for CoursePlayer and CourseOverview

## Performance: Course Editor & Player Load Times (May 14)
- [x] Add DB indexes on all LMS foreign key columns (course_id, section_id, user_id, enrollment_id, etc.)
- [x] Fix N+1 queries in getCourse (admin): batch-fetch all lessons in one query instead of per-section
- [x] Fix N+1 queries in listCourses/listFeatured: batch-fetch instructors instead of per-course
- [x] Fix getCoursePlayer payload: strip heavy content columns (contentBlocks, content, videoContent) from lesson list
- [x] Lazy-mount Landing Page and Course Overview editors in LMS Admin (only render on first tab visit)
- [x] Improve CoursePlayer loading skeleton to match the actual 3-column layout

## Bug: Notes Not Working on Mobile (May 14)
- [x] Fix Notes panel not accessible/functional on mobile in CoursePlayer — added slide-up bottom drawer on < lg screens

## Prerequisite Logic Redesign (May 14)
- [ ] Replace prerequisiteLessonId with isPrerequisite boolean + requireVideoCompletion boolean on lms_lessons
- [ ] Update updateLesson procedure to handle isPrerequisite + requireVideoCompletion
- [ ] Update getCoursePlayer + getCourseOverview to return isPrerequisite + requireVideoCompletion
- [ ] Update LessonEditorPage: replace Prerequisite Lesson dropdown with Is Prerequisite toggle + Require Video Completion toggle
- [ ] Rewrite CoursePlayer gating: lock all lessons after the first incomplete prerequisite in course order
- [ ] Rewrite CourseOverview gating: same logic for accordion curriculum
- [ ] Auto-enforce video completion when lesson isPrerequisite = true
- [ ] If no Mark Complete button, prerequisite is satisfied by opening the lesson (or video completion if video exists)

## Bug Fixes
- [x] Fix TDZ ReferenceError in CoursePlayer bundle — extracted BlockPreview into shared component to break circular dependency with LandingPageBuilder
- [x] Fix checkout buttons returning "Service Unavailable" JSON error — changed Stripe API version from beta "2026-03-25.dahlia" to stable "2024-06-20"
- [x] Fix TDZ ReferenceError in CoursePlayer — moved dripBypassed/showStudentView declarations before prereqLockedIds block where they are first used (line 524)
- [x] Move Edit/Preview Landing Page buttons from global header into the Landing Page tab
- [x] CourseOverview WYSIWYG editor — default blocks shown when empty, redirects to LMS Admin Overview tab for editing
- [x] LandingPageBuilder BlockPreview import fix — moved import to top of file to prevent 'BlockPreview is not defined' error
- [x] CourseEditor reads ?tab= URL param to auto-open correct tab
- [x] Add course color scheme picker (primary, accent, gradient) to Course Settings
- [x] Apply course color scheme to CoursePlayer sidebar, CourseOverview curriculum, landing page curriculum block
- [x] Add Users tab to course editor (enrolled students, access logs, enroll new student, deep link to student profile)
- [x] Add Analytics tab to course editor (sales data, lesson progress, completion rates)
- [ ] Fix CourseOverview WYSIWYG editor to show full page preview (header, progress bar, curriculum)
- [ ] Fix desktop sidebar notes/bookmarks panels in CoursePlayer
- [x] Fix LessonNoteEditor to invalidate notes query after saving (already correct — getCourseNotes.invalidate in onSuccess)

## Enrollment Email Notifications (May 15)
- [ ] Add sendEnrollmentEmail boolean column to lms_courses (per-course toggle, default true)
- [ ] Add platform_settings table with enrollmentEmailEnabled boolean (platform-wide toggle)
- [ ] Build enrollment email HTML template (welcome to course, CTA to start learning)
- [ ] Build sendEnrollmentEmail() server helper using SendGrid
- [ ] Wire enrollment email into: admin manual enroll, Stripe checkout.session.completed, group seat assignment
- [ ] Add platform email settings UI in Admin panel (toggle + test send button)
- [ ] Add per-course enrollment email toggle to Course Settings tab in LMS Admin
- [ ] Tests for enrollment email logic

## Secondary Pricing Options + Preview Lessons (May 15)

### Secondary Pricing Options
- [x] Add lms_pricing_options table (courseId, label, pricingType, price, stripePriceId, sortOrder, isActive, customCta)
- [x] Add pricing options CRUD procedures to lmsAdmin router
- [x] Add getPricingOptions to lmsPublic/lmsLearner router
- [x] Build Pricing Options editor in Course Settings tab (add/edit/reorder/delete options)
- [x] Update Course Landing Page CTA: primary pricing default + selectable alternate options
- [x] Add "Pricing Options" content block to landing page block editor (shows all active options with labels)
- [x] Wire Stripe checkout to accept pricingOptionId so alternate options use correct price/plan

### Preview Lessons
- [x] Add isPreview boolean column to lms_lessons (already existed)
- [x] Add previewLessons to getCoursePlayer query (bypass enrollment check for preview lessons)
- [x] Add isPreview toggle to Lesson Settings panel in LMS Admin (enhanced label)
- [x] Preview lessons: bypass drip and prerequisite rules in getCoursePlayer
- [x] CoursePlayer: show preview badge on preview lessons in sidebar
- [x] CoursePlayer: upgrade prompt modal on entry to non-preview content (not enrolled)
- [x] CoursePlayer: upgrade prompt on exit from last preview lesson
- [x] CoursePlayer: show preview lessons in curriculum even when not enrolled
- [ ] CourseOverview: show preview lessons as accessible in curriculum outline

## Bug Fixes (May 17)
- [x] Fix Course Overview block editor crash when adding blocks (JS error / stack trace on screen)
- [x] Fix Enroll Student modal: allow creating a new user account + enrolling when email not found

## LMS Features (May 18)
- [x] Add createAndEnrollUser procedure to lmsAdminRouter (create user + enroll in course in one call)
- [x] Update EnrollStudentDialog to support Create & Enroll flow (email validation, create account option)
- [x] Build enrollment email notifications end-to-end (sendEnrollmentEmail helper, platform settings UI, email template)
- [x] Add Course Overview topBlocks/bottomBlocks editing and rendering (three-zone layout: above progress bar, below curriculum, main zone)
- [x] CourseOverview: Parse and render courseOverviewTopBlocks (above progress bar)
- [x] CourseOverview: Parse and render courseOverviewBottomBlocks (below curriculum outline)
- [x] LMSAdmin CourseOverviewEditor: Add zone tabs to switch between top/main/bottom zones
- [x] LMSAdmin CourseOverviewEditor: Render all three zones in canvas with zone-specific add buttons
- [x] PlatformAdmin: Add EnrollmentEmailSettingsPanel for customizing enrollment email subject/intro/footer

## Bug Fixes (May 18 — continued)
- [x] Fix FunnelBuilder: Add missing ChevronUp import from lucide-react

## Branding Fixes (May 18 — continued)
- [x] Add TM symbol to iHeartEcho™ in LMS course brand selector (3 locations in LMSAdmin.tsx)
- [x] Add TM symbol to iHeartEcho™ in Login page combined branding
- [x] Add TM symbol to iHeartEcho™ in LMSLayout header comment

## Enrollment Email Extension (May 18)
- [ ] Extend sendEnrollmentEmail helper to support all content types (course, download, bundle, quiz)
- [ ] Add createAndEnrollUser procedure to downloadsAdminRouter (digital products)
- [ ] Add createAndEnrollUser procedure to downloadsAdminRouter (bundles)
- [ ] Add createAndEnrollUser procedure to sonoQuizRouter (quizzes)
- [ ] Add EnrollStudentDialog to DigitalDownloadsAdmin page
- [ ] Add EnrollStudentDialog to BundlesAdmin page
- [ ] Add EnrollStudentDialog to SonoQuiz admin section in LMSAdmin

## Enrollment Email Extension (May 18)
- [x] Rewrite enrollmentEmail.ts to support all content types (course, download, bundle, quiz)
- [x] Add createAndGrantDownloadAccess procedure to downloadsAdminRouter
- [x] Add createAndGrantBundleAccess procedure to downloadsAdminRouter
- [x] Add createAndInviteQuizUser procedure to sonoQuizRouter
- [x] Add GrantDownloadAccessDialog to DigitalDownloadsAdmin (search user, create if not found, grant access + email)
- [x] Add GrantBundleAccessDialog to BundlesAdmin (search user, create if not found, grant access + email)
- [x] Quizzes: already covered via CourseUsersTab EnrollStudentDialog (same course editor flow)

## Unenroll Student Feature (May 18)
- [x] CourseUsersTab: Replace confirm() with proper AlertTriangle confirmation dialog for unenroll
- [x] CourseUsersTab: Add AlertTriangle to lucide-react imports in LMSAdmin.tsx
- [x] UserDetailView (student profile): Add Trash2 unenroll button to each course row in Courses tab
- [x] UserDetailView: Add unenroll confirmation dialog with student name and course title
- [x] UserDetailView: Wire removeEnrollment mutation with refetch on success

## Funnel Page Copy Feature
- [ ] Add "Copy Page" action to each funnel page item in the funnel sidebar (not inside Page Settings)
- [ ] Copy options: (1) within same funnel, (2) to another funnel (picker), (3) as standalone landing page
- [ ] Backend: copyFunnelPage procedure supporting all three destinations
- [ ] Remove any subtext/description from the copy action UI

## Slug Editing
- [ ] Allow editing the URL slug of funnel pages inline from the funnel page list
- [ ] Allow editing the URL slug of standalone landing pages
- [ ] Backend: updatePage procedure must accept and validate slug changes (unique, URL-safe)

## Funnel Branch Visualization
- [x] Show conditional branching patterns on the main funnel settings/overview page
- [x] Display which pages branch to which based on branch rules (conditions, targets)
- [x] Integrate with existing FunnelFlowDiagram or add a branch summary panel

## Funnel Overview Tabs (Pages / Settings / Contacts / Analytics)
- [x] Restructure FunnelDetailView into four tabs: Pages, Settings, Contacts, Analytics
- [x] Analytics tab: per-page views, drop-off rates, conversion rates, buy points, critical issues
- [x] Contacts tab: leads/contacts from lead forms, exportable CSV
- [x] Backend: getFunnelAnalytics procedure (per-page stats, drop-off, conversions)
- [x] Backend: getFunnelLeads procedure with pagination
- [x] Backend: exportFunnelLeadsCSV procedure
- [x] Backend: detectSalesIssues procedure (missing product, no next step, broken branch targets)
- [x] Add Page dialog: import existing product/course/download page into funnel
- [x] Backend: listImportablePages procedure (standalone landing pages + product pages)

## Course/Download Admin Tabs & Fixes
- [ ] Fix free-product toggle placement bug (floating next to price input instead of its own label)
- [ ] Add Grant Access + Save buttons at top of overview page (already at bottom)
- [ ] Add tab navigation to course admin: Settings, Landing Page, Students, Analytics, Curriculum
- [ ] Add tab navigation to download admin: Settings, Landing Page, Students, Analytics

## Dual Membership & Thinkific Sync
- [x] Add DUAL_MEMBERSHIP product config to brandMembershipRouter.ts (both brands, $12.99/mo)
- [x] Add createDualMembershipCheckout procedure to brandMembershipRouter
- [x] Handle dual membership webhook in stripe.ts (grant both aaus + iheartecho brandMemberships)
- [x] Handle dual membership subscription lifecycle (cancellation cancels both brands)
- [x] Add Thinkific sync on dual membership purchase
- [x] Add Thinkific sync for free members on OAuth login (auth.me) if not yet enrolled
- [x] Add Dual Membership pricing card to Premium.tsx
- [x] Add Dual Membership card to iHeartEcho premium page (shared Premium.tsx)

## Physical Products Module
- [x] Add physicalProducts, physicalProductPricingOptions, physicalProductOrders tables to schema.ts
- [x] Apply DB migration (CREATE TABLE physical_products, physical_product_pricing_options, physical_product_orders)
- [x] Build productsRouter (productsPublicRouter, productsLearnerRouter, productsAdminRouter) with full CRUD, checkout, page builder procedures
- [x] Register productsRouter in routers.ts
- [x] Build PhysicalProductsAdmin.tsx admin UI (list, create, edit, pricing options, Shopify fields, image upload, page builder link)
- [x] Add Products tab to LMSAdmin.tsx
- [x] Build ProductLandingPageBuilder.tsx (page builder for product sales pages)
- [x] Build ProductLanding.tsx (public-facing sales page with Shopify embed/URL support and native Stripe checkout)
- [x] Add product routes to App.tsx for both AAUS and IHE route trees
- [x] Wire physical products into OrderBumpsAdmin (trigger + bump type, product name resolution)
- [x] Extend orderBumpsRouter triggerType enum to include "physical"
- [x] Handle physical_product type in Stripe webhook handler (handlePhysicalProductCheckoutCompleted)
- [x] Fix field name mismatches (shopifyUrl→shopifyProductUrl, shopifyEmbed→shopifyEmbedCode)
- [x] Write vitest tests for Products module (4 tests passing)

## Student Dashboard (Cross-Brand Unified)
- [x] dashboardRouter: getMyContent aggregates LMS enrollments from both AAUS and iHeartEcho brands
- [x] dashboardRouter: getMySubscriptions returns brandMemberships for both brands with brand label
- [x] dashboardRouter: getMyCertificates returns certs from both brands
- [x] StudentDashboardPage: My Content tab shows brand badge (AAUS / iHeartEcho) on each item
- [x] StudentDashboardPage: Subscriptions tab shows brand label and manages both brands
- [x] StudentDashboardPage: Certificates tab shows brand badge on each cert
- [x] StudentDashboardPage: support ?tab= URL param to deep-link to a specific tab
- [x] /my-dashboard route accessible from all layouts (Layout.tsx, LMSLayout.tsx)
- [x] Vitest: dashboardRouter procedures covered

## Embedded Checkout Block (Stripe)

- [x] funnelPurchases DB table created (tracks all embedded-checkout purchases)
- [x] embeddedCheckoutRouter: createPaymentIntent procedure (with order bumps, address, source context)
- [x] embeddedCheckoutRouter: confirmPayment procedure
- [x] EmbeddedCheckoutBlock component: two-step flow (details → payment → success)
- [x] EmbeddedCheckoutBlock: animated order bumps (pulse/glow/shake/bounce via IntersectionObserver)
- [x] EmbeddedCheckoutBlock: address collection toggle (auto-enabled for physical products)
- [x] EmbeddedCheckoutBlock: contact info collection (name, email, phone)
- [x] EmbeddedCheckoutBlock: Stripe PaymentElement (inline, no redirect)
- [x] embedded_checkout block type added to BLOCK_CATALOG in LandingPageBuilder (auto-available in FunnelBuilder + ProductLandingPageBuilder)
- [x] embedded_checkout case added to BlockPreview
- [x] embedded_checkout case added to PublicFunnelPage renderer
- [x] embedded_checkout case added to StandaloneLandingPage renderer
- [x] Order bump CSS animations added to index.css
- [x] dashboardRouter: getMyContent now includes funnelPurchases
- [x] StudentDashboardPage: My Content → Purchases tab shows funnel/checkout purchases

## Pricing Restructure — Founding Member Positioning
- [x] Hide annual plans (showAnnual: false) — preserved in code for future re-enable
- [x] Monthly pricing kept at $9.97/month (single app)
- [x] Dual app monthly kept at $12.99/month
- [x] Add lifetime tier: $99.97 one-time (single app Founding Member)
- [x] Add lifetime tier: $147 one-time (both apps Founding Member)
- [x] Add createDualLifetimeCheckout procedure to brandMembershipRouter
- [x] Redesign Premium.tsx with countdown timer, value pillars, urgency banner
- [x] Four pricing cards: Monthly, Lifetime (featured), Dual Monthly, Dual Lifetime (best value)
- [x] Remove annual billing references from all components (PremiumModal, PremiumGate, UpgradePrompt, PremiumOverlay, PremiumPearlGate)

## Inline Checkout Block (Stripe)
- [x] InlineCheckoutBlock component: contact info, product selector, billing address toggle, Stripe CardElement, order bumps, summary, terms, submit
- [x] Order bumps with pulse/glow/shake/bounce animations (matching CTA button animations)
- [x] Address collection toggle (defaults ON for physical products)
- [x] inline_checkout block type added to BLOCK_CATALOG in LandingPageBuilder
- [x] inline_checkout editor case in LandingPageBuilder with full product/bump/color controls
- [x] inline_checkout rendered in BlockPreview, PublicFunnelPage, StandaloneLandingPage
- [x] Purchases recorded to funnelPurchases table and surfaced in My Dashboard → My Content
- [x] Build passes cleanly

## Audio Block & Media Trim (Sprint 8)
- [x] Audio block type added to BLOCK_CATALOG (all page builders)
- [x] AudioBlockEditor: upload mp3/wav/ogg/m4a/webm, in-browser microphone recording
- [x] AudioBlockPlayer: custom player with play/pause, progress bar, mute, trim support
- [x] Audio block: autoplay, muted, loop, show/hide controls toggles
- [x] Audio block: in-browser trim (start/end time dual-range slider with visual track)
- [x] Audio block wired into BlockPreview, PublicFunnelPage, StandaloneLandingPage
- [x] Video block: autoplay, muted, loop, controls toggles added to editor
- [x] Video block: trim support (HTML5 media fragment #t=start,end) for direct video files

## Webhook Auto-Fulfillment & Audio Waveform
- [x] Webhook: payment_intent.succeeded auto-enrolls buyer in LMS course (fulfillment_course_id metadata)
- [x] Webhook: payment_intent.succeeded grants brand membership (fulfillment_brand: aaus/iheartecho/both)
- [x] embeddedCheckoutRouter: lmsCourseId and fulfillmentBrand fields added to createPaymentIntent input
- [x] AudioBlockPlayer: Web Audio API waveform visualizer with canvas rendering
- [x] AudioBlockPlayer: scrub-position indicator (playhead line on waveform)
- [x] AudioBlockPlayer: click-to-seek on waveform canvas
- [x] AudioBlockPlayer: fallback scrubber shown when waveform decode fails

## Admin User Detail Page & Post-Purchase Redirect
- [x] adminUserRouter: getUserDetail, enrollCourse, unenrollCourse, grantMembership, revokeMembership, cancelSubscription, refundPayment, issueCertificate, removeCertificate, updateUserRole
- [x] AdminUserDetailPage: admin mirror of StudentDashboard with Profile/Content/Subscriptions/Certificates tabs
- [x] AdminUserDetailPage: action buttons (Enroll, Unenroll, Grant/Revoke Membership, Cancel Sub, Refund, Issue/Remove Certificate, Change Role)
- [x] AdminUserDetailPage: route /admin/users/:userId registered in App.tsx
- [x] UserAnalytics: "Manage →" button on each user row navigates to AdminUserDetailPage
- [x] InlineCheckoutBlock: successRedirect URL field already present in all block editor cases

## Platform Admin Restructure (May 2026)
- [x] Analytics/Logs tab on Student Dashboard — login history, page views, IP details (self-service)
- [x] Platform Admin: Dual App group with brand toggle (Email Campaigns, Sharing Monitor, Form Builder, Media Repository, Downloads, Education Library, Funnel Builder, Contacts, User Analytics)
- [x] Platform Admin: Per-Brand Tools group (Case Management, Daily Challenge, ScanCoach Editor, Navigator Editor, Thinkific Webhook, Challenge Card Generator, Social Content Generator, SoundBytes Admin)
- [x] Platform Admin: iHeartEcho Only group (Engagement Dashboard, Image Quality Review)
- [x] Platform Admin: drag-and-drop reordering of admin tool cards within each group
- [x] Platform Admin: compact user search → navigates to User Analytics with pre-filled search (full user list removed from dashboard)
- [x] Add missing dual-app admin routes to IHeartEchoRouter (funnels, contacts, user-analytics, sharing-monitor, lms, downloads, admin/users)
- [x] Media Repository: brand tag (AAUS/IHE) added to uploaded items; filter by brand in UI
- [x] analyticsTrack.myActivity: self-service procedure returning login history, page views, enrollments, downloads for current user

## Lesson Editor Fixes (May 18)
- [x] Lesson Editor: Preview button opens course player in new window at the correct lesson (/learn/{courseSlug}/player?lesson={id}&preview=admin)
- [x] Lesson Editor: Add Block / Copy Block scrolls canvas to the newly added block automatically
- [x] CTA block (pricing_cta): replaced hard-coded course URL with free-form ctaUrl field (any destination)
- [x] CTA block (pricing_cta): replaced "show course price" checkbox with flexible Pricing Display panel (manual entry or item-linked, current price, strikethrough price, price position above/below)
- [x] CTA block (pricing_cta): item picker auto-fills ctaUrl and currentPrice when a course/download/quiz is selected
- [x] Lesson Editor: Preview button opens course player in new window at correct lesson
- [x] Lesson Editor: Add Block scrolls canvas to newly added block

## Import Page to Funnel & Save as Template (May 18)
- [x] importPageToFunnel: fixed course sourceType to fetch blocks from lmsLandingPages table (blocks were missing on import)
- [x] LandingPageBuilder: added "Save as Template" button in top bar (amber, opens TemplateLibrary with page tab pre-selected)
- [x] LandingPageBuilder: TemplateLibrary now accepts initialTab prop to open directly on the correct tab
- [x] FunnelPageEditor: added "Save as Template" button in top bar (amber) with inline modal dialog (name + description fields)
- [x] FunnelPageEditor: save page template calls trpc.lmsAdmin.savePageTemplate with all current blocks

## Bug Fixes - Lesson Effects & Audio Block (May 18)
- [x] Fix lesson effect settings not storing (effectBannerDuration missing from updateLessonEffect procedure + LMSAdmin not passing it)
- [x] Fix sound/confetti not firing in CoursePlayer
- [x] Add banner duration slider to LessonEffectEditor UI
- [x] Fix audio block recording not playing after upload
- [x] Fix audio block trim not working (useEffect doesn't re-apply when trimStart/trimEnd change)
- [x] Fix audio block waveform not showing (CORS fetch fails for R2 URLs)

## Form Builder Enhancements & DIY Separation (May 18)
- [x] Add "General Form" type to form type selector (generalFormTemplates.formType enum)
- [x] Add import form by URL feature (importFormByUrl procedure + Import by URL button in FormList)
- [x] Add public form URL with editable slug (updateSlug procedure + Share tab)
- [x] Add embed form option (Share tab with embed code snippet)
- [x] Add branding/theme settings (text, background, font, color) (updateTheme procedure + Style/Branding tab)
- [x] Add analytics dashboard to form settings (getFormAnalytics + Analytics tab)
- [x] Add public form renderer at /forms/:slug (PublicFormRenderer.tsx)
- [x] Separate DIY Accreditation Tool into its own admin division — DIYAccreditationAdmin hub page + AccreditationDivisionRouter + /admin/diy-accreditation route + PlatformAdmin card
- [x] Separate results tables from DIY accreditation (generalFormSubmissions vs accreditationFormSubmissions)
- [x] General Form Builder: no accreditation categories, optional score calculation in settings (scoreEnabled field)

## Audio Recording Fix (May 2026)
- [x] Fix data URI regex that failed to strip prefix for mime types with semicolons (audio/webm;codecs=opus)
- [x] Replace regex /^data:[^;]+;base64,/ with indexOf(";base64,") approach in routers.ts and lmsRouter.ts
- [x] Remove MediaRecorder timeslice (mr.start(250) → mr.start()) to produce valid single-chunk WebM files
- [x] Add error handling for empty recordings and missing audio tracks in AudioBlockEditor
- [x] Use refs for handleFileUpload and set to avoid stale closure issues in recording callbacks

## Gate Consistency & DIY Landing Page (May 2026)
- [x] Fix compact gate banner on accreditation-navigator — set teaserHeight=0 for RoleGuard on accreditation/navigator routes
- [x] Add teaserHeight prop to RoleGuard component
- [x] Create public DIY Accreditation landing/sales page (DIYAccreditationLanding.tsx) — hero, features, how-it-works, pricing teaser, FAQ, CTA
- [x] Set DIYAccreditationLanding as root route for accreditation.iheartecho.com (no auth required)
- [x] Replace all ICAEL references with IAC across 5 files
- [x] Fix Back to Dashboard button in PremiumPearlGate (window.location.href)

## Form Builder Reorder Bug (May 2026)
- [x] Fix item/block reorder (drag and arrow buttons) broken in General Form Builder — fixed broken filter/reduce swap logic, now uses correct array destructuring swap
- [x] Fix item/block reorder (drag and arrow buttons) broken in DIY Form Builder — fixed auto-sortOrder on item creation
- [x] Fix form preview button broken and public form link returns 404 — added getFormPreview admin procedure + /forms/:slug/preview route bypassing isPublic check
- [x] General Form Builder and DIY Form Builder now open full-screen (no sidebar) with breadcrumb navigation back
- [x] Fix: General Form public renderer not showing dropdown/multi-select options — root cause: Drizzle sql template IN() treated joined IDs as single parameter; fixed with inArray()

## Form Builder Improvements (May 2026)
- [x] Lesson Quiz & Flashcard block types with AI generation, manual entry, image uploads
- [x] Form reorder arrows fixed (correct array swap)
- [x] Form preview/public link 404 fixed (admin preview route)
- [x] Full-screen editor layout for both General and DIY form builders
- [x] Dropdown/multi-select options not loading fixed (Drizzle inArray)
- [x] Radio/checkbox label rename (Single Choice / Multi-Select)
- [x] Embed code copy button moved above code block
- [x] Form styling system in GeneralFormBuilder + PublicFormRenderer (layoutMode, bgType, cardShadow, dropdownAccentColor, stickyHeader)
- [x] Add saveFormDraft, getFormResults, exportFormResults to generalFormRouter
- [x] Build ResultsTab in GeneralFormBuilder (status filters, detail drawer, CSV export)
- [ ] Port styling system to DIY FormBuilderAdmin + DynamicFormRenderer
- [ ] Add saveFormDraft, getFormResults, exportFormResults to formBuilderRouter (DIY)
- [ ] Build ResultsTab in FormBuilderAdmin (DIY)
- [ ] Add hostDomain field to generalFormTemplates + accreditationFormTemplates schema
- [ ] Add Host Domain dropdown to form settings (both builders) with custom domain list, default app.allaboutultrasound.com
- [ ] Update getPublicUrl logic to use hostDomain for public form links
- [ ] Wire debounced auto-save (saveFormDraft) in PublicFormRenderer + DynamicFormRenderer

## Waveform & Block Template Fixes (May 2026)
- [x] Fix AudioBlockPlayer waveform: bars now always fill full container width using offsetWidth instead of hardcoded 600px canvas width; ResizeObserver ensures correct sizing on mount
- [x] Wire onSaveAsTemplate prop to SortableBlock in LessonBlockEditor so Save as Template button appears on each block
- [x] Verify quiz/flashcard blocks appear at bottom of Content tab (correct — added via push() after other Content items)
- [x] Add OPTIONS preflight handlers to all /api/media/:slug routes for proper cross-origin CORS support

## Instructor Sidebar & Flashcard Fixes (May 2026)
- [x] Add "Show instructor profile in lesson sidebar" toggle to Course Settings tab (course-level switch)
- [x] Wire toggle to updateCourse mutation (both Save buttons) — showInstructor boolean saved to lmsCourses
- [x] CoursePlayer sidebar reads course.showInstructor and respects lesson-level override (inherit/show/hide)
- [x] Fix flashcard button defaults: Got It #1ab7b4 / #ffffff, Still Learning #f0fdfa / #189593
- [x] Add Reflection question style to quiz AI generator

## Sales Tab (LMS Admin)
- [x] Server: getSalesData procedure — fetch orders/enrollments with Stripe payment info per course/product
- [x] Server: refundOrder mutation — call Stripe refund API
- [x] Server: cancelSubscription mutation — call Stripe cancel subscription API
- [x] Server: getCheckoutLinks procedure — return all pricing option checkout URLs + embed codes
- [x] Client: SalesTab component — checkout links section with copy + embed code
- [x] Client: SalesTab — sales table with running total, student name, date, amount, status
- [x] Client: SalesTab — student profile drawer (name, email, enrollment status, order history)
- [x] Client: SalesTab — refund/cancel actions with confirmation dialog
- [x] Wire SalesTab into LMSAdmin course-level tabs

## Rich Text Editor Enhancements
- [x] Add direct video file upload into rich text editor (TipTap) with S3 storage and inline playback (auto-saved to Media Repository)

## Funnel Builder & Education Library (May 19, 2026)
- [x] Fix thinkificImportRouter.ts TypeScript error (db import → getDb())
- [x] Fix lmsRouter.ts dripDays TypeScript error (null vs undefined in .set())
- [x] Add default Hero block on new lesson creation
- [x] Add CTA with Opt-In block to Funnel Builder (Conversion category)
  - [x] Block renderer in BlockPreview.tsx
  - [x] Block editor settings in LandingPageBuilder.tsx (headline, subtext, placeholders, button, colors, tags)
  - [x] Live form renderer in PublicFunnelPage.tsx (CtaOptinBlock) with submitLead mutation + tags
- [x] Add showInLibrary field to lmsCourses schema (migration applied)
- [x] Add showInLibrary field to digitalProducts schema (migration applied)
- [x] Fix Downloads not showing in Education Library (bridge digitalProducts into lms.listCourses when type=download)
- [x] Add showInLibrary toggle to LMS admin (courses/quizzes/downloads) — on by default
- [x] Add showInLibrary toggle to Digital Downloads admin — on by default
- [x] Add content type selector (Course/Quiz/Download) to Thinkific importer dialog
- [x] Fix build error: wrong use-toast import in ThinkificImporter.tsx (replaced with sonner)
- [x] Smart Education Library card routing: non-owners → sales/landing page, owners → access/player page
  - [x] Courses/quizzes: enrolled → /learn/:slug/player, not enrolled → /learn/:slug
  - [x] Digital products: purchased → /downloads/:slug/files, not purchased → /downloads/:slug
  - [x] Owned cards show green checkmark + "Continue Learning / Access Download / Continue Quiz" CTA

## Lesson Free Preview & Course Outline (May 2026)
- [x] Add previewMode enum (none/preview/preview_hide_after_purchase) to lmsLessons schema
- [x] Replace isPreview toggle with three-option previewMode selector in lesson editor (LMSAdmin)
- [x] Update getLesson access control to use previewMode three-state logic
- [x] Update getCourse and lesson select queries to return previewMode
- [x] Add Free Preview eye icon + clickable "Free Preview" link in curriculum_auto block (CourseLanding)
- [x] Hide preview_hide_after_purchase lessons from enrolled users in CourseOverview
- [x] CoursePlayer: use previewMode for hasPreviewLessons check and lesson access gating

## Thinkific Enrollment Sync & Management (May 2026)
- [ ] Add syncThinkificEnrollments server procedure (pull enrollments from Thinkific API into lms_enrollments)
- [ ] Add getEnrollments, addEnrollment, removeEnrollment, updateEnrollment procedures for a course
- [ ] Build Enrollments tab in LMS course admin with student list, sync button, and add/remove/edit actions
- [ ] Show sync status (last synced, count pulled from Thinkific vs local)

## Thinkific Import: Cover Image & Landing Page Blocks (May 2026)
- [x] Fix scrapeThinkificSalesPage() to produce properly-wrapped blocks: { id, type, data: { ... } } instead of flat { type, ... }
- [x] After course creation, insert lmsLandingPages record with scraped blocks (pre-populates page builder)
- [x] Always append a curriculum_auto block at the end of scraped landing page blocks
- [x] Add sendEnrollmentEmail to updateCourse input schema (was silently dropped on save)
- [x] coverImageUrl (from course.card_image_url) saved to lmsCourses on import and displayed in CourseSettingsForm

## Thinkific Import: Enrollment Count Fix (May 2026)
- [x] Fix enrollment import to only include active (non-expired) enrollments — filter out e.expired === true
- [x] Fix preview dialog enrollment count to show active-only count (not all-time total)
- [x] Log skipped expired count in import log for transparency

## Course Player Enhancements (May 2026)
- [x] Course-level custom text/labels — admin can override "Lesson", "Module", "Course Modules", "Mark Complete", "Completed", "Next Lesson", "Prev", "Submit Quiz" per course
- [x] Full-screen content mode in course/quiz player — Maximize button in header hides sidebar/right panel, Escape key exits

## Thinkific Import Improvements (May 2026)

- [x] Fix SCORM/ZIP asset mediaType detection - update ACS Flashcards Sample to scorm type
- [x] Add Change Type UI in Media Repository asset detail panel
- [x] Preserve lesson HTML body as text content block (instead of stripping tags)
- [x] Fix video URL import - use video_url only, not take_url (which requires Thinkific auth)
- [x] Always create landing page on import - use API data (description, banner image) as fallback when scraping fails
- [x] Fix landing page description block type (use "text" not "html")

## UI Bug Fixes (May 20, 2026)
- [x] Remove dual logos (iHeartEcho + AAUS) from LMSLayout sidebar header — keep only AAUS logo
- [x] Move CoursePlayer route outside LMSLayout so it renders full-screen without the sidebar nav
- [x] Fix LessonBlockEditor "Save block as template" — wrap component with BlockTemplateLibraryProvider
- [x] Fix LessonBlockEditor BlockTemplatesTabContent — use blockType/blockData from schema (not tpl.blocks)
- [x] Fix SsoRedirect.tsx — use 'loading' instead of non-existent 'isLoading' from useAuth

## LMS Layout & Dashboard Fixes (May 20, 2026)
- [x] Remove LMS sidebar entirely — learn domain now uses header-only navigation
- [x] Move LMS Admin and Media Repository links into the profile dropdown (admin-only, shown only to platform_admin/admin)
- [x] Remove Analytics tab from StudentDashboardPage (My Dashboard) — tabs now: Profile, My Content, Subscriptions, Certificates

## Session: May 20, 2026 — Cross-domain SSO + Nav fixes

- [x] Remove LMS sidebar entirely from learn domain
- [x] Move admin items (LMS Admin, Media Repository) into profile dropdown
- [x] Remove Analytics tab from My Dashboard
- [x] Add full top navigation bar to LMSLayout (Home, Education Library, Downloads, My Dashboard)
- [x] Add mobile hamburger menu to LMSLayout
- [x] Update LMSLayout branding to "All About Ultrasound™ | iHeartEcho™"
- [x] Add /platform-admin and all other admin routes to LMSRouter (fix 404)
- [x] Implement cross-domain SSO token infrastructure (ssoAuto REST endpoint)
- [x] Build useCrossDomainSso hook with per-domain token issuance
- [x] Wire useCrossDomainSso into all four routers (LMS, IHE, AAUS, Accreditation)
- [x] Add accreditation subscription gate: only active accreditation subscribers broadcast from accreditation domain
- [x] Fix HemodynamicsLab chunk load error with auto-reload ErrorBoundary
## Session: May 20, 2026 — Members Hub + Brand Detection + IHE Fixes
- [x] Create members.allaboutultrasound.com hub (MembersLayout + MembersRouter)
- [x] Extend cross-domain SSO to 5 domains (add members domain)
- [x] Redirect My Dashboard/Edit Profile from AAUS/IHE apps to members hub
- [x] Fix brand detection: send X-App-Hostname header in every tRPC request (main.tsx)
- [x] Fix brand detection: check X-App-Hostname first in server context (context.ts)
- [x] Fix IHE footer: show www.iheartecho.com and © iHeartEcho™ on iHeartEcho domain
- [x] IHE SoundBytes empty state — root cause fixed by brand detection fix
- [x] IHE member count offset (+3,997) — root cause fixed by brand detection fix
- [x] IHE Daily Challenge echo categories — root cause fixed by brand detection fix
## Lead Capture & Universal CTA Opt-In (May 20, 2026)
- [ ] Lead Capture Form block: add name field (with show/hide toggle), input field appearance controls (border color, bg, text color, placeholder color, border radius)
- [ ] Lead Capture Form block: button style controls (filled/outline toggle, outline border color, button bg, button text color)
- [ ] Lead Capture Form block: button behavior options (send email + optional campaign link, external URL, go to landing page, go to next funnel step)
- [ ] Lead Capture Form block: auto-store contact data to funnelLeads on every submission
- [ ] CTA with Opt-In block: same input appearance + button style + behavior controls
- [ ] Add listCampaignsPublic procedure to funnelPublicRouter (for campaign dropdown in block settings)
- [ ] BlockSettings: extend lead_capture and cta_optin settings panels with all new controls
- [ ] Universal lead capture modal: every CTA/button block (cta_standalone, hero buttons, pricing_cta, etc.) gets optional "Collect Lead Before Action" toggle
- [ ] Universal lead capture modal: when enabled, clicking the button shows a name/email modal first, then executes the button's original action
- [ ] Universal lead capture modal: modal appearance uses the same field/button style settings as lead_capture block
- [ ] Wire lead capture modal into PublicFunnelPage, CourseLanding, DownloadLanding, BlockPreview

## Session: May 20, 2026 — Lead Capture & Universal CTA Modal

- [x] Lead Capture Form block: name field toggle + name placeholder setting
- [x] Lead Capture Form block: input appearance (border color, bg, text color, placeholder color, border radius)
- [x] Lead Capture Form block: button style (filled/outline, outline border color, bg, text color)
- [x] Lead Capture Form block: button behavior (send_email + campaign link, external_url, go_to_landing_page, next_funnel_step)
- [x] CTA with Opt-In block: same input appearance + button behavior controls
- [x] Pricing CTA block: lead capture toggle in settings
- [x] Hero block buttons: lead capture toggle per button
- [x] CTA Standalone block: lead capture toggle in settings
- [x] LeadCaptureModal component: reusable modal for any button lead capture
- [x] HeroBlockWithLeadCapture: hero block rendering with per-button lead capture modal
- [x] CtaStandaloneBlock: standalone CTA with lead capture modal support
- [x] PricingCtaBlock: pricing CTA with lead capture modal support
- [x] funnelLeads schema: added campaign_id column (migration applied)
- [x] submitLead procedure: added campaignId input field
- [x] listCampaignsPublic procedure: public endpoint to list campaigns for dropdown
- [x] Contact data auto-stored on every form submission (funnelLeads table)
- [x] Email campaign routing: campaignId linked to lead on submission

## Session: May 20, 2026 — Navigation & Profile Cleanup
- [x] LMSLayout top nav: keep only "Education Library" link; add "All About Ultrasound™" and "iHeartEcho™" external links; remove Downloads and My Dashboard
- [x] LMSLayout profile dropdown: remove "My Profile" link (→ /profile)
- [x] LMSLayout profile icon: change from gradient to solid teal (#179ca3)
- [x] MembersLayout: remove IHE logo (keep AAUS logo only)
- [x] MembersLayout: remove "My Profile" link (→ /profile) from account dropdown
- [x] MembersLayout profile icon: change from gradient to solid teal (#179ca3)
- [x] MembersRouter (App.tsx): /profile route now redirects to /my-dashboard?tab=profile
- [x] StudentDashboardPage ProfileTab: add Notifications section (daily challenge reminder toggle + timezone selector)
- [x] StudentDashboardPage ProfileTab: add Content Interests section (ACS, Adult Echo, Pediatric Echo, Fetal Echo, POCUS checkboxes)
- [x] Layout.tsx (AAUS/IHE main app): "Edit Profile" link updated to members.allaboutultrasound.com/my-dashboard?tab=profile
- [x] Layout.tsx profile icon: change from gradient to solid teal (#179ca3)

## Funnel Checkout Enhancements (May 2026)
- [ ] Funnel price overrides: store override price per product/bump in block data (all 3 checkout block types)
- [ ] Use funnel override price in payment intent creation (ignore published product price when override is set)
- [ ] Immediate access grant at checkout completion (enroll user in courses, grant download access, unlock quizzes)
- [ ] Send buyer purchase confirmation email with access details
- [ ] Send owner notification email on funnel purchase

## Block Picker Unification (May 2026)
- [x] Add 3-tab block picker modal (New Block, Copy from Other Pages, Block Templates) to FunnelPageEditor
- [x] Add 3-tab block picker modal to LandingPageBuilder (courses as source for Copy tab)
- [x] Add 3-tab block picker modal to DownloadLandingPageBuilder (downloads as source for Copy tab)
- [x] Add 3-tab block picker modal to ProductLandingPageBuilder (physical products as source for Copy tab)
- [x] LessonBlockEditor already had the 3-tab picker (lessons as source for Copy tab) — verified consistent
- [x] Add getCoursesWithLandingBlocks, getDownloadsWithLandingBlocks, getProductsWithLandingBlocks to lmsAdminRouter
- [x] Add getFunnelsWithPages to funnelRouter for FunnelPageEditor Copy tab
- [x] All editors: left panel replaced with "Add Block" button that opens the modal
- [x] All editors: Block Templates tab uses blockTemplates.list and blockTemplates.delete procedures
- [x] Vitest tests for block picker utilities (7 tests passing)

## Strikethrough Price + Price Override (May 2026)
- [ ] pricing_cta: already has strikethrough price — add price override field (manual price that overrides auto-pulled price)
- [ ] cta_standalone: add strikethrough price + price override fields to editor panel and renderer
- [ ] cta_optin: add strikethrough price + price override fields to editor panel and renderer
- [ ] hero block buttons: add per-button price display, strikethrough price, and price override
- [ ] urgency_offer: add price display, strikethrough price, and price override fields
- [ ] checkout_form (legacy): add per-product price override + strikethrough price in product list
- [ ] checkout_form (legacy): add per-bump price override + strikethrough price in order bumps list
- [ ] order_bump_checkout: already has compareAtPrice — ensure it renders as strikethrough; add price override
- [ ] price_stack: already has originalPrice as strikethrough — add price override for finalPrice
- [ ] CheckoutFormBlock (live checkout): add per-product price override + strikethrough price
- [ ] FunnelBlocks (InlineOrderBumpBlock, ProductOfferStackBlock): add strikethrough price rendering
- [ ] All renderers in BlockPreview updated to show strikethrough price and use override price

## Strikethrough Price + Price Override (May 2026)
- [x] Add optional display-only strikethrough price to all checkout forms and CTA/pricing blocks
- [x] Add price override field to all checkout forms that pull products/courses/quizzes/downloads
- [x] pricing_cta: already had showStrikethroughPrice + strikethroughPrice (confirmed working)
- [x] hero buttons: per-button showStrikethrough + strikethroughPrice fields in editor + renderer
- [x] cta_standalone: displayPrice + showStrikethrough + strikethroughPrice in editor + renderer
- [x] cta_optin (CtaOptinSettings): displayPrice + showStrikethrough + strikethroughPrice in editor + renderer
- [x] urgency_offer: displayPrice + showStrikethrough + strikethroughPrice in editor + renderer
- [x] checkout_form: headerStrikethroughPrice + per-product strikethroughPrice in editor + renderer
- [x] inline_checkout: headerStrikethroughPrice + per-product strikethroughPrice in editor + renderer
- [x] order_bump_checkout: per-bump strikethroughPrice in editor + renderer
- [x] product_offer_stack: per-product strikethroughPrice in editor (FunnelBlocks.tsx renderer)
- [x] InlineCheckoutBlock: headerStrikethroughPrice + per-product strikethroughPrice in renderer
- [x] FunnelBlocks.tsx: ProductOfferStackBlock per-product strikethroughPrice rendering
- [x] 11 vitest tests passing (strikethroughPrice.test.ts)

## Checkout Fulfillment Auto-Access (May 2026)
- [ ] Auto-grant access to primary checkout product without requiring Fulfillment box entry
- [ ] Rename Fulfillment box to "Additional Access" (for bonus products/courses beyond primary)
- [ ] Convert LMS Course ID field to searchable product/course/download picker
- [ ] Stripe webhook: read products from checkout form block data and auto-fulfill on payment

## Brand Membership Label Update (May 2026)
- [x] Update brand membership labels to "All About Ultrasound - UltrasoundAssist" and "iHeartEcho - EchoAssist" everywhere
  - [x] LandingPageBuilder.tsx (inline_checkout and embedded_checkout settings panels)
  - [x] AdminUserDetailPage.tsx (grant membership dialogs)
  - [x] LMSAdmin.tsx (course brand select items)
  - [x] EducationLibrary.tsx (brand filter)
  - [x] PlatformAdmin.tsx (dual brand toggle and viewing-as badge)
  - [x] StudentDashboardPage.tsx (brand badge config)
  - [x] Premium.tsx (founding member badge label)
  - [x] useBrand.ts (brand config name fields)
  - [x] quickfireRouter.ts (leaderboard owner brand name)
  - [x] caseLibraryRouter.ts (owner display name masking)

## Two-Column Layout Block (May 2026)
- [x] Implement column_layout block data model (leftBlocks/rightBlocks arrays with nested blocks, leftRatio, gap, bgColor, paddingX, paddingY)
- [x] Add column_layout block type to funnel page builder block catalog (BLOCK_CATALOG in LandingPageBuilder.tsx)
- [x] Add column_layout BlockSettings case with inline ColumnBlockList editor (add/remove/reorder blocks per column, recursive BlockSettings)
- [x] Add column_layout block type to LMS lesson builder (LessonBlockEditor imports from LandingPageBuilder — auto-inherited)
- [x] column_layout public render component in BlockPreview.tsx (recursive BlockPreview rendering for left/right columns)
- [x] column_layout renders in LMS lesson viewer (CoursePlayer uses BlockPreview — auto-inherited)
- [x] 8 vitest tests for column_layout block data structure (server/columnLayout.test.ts)
- [x] Drag-and-drop existing blocks from main canvas into column_layout left/right columns
- [x] Within-column block reordering via drag (nested SortableContext)
- [x] "Move out" button on column child blocks to eject back to main canvas
- [x] DragOverlay ghost preview while dragging
- [x] Visual drop zone highlight (teal ring + bg) when hovering over a column

## Lesson Commenting System (May 2026)
- [x] Add `commentsEnabled` boolean column to `lmsLessons` table (default false)
- [x] Add `commentBanned` boolean column to `users` table (default false, silent — no notification)
- [x] Create `lessonComments` table (id, lessonId, userId, content, createdAt, deletedAt, deletedByAdminId)
- [x] Run migration SQL for all schema changes
- [x] tRPC: `lessonComments.list` — enrolled users, paginated, excludes soft-deleted
- [x] tRPC: `lessonComments.add` — protected, checks commentsEnabled + not commentBanned (ban is silent)
- [x] tRPC: `lessonComments.delete` — admin only, soft-delete with deletedByAdminId
- [x] tRPC: `lessonComments.adminList` — cross-lesson paginated list with search (name/content/lesson title)
- [x] tRPC: `lessonComments.banUser` — admin only, toggle banned boolean (silent, no notification)
- [x] Student UI: LessonCommentSection component at bottom of CoursePlayer, only shown when commentsEnabled
- [x] Admin UI: commentsEnabled toggle in lesson editor (LMSAdmin.tsx)
- [x] Admin UI: AdminLessonComments page — delete comments, ban/unban users, search across all lessons
- [x] Admin nav: "Lesson Comments" link in LMSLayout and MembersLayout admin dropdown
- [x] 16 vitest tests for comment validation, permission enforcement, soft-delete, and schema structure

## Column Layout DnD Fix + Template Picker + Reply Threading (May 2026)
- [ ] Fix drag-and-drop into column_layout zones (rewrite using pointer-event tracking)
- [ ] Add template block picker inside column left/right zones
- [ ] Add parentId to lesson_comments table for reply threading
- [ ] Migrate DB with parentId column
- [ ] Update lessonComments.list tRPC to return nested replies
- [ ] Update lessonComments.add tRPC to accept optional parentId
- [ ] Update LessonCommentSection UI with Reply button and threaded view
- [ ] Vitest tests for reply threading logic

## Column Layout DnD Fix + Template Picker + Reply Threading (May 2026)
- [x] Fix column DnD: use document.elementsFromPoint (data-col-zone attr) for reliable pointer-based drop detection
- [x] Add ColumnBlockPickerDialog inside each column zone (catalog + saved templates tabs)
- [x] Wire onAddBlockToColumn from main canvas to SortableBlock to ColumnDropZone
- [x] Add parentId to lesson_comments schema + DB migration
- [x] Update lessonCommentsRouter.list to return nested replies per top-level comment
- [x] Update lessonCommentsRouter.add to accept parentId (1-level deep, no nested replies)
- [x] Rewrite LessonCommentSection with Reply button, threaded reply display, collapse/expand replies
- [x] 24 vitest tests passing (8 column layout + 16 lesson comments)

## Drag Between Columns + Admin Reply Moderation (May 2026)
- [ ] Drag-between-columns: extend pointermove detector to detect col zones in any column block (not just main canvas → column)
- [ ] Update handleDragEnd to handle column-to-column moves (remove from source column, add to target column)
- [ ] Admin reply moderation: Show Replies toggle per comment row in AdminLessonComments
- [ ] Admin reply moderation: delete individual replies from the expanded reply list

## Daily Challenge IHE Fix (May 22, 2026)
- [x] Fix ensureTodaySet: add brand filter to all fallback question queries so IHE only picks IHE-brand questions
- [x] Fix getTodaySet: removed "clear categories without live challenge" loop that zeroed out fallback question IDs
- [x] Delete stale IHE daily set rows and stale live challenge rows with AAUS question IDs
- [x] Fix DailyChallenge.tsx: filter enabledCats to only include categories with non-null questions (no more "No question available today" cards for ECG/Physics on IHE)
- [x] Fix DailyChallenge.tsx: filter CATS.map grid to only render cards for categories with questions
- [x] Fix DailyChallenge.tsx: filter Preferences panel to only show toggles for categories with questions today
- [x] Fix DailyChallenge.tsx: filter banner enabledCatKeysForBanner to exclude null-question categories

## LandingPageBuilder Bugs (May 22, 2026)
- [ ] Fix drag-and-drop block reordering: blocks snap back to original position after drop
- [ ] Fix add-block-from-saved-template within content block: block not inserted after selecting template
- [ ] Fix save-block-as-template: floppy disk icon does nothing; add name prompt dialog before saving

## IHE Daily Challenge Fix - Round 2 (May 22, 2026)
- [x] Fix brand detection: embed _brand query param in tRPC URL (Cloud Run strips custom headers)
- [x] Fix DailyChallenge.tsx: derive CATS from server-returned categoryMap keys, not just isIHE flag
- [x] Fix DailyChallenge.tsx: hoist useIHECats to be available in Preferences panel scope
- [x] Fix ensureTodaySet: add brand filter to all fallback question queries
- [x] Fix dragstart global prevention that was blocking drag-and-drop in page builder

## LandingPageBuilder Fixes (2026-05-22)
- [x] Fix save-block-as-template: move saveDialogOpen state before useCallback in BlockTemplateLibrary.tsx to fix closure bug
- [x] Fix add-block-from-template: make Insert button always visible (was opacity-0 until hover)
- [x] Fix drag-and-drop: remove global dragstart prevention from main.tsx
# Last updated: Fri May 22 19:37:18 UTC 2026

## Funnel Page Link Preview / SEO (May 23 2026)
- [x] Add seo_title, seo_description, seo_image columns to funnel_pages table (DB migration applied)
- [x] Add seoTitle, seoDescription, seoImage fields to updatePage tRPC procedure
- [x] Create server/routes/funnelOgMeta.ts — injects correct OG meta tags into HTML for /f/:funnelSlug/:pageSlug and /p/:pageSlug URLs
- [x] Register funnelOgMetaRoutes in server/_core/index.ts before SPA catch-all
- [x] Add "Link Preview" collapsible panel to FunnelPageEditor sidebar with Display Name, Description, Preview Image URL fields, live mini-preview card, and Save button

## AI Course Generation Upgrade (May 2026)
- [x] Add module count slider (3-20) to AI course generation modal
- [x] Add lessons per module slider (3-10) to AI course generation modal
- [x] Add starter content / outline textarea to AI course generation modal
- [x] Add per-lesson 5-question quiz generation toggle
- [x] Upgrade aiGenerateCourse server procedure: full lesson body HTML, per-lesson quizzes, complete landing page
- [x] Upgrade aiCommitCourse to save per-lesson quizzes, lesson content, and landing page heroImageUrl
- [x] Upgrade preview step to show module/lesson/quiz counts with content snippets

## Payment Failure Auto-Cancel & Sales Admin (May 23, 2026)
- [x] Add invoice.payment_failed webhook handler: sends payment failed email, cancels subscription + revokes access after 3 failed attempts or when Stripe gives up (next_payment_attempt is null)
- [x] Build AdminSalesPage (/admin/sales): filterable/searchable sales list, drill-down sheet with refund, resend access email, and cancel subscription actions
- [x] Add Sales tool card to PlatformAdmin.tsx tool grid
- [x] Register /admin/sales route in App.tsx (all brand variants, platform_admin guard)
- [x] Add Purchases tab to UserAnalytics UserDetailView: per-user purchase history with inline refund and resend access email actions
- [x] Student Subscriptions tab already exists in StudentDashboardPage with cancel/reactivate self-service

## Discount Codes & Sales Dashboard (May 23, 2026)
- [x] Enable allow_promotion_codes on all existing Stripe checkout session creators (LMS courses, quizzes, downloads, products, memberships, funnels)
- [x] Build AdminDiscountCodesPage (/admin/discount-codes): create Stripe coupons (% or fixed), create promotion codes, list active/inactive codes, deactivate codes, apply globally or restrict to specific products
- [x] Add tRPC procedures: createCoupon, listCoupons, deactivateCoupon, deactivatePromoCode, getSalesAnalytics
- [x] Build AdminSalesDashboard (/admin/sales-dashboard): revenue summary cards, daily revenue area chart, per-type bar chart, per-product sortable table, date range filter, export CSV, paginated transaction list
- [x] Refactor UserAnalytics (/admin/user-analytics): keep logins, access/roles, courses, page views, quiz activity, drill-down to user profile — removed Purchases tab (moved to Sales Dashboard)
- [x] Add Discount Codes and Sales Dashboard tool cards to PlatformAdmin grid
- [x] Register /admin/discount-codes and /admin/sales-dashboard routes in App.tsx

## Promo Code in Checkout Forms (May 23, 2026)
- [x] Fix: React error #310 in DownloadLanding (useEffect after early return — hooks order violation)
- [ ] Server: validatePromoCode procedure (checks Stripe promo code, returns discount details)
- [ ] Server: accept promoCode input in createCheckout for downloads, courses, products, memberships
- [ ] Client: PromoCodeInput shared component (input + apply button + discount badge + price preview)
- [ ] Client: Wire PromoCodeInput into DownloadLanding buy buttons
- [ ] Client: Wire PromoCodeInput into CourseLanding buy buttons
- [ ] Client: Wire PromoCodeInput into ProductLanding buy buttons
- [ ] Client: Wire PromoCodeInput into Premium page membership checkout

## Promo Code in Checkout Forms & Hooks Fix (2026-05-23)
- [x] Fix: React error #310 in DownloadLanding — useEffect after early return (hooks order violation)
- [x] Add promoCode optional input to downloadsLearner.createCheckout server procedure
- [x] Add promoCode optional input to lms.createCheckout server procedure (all 3 session types)
- [x] Add promoCode optional input to productsLearner.createCheckout server procedure
- [x] Add promoCode optional input to brandMembership.createCheckout server procedure
- [x] Create shared PromoCodeInput component (validates via validatePromoCode, shows discount text, clearable)
- [x] Wire PromoCodeInput into DownloadLanding sidebar buy card
- [x] Wire PromoCodeInput into CourseLanding sidebar buy card
- [x] Wire PromoCodeInput into Premium page above pricing cards

## URL Structure Migration & Standalone Pages (2026-05-23)
- [x] Rename /learn/:slug → /courses/:slug across all routers, pages, server URL builders
- [x] Rename /f/:slug/:pageSlug → /:slug/:pageSlug (no /f/ prefix) across all routers and server
- [x] Rename /products/:slug → /product/:slug across all routers and server URL builders
- [x] Move CourseLanding (/courses/:slug) outside LMSLayout — renders standalone without learn header
- [x] Move DownloadLanding (/downloads/:slug) outside LMSLayout and MembersLayout — standalone
- [x] Move ProductLanding (/product/:slug) outside LMSLayout and MembersLayout — standalone
- [x] Move PublicFunnelPage (/:slug/:pageSlug) outside all layout wrappers — standalone on all domains

## User Profile URL Parameter Passthrough (2026-05-23)
- [ ] Build injectUserParams(url, user) utility — replaces {{name}}, {{email}}, {{firstName}}, {{lastName}}, {{userId}} and also appends as query params
- [ ] Build useUserUrlParams() hook — reads auth user and returns injectUserParams bound to current user
- [ ] Wire passthrough into all iframe/embed block renderers in PublicFunnelPage
- [ ] Wire passthrough into all iframe/embed block renderers in CourseLanding and DownloadLanding BlockPreview
- [ ] Wire passthrough into all iframe/embed block renderers in ProductLanding BlockPreview
- [ ] Add copy-paste tag reference panel to URL inputs in FunnelPageEditor embed blocks
- [ ] Add copy-paste tag reference panel to URL inputs in LandingPageBuilder embed blocks
- [ ] Add copy-paste tag reference panel to URL inputs in DownloadLandingPageBuilder embed blocks
- [ ] Add copy-paste tag reference panel to URL inputs in ProductLandingPageBuilder embed blocks

## User Profile URL Parameter Passthrough
- [x] Build injectUserParams utility (client/src/lib/userUrlParams.ts)
- [x] Build UserParamTagsHelper copy-paste component
- [x] Wire passthrough into PublicFunnelPage video/embed blocks
- [x] Wire passthrough into CourseLanding video/embed blocks
- [x] Wire passthrough into DownloadLanding video/embed blocks
- [x] Add tag helper panel to LandingPageBuilder video/embed settings (shared by all 4 builders)

## Badge Label Fix — May 2026
- [x] Change "Download" badge label to "Digital Download" in StudentDashboardPage.tsx (line 745) and RelatedProductsBlock.tsx (lines 194, 252)

## Legacy URL Redirects — May 2026
- [x] Add server-side 301 redirects: /learn/:slug → /courses/:slug, /f/:slug/:pageSlug → /:slug/:pageSlug, /f/:slug → /:slug, /products/:slug → /product/:slug
- [x] Add vitest tests for all 4 redirect patterns (13 tests passing)

## Performance Fix — May 2026
- [x] Fix N+1 query problem in funnelRouter: funnel.list, getFlowDiagram, listBranchRules now use batch inArray queries instead of per-row loops (was causing /admin/funnels/:id to take 60+ seconds)

## Cloudflare SEO Proxy — May 2026
- [x] Add CANONICAL_ROOT_DOMAIN env var to server/_core/env.ts
- [x] Update funnelOgMeta.ts to inject <link rel="canonical"> using x-canonical-host header from Cloudflare Worker
- [x] Write Cloudflare Worker script (references/cloudflare-proxy-worker.js)
- [x] Write Cloudflare proxy setup guide (references/cloudflare-proxy-setup.md)
- [ ] Set CANONICAL_ROOT_DOMAIN=allaboutultrasound.com secret in Manus project settings
- [ ] Deploy Worker to Cloudflare and add route rules (see setup guide)

## Subdomain Routing Architecture — May 2026
- [x] Define LEARN_APP_URL, MEMBERS_APP_URL, ROOT_DOMAIN_URL constants in useSubdomain.ts
- [x] Update SsoRedirect to support targetOrigin parameter for members subdomain
- [x] Update main Router: landing pages → root domain, player/files → learn, account → members
- [x] Update LMSRouter: strip landing pages, keep player/files routes only
- [x] Update Cloudflare Worker: add education-library proxy path, route to learn/members/app correctly
- [x] 25 vitest tests passing for subdomain routing logic

## Domain Routing Refactor (replacing Cloudflare proxy — May 2026)
- [x] Revert App.tsx ROOT_DOMAIN_URL redirects — courses/downloads/products/funnels render directly without redirecting
- [x] Add publishDomain setting to platform settings (DB + admin UI dropdown of custom domains)
- [x] LMSRouter: serve courses/*, quiz/*, education-library on learn.allaboutultrasound.com
- [x] Funnel/download/product public URLs use admin-selected publish domain
- [x] Education library reverts to learn.allaboutultrasound.com/education-library

## Sales Dashboard Merge
- [x] Merge "Sales Dashboard" (AdminSalesDashboard) and "Sales (Legacy)" (AdminSalesPage) into a single unified sales page
- [x] Remove the duplicate entry from the admin tools grid

## Thinkific Import Fix (May 2026)
- [x] Fix ThinkificContent interface to match actual API response (free vs free_preview, no html_description/video_url/duration)
- [x] Fix mapContentType to handle actual Thinkific types (HtmlItem, Iframe) + infer from take_url path
- [x] Fix scrapeThinkificSalesPage URL to use custom domain (member.allaboutultrasound.com) instead of subdomain.thinkific.com
- [x] Fix enrollment progress conversion (percentage_completed "1.0" = 100%)
- [x] Fix sales page scraping CSS patterns to match actual Thinkific page structure
- [x] Fallback landing page generation from API data when scraping fails
- [x] Direct enrollment into lms_enrollments (no pending state, no notifications)

## Checkout CTA on Landing Pages (May 2026)
- [ ] Add "checkout" as a CTA action type in block settings (alongside "url", "scroll", etc.)
- [ ] Block settings: when "checkout" selected, show product/course selector dropdown
- [ ] Server: createCheckoutSession procedure for landing page CTA (course/quiz/download/product)
- [ ] Post-payment: auto-login via magic token in success_url, redirect to /my-dashboard
- [ ] BlockPreview + public page renderers: handle checkout action (call tRPC, open Stripe URL)

## Direct Checkout CTA (May 2026)
- [x] Add "Direct Checkout (Stripe)" behavior option to hero block buttons, cta_standalone, and pricing_cta block editors in LandingPageBuilder
- [x] Add funnelPublic.createDirectCheckout tRPC procedure (public, no auth required) — resolves product details from DB, creates Stripe Checkout session with success_url=/my-dashboard
- [x] Handle direct_checkout behavior in PublicFunnelPage.tsx for all 3 block types (hero, cta_standalone, pricing_cta)
- [x] Show "Direct Checkout (Stripe)" badge in BlockPreview.tsx for all 3 block types
- [x] Add funnel pages as source in "Copy from Other Pages" tab (LandingPageBuilder, DownloadLandingPageBuilder, ProductLandingPageBuilder, LessonBlockEditor)

## Bug Fixes — Button Animations & Reviews Block (May 2026)
- [x] Fix button animations not applied on public landing pages: added ctaAnimation class to pricing_cta and cta_standalone buttons in DownloadLanding.tsx, CourseLanding.tsx, and ProductLanding.tsx
- [x] Fix reviews block using wrong field name (d.items → d.reviews) in DownloadLanding.tsx
- [x] Confirmed BlockPreview.tsx (used by lesson pages inside CoursePlayer) already has correct animation classes and d.reviews — no fix needed there

## Bug Fixes — User Analytics (May 24, 2026)
- [x] Fix Active Users showing 0 — now reads from users.lastSignedIn (213 active users in 30d)
- [x] Fix Logins showing 0 — falls back to users.lastSignedIn count when user_login_events is empty
- [x] Fix Daily Trend logins chart — now uses users.lastSignedIn grouped by date
- [x] Fix userList lastLogin column — now reads users.lastSignedIn instead of MAX(user_login_events.created_at)
- [x] Add Purchases stat card to overview (reads digital_purchases.purchased_at)
- [x] Add Enrollments stat card to overview (reads lms_enrollments.enrolled_at)
- [x] Fix userLoginEvents.ip → userLoginEvents.ipAddress field name mismatch in myActivity
- [x] Add analyticsRouter.overview.test.ts — 8 tests all passing

## Thinkific Import Improvements (May 2026)
- [x] Add getContentDetail to fetch full lesson content (html_description, video_url, quiz questions) per lesson
- [x] Fix lesson import to use detail fields for embedUrl, content, durationMinutes, and contentBlocks
- [x] Add video block to lesson contentBlocks when video URL is available
- [x] Add quiz block to lesson contentBlocks when quiz questions are available
- [x] Fix landing page scrape to try public Thinkific subdomain first instead of member portal (which requires login)

## Thinkific Full Resync (May 2026)
- [x] Extend getContentDetail to include images, attachments, download_url, content_type-specific fields
- [x] Update lesson import to use rich text as primary content block (video block first, then html_description as text block, plus embed/download/quiz blocks when present)
- [x] Add resyncCourse procedure: re-fetches all lesson content, enrollments, progress, and re-scrapes landing page
- [x] Add Re-sync button to admin Thinkific import page for previously imported courses

## Thinkific Import Fixes (May 2026)
- [x] Add Re-sync button to LMS Admin course settings panel (Thinkific sync banner) for already-imported courses
- [x] Fix course card image not transferring during import (card_image_url should populate coverImageUrl)

## Thinkific Card Image Sync Fix (May 2026)
- [x] Fix card image not syncing during initial import (coverImageUrl column confirmed, import already sets it)
- [x] Fix card image not updating in syncThinkificEnrollments mutation (removed !course.coverImageUrl guard — now always updates)
- [x] Fix card image not updating in resyncCourse procedure (added step 0: always fetch and update cover image first)
- [x] Add Re-sync button to course Settings tab (Thinkific Re-sync section with toggles for content/enrollments/landing page)

## Free Preview Registration Link (May 2026)
- [ ] Detect lessons marked as free/free preview in LMS course
- [ ] Generate a shareable free preview registration link for the course
- [ ] Display the free preview link in course settings panel (only when free lessons exist)
- [ ] Add copy-to-clipboard button for the link

## Free Preview Enrollment System (May 2026)
- [x] Add getCourseFreePreviewLessons tRPC procedure (returns lessons where previewMode != 'none')
- [x] Generate shareable free preview link ({origin}/learn/{slug}?preview=1) in CourseSettingsForm
- [x] Show free preview lesson list + copy link panel in CourseSettingsForm (only when preview lessons exist)
- [x] Add enrollmentType field to lms_enrollments schema: 'full' | 'free_preview'
- [x] Migrate DB: add enrollment_type column to lms_enrollments
- [x] Update enrollment creation logic: ?preview=1 route creates free_preview enrollment
- [x] Show "Free Preview" badge in student analytics table (admin LMS student list)
- [x] Show "Free Preview" badge in student profile detail panel (admin view)
- [x] Show upgrade prompt in course player 3 minutes after accessing free preview content
- [x] Upgrade prompt links to the course's own checkout/purchase page (not premium app access)
- [x] Dismiss upgrade prompt with "Maybe Later" (re-shows on next lesson load)

## Lesson Type Change (May 2026)
- [x] Add lesson type selector to lesson editor (allow changing type after creation)
- [x] Add updateLessonType tRPC procedure (or extend updateLesson to accept lessonType)
- [x] Show free preview badge in CourseUsersTab student list (enrollmentType = 'free_preview')
- [x] Add 3-minute upgrade prompt timer in CoursePlayer for free_preview enrollees

## Funnel Root URL 404 Fix (May 2026)
- [x] Add getFirstPage procedure to funnelPublic router (takes funnelSlug, returns first page by sortOrder)
- [x] Add FunnelRootRedirect component that auto-redirects /:slug to /:slug/:firstPageSlug
- [x] Add /:slug route in App.tsx (before /:slug/:pageSlug) that renders FunnelRootRedirect
## SCORM HTML Renderer (May 2026)
- [x] Build server-side SCORM ZIP extractor: download ZIP from S3, extract to temp dir, find launch file (imsmanifest.xml → launch, or index.html)
- [x] Serve extracted SCORM files via /api/media/:slug/scorm-files/* static file handler
- [x] Update /media/:slug embed page: detect scorm mediaType, render iframe pointing to /api/media/:slug/scorm-launch instead of download buttons
- [x] Cache extracted SCORM files in /tmp/scorm-cache/:slug/ to avoid re-extracting on every view
## SCORM ZIP Renderer Fixes (May 2026)
- [x] Fix: ZIP mediaType was not triggering SCORM iframe — now all ZIP/scorm/lms mediaTypes use iframe
- [x] Fix: Unified /scorm/* route so relative asset paths in SCORM HTML resolve correctly
- [x] Fix: URL-decode req.path before path.join (Express does not decode wildcard paths)
- [x] Fix: Resolve relative asset paths relative to launch file's parent directory (for nested ZIPs)
## Reviews Block Drag-and-Drop Reordering (May 2026)
- [x] Add SortableReviewItem component with GripVertical drag handle in LandingPageBuilder
- [x] Wrap reviews list in DndContext + SortableContext for vertical reordering
- [x] Move reviewSensors hook to top of BlockSettings (React rules of hooks compliance)
## Checklist Content Block (May 2026)
- [x] Add "checklist" to BlockType union in BlockPreview.tsx
- [x] Add checklist renderer in BlockPreview.tsx (checkmark badge instead of number)
- [x] Add checklist catalog entry in LandingPageBuilder.tsx BLOCK_CATALOG (Marketing category)
- [x] Add checklist BlockSettings case in LandingPageBuilder.tsx (identical to numbered_list editor)
- [x] Add checklist label case in LessonBlockEditor.tsx
- [x] Add checklist renderer in CourseLanding.tsx
- [x] Add checklist renderer in DownloadLanding.tsx
- [x] Add checklist renderer in PublicFunnelPage.tsx
- [x] DownloadLandingPageBuilder, ProductLandingPageBuilder, FunnelPageEditor inherit checklist automatically via BLOCK_CATALOG import
## Carousel Content Block (May 2026)
- [ ] Add "carousel" to BlockType union in BlockPreview.tsx
- [ ] Build CarouselBlock renderer: image/video slides, fade/slide/zoom transitions, nav arrows, dot indicators, auto-play, bg/border color
- [ ] Build CarouselBlockEditor settings panel: add/remove/reorder items (dnd-kit), URL or file upload per item, SEO alt text, caption/description, transition selector, bg color, border color
- [ ] Register carousel in LandingPageBuilder (catalog entry + BlockSettings case)
- [ ] Register carousel in LessonBlockEditor (label case)
- [ ] Add carousel renderer to PublicFunnelPage, CourseLanding, DownloadLanding

## Group Registration System (May 2026)
- [ ] Schema: add allowGroupPurchase boolean to lms_courses
- [ ] Schema: add memberName, status (pending/active/revoked) to lms_group_seats
- [ ] Schema: add groupName override field to lms_groups
- [ ] Migration: apply schema changes via webdev_execute_sql
- [ ] Server: createGroupCheckout tRPC procedure (seats quantity, group name, course, Stripe)
- [ ] Server: Stripe webhook — create lms_group record on paid group order, send invite emails
- [ ] Server: buildGroupSeatInviteEmail email template
- [ ] Server: getMemberProgress query (group manager — per-group enrollment + lesson progress)
- [ ] Server: updateSeat mutation (edit name/email for pending seats)
- [ ] Server: resendInvite mutation
- [ ] Server: updateCourseSettings — add allowGroupPurchase field
- [ ] GroupAdminDashboard page: my groups list with seat counts, used/total
- [ ] GroupAdminDashboard: seat table per group (assign by email+name, revoke, edit, resend invite)
- [ ] GroupAdminDashboard: member progress view (lesson completion, quiz scores, last activity)
- [ ] LMSAdmin: Allow Group Purchase toggle in course settings
- [ ] LMSAdmin: group purchase URL display + copy button
- [ ] LandingPageBuilder: CTA block group enrollment link option
- [ ] Group enrollment landing page (/group-enroll/:token) — accept seat, redirect to course
- [ ] Post-checkout group success page — redirect to group admin dashboard
- [ ] App.tsx: wire /group-admin, /group-enroll/:token, /courses/:slug/group-success routes

## Block Content Width Control (May 2026)
- [ ] Add contentWidth field to all block defaultData in BLOCK_CATALOG (default: "lg")
- [ ] Add BlockWidthControl shared UI component to BlockSettings in LandingPageBuilder
- [ ] Apply contentWidth wrapper in BlockPreview renderer
- [ ] Apply contentWidth wrapper in PublicFunnelPage renderer
- [ ] Apply contentWidth wrapper in CourseLanding renderer
- [ ] Apply contentWidth wrapper in DownloadLanding renderer

## Image Block Clickable Link (May 2026)
- [ ] Add linkUrl + openInNewTab fields to image block defaultData in BLOCK_CATALOG
- [ ] Add link URL input + open-in-new-tab toggle to image BlockSettings in LandingPageBuilder
- [ ] Wrap img in <a> tag in BlockPreview when linkUrl is set
- [ ] Wrap img in <a> tag in PublicFunnelPage when linkUrl is set
- [ ] Wrap img in <a> tag in CourseLanding when linkUrl is set
- [ ] Wrap img in <a> tag in DownloadLanding when linkUrl is set

## Bug Fixes — May 25 2026
- [x] Fix SelectItem value="" crash in CurriculumCourseSelector (use "_auto" sentinel)
- [x] Fix full-bleed blocks (hero, pricing_cta, cta_standalone, image_content, urgency_offer, price_stack, product_offer_stack, etc.) being clipped by outer contentWidth wrapper in PublicFunnelPage, CourseLanding, and DownloadLanding

## CTA Action Dropdown & Free-Preview Enrollment (May 2026)
- [ ] Add "Free Preview Enroll" and "Group Enrollment" options to all existing CTA behavior dropdowns (hero, pricing_cta, cta_standalone)
- [ ] Add hero/banner "Make entire banner clickable" toggle with same action dropdown
- [ ] Upgrade bare-link CTA fields (image block, price_stack, urgency_offer, product_offer_stack) to full action dropdown
- [ ] Add server procedure for free-preview enrollment via CTA
- [ ] Track free-preview enrollments in lmsEnrollments with enrollmentType = "free_preview"
- [ ] Admin analytics: per-course free-preview enrollment counts drill-down
- [ ] Show "Free Preview" enrollment label in user profiles and My Dashboard

## CTA Action Dropdown & Block Enhancements — May 25 2026
- [ ] Build shared CTAActionField with 7 action types: Manual URL, Send Email, Next Funnel Step, Direct Checkout, Free Preview Enroll, Group Enrollment, Direct Order Bump
- [ ] Upgrade all hero button behavior dropdowns to use CTAActionField
- [ ] Upgrade pricing_cta, cta_standalone, price_stack, urgency_offer CTA dropdowns
- [ ] Upgrade image block link field to CTAActionField
- [ ] Add clickable-banner toggle to hero/banner blocks (entire banner clickable with same action dropdown)
- [ ] Add bottom border option to hero/banner blocks (toggle + thickness + color)
- [ ] Add card background color field to reviews block settings
- [ ] Handle all new CTA action types in PublicFunnelPage, CourseLanding, BlockPreview renderers
- [ ] Add server procedure for group checkout CTA (createGroupCheckoutCta)
- [ ] Wire free-preview enroll CTA action (calls lmsLearner.createFreePreviewEnrollment)
- [ ] Wire order bump direct link CTA action
- [ ] Build admin free-preview analytics drill-down (per-course preview enrollment counts)
- [ ] Show Free Preview enrollment label in user profiles and My Dashboard

## Block Builder Fixes — May 25 2026 (continued)
- [ ] Fix React error #310: hoist icCatalog/ecCatalog hooks out of switch-case blocks in LandingPageBuilder (inline_checkout, embedded_checkout)
- [ ] Make all blocks available in all page types (course landing, funnel, download, product, bundle, lesson)

## Order Bumps Fixes — May 25 2026
- [ ] Fix Order Bumps "Select product" dropdown not loading courses/products
- [ ] Add standalone/direct-link bump type (not tied to a specific purchase trigger)
- [ ] Add conditional branching options for showing order bumps
- [ ] Add direct link option for standalone bumps (accessible via URL, not shown at checkout)
- [ ] Add "Widget" vs "Landing Page" presentation mode for order bumps
- [ ] Landing page mode: full block-builder page (like funnel) accessible via direct URL

## Course vs Quiz Language Separation — May 25 2026
- [ ] Separate "Course" and "Quiz" as distinct types in all admin dropdowns (Order Bumps, CTA blocks, enrollment, etc.)
- [ ] Show "Quiz" icon/label separately from "Course" in student dashboard, enrollment lists, and checkout
- [ ] Order Bumps: add "Quiz" as a separate trigger/bump type option
- [ ] Checkout pages: display correct type label (Course vs Quiz vs Download) in order summary
- [ ] Student profile/dashboard: label enrollments as Course, Quiz, or Download separately

## Order Bumps Enhancements — May 25 2026
- [ ] Fix Order Bumps product dropdown not loading courses/quizzes/downloads
- [ ] Add "Standalone" bump type (not tied to a specific trigger purchase — direct-link only)
- [ ] Add "Landing Page" presentation mode (full block-builder page at /order-bump/{slug})
- [ ] Add conditional branching: show bump only if user has/has not purchased specific products
- [ ] Add slug field to order_bumps table for landing page URL
- [ ] Add presentationMode field (widget | landing_page) to order_bumps table
- [ ] Add blocks field (JSON) to order_bumps table for landing page builder
- [ ] Add isStandalone field to order_bumps table (no trigger required)

## Certificate Builder — May 25 2026
- [ ] Add certificate_templates table to schema (name, description, backgroundImageUrl, logoUrl, primaryColor, accentColor, fontFamily, signatureName, signatureTitle, signatureImageUrl, footerText, layout, isDefault)
- [ ] Add certificateTemplateId field to lmsCourses table (FK to certificate_templates)
- [ ] Run migration for new tables/fields
- [ ] Build CertificateTemplatesAdmin component (list, create, edit, preview, delete)
- [ ] Add "Certificates" tab to Education Library admin (LMSAdmin.tsx)
- [ ] Add template dropdown to course/quiz settings (when hasCertificate is enabled)
- [ ] Update certificateGenerator.ts to use template fields instead of hardcoded values
- [ ] Build saved certificates viewer (admin: browse all issued certificates by course/user)
- [ ] Add certificate preview in student dashboard/profile

## Session — May 25 2026 (Evening)
- [x] Certificate template CRUD procedures added to lmsRouter (listCertificateTemplates, createCertificateTemplate, updateCertificateTemplate, deleteCertificateTemplate)
- [x] certificateGenerator.ts updated to accept template fields (backgroundImageUrl, primaryColor, accentColor, fontFamily, signatureName, signatureTitle, logoUrl, footerText)
- [x] CertificateTemplatesAdmin component created with list/create/edit/delete UI
- [x] Certificates tab added to LMSAdmin.tsx
- [x] certificateTemplateId dropdown added to course settings (when hasCertificate enabled)
- [x] OrderBumpsAdmin product loading bug fixed (queries moved inside OrderBumpEditor component)
- [x] Quiz added as separate type option in OrderBumpsAdmin
- [x] Two-column block drag-and-drop fixed (pointer-events, data-col-zone propagation, main SortableContext IDs)
- [x] Shared CTAActionPicker component built with 10 action options
- [x] All hero buttons upgraded to CTAActionPicker (10 options)
- [x] pricing_cta, cta_standalone, price_stack, urgency_offer upgraded to CTAActionPicker
- [x] image block link field upgraded to CTAActionPicker
- [x] product_offer_stack per-product CTA upgraded to CTAActionPicker
- [x] Hero "Make entire hero section clickable" toggle added with CTAActionPicker
- [x] Hero bottom border toggle added (color + thickness)
- [x] Reviews block card background color field added

## Course Card & Related Products (May 25 2026)
- [x] Course card layout fix — uniform height, price+button same row, line-clamp-2 title, line-clamp-2 description, flex-1 spacer pins footer
- [x] Related Products manual selection mode — selectionMode toggle + product picker in BlockSettings
- [x] funnel.getProductsByIds backend procedure — fetches courses/downloads/bundles/physical by id list for manual mode
- [x] RelatedProductsBlock updated — handles selectionMode=manual, renders manualItems via getProductsByIds

## Archive/Trash System (May 2026)
- [x] Archive-to-trash for downloads, bundles, quizzes (soft delete with 30-day purge)
- [x] lmsAdmin.listArchive / purgeArchiveItem / purgeExpiredArchive procedures
- [x] LMS Trash tab in LMSAdmin with type filter and purge controls
- [x] Thinkific import: every lesson gets a hero block with lesson name only (no subtext, no CTA)
- [x] Course Curriculum (auto) block headline alignment control (Left/Center/Right)
- [ ] Add Ticker block settings panel in LandingPageBuilder (items text, separator, direction, speed, pause-on-hover, bg color, text color, font size/weight, letter spacing, text transform, padding)
- [ ] Fix image block clickable link not working in all page renderers (CourseLanding, PublicFunnelPage, DownloadLanding, LessonBlockEditor)

## Page Scraper / Import from URL (May 2026)
- [x] Server: add scrapeUrl tRPC procedure (public/admin) — fetch URL, parse HTML with cheerio, extract title, headings, paragraphs, images, lists, CTAs, and map to block types
- [x] Server: smart block mapping — hero → hero block, h1/h2 headings → heading block, paragraphs → rich_text block, img → image block, ul/ol → rich_text, CTA buttons → cta block, everything else → rich_text
- [x] LandingPageBuilder: "Import from URL" button in toolbar → dialog with URL input → calls scrapeUrl → inserts mapped blocks
- [x] FunnelPageEditor / FunnelBuilder: same "Import from URL" button and dialog
- [x] LessonBlockEditor: same "Import from URL" button and dialog
- [x] Install cheerio for server-side HTML parsing
- [x] Write vitest tests for scrapeUrl procedure (23 tests passing)
## Column Layout Block & Rich Text CTA Button (May 25 2026)
- [x] Fix column_layout block in FunnelPageEditor — add onAddBlockToColumn and onMoveBlockOutOfColumn handlers
- [x] Fix column_layout block in LessonBlockEditor — add onAddBlockToColumn and onMoveBlockOutOfColumn handlers
- [x] Fix column_layout block in LandingPageBuilder — updateBlock now also updates child blocks inside column_layout
- [x] Fix selectedBlock derivation in all three editors to also search column_layout children
- [x] Add CTA Button toolbar button to RichTextEditor with dialog (text, URL, bg color, text color, size, full-width)

## React Error #185 & Lesson Hero CTA Fixes (May 26, 2026)
- [x] Fix React error #185 in LandingPageBuilder (setState-during-render → useEffect)
- [x] Fix React error #185 in DownloadLandingPageBuilder (same pattern)
- [x] Fix React error #185 in ProductLandingPageBuilder (same pattern)
- [x] Fix React error #185 in MediaRepository (same pattern)
- [x] Thinkific lesson import hero blocks: add hideButtons:true so CTA button doesn't show on lesson pages

## Bug Fixes (May 2026 — Session Continuation)
- [x] getProductsByIds fallback: when type="course" is requested but ID not found in lms_courses, check digital_products and return as type="download" — fixes "COURSE" badge showing for eBook on Related Products blocks with legacy block data
- [x] Fix TypeScript errors in thinkificImportRouter.ts (file_size and description properties on ThinkificLessonContent type at lines 719 and 760) — added file_size and description to ThinkificLessonContent interface in thinkific.ts

## Column Layout Improvements (May 26, 2026 — Session 2)
- [x] Add "Remove from column" (trash) button on child blocks in all three editors (LandingPageBuilder, FunnelPageEditor, LessonBlockEditor)
- [x] Add "Move to other column" (⇄) button on child blocks in all three editors
- [x] Wire onMoveChildToOtherColumn and onDeleteChildFromColumn in FunnelPageEditor
- [x] Wire onMoveChildToOtherColumn and onDeleteChildFromColumn in LessonBlockEditor

## Thinkific Import Fix (May 26, 2026 — Session 2)
- [x] Fix getContentDetailWithSession: add unwrapPlayerResponse() to handle { content: {...} } or { data: {...} } JSON wrappers
- [x] Add scrapeLessonFromTakeUrl() as third fallback when player API returns no rich content (parses window.__INITIAL_STATE__, data-props, and raw HTML)
- [x] Wire take_url scraping fallback in both import and resync procedures
- [x] Add Diagnostics panel in ThinkificImporter for testing content fetch per lesson (player API + take_url scrape)
- [x] Add testContentFetch tRPC procedure to thinkificImportRouter

## Sales Page Scraper Fix (May 26, 2026 — Session 3)
- [x] Rewrite scrapeThinkificSalesPage to parse all Thinkific page sections: banner→hero, checklist→bullets, rich-text→text blocks, curriculum_auto, FAQ
- [x] Add testScrapeCourseSalesPage debug procedure (server) to test scraper end-to-end
- [x] Add "Test Sales Page Scraper" diagnostics card in ThinkificImporter UI (blue card)

## Video Block Upload & Lesson Nav (May 2026)
- [x] Video block settings: add URL/Embed, Upload (50 MB), and Media Library source modes
- [x] Video upload stores to S3 via uploadPageMedia
- [x] Media Library picker filters to video assets only
- [x] Lesson editor header: add prev/next lesson navigation buttons
- [x] Lesson editor header: pass prevLesson/nextLesson/onNavigateLesson from LMSAdmin

## Video Block Accent Color (May 2026)
- [x] Video block settings: add Player Theme section with accentColor picker (default #189aa1)
- [x] BlockPreview video case: apply accentColor to native video accent-color CSS property
- [x] BlockPreview video case: teal accent bar at bottom of iframe embeds
- [x] BlockPreview video case: empty state shows teal play button icon
- [x] BLOCK_CATALOG video defaultData: include accentColor: "#189aa1"

## React Error #310 CoursePlayer Fix (May 2026)
- [x] Fix React error #310 in CoursePlayer at ?preview=admin URL
- [x] Move adminPreviewStudent useState before adminBypass useMemo (dependency order)
- [x] Convert adminBypass from plain variable (after early returns) to useMemo hook (before early returns)
- [x] Move free-preview-enrollment useEffect from render section (after early returns) to hooks section (before early returns)
- [x] Fix isPreviewMode to recognize preview=admin (was only checking preview=student)
- [x] Add useMemo to React imports in CoursePlayer.tsx

## Batch May 26 2026
- [x] React error #31 fix: normalize bullets/numbered_list items (handle {text,crossed} objects)
- [x] Column block drag-and-drop: improved drop-zone visibility (ring-4, arrow indicator, scale effect)
- [x] Column block edit crash: extract ColumnBlockList as top-level component (fix nested component definition)
- [x] Course player sidebar: collapsible sections with Collapse All / Expand All toggle (desktop + mobile)
- [x] Course card pricing: show subscription interval suffix (/mo, /yr, /qtr) for subscription pricing type
- [x] Course settings: defaultMarkComplete toggle + playerTheme (dark/light) selector
- [x] Lesson settings: 3-state Mark Complete override (Inherit from course / Always show / Always hide)
- [x] CoursePlayer: resolve effective showMarkComplete (lesson override → course default → fallback ON)
- [x] CoursePlayer: apply playerTheme dark/light to all structural areas
- [x] Lesson hero banner: default maxHeight 150px for auto-generated hero blocks (editable)
- [x] Hero block settings: add maxHeight field to LandingPageBuilder settings panel
- [x] Section templates: save section as template, import from template or copy from another course
- [x] Add Section dialog: three options (blank / from template / from course)
- [x] DB migration: defaultMarkComplete on lms_courses, nullable requireManualComplete on lms_lessons, lms_section_templates table, playerTheme on lms_courses

## Batch May 26 2026 (Afternoon)
- [x] CRITICAL FIX: Course landing page "Course not found" for admins — getCourse now allows admins to see draft/archived/private courses without ?preview=admin
- [x] CRITICAL FIX: Same admin-bypass fix applied to downloadsRouter getBySlug for digital products
- [x] React error #31 fix: normalize bullets/numbered_list items (handle {text,crossed} objects)
- [x] Column block: extract ColumnBlockList as top-level component to fix crash on edit
- [x] Column block: improve drop-zone visual feedback (prominent active state)
- [x] Column block: add up/down reorder buttons for blocks within a column
- [x] Column block: propagate data-col-zone to child elements to fix second drag-drop
- [x] Course player sidebar: collapsible sections with Collapse All / Expand All toggle
- [x] Course card pricing: show subscription interval (e.g. $99.97/mo) on all course cards
- [x] Mark Lessons Complete: course-level default toggle + per-lesson 3-state override (Inherit/Show/Hide)
- [x] Section templates: save section as template, import from template or copy from another course in Add Section dialog
- [x] Hero banner: 150px default maxHeight on auto-generated lesson hero blocks (editable)
- [x] Course player theme: dark/light toggle in course settings, applied to player UI

## LMS Nav & Form Block (May 26 2026)
- [x] LMS Admin nav redesigned: grouped sidebar with Teal/Purple/Blue/Orange/Gray color groups
- [x] Added Webinars, Bundles, Memberships, Communities tabs (placeholder Coming Soon)
- [x] Reordered tabs: Courses, Quizzes, Downloads, Products, Webinars, Bundles, Memberships, Communities, Order Bumps, Collections, Groups, Instructors, Certificates, Enrollments, Analytics, Affiliates, Import, Trash
- [x] Free Previews merged into Enrollments tab as sub-tab
- [x] Admin header renamed to "LMS Management" (customer-facing stays "Education Library")
- [x] LMS brand labels: "All About Ultrasound™" and "iHeartEcho™" (LMS only, not app)
- [x] Collection course picker fixed (pageSize limit raised to 500)
- [x] React #31 crash fixed (CourseLanding checklist/bullets object normalization)
- [x] React #185 crash fixed (LandingPageBuilder inline ColumnBlockList hooks violation)
- [x] Form Embed block added to landing page builder (inline, popup-enter, popup-exit, popup-click modes)

## URL/Iframe Pass-Through Credentials (May 26 2026)
- [ ] In the URL/iframe embed block settings panel, add a "Pass User Credentials" section
- [ ] Show two toggleable params: name and email — when enabled, they are appended to the iframe src as query params (e.g. ?name=John&email=john@example.com)
- [ ] In BlockPreview and CourseLanding renderer: when rendering the iframe, if passName/passEmail are enabled and user is logged in, append the params to the URL at render time
- [ ] Show a "Copy URL with params" helper snippet in the settings panel so admins can preview what the final URL will look like

## Trash Restore & Lesson Undo (May 26 2026)
- [ ] Trash tab: add "Restore" button on each trashed item to recover it back to draft status (courses, quizzes, downloads, products)
- [ ] Lesson content editor: add undo/redo stack (Ctrl+Z / Ctrl+Y) for block add, delete, reorder, and edit operations
- [ ] Show undo/redo toolbar buttons in the lesson block editor header

## Rich Text Editor Image Enhancements
- [ ] Rich text editor: image selection shows resize handles (drag corners to resize)
- [ ] Rich text editor: image wrapping options (float left, float right, inline, block/full-width)
- [ ] Rich text editor: image alignment toolbar (left, center, right) when image is selected

## Per-Lesson Draft Status (May 2026)
- [x] Add lessonStatus ENUM('published','draft') column to lms_lessons table (default: published)
- [x] Add lessonStatus to updateLesson procedure input schema
- [x] Add bulkSetLessonStatus procedure (used by publish dialog)
- [x] Add Published/Draft toggle to LessonEditorPage settings tab
- [x] Show Draft badge on SortableLessonRow in curriculum list
- [x] Filter draft lessons from getCoursePlayer learner query (admins in preview see all)
- [x] Filter draft lessons from getCourseOverview learner query
- [x] Block draft lesson access in getLesson for non-admin users
- [x] Add publish-course dialog: "Publish all lessons" vs "Keep draft lessons hidden"

## Quiz Builder & Landing Page Settings (May 26 2026 Evening)
- [ ] Quiz-type lesson editor: show dedicated standalone quiz builder (flat question list, AI generation, passing score, retakes) instead of curriculum UI when lesson type is "quiz"
- [ ] Downloads admin landing page tab: remove legacy landingHeadline/landingBody/landingFeatures fields, keep Open Builder + Preview buttons, add AI Generate Landing Page button
- [ ] Products admin landing page tab: remove legacy landingHeadline/landingBody/landingFeatures fields, keep Open Builder + Preview buttons, add AI Generate Landing Page button
- [ ] HTML embed block: allow JavaScript (remove sanitization / use srcdoc with scripts enabled)

## Session: Quiz Builder, Landing Page Settings, Embed JS (May 26)
- [x] Quiz-type lesson editor: confirmed standalone QuizBuilderInline tab already exists and works correctly
- [x] Downloads landing page tab: removed legacy Headline/Body/Features fields, kept Open Builder + Preview buttons, added AI Generate Landing Page button
- [x] Products landing page tab: removed legacy Headline/Body/Features fields, kept Open Builder + Preview buttons, added AI Generate Sales Page button
- [x] Added aiGenerateLandingPage procedure to downloadsAdminRouter
- [x] Added aiGenerateLandingPage procedure to productsAdminRouter
- [x] HTML embed blocks: replaced dangerouslySetInnerHTML with srcdoc iframe (allows JavaScript execution) in BlockPreview, CourseLanding, PublicFunnelPage, DownloadLanding
- [x] Updated embed block settings label to note JavaScript is supported


## Session: Quiz Block, Question Bank, Lesson Simplification, Bug Fixes (May 26 2026 Late)
- [x] Fix deployment build error: useNavigate not exported by wouter v3.7.1 → replaced with useLocation-based navigation
- [x] Fix LayoutTemplate import: aliased Layout as LayoutTemplate from lucide-react
- [x] Add useOpenLearnLink function to LMSAdmin
- [x] Remove lesson type selector from AddLessonDialog (all lessons are "text" type)
- [x] Remove lesson type selector from LessonEditorPage settings tab
- [x] Remove Quiz Builder tab from LessonEditorPage header (quiz is now a content block)
- [x] Fix lesson ordering in AI generator: join sections and order by section position then lesson position
- [x] Make topic optional in AI generator when lessons are selected
- [x] Add requirePassingToProgress, randomizeQuestions, randomizeAnswers toggles to quiz settings
- [x] Add new columns to lms_quizzes table (requirePassingToProgress, randomizeQuestions, randomizeAnswers)
- [x] Create question_bank, question_bank_tags, question_bank_tag_map tables
- [x] Create questionBankRouter with full CRUD, tag management, AI generation, import to quiz
- [x] Add Question Bank tab to LMS admin navigation with QuestionBankAdmin component
- [x] Add "From Bank" tab to LessonQuizBlockEditor (QuestionBankPicker component)
- [x] Fix Free Preview link in curriculum list: pass onFreePreviewClick prop to RenderBlock
- [x] Fix banner/CTA button click: add resolveBtnAction helper to handle all behavior types
- [x] Fix related products images: sync coverImageUrl and thumbnailUrl in all update paths
- [x] Add syncAllCourseImages procedure to bulk-sync Thinkific course images
- [x] Add "Sync Images" button to CoursesTab header

## Session: Quiz Block Expansion + Question Bank (2026-05-27)
- [x] Fix deployment build error (useNavigate → useLocation)
- [x] Fix lmsCourseSections → lmsSections in AI landing page generation
- [x] Add DB indexes on all high-traffic LMS columns for performance
- [x] Remove lesson type selector (all lessons are now text type)
- [x] Remove Quiz Builder tab from lesson editor header
- [x] Fix lesson ordering in AI generator (section pos → lesson pos)
- [x] Make AI generator topic optional when lessons are selected
- [x] Add requirePassingToProgress, randomizeQuestions, randomizeAnswers to quiz schema + server
- [x] Add question bank tables (question_bank, question_bank_tags, question_bank_tag_map)
- [x] Build questionBankRouter with full CRUD + tag management + AI generate
- [x] Add Question Bank tab to LMS admin
- [x] Rewrite LessonQuizBlockEditor: Manual / From Bank / AI Generate tabs
- [x] Add media fields (imageUrl, videoUrl) to questions; per-answer imageUrl
- [x] Add shuffleAnswers toggle to quiz settings
- [x] AI Generate tab: source selector (current lesson / entire course / pick specific lessons)
- [x] Expand generateQuizFromLesson server procedure to accept courseId + lessonIds[]
- [x] Pass courseId from LandingPageBuilder → BlockSettings → LessonQuizBlockEditor
- [x] Fix Free Preview link in curriculum list (onFreePreviewClick prop threading)
- [x] Fix banner/CTA button URL navigation (resolveBtnAction helper)
- [x] Fix related products course card images (sync thumbnailUrl with coverImageUrl)
- [x] Add syncAllCourseImages procedure + Sync Images button in Courses tab
- [x] Write vitest tests for question bank and quiz block logic (7 tests passing)

## Session: Continued Fixes (2026-05-27 cont.)
- [x] Pass courseId from LessonBlockEditor → BlockSettings (fixes "Entire Course" / "Pick Lessons" disabled in quiz AI generate from lesson editor)
- [x] Fix lmsPricingTiers → lmsPricingOptions (correct table + field names) in aiGenerateLandingPage procedure
- [ ] Enforce quiz gate in CoursePlayer: lock Next Lesson until passing score when requirePassingToProgress is true
- [ ] Update BlockPreview and CoursePlayer quiz renderer: display question/answer media (images/video), respect shuffleQuestions/shuffleAnswers flags
- [ ] Auto-save questions to question bank when added manually or AI-generated in LessonQuizBlockEditor

## Session: Quiz AI Generate + Landing Page Fixes (2026-05-27)

- [x] Fix AI landing page generator (lmsRouter, downloadsRouter, productsRouter) — use correct block types and proper data structure with normalization
- [x] Fix course card images in "You Might Also Like" — use coverImageUrl instead of thumbnailUrl in getProductsByIds
- [x] Fix quiz AI generate in QuizBuilderDialog — add course/lesson selector so user can generate from specific lessons
- [x] Pass courseId to BlockSettings in CourseOverviewEditor (LMSAdmin) to enable course/lesson selectors

## SCORM Fix (2026-05-27)

- [ ] Fix SCORM embed player — extract ZIP from S3, serve index.html, inject SCORM 1.2/2004 API shim
- [ ] Ensure SCORM packages render correctly in /media/:slug/embed route
- [ ] Handle SCORM progress tracking (LMSSetValue/GetValue) and save completion to DB

## Session: AI Landing Page + SCORM Type Fix (2026-05-27)

- [ ] Fix AI landing page returning "AI returned invalid JSON" error
- [ ] Fix SCORM files being detected as generic ZIP instead of SCORM media type
- [ ] Fix TypeScript errors in funnelRouter.ts and lmsRouter.ts

- [ ] Add SCORM question import to question bank (parse iSpring/Articulate SCORM quiz XML and import questions)
- [ ] Allow renaming/editing title of media repository files

## Session: SCORM Cache + Image Path Fix (2026-05-27)

- [x] Fix SCORM cache not invalidating on re-upload — use URL-hash-based cache key so new uploads always extract fresh
- [x] Fix SCORM image path resolution — add iSpring data/ prefix fallback + recursive filename search
- [x] Fix SCORM media type auto-detection on upload and re-upload (inspect ZIP for imsmanifest.xml)
- [x] Add media file rename/title editing in Media Repository (inline title editor in asset detail dialog)
- [x] Fix AI landing page invalid JSON — extractJson utility strips markdown code fences before JSON.parse
- [x] Fix TypeScript root errors (lmsThinkificImports.lmsCourseId, funnelRouter db null, productsRouter label)
- [x] Add course/lesson selector to QuizBuilderDialog AI Generate panel

## Session: Drag-to-Reorder Downloads + AI Landing Page Fix (2026-05-27)
- [x] Fix AI landing page stale data: refreshKey from ?t= param, lpUtils cache invalidation, staleTime:0
- [x] Remove debug console.log from aiGenerateLandingPage in lmsRouter.ts
- [x] Add lessonTitle prop to LessonBlockEditor (shows lesson name in header)
- [x] Add library_order column to digital_products table (DB migrated)
- [x] Add reorder procedure to downloadsAdminRouter (sorts by libraryOrder ASC, createdAt DESC)
- [x] Update public downloads list to sort by libraryOrder then createdAt
- [x] Add SortableProductRow component and drag-to-reorder UI to DigitalDownloadsAdmin ProductList

## Education Library Improvements (May 27 2026)
- [x] Education Library page title tag: document.title = "Education Library | All About Ultrasound™"
- [x] CourseLanding already had breadcrumb + title tag (verified)
- [x] DownloadLanding: added breadcrumb (Education Library › Product Name) to both blocks-based and fallback layouts, plus document.title
- [x] Collection hero image upload: added uploadCollectionImage procedure in lmsAdmin router, image upload UI in CollectionFormDialog, hero image display in CollectionDetail (with dark overlay for readability)

## Community Feature Launch (May 2026)
- [x] Register Community routes in App.tsx (CommunityPage, CommunityChannelPage, MemberProfilePage, etc.)
- [x] Add Community Admin link to LMSLayout admin dropdown
- [x] Update Layout.tsx Community sidebar link to point to learn.allaboutultrasound.com/community
- [x] Add Community nav link to MembersLayout top nav (desktop + mobile)
- [x] Add Community Profile section to Member Hub Profile tab (XP, level, badges, link to public profile)
- [x] Add credentials and yearsExperience fields to Member Hub Profile form

## CoursePlayer Fixes (2026-05-27)
- [x] Fix Next button showing lbl.lesson instead of lbl.nextLesson (custom text labels)
- [x] Convert all Notes panel amber/orange hardcoded colors to dynamic primaryColor theme
- [x] Add Save, Save & Close, and Close buttons to LessonEditorPage header (always visible)
- [x] LessonBlockEditor: expose save() via forwardRef/useImperativeHandle

## Access Token & Email Fixes (2026-05-27)
- [x] Remove iHeartEcho logo from dual-brand (combined) email headers — keep only AAUS logo
- [x] Add persistent access_token column to users table (never-expiring, reusable)
- [x] Add access_token_uses table for IP abuse detection
- [x] Add ip_security_flags table for flagged accounts
- [x] Add getOrCreateAccessToken() helper in db.ts
- [x] Build POST /api/auth/access-verify endpoint with IP abuse detection (>3 IPs/24h revokes token + flags)
- [x] Create AccessLinkCallback frontend page (/auth/access?token=...)
- [x] Register /auth/access route in all sub-routers (main, members, LMS, iHeartEcho, accreditation)
- [x] Update enrollmentEmail.ts: embed access tokens in course, download, bundle, quiz emails
- [x] Update lmsRouter.ts: pass accessToken to enrollment emails
- [x] Update downloadsRouter.ts: pass accessToken to download/bundle access emails
- [x] Update sonoQuizRouter.ts: pass accessToken to quiz invite emails
- [x] Update stripe.ts: embed access token in welcome email for new accounts created via purchase
- [x] Apply DB migration: access_token column, access_token_uses table, ip_security_flags table
- [ ] Generate persistent access token for support@allaboutultrasound.com (DB connection issue — retry after checkpoint)

## Download Block Fix (2026-05-27)
- [x] Fix download block "No file selected" when media repo file attached: use slug-based /api/media/:slug/download URL instead of raw S3 URL
- [x] BlockPreview: fall back to slug-based URL for existing blocks with mediaAssetSlug but empty/stale mediaAssetUrl
- [x] LandingPageBuilder selectMediaAsset: store mediaAssetSlug and set mediaAssetUrl to slug-based serve endpoint

## Analytics & Sales Management (2026-05-27)
- [x] Fix analytics sales dashboard to show funnel/product purchases in real time
- [x] Add Sales/Enrollment tab to: Courses (existing LMSSalesTab), Downloads, Bundles (new ProductSalesTab), Memberships (new MembershipAdmin page)
- [x] Sales tab: user list with name/email/date/amount, access toggle, refund button
- [x] Funnel page SEO/preview settings: title, description, og:image — panel in right sidebar (FunnelPageEditor)
- [x] Landing page SEO/preview settings: title, description, og:image — panel in right sidebar (LandingPageBuilder)

## Analytics & Sales Tabs (2026-05-27)
- [x] Fix analytics sales dashboard — UNION query across funnel_purchases, lms_orders, digital_purchases, digital_bundle_purchases, membership_subscriptions
- [x] Build shared ProductSalesTab component (buyer list, access toggle, refund)
- [x] Wire SalesEnrollmentTab into Courses editor (existing LMSSalesTab)
- [x] Wire ProductSalesTab into Downloads editor (DigitalDownloadsAdmin)
- [x] Wire ProductSalesTab into Bundles editor (BundlesAdmin)
- [x] Quizzes editor: already covered by LMSSalesTab in LMSAdmin
- [x] Memberships: new MembershipAdmin page at /admin/memberships with grant/revoke + member list

## Media Fixes (2026-05-27)
- [x] Fix SCORM media not displaying — require("crypto") replaced with ESM createHash import in mediaServe.ts
- [x] Fix large file upload (>50 MB) — added storagePutLarge using R2 multipart upload, bypasses storage proxy limit

## LMS Communities Management (2026-05-27)
- [ ] Add Communities tab to LMS Management panel (LMSAdmin)
- [ ] Wire existing community create/edit/delete/member management into LMS admin
- [ ] Community list with member count, status, edit/delete actions
- [ ] Create/edit community dialog with name, description, brand, access settings
- [ ] Member management per community (add/remove members)

## Media Upload Chunk Fix (2026-05-27)
- [x] Diagnose media upload failures for large files (SCORM ZIP)
- [x] Fix chunk upload pipeline: replaced in-memory chunkStore with disk-based /tmp/media-chunks/{uploadId}/ storage — survives tsx watch server restarts
- [x] Fix MIME type resolution: browsers report .zip as application/octet-stream — now resolved from file extension
- [x] Fix media type detection: .zip extension correctly detected as "zip" type regardless of MIME
- [x] Add vitest tests for disk-based chunk storage, MIME resolution, and media type detection (17 tests passing)

## Media Upload Permanent Fix (2026-05-27)
- [x] Replaced disk-based chunk storage with R2 multipart upload + DB-tracked session state
- [x] /init now calls CreateMultipartUpload on R2 and stores session in media_upload_sessions DB table
- [x] /chunk now calls UploadPart on R2 directly — no disk/memory storage needed
- [x] Final chunk calls CompleteMultipartUpload on R2, then writes mediaAssets/mediaVersions rows
- [x] Session state survives sandbox resets, server restarts, and tsx watch reloads
- [x] 26 vitest tests passing

## Media Upload HTTP 500 Fix (2026-05-27)
- [x] Added `strategy` column to `media_upload_sessions` DB table (VARCHAR(20) NOT NULL DEFAULT 'direct')
- [x] Added `strategy` field to Drizzle schema (mediaUploadSessions table)
- [x] Fixed /init handler INSERT to include `strategy: finalStrategy` — removed workaround UPDATE
- [x] Fixed /chunk handler to read strategy from `session.strategy` DB column instead of parsing completedParts JSON
- [x] completedParts now stores plain JSON array (not wrapped object) for direct path; multipart path stores {parts:[]} object
- [x] All 26 vitest tests passing
- [x] Fix media upload HTTP 500 - r2_upload_id varchar(256) too short for R2 multipart upload IDs (changed to TEXT)

## Community Hub Completion (2026-05-27)
- [x] Built full CommunitiesTab in LMS Admin (replacing Coming Soon placeholder)
- [x] CommunitiesTab sub-tabs: Communities, Channels, Moderation, Announcements, Badges
- [x] Added listChannels admin procedure to communityAdminRouter
- [x] Added listBadges, createBadge, grantBadge admin procedures to communityAdminRouter
- [x] Extracted CommunityFormInline and ChannelFormInline as top-level components (React hooks rules fix)
- [x] Updated sidebar nav to point to internal /community route (not external Thinkific)
- [x] Added CommunityHub import and /community route in App.tsx
- [x] Added /community/:slug route for CommunityFeed (slug param matching)

## SCORM Embed Display Fix (May 2026)
- [x] Fix SCORM embed 500 error - replaced in-memory AdmZip with streaming unzipper to avoid OOM on large ZIPs (152MB+)
- [x] Stream download to disk (downloadToFile) instead of buffering entire ZIP in memory (downloadToBuffer)
- [x] Use unzipper npm package for streaming extraction (10-20MB RAM vs 400MB+ with AdmZip)
- [x] Improved frontend chunk upload error messages (show HTTP status + response text)
- [x] Added retry logic (3 attempts with backoff) to chunk uploads
- [x] Reduced chunk size from 10MB to 5MB to avoid proxy limits
- [x] Fix SCORM images not displaying - extract at upload time and serve from R2 instead of on-the-fly extraction (152MB too large for Cloud Run cold start)
- [x] Created scormExtractor.ts - downloads ZIP, extracts, uploads all files to R2, updates DB with prefix/launch path
- [x] Added scormExtractedPrefix and scormLaunchFile columns to mediaVersions table
- [x] SCORM serve endpoint now redirects to R2 CDN URLs (302) when pre-extracted
- [x] Added admin endpoint POST /api/upload-media-repo/extract-scorm for manual re-extraction
- [x] Ran extraction for existing FETAL ECHO quiz (180 files uploaded to R2)
- [x] URL-encode path segments in redirect to handle spaces in filenames

## Bugs & Redesign (May 27, 2026)
- [ ] Fix Education Library SPI filter showing non-SPI content (eBook showing when only 2 SPI items exist)
- [ ] Fix User Analytics Users tab returning "No users found" when searching
- [ ] Remove standalone Membership Management page (/admin/memberships) — was never requested
- [ ] Build central Member Management on member domain with 3 tabs: LMS, UltrasoundAssist, EchoAssist
- [ ] Member Management: show all user analytics, sales, enrollments, purchases per tab
- [ ] Member Management: drill-down to user profile with subscription/profile management
- [ ] Member Management: exclude demo/system test users from listings

## Member Management & Activity Logging (May 2026)
- [x] Fix Education Library SPI filter bug (key collision between digital_product id=1 and lms_course id=1; fixed by using _source prefix in React keys)
- [x] Fix User Analytics Users tab showing "No users found" (column name was created_at instead of createdAt; now returns all 14,268 users)
- [x] User activity logging DB schema (user_activity_logs table with event_type, description, path, ip_address, user_agent, metadata JSON)
- [x] Activity tracking middleware/endpoints (page views, video plays/completes, quiz attempts, downloads, logins all log to unified table with IP)
- [x] User profile drill-down with full activity log tab (paginated, filterable by event type)
- [x] CSV export for user activity logs (exports from unified table + historical page views + logins)
- [x] Added _source field to getCollection and listCourses results for unique identification
- [x] IP address tracking added to page view events
- [x] Activity log tab added to UserDetailView in User Analytics (7 tabs total now)
- [ ] Build Member Management central area with 3 tabs (LMS, UltrasoundAssist, EchoAssist)
- [ ] Exclude demo/system test users from Member Management
- [ ] Keep LMS data separate from App data in tabs

## Unified Members Hub (May 2026)
- [x] Audit all scattered user/enrollment/sales pages (Contacts, User Analytics, Sales Dashboard, Memberships, LMS People sidebar)
- [x] Build unified /admin/members page with 5 tabs: Members, Enrollments, Sales, Memberships, Activity
- [x] Members tab: full user list with search/filter, stats (logins, enrollments, purchases), drill-down to profile with Activity Log tab
- [x] User profile: overview, enrollments, purchases, activity log, membership status — all in one view
- [x] Enrollments tab: all LMS enrollments across all courses with search/filter/progress + CSV export
- [x] Sales tab: embeds AdminSalesDashboard (revenue, transactions, refunds)
- [x] Memberships tab: embeds MembershipAdmin (grant/revoke premium access)
- [x] Activity tab: unified activity log across all users with event type filter + CSV export
- [x] Replace Contacts, User Analytics, Sales Dashboard, Memberships cards in admin hub with single Members card
- [x] Add Members Hub ↗ link to LMS sidebar People section
- [x] Redirect old routes to Members Hub (/admin/contacts → ?tab=contacts, /admin/user-analytics → ?tab=members, /admin/sales-dashboard → ?tab=sales, /admin/memberships → ?tab=memberships)
- [x] Update User Search quick-access in Platform Admin to point to Members Hub
- [x] 16 tests passing for Members Hub backend procedures

<<<<<<< Updated upstream
## Contacts & Conversion Funnel Tracker (May 2026)
- [ ] Audit contacts/leads schema (funnelContacts table structure, existing fields)
- [ ] Separate Contacts from Members in admin hub (Contacts = leads, Members = registered users)
- [ ] Restore Contacts as its own admin section (not merged into Members Hub)
- [ ] Build conversion matching: match contacts to users by email (contact → registered user)
- [ ] Build purchaser detection: match users to stripe orders/downloads (user → purchaser)
- [ ] Conversion funnel dashboard: Lead count → Registered User count → Purchaser count with % rates
- [ ] Contact list with per-contact conversion status badge (Lead / Registered / Purchaser)
- [ ] Funnel source breakdown: which funnels generate the most conversions
- [ ] Time-to-convert metrics: avg days from lead capture to registration, registration to purchase
- [ ] CSV export of contacts with conversion status
- [ ] Add conversion tracker link to Platform Admin hub
=======
## Members Hub Bug Fixes (May 2026)
- [ ] Fix Activity tab crash: "Cannot read properties of undefined (reading 'replace')"
- [ ] Fix Enrollments tab showing 0 enrollments (1138 exist in DB)
- [ ] Fix Members/Users tab showing 0 users with blank names/emails
- [ ] Fix Sales tab showing $0 revenue and loading spinner forever
- [ ] Fix scrollbars disappearing on Members Hub pages
- [ ] Fix Members Hub subtitle still says "contacts" (Contacts moved to Funnel Management)
- [ ] Fix double header: Members Hub shows both its own header AND embedded UserAnalytics header

## SCORM Image Fix (May 2026)
- [x] Audit all 48 SCORM/ZIP files — found 47 had never been extracted to R2 (scormExtractedPrefix = null)
- [x] Root cause: extraction only triggered on new uploads, never ran for existing files; on-the-fly /tmp extraction is ephemeral and lost on server restart
- [x] Fix: bulk re-extract all 47 files to R2 — 33 succeeded, 5 corrupted (invalid ZIP signature from old CDN path)
- [x] Fix: extend upload trigger to also extract zip mediaType (not just scorm)
- [x] 5 files with corrupted ZIPs need re-upload: advanced-cardiac-sonographer-sample-quiz, advanced-cardiac-sonographer-unlimited-q-k3tgg0, pediatric-echo-flashcards-wyo4on, pediatric-echocardiography-test-learn-qu, acs-flashcards-kt66kl (old versions)

## MembersHub Bug Fixes (May 2026)
- [x] Fix Activity tab crash — null-safe eventType.replace() call
- [x] Fix Enrollments showing 0 — change INNER JOIN to LEFT JOIN for users without app accounts
- [x] Fix zip mediaType extraction trigger on upload
- [x] Fix duplicate /admin/contacts and /admin/user-analytics routes in App.tsx
- [x] Remove stale User Analytics and Contacts cards from Platform Admin dashboard
>>>>>>> Stashed changes

## Enrollments Tab Upgrade (May 2026)
- [x] Add content type filter (course / download / product / quiz) to enrollmentsList procedure
- [x] Add sort options (date, user name, course name, status, progress) to enrollmentsList procedure
- [x] Add user drill-down: click a row to see full enrollment detail for that user
- [x] Rebuild Enrollments tab UI with filter bar, sortable column headers, and drill-down panel

## Enrollments Tab — Phase 2 (May 2026)
- [ ] Add courseList procedure to return all courses for the filter dropdown
- [ ] Extend enrollmentsList with courseId filter param
- [ ] Add enrollment source column (thinkific_import / purchase / admin_grant / manual)
- [ ] Add bulkGrantEnrollment procedure (admin grants access to selected users for a course)
- [ ] Add bulkRevokeEnrollment procedure (admin revokes access for selected users)
- [ ] Update Enrollments tab UI: course dropdown, source badge column, row checkboxes, bulk action toolbar

## MembersHub Data Fixes (May 2026)
- [x] Fix enrollmentsList: use lms_thinkific_imports as bridge (enrollment.course_id = ti.lms_course_id, not lms_courses.id directly)
- [x] Fix exportEnrollmentsCsv: same JOIN fix, remove GROUP BY
- [x] Fix userEnrollmentDetail: same JOIN fix
- [x] Fix courseListForFilter: count enrollments via thinkific_imports bridge
- [x] Fix userList: sort by u.lastSignedIn DESC (not alias), use actual login_events count
- [x] Fix globalActivityLog: UNION with page_view_events and login_events for complete activity picture
- [x] Fix Activity tab crash: null-safe eventType in UserAnalytics and globalActivityLog server return

## LMS Content Management (May 2026)
- [x] Fix SCORM R2 proxy — stream files through app server instead of redirecting to private R2
- [x] Add courseType recategorization in LMS course settings (course ↔ quiz)
- [x] Add sortOrder column to lms_courses table (libraryOrder already existed in schema)
- [x] Add drag-and-drop reorder in LMS admin course list (Reorder button + DnD mode)
- [x] Education Library respects sortOrder for display (orderBy libraryOrder ASC in lms.listCourses)

## Cohort Course Type (May 2026)
- [x] Add 'cohort' to lmsCourses.type enum in schema (DB migration)
- [x] Add enrollmentCloseDate column to lmsCourses table (DB migration)
- [x] Create lmsCohortSessions table (courseId, title, description, sessionDate, durationMinutes, meetingUrl, recordingUrl, status)
- [x] Create lmsCohortAssignments table (courseId, title, description, dueDate, maxPoints, submissionType)
- [x] Add cohort tRPC procedures: listCohortSessions, createCohortSession, updateCohortSession, deleteCohortSession
- [x] Add cohort tRPC procedures: listCohortAssignments, createCohortAssignment, updateCohortAssignment, deleteCohortAssignment
- [x] Update listCourses (admin + public) to accept 'cohort' type filter
- [x] Update updateCourse to accept enrollmentCloseDate
- [x] Update createCourse to accept 'cohort' type
- [x] Add CohortTab UI component in LMSAdmin.tsx (Sessions + Assignments sub-tabs)
- [x] Wire CohortTab into course editor tabs (show only when type === 'cohort')
- [x] Add 'Cohorts' sidebar entry in LMS admin nav
- [x] Add cohort to TYPE_ICONS, CoursesTab typeFilter, and CreateCourseDialog
- [x] Add Content Type dropdown option for 'cohort' in CourseSettingsForm
- [x] Add enrollmentCloseDate date picker in CourseSettingsForm (cohort only)

## Price Field Fixes (May 2026)
- [x] Fix order bump triggerType/bumpType enum: add quiz and cohort
- [x] Migrate all price columns from INT cents to DECIMAL(10,2) dollars in DB
- [x] Fix server routers: remove all /100 and *100 price conversions, fix Stripe unit_amount boundaries
- [x] Fix admin UI: remove all /100 and *100 price conversions (LMSAdmin, BundlesAdmin, DigitalDownloadsAdmin, PhysicalProductsAdmin, OrderBumpsAdmin, LandingPageBuilder, AdminSalesDashboard, AdminSalesPage)
- [x] Fix public pages: remove all /100 price display conversions (CourseLanding, DownloadLanding, DownloadsBrowse, EducationLibrary, LMSHome, ProductLanding, BundleLanding, CollectionDetail)
- [x] Fix AdminDiscountCodesPage: fmtDollars for Stripe amount_off (already in cents from Stripe, kept /100 conversion)

## Rich Text Media Styling (May 2026)
- [x] Add border controls (style, width, color) for images/videos in rich text editor
- [x] Add shadow controls for images/videos in rich text editor
- [x] Add corner rounding controls for images/videos in rich text editor
- [x] Add text wrap/float controls (left, right, none) for images/videos in rich text editor
- [x] Add margin controls for images/videos in rich text editor

## Duplicate/Copy Behavior Fix (May 2026)
- [x] Course/quiz/cohort duplicate: do NOT copy lms_enrollments, lms_progress, lms_orders (already correct — only copies metadata/content)
- [x] Download duplicate: do NOT copy download access/purchase records (already correct)
- [x] Bundle duplicate: do NOT copy bundle purchase/access records (already correct)
- [x] Physical product duplicate: do NOT copy physical_product_orders (already correct — only copies pricing options)

## Rich Text Table Editing (May 2026)
- [x] Install @tiptap/extension-table and related table extensions
- [x] Add table toolbar button to RichTextEditor (Insert Table with row/col picker)
- [x] Support copy/paste of tables from Word, spreadsheets, and web pages (TipTap handles natively)
- [x] Add row/column insert and delete controls (dropdown menu in toolbar)
- [x] Add cell background shading color picker
- [x] Add merge/split cell controls
- [x] Add toggle header row/column
- [x] Render tables properly in read-only/preview mode (RichTextDisplay with table CSS classes)

## Standalone Table Content Block (May 2026)
- [ ] Add 'table' block type to the lesson/page content block schema
- [ ] Add TableBlock component: full table editor with add/remove rows and columns, cell shading, borders
- [ ] Add 'Insert Table' button to the content block picker (alongside Text, Image, Video, etc.)
- [ ] Render TableBlock in read-only mode in CoursePlayer and funnel page preview
- [ ] Support copy/paste of external tables into the TableBlock editor

## Cohort Student Page (May 2026)
- [x] Create /cohort/:courseId student-facing page showing sessions and assignments
- [x] Show upcoming live sessions with date/time, meeting link, recording link
- [x] Show assignments with due dates and submission type
- [x] Show enrollment close date / enrollment status
- [x] Gate page to enrolled users only (redirect to course landing if not enrolled)
- [x] Add route in App.tsx for /cohort/:courseId

## Standalone Table Content Block (May 2026)
- [ ] Add 'table' block type to lesson/page content block schema
- [ ] Build TableBlock component with add/remove rows and columns, cell text editing
- [ ] Add cell background color picker per cell
- [ ] Add border style toggle (bordered/borderless/header-only)
- [ ] Add 'Insert Table' button to content block picker
- [ ] Render TableBlock in read-only mode in CoursePlayer and funnel page preview
- [ ] Support copy/paste of external tables into the TableBlock editor

## Enrollment Close Date Enforcement (May 2026)
- [x] Server: check enrollmentCloseDate in createCheckoutSession — reject if past
- [x] Server: check enrollmentCloseDate in embeddedCheckoutRouter — reject if past
- [ ] Server: check enrollmentCloseDate in funnelRouter checkout — reject if past
- [x] Client: CourseLanding shows "Enrollment Closed" badge when past enrollmentCloseDate
- [x] Client: CourseLanding disables/hides all purchase buttons when enrollment is closed

## Build Fix & New Features (May 2026)
- [x] Fix deployment build error: wrong useAuth import path in CohortSchedule.tsx (@/hooks/useAuth → @/_core/hooks/useAuth)
- [x] CourseLanding: enrollment countdown banner (shows "Enrollment closes in N days" for cohorts within 30 days of close)
- [x] Data Table block: add 'data_table' BlockType, DataTableBlockPreview component, BLOCK_CATALOG entry in Content category
- [x] Data Table block: BlockSettings editor (add/remove rows/columns, cell editing, style controls)
- [x] Cohort admin notifications: send email to enrolled students when session/assignment is published (with send toggle)

## Assignment Submissions & Data Table Paste (May 2026)
- [ ] DB: lms_cohort_submissions table (id, assignmentId, userId, submissionType, textContent, fileUrl, fileKey, urlContent, status, submittedAt, updatedAt)
- [ ] Server: createSubmission, getMySubmission, updateSubmission, listSubmissions (admin) procedures
- [ ] Client: CohortSchedule assignments tab — show submission form per assignment (text/file/url based on submissionType)
- [ ] Client: CohortSchedule — show submission status badge (Not submitted / Submitted / Graded)
- [ ] Client: Data Table block editor — "Paste from spreadsheet" button that parses TSV clipboard content into table rows
- [x] DB: add recurrence columns to lms_cohort_sessions (recurrenceRule, recurrenceInterval, recurrenceEndDate, parentSessionId)
- [ ] Server: expandRecurringSessions procedure — generates child session rows from a parent recurring session
- [ ] Admin UI: Add Session dialog — recurrence toggle with frequency (weekly/biweekly/monthly), interval, end date, and "Expand to instances" button
- [ ] Admin UI: sessions list — show recurrence badge on recurring sessions; child sessions show parent link
- [ ] Student UI: CohortSchedule — recurring sessions grouped/labeled naturally (Week 1, Week 2, etc.)
- [x] DB: add timezone column to lms_cohort_sessions (IANA timezone string, e.g. "America/New_York")
- [ ] Admin UI: timezone picker in Add/Edit Session dialog (searchable IANA timezone list)
- [ ] Student UI: CohortSchedule — display session times in the session's timezone with user's local time in parentheses
- [x] DB: lms_cohort_recordings table (id, courseId, sessionId nullable, title, description, videoUrl, thumbnailUrl, durationSeconds, publishedAt, status, position)
- [ ] Server: createRecording, updateRecording, deleteRecording, listRecordings (admin); getRecordingsForCohort (learner)
- [ ] Admin UI: Recordings tab in cohort admin panel — upload video to S3, set title/description/thumbnail, link to session
- [ ] Student UI: Replays tab on /cohort/:id — grid of recordings with video player modal

## Assignment Page Builder (May 2026)
- [ ] DB: add contentBlocks JSON column to lms_cohort_assignments
- [ ] DB: add fileUrl, fileKey, grade, feedback, gradedAt, gradedBy to lms_cohort_submissions
- [ ] Server: update createCohortAssignment/updateCohortAssignment to accept contentBlocks
- [ ] Server: add getAssignmentDetail procedure (public blocks + submission for current user)
- [ ] Server: add gradeSubmission procedure (admin only)
- [ ] Admin UI: replace description textarea with full LessonBlockEditor in assignment dialog
- [ ] Admin UI: settings panel for due date, points, submission type alongside block editor
- [ ] Student UI: AssignmentDetail page /cohort/:courseId/assignment/:assignmentId
- [ ] Student UI: block content renderer (same as lesson player)
- [ ] Student UI: submission form (text/file/URL) with file upload to S3
- [ ] Student UI: submission status badge (pending/submitted/graded) + grade display
- [ ] Route: /cohort/:courseId/assignment/:assignmentId in App.tsx
- [ ] AssignmentCard in CohortSchedule links to detail page
- [ ] Admin: submissions list view per assignment with grade input
- [ ] CohortSchedule: add Replays tab for recordings
- [ ] Data Table block: paste from clipboard (spreadsheet)

## File Upload Content Block (May 2026)
- [ ] DB: media_upload_responses table (id, userId, blockId, pageId, pageType, fileUrl, fileKey, fileName, mimeType, folderId, createdAt)
- [ ] DB: media_upload_folders table (id, name, description, createdBy, createdAt)
- [ ] Server: uploadToMediaFolder procedure (creates folder if needed, stores response)
- [ ] Server: listMediaUploadResponses procedure (admin: list by folder/page/user)
- [ ] BlockType: add file_upload to union in BlockPreview.tsx
- [ ] Block settings: label, instructions, accepted file types, max size, folder name (for non-assignment use)
- [ ] BlockPreview: file_upload block preview in page builder
- [ ] FileUploadBlock component: context-aware (assignment vs page), S3 upload, progress bar
- [ ] In assignment context: stores to lms_cohort_submissions.file_url
- [ ] In page context: stores to media_upload_responses with folder
- [ ] Admin: media upload responses viewer (by folder, by page, by user)

## Page Builder Improvements (May 28, 2026)
- [x] FAQ block: collapsible items in settings panel (caret toggle, collapsed by default)
- [x] FAQ block: new questions prepend to top of list instead of appending to bottom
- [x] Sticky enrollment countdown banner: stays fixed at top of CourseLanding on scroll
- [x] Countdown V2 block: fix border not showing on live page (wrong prop name d→data in CourseLanding)
- [x] Countdown V2 block: expose subtext, showBorder, borderColor, text color, accent color in settings panel
- [x] Pricing cards block: upgrade tier CTA buttons to full CTAActionPicker (all behaviors: direct_checkout, url, scroll, popup, email, download)
- [x] Pricing cards block: CourseLanding renders pricing_cards with handleCtaBtnClick delegation (onEnroll support)
- [x] CTA actions: pricing option linking available in CTA blocks

<<<<<<< Updated upstream
## May 2026 Updates

- [x] Pricing option drag-and-drop reordering in CoursePricingOptionsEditor (LMSAdmin)
- [x] Fix CTAActionPicker to use lmsGroup.listPricingOptions (was incorrectly using lmsAdmin)
- [x] Add copy-link button to each pricing option row showing direct checkout URL (even for draft courses)
- [x] Fix FreePreviewEnrollmentsTab to use lmsAdmin.listCourses (includes draft courses)
- [x] Cohort calendar view (Month/Week/Day/List) with ICS download and Add to Google Calendar
- [x] Gate Join Live Session button to only be active 15 minutes before session start
- [x] Add resizable panel to LessonBlockEditor (drag handle to resize settings panel)
- [x] Fix pricing option checkout: read pricingOptionId from URL params and pass to autoCheckout flow
- [x] Fix pricing_cards block tierDataAttrs to include data-pricing-option attribute for pricing_option behavior
- [x] Add cohort_sessions_auto block type to BlockPreview, LandingPageBuilder, and CourseLanding
- [x] Add cohortSessions to getCourse public procedure in lmsRouter
- [x] Upgrade Order Bump editor: add presentation mode toggle (Widget vs Landing Page)
- [x] Order Bump Landing Page mode: full block editor with drag-and-drop, per-block settings, and live preview
- [x] Add pageBlocks, presentationMode, slug to orderBumpsAdmin create/update procedures
- [ ] Fix downloads not showing in Education Library (debug brand filter / query issue)
- [ ] Add analytics, student management, and access management to Downloads admin (matching Courses)
- [ ] Add cohort as selectable type in all CTA pickers across the app
- [ ] Add image upload support to Order Bumps editor
- [ ] Fix purchase access link resend for students who didn't receive it
- [ ] Add user search to enrollments tab in course admin
- [x] Fix heroClickHandler missing pricing_option and direct_checkout cases in CourseLanding (hero whole-clickable mode)
- [x] Fix CTA login redirect — add returnTo param so users land at checkout after signing in (magic link + MagicLinkCallback + CourseLanding)
- [ ] Guest checkout: guestCheckoutRegister procedure (create/find account, sign in, save lead, return checkout URL)
- [ ] Guest checkout: GuestCheckoutModal in CourseLanding (name+email form, no login redirect)
- [x] Guest checkout modal: name+email form for unauthenticated CTA clicks (no login redirect)
- [x] guestCheckoutRegister procedure: create/find account, auto sign-in via session cookie, save lead, return Stripe checkout URL
- [x] Auth state invalidated after guest checkout so useAuth() reflects new session immediately

## Password Auth System (May 2026)
- [x] Add password_hash column to users table (bcrypt)
- [x] Server: auth.setPassword, auth.loginWithPassword, auth.changePassword procedures
- [x] Server: auth.requestPasswordReset and auth.resetPassword procedures (email token)
- [x] Login page: toggle between magic link and password sign-in modes
- [x] Login page: password registration form (set password on first use)
- [x] Login page: forgot password flow
- [x] Reset password page (/reset-password?token=...)
=======
## Code Architecture (May 29, 2026)
- [x] Split lmsRouter.ts (6011 lines) into focused sub-routers to fix TypeScript OOM
  - [x] lmsHelpers.ts — shared imports + helper functions (244 lines)
  - [x] lmsCourseBuilderRouter.ts — course/section/lesson CRUD (1050 lines)
  - [x] lmsQuizLandingRouter.ts — quiz builder + landing pages (702 lines)
  - [x] lmsEnrollmentAdminRouter.ts — enrollments, groups, analytics, orders (1774 lines)
  - [x] lmsCohortAdminRouter.ts — cohort sessions, assignments, recordings (597 lines)
  - [x] lmsRouter.ts — thin aggregator with merged lmsAdminRouter (2076 lines)
>>>>>>> Stashed changes

- [x] Form editor domain override — wire PublishDomainSelect into GeneralFormBuilder settings panel (hostDomain) replacing hardcoded CUSTOM_DOMAINS list
- [x] Funnel URL preview update — FunnelSettingsPanel now calls refetch() on save so the info bar external link reflects the new customDomain immediately
- [x] Funnel settings panel — updateFunnelSettings procedure now accepts customDomain alongside slug/SEO in a single save action

- [ ] Fix: published lesson content (multimedia embed) not showing in student course player view
- [ ] Fix: DIY Accreditation and DIY Forms cards not showing in iHeartEcho brand tools
- [ ] Community: allow image upload for community icon (instead of letter avatar)
- [ ] Community: full page editor for community look (header, side navs, branding)
- [ ] Community: admin can add members individually and in bulk
- [ ] Community: admin can sort and remove members
- [ ] Community: all member comments require moderation by default; admins can approve members to post without moderation

- [ ] Calendar view in Course Overview: implement Calendar tab with monthly/list view of live sessions, ICS download (single event + full course), and Add to Google Calendar links for cohort live sessions

- [ ] Fix: recurring cohort session expansion only generates first day of week, not all selected days
- [ ] Add rich text editor for cohort session/event descriptions
- [ ] Community: image upload picker for community avatar/cover (replace URL text field)
- [ ] Community: Members tab in CommunityAdmin (list, add individual, bulk add, sort, remove, set moderation)
- [ ] Community: comment moderation queue in admin (approve/reject pending comments)

- [ ] Enroll dialog: add "Create & Enroll New User" tab (name + email → create account → enroll) for all LMS content types
- [ ] LMS enrollment and new account emails should send from learn.allaboutultrasound.com domain

- [ ] Fix: Form Builder color picker closes after one click (ColorField defined inside render)
- [ ] Fix: Form Builder live preview not updating when theme changes
- [ ] Add: Transparent background type to Form Builder
- [ ] Rename: "General Form Builder" → "Form Builder" throughout UI

## Form Builder Overhaul (May 29, 2026)
- [ ] Fix: ColorField defined inside StyleTab render function — move outside as stable component
- [ ] Fix: Form Builder live preview not updating when theme changes
- [ ] Add: Transparent background type to Form Builder
- [ ] Rename: "General Form Builder" → "Form Builder" throughout UI
- [ ] Add: Style/Branding tab to FormBuilderAdmin (DIY Forms)
- [ ] Add: URL import + "Add fields from URL" to FormBuilderAdmin
- [ ] Add: appendFieldsFromUrl procedure to generalFormRouter
- [ ] Add: Typeform-style display modes to public form renderer
  - [ ] displayMode setting: "classic" (current single-page), "typeform" (welcome + page-by-page), "paginated" (page-by-page no welcome), "inline" (single-page no header)
  - [ ] Add displayMode + welcomeTitle + welcomeButtonText + welcomeImageUrl to generalFormTemplates schema
  - [ ] DB migration for new columns
  - [ ] Update updateForm procedure to accept new fields
  - [ ] Build TypeformRenderer component with animated transitions, progress bar, keyboard nav
  - [ ] Build WelcomeScreen component with full-screen hero, logo, CTA button
  - [ ] Build PageByPageRenderer: one question per screen, Enter key to advance, progress bar
  - [ ] Add Display Mode selector in Settings tab of GeneralFormBuilder
- [ ] Add: custom filters and views to form results (sort, filter by field, date range, column visibility, export filtered)

## Critical Overcharge Bug Fix (May 29, 2026)
- [x] Fix: EmbeddedCheckoutBlock charging 100x the correct amount (e.g. $3700 instead of $37) — server was treating cents input as dollars and multiplying by 100 again
- [x] Fix: Admin price inputs in LandingPageBuilder (embedded_checkout, inline_checkout, checkout_form blocks) now display in dollars and save in cents correctly
- [x] Fix: Catalog item price display in LandingPageBuilder now shows correct dollar amounts

## Form Branching Logic (May 29, 2026)
- [ ] Fix: /forms/:slug routes missing from LMSRouter, MembersRouter, AccreditationDivisionRouter (page not found on learn.allaboutultrasound.com)
- [ ] Schema: extend generalFormBranchRules table with action types: show, hide, skip_to, require, set_value
- [ ] Schema: add grouping support (AND/OR conditions per rule)
- [ ] Server: update getBranchRules, createBranchRule, updateBranchRule, deleteBranchRule procedures
- [ ] Server: update getPublicForm to return full branch rules with new fields
- [ ] UI: Build visual if/when/then rule builder tab in GeneralFormBuilder
  - [ ] Condition builder: IF [question dropdown] [operator dropdown] [value input]
  - [ ] AND/OR grouping for multiple conditions
  - [ ] Action builder: THEN [action: show/hide/skip_to/require/set_value] [target question/page]
  - [ ] Rule list with enable/disable toggle and delete
  - [ ] Drag-to-reorder rules
- [ ] PublicFormRenderer: evaluate branching rules in all display modes (classic, typeform, paginated, inline)
  - [ ] show/hide fields based on rules
  - [ ] skip_to page in page-by-page mode
  - [ ] require field dynamically based on rules
  - [ ] set_value action (pre-fill answer)

## Cohort & Community Backlog (May 29, 2026)
- [x] Fix: recurring cohort session expansion only generates first day of week, not all selected days
- [ ] Community: sort order control for public UI display (drag-to-reorder or sort field in admin)
- [ ] Community: add membership types — Free (open join), Paid (Stripe-gated), Restricted (free but requires admin approval)
- [ ] Community: link community access to course(s)/cohort(s)/product(s) — auto-grant membership when user is enrolled in linked content
- [ ] Community: image upload for community icon (replace URL text field with file upload picker)
- [ ] Community: full-page editor for editable regions on the community public page (header, bio, sidebar, branding)
- [ ] Community: admin quick-links — "Go to Community" and "Post in Community" buttons in community admin panel
- [ ] Community: admin community profiles — admin can create multiple posting identities (e.g. "Support", "Admin", "My Name") and choose which profile to post as

## Unified Member Management System (May 29, 2026) — CRITICAL
- [x] Build unified Members admin page with two tabs: Apps (platform users) and LMS (course users)
- [x] Apps tab: list all platform users with search, filter by role, sort by join date/activity
- [x] LMS tab: list all LMS users with search, deep links to user profiles, courses, content
- [x] User Profile page: shows user info, analytics (purchases, enrollments, activity), transactions, access
- [x] User Profile: deep link back to analytics dashboard
- [x] Transaction Management: view all transactions with search/filter
- [x] Transaction Management: edit transaction details
- [x] Transaction Management: process refund/cancel from within the platform (calls Stripe API)
- [x] Transaction Management: deep link to user profile from each transaction
- [x] Per-course analytics: who purchased, revenue, enrollments, deep links to user profiles
- [x] Per-download analytics: who purchased, revenue, deep links to user profiles
- [x] Per-product analytics: who purchased, revenue, deep links to user profiles
- [x] Per-funnel analytics: who purchased, revenue, conversion rates, deep links to user profiles
- [x] Grant access: ability to grant course/download/product access to new or existing platform users
- [x] Deep links: user profiles ↔ analytics ↔ transactions ↔ courses/products throughout
- [x] Fix: ensure all Stripe transactions are recorded in the platform DB for analytics (webhook now updates pending→paid)

## Member Management Hub Redesign (May 29, 2026)
- [x] Rebuild MembersHub as LearnPro-style full-page dashboard with left sidebar nav
- [ ] Sidebar sections: MEMBERS (Members, Groups, Enrollments, Invitations, Import), ENGAGEMENT (Activity, Communications, Certificates), SETTINGS (Settings, Custom Fields)
- [ ] Overview dashboard: stat cards (Total Members, Active Members, New This Month, Engagement Rate, Completions)
- [ ] Member Growth chart (line chart, last 6 months)
- [ ] Members by Status donut chart (Active, Inactive, Pending, Suspended)
- [ ] Recent Members table with avatar, name, email, group/membership, status, last active, progress bar
- [ ] Quick Actions panel (Add New Member, Invite Members, Import Members, Create Group, Send Announcement)
- [ ] Recent Activity feed (course completions, enrollments, certificates, new members)
- [ ] Full Members list with search, filter by status/role, sort, pagination
- [ ] Deep links from member rows to AdminUserDetailPage

## Community Enhancements (May 29, 2026)
- [ ] Community sort order: admin can drag-reorder communities; public UI respects this order
- [ ] Community types: Free (open join), Paid (requires purchase), Restricted (free but requires admin approval)
- [ ] Restricted communities: admin approval queue for pending join requests
- [ ] Course/product-linked access: link one or multiple courses/cohorts/products to a community; enrolled users auto-get community access
- [ ] Community icon upload: image upload field in community settings
- [ ] Full-page rich text editor for editable regions in the community page
- [ ] Admin links: "View Community" and "Post in Community" buttons in community admin
- [ ] Multi-profile posting: admin can set up multiple community profiles (Support, Admin, Personal) and choose which profile to post as

## Multi-Cohort System (May 29, 2026)
- [ ] Multiple cohorts under one cohort course (e.g., June 2026, January 2027)
- [ ] Each cohort has its own page, content, and student list
- [ ] Admin can edit each cohort page independently
- [ ] Admin sees students per cohort (not just overall course)
- [ ] Single shared landing page/URL for the cohort course
- [ ] Landing page can link to a specific cohort for details/smart options (cohort content block)
- [ ] Cohort members only see their specific cohort page/content

## Member Management Hub v2 (May 2026)
- [x] Add getMemberOverview procedure to adminUserRouter (stats, growth chart, status breakdown, recent members, activity feed)
- [x] Add listMembers procedure to adminUserRouter (search, status filter, pagination)
- [x] Rewrite MembersHub.tsx with LearnPro-style left sidebar navigation
- [x] Overview dashboard: stat cards (Total, Active, New This Month, Completions)
- [x] Member growth line chart (6 months)
- [x] Members-by-status donut chart
- [x] Recent members table with progress bars and deep links
- [x] Recent activity feed (enrollments, completions, certificates)
- [x] Quick actions panel (View All, Import, Bulk Email, Refresh)
- [x] All Members tab with search/filter/pagination
- [x] Collapsible sidebar with tooltip labels
- [x] All existing sub-components (Sales, Product Analytics, Memberships, Contacts, Sharing Monitor) accessible via sidebar nav

## Orders & Enrollment Export (May 2026)
- [ ] Server: deleteOrder procedure (admin only)
- [ ] Server: listPendingOrders procedure (paginated, with user/course details)
- [x] Server: exportEnrollmentsCSV (all enrollments + pending orders, filterable)
- [ ] Server: exportToEmailCampaign (push enrollment list to SendGrid contact list)
- [x] UI: Pending Orders panel in LMSAdmin Analytics with delete button
- [x] UI: Enrollment export panel (CSV download + email campaign export) in Enrollments tab

## Community Enhancements (May 2026)
- [x] Server: updateCommunity extended with sortOrder, accessType=restricted, iconImage, linkedAccessItems
- [x] Server: reorderCommunities procedure
- [x] Server: uploadCommunityIcon procedure
- [x] Server: listAdminProfiles, createAdminProfile, updateAdminProfile, deleteAdminProfile
- [x] Server: join updated to handle restricted (sets memberStatus=pending)
- [x] Server: listPendingMembers, approveMember, rejectMember
- [x] Server: createPost updated to accept adminProfileId (post-as)
- [x] UI: Community sort order drag-and-drop in CommunityAdmin
- [x] UI: Access type selector (free/paid/restricted) with restricted approval queue
- [x] UI: Linked course/product access panel in community settings
- [x] UI: Icon image upload in community form
- [x] UI: Admin Profiles tab (create/edit/delete profiles to post as)
- [x] UI: View Community + Post in Community quick links in admin
- [ ] UI: Full-page editor for community editable regions
- [x] UI: Post-as selector when creating posts (choose admin profile)
- [ ] Public: Restricted community shows "Request to Join" button + pending state

## Multi-Cohort Groups (May 2026)
- [x] Server: listCohortGroups, createCohortGroup, updateCohortGroup, deleteCohortGroup
- [x] Server: setFeaturedCohortGroup (controls landing page link)
- [x] Server: listCohortGroupStudents, assignStudentToCohortGroup, removeStudentFromCohortGroup
- [x] Server: getMyCohortGroup (learner — returns which group they're in)
- [x] UI: Cohort Groups sub-tab in LMSAdmin CohortTab
- [x] UI: Per-group student list and assignment UI
- [x] UI: Featured group selector (landing page link)
- [ ] UI: Per-group page block editor
- [x] Learner: CohortSchedule shows group-specific page content

## Cohort Group Enhancements (May 29 2026)
- [ ] DB: add accessDurationDays (nullable) to lms_groups table (null = indefinite)
- [ ] DB: cohort_messages table (id, groupId, courseId, userId, body, mediaUrls JSON, createdAt)
- [ ] Server: transferStudent procedure (move enrollment from one group to another)
- [ ] Server: getCohortActivity procedure (assignments + lesson progress per student in group)
- [ ] Server: cohort message CRUD (listMessages, postMessage, deleteMessage)
- [ ] Server: upload endpoint for cohort message media (images/videos)
- [ ] Admin UI: Transfer student button on each student row → select target group dialog
- [ ] Admin UI: Student activity panel (assignments + lesson progress per student)
- [ ] Admin UI: Cohort message thread panel in Cohort Groups tab
- [ ] Admin UI: Access duration field in cohort group Settings tab (days from start date or blank = indefinite)
- [ ] Student UI: Cohort message thread visible in course player sidebar

## Cohort Group Enhancements (2026-05-29)
- [x] Transfer student between cohort groups (Transfer button + dialog in Cohort Groups tab)
- [x] Student activity view (assignments + lesson progress per student in Cohort Groups tab)
- [x] Cohort group discussion thread with image/video media upload (Discussion panel per group)
- [x] Access duration setting in group dialog (days from group start, or blank for indefinite)
- [x] Access duration displayed on group card info line
- [x] Cohort sub-tabs reordered: Settings, Cohort Groups, Live Sessions, Assignments, Recordings
- [x] View Education Library link opens in new tab
- [x] Education library card price display reverted to correct dollar display (no /100 division)
- [x] Image block link clicks fixed (pointerEvents: auto, stopPropagation on ImageLinkWrapper)
- [x] lms_cohort_messages table created in DB (id, cohort_group_id, course_id, user_id, body, media_urls, is_admin_post)
- [x] access_duration_days column added to lms_cohort_groups
- [x] /api/upload/cohort-media endpoint created (images + videos, admin only, 100 MB limit)

## Cohort Discussions Tab & Staff Management (2026-05-29)
- [ ] Add lms_cohort_staff table (cohort_group_id, user_id, role: admin/moderator, can_manage_discussions, can_add_sessions, can_add_assignments, can_add_recordings)
- [ ] Add isPinned and deletedAt columns to lms_cohort_messages
- [ ] Backend: getCohortStaff, addCohortStaff, updateCohortStaff, removeCohortStaff procedures
- [ ] Backend: pinCohortMessage, deleteCohortMessage (moderation) procedures
- [ ] Backend: getCohortDiscussions (all groups for a course, admin view) procedure
- [ ] UI: Add Discussions tab after Recordings in cohort sub-tabs
- [ ] UI: Discussions tab shows all groups' threads, admin can post/delete/pin messages
- [ ] UI: Cohort Settings tab — add/remove cohort admins and moderators per group
- [ ] UI: Permission flags per staff member (manage discussions, add sessions, add assignments, add recordings)

## Student Discussions Tab & Recurring Session Fix (2026-05-29)
- [ ] Fix recurring session multi-day bug (only first selected day repeats, others ignored)
- [ ] Add Discussions tab to student My Cohort view (post text/images/videos, see all group messages)
- [ ] Backend: student getCohortDiscussions and postCohortMessage procedures (protected, not admin-only)

## Ultrasound Interests System (2026-05-30)
- [ ] DB: create lms_interests table (id, name, slug, category, brandFilter: aaus|iheartecho|both, sortOrder, isActive)
- [ ] DB: create user_interests join table (userId, interestId)
- [ ] DB: seed default interests (cardiac echo, vascular, OB/GYN, POCUS, fetal echo, physics, ergonomics, MSK, breast, abdominal, small parts, pediatric echo, general ultrasound)
- [ ] Backend: admin CRUD for interests in LMS settings (add/edit/remove/reorder/toggle active)
- [ ] Backend: getInterests procedure (brand-filtered for current brand context)
- [ ] Backend: updateUserInterests procedure (save user's selected interests)
- [ ] Backend: getUserInterests procedure (fetch user's interests)
- [ ] UI: Profile page - interest picker with brand-filtered chips/tags
- [ ] UI: LMS Settings - admin interests management panel
- [ ] UI: Community profile - display user interests as tags
- [ ] Fix profile Display Name edit click-out bug (useEffect guard when in editMode)
- [ ] Add communityRole field to users table (member/moderator/admin)
- [ ] Set larawilliams0501@gmail.com as community admin
- [ ] Add Admin/Moderator badges to community profile and feed posts
- [ ] Make author name/avatar in community feed clickable (link to /community/members/:userId)
- [ ] Add setCommunityRole procedure for platform admins

## Profile Image & Display Name Fixes (2026-05-30)
- [ ] Fix MembersLayout header to use displayName (fallback name) and avatarUrl from auth.me
- [ ] Fix getCohortDiscussions to return userDisplayName and userAvatar fields
- [ ] Fix cohort discussion frontend to show displayName and avatarUrl
- [ ] Fix community member listing to use displayName
- [ ] Auto-send welcome email when student is assigned to a cohort group (assignStudentToCohortGroup mutation)
- [ ] Send welcome emails to Chris Layman and Stephanie Fleury for June 2026 cohort group

## Recurring Sessions & Assignment Editor (2026-05-30)
- [x] Fix recurring session expansion: done-flag breaks outer while loop when end date exceeded
- [x] Fix recurring session expansion: inclusive end date (+24h) so sessions on end date are included
- [x] Re-expand all 5 parent sessions in DB — now 34 total sessions
- [ ] Upgrade assignment editor to full LessonBlockEditor (full-page, block-based like lessons/landing pages)

## Profile & Display Name Fixes — COMPLETED (May 30 2026)
- [x] auth.me now returns fresh displayName/avatarUrl/name from DB (not stale session cache)
- [x] MembersLayout header shows avatarUrl image and displayName with fallback to name
- [x] MembersLayout dropdown also shows displayName
- [x] getCohortDiscussions query returns userDisplayName and userAvatar
- [x] CourseOverview cohort discussion messages show avatar image + displayName
- [x] Admin cohort group discussion thread shows avatar image + displayName
- [x] Admin all-discussions panel shows avatar image + displayName
- [x] assignStudentToCohortGroup fires welcome email automatically
- [x] Assignment editor now uses full LessonBlockEditor (key prop for reset on switch)

## Teams Redesign (TODO)
- [ ] Schema: add org contact info fields to lmsGroups (orgName, adminUserId, adminEmail, adminPhone, website)
- [ ] Schema: new lmsGroupCourses table (id, groupId, courseId, seats, createdAt)
- [ ] Schema: migrate existing lmsGroups.courseId + totalSeats into lmsGroupCourses
- [ ] Server: create team without requiring a course (admin path, no payment)
- [ ] Server: addCourseToTeam procedure (admin: free; team admin: Stripe payment-gated)
- [ ] Server: team admin role — can manage own team only, no other admin access
- [ ] UI: Create Team dialog — name, org contact, admin user, members list, then courses+seats
- [ ] UI: Team detail page — multi-course seat breakdown, member assignment per course
- [ ] UI: Team admin portal — manage members, assign to courses, purchase additional seats/courses

## Member Analytics & Teams Rebuild (May 2026)
- [x] Add getCertificateList procedure to adminUserRouter (paginated, searchable)
- [x] Add getEnrollmentAnalytics procedure (per-course breakdown + monthly trend)
- [x] Add getActivityFeed procedure (enrollments, completions, certificates, logins)
- [x] Add getInvitationStats procedure (group summary + recent invites)
- [x] Rebuild CertificatesPanel in MembersHub with real data (table + pagination + search)
- [x] Rebuild InvitationsPanel in MembersHub with real data (summary cards + groups + recent invites)
- [x] Rebuild ActivityPanel in MembersHub with real data (feed + type filter)
- [x] Rebuild EnrollmentsPanel in MembersHub with real data (summary cards + monthly trend + per-course table)
- [x] Add lmsGroupCourses to lmsEnrollmentAdminRouter imports
- [x] Add listTeams procedure (multi-course enriched)
- [x] Add createTeam procedure (no course required, org info fields)
- [x] Add updateTeam procedure
- [x] Add addCourseToTeam procedure
- [x] Add removeCourseFromTeam procedure
- [x] Add updateCourseSeatCount procedure
- [x] Add deleteTeam procedure
- [x] Rebuild GroupsTab in LMSAdmin with multi-course Teams UI (org info, courses, seats)
- [x] Add AddCourseToTeamInline component
- [x] Add EditTeamDialog component
- [x] Fix GroupSeatAssignPanel to handle multi-course teams (primaryCourseId fallback)

## Member Roster Deep Links & Admin Breadcrumb (May 30)

- [ ] Add deep-link button to CourseUsersTab rows → /admin/users/:id
- [ ] Add userId to listTeams seatList (via enrollment join) and add deep-link to team member rows
- [ ] Add Members/Buyers tab to PhysicalProductsAdmin with deep links
- [ ] Add platform admin breadcrumb to member dashboard (StudentDashboardPage) for admins

## Admin Member Profile Management (May 30)
- [x] Fix MembersHub deep-link routing: replace wouter Link with cross-domain anchor tags using getAdminUrl()
- [x] Make member name/avatar cell clickable in AllMembersPanel table rows
- [x] Add updateUserProfile procedure (admin edits: name, email, bio, specialty, credentials, location, website, timezone, isPremium, isDemo)
- [x] Add getUserLoginHistory procedure (paginated login events with IP, country, user agent)
- [x] Add getUserActivityLog procedure (paginated activity log with event type, description, path, IP)
- [x] Add getUserPurchases procedure (unified purchases: funnel + LMS orders + digital + physical)
- [x] Rebuild ProfileTab with inline Edit Profile dialog (all fields editable)
- [x] Add Activity tab to AdminUserDetailPage (paginated event log with color-coded event types)
- [x] Add Logins tab to AdminUserDetailPage (paginated login history with device/browser parsing)
- [x] Update TABS array to include Activity and Logins tabs with icons

## Deep-Link Fix + Email Aliases + Merge Users (May 30)
- [x] Fix MembersRouter catch-all: add /admin/users/:userId route before /admin/:rest* redirect
- [x] Create user_email_aliases table (userId, email, label, source, createdAt)
- [x] Apply migration for user_email_aliases
- [x] Wire email aliases into auth lookup: findUserByEmail checks aliases too
- [x] Magic links always sent to primary email (users.email), not alias
- [x] Admin procedures: addEmailAlias, removeEmailAlias, listEmailAliases, searchUsersForMerge
- [x] mergeUsers procedure: re-point all FK tables to primary userId, add duplicate email as alias, soft-delete duplicate
- [x] Admin UI: email aliases panel in ProfileTab (list + add + remove)
- [x] Admin UI: Merge Users button/dialog in AdminUserDetailPage (search, preview both accounts, confirm)
