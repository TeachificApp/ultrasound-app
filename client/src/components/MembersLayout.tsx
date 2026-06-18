/**
 * MembersLayout — Dedicated layout for members.allaboutultrasound.com
 *
 * This is the single hub for profile, subscriptions, and dashboard data
 * across all apps. The header shows:
 *  - Combined "All About Ultrasound™ | iHeartEcho™" branding
 *  - Return links to both app.allaboutultrasound.com and app.iheartecho.net
 *  - Notification bell + profile dropdown with admin items
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LogIn, LogOut, Settings, ChevronDown,
  FolderOpen, ExternalLink, LayoutDashboard,
  GraduationCap, ShieldCheck, ArrowLeft, MessageSquare, Users, Menu, X
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { getAdminUrl } from "@/hooks/useSubdomain";
import NameCollectionModal from "@/components/NameCollectionModal";

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";

const AAUS_APP_URL = "https://app.allaboutultrasound.com";
const IHE_APP_URL = "https://app.iheartecho.com";
const LEARN_URL = "https://learn.allaboutultrasound.com";

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location] = useLocation();

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  function isActive(href: string) {
    return location.startsWith(href);
  }

  // Funnel pages (/:slug/:pageSlug) and standalone landing pages render without the Members header.
  const SYSTEM_PREFIXES = ["/admin", "/courses", "/downloads", "/product", "/media",
    "/my-", "/auth", "/login", "/register", "/profile", "/platform-admin",
    "/education-library", "/collections", "/bundles", "/quiz"];
  const isFunnelPage = (() => {
    const parts = location.replace(/^\//,"").split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    return !SYSTEM_PREFIXES.some(p => location.startsWith(p));
  })();

  // Standalone pages render without Members chrome
  if (isFunnelPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f0fbfc]">
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col md:hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-7 h-7 rounded-full" />
              <span className="text-sm font-bold text-[#189aa1]">Member Hub</span>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Navigation</p>
            <a href={LEARN_URL} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <GraduationCap className="w-4 h-4 text-[#189aa1]" /> Learning Platform
            </a>
            <a href={`${LEARN_URL}/community`} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <Users className="w-4 h-4 text-[#189aa1]" /> Community
            </a>
            <a href={AAUS_APP_URL} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <ExternalLink className="w-4 h-4 text-[#189aa1]" /> UltrasoundAssist™
            </a>
            <a href={IHE_APP_URL} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
              <ExternalLink className="w-4 h-4 text-[#189aa1]" /> EchoAssist™
            </a>
            {isPlatformAdmin && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</p>
                <a href={getAdminUrl("/platform-admin")} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
                  <ShieldCheck className="w-4 h-4 text-gray-500" /> Platform Admin
                </a>
                <a href={getAdminUrl("/admin/lms")} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-h-[44px]">
                  <Settings className="w-4 h-4 text-gray-500" /> LMS Admin
                </a>
              </>
            )}
          </nav>
        </div>
      )}
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/60 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          {/* Logo + branding */}
          <Link href="/">
            <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-7 sm:w-8 h-7 sm:h-8 rounded-full" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 hidden sm:block">All About Ultrasound™ | iHeartEcho™</span>
                <span className="text-xs sm:text-sm font-bold text-[#189aa1]">Member Hub</span>
              </div>
            </div>
          </Link>

          {/* Nav links — desktop (matches LMS nav order) */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <a
              href={LEARN_URL}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Learning Platform
            </a>
            <a
              href={`${LEARN_URL}/community`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <Users className="w-3.5 h-3.5" />
              Community
            </a>
            <a
              href={AAUS_APP_URL}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              UltrasoundAssist™
            </a>
            <a
              href={IHE_APP_URL}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              EchoAssist™
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
                  onClick={() => setAccountOpen(!accountOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {(user as any)?.avatarUrl ? (
                    <img src={(user as any).avatarUrl} alt={(user as any)?.displayName || (user as any)?.name || 'U'} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}>
                      {((user as any)?.displayName || (user as any)?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
                    {(user as any)?.displayName || (user as any)?.name || (user as any)?.email || "Account"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                      {/* User info */}
                      <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {(user as any)?.displayName || (user as any)?.name || "Account"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {(user as any)?.email || ""}
                        </p>
                      </div>

                      <Link href="/my-dashboard" onClick={() => setAccountOpen(false)}>
                        <div className={`px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2 ${isActive("/my-dashboard") ? "text-teal-700 font-medium" : "text-gray-700"}`}>
                          <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" /> My Dashboard
                        </div>
                      </Link>
                      {/* App return links — mobile (matches LMS nav order) */}
                      <div className="md:hidden border-t border-gray-100 mt-1 pt-1">
                        <a href={LEARN_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <GraduationCap className="w-3.5 h-3.5 text-gray-500" /> Learning Platform
                        </a>
                        <a href={`${LEARN_URL}/community`} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <Users className="w-3.5 h-3.5 text-gray-500" /> Community
                        </a>
                        <a href={AAUS_APP_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> UltrasoundAssist™
                        </a>
                        <a href={IHE_APP_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> EchoAssist™
                        </a>
                      </div>

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
          </div>
        </div>
      </header>

      {/* Breadcrumb bar — shown on admin sub-pages */}
      {location.startsWith("/platform-admin") && (
        <div className="bg-white border-b border-gray-100 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 text-sm text-gray-500">
            <Link href="/my-dashboard" className="hover:text-teal-600 transition-colors">Member Hub</Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-medium">Platform Admin</span>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Name collection gate */}
      <NameCollectionModal />
    </div>
  );
}
