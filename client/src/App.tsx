/*
  UltrasoundAssist™ — All About Ultrasound™
  App Router — all routes for the UltrasoundAssist platform
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import MediaRedirect from "@/pages/MediaRedirect";
import { Route, Switch, useLocation, useParams } from "wouter";
import { HardRedirect } from "@/components/HardRedirect";
import { useEffect, lazy, Suspense } from "react";
import { trpc } from "./lib/trpc";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoModeBanner from "./components/DemoModeBanner";
import GetAppBanner from "./components/GetAppBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleGuard } from "@/components/RoleGuard";
import LMSLayout from "./components/LMSLayout";
import MembersLayout from "./components/MembersLayout";
import { isLearnDomain, isIHeartEchoDomain, isMembersDomain, isAccreditationDomain, LEARN_APP_URL, MEMBERS_APP_URL, ROOT_DOMAIN_URL } from "./hooks/useSubdomain";
import UpgradePrompt from "./components/UpgradePrompt";
import { SsoRedirect } from "./components/SsoRedirect";
import { useAuth } from "./_core/hooks/useAuth";
import { usePageViewTracker } from "./hooks/useAnalytics";
import { useSsoConsumer } from "./hooks/useSsoConsumer";
import { useCrossDomainSso } from "./hooks/useCrossDomainSso";
import { useSsoBridge } from "./hooks/useSsoBridge";
import PlatformAdmin from "./pages/PlatformAdmin";
import { perBrandAdminRouteElements, perBrandUserRouteElements } from "./routes/perBrandRouteHelpers";

// ── Core pages (eagerly loaded — tiny, always needed) ────────────────────────
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import MagicLinkRequest from "./pages/MagicLinkRequest";
import MagicLinkCallback from "./pages/MagicLinkCallback";
import MagicLinkError from "./pages/MagicLinkError";
import AccessLinkCallback from "./pages/AccessLinkCallback";
import Enrolled from "./pages/Enrolled";
import Unsubscribe from "./pages/Unsubscribe";

// ── All other pages — lazy loaded for code splitting ─────────────────────────
const Profile = lazy(() => import("./pages/Profile"));
const UpgradeSuccess = lazy(() => import("./pages/UpgradeSuccess"));
const Premium = lazy(() => import("./pages/Premium"));

// ── LMS — LMS Management ─────────────────────────────────────────────────
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutComplete = lazy(() => import("./pages/CheckoutComplete"));
const WorkshopCheckout = lazy(() => import("./pages/WorkshopCheckout"));
const EducationLibrary = lazy(() => import("./pages/EducationLibrary"));
const LMSHome = lazy(() => import("./pages/LMSHome"));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail"));
const CourseLanding = lazy(() => import("./pages/CourseLanding"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const CourseOverview = lazy(() => import("./pages/CourseOverview"));
const CohortSchedule = lazy(() => import("./pages/CohortSchedule"));
const AssignmentDetail = lazy(() => import("./pages/AssignmentDetail"));
const CohortReplayPlayer = lazy(() => import("./pages/CohortReplayPlayer"));
const LMSAdmin = lazy(() => import("./pages/admin/LMSAdmin"));
const LandingPageBuilder = lazy(() => import("./pages/admin/LandingPageBuilder"));
const FunnelBuilder = lazy(() => import("./pages/admin/FunnelBuilder"));
const FunnelPageEditor = lazy(() => import("./pages/admin/FunnelPageEditor"));
const ContactsAdmin = lazy(() => import("./pages/admin/ContactsAdmin"));
const CheckoutPageEditorPage = lazy(() => import("./pages/admin/CheckoutPageEditorPage"));
const AdminLessonComments = lazy(() => import("./pages/admin/AdminLessonComments"));
const SharingMonitor = lazy(() => import("./pages/admin/SharingMonitor"));
// Eager — marketing funnel pages must render outside the Router outer Suspense boundary.
import PublicFunnelPage from "./pages/PublicFunnelPage";
import StandaloneLandingPage from "./pages/StandaloneLandingPage";

// ── Digital Downloads ──────────────────────────────────────────────────────────
const DownloadsBrowse = lazy(() => import("./pages/DownloadsBrowse"));
// ── Workshops ────────────────────────────────────────────────────────────────
const WorkshopsBrowse = lazy(() => import("./pages/WorkshopsBrowse"));
const WorkshopDetail = lazy(() => import("./pages/WorkshopDetail"));
const WorkshopLanding = lazy(() => import("./pages/WorkshopLanding"));
const DownloadLanding = lazy(() => import("./pages/DownloadLanding"));
const DownloadFiles = lazy(() => import("./pages/DownloadFiles"));
const DownloadLandingPageBuilder = lazy(() => import("./pages/admin/DownloadLandingPageBuilder"));
const MembershipSalesPageBuilder = lazy(() => import("./pages/admin/MembershipSalesPageBuilder"));
const MembershipMemberPageBuilder = lazy(() => import("./pages/admin/MembershipMemberPageBuilder"));
const CommunitySalesPageBuilder = lazy(() => import("./pages/admin/CommunitySalesPageBuilder"));
const CommunityExperiencePageBuilder = lazy(() => import("./pages/admin/CommunityExperiencePageBuilder"));
const BundleLandingPageBuilder = lazy(() => import("./pages/admin/BundleLandingPageBuilder"));
const WebinarLandingPageBuilder = lazy(() => import("./pages/admin/WebinarLandingPageBuilder"));
const WebinarPlayerPageBuilder = lazy(() => import("./pages/admin/WebinarPlayerPageBuilder"));
const WorkshopLandingPageBuilder = lazy(() => import("./pages/admin/WorkshopLandingPageBuilder"));
const WorkshopInstanceLandingPageBuilder = lazy(() => import("./pages/admin/WorkshopInstanceLandingPageBuilder"));
const CohortGroupLandingPageBuilder = lazy(() => import("./pages/admin/CohortGroupLandingPageBuilder"));
const WidgetManager = lazy(() => import("./pages/admin/WidgetManager"));
const PrintfulAdmin = lazy(() => import("./pages/admin/PrintfulAdmin"));
const MerchStore = lazy(() => import("./pages/MerchStore"));
const WidgetRenderer = lazy(() => import("./pages/WidgetRenderer"));
const MyDownloads = lazy(() => import("./pages/MyDownloads"));
const BundleLanding = lazy(() => import("./pages/BundleLanding"));
const ProductLanding = lazy(() => import("./pages/ProductLanding"));
const ProductsListing = lazy(() => import("./pages/ProductsListing"));
const ProductLandingPageBuilder = lazy(() => import("./pages/admin/ProductLandingPageBuilder"));

// ── UltrasoundAssist™ Hub ────────────────────────────────────────────────────
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const InstructorPortal = lazy(() => import("./pages/InstructorPortal"));
const TeachDashboard = lazy(() => import("./pages/teach/TeachDashboard"));
const TeachPresentationEditor = lazy(() => import("./pages/teach/TeachPresentationEditor"));
const TeachMasterDesigner = lazy(() => import("./pages/teach/TeachMasterDesigner"));
const TeachPresenter = lazy(() => import("./pages/teach/TeachPresenter"));
const TeachPresenterNotes = lazy(() => import("./pages/teach/TeachPresenterNotes"));
const AffiliateRedirect = lazy(() => import("./pages/AffiliateRedirect"));
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
const GeneralFormBuilder = lazy(() => import("./pages/admin/GeneralFormBuilder"));
const GeneralFormAnalyticsDashboard = lazy(() => import("./pages/admin/GeneralFormAnalyticsDashboard"));
const PublicFormRenderer = lazy(() => import("./pages/PublicFormRenderer"));
const PublicFormAnalyticsReport = lazy(() => import("./pages/PublicFormAnalyticsReport"));
const PublicFormAnalyticsDashboard = lazy(() => import("./pages/PublicFormAnalyticsDashboard"));
const EmailAdmin = lazy(() => import("./pages/EmailAdmin"));
const EmailCampaignDashboard = lazy(() => import("./pages/EmailCampaignDashboard"));
const EducatorAssist = lazy(() => import("./pages/EducatorAssist"));
const SonoQuizCreator = lazy(() => import("./pages/SonoQuizCreator"));
const SonoQuizHost = lazy(() => import("./pages/SonoQuizHost"));
const SonoQuizPlay = lazy(() => import("./pages/SonoQuizPlay"));
const ImageQualityReview = lazy(() => import("./pages/ImageQualityReview"));
// ── Standalone Quiz Creator ───────────────────────────────────────────────────
const QuizCreatorAdmin = lazy(() => import("./pages/admin/QuizCreatorAdmin"));
const StandaloneQuizPlayer = lazy(() => import("./pages/StandaloneQuizPlayer"));
const StandaloneQuizResults = lazy(() => import("./pages/StandaloneQuizResults"));
const StudentQuizDashboard = lazy(() => import("./pages/StudentQuizDashboard"));

// ── DIY Accreditation™ (hidden, backend use) ──────────────────────────────────
const DIYMemberPortal = lazy(() => import("./pages/DIYMemberPortal"));
const DIYAccreditationPlans = lazy(() => import("./pages/DIYAccreditationPlans"));
const DIYRegister = lazy(() => import("./pages/DIYRegister"));
const AccreditationNavigator = lazy(() => import("./pages/AccreditationNavigator"));
const AccreditationTool = lazy(() => import("./pages/AccreditationTool"));
const AccreditationManager = lazy(() => import("./pages/AccreditationManager"));
const AccreditationReadiness = lazy(() => import("./pages/AccreditationReadiness"));
const DIYAccreditationAdmin = lazy(() => import("./pages/admin/DIYAccreditationAdmin"));
const DIYAccreditationLanding = lazy(() => import("./pages/DIYAccreditationLanding"));

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
const MyTeamPage = lazy(() => import("./pages/MyTeamPage"));
const SoundBytesPage = lazy(() => import("./pages/SoundBytes"));

// ── CME Hub ─────────────────────────────────────────────────────────────────────────
const CMEHub = lazy(() => import("./pages/CMEHub"));

// ── Physician Over-Read (public, token-based) ─────────────────────────────────
const PhysicianOverReadForm = lazy(() => import("./pages/PhysicianOverReadForm"));

// ── Analytics Reporting ──────────────────────────────────────────────────────
const UserAnalytics = lazy(() => import("./pages/admin/UserAnalytics"));
const AdminUserDetailPage = lazy(() => import("./pages/admin/AdminUserDetailPage"));
const AdminSalesPage = lazy(() => import("./pages/admin/AdminSalesPage"));
const AdminSalesDashboard = lazy(() => import("./pages/admin/AdminSalesDashboard"));
const AdminDiscountCodesPage = lazy(() => import("./pages/admin/AdminDiscountCodesPage"));
const FulfillmentAdmin = lazy(() => import("./pages/admin/FulfillmentAdmin"));
const MembershipAdmin = lazy(() => import("./pages/admin/MembershipAdmin"));
const SdmsCmeExportPage = lazy(() => import("./pages/admin/SdmsCmeExportPage"));
const MembershipPage = lazy(() => import("./pages/MembershipPage"));
const MyMemberships = lazy(() => import("./pages/MyMemberships"));
const MembersHub = lazy(() => import("./pages/admin/MembersHub"));
const ProductAnalytics = lazy(() => import("./pages/admin/ProductAnalytics"));
// ── Community ─────────────────────────────────────────────────────────────────
const CommunityHub = lazy(() => import("./pages/Community"));
const CommunityFeed = lazy(() => import("./pages/CommunityFeed"));
const CommunityProfile = lazy(() => import("./pages/CommunityProfile"));
const CommunityDMs = lazy(() => import("./pages/CommunityDMs"));
const CommunityLeaderboard = lazy(() => import("./pages/CommunityLeaderboard"));
const CommunityAdmin = lazy(() => import("./pages/admin/CommunityAdmin"));
const CareerNetwork = lazy(() => import("./pages/CareerNetwork"));
const CareerProfile = lazy(() => import("./pages/CareerProfile"));
const CareerNetworkAdmin = lazy(() => import("./pages/admin/CareerNetworkAdmin"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));

function LearnAdminRedirect({ rest }: { rest?: string }) {
  return <HardRedirect to={`${LEARN_APP_URL}/admin/${rest ?? ""}`} />;
}

function Router() {
  usePageViewTracker();
  useCrossDomainSso(); // Silently sign user into all other domains as free member
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  const routeSwitch = (
      <Switch>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/magic-link/callback" component={MagicLinkCallback} />
        {/* /auth/magic is the legacy URL sent in magic link emails (client-side verify) */}
        <Route path="/auth/magic" component={MagicLinkCallback} />
        {/* /auth/magic-error is shown when the server-side GET verify fails */}
        <Route path="/auth/magic-error" component={MagicLinkError} />
        {/* /auth/access is used in purchase/access emails — persistent reusable token */}
        <Route path="/auth/access" component={AccessLinkCallback} />
        <Route path="/enrolled" component={Enrolled} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/upgrade-success" component={UpgradeSuccess} />
        <Route path="/premium" component={Premium} />
        <Route path="/profile" component={Profile} />
        <Route path="/my-dashboard" component={StudentDashboardPage} />
        <Route path="/my-team" component={MyTeamPage} />
        <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
        <Route path="/ref/:slug" component={AffiliateRedirect} />

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
        {perBrandUserRouteElements([
          { base: "/quickfire", component: QuickFire },
          { base: "/soundbytes", component: SoundBytes },
        ])}
        <Route path="/flashcards" component={FlashcardDeck} />
        <Route path="/case-library" component={CaseLibrary} />
        <Route path="/registry-review" component={RegistryReviewHub} />
        <Route path="/cme" component={CMEHub} />
        <Route path="/case-library/submit" component={SubmitCase} />
        <Route path="/case-library/edit/:id" component={SubmitCase} />
        <Route path="/case-library/:id" component={CaseDetail} />

        {/* ── LMS — LMS Management ─────────────────────────────────────────────── */}
        <Route path="/education-library">{() => { window.location.replace(`${LEARN_APP_URL}/education-library`); return null; }}</Route>
        {/* collections → learn subdomain (authenticated access) */}
        <Route path="/collections/:id">{(params: { id: string }) => <SsoRedirect path={`/collections/${params.id}`} />}</Route>
        {/* Course player/overview → learn subdomain; landing → root domain */}
        <Route path="/courses/:slug/player">{(params: { slug: string }) => <SsoRedirect path={`/courses/${params.slug}/player`} />}</Route>
        <Route path="/courses/:slug/overview">{(params: { slug: string }) => <SsoRedirect path={`/courses/${params.slug}/overview`} />}</Route>
        <Route path="/courses/:slug">{(params: { slug: string }) => { window.location.replace(`${LEARN_APP_URL}/courses/${params.slug}`); return null; }}</Route>
          {/* ── Digital Downloads ────────────────────────────────────────────────────────────────────────────── */}
        {/* my-downloads → members subdomain; files → learn subdomain; landing → root domain */}
        <Route path="/my-downloads">{() => <SsoRedirect path="/my-downloads" targetOrigin={MEMBERS_APP_URL} />}</Route>
        <Route path="/downloads/:slug/files">{(params: { slug: string }) => <SsoRedirect path={`/downloads/${params.slug}/files`} />}</Route>
        <Route path="/downloads/:slug" component={DownloadLanding} />
        <Route path="/downloads" component={DownloadsBrowse} />
        <Route path="/bundles/:slug" component={BundleLanding} />
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/checkout-editor/:entityType/:entityId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><CheckoutPageEditorPage /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/lesson-comments">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminLessonComments /></RoleGuard>}</Route>
        <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DownloadLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/memberships/:planId/sales-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MembershipSalesPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/memberships/:planId/member-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MembershipMemberPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/communities/:communityId/sales-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CommunitySalesPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/communities/:communityId/experience-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CommunityExperiencePageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/bundles/:bundleId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><BundleLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/webinars/:webinarId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WebinarLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/webinars/:webinarId/player-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WebinarPlayerPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><WorkshopDetail /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/instances/:instanceId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopInstanceLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/cohorts/:cohortGroupId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CohortGroupLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/widgets">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><WidgetManager /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/printful">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><PrintfulAdmin /></Suspense></RoleGuard>}</Route>
        <Route path="/widget/:token">{() => <Suspense fallback={<div />}><WidgetRenderer /></Suspense>}</Route>
        <Route path="/merch">{() => <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MerchStore /></Suspense>}</Route>
        {/* ── Physical Products ────────────────────────────────────────────────────────────────────────────── */}
        {/* Products listing page */}
        <Route path="/products">{() => <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ProductsListing /></Suspense>}</Route>
        {/* Product landing → root domain */}
        <Route path="/product/:slug" component={ProductLanding} />
        <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ProductLandingPageBuilder /></RoleGuard>}</Route>

        {/* ── Career Network ─────────────────────────────────────────────────── */}
        <Route path="/career-network" component={CareerNetwork} />
        <Route path="/careernetwork" component={CareerNetwork} />
        <Route path="/career/profile">{() => <CareerProfile defaultTab="profile" />}</Route>
        <Route path="/career/resumes">{() => <CareerProfile defaultTab="resumes" />}</Route>
        <Route path="/career/applications">{() => <CareerProfile defaultTab="applications" />}</Route>
        <Route path="/admin/career-network">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CareerNetworkAdmin /></RoleGuard>}</Route>
        <Route path="/employer/dashboard" component={EmployerDashboard} />
        <Route path="/employer" component={EmployerDashboard} />

        {/* ── Admin ───────────────────────────────────────────────────────────── */}
        <Route path="/admin/community">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><CommunityAdmin /></Suspense></RoleGuard>}</Route>
        {perBrandAdminRouteElements([
          { base: "/admin/cases", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard> },
          { base: "/admin/quickfire", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard> },
          { base: "/admin/challenge-cards", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard> },
          { base: "/admin/social-content", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SocialContentGenerator /></RoleGuard> },
          { base: "/admin/scancoach", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard> },
          { base: "/admin/navigator", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard> },
          { base: "/admin/thinkific-webhook", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard> },
          { base: "/admin/soundbytes", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SoundBytesAdmin /></RoleGuard> },
        ])}
        <Route path="/admin/funnels">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId/pages/:pageId/edit">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelPageEditor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/contacts">{() => { window.location.replace("/admin/funnels?tab=contacts"); return null; }}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/general-forms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        <Route path="/admin/general-forms/analytics-dashboard">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormAnalyticsDashboard /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/general-forms/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        {/* ── Public Form Renderer (no auth required) ──────────────────────── */}
        <Route path="/forms/:slug">{() => <PublicFormRenderer />}</Route>
        <Route path="/forms/:slug/embed">{() => <PublicFormRenderer isEmbed />}</Route>
        <Route path="/forms/:slug/preview">{() => <PublicFormRenderer isPreview />}</Route>
      <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
      <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
        <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EmailAdmin /></RoleGuard>}</Route>
        <Route path="/admin/email-campaigns">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><EmailCampaignDashboard /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/sharing-monitor">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SharingMonitor /></Suspense></RoleGuard>}</Route>
        {/* ── Unified Members Hub (replaces scattered user/sales/membership pages) ── */}
        <Route path="/admin/members">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MembersHub /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/product-analytics">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ProductAnalytics /></Suspense></RoleGuard>}</Route>
        {/* Legacy redirects — keep old URLs working */}
        <Route path="/admin/user-analytics">{() => { window.location.replace("/admin/members?tab=members"); return null; }}</Route>
        <Route path="/admin/users/:userId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminUserDetailPage /></RoleGuard>}</Route>
        <Route path="/admin/sales">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/sales-dashboard">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/discount-codes">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminDiscountCodesPage /></RoleGuard>}</Route>
        <Route path="/admin/fulfillment">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FulfillmentAdmin /></RoleGuard>}</Route>
        <Route path="/admin/sdms-cme-export">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SdmsCmeExportPage /></RoleGuard>}</Route>
        <Route path="/admin/activity-log">{() => { window.location.replace("/admin/members?tab=activity"); return null; }}</Route>
        <Route path="/admin/memberships">{() => { window.location.replace("/admin/members?tab=memberships"); return null; }}</Route>
        <Route path="/admin">{() => { window.location.replace("/platform-admin"); return null; }}</Route>
        <Route path="/admin/diy-accreditation">{() => <RoleGuard roles={["diy_admin", "platform_admin", "accreditation_manager"]} allowAdmin={true}><DIYAccreditationAdmin /></RoleGuard>}</Route>
        <Route path="/educator-assist">{() => <EducatorAssist />}</Route>
        {/* ── SonoQuiz (admin-only during testing) ──────────────────────── */}
        <Route path="/admin/sonoquiz">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SonoQuizCreator /></RoleGuard>}</Route>
        <Route path="/admin/sonoquiz/host/:sessionId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SonoQuizHost /></RoleGuard>}</Route>
        <Route path="/quiz/:joinCode">{() => <SonoQuizPlay />}</Route>
        <Route path="/image-quality-review">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ImageQualityReview /></RoleGuard>}</Route>
        {/* ── Standalone Quiz Creator ────────────────────────────────────────────────── */}
        <Route path="/admin/quiz-creator">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuizCreatorAdmin /></RoleGuard>}</Route>
        <Route path="/admin/quiz-creator/:quizId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuizCreatorAdmin /></RoleGuard>}</Route>
        <Route path="/quizzes/:quizId">{() => <StandaloneQuizPlayer />}</Route>
        <Route path="/quizzes/:quizId/results/:attemptId">{() => <StandaloneQuizResults />}</Route>
        <Route path="/my-quizzes">{() => <StudentQuizDashboard />}</Route>

        {/* ── DIY Accreditation™ (hidden backend) ───────────────────────── */}
        <Route path="/diy-accreditation-plans" component={DIYAccreditationPlans} />
        <Route path="/diy-register" component={DIYRegister} />
        <Route path="/diy-member">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><DIYMemberPortal /></RoleGuard>}</Route>
        <Route path="/accreditation-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AccreditationNavigator /></RoleGuard>}</Route>
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/accreditation-manager">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AccreditationManager /></RoleGuard>}</Route>

        {/* ── Membership Public Pages ───────────────────────────────── */}
        <Route path="/memberships/:slug">{() => <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MembershipPage /></Suspense>}</Route>
        <Route path="/my-memberships/:slug">{() => <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MyMemberships /></Suspense>}</Route>
        <Route path="/my-memberships">{() => <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MyMemberships /></Suspense>}</Route>

        {/* ── Admin catch-all: any /admin/* not explicitly listed above → redirect to learn domain ── */}
        <Route path="/admin/:rest*">{(params: { rest?: string }) => <LearnAdminRedirect rest={params.rest} />}</Route>

        {/* ── Physician Over-Read (public, token-based) ─────────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
        <Route path="/404" component={NotFound} />
        <Route path="/terms" component={() => { window.location.replace("https://www.allaboutultrasound.com/terms-of-service.html"); return null; }} />
        <Route path="/privacy" component={() => { window.location.replace("https://www.allaboutultrasound.com/privacy-policy.html"); return null; }} />
        <Route path="/contact" component={() => { window.location.replace("https://www.allaboutultrasound.com/contact.html"); return null; }} />
        {/* ── Public Funnel Pages (catch-all — must be last before NotFound) ── */}
        <Route path="/p/:slug">{() => <StandaloneLandingPage />}</Route>
        <Route path="/:slug/:pageSlug">{() => <PublicFunnelPageRoute />}</Route>
        <Route path="/:slug">{() => <FunnelRootRedirect />}</Route>
        <Route component={NotFound} />
      </Switch>
  );
  return <Suspense fallback={pageFallback}>{routeSwitch}</Suspense>;
}

