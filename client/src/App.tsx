/*
  UltrasoundAssist™ — All About Ultrasound™
  App Router — all routes for the UltrasoundAssist platform
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import MediaRedirect from "@/pages/MediaRedirect";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoModeBanner from "./components/DemoModeBanner";
import GetAppBanner from "./components/GetAppBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleGuard } from "@/components/RoleGuard";
import LMSLayout from "./components/LMSLayout";
import { isLearnDomain, isIHeartEchoDomain, isMembersDomain } from "./hooks/useSubdomain";
import UpgradePrompt from "./components/UpgradePrompt";
import { useAuth } from "./_core/hooks/useAuth";
import { usePageViewTracker } from "./hooks/useAnalytics";

// ── Core pages (eagerly loaded — tiny, always needed) ────────────────────────
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MagicLinkRequest from "./pages/MagicLinkRequest";
import MagicLinkCallback from "./pages/MagicLinkCallback";
import Enrolled from "./pages/Enrolled";
import Unsubscribe from "./pages/Unsubscribe";

// ── All other pages — lazy loaded for code splitting ─────────────────────────
const Profile = lazy(() => import("./pages/Profile"));
const UpgradeSuccess = lazy(() => import("./pages/UpgradeSuccess"));
const Premium = lazy(() => import("./pages/Premium"));

// ── LMS — Education Library ─────────────────────────────────────────────────
const EducationLibrary = lazy(() => import("./pages/EducationLibrary"));
const LMSHome = lazy(() => import("./pages/LMSHome"));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail"));
const CourseLanding = lazy(() => import("./pages/CourseLanding"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const CourseOverview = lazy(() => import("./pages/CourseOverview"));
const LMSAdmin = lazy(() => import("./pages/admin/LMSAdmin"));
const LandingPageBuilder = lazy(() => import("./pages/admin/LandingPageBuilder"));
const FunnelBuilder = lazy(() => import("./pages/admin/FunnelBuilder"));
const FunnelPageEditor = lazy(() => import("./pages/admin/FunnelPageEditor"));
const ContactsAdmin = lazy(() => import("./pages/admin/ContactsAdmin"));
const SharingMonitor = lazy(() => import("./pages/admin/SharingMonitor"));
const PublicFunnelPage = lazy(() => import("./pages/PublicFunnelPage"));
const StandaloneLandingPage = lazy(() => import("./pages/StandaloneLandingPage"));

// ── Digital Downloads ──────────────────────────────────────────────────────────
const DownloadsBrowse = lazy(() => import("./pages/DownloadsBrowse"));
const DownloadLanding = lazy(() => import("./pages/DownloadLanding"));
const DownloadFiles = lazy(() => import("./pages/DownloadFiles"));
const DownloadLandingPageBuilder = lazy(() => import("./pages/admin/DownloadLandingPageBuilder"));
const MyDownloads = lazy(() => import("./pages/MyDownloads"));
const BundleLanding = lazy(() => import("./pages/BundleLanding"));
const ProductLanding = lazy(() => import("./pages/ProductLanding"));
const ProductLandingPageBuilder = lazy(() => import("./pages/admin/ProductLandingPageBuilder"));

// ── UltrasoundAssist™ Hub ────────────────────────────────────────────────────
const UltrasoundAssistHub = lazy(() => import("./pages/UltrasoundAssistHub"));
const ObGynCalculators = lazy(() => import("./pages/ObGynCalculators"));
const ClinicalInterpretationEngine = lazy(() => import("./pages/ClinicalInterpretationEngine"));

// ── Abdominal Ultrasound ──────────────────────────────────────────────────────
const AbdominalNavigator = lazy(() => import("./pages/AbdominalNavigator"));
const AbdominalScanCoach = lazy(() => import("./pages/AbdominalScanCoach"));

// ── Pelvic/Gyn Ultrasound ─────────────────────────────────────────────────────
const PelvicGynNavigator = lazy(() => import("./pages/PelvicGynNavigator"));
const PelvicGynScanCoach = lazy(() => import("./pages/PelvicGynScanCoach"));

// ── Obstetric 1st Trimester ───────────────────────────────────────────────────
const OB1Navigator = lazy(() => import("./pages/OB1Navigator"));
const OB1ScanCoach = lazy(() => import("./pages/OB1ScanCoach"));

// ── Obstetric 2nd/3rd Trimester ───────────────────────────────────────────────
const OB23Navigator = lazy(() => import("./pages/OB23Navigator"));
const OB23ScanCoach = lazy(() => import("./pages/OB23ScanCoach"));

// ── Small Parts — Thyroid ─────────────────────────────────────────────────────
const ThyroidNavigator = lazy(() => import("./pages/ThyroidNavigator"));
const ThyroidScanCoach = lazy(() => import("./pages/ThyroidScanCoach"));

// ── Small Parts — Scrotum ─────────────────────────────────────────────────────
const ScrotumNavigator = lazy(() => import("./pages/ScrotumNavigator"));
const ScrotumScanCoach = lazy(() => import("./pages/ScrotumScanCoach"));

// ── Breast Ultrasound ─────────────────────────────────────────────────────────
const BreastNavigator = lazy(() => import("./pages/BreastNavigator"));
const BreastScanCoach = lazy(() => import("./pages/BreastScanCoach"));

// ── Vascular — Venous ─────────────────────────────────────────────────────────
const VenousNavigator = lazy(() => import("./pages/VenousNavigator"));
const VenousScanCoach = lazy(() => import("./pages/VenousScanCoach"));

// ── Vascular — Arterial ───────────────────────────────────────────────────────
const ArterialNavigator = lazy(() => import("./pages/ArterialNavigator"));
const ArterialScanCoach = lazy(() => import("./pages/ArterialScanCoach"));

// ── Vascular — Abdominal/Renal/Mesenteric ────────────────────────────────────
const AbdominalVascularNavigator = lazy(() => import("./pages/AbdominalVascularNavigator"));
const AbdominalVascularScanCoach = lazy(() => import("./pages/AbdominalVascularScanCoach"));

// ── Vascular — Abdominal Aorta/EndoLeak ──────────────────────────────────────
const AortaNavigator = lazy(() => import("./pages/AortaNavigator"));
const AortaScanCoach = lazy(() => import("./pages/AortaScanCoach"));

// ── Vascular — Extracranial Carotid ──────────────────────────────────────────
const CarotidNavigator = lazy(() => import("./pages/CarotidNavigator"));
const CarotidScanCoach = lazy(() => import("./pages/CarotidScanCoach"));

// ── Vascular — Intracranial Duplex/TCD ───────────────────────────────────────
const TCDNavigator = lazy(() => import("./pages/TCDNavigator"));
const TCDScanCoach = lazy(() => import("./pages/TCDScanCoach"));

// ── MSK ───────────────────────────────────────────────────────────────────────
const MSKNavigator = lazy(() => import("./pages/MSKNavigator"));
const MSKScanCoach = lazy(() => import("./pages/MSKScanCoach"));

// ── POCUS-Assist™ ─────────────────────────────────────────────────────────────
const POCUSAssistHub = lazy(() => import("./pages/POCUSAssistHub"));
const POCUSEfastNavigator = lazy(() => import("./pages/POCUSEfastNavigator"));
const POCUSRushNavigator = lazy(() => import("./pages/POCUSRushNavigator"));
const POCUSCardiacNavigator = lazy(() => import("./pages/POCUSCardiacNavigator"));
const POCUSLungNavigator = lazy(() => import("./pages/POCUSLungNavigator"));
const POCUSEfastScanCoach = lazy(() => import("./pages/POCUSEfastScanCoach"));
const POCUSRushScanCoach = lazy(() => import("./pages/POCUSRushScanCoach"));
const POCUSCardiacScanCoach = lazy(() => import("./pages/POCUSCardiacScanCoach"));
const POCUSLungScanCoach = lazy(() => import("./pages/POCUSLungScanCoach"));

// ── Fetal EchoAssist™ ─────────────────────────────────────────────────────────
const FetalEchoAssist = lazy(() => import("./pages/FetalEchoAssist"));
const FetalNavigator = lazy(() => import("./pages/FetalNavigator"));
const FetalScanCoach = lazy(() => import("./pages/FetalScanCoach"));
const AppendixNavigator = lazy(() => import("./pages/AppendixNavigator"));
const AppendixScanCoach = lazy(() => import("./pages/AppendixScanCoach"));
const InvasiveProceduresNavigator = lazy(() => import("./pages/InvasiveProceduresNavigator"));
const InvasiveProceduresScanCoach = lazy(() => import("./pages/InvasiveProceduresScanCoach"));

// ── PediatricAssist™ ──────────────────────────────────────────────────────────
const PediatricNavigator = lazy(() => import("./pages/PediatricNavigator"));
const PediatricScanCoach = lazy(() => import("./pages/PediatricScanCoach"));
const PediatricCalculators = lazy(() => import("./pages/PediatricCalculators"));

// ── LMS Engines ───────────────────────────────────────────────────────────────
const QuickFire = lazy(() => import("./pages/QuickFire"));
const FlashcardDeck = lazy(() => import("./pages/FlashcardDeck"));
const CaseLibrary = lazy(() => import("./pages/CaseLibrary"));
const RegistryReviewHub = lazy(() => import("./pages/RegistryReviewHub"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const SubmitCase = lazy(() => import("./pages/SubmitCase"));
const SoundBytes = lazy(() => import("./pages/SoundBytes"));

// ── Admin & Platform ──────────────────────────────────────────────────────────
const AdminCaseManagement = lazy(() => import("./pages/AdminCaseManagement"));
const QuickFireAdmin = lazy(() => import("./pages/QuickFireAdmin"));
const ChallengeCardGenerator = lazy(() => import("./pages/ChallengeCardGenerator"));
const SocialContentGenerator = lazy(() => import("./pages/SocialContentGenerator"));
const ScanCoachEditor = lazy(() => import("./pages/ScanCoachEditor"));
const NavigatorEditor = lazy(() => import("./pages/NavigatorEditor"));
const MediaRepository = lazy(() => import("./pages/admin/MediaRepository"));
const ScanCoachHub = lazy(() => import("./pages/ScanCoachHub"));
const ThinkificWebhookAdmin = lazy(() => import("./pages/ThinkificWebhookAdmin"));
const FormBuilderAdmin = lazy(() => import("./pages/FormBuilderAdmin"));
const EmailAdmin = lazy(() => import("./pages/EmailAdmin"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const EducatorAssist = lazy(() => import("./pages/EducatorAssist"));
const SonoQuizCreator = lazy(() => import("./pages/SonoQuizCreator"));
const SonoQuizHost = lazy(() => import("./pages/SonoQuizHost"));
const SonoQuizPlay = lazy(() => import("./pages/SonoQuizPlay"));
const ImageQualityReview = lazy(() => import("./pages/ImageQualityReview"));

// ── DIY Accreditation™ (hidden, backend use) ──────────────────────────────────
const DIYMemberPortal = lazy(() => import("./pages/DIYMemberPortal"));
const DIYAccreditationPlans = lazy(() => import("./pages/DIYAccreditationPlans"));
const DIYRegister = lazy(() => import("./pages/DIYRegister"));
const AccreditationNavigator = lazy(() => import("./pages/AccreditationNavigator"));
const AccreditationTool = lazy(() => import("./pages/AccreditationTool"));
const AccreditationManager = lazy(() => import("./pages/AccreditationManager"));

// ── Learn Fetal Echo ────────────────────────────────────────────
const LearnFetalEcho = lazy(() => import("./pages/LearnFetalEcho"));

// ── iHeartEcho™ EchoAssist Pages ────────────────────────────────────────────
const IHeartEchoHome = lazy(() => import("./pages/iheartecho/IHeartEchoHome"));
const EchoAssist = lazy(() => import("./pages/iheartecho/EchoAssist"));
const EchoAssistHub = lazy(() => import("./pages/iheartecho/EchoAssistHub"));
const TTENavigator = lazy(() => import("./pages/iheartecho/TTENavigator"));
const TEENavigator = lazy(() => import("./pages/iheartecho/TEENavigator"));
const ICENavigator = lazy(() => import("./pages/iheartecho/ICENavigator"));
const DeviceNavigator = lazy(() => import("./pages/iheartecho/DeviceNavigator"));
const ACHDNavigator = lazy(() => import("./pages/iheartecho/ACHDNavigator"));
const ACHDEchoAssist = lazy(() => import("./pages/iheartecho/ACHDEchoAssist"));
const StressNavigator = lazy(() => import("./pages/iheartecho/StressNavigator"));
const StrainNavigator = lazy(() => import("./pages/iheartecho/StrainNavigator"));
const StrainScanCoach = lazy(() => import("./pages/iheartecho/StrainScanCoach"));
const TEEScanCoach = lazy(() => import("./pages/iheartecho/TEEScanCoach"));
const ICEScanCoach = lazy(() => import("./pages/iheartecho/ICEScanCoach"));
const UEANavigator = lazy(() => import("./pages/iheartecho/UEANavigator"));
const UEAScanCoach = lazy(() => import("./pages/iheartecho/UEAScanCoach"));
const HOCMNavigator = lazy(() => import("./pages/iheartecho/HOCMNavigator"));
const HOCMScanCoach = lazy(() => import("./pages/iheartecho/HOCMScanCoach"));
const StressScanCoach = lazy(() => import("./pages/iheartecho/StressScanCoach"));
const StressEchoAssistPage = lazy(() => import("./pages/iheartecho/StressEchoAssist"));
const StructuralHeartScanCoach = lazy(() => import("./pages/iheartecho/StructuralHeartScanCoach"));
const PulmHTNNavigator = lazy(() => import("./pages/iheartecho/PulmHTNNavigator"));
const DiastolicNavigator = lazy(() => import("./pages/iheartecho/DiastolicNavigator"));
const MechanicalSupportNavigator = lazy(() => import("./pages/iheartecho/MechanicalSupportNavigator"));
const MechanicalSupportScanCoach = lazy(() => import("./pages/iheartecho/MechanicalSupportScanCoach"));
const ECGNavigator = lazy(() => import("./pages/iheartecho/ECGNavigator"));
const ECGCoach = lazy(() => import("./pages/iheartecho/ECGCoach"));
const ECGAssist = lazy(() => import("./pages/iheartecho/ECGAssist"));
const HemodynamicsLab = lazy(() => import("./pages/iheartecho/HemodynamicsLab"));
const ReportBuilder = lazy(() => import("./pages/iheartecho/ReportBuilder"));
const GuidelinesAssist = lazy(() => import("./pages/iheartecho/GuidelinesAssist"));
const PediatricEchoAssist = lazy(() => import("./pages/iheartecho/PediatricEchoAssist"));
const ScanCoachIHE = lazy(() => import("./pages/iheartecho/ScanCoach"));
const EngagementDashboard = lazy(() => import("./pages/iheartecho/EngagementDashboard"));
const SoundBytesAdmin = lazy(() => import("./pages/iheartecho/SoundBytesAdmin"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const LabAdmin = lazy(() => import("./pages/iheartecho/LabAdmin"));
const EducatorAdmin = lazy(() => import("./pages/iheartecho/EducatorAdmin"));
const StudentDashboard = lazy(() => import("./pages/iheartecho/StudentDashboard"));
const StudentDashboardPage = lazy(() => import("./pages/StudentDashboardPage"));
const SoundBytesPage = lazy(() => import("./pages/SoundBytes"));

// ── CME Hub ─────────────────────────────────────────────────────────────────────────
const CMEHub = lazy(() => import("./pages/CMEHub"));

// ── Physician Over-Read (public, token-based) ─────────────────────────────────
const PhysicianOverReadForm = lazy(() => import("./pages/PhysicianOverReadForm"));

// ── Analytics Reporting ──────────────────────────────────────────────────────
const UserAnalytics = lazy(() => import("./pages/admin/UserAnalytics"));

function Router() {
  usePageViewTracker();
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <Suspense fallback={pageFallback}>
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
        <Route path="/my-dashboard" component={StudentDashboardPage} />

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
        <Route path="/learn/:slug/overview" component={CourseOverview} />
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
        {/* ── Physical Products ───────────────────────────────────────────────── */}
        <Route path="/products/:slug" component={ProductLanding} />
        <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ProductLandingPageBuilder /></RoleGuard>}</Route>

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
        <Route path="/p/:slug">{() => <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><StandaloneLandingPage /></Suspense>}</Route>

        {/* ── Physician Over-Read (public, token-based) ─────────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

/**
 * LMSRouter — Routes shown only on the learn subdomain.
 * Wraps all pages in LMSLayout with its own sidebar.
 */
function LMSRouter() {
  usePageViewTracker();
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <LMSLayout>
      <Suspense fallback={pageFallback}>
      <Switch>
        {/* LMS Home */}
        <Route path="/" component={LMSHome} />
        <Route path="/education-library" component={EducationLibrary} />
        <Route path="/collections/:id" component={CollectionDetail} />
        <Route path="/learn/:slug/player" component={CoursePlayer} />
        <Route path="/learn/:slug/overview" component={CourseOverview} />
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
        {/* ── Physical Products ───────────────────────────────────────────────── */}
        <Route path="/products/:slug" component={ProductLanding} />
        <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ProductLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>

        {/* Auth pages (needed for login flow) */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile" component={Profile} />
        <Route path="/my-dashboard" component={StudentDashboardPage} />

        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </LMSLayout>
  );
}

/**
 * IHeartEchoRouter — Routes shown only on the iHeartEcho subdomain.
 * Wraps all pages in Layout (which auto-detects iHeartEcho brand).
 */
function IHeartEchoRouter() {
  usePageViewTracker();
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <Suspense fallback={pageFallback}>
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
        <Route path="/my-dashboard" component={StudentDashboardPage} />

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
        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
      </Switch>
    </Suspense>
  );
}

/** Mounts the upgrade prompt only for free, authenticated, non-admin users */
function UpgradePromptWrapper() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  const isPremium = (user as any).isPremium === true;
  const isAdmin = (user as any).role === "admin";
  const eligible = !isPremium && !isAdmin;
  return <UpgradePrompt eligible={eligible} />;
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
              <UpgradePromptWrapper />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
