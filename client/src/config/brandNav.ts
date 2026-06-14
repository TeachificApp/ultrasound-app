/**
 * Brand-specific navigation configuration.
 * Each brand has its own sidebar nav groups, hidden nav items, logo, and branding.
 */
import type { Brand } from "@/hooks/useBrand";
import {
  Heart, Calculator, ClipboardList, Activity,
  BookOpen, Stethoscope, Zap, ExternalLink, MessageCircle, Award, Shield, GraduationCap,
  BookMarked, Library, Crown, Layers, ClipboardCheck, Brain, Trophy, Volume2, FileText, BookCheck,
  Briefcase
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon?: any;
  external?: boolean;
  pinLast?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface BrandNavConfig {
  navGroups: NavGroup[];
  hiddenNavItems: NavItem[];
  logoUrl: string;
  logoAlt: string;
  title: string;
  subtitle: string;
  bgColor: string; // sidebar bg
  accentColor: string; // accent text color
}

// ─── AAUS Navigation ────────────────────────────────────────────────────────────
const AAUS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: Heart },
    ],
  },
  {
    label: "Clinical Tools",
    items: [
      { path: "/ultrasound-assist", label: "UltrasoundAssist\u2122", icon: Stethoscope },
      { path: "/calculators", label: "UltrasoundAssist\u2122 Calculators", icon: Calculator },
      { path: "/pediatric-navigator", label: "PediatricAssist\u2122", icon: Stethoscope },
      { path: "/pediatric-calculators", label: "PediatricAssist\u2122 Calculators", icon: Calculator },
      { path: "/clinical-intelligence", label: "Clinical Intelligence", icon: Brain },
    ],
  },
  {
    label: "Learning",
    items: [
      { path: "/quickfire-aaus", label: "Daily Challenge", icon: Zap },
      { path: "/flashcards", label: "Ultrasound Flashcards", icon: Layers },
      { path: "/case-library", label: "Case Library", icon: Library },
      { path: "/soundbytes-aaus", label: "SoundBytes\u2122", icon: BookMarked },
      { path: "/cme", label: "CME Hub", icon: GraduationCap },
      { path: "/registry-review", label: "Registry Review Hub", icon: ClipboardCheck },
      { path: "__LEARN_FETAL_ECHO_URL__", label: "Learn Fetal Echo", icon: BookOpen, external: true },
      { path: "__LEARN_ECHO_URL__", label: "Learn Echo", icon: BookOpen, external: true },
      { path: "__LEARN_VASCULAR_URL__", label: "Learn Vascular", icon: BookOpen, external: true },
      { path: "__LEARN_POCUS_URL__", label: "Learn POCUS", icon: BookOpen, external: true },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/community/all-about-ultrasound", label: "Community Hub", icon: MessageCircle },
    ],
  },
  {
    label: "Career",
    items: [
      { path: "/career-network", label: "Career Network", icon: Briefcase },
    ],
  },
  {
    label: "Premium",
    items: [
      { path: "/premium", label: "Premium Access", icon: Crown },
    ],
  },
];

