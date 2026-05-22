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
  GraduationCap, ShieldCheck, ArrowLeft, MessageSquare
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";

const AAUS_APP_URL = "https://app.allaboutultrasound.com";
const IHE_APP_URL = "https://app.iheartecho.net";
const LEARN_URL = "https://learn.allaboutultrasound.com";

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [location] = useLocation();

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  function isActive(href: string) {
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
                <span className="text-sm font-bold text-[#189aa1]">Member Hub</span>
              </div>
            </div>
          </Link>

          {/* Return-to-app links — desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <a
              href={AAUS_APP_URL}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              UltrasoundAssist™
            </a>
            <a
              href={IHE_APP_URL}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              EchoAssist™
            </a>
            <a
              href={LEARN_URL}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Learning Platform
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
                        <div className={`px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex items-center gap-2 ${isActive("/my-dashboard") ? "text-teal-700 font-medium" : "text-gray-700"}`}>
                          <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" /> My Dashboard
                        </div>
                      </Link>
                      {/* App return links — mobile */}
                      <div className="md:hidden border-t border-gray-100 mt-1 pt-1">
                        <a href={AAUS_APP_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> UltrasoundAssist™
                        </a>
                        <a href={IHE_APP_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> EchoAssist™
                        </a>
                        <a href={LEARN_URL} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setAccountOpen(false)}>
                          <GraduationCap className="w-3.5 h-3.5 text-gray-500" /> Learning Platform
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
                          <Link href="/admin/lesson-comments" onClick={() => setAccountOpen(false)}>
                            <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-500" /> Lesson Comments
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
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
