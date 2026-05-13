/**
 * LMSLayout — Dedicated layout for the learn.allaboutultrasound.com subdomain.
 * Shows a simplified sidebar with only LMS-related navigation:
 *   - Education Library (courses, quizzes)
 *   - Digital Downloads (browse, products, bundles, my downloads)
 *   - Media Repository (admin only)
 */
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen, Download, FileDown, Menu, X, ChevronRight,
  ExternalLink, LogIn, LogOut, Settings, ChevronDown,
  GraduationCap, Package, FolderOpen, Crown, Home
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const AAUS_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
const IHE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/iheartecho_logo_ring_01cc7ccd.webp";

const LMS_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "LMS Home", icon: Home },
    ],
  },
  {
    label: "Courses",
    items: [
      { path: "/education-library", label: "Education Library", icon: GraduationCap },
    ],
  },
  {
    label: "Downloads",
    items: [
      { path: "/downloads", label: "Browse Downloads", icon: FileDown },
      { path: "/my-downloads", label: "My Downloads", icon: Download },
    ],
  },
];

const ADMIN_NAV_GROUP = {
  label: "Admin",
  items: [
    { path: "/admin/lms", label: "LMS Admin", icon: Settings },
    { path: "/admin/media-repository", label: "Media Repository", icon: FolderOpen },
  ],
};

export default function LMSLayout({ children }: { children: React.ReactNode }) {
  const [rawLocation] = useLocation();
  const location = rawLocation.split("?")[0];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem("lms-sidebar-scroll");
    if (saved) nav.scrollTop = parseInt(saved, 10);
  }, []);

  const saveNavScroll = () => {
    if (navRef.current) {
      sessionStorage.setItem("lms-sidebar-scroll", String(navRef.current.scrollTop));
    }
  };

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  const navGroups = isPlatformAdmin
    ? [...LMS_NAV_GROUPS, ADMIN_NAV_GROUP]
    : LMS_NAV_GROUPS;

  return (
    <div className="flex min-h-screen bg-[#f0fbfc]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={navRef}
        className={`fixed top-0 left-0 h-full w-64 z-30 flex flex-col overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "linear-gradient(180deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        {/* Header — combined "All About Ultrasound | iHeartEcho" branding */}
        <div className="px-4 py-5 flex items-center gap-2.5 border-b border-white/10">
          <div className="flex items-center gap-1 flex-shrink-0">
            <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-9 h-9 rounded-full" />
            <img src={IHE_LOGO} alt="iHeartEcho" className="w-9 h-9 rounded-full" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white text-[11px] font-medium leading-tight">All About Ultrasound <span className="text-white/50">|</span> iHeartEcho</span>
            <span className="text-[#4ad9e0] text-sm font-bold leading-tight">Learning Platform</span>
          </div>
          <button
            className="ml-auto lg:hidden text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={saveNavScroll}
                    >
                      <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                          isActive
                            ? "bg-white/15 text-white font-semibold shadow-sm"
                            : "text-white/70 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto text-[#4ad9e0]" />}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Back to main app link */}
        <div className="px-3 pb-2">
          <a
            href={import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com"}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-150 group w-full"
            style={{ background: "linear-gradient(135deg, #189aa1 0%, #4ad9e0 100%)" }}
          >
            <ExternalLink className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-semibold text-white">Back to Main App</span>
          </a>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <a href="https://www.allaboutultrasound.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#4ad9e0] hover:text-white transition-colors mb-1">
            <ExternalLink className="w-3 h-3" />
            www.allaboutultrasound.com
          </a>
          <div className="text-xs text-white/30">© All About Ultrasound™ | iHeartEcho</div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 h-14 flex items-center gap-3 px-4 bg-white/80 backdrop-blur border-b border-gray-200/60">
          <button
            className="lg:hidden text-gray-600 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-800 truncate">
              Learning Platform
            </h1>
          </div>

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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                    {(user as any)?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <Link href="/profile" onClick={() => setAccountOpen(false)}>
                        <div className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">My Profile</div>
                      </Link>
                      <button
                        onClick={() => { setAccountOpen(false); logout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