/** MembersRouter — Routes for members.allaboutultrasound.com (profile/dashboard/subscriptions hub) */
function MembersRouter() {
  usePageViewTracker();
  useSsoConsumer();
  useSsoBridge();   // Redirect-based SSO fallback when img-tag ping was blocked
  useCrossDomainSso();
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <Switch>
      {/* Redirect all course/education/admin routes to the app (learn) subdomain */}
      <Route path="/downloads/:slug/files">{(params: { slug: string }) => { window.location.replace(`${LEARN_APP_URL}/downloads/${params.slug}/files`); return null; }}</Route>
      <Route path="/courses/:slug/player">{(params: { slug: string }) => { window.location.replace(`${LEARN_APP_URL}/courses/${params.slug}/player`); return null; }}</Route>
      <Route path="/courses/:slug/overview">{(params: { slug: string }) => { window.location.replace(`${LEARN_APP_URL}/courses/${params.slug}/overview`); return null; }}</Route>
      <Route path="/courses/:slug">{(params: { slug: string }) => { window.location.replace(`${LEARN_APP_URL}/courses/${params.slug}`); return null; }}</Route>
      <Route path="/education-library">{() => { window.location.replace(`${LEARN_APP_URL}/education-library`); return null; }}</Route>
      {/* ── Admin routes served directly on app.allaboutultrasound.com ── */}
      <Route path="/admin/members">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MembersHub /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/product-analytics">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ProductAnalytics /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/sales">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
      <Route path="/admin/sales-dashboard">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
      <Route path="/admin/user-analytics">{() => { window.location.replace("/admin/members?tab=members"); return null; }}</Route>
      <Route path="/admin/memberships">{() => { window.location.replace("/admin/members?tab=memberships"); return null; }}</Route>
      <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MembersLayout><PlatformAdmin /></MembersLayout></RoleGuard>}</Route>
      {/* Redirect remaining /admin/* routes to learn subdomain — explicit routes before catch-all */}
      <Route path="/admin/lms">{() => { window.location.replace(`${LEARN_APP_URL}/admin/lms`); return null; }}</Route>
      <Route path="/admin/lms/:rest*">{(params: { rest?: string }) => { window.location.replace(`${LEARN_APP_URL}/admin/lms/${params.rest ?? ""}`); return null; }}</Route>
      {/* Admin user detail — must be before the catch-all so it renders on app.allaboutultrasound.com */}
      <Route path="/admin/users/:userId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><AdminUserDetailPage /></Suspense></RoleGuard>}</Route>
      {/* Form builder routes — served on app domain, must be before catch-all */}
      <Route path="/admin/general-forms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/general-forms/analytics-dashboard">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormAnalyticsDashboard /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/general-forms/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FormBuilderAdmin /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FormBuilderAdmin /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/activity-log">{() => { window.location.replace("/admin/members?tab=activity"); return null; }}</Route>
      {/* All app-domain admin routes — must be before the learn catch-all */}
      <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><MediaRepository /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><EmailAdmin /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/email-campaigns">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><EmailCampaignDashboard /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/funnels/:funnelId/pages/:pageId/edit">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelPageEditor /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/funnels/:funnelId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/funnels">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/contacts">{() => { window.location.replace("/admin/funnels?tab=contacts"); return null; }}</Route>
      {perBrandAdminRouteElements([
        { base: "/admin/cases", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard> },
        { base: "/admin/quickfire", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard> },
        { base: "/admin/challenge-cards", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard> },
        { base: "/admin/social-content", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SocialContentGenerator /></RoleGuard> },
        { base: "/admin/scancoach", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard> },
        { base: "/admin/navigator", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard> },
        { base: "/admin/thinkific-webhook", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard> },
        { base: "/admin/soundbytes", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SoundBytesAdmin /></RoleGuard> },
      ])}
      <Route path="/admin/diy-accreditation">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DIYAccreditationAdmin /></RoleGuard>}</Route>
      <Route path="/admin/discount-codes">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><AdminDiscountCodesPage /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/sharing-monitor">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SharingMonitor /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/sonoquiz/host/:sessionId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SonoQuizHost /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/sonoquiz">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SonoQuizCreator /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/quiz-creator">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuizCreatorAdmin /></RoleGuard>}</Route>
      <Route path="/admin/quiz-creator/:quizId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuizCreatorAdmin /></RoleGuard>}</Route>
      <Route path="/quizzes/:quizId">{() => <StandaloneQuizPlayer />}</Route>
      <Route path="/quizzes/:quizId/results/:attemptId">{() => <StandaloneQuizResults />}</Route>
      <Route path="/my-quizzes">{() => <StudentQuizDashboard />}</Route>
      <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><DownloadLandingPageBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ProductLandingPageBuilder /></Suspense></RoleGuard>}</Route>
      <Route path="/admin/:rest*">{(params: { rest?: string }) => { window.location.replace(`${LEARN_APP_URL}/admin/${params.rest ?? ""}`); return null; }}</Route>
      {/* ── Public Form Renderer — outside MembersLayout (full-screen, no nav) ── */}
      <Route path="/forms/:slug">{() => <PublicFormRenderer />}</Route>
      <Route path="/forms/:slug/embed">{() => <PublicFormRenderer isEmbed />}</Route>
      <Route path="/forms/:slug/preview">{() => <PublicFormRenderer isPreview />}</Route>
      <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
      <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
      {/* ── Members-only routes (user profile / dashboard hub) ─────────── */}
      <Route>
        <MembersLayout>
          <Suspense fallback={pageFallback}>
            <Switch>
              <Route path="/my-dashboard" component={StudentDashboardPage} />
        <Route path="/my-team" component={MyTeamPage} />
        <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
        <Route path="/instructor-portal" component={InstructorPortal} />
        <Route path="/teach" component={TeachDashboard} />
        <Route path="/teach/master/:id/design" component={TeachMasterDesigner} />
        <Route path="/teach/presentation/:id/edit" component={TeachPresentationEditor} />
        <Route path="/teach/presentation/:id/present" component={TeachPresenter} />
        <Route path="/teach/presentation/:id/notes" component={TeachPresenterNotes} />
        <Route path="/ref/:slug" component={AffiliateRedirect} />
              <Route path="/profile">{() => { window.location.replace("/my-dashboard?tab=profile"); return null; }}</Route>
              <Route path="/my-downloads" component={MyDownloads} />
              <Route path="/downloads" component={DownloadsBrowse} />
              {/* Auth */}
              <Route path="/login" component={Login} />
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/reset-password" component={ResetPassword} />
              <Route path="/magic-link" component={MagicLinkRequest} />
              <Route path="/auth/magic" component={MagicLinkCallback} />
              <Route path="/auth/access" component={AccessLinkCallback} />
              <Route path="/register" component={Register} />
              {/* Default: redirect to dashboard */}
              <Route>{() => { window.location.replace("/my-dashboard"); return null; }}</Route>
            </Switch>
          </Suspense>
        </MembersLayout>
      </Route>
    </Switch>
  );
}

