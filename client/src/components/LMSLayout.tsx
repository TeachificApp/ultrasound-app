/**
 * LMSLayout — Dedicated layout for the learn.allaboutultrasound.com subdomain.
 * No sidebar — navigation is handled via the top header only.
 *
 * My Dashboard and My Profile redirect to members.allaboutultrasound.com
 * (the single hub for profile/subscriptions across all apps).
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LogIn, LogOut, Settings, ChevronDown,
  GraduationCap, FolderOpen, ExternalLink, LayoutDashboard,
  BookOpen, Menu, X, ShieldCheck, MessageSquare, Users, DollarSign, Briefcase
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import NameCollectionModal from "@/components/NameCollectionModal";
import UserAvatar from "@/components/UserAvatar";
import { AAUS_BRAND_LOGO_URL } from "@shared/brands";

const AAUS_LOGO = AAUS_BRAND_LOGO_URL;
const MEMBERS_URL = "https://members.allaboutultrasound.com";
import { getAdminUrl, APP_URL } from "@/hooks/useSubdomain";
import { useSiteNavMenu } from "@/hooks/useSiteNavMenu";
import { SiteNavHeaderLinks, SiteNavProfileLinks } from "@/components/SiteNavLinks";
import { trpc } from "@/lib/trpc";
const AAUS_APP_URL = "https://app.allaboutultrasound.com";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  external?: boolean;
}

const AAUS_SITE_URL = "https://www.allaboutultrasound.com";
const IHE_SITE_URL = "https://www.iheartecho.com";

const NAV_ITEMS: NavItem[] = [
  { label: "Education Library", href: "/education-library", icon: <BookOpen className="w-4 h-4" /> },
  { label: "Workshops", href: "/workshops", icon: <Briefcase className="w-4 h-4" /> },
  { label: "Community", href: "/community/all-about-ultrasound", icon: <Users className="w-4 h-4" /> },
];

export default function LMSLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { items: headerNavItems } = useSiteNavMenu("header", NAV_ITEMS.map((item) => ({
    label: item.label,
    href: item.href,
    external: item.external,
  })));
  const { items: profileNavItems } = useSiteNavMenu("profile", []);

  // Funnel pages (/:slug/:pageSlug) should render without the LMS header.
  // Detect by checking: two path segments, not starting with any known system prefix.
  const SYSTEM_PREFIXES = ["/admin", "/courses", "/downloads", "/product", "/media",
    "/my-", "/auth", "/login", "/register", "/profile", "/platform-admin",
    "/education-library", "/collections", "/bundles", "/quiz", "/community"];
  const isFunnelPage = (() => {
    const parts = location.replace(/^\//,"").split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    return !SYSTEM_PREFIXES.some(p => location.startsWith(p));
  })();

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const { data: quizResultsSummary } = trpc.standaloneQuizLearner.getMyQuizResultsSummary.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const showQuizResultsLink = Boolean(quizResultsSummary?.hasNativeQuizAttempts);
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location.startsWith(href);
  }

  // Funnel pages render standalone — no header, no LMS chrome
  if (isFunnelPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f0fbfc]">
      {/* Mobile nav overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      {/* Mobile nav drawer — slide in from right */}
      {mobileMenuOpen && (
        <div className="fixed top-0 right-0 bottom-0 z-50 w-[85vw] max-w-xs bg-white shadow-2xl flex flex-col md:hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-9 h-9 rounded-full" />
              <div>
                <div className="text-sm font-bold text-[#189aa1]">Learning Platform</div>
                <div className="text-[10px] text-gray-400">All About Ultrasound™</div>
              </div>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 min-w-[40px] min-h-[40px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Navigation</p>
            <SiteNavHeaderLinks
              items={headerNavItems}
              location={location}
              onNavigate={() => setMobileMenuOpen(false)}
              className="flex-col items-stretch gap-0.5"
            />
            <div className="border-t border-gray-100 my-3" />
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">More</p>
            <a href={AAUS_SITE_URL} target="_blank" rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all min-h-[52px]">
              <ExternalLink className="w-5 h-5 text-[#189aa1] flex-shrink-0" />
              <span className="flex-1">All About Ultrasound™</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
            </a>
            <a href={IHE_SITE_URL} target="_blank" rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all min-h-[52px]">
              <ExternalLink className="w-5 h-5 text-[#189aa1] flex-shrink-0" />
              <span className="flex-1">iHeartEcho™</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
            </a>
            <a href={AAUS_APP_URL} target="_blank" rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all min-h-[52px]">
              <ExternalLink className="w-5 h-5 text-[#189aa1] flex-shrink-0" />
              <span className="flex-1">UltrasoundAssist™ App</span>
              <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
            </a>
            {isPlatformAdmin && (
              <>
                <div className="border-t border-gray-100 my-3" />
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</p>
                <a href={getAdminUrl("/platform-admin")} onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-all min-h-[52px]">
                  <ShieldCheck className="w-5 h-5 text-orange-500 flex-shrink-0" /> Platform Admin
                </a>
                <a href={getAdminUrl("/admin/lms")} onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-all min-h-[52px]">
                  <Settings className="w-5 h-5 text-orange-500 flex-shrink-0" /> LMS Admin
                </a>
              </>
            )}
          </nav>
          {isAuthenticated && (
            <div className="px-3 pb-6 pt-2 border-t border-gray-100">
              <button onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all min-h-[52px]">
                <LogOut className="w-5 h-5 flex-shrink-0" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/60 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14">
          {/* Logo + branding */}
          <Link href="/">
            <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-7 sm:w-8 h-7 sm:h-8 rounded-full" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 hidden sm:block">All About Ultrasound™ | iHeartEcho™</span>
                <span className="text-xs sm:text-sm font-bold text-[#189aa1]">Learning Platform</span>
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <SiteNavHeaderLinks
            items={headerNavItems}
            location={location}
            className="hidden md:flex ml-4"
          />
          <nav className="hidden md:flex items-center gap-1">
            {/* External brand links */}
            <a
              href={AAUS_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              All About Ultrasound™
            </a>
            <a
              href={IHE_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              iHeartEcho™
            </a>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationBell />}

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => { setAccountOpen(!accountOpen); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <UserAvatar
                    avatarUrl={(user as any)?.avatarUrl}
                    name={(user as any)?.name}
                    displayName={(user as any)?.displayName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#189aa1]/30"
                    fallbackClassName="w-7 h-7"
                  />
                  <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
                    {(user as any)?.displayName || (user as any)?.name || (user as any)?.email || "Account"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                      {/* User info */}
                      <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {(user as any)?.displayName || (user as any)?.name || "Account"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {(user as any)?.email || ""}
                        </p>
                      </div>

                      {/* My Dashboard — stays on learn domain */}
                      <a
                        href="/my-dashboard"
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => setAccountOpen(false)}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" /> My Dashboard
                      </a>
                      {showQuizResultsLink && (
                        <a
                          href="/my-quizzes"
                          className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => setAccountOpen(false)}
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-teal-600" /> My Quiz Results
                        </a>
                      )}
                      <SiteNavProfileLinks
                        items={profileNavItems}
                        location={location}
                        onNavigate={() => setAccountOpen(false)}
                      />
                      {isPlatformAdmin && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</div>
                          <a href={getAdminUrl("/platform-admin")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" /> Platform Admin
                          </a>
                          <a href={getAdminUrl("/admin/lms")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <Settings className="w-3.5 h-3.5 text-gray-500" /> LMS Admin
                          </a>
                          <a href={getAdminUrl("/admin/media-repository")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <FolderOpen className="w-3.5 h-3.5 text-gray-500" /> Media Repository
                          </a>
                          <a href={getAdminUrl("/admin/lesson-comments")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-500" /> Lesson Comments
                          </a>
                          <a href={getAdminUrl("/admin/community")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-gray-500" /> Community Admin
                          </a>
                        </>
                      )}

                      {/* Affiliate Dashboard */}
                      {appRoles.includes("affiliate") && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Affiliate</div>
                          <a href={`${MEMBERS_URL}/affiliate-dashboard`} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 cursor-pointer flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-purple-500" /> Affiliate Dashboard
                          </a>
                        </>
                      )}

                      {/* Instructor Portal */}
                      {appRoles.includes("instructor") && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Instructor</div>
                          <a href={`${MEMBERS_URL}/instructor-portal`} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-500" /> Instructor Portal
                          </a>
                        </>
                      )}

                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setAccountOpen(false); logout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-xl"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href={getLoginUrl()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </a>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setAccountOpen(false); }}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>

      </header>

      {/* Page content — full width, no sidebar offset */}
      <main className="flex-1">
        {children}
      </main>

      {/* Name collection gate — shown to authenticated users without a full name */}
      <NameCollectionModal />
    </div>
  );
}
