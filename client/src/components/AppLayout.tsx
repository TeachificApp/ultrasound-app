import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Crown,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Microscope,
  Star,
  Trophy,
  Users,
  Volume2,
  X,
  Zap,
  GraduationCap,
  FileText,
  Shield,
  ExternalLink,
} from "lucide-react";
import { AAUS_LOGO_URL, THINKIFIC_LINKS } from "@shared/appConstants";

const AAUS_LOGO = AAUS_LOGO_URL;

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  external?: boolean;
  premium?: boolean;
  badge?: string;
  children?: NavItem[];
  hidden?: boolean;
}

type NavGroupItem = NavItem;

const navGroups: { label: string; items: NavGroupItem[] }[] = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/", icon: <Home size={16} /> },
    ],
  },
  {
    label: "CLINICAL TOOLS",
    items: [
      { label: "UltrasoundAssist™", href: "/ultrasound-assist", icon: <Activity size={16} />, badge: "NEW" },
      { label: "POCUS-Assist™", href: "/pocus-assist", icon: <Zap size={16} /> },
      { label: "Fetal EchoAssist™", href: "/fetal-echo-assist", icon: <Heart size={16} /> },
    ],
  },
  {
    label: "LEARNING",
    items: [
      { label: "Daily Challenge", href: "/daily-challenge", icon: <Brain size={16} /> },
      { label: "Ultrasound Flashcards", href: "/flashcards", icon: <BookOpen size={16} /> },
      { label: "Case Library", href: "/case-library", icon: <FileText size={16} /> },
      { label: "Leaderboard", href: "/leaderboard", icon: <Trophy size={16} /> },
      { label: "SoundBytes™", href: "/soundbytes", icon: <Volume2 size={16} /> },
      { label: "CME Hub", href: THINKIFIC_LINKS.cmeHub, icon: <GraduationCap size={16} />, external: true },
      { label: "Learn Fetal Echo", href: THINKIFIC_LINKS.learnFetalEcho, icon: <Heart size={16} />, external: true },
    ],
  },
  {
    label: "ACCREDITATION",
    items: [
      { label: "Accreditation Navigator", href: "#", icon: <Shield size={16} />, hidden: true },
      { label: "DIY Accreditation", href: "#", icon: <Shield size={16} />, hidden: true },
    ],
  },
  {
    label: "COMMUNITY",
    items: [
      { label: "Community", href: THINKIFIC_LINKS.community, icon: <Users size={16} />, external: true },
    ],
  },
  {
    label: "PREMIUM",
    items: [
      { label: "Premium Access", href: "/premium", icon: <Crown size={16} />, premium: true },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const isPremium = user?.membershipTier === "premium" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    if (item.hidden) return null;
    const isActive = item.href === location || (item.href !== "/" && location.startsWith(item.href ?? ""));
    const content = (
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
        onClick={onClick}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">{item.badge}</Badge>
        )}
        {item.premium && !isPremium && (
          <Crown size={12} className="text-yellow-400 flex-shrink-0" />
        )}
        {item.external && <ExternalLink size={12} className="opacity-50 flex-shrink-0" />}
      </div>
    );

    if (item.external) {
      return (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className="block">
          {content}
        </a>
      );
    }
    return (
      <Link href={item.href ?? "#"} className="block">
        {content}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-3">
          <img src={AAUS_LOGO} alt="All About Ultrasound" className="w-12 h-12 rounded-full object-cover" />
          <div>
            <div className="text-sidebar-foreground font-bold text-sm leading-tight">UltrasoundAssist™</div>
            <div className="text-sidebar-foreground/60 text-[10px] leading-tight">All About Ultrasound™</div>
          </div>
        </Link>
      </div>

      {/* User info */}
      {isAuthenticated && user && (
        <div className="px-4 py-3 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold">
              {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sidebar-foreground text-xs font-medium truncate">{user.name ?? user.email}</div>
              <div className="flex items-center gap-1">
                {isPremium ? (
                  <Badge className="text-[9px] px-1 py-0 bg-yellow-500 text-white">PREMIUM</Badge>
                ) : (
                  <Badge className="text-[9px] px-1 py-0 bg-sidebar-accent text-sidebar-accent-foreground">FREE</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4 sidebar-nav">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => !item.hidden);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink key={item.label} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          );
        })}

        {isAdmin && (
          <div>
            <div className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-1">
              ADMIN
            </div>
            <NavLink
              item={{ label: "Admin Dashboard", href: "/admin", icon: <LayoutDashboard size={16} /> }}
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}
      </nav>

      {/* Auth buttons */}
      <div className="p-3 border-t border-sidebar-border flex-shrink-0">
        {isAuthenticated ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground justify-start gap-2"
            onClick={() => logout()}
          >
            <LogOut size={14} />
            Sign Out
          </Button>
        ) : (
          <div className="space-y-2">
            <a href={getLoginUrl()} className="block">
              <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Sign In
              </Button>
            </a>
            <a href={THINKIFIC_LINKS.freeRegister} target="_blank" rel="noopener noreferrer" className="block">
              <Button size="sm" variant="outline" className="w-full text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent">
                Register Free
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-sidebar-foreground p-1 rounded"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img src={AAUS_LOGO} alt="AAUS" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-sidebar-foreground font-bold text-sm">UltrasoundAssist™</span>
          </div>
          {!isAuthenticated ? (
            <a href={getLoginUrl()}>
              <Button size="sm" className="text-xs px-2 py-1 h-7">Sign In</Button>
            </a>
          ) : (
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold">
              {(user?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
