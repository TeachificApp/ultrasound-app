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
  BookOpen, Menu, X, ShieldCheck
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
const MEMBERS_URL = "https://members.allaboutultrasound.com";
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
];

export default function LMSLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-[#f0fbfc]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/60 shadow-sm">
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Logo + branding */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
              <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-8 h-8 rounded-full" />
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-medium text-gray-500">All About Ultrasound™ | iHeartEcho™</span>
                <span className="text-sm font-bold text-[#189aa1]">Learning Platform</span>
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive(item.href, item.exact)
                      ? "bg-[#189aa1]/10 text-[#189aa1]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            ))}
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}>
                    {(user as any)?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
                    {(user as any)?.name || (user as any)?.email || "Account"}
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
                          {(user as any)?.name || "Account"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {(user as any)?.email || ""}
                        </p>
                      </div>

                      {/* My Dashboard → members hub */}
                      <a
                        href={`${MEMBERS_URL}/my-dashboard`}
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => setAccountOpen(false)}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" /> My Dashboard
                      </a>
                      {isPlatformAdmin && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</div>
                          <Link href="/platform-admin" onClick={() => setAccountOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" /> Platform Admin
                            </div>
                          </Link>
                          <Link href="/admin/lms" onClick={() => setAccountOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <Settings className="w-3.5 h-3.5 text-gray-500" /> LMS Admin
                            </div>
                          </Link>
                          <Link href="/admin/media-repository" onClick={() => setAccountOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <FolderOpen className="w-3.5 h-3.5 text-gray-500" /> Media Repository
                            </div>
                          </Link>
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
              className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setAccountOpen(false); }}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive(item.href, item.exact)
                      ? "bg-[#189aa1]/10 text-[#189aa1]"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1 flex flex-col gap-1">
              <a
                href={AAUS_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ExternalLink className="w-4 h-4" /> All About Ultrasound™
              </a>
              <a
                href={IHE_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ExternalLink className="w-4 h-4" /> iHeartEcho™
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Page content — full width, no sidebar offset */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