/**
 * LMSRouter — Routes shown only on the learn subdomain.
 * CoursePlayer is rendered outside LMSLayout (full-screen, no sidebar).
 * All other pages are wrapped in LMSLayout with its own sidebar.
 */
function LMSRouter() {
  usePageViewTracker();
  useSsoConsumer(); // Exchange ?sso=TOKEN for a session cookie on arrival from app.
  useCrossDomainSso(); // Silently sign user into all other domains as free member
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <Switch>
      {/* ── Player/access routes — no LMSLayout header/sidebar ───────────── */}
      <Route path="/courses/:slug/player">
        <Suspense fallback={pageFallback}>
          <CoursePlayer />
        </Suspense>
      </Route>
      <Route path="/downloads/:slug/files" component={DownloadFiles} />
      {/* Hosted checkout pages — outside LMSLayout (full-screen, no nav) */}
      <Route path="/checkout/complete">
        <Suspense fallback={pageFallback}><CheckoutComplete /></Suspense>
      </Route>
      <Route path="/checkout/workshop/:slug">
        <Suspense fallback={pageFallback}><WorkshopCheckout /></Suspense>
      </Route>
      <Route path="/checkout/:slug">
        <Suspense fallback={pageFallback}><Checkout /></Suspense>
      </Route>
      {/* Course/download landing pages render directly on learn subdomain */}
      <Route path="/cohort/:courseId/assignment/:assignmentId" component={AssignmentDetail} />
      <Route path="/cohort/:courseId/replay/:recordingId" component={CohortReplayPlayer} />
      <Route path="/cohort/:courseId" component={CohortSchedule} />
      <Route path="/courses/:slug" component={CourseLanding} />
      <Route path="/downloads/:slug" component={DownloadLanding} />
      <Route path="/products">{() => <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><ProductsListing /></Suspense>}</Route>
      <Route path="/product/:slug" component={ProductLanding} />
      <Route path="/bundles/:slug" component={BundleLanding} />
      {/* ── Public Form Renderer — outside LMSLayout (full-screen, no nav) ── */}
      <Route path="/forms/:slug">{() => <PublicFormRenderer />}</Route>
      <Route path="/forms/:slug/embed">{() => <PublicFormRenderer isEmbed />}</Route>
      <Route path="/forms/:slug/preview">{() => <PublicFormRenderer isPreview />}</Route>
      <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
      <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
      {/* All other LMS routes — wrapped in LMSLayout */}
      <Route>
        <LMSLayout>
          <Suspense fallback={pageFallback}>
          <Switch>
            {/* LMS Home */}
            <Route path="/" component={LMSHome} />
            {/* Community — specific routes MUST come before /community/:slug wildcard */}
            <Route path="/community" component={CommunityHub} />
            <Route path="/community/spaces/:spaceId/channels/:channelId" component={CommunityFeed} />
            <Route path="/community/spaces/:spaceId" component={CommunityFeed} />
            <Route path="/community/members/:userId" component={CommunityProfile} />
            <Route path="/community/dms/c/:conversationId" component={CommunityDMs} />
            <Route path="/community/dms/:userId" component={CommunityDMs} />
            <Route path="/community/dms" component={CommunityDMs} />
            <Route path="/community/leaderboard" component={CommunityLeaderboard} />
            <Route path="/community/:slug" component={CommunityFeed} />
            <Route path="/admin/community">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CommunityAdmin /></RoleGuard>}</Route>
            <Route path="/education-library" component={EducationLibrary} />
            <Route path="/collections/:id" component={CollectionDetail} />
            <Route path="/courses/:slug/overview" component={CourseOverview} />

        {/* Digital Downloads */}
        <Route path="/my-downloads" component={MyDownloads} />
        <Route path="/downloads" component={DownloadsBrowse} />

        {/* Workshops */}
        <Route path="/workshops" component={WorkshopsBrowse} />
        <Route path="/workshops/:slug" component={WorkshopLanding} />
        <Route path="/bundles/:slug" component={BundleLanding} />

        {/* ── Career Network ─────────────────────────────────────────────── */}
        <Route path="/career-network" component={CareerNetwork} />
        <Route path="/careernetwork" component={CareerNetwork} />
        <Route path="/career/profile">{() => <CareerProfile defaultTab="profile" />}</Route>
        <Route path="/career/resumes">{() => <CareerProfile defaultTab="resumes" />}</Route>
        <Route path="/career/applications">{() => <CareerProfile defaultTab="applications" />}</Route>
        <Route path="/admin/career-network">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CareerNetworkAdmin /></RoleGuard>}</Route>

        {/* Admin (platform_admin only) */}
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/checkout-editor/:entityType/:entityId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><CheckoutPageEditorPage /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/lesson-comments">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminLessonComments /></RoleGuard>}</Route>
        <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DownloadLandingPageBuilder /></RoleGuard>}</Route>
        {/* ── Physical Products ───────────────────────────────────────────────── */}
        <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ProductLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><WorkshopDetail /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/instances/:instanceId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopInstanceLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/cohorts/:cohortGroupId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CohortGroupLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/webinars/:webinarId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WebinarLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/bundles/:bundleId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><BundleLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/memberships/:planId/sales-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MembershipSalesPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/memberships/:planId/member-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MembershipMemberPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/communities/:communityId/sales-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CommunitySalesPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/communities/:communityId/experience-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CommunityExperiencePageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/memberships">{() => { window.location.replace("/admin/members?tab=memberships"); return null; }}</Route>
                <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/contacts">{() => { window.location.replace("/admin/funnels?tab=contacts"); return null; }}</Route>
        <Route path="/admin/sharing-monitor">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SharingMonitor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/user-analytics">{() => { window.location.replace("/admin/members?tab=members"); return null; }}</Route>
        <Route path="/admin/users/:userId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminUserDetailPage /></RoleGuard>}</Route>
        <Route path="/admin/sales">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/sales-dashboard">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/discount-codes">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminDiscountCodesPage /></RoleGuard>}</Route>
        <Route path="/admin/activity-log">{() => { window.location.replace("/admin/members?tab=activity"); return null; }}</Route>
        {/* Form builder routes on learn domain */}
        <Route path="/admin/general-forms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        <Route path="/admin/general-forms/analytics-dashboard">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormAnalyticsDashboard /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/general-forms/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        {/* Auth pages (needed for login flow) */}
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/auth/magic" component={MagicLinkCallback} />
        <Route path="/auth/access" component={AccessLinkCallback} />
        <Route path="/register" component={Register} />
        {/* /profile redirects to dashboard profile tab */}
        <Route path="/profile">{() => { window.location.replace("/my-dashboard?tab=profile"); return null; }}</Route>
        <Route path="/my-dashboard" component={StudentDashboardPage} />
        <Route path="/my-team" component={MyTeamPage} />
        <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
        <Route path="/instructor-portal" component={InstructorPortal} />
        <Route path="/memberships/:slug">{() => <Suspense fallback={pageFallback}><MembershipPage /></Suspense>}</Route>
        <Route path="/my-memberships/:slug">{() => <Suspense fallback={pageFallback}><MyMemberships /></Suspense>}</Route>
        <Route path="/my-memberships">{() => <Suspense fallback={pageFallback}><MyMemberships /></Suspense>}</Route>
        <Route path="/teach" component={TeachDashboard} />
        <Route path="/teach/master/:id/design" component={TeachMasterDesigner} />
        <Route path="/teach/presentation/:id/edit" component={TeachPresentationEditor} />
        <Route path="/teach/presentation/:id/present" component={TeachPresenter} />
        <Route path="/teach/presentation/:id/notes" component={TeachPresenterNotes} />
        <Route path="/ref/:slug" component={AffiliateRedirect} />
        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
            {/* Fallback */}
            <Route path="/privacy" component={() => { window.location.replace("https://www.allaboutultrasound.com/privacy-policy.html"); return null; }} />
            <Route path="/contact" component={() => { window.location.replace("https://www.allaboutultrasound.com/contact.html"); return null; }} />
            {/* Funnel pages — catch-all last */}
            <Route path="/p/:slug">{() => <StandaloneLandingPage />}</Route>
            <Route path="/:slug/:pageSlug">{() => <PublicFunnelPageRoute />}</Route>
            <Route path="/:slug"><FunnelRootRedirect /></Route>
            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </LMSLayout>
      </Route>
    </Switch>
  );
}

