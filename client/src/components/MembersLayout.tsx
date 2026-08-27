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
import { useSiteNavMenu } from "@/hooks/useSiteNavMenu";
import { SiteNavHeaderLinks, SiteNavProfileLinks } from "@/components/SiteNavLinks";
import NameCollectionModal from "@/components/NameCollectionModal";
import UserAvatar from "@/components/UserAvatar";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";
import { AAUS_BRAND_LOGO_URL } from "@shared/brands";

const AAUS_LOGO = AAUS_BRAND_LOGO_URL;

const AAUS_APP_URL = "https://app.allaboutultrasound.com";
const IHE_APP_URL = "https://app.iheartecho.com";
const LEARN_URL = "https://learn.allaboutultrasound.com";

const DEFAULT_HEADER_NAV = [
  { label: "Learning Platform", href: LEARN_URL, external: true },
  { label: "Community", href: `${LEARN_URL}/community`, external: true },
  { label: "UltrasoundAssist™", href: AAUS_APP_URL, external: true },
  { label: "EchoAssist™", href: IHE_APP_URL, external: true },
];

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location] = useLocation();
  const { items: headerNavItems } = useSiteNavMenu("header", DEFAULT_HEADER_NAV);
  const { items: profileNavItems } = useSiteNavMenu("profile", []);

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
        <div className="fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-xs bg-white shadow-2xl flex flex-col md:hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-9 h-9 rounded-full" />
              <div>
                <div className="text-sm font-bold text-[#189aa1]">Member Hub</div>
                <div className="text-[10px] text-gray-400">All About Ultrasound™</div>
              </div>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 min-w-[40px] min-h-[40px] flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Links</p>
            {[
              { href: AAUS_APP_URL, label: "UltrasoundAssist™", icon: ExternalLink, external: true },
              { href: IHE_APP_URL, label: "EchoAssist™", icon: ExternalLink, external: true },
              { href: LEARN_URL, label: "Learning Platform", icon: GraduationCap, external: true },
              { href: `${LEARN_URL}/community`, label: "Community", icon: Users, external: true },
            ].map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-[#f0fbfc] hover:text-[#189aa1] transition-all min-h-[52px]">
                <Icon className="w-5 h-5 text-[#189aa1] flex-shrink-0" />
                <span className="flex-1">{label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
              </a>
            ))}
            <SiteNavHeaderLinks
              items={headerNavItems.filter((i: any) => !DEFAULT_HEADER_NAV.some(d => d.href === i.href))}
              location={location}
              onNavigate={() => setMobileNavOpen(false)}
              className="flex-col items-stretch gap-0.5"
            />
            {isPlatformAdmin && (
              <>
                <div className="border-t border-gray-100 my-3" />
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</p>
                <a href={getAdminUrl("/platform-admin")} onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-all min-h-[52px]">
                  <ShieldCheck className="w-5 h-5 text-orange-500 flex-shrink-0" /> Platform Admin
                </a>
                <a href={getAdminUrl("/admin/lms")} onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-all min-h-[52px]">
                  <Settings className="w-5 h-5 text-orange-500 flex-shrink-0" /> LMS Admin
                </a>
              </>
            )}
          </nav>
          {/* Sign out at bottom of drawer */}
          <div className="px-3 pb-6 pt-2 border-t border-gray-100">
            {isAuthenticated && (
              <button onClick={() => { logout(); setMobileNavOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all min-h-[52px]">
                <LogOut className="w-5 h-5 flex-shrink-0" /> Sign Out
              </button>
            )}
          </div>
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
          <SiteNavHeaderLinks
            items={headerNavItems}
            location={location}
            className="hidden md:flex ml-4"
          />

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
                  <UserAvatar
                    avatarUrl={(user as any)?.avatarUrl}
                    name={(user as any)?.name}
                    displayName={(user as any)?.displayName}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
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
                      <SiteNavProfileLinks
                        items={profileNavItems}
                        location={location}
                        onNavigate={() => setAccountOpen(false)}
                      />
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

      {/* Page content — bottom padding on mobile so content isn't hidden behind bottom nav */}
      <main className="flex-1 pb-safe">
        {children}
      </main>

      {/* Name collection gate */}
      <NameCollectionModal />
    </div>
  );
}
