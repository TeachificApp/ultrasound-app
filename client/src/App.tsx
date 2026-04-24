/*
  UltrasoundAssist™ — All About Ultrasound™
  App Router — all routes for the UltrasoundAssist platform
*/
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoModeBanner from "./components/DemoModeBanner";
import GetAppBanner from "./components/GetAppBanner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleGuard } from "@/components/RoleGuard";

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
import CourseLanding from "./pages/CourseLanding";
import CoursePlayer from "./pages/CoursePlayer";
import LMSAdmin from "./pages/admin/LMSAdmin";
import LandingPageBuilder from "./pages/admin/LandingPageBuilder";

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

// ── CME Hub ─────────────────────────────────────────────────────────────────────────
import CMEHub from "./pages/CMEHub";

// ── Physician Over-Read (public, token-based) ─────────────────────────────────
import PhysicianOverReadForm from "./pages/PhysicianOverReadForm";

function Router() {
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
        <Route path="/abdominal-navigator" component={AbdominalNavigator} />
        <Route path="/abdominal-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><AbdominalScanCoach /></RoleGuard>}</Route>

        {/* ── Pelvic/Gyn ────────────────────────────────────────────────── */}
        <Route path="/pelvic-gyn-navigator" component={PelvicGynNavigator} />
        <Route path="/pelvic-gyn-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PelvicGynScanCoach /></RoleGuard>}</Route>

        {/* ── OB 1st Trimester ──────────────────────────────────────────── */}
        <Route path="/ob1-navigator" component={OB1Navigator} />
        <Route path="/ob1-scan-coach">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><OB1ScanCoach /></RoleGuard>}</Route>

        {/* ── OB 2nd/3rd Trimester ──────────────────────────────────────── */}
        <Route path="/ob23-navigator" component={OB23Navigator} />
        <Route path="/ob23-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><OB23ScanCoach /></RoleGuard>}</Route>

        {/* ── Thyroid ───────────────────────────────────────────────────── */}
        <Route path="/thyroid-navigator" component={ThyroidNavigator} />
        <Route path="/thyroid-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ThyroidScanCoach /></RoleGuard>}</Route>

        {/* ── Scrotum ───────────────────────────────────────────────────── */}
        <Route path="/scrotum-navigator" component={ScrotumNavigator} />
        <Route path="/scrotum-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ScrotumScanCoach /></RoleGuard>}</Route>

        {/* ── Breast ────────────────────────────────────────────────────── */}
        <Route path="/breast-navigator" component={BreastNavigator} />
        <Route path="/breast-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><BreastScanCoach /></RoleGuard>}</Route>

        {/* Appendix */}
        <Route path="/appendix-navigator" component={AppendixNavigator} />
        <Route path="/appendix-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AppendixScanCoach /></RoleGuard>}</Route>

        {/* Invasive Procedures */}
        <Route path="/invasive-procedures-navigator" component={InvasiveProceduresNavigator} />
        <Route path="/invasive-procedures-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><InvasiveProceduresScanCoach /></RoleGuard>}</Route>
        {/* ── PediatricAssist™ ──────────────────────────────────────────── */}
        <Route path="/pediatric-navigator">{() => <RoleGuard roles={["user", "premium_user", "diy_user", "diy_admin"]}><PediatricNavigator /></RoleGuard>}</Route>
        <Route path="/pediatric-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><PediatricScanCoach /></RoleGuard>}</Route>
        <Route path="/pediatric-calculators" component={PediatricCalculators} />

        {/* ── Vascular — Venous ─────────────────────────────────────────── */}
        <Route path="/venous-navigator" component={VenousNavigator} />
        <Route path="/venous-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><VenousScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Arterial ───────────────────────────────────────── */}
        <Route path="/arterial-navigator" component={ArterialNavigator} />
        <Route path="/arterial-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><ArterialScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Abdominal/Renal/Mesenteric ─────────────────────── */}
        <Route path="/abdominal-vascular-navigator" component={AbdominalVascularNavigator} />
        <Route path="/abdominal-vascular-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AbdominalVascularScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Aorta/EndoLeak ─────────────────────────────────── */}
        <Route path="/aorta-navigator" component={AortaNavigator} />
        <Route path="/aorta-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><AortaScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — Carotid ────────────────────────────────────────── */}
        <Route path="/carotid-navigator" component={CarotidNavigator} />
        <Route path="/carotid-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><CarotidScanCoach /></RoleGuard>}</Route>

        {/* ── Vascular — TCD ────────────────────────────────────────────── */}
        <Route path="/tcd-navigator" component={TCDNavigator} />
        <Route path="/tcd-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><TCDScanCoach /></RoleGuard>}</Route>

        {/* ── MSK ───────────────────────────────────────────────────────── */}
        <Route path="/msk-navigator" component={MSKNavigator} />
        <Route path="/msk-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><MSKScanCoach /></RoleGuard>}</Route>

        {/* ── POCUS-Assist™ ─────────────────────────────────────────────── */}
        <Route path="/pocus-assist" component={POCUSAssistHub} />
        <Route path="/pocus-assist-hub" component={POCUSAssistHub} />
        <Route path="/pocus-efast-navigator" component={POCUSEfastNavigator} />
        <Route path="/pocus-rush-navigator" component={POCUSRushNavigator} />
        <Route path="/pocus-cardiac-navigator" component={POCUSCardiacNavigator} />
        <Route path="/pocus-lung-navigator" component={POCUSLungNavigator} />
        <Route path="/pocus-efast-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSEfastScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-rush-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSRushScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-cardiac-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSCardiacScanCoach /></RoleGuard>}</Route>
        <Route path="/pocus-lung-scan-coach">{() => <RoleGuard roles={["premium_user", "diy_user", "diy_admin"]}><POCUSLungScanCoach /></RoleGuard>}</Route>

        {/* ── Fetal EchoAssist™ ─────────────────────────────────────────── */}
        <Route path="/fetal-echo-assist" component={FetalEchoAssist} />
        <Route path="/fetal-navigator" component={FetalNavigator} />
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
        <Route path="/learn/:slug/player" component={CoursePlayer} />
        <Route path="/learn/:slug" component={CourseLanding} />
        <Route path="/admin/lms">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LMSAdmin /></RoleGuard>}</Route>
        <Route path="/admin/lms/:courseId/landing-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><LandingPageBuilder /></RoleGuard>}</Route>

        {/* ── Admin ───────────────────────────────────────────────────────────── */}
        <Route path="/admin/cases">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AdminCaseManagement /></RoleGuard>}</Route>
        <Route path="/admin/quickfire">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><QuickFireAdmin /></RoleGuard>}</Route>
        <Route path="/admin/challenge-cards">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ChallengeCardGenerator /></RoleGuard>}</Route>
        <Route path="/admin/scancoach">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ScanCoachEditor /></RoleGuard>}</Route>
        <Route path="/admin/navigator">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><NavigatorEditor /></RoleGuard>}</Route>
        <Route path="/admin/media-repository">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><MediaRepository /></RoleGuard>}</Route>
        <Route path="/admin/thinkific-webhook">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><ThinkificWebhookAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/form-builder/:id">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><FormBuilderAdmin /></RoleGuard>}</Route>
        <Route path="/admin/email">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><EmailAdmin /></RoleGuard>}</Route>
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
        <Route path="/accreditation-navigator" component={AccreditationNavigator} />
        <Route path="/accreditation">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/lab-admin">{() => <RoleGuard roles={["diy_user", "diy_admin"]} allowAdmin={false}><AccreditationTool /></RoleGuard>}</Route>
        <Route path="/accreditation-manager">{() => <RoleGuard roles={["platform_admin"]} allowAdmin={true}><AccreditationManager /></RoleGuard>}</Route>

        {/* ── Physician Over-Read (public, token-based) ─────────────────── */}
        <Route path="/physician-review/:token" component={PhysicianOverReadForm} />

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <DemoModeBanner />
          <GetAppBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