/**
 * IHeartEchoRouter — Routes shown only on the iHeartEcho subdomain.
 * Wraps all pages in Layout (which auto-detects iHeartEcho brand).
 */
function IHeartEchoRouter() {
  usePageViewTracker();
  useSsoConsumer(); // Exchange ?sso=TOKEN for a session cookie on arrival from AAU
  useSsoBridge();   // Redirect-based SSO fallback when img-tag ping was blocked
  useCrossDomainSso(); // Silently sign user into all other domains as free member
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
  const routeSwitch = (
      <Switch>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/" component={IHeartEchoHome} />
        <Route path="/login" component={Login} />
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/auth/magic" component={MagicLinkCallback} />
        <Route path="/auth/access" component={AccessLinkCallback} />
        <Route path="/enrolled" component={Enrolled} />
        <Route path="/unsubscribe" component={Unsubscribe} />
        <Route path="/upgrade-success" component={UpgradeSuccess} />
        <Route path="/premium" component={Premium} />
        <Route path="/profile" component={Profile} />
        <Route path="/my-dashboard" component={StudentDashboardPage} />
        <Route path="/my-team" component={MyTeamPage} />
        <Route path="/affiliate-dashboard" component={AffiliateDashboard} />
        <Route path="/ref/:slug" component={AffiliateRedirect} />

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
        <Route path="/achd-echo-assist">{() => <ACHDEchoAssist />}</Route>
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
        {perBrandUserRouteElements([
          { base: "/quickfire", component: QuickFire },
          { base: "/soundbytes", component: SoundBytesPage },
        ])}
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/flashcards" component={FlashcardDeck} />
        <Route path="/case-library" component={CaseLibrary} />
        <Route path="/case-library/submit" component={SubmitCase} />
        <Route path="/case-library/edit/:id" component={SubmitCase} />
        <Route path="/case-library/:id" component={CaseDetail} />
        <Route path="/registry-review" component={RegistryReviewHub} />
        <Route path="/cme" component={CMEHub} />

        {/* ── DIY Accreditation™ ─────────────────────────────────────── */}
        <Route path="/diy-accreditation-plans" component={DIYAccreditationPlans} />
        <Route path="/diy-register" component={DIYRegister} />
        <Route path="/diy-member">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><DIYMemberPortal /></RoleGuard>}</Route>
        <Route path="/accreditation-navigator">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]} teaserHeight={0}><AccreditationNavigator /></RoleGuard>}</Route>
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false} teaserHeight={0}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_admin"]} allowAdmin={false}><LabAdmin /></RoleGuard>}</Route>

        {/* ── Career Network ─────────────────────────────────────────────────── */}
        <Route path="/career-network" component={CareerNetwork} />
        <Route path="/careernetwork" component={CareerNetwork} />
        <Route path="/career/profile">{() => <CareerProfile defaultTab="profile" />}</Route>
        <Route path="/career/resumes">{() => <CareerProfile defaultTab="resumes" />}</Route>
        <Route path="/career/applications">{() => <CareerProfile defaultTab="applications" />}</Route>
        <Route path="/admin/career-network">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CareerNetworkAdmin /></RoleGuard>}</Route>

        {/* ── Admin ──────────────────────────────────────────────────── */}
        {perBrandAdminRouteElements([
          { base: "/admin/cases", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard> },
          { base: "/admin/quickfire", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard> },
          { base: "/admin/scancoach", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard> },
          { base: "/admin/navigator", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard> },
          { base: "/admin/soundbytes", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SoundBytesAdmin /></RoleGuard> },
          { base: "/admin/thinkific-webhook", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard> },
          { base: "/admin/challenge-cards", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard> },
          { base: "/admin/social-content", render: () => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><SocialContentGenerator /></RoleGuard> },
        ])}
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/general-forms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        <Route path="/admin/general-forms/analytics-dashboard">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><GeneralFormAnalyticsDashboard /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/general-forms/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><GeneralFormBuilder /></RoleGuard>}</Route>
        {/* ── Public Form Renderer (no auth required) ──────────────────────── */}
        <Route path="/forms/:slug">{() => <PublicFormRenderer />}</Route>
        <Route path="/forms/:slug/embed">{() => <PublicFormRenderer isEmbed />}</Route>
        <Route path="/forms/:slug/preview">{() => <PublicFormRenderer isPreview />}</Route>
      <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
      <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
        <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EmailAdmin /></RoleGuard>}</Route>
        <Route path="/admin/engagement">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EngagementDashboard /></RoleGuard>}</Route>
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/downloads/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><DownloadLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/products/:productId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ProductLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><WorkshopDetail /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/workshops/:workshopId/instances/:instanceId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WorkshopInstanceLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/cohorts/:cohortGroupId/page-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><CohortGroupLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/webinars/:webinarId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><WebinarLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/bundles/:bundleId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><BundleLandingPageBuilder /></RoleGuard>}</Route>
        <Route path="/admin/checkout-editor/:entityType/:entityId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={pageFallback}><CheckoutPageEditorPage /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/lesson-comments">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminLessonComments /></RoleGuard>}</Route>
        <Route path="/admin/funnels">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelBuilder /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/funnels/:funnelId/pages/:pageId/edit">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><FunnelPageEditor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/contacts">{() => { window.location.replace("/admin/funnels?tab=contacts"); return null; }}</Route>
        <Route path="/admin/sharing-monitor">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>}><SharingMonitor /></Suspense></RoleGuard>}</Route>
        <Route path="/admin/user-analytics">{() => { window.location.replace("/admin/members?tab=members"); return null; }}</Route>
        <Route path="/admin/users/:userId">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminUserDetailPage /></RoleGuard>}</Route>
        <Route path="/admin/sales">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/sales-dashboard">{() => { window.location.replace("/admin/members?tab=sales"); return null; }}</Route>
        <Route path="/admin/discount-codes">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminDiscountCodesPage /></RoleGuard>}</Route>
        <Route path="/admin/diy-accreditation">{() => <RoleGuard roles={["diy_admin", "platform_admin", "accreditation_manager"]} allowAdmin={true}><DIYAccreditationAdmin /></RoleGuard>}</Route>
        <Route path="/educator-assist">{() => <RoleGuard roles={["education_manager", "education_admin", "education_student"]} allowAdmin={true}><EducatorAssist /></RoleGuard>}</Route>
        <Route path="/educator-admin">{() => <RoleGuard roles={["education_admin", "education_manager"]} allowAdmin={true}><EducatorAdmin /></RoleGuard>}</Route>
        <Route path="/student-dashboard">{() => <RoleGuard roles={["education_student", "education_admin", "education_manager"]} allowAdmin={true}><StudentDashboard /></RoleGuard>}</Route>
        <Route path="/image-quality-review">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ImageQualityReview /></RoleGuard>}</Route>

        {/* ── Physician Over-Read (public, token-based) ──────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        {/* ── Shared content routes (also on app.allaboutultrasound.com + learn) ── */}
        <Route path="/products">{() => <Suspense fallback={pageFallback}><ProductsListing /></Suspense>}</Route>
        <Route path="/product/:slug" component={ProductLanding} />
        <Route path="/downloads/:slug/files">{(params: { slug: string }) => <SsoRedirect path={`/downloads/${params.slug}/files`} />}</Route>
        <Route path="/downloads/:slug" component={DownloadLanding} />
        <Route path="/downloads" component={DownloadsBrowse} />
        <Route path="/bundles/:slug" component={BundleLanding} />
        <Route path="/checkout/complete">
          <Suspense fallback={pageFallback}><CheckoutComplete /></Suspense>
        </Route>
        <Route path="/checkout/workshop/:slug">
          <Suspense fallback={pageFallback}><WorkshopCheckout /></Suspense>
        </Route>
        <Route path="/checkout/:slug">
          <Suspense fallback={pageFallback}><Checkout /></Suspense>
        </Route>
        <Route path="/memberships/:slug">{() => <Suspense fallback={pageFallback}><MembershipPage /></Suspense>}</Route>
        <Route path="/my-memberships/:slug">{() => <Suspense fallback={pageFallback}><MyMemberships /></Suspense>}</Route>
        <Route path="/my-memberships">{() => <Suspense fallback={pageFallback}><MyMemberships /></Suspense>}</Route>
        <Route path="/quiz/:joinCode">{() => <SonoQuizPlay />}</Route>
        <Route path="/quizzes/:quizId">{() => <StandaloneQuizPlayer />}</Route>
        <Route path="/quizzes/:quizId/results/:attemptId">{() => <StandaloneQuizResults />}</Route>
        <Route path="/my-quizzes">{() => <StudentQuizDashboard />}</Route>
        <Route path="/community" component={CommunityHub} />
        <Route path="/community/spaces/:spaceId/channels/:channelId" component={CommunityFeed} />
        <Route path="/community/spaces/:spaceId" component={CommunityFeed} />
        <Route path="/community/members/:userId" component={CommunityProfile} />
        <Route path="/community/dms/c/:conversationId" component={CommunityDMs} />
        <Route path="/community/dms/:userId" component={CommunityDMs} />
        <Route path="/community/dms" component={CommunityDMs} />
        <Route path="/community/leaderboard" component={CommunityLeaderboard} />
        <Route path="/community/:slug" component={CommunityFeed} />
        <Route path="/p/:slug">{() => <StandaloneLandingPage />}</Route>
        <Route path="/:slug/:pageSlug">{() => <PublicFunnelPageRoute />}</Route>
        <Route path="/:slug">{() => <FunnelRootRedirect />}</Route>

        <Route path="/404" component={NotFound} />
        <Route path="/privacy" component={() => { window.location.replace("https://www.allaboutultrasound.com/privacy-policy.html"); return null; }} />
        <Route path="/contact" component={() => { window.location.replace("https://www.allaboutultrasound.com/contact.html"); return null; }} />
        <Route component={NotFound} />
        <Route path="/media/:slug/:action" component={MediaRedirect} />
        <Route path="/media/:slug" component={MediaRedirect} />
      </Switch>
  );
  return <Suspense fallback={pageFallback}>{routeSwitch}</Suspense>;
}

