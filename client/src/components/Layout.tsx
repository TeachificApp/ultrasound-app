/*
  All About Ultrasound™ Layout — Sidebar Navigation
  Brand: Teal #189aa1, Aqua #4ad9e0, Dark sidebar
  Fonts: Merriweather headings, Open Sans body
*/
import { useState, useRef, useEffect } from "react";
import NameCollectionModal from "@/components/NameCollectionModal";
import { Link, Link as WouterLink, useLocation } from "wouter";
import {
  Heart, Calculator, ClipboardList, Activity,
  Scan, BookOpen, FileText, Menu, X, ChevronRight,
  Stethoscope, Zap, ExternalLink, ShoppingBag, FlaskConical, MessageCircle, Award, Shield, GraduationCap,
  BookMarked, Library, Plus, Crown, Droplets, Building2, Users, UserPlus,
  LogIn, LogOut, ChevronDown, Webhook, Layers, Lock, ClipboardCheck, Brain,
  DollarSign, Briefcase
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useBrand } from "@/hooks/useBrand";
import { getBrandNavConfig } from "@/config/brandNav";
import { isLearnDomain, isMembersDomain, isAccreditationDomain } from "@/hooks/useSubdomain";
import { useSiteNavMenu } from "@/hooks/useSiteNavMenu";
import { SiteNavProfileLinks } from "@/components/SiteNavLinks";
import GetAppBanner from "@/components/GetAppBanner";

