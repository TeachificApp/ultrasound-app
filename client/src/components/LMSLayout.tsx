/**
 * LMSLayout — Dedicated layout for the learn.allaboutultrasound.com subdomain.
 * No sidebar — navigation is handled via the top header only.
 * Admin items (LMS Admin, Media Repository, Platform Admin) are accessible from the profile dropdown.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LogIn, LogOut, Settings, ChevronDown,
  GraduationCap, FolderOpen, ExternalLink, LayoutDashboard,
  BookOpen, Download, Menu, X, Home, ShieldCheck
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: <Home className="w-4 h-4" />, exact: true },
  { label: "Education Library", href: "/education-library", icon: <BookOpen className="w-4 h-4" /> },
  { label: "Downloads", href: "/downloads", icon: <Download className="w-4 h-4" /> },
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
            {isAuthenticated && (
              <Link href="/my-dashboard">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive("/my-dashboard")
                      ? "bg-[#189aa1]/10 text-[#189aa1]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  My Dashboard
                </div>
              </Link>
            )}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Back to main app — desktop only */}
            <a
              href={import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com"}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#189aa1]/30 text-[#189aa1] text-xs font-medium hover:bg-[#189aa1]/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Main App
            </a>

            {isAuthenticated && <NotificationBell />}

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => { setAccountOpen(!accountOpen); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                      {/* User info */}
                      <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {(user as any)?.name || "Account"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {(user as any)?.email || ""}
                        </p>
                      </div>

                      <Link href="/my-dashboard" onClick={() => setAccountOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                          <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" /> My Dashboard
                        </div>
                      </Link>
                      <Link href="/profile" onClick={() => setAccountOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-teal-600" /> My Profile
                        </div>
                      </Link>
                      <Link href="/my-downloads" onClick={() => setAccountOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 text-teal-600" /> My Downloads
                        </div>
                      </Link>

                      {/* Main App link — mobile */}
                      <div className="lg:hidden border-t border-gray-100 mt-1 pt-1">
                        <a
                          href={import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com"}
                          className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => setAccountOpen(false)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> Main App
                        </a>
                      </div>

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
            {isAuthenticated && (
              <Link href="/my-dashboard" onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive("/my-dashboard")
                      ? "bg-[#189aa1]/10 text-[#189aa1]"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  My Dashboard
                </div>
              </Link>
            )}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <a
                href={import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com"}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ExternalLink className="w-4 h-4" /> Main App
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
