/*
  UltrasoundAssist™ — All About Ultrasound™
  App Router — all routes for the UltrasoundAssist platform
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoModeBanner from "./components/DemoModeBanner";
import GetAppBanner from "./components/GetAppBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleGuard } from "@/components/RoleGuard";
import LMSLayout from "./components/LMSLayout";
import { isLearnDomain, isIHeartEchoDomain, isMembersDomain } from "./hooks/useSubdomain";
import { usePageViewTracker } from "./hooks/useAnalytics";

// ── Core pages ────────────────────────────────────────────────────────────────
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MagicLinkRequest from "./pages/MagicLinkRequest";
import MagicLinkCallback from "./pages/MagicLinkCallback";
import Enrolled from "./pages/Enrolled";
import Unsubscribe from "./pages/Unsubscribe";
import UpgradeSuccess from "./pages/UpgradeSuccess";
import Premium from "./pages/Premium";

// ── LMS — Education Library ─────────────────────────────────────────────────
import EducationLibrary from "./pages/EducationLibrary";
import LMSHome from "./pages/LMSHome";
import CollectionDetail from "./pages/CollectionDetail";
import CourseLanding from "./pages/CourseLanding";
import CoursePlayer from "./pages/CoursePlayer";
import LMSAdmin from "./pages/admin/LMSAdmin";
import LandingPageBuilder from "./pages/admin/LandingPageBuilder";
const FunnelBuilder = lazy(() => import("./pages/admin/FunnelBuilder"));
const FunnelPageEditor = lazy(() => import("./pages/admin/FunnelPageEditor"));
const ContactsAdmin = lazy(() => import("./pages/admin/ContactsAdmin"));
const SharingMonitor = lazy(() => import("./pages/admin/SharingMonitor"));
const PublicFunnelPage = lazy(() => import("./pages/PublicFunnelPage"));
// ── Digital Downloads ──────────────────────────────────────────────────────────
import DownloadsBrowse from "./pages/DownloadsBrowse";
import DownloadLanding from "./pages/DownloadLanding";
import DownloadFiles from "./pages/DownloadFiles";
import DownloadLandingPageBuilder from "./pages/admin/DownloadLandingPageBuilder";
import MyDownloads from "./pages/MyDownloads";
import BundleLanding from "./pages/BundleLanding";

// ── UltrasoundAssist™ Hub ────────────────────────────────────────────────────
import UltrasoundAssistHub from "./pages/UltrasoundAssistHub";
import ObGynCalculators from "./pages/ObGynCalculators";
import ClinicalInterpretationEngine from "./pages/ClinicalInterpretationEngine";

// ── Abdominal Ultrasound ──────────────────────────────────────────────────────
import AbdominalNavigator from "./pages/AbdominalNavigator";
import AbdominalScanCoach from "./pages/AbdominalScanCoach";

// ── Pelvic/Gyn Ultrasound ─────────────────────────────────────────────────────
import PelvicGynNavigator from "./pages/PelvicGynNavigator";
import PelvicGynScanCoach from "./pages/PelvicGynScanCoach";

// ── Obstetric 1st Trimester ───────────────────────────────────────────────────
import OB1Navigator from "./pages/OB1Navigator";
import OB1ScanCoach from "./pages/OB1ScanCoach";

// ── Obstetric 2nd/3rd Trimester ───────────────────────────────────────────────
import OB23Navigator from "./pages/OB23Navigator";
import OB23ScanCoach from "./pages/OB23ScanCoach";

// ── Small Parts — Thyroid ─────────────────────────────────────────────────────
import ThyroidNavigator from "./pages/ThyroidNavigator";
import ThyroidScanCoach from "./pages/ThyroidScanCoach";

// ── Small Parts — Scrotum ─────────────────────────────────────────────────────
import ScrotumNavigator from "./pages/ScrotumNavigator";
import ScrotumScanCoach from "./pages/ScrotumScanCoach";

// ── Breast Ultrasound ─────────────────────────────────────────────────────────
import BreastNavigator from "./pages/BreastNavigator";
import BreastScanCoach from "./pages/BreastScanCoach";

// ── Vascular — Venous ─────────────────────────────────────────────────────────
import VenousNavigator from "./pages/VenousNavigator";
import VenousScanCoach from "./pages/VenousScanCoach";

// ── Vascular — Arterial ───────────────────────────────────────────────────────
import ArterialNavigator from "./pages/ArterialNavigator";
import ArterialScanCoach from "./pages/ArterialScanCoach";

// ── Vascular — Abdominal/Renal/Mesenteric ────────────────────────────────────
import AbdominalVascularNavigator from "./pages/AbdominalVascularNavigator";
import AbdominalVascularScanCoach from "./pages/AbdominalVascularScanCoach";

// ── Vascular — Abdominal Aorta/EndoLeak ──────────────────────────────────────
import AortaNavigator from "./pages/AortaNavigator";
import AortaScanCoach from "./pages/AortaScanCoach";

// ── Vascular — Extracranial Carotid ──────────────────────────────────────────
import CarotidNavigator from "./pages/CarotidNavigator";
import CarotidScanCoach from "./pages/CarotidScanCoach";

// ── Vascular — Intracranial Duplex/TCD ───────────────────────────────────────
import TCDNavigator from "./pages/TCDNavigator";
import TCDScanCoach from "./pages/TCDScanCoach";

// ── MSK ───────────────────────────────────────────────────────────────────────
import MSKNavigator from "./pages/MSKNavigator";
import MSKScanCoach from "./pages/MSKScanCoach";

// ── POCUS-Assist™ ─────────────────────────────────────────────────────────────
import POCUSAssistHub from "./pages/POCUSAssistHub";
import POCUSEfastNavigator from "./pages/POCUSEfastNavigator";
import POCUSRushNavigator from "./pages/POCUSRushNavigator";
import POCUSCardiacNavigator from "./pages/POCUSCardiacNavigator";
import POCUSLungNavigator from "./pages/POCUSLungNavigator";
import POCUSEfastScanCoach from "./pages/POCUSEfastScanCoach";
import POCUSRushScanCoach from "./pages/POCUSRushScanCoach";
import POCUSCardiacScanCoach from "./pages/POCUSCardiacScanCoach";
import POCUSLungScanCoach from "./pages/POCUSLungScanCoach";

// ── Fetal EchoAssist™ ─────────────────────────────────────────────────────────
import FetalEchoAssist from "./pages/FetalEchoAssist";
import FetalNavigator from "./pages/FetalNavigator";
import FetalScanCoach from "./pages/FetalScanCoach";
import AppendixNavigator from "./pages/AppendixNavigator";
import AppendixScanCoach from "./pages/AppendixScanCoach";
import InvasiveProceduresNavigator from "./pages/InvasiveProceduresNavigator";
import InvasiveProceduresScanCoach from "./pages/InvasiveProceduresScanCoach";
// ── PediatricAssist™ ──────────────────────────────────────────────────────────
import PediatricNavigator from "./pages/PediatricNavigator";
import PediatricScanCoach from "./pages/PediatricScanCoach";
import PediatricCalculators from "./pages/PediatricCalculators";

// ── LMS Engines ───────────────────────────────────────────────────────────────
import QuickFire from "./pages/QuickFire";
import FlashcardDeck from "./pages/FlashcardDeck";
import CaseLibrary from "./pages/CaseLibrary";
import RegistryReviewHub from "./pages/RegistryReviewHub";
import CaseDetail from "./pages/CaseDetail";
import SubmitCase from "./pages/SubmitCase";
import SoundBytes from "./pages/SoundBytes";

// ── Admin & Platform ──────────────────────────────────────────────────────────
import AdminCaseManagement from "./pages/AdminCaseManagement";
import QuickFireAdmin from "./pages/QuickFireAdmin";
import ChallengeCardGenerator from "./pages/ChallengeCardGenerator";
import SocialContentGenerator from "./pages/SocialContentGenerator";
import ScanCoachEditor from "./pages/ScanCoachEditor";
import NavigatorEditor from "./pages/NavigatorEditor";
import MediaRepository from "./pages/admin/MediaRepository";
import ScanCoachHub from "./pages/ScanCoachHub";
import ThinkificWebhookAdmin from "./pages/ThinkificWebhookAdmin";
import FormBuilderAdmin from "./pages/FormBuilderAdmin";
import EmailAdmin from "./pages/EmailAdmin";
import PlatformAdmin from "./pages/PlatformAdmin";
import EducatorAssist from "./pages/EducatorAssist";
import SonoQuizCreator from "./pages/SonoQuizCreator";
import SonoQuizHost from "./pages/SonoQuizHost";
import SonoQuizPlay from "./pages/SonoQuizPlay";
import ImageQualityReview from "./pages/ImageQualityReview";

// ── DIY Accreditation™ (hidden, backend use) ──────────────────────────────────
import DIYMemberPortal from "./pages/DIYMemberPortal";
import DIYAccreditationPlans from "./pages/DIYAccreditationPlans";
import DIYRegister from "./pages/DIYRegister";
import AccreditationNavigator from "./pages/AccreditationNavigator";
import AccreditationTool from "./pages/AccreditationTool";
import AccreditationManager from "./pages/AccreditationManager";

// ── Learn Fetal Echo ────────────────────────────────────────────
import LearnFetalEcho from "./pages/LearnFetalEcho";

// ── iHeartEcho™ EchoAssist Pages ────────────────────────────────────────────
import IHeartEchoHome from "./pages/iheartecho/IHeartEchoHome";
import EchoAssist from "./pages/iheartecho/EchoAssist";
import EchoAssistHub from "./pages/iheartecho/EchoAssistHub";
import TTENavigator from "./pages/iheartecho/TTENavigator";
import TEENavigator from "./pages/iheartecho/TEENavigator";
import ICENavigator from "./pages/iheartecho/ICENavigator";
import DeviceNavigator from "./pages/iheartecho/DeviceNavigator";
import ACHDNavigator from "./pages/iheartecho/ACHDNavigator";
import ACHDEchoAssist from "./pages/iheartecho/ACHDEchoAssist";
import StressNavigator from "./pages/iheartecho/StressNavigator";
import StrainNavigator from "./pages/iheartecho/StrainNavigator";
import StrainScanCoach from "./pages/iheartecho/StrainScanCoach";
import TEEScanCoach from "./pages/iheartecho/TEEScanCoach";
import ICEScanCoach from "./pages/iheartecho/ICEScanCoach";
import UEANavigator from "./pages/iheartecho/UEANavigator";
import UEAScanCoach from "./pages/iheartecho/UEAScanCoach";
import HOCMNavigator from "./pages/iheartecho/HOCMNavigator";
import HOCMScanCoach from "./pages/iheartecho/HOCMScanCoach";
import StressScanCoach from "./pages/iheartecho/StressScanCoach";
import StressEchoAssistPage from "./pages/iheartecho/StressEchoAssist";
import StructuralHeartScanCoach from "./pages/iheartecho/StructuralHeartScanCoach";
import PulmHTNNavigator from "./pages/iheartecho/PulmHTNNavigator";
import DiastolicNavigator from "./pages/iheartecho/DiastolicNavigator";
import MechanicalSupportNavigator from "./pages/iheartecho/MechanicalSupportNavigator";
import MechanicalSupportScanCoach from "./pages/iheartecho/MechanicalSupportScanCoach";
import ECGNavigator from "./pages/iheartecho/ECGNavigator";
import ECGCoach from "./pages/iheartecho/ECGCoach";
import ECGAssist from "./pages/iheartecho/ECGAssist";
import HemodynamicsLab from "./pages/iheartecho/HemodynamicsLab";
import ReportBuilder from "./pages/iheartecho/ReportBuilder";
import GuidelinesAssist from "./pages/iheartecho/GuidelinesAssist";
import PediatricEchoAssist from "./pages/iheartecho/PediatricEchoAssist";
import ScanCoachIHE from "./pages/iheartecho/ScanCoach";
import EngagementDashboard from "./pages/iheartecho/EngagementDashboard";
import SoundBytesAdmin from "./pages/iheartecho/SoundBytesAdmin";
import Leaderboard from "./pages/Leaderboard";
import LabAdmin from "./pages/iheartecho/LabAdmin";
import EducatorAdmin from "./pages/iheartecho/EducatorAdmin";
import StudentDashboard from "./pages/iheartecho/StudentDashboard";
import SoundBytesPage from "./pages/SoundBytes";

// ── CME Hub ─────────────────────────────────────────────────────────────────────────
import CMEHub from "./pages/CMEHub";

// ── Physician Over-Read (public, token-based) ─────────────────────────────────
import PhysicianOverReadForm from "./pages/PhysicianOverReadForm";

// ── Analytics Reporting ──────────────────────────────────────────────────────
import UserAnalytics from "./pages/admin/UserAnalytics";

function Router() {
  usePageViewTracker();
  return (
    <>
      <Switch>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/magic-link/callback" component={MagicLinkCallback} />
        {/* /auth/magic is the URL sent in magic link emails */}
        <Route path="/auth/magic" component={MagicLinkCallback} />
        <Route path="/enrolled" component={Enrolled} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/upgrade-success" component={UpgradeSuccess} />
        <Route path="/premium" component={Premium} />
        <Route path="/profile" component={Profile} />

        {/* ── UltrasoundAssist™ Hub ───────────────────────────────────── */}
        <Route path="/ultrasound-assist" component={UltrasoundAssistHub} />
        <Route path="/scan-coach-hub" component={ScanCoachHub} />
        <Route path="/calculators" component={ObGynCalculators} />
        <Route path="/clinical-intelligence" component={ClinicalInterpretationEngine} />

        {/* ── Abdominal ─────────────────────────────────────────────────── */}
        <Route path="/abdominal-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AbdominalNavigator /></RoleGuard>}</Route>
        <Route path="/abdominal-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AbdominalScanCoach /></RoleGuard>}</Route>

        {/* ── Pelvic/Gyn ────────────────────────────────────────────────── */}
        <Route path="/pelvic-gyn-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PelvicGynNavigator /></RoleGuard>}</Route>
        <Route path="/pelvic-gyn-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PelvicGynScanCoach /></RoleGuard>}</Route>

        {/* ── OB 1st Trimester ──────────────────────────────────────────── */}
        <Route path="/ob1-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><OB1Navigator /></RoleGuard>}</Route>
        <Route path="/ob1-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><OB1ScanCoach /></RoleGuard>}</Route>

        {/* ── OB 2nd/3rd Trimester ──────────────────────────────────────── */}
        <Route path="/ob23-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><OB23Navigator /></RoleGuard>}</Route>
        <Route path="/ob23-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><OB23ScanCoach /></RoleGuard>}</Route>

        {/* ── Thyroid ───────────────────────────────────────────────────── */}
        <Route path="/thyroid-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><ThyroidNavigator /></RoleGuard>}</Route>
        <Route path="/thyroid-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ThyroidScanCoach /></RoleGuard>}</Route>

        {/* ── Scrotum ───────────────────────────────────────────────────── */}
        <Route path="/scrotum-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><ScrotumNavigator /></RoleGuard>}</Route>
        <Route path="/scrotum-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ScrotumScanCoach /></RoleGuard>}</Route>

        {/* ── Breast ────────────────────────────────────────────────────── */}
        <Route path="/breast-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><BreastNavigator /></RoleGuard>}</Route>
        <Route path="/breast-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><BreastScanCoach /></RoleGuard>}</Route>

        {/* Appendix */}
        <Route path="/appendix-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AppendixNavigator /></RoleGuard>}</Route>
        <Route path="/appendix-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AppendixScanCoach /></RoleGuard>}</Route>

        {/* Invasive Procedures */}
        <Route path="/invasive-procedures-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><InvasiveProceduresNavigator /></RoleGuard>}</Route>
        <Route path="/invasive-procedures-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><InvasiveProceduresScanCoach /></RoleGuard>}</Route>
        {/* ── PediatricAssist™ ──────────────────────────────────────────── */}
        <Route path="/pediatric-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PediatricNavigator /></RoleGuard>}</Route>
        <Route path="/pediatric-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><PediatricScanCoach /></RoleGuard>}</Route>
        <Route path="/pediatric-calculators" component={PediatricCalculators} />

        {/* ── Vascular — Venous ─────────────────────────────────────────── */}
        <Route path="/venous-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><VenousNavigator /></RoleGuard>}</Route>
        <Route path="/venous-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><VenousScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Arterial ───────────────────────────────────────── */}
        <Route path="/arterial-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><ArterialNavigator /></RoleGuard>}</Route>
        <Route path="/arterial-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ArterialScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Abdominal/Renal/Mesenteric ─────────────────────── */}
        <Route path="/abdominal-vascular-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AbdominalVascularNavigator /></RoleGuard>}</Route>
        <Route path="/abdominal-vascular-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AbdominalVascularScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Aorta/EndoLeak ─────────────────────────────────── */}
        <Route path="/aorta-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AortaNavigator /></RoleGuard>}</Route>
        <Route path="/aorta-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AortaScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Carotid ────────────────────────────────────────── */}
        <Route path="/carotid-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><CarotidNavigator /></RoleGuard>}</Route>
        <Route path="/carotid-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><CarotidScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — TCD ────────────────────────────────────────────── */}
        <Route path="/tcd-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><TCDNavigator /></RoleGuard>}</Route>
        <Route path="/tcd-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><TCDScanCoach /></RoleGuard>}</Route>

        {/* ── MSK ───────────────────────────────────────────────────────── */}
        <Route path="/msk-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><MSKNavigator /></RoleGuard>}</Route>
        <Route path="/msk-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><MSKScanCoach /></RoleGuard>}</Route>

        {/* ── POCUS-Assist™ ─────────────────────────────────────────────── */}
        <Route path="/pocus-assist" component={POCUSAssistHub} />
        <Route path="/pocus-assist-hub" component={POCUSAssistHub} />
        <Route path="/pocus-efast-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><POCUSEfastNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-rush-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><POCUSRushNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-cardiac-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><POCUSCardiacNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-lung-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><POCUSLungNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-efast-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSEfastScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-rush-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSRushScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-cardiac-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSCardiacScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-lung-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSLungScanCoach /></RoleGuard>}</Route>

        {/* ── Fetal EchoAssist™ ─────────────────────────────────────────── */}
        <Route path="/fetal-echo-assist" component={FetalEchoAssist} />
        <Route path="/fetal-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><FetalNavigator /></RoleGuard>}</Route>
        <Route path="/fetal-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><FetalScanCoach /></RoleGuard>}</Route>

        {/* ── Learn Fetal Echo ──────────────────────────────────────────── */}
        <Route path="/learn-fetal-echo" component={LearnFetalEcho} />

        {/* ── LMS Engines ───────────────────────────────────────────────── */}
        <Route path="/quickfire" component={QuickFire} />
        <Route path="/flashcards" component={FlashcardDeck} />
        <Route path="/case-library" component={CaseLibrary} />
        <Route path="/registry-review" component={RegistryReviewHub} />
        <Route path="/cme" component={CMEHub} />
        <Route path="/case-library/submit" component={SubmitCase} />
        <Route path="/case-library/edit/:id" component={SubmitCase} />
        <Route path="/case-library/:id" component={CaseDetail} />
        <Route path="/soundbytes" component={SoundBytes} />

        {/* ── LMS — Education Library ──────────────────────────────────────────────────── */}
        <Route path="/education-library" component={EducationLibrary} />
        <Route path="/collections/:id" component={CollectionDetail} />
        <Route path="/learn/:slug/player" component={CoursePlayer} />
        <Route path="/learn/:slug" component={CourseLanding} />
          {/* ── Digital Downloads ───────────────────────────────────────────────────────── */}
        <Route path="/my-downloads" component={MyDownloads} />
        <Route path="/downloads/:slug/files" component={DownloadFiles} />
        <Route path="/downloads/:slug" component={DownloadLanding} />
        <Route path="/downloads" component={DownloadsBrowse} />
        <Route path="/bundles/:slug" component={BundleLanding} />
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DownloadLandingPageBuilder /></RoleGuard>}</Route>

        {/* ── Admin ───────────────────────────────────────────────────────────── */}
        <Route path="/admin/cases">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard>}</Route>
        <Route path="/admin/quickfire">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard>}</Route>
        <Route path="/admin/challenge-cards">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard>}</Route>
        <Route path="/admin/social-content">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SocialContentGenerator /></RoleGuard>}</Route>
        <Route path="/admin/funnels">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId/pages/:pageId/edit">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelPageEditor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/contacts">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ContactsAdmin /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/scancoach">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard>}</Route>
        <Route path="/admin/navigator">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard>}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/thinkific-webhook">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EmailAdmin /></RoleGuard>}</Route>
        <Route path="/admin/sharing-monitor">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SharingMonitor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/user-analytics">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><UserAnalytics /></RoleGuard>}</Route>
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        <Route path="/educator-assist">{() => <EducatorAssist />}</Route>
        {/* ── SonoQuiz (admin-only during testing) ──────────────────────── */}
        <Route path="/admin/sonoquiz">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SonoQuizCreator /></RoleGuard>}</Route>
        <Route path="/admin/sonoquiz/host/:sessionId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SonoQuizHost /></RoleGuard>}</Route>
        <Route path="/quiz/:joinCode">{() => <SonoQuizPlay />}</Route>
        <Route path="/image-quality-review">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ImageQualityReview /></RoleGuard>}</Route>

        {/* ── DIY Accreditation™ (hidden backend) ───────────────────────── */}
        <Route path="/diy-accreditation-plans" component={DIYAccreditationPlans} />
        <Route path="/diy-register" component={DIYRegister} />
        <Route path="/diy-member">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><DIYMemberPortal /></RoleGuard>}</Route>
        <Route path="/accreditation-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AccreditationNavigator /></RoleGuard>}</Route>
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/accreditation-manager">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AccreditationManager /></RoleGuard>}</Route>

        {/* ── Public Funnel Pages ────────────────────────────────────── */}
        <Route path="/f/:slug/:pageSlug">{() => <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><PublicFunnelPage /></Suspense>}</Route>

        {/* ── Physician Over-Read (public, token-based) ─────────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

/**
 * LMSRouter — Routes shown only on the learn subdomain.
 * Wraps all pages in LMSLayout with its own sidebar.
 */
function LMSRouter() {
  usePageViewTracker();
  return (
    <LMSLayout>
      <Switch>
        {/* LMS Home */}
        <Route path="/" component={LMSHome} />
        <Route path="/education-library" component={EducationLibrary} />
        <Route path="/collections/:id" component={CollectionDetail} />
        <Route path="/learn/:slug/player" component={CoursePlayer} />
        <Route path="/learn/:slug" component={CourseLanding} />

        {/* Digital Downloads */}
        <Route path="/my-downloads" component={MyDownloads} />
        <Route path="/downloads/:slug/files" component={DownloadFiles} />
        <Route path="/downloads/:slug" component={DownloadLanding} />
        <Route path="/downloads" component={DownloadsBrowse} />
        <Route path="/bundles/:slug" component={BundleLanding} />

        {/* Admin (platform_admin only) */}
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DownloadLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>

        {/* Auth pages (needed for login flow) */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile" component={Profile} />

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
    </LMSLayout>
  );
}

/**
 * IHeartEchoRouter — Routes shown only on the iHeartEcho subdomain.
 * Wraps all pages in Layout (which auto-detects iHeartEcho brand).
 */
function IHeartEchoRouter() {
  usePageViewTracker();
  return (
    <>
      <Switch>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/" component={IHeartEchoHome} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/auth/magic" component={MagicLinkCallback} />
        <Route path="/enrolled" component={Enrolled} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/upgrade-success" component={UpgradeSuccess} />
        <Route path="/premium" component={Premium} />
        <Route path="/profile" component={Profile} />

        {/* ── EchoAssist™ Hub ────────────────────────────────────────── */}
        <Route path="/echo-assist-hub" component={EchoAssistHub} />
        <Route path="/echoassist" component={EchoAssist} />
        <Route path="/scan-coach" component={ScanCoachIHE} />
        <Route path="/scan-coach-hub" component={ScanCoachHub} />
        <Route path="/hemodynamics" component={HemodynamicsLab} />
        <Route path="/report" component={ReportBuilder} />
        <Route path="/guidelines-assist" component={GuidelinesAssist} />

        {/* ── Echo Navigators ────────────────────────────────────────── */}
        <Route path="/tte">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><TTENavigator /></RoleGuard>}</Route>
        <Route path="/tee">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><TEENavigator /></RoleGuard>}</Route>
        <Route path="/ice">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><ICENavigator /></RoleGuard>}</Route>
        <Route path="/device">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><DeviceNavigator /></RoleGuard>}</Route>
        <Route path="/achd">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ACHDNavigator /></RoleGuard>}</Route>
        <Route path="/achd-echo-assist" component={ACHDEchoAssist} />
        <Route path="/stress">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><StressNavigator /></RoleGuard>}</Route>
        <Route path="/strain">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><StrainNavigator /></RoleGuard>}</Route>
        <Route path="/fetal">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><FetalNavigator /></RoleGuard>}</Route>
        <Route path="/fetal-echo-assist" component={FetalEchoAssist} />
        <Route path="/pediatric">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PediatricNavigator /></RoleGuard>}</Route>
        <Route path="/pediatric-echo-assist" component={PediatricEchoAssist} />
        <Route path="/pulm-htn">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PulmHTNNavigator /></RoleGuard>}</Route>
        <Route path="/diastolic">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><DiastolicNavigator /></RoleGuard>}</Route>
        <Route path="/mechanical-support-navigator">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><MechanicalSupportNavigator /></RoleGuard>}</Route>
        <Route path="/mechanical-support-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><MechanicalSupportScanCoach /></RoleGuard>}</Route>

        {/* ── Echo Scan Coaches ──────────────────────────────────────── */}
        <Route path="/strain-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><StrainScanCoach /></RoleGuard>}</Route>
        <Route path="/tee-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><TEEScanCoach /></RoleGuard>}</Route>
        <Route path="/ice-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ICEScanCoach /></RoleGuard>}</Route>
        <Route path="/uea-navigator">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><UEANavigator /></RoleGuard>}</Route>
        <Route path="/uea-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><UEAScanCoach /></RoleGuard>}</Route>
        <Route path="/hocm-navigator">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><HOCMNavigator /></RoleGuard>}</Route>
        <Route path="/hocm-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><HOCMScanCoach /></RoleGuard>}</Route>
        <Route path="/stress-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><StressScanCoach /></RoleGuard>}</Route>
        <Route path="/stress-echo-assist">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><StressEchoAssistPage /></RoleGuard>}</Route>
        <Route path="/structural-heart-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><StructuralHeartScanCoach /></RoleGuard>}</Route>
        <Route path="/fetal-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><FetalScanCoach /></RoleGuard>}</Route>

        {/* ── POCUS-Assist™ ──────────────────────────────────────────── */}
        <Route path="/pocus-assist-hub" component={POCUSAssistHub} />
        <Route path="/pocus-efast" component={POCUSEfastNavigator} />
        <Route path="/pocus-rush">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSRushNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-cardiac" component={POCUSCardiacNavigator} />
        <Route path="/pocus-lung">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSLungNavigator /></RoleGuard>}</Route>
        <Route path="/pocus-efast-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSEfastScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-rush-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSRushScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-cardiac-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSCardiacScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-lung-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSLungScanCoach /></RoleGuard>}</Route>

        {/* ── ECG-Assist™ ────────────────────────────────────────────── */}
        <Route path="/ecg-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><ECGNavigator /></RoleGuard>}</Route>
        <Route path="/ecg-coach" component={ECGCoach} />
        <Route path="/ecg-assist" component={ECGAssist} />

        {/* ── LMS Engines ────────────────────────────────────────────── */}
        <Route path="/quickfire" component={QuickFire} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/flashcards" component={FlashcardDeck} />
        <Route path="/case-library" component={CaseLibrary} />
        <Route path="/case-library/submit" component={SubmitCase} />
        <Route path="/case-library/edit/:id" component={SubmitCase} />
        <Route path="/case-library/:id" component={CaseDetail} />
        <Route path="/soundbytes" component={SoundBytesPage} />
        <Route path="/registry-review" component={RegistryReviewHub} />
        <Route path="/cme" component={CMEHub} />

        {/* ── DIY Accreditation™ ─────────────────────────────────────── */}
        <Route path="/diy-accreditation-plans" component={DIYAccreditationPlans} />
        <Route path="/diy-register" component={DIYRegister} />
        <Route path="/diy-member">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><DIYMemberPortal /></RoleGuard>}</Route>
        <Route path="/accreditation-navigator">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AccreditationNavigator /></RoleGuard>}</Route>
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_admin"]} allowAdmin={false}><LabAdmin /></RoleGuard>}</Route>

        {/* ── Admin ──────────────────────────────────────────────────── */}
        <Route path="/admin/cases">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard>}</Route>
        <Route path="/admin/quickfire">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard>}</Route>
        <Route path="/admin/scancoach">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard>}</Route>
        <Route path="/admin/navigator">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard>}</Route>
        <Route path="/admin/soundbytes">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SoundBytesAdmin /></RoleGuard>}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/thinkific-webhook">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EmailAdmin /></RoleGuard>}</Route>
        <Route path="/admin/engagement">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EngagementDashboard /></RoleGuard>}</Route>
        <Route path="/admin/challenge-cards">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard>}</Route>
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        <Route path="/educator-assist">{() => <RoleGuard roles={["education_manager", "education_admin", "education_student"]} allowAdmin={true}><EducatorAssist /></RoleGuard>}</Route>
        <Route path="/educator-admin">{() => <RoleGuard roles={["education_admin", "education_manager"]} allowAdmin={true}><EducatorAdmin /></RoleGuard>}</Route>
        <Route path="/student-dashboard">{() => <RoleGuard roles={["education_student", "education_admin", "education_manager"]} allowAdmin={true}><StudentDashboard /></RoleGuard>}</Route>
        <Route path="/image-quality-review">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ImageQualityReview /></RoleGuard>}</Route>

        {/* ── Physician Over-Read (public, token-based) ──────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  const onLearnSubdomain = isLearnDomain();
  const onMembersSubdomain = isMembersDomain();
  const onIHeartEchoSubdomain = isIHeartEchoDomain();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {(onLearnSubdomain || onMembersSubdomain) ? (
            <LMSRouter />
          ) : onIHeartEchoSubdomain ? (
            <IHeartEchoRouter />
          ) : (
            <>
              <DemoModeBanner />
              <GetAppBanner />
              <Router />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