/** Badge showing the count of echo cases pending admin review */
function CasePendingBadge() {
  const { data } = trpc.caseLibrary.getPendingCount.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const count = data?.count ?? 0;
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[#189aa1] text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Small badge showing the count of pre-registered users awaiting first login */
function PendingBadge() {
  const { data: count } = trpc.platformAdmin.countPending.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  if (!count || count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-orange-500 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// navGroups is built dynamically in the Layout component using live Learn link URLs from DB
const BASE_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: Heart },
    ],
  },
  {
    label: "Clinical Tools",
    items: [
      { path: "/ultrasound-assist", label: "UltrasoundAssist™", icon: Stethoscope },
      { path: "/calculators", label: "UltrasoundAssist™ Calculators", icon: Calculator },
      { path: "/pediatric-navigator", label: "PediatricAssist™", icon: Stethoscope },
      { path: "/pediatric-calculators", label: "PediatricAssist™ Calculators", icon: Calculator },
      { path: "/clinical-intelligence", label: "Clinical Intelligence", icon: Brain },
    ],
  },
  {
    label: "Learning",
    items: [
      { path: "/quickfire", label: "Daily Challenge", icon: Zap },
      { path: "/flashcards", label: "Ultrasound Flashcards", icon: Layers },
      { path: "/case-library", label: "Case Library", icon: Library },
      { path: "/soundbytes", label: "SoundBytes™", icon: BookMarked },
      { path: "/cme", label: "CME Hub", icon: GraduationCap },
      { path: "/registry-review", label: "Registry Review Hub", icon: ClipboardCheck },
      // Learn links below use __LEARN_FETAL_ECHO_URL__, __LEARN_ECHO_URL__, __LEARN_POCUS_URL__
      // as placeholders — replaced at runtime in the Layout component with DB values
      { path: "__LEARN_FETAL_ECHO_URL__", label: "Learn Fetal Echo", icon: BookOpen, external: true },
      { path: "__LEARN_ECHO_URL__", label: "Learn Echo", icon: BookOpen, external: true },
      { path: "__LEARN_VASCULAR_URL__", label: "Learn Vascular", icon: BookOpen, external: true },
      { path: "__LEARN_POCUS_URL__", label: "Learn POCUS", icon: BookOpen, external: true },
    ],
  },
  // Accreditation section hidden until requested
  // { label: "Accreditation", items: [
  //   { path: "/accreditation-navigator", label: "Accreditation Navigator™", icon: Award },
  //   { path: "/diy-accreditation-smart", label: "DIY Accreditation™", icon: ClipboardList },
  // ] },
  {
    label: "Community",
    items: [
      { path: "/community", label: "Community Hub", icon: Users },
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

// Flat list for header label lookup (includes hidden routes not shown in sidebar)
const hiddenNavItems = [
  { path: "/image-quality-review", label: "Image Quality Review" },
  { path: "/profile", label: "My Profile" },
  { path: "/case-library/submit", label: "Submit a Case" },
  { path: "/admin/cases-aaus", label: "Case Management" },
  { path: "/admin/quickfire-aaus", label: "Daily Challenge Admin" },
  { path: "/admin/thinkific-webhook-aaus", label: "Thinkific Webhook" },
  { path: "/echo-assist-hub", label: "EchoAssist™" },
  { path: "/scan-coach", label: "EchoAssist™ — Scan Coach" },
  { path: "/pocus-assist-hub", label: "POCUS-Assist™" },
  { path: "/pocus-efast-navigator", label: "eFAST Navigator" },
  { path: "/pocus-rush-navigator", label: "RUSH Navigator" },
  { path: "/pocus-cardiac-navigator", label: "Cardiac POCUS Navigator" },
  { path: "/pocus-lung-navigator", label: "Lung POCUS Navigator" },
  { path: "/pocus-efast-scan-coach", label: "eFAST ScanCoach™" },
  { path: "/pocus-rush-scan-coach", label: "RUSH ScanCoach™" },
  { path: "/pocus-cardiac-scan-coach", label: "Cardiac POCUS ScanCoach™" },
  { path: "/pocus-lung-scan-coach", label: "Lung POCUS ScanCoach™" },
  { path: "/ecg-navigator", label: "ECG Navigator" },
  { path: "/ecg-coach", label: "ECG Coach" },
  { path: "/ecg-assist", label: "ECG-Assist™" },
  { path: "/fetal-echo-assist", label: "FetalEchoAssist™" },
  { path: "/fetal-navigator", label: "Fetal Echo Navigator" },
  { path: "/fetal-scan-coach", label: "Fetal Echo ScanCoach™" },
  { path: "/pediatric-echo-assist", label: "PediatricEchoAssist™" },
  { path: "/achd-echo-assist", label: "ACHDEchoAssist™" },
  { path: "/diy-accreditation-plans", label: "DIY Accreditation™ Plans" },
  { path: "/diy-accreditation-smart", label: "DIY Accreditation™" },
  { path: "/diy-register", label: "Register Your Lab" },
  { path: "/lab-admin", label: "Lab Admin Portal" },
  { path: "/diy-member", label: "Member Portal" },
  // Ultrasound specialty navigators
  { path: "/ultrasound-assist", label: "UltrasoundAssist™" },
  { path: "/calculators", label: "UltrasoundAssist™ Calculators" },
  { path: "/abdominal-navigator", label: "Abdominal Navigator" },
  { path: "/abdominal-scan-coach", label: "Abdominal ScanCoach™" },
  { path: "/pelvic-gyn-navigator", label: "Pelvic/Gyn Navigator" },
  { path: "/pelvic-gyn-scan-coach", label: "Pelvic/Gyn ScanCoach™" },
  { path: "/ob1-navigator", label: "OB 1st Trimester Navigator" },
  { path: "/ob1-scan-coach", label: "OB 1st Trimester ScanCoach™" },
  { path: "/ob23-navigator", label: "OB 2nd/3rd Trimester Navigator" },
  { path: "/ob23-scan-coach", label: "OB 2nd/3rd Trimester ScanCoach™" },
  { path: "/thyroid-navigator", label: "Thyroid Navigator" },
  { path: "/thyroid-scan-coach", label: "Thyroid ScanCoach™" },
  { path: "/scrotum-navigator", label: "Scrotal Navigator" },
  { path: "/scrotum-scan-coach", label: "Scrotal ScanCoach™" },
  { path: "/breast-navigator", label: "Breast Navigator" },
  { path: "/breast-scan-coach", label: "Breast ScanCoach™" },
  { path: "/venous-navigator", label: "Venous Navigator" },
  { path: "/venous-scan-coach", label: "Venous ScanCoach™" },
  { path: "/arterial-navigator", label: "Arterial Navigator" },
  { path: "/arterial-scan-coach", label: "Arterial ScanCoach™" },
  { path: "/abdominal-vascular-navigator", label: "Abdominal Vascular Navigator" },
  { path: "/abdominal-vascular-scan-coach", label: "Abdominal Vascular ScanCoach™" },
  { path: "/aorta-navigator", label: "Abdominal Aorta Navigator" },
  { path: "/aorta-scan-coach", label: "Abdominal Aorta ScanCoach™" },
  { path: "/carotid-navigator", label: "Carotid Navigator" },
  { path: "/carotid-scan-coach", label: "Carotid ScanCoach™" },
  { path: "/tcd-navigator", label: "TCD Navigator" },
  { path: "/tcd-scan-coach", label: "TCD ScanCoach™" },
  { path: "/msk-navigator", label: "MSK Navigator" },
  { path: "/msk-scan-coach", label: "MSK ScanCoach™" },
  { path: "/pocus-assist", label: "POCUS-Assist™ Hub" },
  { path: "/pediatric-navigator", label: "PediatricAssist™ Navigator" },
  { path: "/pediatric-scan-coach", label: "PediatricAssist™ ScanCoach™" },
  { path: "/pediatric-calculators", label: "PediatricAssist™ Calculators" },
  { path: "/soundbytes", label: "SoundBytes™" },
  { path: "/educator-assist", label: "EducatorAssist™" },
];
// staticNavItems is now resolved inside the Layout function body (brand-aware)

export default function Layout({ children }: { children: React.ReactNode }) {
  // On learn, members, and accreditation domains, the domain-specific layout
  // (LMSLayout / MembersLayout / AccreditationLayout) already provides the
  // header and navigation chrome. Rendering Layout's sidebar here would
  // create a double-header. Return children directly as a passthrough.
  if (isLearnDomain() || isMembersDomain() || isAccreditationDomain()) {
    return <>{children}</>;
  }
  const [rawLocation] = useLocation();
  // Admin routes (/admin/* and /platform-admin) should render without the
  // clinical sidebar — they have their own navigation or are full-page tools.
  const rawPath = rawLocation.split("?")[0];
  if (rawPath.startsWith("/admin/") || rawPath === "/platform-admin") {
    return <>{children}</>;
  }
  const location = rawLocation.split("?")[0];
  const fullLocation = rawLocation; // includes query string, used for tab-specific active state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Preserve sidebar scroll position across navigation
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem("sidebar-scroll");
    if (saved) nav.scrollTop = parseInt(saved, 10);
  }, []);

  const saveNavScroll = () => {
    if (navRef.current) {
      sessionStorage.setItem("sidebar-scroll", String(navRef.current.scrollTop));
    }
  };
  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  // Use appRoles (the authoritative role array from auth.me) for access checks
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const hasDiyAccess = appRoles.includes("diy_user") || appRoles.includes("diy_admin") || appRoles.includes("platform_admin") || appRoles.includes("platform_owner") || isAdmin;
  const hasDiyAdmin = appRoles.includes("diy_admin");
  const isDemoMode = !!(user as any)?.demoMode;

  // Brand-aware navigation
  const brandConfig = useBrand();
  const brandNav = getBrandNavConfig(brandConfig.brand);
  const allNavItems = [...brandNav.navGroups.flatMap(g => g.items), ...brandNav.hiddenNavItems];

  // Fetch dynamic Learn link URLs from DB
  const { data: learnLinks } = trpc.menuLinks.getLearnLinks.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Build navGroups with resolved Learn link URLs (works for both brands)
  const navGroups = brandNav.navGroups.map(group => ({
    ...group,
    items: group.items.map((item: { path: string; label: string; icon?: any; external?: boolean }) => {
      if (item.path === "__LEARN_FETAL_ECHO_URL__")
        return { ...item, path: learnLinks?.learnFetalEchoUrl || "https://www.allaboutultrasound.net/fetal-echo-preview-access-pass" };
      if (item.path === "__LEARN_ECHO_URL__")
        return { ...item, path: learnLinks?.learnEchoUrl || "" };
      if (item.path === "__LEARN_POCUS_URL__")
        return { ...item, path: learnLinks?.learnPocusUrl || "" };
      if (item.path === "__LEARN_VASCULAR_URL__")
        return { ...item, path: learnLinks?.learnVascularUrl || "" };
      if (item.path === "__LEARN_ACS_URL__")
        return { ...item, path: "https://learn.allaboutultrasound.com/education-library?collection=acs" };
      if (item.path === "__LEARN_PEDS_ECHO_URL__")
        return { ...item, path: "https://www.allaboutultrasound.net/pediatric-echo-cross-training-2cfdb" };
      return item;
    // Hide Learn links if no URL is configured yet
    }).filter((item: { path: string; label: string; icon?: any; external?: boolean }) =>
      !item.path.startsWith("__") && !(item.external && !item.path)
    ),
  }));

  const { items: profileNavItems } = useSiteNavMenu("profile", []);

  return (
    <div className={`flex min-h-screen bg-[#f0fbfc]${isDemoMode ? ' pt-10' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen z-30 flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          w-64 bg-[#0e1e2e] text-white flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
          <img
            src={brandNav.logoUrl}
            alt={brandNav.logoAlt}
            className="w-12 h-12 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm leading-tight" style={{ fontFamily: "Merriweather, serif" }}>
              {brandNav.title}
            </div>
            <div className="text-xs leading-tight font-medium" style={{ color: brandNav.accentColor }}>{brandNav.subtitle}</div>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white flex-shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav ref={navRef} onScroll={saveNavScroll} className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              <div className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-1">{group.label}</div>
              {group.items.map(({ path, label, icon: Icon, external }) => {
                // Smart DIY Accreditation link: resolve destination and label based on user access
                const isDiySmartLink = path === "/diy-accreditation-smart";
                const resolvedPath = isDiySmartLink
                  ? (hasDiyAccess ? "/accreditation" : "/diy-accreditation-plans")
                  : path;
                const resolvedLabel = label; // Label stays constant; only the destination URL changes

                // For paths with query params (e.g. /scan-coach?tab=tte), match full URL; otherwise use path-only match
                const hasQuery = resolvedPath.includes("?");
                const active = !external && (
                  hasQuery
                    ? fullLocation === resolvedPath
                    : (location === resolvedPath || (resolvedPath !== "/" && location.startsWith(resolvedPath)))
                );
                const isCaseLibrary = resolvedPath === "/case-library";
                const innerContent = (
                  <div
                    className={`flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg mb-0.5 transition-all duration-150 group min-h-[44px] lg:min-h-0
                      ${active
                        ? "bg-[#189aa1] text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-[#4ad9e0] group-hover:text-white"}`} />
                    <span className="text-sm font-medium">{resolvedLabel}</span>
                    {/* Lock icon for non-DIY users on the DIY smart link */}
                    {isDiySmartLink && !hasDiyAccess && (
                      <Lock className="w-3 h-3 ml-auto text-white/30 group-hover:text-white/60" />
                    )}
                    {/* Pending badge for Echo Case Library — admin only, not shown when item is active */}
                    {isCaseLibrary && isAdmin && !active && <CasePendingBadge />}
                    {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                    {external && <ExternalLink className="w-3 h-3 ml-auto text-white/40 group-hover:text-white/70" />}
                  </div>
                );
                return external ? (
                  <a key={path} href={resolvedPath} target="_blank" rel="noopener noreferrer">
                    {innerContent}
                  </a>
                ) : (
                  <Link key={path} href={resolvedPath}>
                    {innerContent}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* AAUS Store */}
        <div className="px-3 pb-2">
          <a
            href="https://store.allaboutultrasound.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-150 group w-full"
            style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}
          >
            <ShoppingBag className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-semibold text-white">SonoShop</span>
            <ExternalLink className="w-3 h-3 text-white/70 ml-auto" />
          </a>
        </div>
        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          {brandConfig.brand === "iheartecho" ? (
            <a href="https://www.iheartecho.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#4ad9e0] hover:text-white transition-colors mb-1">
              <ExternalLink className="w-3 h-3" />
              www.iheartecho.com
            </a>
          ) : (
            <a href="https://www.allaboutultrasound.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#4ad9e0] hover:text-white transition-colors mb-1">
              <ExternalLink className="w-3 h-3" />
              www.allaboutultrasound.com
            </a>
          )}
          <div className="text-xs text-white/30">
            {brandConfig.brand === "iheartecho" ? "© iHeartEcho™" : "© All About Ultrasound™"}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-[#189aa1]/20 px-2 sm:px-4 py-2.5 sm:py-3 flex items-center gap-1.5 sm:gap-3 shadow-sm min-w-0">
          <button
            className="lg:hidden p-2 rounded-md text-[#189aa1] hover:bg-[#f0fbfc] min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-[#4ad9e0] animate-pulse flex-shrink-0 hidden sm:block" />
            <span className="text-xs sm:text-sm font-semibold text-[#189aa1] truncate" style={{ fontFamily: "Merriweather, serif" }}>
              {allNavItems.find((n: { path: string; label: string }) => n.path === location)?.label ?? brandNav.title}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 hidden md:block">{brandNav.subtitle}</span>
            {isAuthenticated && <NotificationBell />}
            {/* Account / Login in header */}
            {authLoading ? null : isAuthenticated ? (
              <div className="relative">
                {/* Avatar trigger — click to toggle */}
                <button
                  onClick={() => setAccountOpen(o => !o)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#f0fbfc] transition-all border border-transparent hover:border-[#189aa1]/20"
                >
                  {(user as any).avatarUrl ? (
                    <img
                      src={(user as any).avatarUrl}
                      alt="Avatar"
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-[#189aa1]/30"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}>
                      <span className="text-xs font-bold text-white">
                        {(user?.displayName || user?.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-gray-700 hidden lg:block max-w-[100px] truncate">
                    {user?.displayName || user?.name || "Account"}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform hidden lg:block ${accountOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Click-away overlay */}
                {accountOpen && (
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                )}

                {/* Dropdown */}
                {accountOpen && (() => {
                  const roles: string[] = (user as any).appRoles ?? [];
                  const isPremiumUser = (user as any).isPremium === true;
                  const hasDiyAdmin = roles.includes("diy_admin");
                  const hasPlatformAdmin = roles.includes("platform_admin") || roles.includes("platform_owner") || roles.includes("platform_moderator") || (user as any).role === "admin";
                  const hasAccreditationManager = roles.includes("accreditation_manager") || hasPlatformAdmin;
                  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
                    diy_user:  { label: "DIY Accreditation", color: "#f59e0b" },
                    diy_admin: { label: "Lab Admin",         color: "#f97316" },
                    platform_owner:     { label: "Platform Owner",     color: "#7c3aed" },
                    platform_admin:     { label: "Platform Admin",     color: "#dc2626" },
                    platform_moderator: { label: "Moderator",          color: "#0891b2" },
                    instructor:         { label: "Instructor",         color: "#059669" },
                    team_admin:         { label: "Team Admin",         color: "#d97706" },
                    affiliate:          { label: "Affiliate",          color: "#9333ea" },
                  };
                  const roleBadges = roles.filter(r => ROLE_LABELS[r]).map(r => ROLE_LABELS[r]);
                  const allBadges = [
                    ...(isPremiumUser ? [{ label: "Premium", color: "#189aa1" }] : []),
                    ...roleBadges,
                  ];
                  return (
                    <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      {/* User info header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#f0fbfc] to-white">
                        {(user as any).avatarUrl ? (
                          <img
                            src={(user as any).avatarUrl}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[#189aa1]/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}>
                            <span className="text-base font-bold text-white">
                              {(user?.displayName || user?.name || "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm md:text-base font-semibold text-gray-800 truncate flex items-center gap-1.5">
                            {user?.displayName || user?.name || "Account"}
                            {isPremiumUser && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{ background: "#189aa115", color: "#189aa1", border: "1px solid #189aa140" }}>
                                <Crown className="w-2.5 h-2.5" />
                                PREMIUM
                              </span>
                            )}
                          </div>
                          <div className="text-xs md:text-sm text-gray-400 truncate">{user?.email}</div>
                        </div>
                      </div>

                      {/* Subscription badges */}
                      {allBadges.length > 0 && (
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <a
                            href="/premium"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 hover:text-[#189aa1] transition-colors flex items-center gap-1"
                          >
                            My Subscriptions
                          </a>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {allBadges.map(({ label, color }) => (
                              <a
                                key={label}
                                href="/premium"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                style={{ background: color + "15", color, border: `1px solid ${color}40` }}
                              >
                                {label === "Premium" && <Crown className="w-2.5 h-2.5" />}
                                {label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Profile section */}
                      <div className="px-2 py-1.5">
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Profile</div>
                        <a href="https://members.allaboutultrasound.com/my-dashboard" onClick={() => setAccountOpen(false)}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs md:text-sm text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all text-left">
                          <GraduationCap className="w-3.5 h-3.5 text-[#189aa1]" />
                          My Dashboard
                        </a>
                        <WouterLink href="/case-library/submit">
                          <button onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs md:text-sm text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all text-left">
                            <Plus className="w-3.5 h-3.5 text-[#189aa1]" />
                            Submit Ultrasound Case
                          </button>
                        </WouterLink>
                        <SiteNavProfileLinks
                          items={profileNavItems}
                          location={location}
                          onNavigate={() => setAccountOpen(false)}
                        />
                      </div>

                      {/* Accreditation Portal section — for any DIY user or admin */}
                      {(hasDiyAccess || hasDiyAdmin) && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Accreditation</div>
                          {/* Lab Admin Portal — all DIY users */}
                          <WouterLink href="/lab-admin">
                            <button onClick={() => setAccountOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-all text-left">
                              <Building2 className="w-3.5 h-3.5 text-orange-500" />
                              Lab Admin Portal
                            </button>
                          </WouterLink>
                          {/* Member Portal — all DIY users */}
                          <WouterLink href="/diy-member">
                            <button onClick={() => setAccountOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-all text-left">
                              <Users className="w-3.5 h-3.5 text-orange-500" />
                              Member Portal
                            </button>
                          </WouterLink>
                        </div>
                      )}

                      {/* EducatorAssist™ — admin-only */}
                      {hasPlatformAdmin && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Educator Platform</div>
                          <WouterLink href="/educator-assist">
                            <button onClick={() => setAccountOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-teal-50 hover:text-[#189aa1] transition-all text-left">
                              <GraduationCap className="w-3.5 h-3.5 text-[#189aa1]" />
                              <span className="flex-1">EducatorAssist™</span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Admin</span>
                            </button>
                          </WouterLink>
                        </div>
                      )}

                      {/* Platform Admin section — only for platform_admin */}
                      {hasPlatformAdmin && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Platform Admin</div>
                          <WouterLink href="/platform-admin">
                            <button onClick={() => setAccountOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-teal-50 hover:text-teal-600 transition-all text-left">
                              <Shield className="w-3.5 h-3.5 text-teal-500" />
                              <span className="flex-1">Platform Management</span>
                              <PendingBadge />
                            </button>
                          </WouterLink>
                        </div>
                      )}

                      {/* Accreditation Manager section — for platform_admin and accreditation_manager */}
                      {hasAccreditationManager && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Accreditation</div>
                          <WouterLink href="/accreditation-manager">
                            <button onClick={() => setAccountOpen(false)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left">
                              <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="flex-1">Accreditation Manager</span>
                            </button>
                          </WouterLink>
                        </div>
                      )}

                      {/* Affiliate Dashboard — for users with affiliate role */}
                      {roles.includes("affiliate") && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Affiliate</div>
                          <a href="https://members.allaboutultrasound.com/affiliate-dashboard" onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all text-left">
                            <DollarSign className="w-3.5 h-3.5 text-purple-500" />
                            <span className="flex-1">Affiliate Dashboard</span>
                          </a>
                        </div>
                      )}

                      {/* Instructor Portal — for users with instructor role */}
                      {roles.includes("instructor") && (
                        <div className="px-2 py-1.5 border-t border-gray-100">
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">Instructor</div>
                          <Link href="/instructor-portal" onClick={() => setAccountOpen(false)}
                            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all text-left">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="flex-1">Instructor Portal</span>
                          </Link>
                        </div>
                      )}

                      {/* Sign out */}
                      <div className="px-2 py-1.5 border-t border-gray-100">
                        <button
                          onClick={() => { logout(); setAccountOpen(false); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <a
                  href="/register"
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-all hover:opacity-90 border border-[#189aa1] text-[#189aa1] bg-transparent"
                >
                  Register
                </a>
                <a
                  href="/login"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign In</span>
                </a>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
      <GetAppBanner />
      {/* Name collection gate */}
      <NameCollectionModal />
    </div>
  );
}
