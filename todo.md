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