const AAUS_HIDDEN_NAV: NavItem[] = [
  { path: "/image-quality-review", label: "Image Quality Review" },
  { path: "/profile", label: "My Profile" },
  { path: "/case-library/submit", label: "Submit a Case" },
  { path: "/admin/cases-aaus", label: "Case Management" },
  { path: "/admin/quickfire-aaus", label: "Daily Challenge Admin" },
  { path: "/admin/thinkific-webhook-aaus", label: "Thinkific Webhook" },
  { path: "/echo-assist-hub", label: "EchoAssist\u2122" },
  { path: "/scan-coach", label: "EchoAssist\u2122 \u2014 Scan Coach" },
  { path: "/pocus-assist-hub", label: "POCUS-Assist\u2122" },
  { path: "/pocus-efast-navigator", label: "eFAST Navigator" },
  { path: "/pocus-rush-navigator", label: "RUSH Navigator" },
  { path: "/pocus-cardiac-navigator", label: "Cardiac POCUS Navigator" },
  { path: "/pocus-lung-navigator", label: "Lung POCUS Navigator" },
  { path: "/pocus-efast-scan-coach", label: "eFAST ScanCoach\u2122" },
  { path: "/pocus-rush-scan-coach", label: "RUSH ScanCoach\u2122" },
  { path: "/pocus-cardiac-scan-coach", label: "Cardiac POCUS ScanCoach\u2122" },
  { path: "/pocus-lung-scan-coach", label: "Lung POCUS ScanCoach\u2122" },
  { path: "/ecg-navigator", label: "ECG Navigator" },
  { path: "/ecg-coach", label: "ECG Coach" },
  { path: "/ecg-assist", label: "ECG-Assist\u2122" },
  { path: "/fetal-echo-assist", label: "FetalEchoAssist\u2122" },
  { path: "/fetal-navigator", label: "Fetal Echo Navigator" },
  { path: "/fetal-scan-coach", label: "Fetal Echo ScanCoach\u2122" },
  { path: "/pediatric-echo-assist", label: "PediatricEchoAssist\u2122" },
  { path: "/achd-echo-assist", label: "ACHDEchoAssist\u2122" },
  { path: "/diy-accreditation-plans", label: "DIY Accreditation\u2122 Plans" },
  { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122" },
  { path: "/diy-register", label: "Register Your Lab" },
  { path: "/lab-admin", label: "Lab Admin Portal" },
  { path: "/diy-member", label: "Member Portal" },
  { path: "/ultrasound-assist", label: "UltrasoundAssist\u2122" },
  { path: "/calculators", label: "UltrasoundAssist\u2122 Calculators" },
  { path: "/abdominal-navigator", label: "Abdominal Navigator" },
  { path: "/abdominal-scan-coach", label: "Abdominal ScanCoach\u2122" },
  { path: "/pelvic-gyn-navigator", label: "Pelvic/Gyn Navigator" },
  { path: "/pelvic-gyn-scan-coach", label: "Pelvic/Gyn ScanCoach\u2122" },
  { path: "/ob1-navigator", label: "OB 1st Trimester Navigator" },
  { path: "/ob1-scan-coach", label: "OB 1st Trimester ScanCoach\u2122" },
  { path: "/ob23-navigator", label: "OB 2nd/3rd Trimester Navigator" },
  { path: "/ob23-scan-coach", label: "OB 2nd/3rd Trimester ScanCoach\u2122" },
  { path: "/thyroid-navigator", label: "Thyroid Navigator" },
  { path: "/thyroid-scan-coach", label: "Thyroid ScanCoach\u2122" },
  { path: "/scrotum-navigator", label: "Scrotal Navigator" },
  { path: "/scrotum-scan-coach", label: "Scrotal ScanCoach\u2122" },
  { path: "/breast-navigator", label: "Breast Navigator" },
  { path: "/breast-scan-coach", label: "Breast ScanCoach\u2122" },
  { path: "/venous-navigator", label: "Venous Navigator" },
  { path: "/venous-scan-coach", label: "Venous ScanCoach\u2122" },
  { path: "/arterial-navigator", label: "Arterial Navigator" },
  { path: "/arterial-scan-coach", label: "Arterial ScanCoach\u2122" },
  { path: "/abdominal-vascular-navigator", label: "Abdominal Vascular Navigator" },
  { path: "/abdominal-vascular-scan-coach", label: "Abdominal Vascular ScanCoach\u2122" },
  { path: "/aorta-navigator", label: "Abdominal Aorta Navigator" },
  { path: "/aorta-scan-coach", label: "Abdominal Aorta ScanCoach\u2122" },
  { path: "/carotid-navigator", label: "Carotid Navigator" },
  { path: "/carotid-scan-coach", label: "Carotid ScanCoach\u2122" },
  { path: "/tcd-navigator", label: "TCD Navigator" },
  { path: "/tcd-scan-coach", label: "TCD ScanCoach\u2122" },
  { path: "/msk-navigator", label: "MSK Navigator" },
  { path: "/msk-scan-coach", label: "MSK ScanCoach\u2122" },
  { path: "/pocus-assist", label: "POCUS-Assist\u2122 Hub" },
  { path: "/pediatric-navigator", label: "PediatricAssist\u2122 Navigator" },
  { path: "/pediatric-scan-coach", label: "PediatricAssist\u2122 ScanCoach\u2122" },
  { path: "/pediatric-calculators", label: "PediatricAssist\u2122 Calculators" },
  { path: "/soundbytes-aaus", label: "SoundBytes\u2122" },
  { path: "/educator-assist", label: "EducatorAssist\u2122" },
];

// ─── iHeartEcho Navigation ──────────────────────────────────────────────────────
const IHE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: Heart },
    ],
  },
  {
    label: "Clinical Tools",
    items: [
      { path: "/echo-assist-hub", label: "EchoAssist\u2122", icon: Stethoscope },
      { path: "/pocus-assist-hub", label: "POCUS-Assist\u2122", icon: Shield },
      { path: "/hemodynamics", label: "Hemodynamics Lab", icon: Activity },
      { path: "/echoassist", label: "EchoAssist\u2122 Calculators", icon: Calculator },
      { path: "/guidelines-assist", label: "GuidelinesAssist\u2122", icon: BookCheck },
      { path: "/report", label: "Report Builder", icon: FileText },
    ],
  },
  {
    label: "Learning",
    items: [
      { path: "/quickfire-ihe", label: "Daily Challenge", icon: Zap },
      { path: "/flashcards", label: "Echo Flashcards", icon: Layers },
      { path: "/case-library", label: "Echo Case Library", icon: Library },
      { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { path: "/soundbytes-ihe", label: "SoundBytes\u2122", icon: Volume2 },
      { path: "/cme", label: "CME Hub", icon: GraduationCap },
      { path: "/registry-review", label: "Registry Review", icon: BookMarked },
      { path: "__LEARN_ACS_URL__", label: "ACS Mastery", icon: Award, external: true },
      { path: "__LEARN_ECHO_URL__", label: "Learn Echo", icon: GraduationCap, external: true },
      { path: "__LEARN_PEDS_ECHO_URL__", label: "Learn Pediatric Echo", icon: BookOpen, external: true },
      { path: "__LEARN_FETAL_ECHO_URL__", label: "Learn Fetal Echo", icon: BookOpen, external: true },
      { path: "__LEARN_VASCULAR_URL__", label: "Learn Vascular", icon: Activity, external: true },
      { path: "__LEARN_POCUS_URL__", label: "Learn POCUS", icon: Stethoscope, external: true },
    ],
  },
  {
    label: "Accreditation",
    items: [
      { path: "/accreditation-navigator", label: "EchoAccreditation Navigator\u2122", icon: Award },
      { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122", icon: ClipboardList },
    ],
  },
  {
    label: "Community",
    items: [
      { path: "/community/all-about-ultrasound", label: "iHeartEcho™ Community", icon: MessageCircle },
    ],
  },
  {
    label: "Career",
    items: [
      { path: "/career-network", label: "Career Network", icon: Briefcase },
    ],
  },
  {
    label: "Premium",
    items: [
      { path: "/premium", label: "Premium Access", icon: Crown },
    ],
  },
];

const IHE_HIDDEN_NAV: NavItem[] = [
  { path: "/image-quality-review", label: "Image Quality Review" },
  { path: "/profile", label: "My Profile" },
  { path: "/case-library/submit", label: "Submit a Case" },
  { path: "/admin/cases-ihe", label: "Case Management" },
  { path: "/admin/quickfire-ihe", label: "Daily Challenge Admin" },
  { path: "/admin/thinkific-webhook-ihe", label: "Thinkific Webhook" },
  { path: "/echo-assist-hub", label: "EchoAssist\u2122" },
  { path: "/guidelines-assist", label: "GuidelinesAssist\u2122" },
  { path: "/scan-coach", label: "EchoAssist\u2122 \u2014 Scan Coach" },
  { path: "/pocus-assist-hub", label: "POCUS-Assist\u2122" },
  { path: "/pocus-efast", label: "eFAST Navigator" },
  { path: "/pocus-rush", label: "RUSH Navigator" },
  { path: "/pocus-cardiac", label: "Cardiac POCUS Navigator" },
  { path: "/pocus-lung", label: "Lung POCUS Navigator" },
  { path: "/pocus-efast-scan-coach", label: "eFAST ScanCoach\u2122" },
  { path: "/pocus-rush-scan-coach", label: "RUSH ScanCoach\u2122" },
  { path: "/pocus-cardiac-scan-coach", label: "Cardiac POCUS ScanCoach\u2122" },
  { path: "/pocus-lung-scan-coach", label: "Lung POCUS ScanCoach\u2122" },
  { path: "/ecg-navigator", label: "ECG Navigator" },
  { path: "/ecg-coach", label: "ECG Coach" },
  { path: "/ecg-assist", label: "ECG-Assist\u2122" },
  { path: "/fetal-echo-assist", label: "FetalEchoAssist\u2122" },
  { path: "/pediatric-echo-assist", label: "PediatricEchoAssist\u2122" },
  { path: "/achd-echo-assist", label: "ACHDEchoAssist\u2122" },
  { path: "/diy-accreditation-plans", label: "DIY Accreditation\u2122 Plans" },
  { path: "/diy-accreditation-smart", label: "DIY Accreditation\u2122" },
  { path: "/diy-register", label: "Register Your Lab" },
  { path: "/lab-admin", label: "Lab Admin Portal" },
  { path: "/diy-member", label: "Member Portal" },
  { path: "/hemodynamics", label: "Hemodynamics Lab" },
  { path: "/echoassist", label: "EchoAssist\u2122 Calculators" },
  { path: "/report", label: "Report Builder" },
  { path: "/educator-assist", label: "EducatorAssist\u2122" },
  { path: "/soundbytes-ihe", label: "SoundBytes\u2122" },
  { path: "/engagement", label: "Engagement Dashboard" },
  { path: "/student-dashboard", label: "Student Dashboard" },
];

// ─── Exported config getter ─────────────────────────────────────────────────────
export function getBrandNavConfig(brand: Brand): BrandNavConfig {
  if (brand === "iheartecho") {
    return {
      navGroups: IHE_NAV_GROUPS,
      hiddenNavItems: IHE_HIDDEN_NAV,
      logoUrl: "/manus-storage/iheartecho-logo_f9d91cd4.webp",
      logoAlt: "iHeartEcho\u2122",
      title: "iHeartEcho\u2122",
      subtitle: "EchoAssist\u2122 Clinical Intelligence",
      bgColor: "#0e1e2e",
      accentColor: "#4ad9e0",
    };
  }
  return {
    navGroups: AAUS_NAV_GROUPS,
    hiddenNavItems: AAUS_HIDDEN_NAV,
    logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp",
    logoAlt: "All About Ultrasound\u2122",
    title: "All About Ultrasound\u2122",
    subtitle: "UltrasoundAssist\u2122 Clinical Intelligence",
    bgColor: "#0e1e2e",
    accentColor: "#4ad9e0",
  };
}