/** Single-segment paths that are app routes, never funnel slugs (/:slug catch-all guard). */
const RESERVED_FUNNEL_SLUGS = new Set([
  "platform-admin", "login", "register", "logout", "admin", "premium", "profile",
  "enrolled", "upgrade-success", "my-dashboard", "my-team", "my-downloads",
  "education-library", "downloads", "courses", "products", "forms", "community",
  "career-network", "careernetwork", "employer", "accreditation", "lab-admin",
  "diy-member", "diy-register", "magic-link", "verify-email", "forgot-password",
  "reset-password", "unsubscribe", "flashcards", "case-library", "registry-review",
  "cme", "quickfire", "soundbytes", "ultrasound-assist", "scan-coach-hub",
  "calculators", "clinical-intelligence", "pocus-assist", "pocus-assist-hub",
  "fetal-echo-assist", "learn-fetal-echo", "affiliate-dashboard", "instructor-portal", "teach",
  "educator-assist", "educator-admin", "student-dashboard", "image-quality-review",
  "accreditation-manager", "accreditation-navigator", "diy-accreditation-plans",
  "memberships", "my-memberships", "404", "terms", "privacy", "contact",
]);

/** Guards /:slug/:pageSlug — never treat reserved or /admin paths as funnels. */
function PublicFunnelPageRoute() {
  const params = useParams<{ slug: string; pageSlug: string }>();
  const slug = params.slug ?? "";
  if (slug === "admin" || slug === "p" || RESERVED_FUNNEL_SLUGS.has(slug)) {
    return <NotFound />;
  }
  return <PublicFunnelPage />;
}

