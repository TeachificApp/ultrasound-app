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

## iHeartEcho-Style Gating Rules (Mar 19)
- [ ] Daily Challenge: not-logged-in → see banner + blurred preview, must sign in to play; free → today's challenge only (all categories); premium → today + full archive + leaderboard
- [ ] Daily Challenge: archive tab locked for free members with upgrade prompt overlay
- [ ] Daily Challenge: leaderboard tab locked for free members with upgrade prompt overlay
- [ ] Flashcards: not-logged-in → see banner + blurred card deck, must sign in; free → 10 cards/day randomized, after limit show upgrade overlay; premium → unlimited randomized
- [ ] Flashcards: daily limit counter visible in header for free members; resets at midnight
- [ ] Flashcards: category filter available to all logged-in members; premium badge on premium-only categories
- [ ] Case Library: not-logged-in → see banner + blurred case list, must sign in; free → can view all published cases; premium → can submit cases + access premium case types
- [ ] Case Library: case submission locked for free members with upgrade prompt
- [ ] SoundBytes: not-logged-in → see banner + blurred list, must sign in; free → first 3 clips per category free; premium → all clips unlocked
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
