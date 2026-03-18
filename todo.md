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

## SoundBytes™
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