/**
 * FunnelRootRedirect — When a visitor lands on /:slug (no page slug),
 * first check if it's a physical product slug (redirect to /product/:slug),
 * then fetch the first active page of that funnel and redirect to /:slug/:firstPageSlug.
 */
function FunnelRootRedirect() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";

  if (RESERVED_FUNNEL_SLUGS.has(slug)) {
    return <NotFound />;
  }

  // Check if this is a physical product slug first
  const productQuery = trpc.products.getBySlug.useQuery(
    { slug, preview: false },
    { enabled: !!slug, retry: false }
  );

  const { data, error } = trpc.funnelPublic.getFirstPage.useQuery(
    { funnelSlug: slug },
    { enabled: !!slug && productQuery.isFetched && !productQuery.data, retry: false }
  );

  // If it's a product slug, redirect to the canonical product URL
  if (productQuery.data) {
    return <HardRedirect to={`/product/${slug}`} />;
  }

  // Still loading the product check
  if (!productQuery.isFetched) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    // Not a funnel slug either — show 404
    return <NotFound />;
  }

  if (!data) {
    // Loading funnel data
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <HardRedirect to={`/${data.funnelSlug}/${data.firstPageSlug}`} />;
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

/**
 * AccreditationDivisionRouter — Routes shown only on accreditation.iheartecho.com.
 * Hub for all DIY Accreditation tools.
 */
function AccreditationDivisionRouter() {
  usePageViewTracker();
  useSsoConsumer(); // Exchange ?sso=TOKEN for a session cookie on arrival
  useSsoBridge();   // Redirect-based SSO fallback when img-tag ping was blocked
  useCrossDomainSso(); // Silently sign user into all other domains as free member
  const pageFallback = (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
    </div>
  );
  return (
    <Suspense fallback={pageFallback}>
      <Switch>
        {/* Auth routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/magic-link" component={MagicLinkRequest} />
        <Route path="/auth/magic" component={MagicLinkCallback} />
        <Route path="/auth/access" component={AccessLinkCallback} />
        {/* Public landing page — root route, no auth required */}
        <Route path="/" component={DIYAccreditationLanding} />
        {/* DIY Accreditation routes */}
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/accreditation-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AccreditationNavigator /></RoleGuard>}</Route>
        <Route path="/diy-member">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><DIYMemberPortal /></RoleGuard>}</Route>
        <Route path="/diy-accreditation-plans" component={DIYAccreditationPlans} />
        <Route path="/diy-register" component={DIYRegister} />
        <Route path="/accreditation-manager">{() => <RoleGuard roles={["platform_admin", "accreditation_manager"]} allowAdmin={true}><AccreditationManager /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_admin"]} allowAdmin={false}><LabAdmin /></RoleGuard>}</Route>
        <Route path="/platform-admin">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><PlatformAdmin /></RoleGuard>}</Route>
        <Route path="/admin/diy-accreditation">{() => <RoleGuard roles={["diy_admin", "platform_admin", "accreditation_manager"]} allowAdmin={true}><DIYAccreditationAdmin /></RoleGuard>}</Route>
        <Route path="/accreditation-readiness">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={true}><AccreditationReadiness /></RoleGuard>}</Route>
        {/* ── Public Form Renderer ─────────────────────────────────────────── */}
        <Route path="/forms/:slug">{() => <PublicFormRenderer />}</Route>
        <Route path="/forms/:slug/embed">{() => <PublicFormRenderer isEmbed />}</Route>
        <Route path="/forms/:slug/preview">{() => <PublicFormRenderer isPreview />}</Route>
      <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
      <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
      <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        <Route path="/reports/analytics/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsReport /></Suspense>}</Route>
        <Route path="/reports/analytics/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsReport embed /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard /></Suspense>}</Route>
        <Route path="/reports/dashboard/:token/embed">{() => <Suspense fallback={null}><PublicFormAnalyticsDashboard embed /></Suspense>}</Route>
        {/* Default: public landing page */}
        <Route component={DIYAccreditationLanding} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const onLearnSubdomain = isLearnDomain();
  const onMembersSubdomain = isMembersDomain();
  const onIHeartEchoSubdomain = isIHeartEchoDomain();
  const onAccreditationSubdomain = isAccreditationDomain();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {onMembersSubdomain ? (
            <MembersRouter />
          ) : onLearnSubdomain ? (
            <LMSRouter />
          ) : onAccreditationSubdomain ? (
            <AccreditationDivisionRouter />
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

