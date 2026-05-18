/**
 * DIYAccreditationAdmin.tsx
 * Hub page for the DIY Accreditation division.
 * Accessible at /admin/diy-accreditation (and as the home page of accreditation.iheartecho.com)
 *
 * Sections:
 *   1. Quick-access tool cards (DIY Accreditation Tool, Accreditation Navigator, Form Builder,
 *      Accreditation Manager, Lab Admin, DIY Plans)
 *   2. DIY Organization overview (org count, seat stats)
 *   3. Quick links to AccreditationManager
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ClipboardList,
  Building2,
  Users,
  BarChart2,
  FileText,
  ChevronRight,
  Lock,
  Stethoscope,
  Globe,
  Star,
  Zap,
  Settings,
  ExternalLink,
  BookOpen,
  Award,
  RefreshCw,
  Map,
} from "lucide-react";

const BRAND = "#0891b2";
const BRAND_DARK = "#0e4a50";
const AQUA = "#4ad9e0";

interface ToolCard {
  id: string;
  href: string;
  icon: React.ComponentType<any>;
  label: string;
  description: string;
  color: string;
  badge?: string;
  external?: boolean;
}

const DIY_TOOL_CARDS: ToolCard[] = [
  {
    id: "accreditation-tool",
    href: "/accreditation",
    icon: Stethoscope,
    label: "DIY Accreditation Tool™",
    description: "The main accreditation workflow tool for labs and sonographers",
    color: "#0891b2",
    badge: "Core Tool",
  },
  {
    id: "accreditation-navigator",
    href: "/accreditation-navigator",
    icon: Map,
    label: "Accreditation Navigator",
    description: "Step-by-step accreditation readiness navigator for DIY labs",
    color: "#7c3aed",
  },
  {
    id: "form-builder",
    href: "/admin/form-builder",
    icon: ClipboardList,
    label: "DIY Accreditation Forms",
    description: "Build accreditation review forms with org-based visibility rules and quality scoring",
    color: "#0891b2",
    badge: "Admin",
  },
  {
    id: "accreditation-manager",
    href: "/accreditation-manager",
    icon: Building2,
    label: "Accreditation Manager",
    description: "Manage DIY organizations, seats, readiness, and managed accounts",
    color: "#059669",
    badge: "Admin",
  },
  {
    id: "lab-admin",
    href: "/lab-admin",
    icon: Shield,
    label: "Lab Admin Portal",
    description: "Per-lab admin portal: staff, image quality, peer review, analytics",
    color: "#be185d",
  },
  {
    id: "diy-plans",
    href: "/diy-accreditation-plans",
    icon: Star,
    label: "DIY Accreditation Plans",
    description: "View and manage DIY Accreditation subscription plans and pricing",
    color: "#d97706",
  },
  {
    id: "diy-member",
    href: "/diy-member",
    icon: Users,
    label: "DIY Member Portal",
    description: "Member-facing portal for DIY Accreditation participants",
    color: "#6366f1",
  },
  {
    id: "accreditation-readiness",
    href: "/accreditation-readiness",
    icon: Award,
    label: "Accreditation Readiness",
    description: "Readiness assessment and scoring dashboard",
    color: "#0f766e",
  },
];

function ToolCardItem({ card }: { card: ToolCard }) {
  const Icon = card.icon;
  return (
    <Link href={card.href}>
      <div className="group relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex flex-col gap-2 h-full">
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: card.color + "18" }}
          >
            <Icon className="w-5 h-5" style={{ color: card.color }} />
          </div>
          {card.badge && (
            <Badge
              className="text-[10px] px-1.5 py-0.5"
              style={{ background: card.color + "18", color: card.color, border: "none" }}
            >
              {card.badge}
            </Badge>
          )}
        </div>
        <div>
          <div className="font-semibold text-gray-800 text-sm group-hover:text-[#0891b2] transition-colors">
            {card.label}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{card.description}</div>
        </div>
        <div className="mt-auto pt-1 flex items-center gap-1 text-xs font-medium" style={{ color: card.color }}>
          Open <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function OrgStatsPanel() {
  const { data: orgs, isLoading } = trpc.diy.adminListOrgs.useQuery();
  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[1,2,3,4].map(i => (
        <Card key={i} className="border-0 shadow-sm animate-pulse">
          <CardContent className="p-4 h-20" />
        </Card>
      ))}
    </div>
  );
  const total = orgs?.length ?? 0;
  const active = orgs?.filter((o: any) => o.subscription?.status === "active").length ?? 0;
  const totalSeats = orgs?.reduce((sum: number, o: any) => sum + (o.subscription?.totalSeats ?? 0), 0) ?? 0;
  const usedSeats = orgs?.reduce((sum: number, o: any) => sum + (o.memberCount ?? 0), 0) ?? 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[
        { label: "DIY Organizations", value: total, icon: Building2, color: "#0891b2" },
        { label: "Active Subscriptions", value: active, icon: Zap, color: "#059669" },
        { label: "Total Seats", value: totalSeats, icon: Users, color: "#7c3aed" },
        { label: "Seats In Use", value: usedSeats, icon: Stethoscope, color: "#d97706" },
      ].map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DIYAccreditationAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const isAdmin = (user as any)?.role === "admin";
  const userRoles: string[] = (user as any)?.roles ?? [];
  const hasDiyAccess = isAdmin
    || userRoles.includes("platform_admin")
    || userRoles.includes("diy_admin")
    || userRoles.includes("accreditation_manager");

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Lock className="w-5 h-5 mr-2" /> Sign in required
        </div>
      </Layout>
    );
  }

  if (!hasDiyAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Lock className="w-5 h-5 mr-2" /> DIY Admin or Platform Admin access required
        </div>
      </Layout>
    );
  }

  // Filter cards based on role
  const visibleCards = DIY_TOOL_CARDS.filter(card => {
    const adminOnly = ["form-builder", "accreditation-manager"].includes(card.id);
    if (adminOnly) return isAdmin || userRoles.includes("platform_admin") || userRoles.includes("accreditation_manager");
    return true;
  });

  return (
    <Layout>
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${AQUA})` }}
            >
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold text-gray-900"
                style={{ fontFamily: "Merriweather, serif" }}
              >
                DIY Accreditation™
              </h1>
              <p className="text-sm text-gray-500">
                Accreditation tools, navigator, forms, and organization management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/platform-admin">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5" />
                Platform Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        {(isAdmin || userRoles.includes("platform_admin") || userRoles.includes("accreditation_manager")) && (
          <OrgStatsPanel />
        )}

        {/* Tool Cards */}
        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Accreditation Tools
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              All DIY Accreditation tools in one place
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleCards.map(card => (
              <ToolCardItem key={card.id} card={card} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        {(isAdmin || userRoles.includes("platform_admin") || userRoles.includes("accreditation_manager")) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#0891b2]" />
                  Organization Management
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-gray-500">
                  Manage DIY Accreditation organizations, seat assignments, subscriptions, and readiness reviews.
                </p>
                <Link href="/accreditation-manager">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs text-white"
                    style={{ background: BRAND }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Open Accreditation Manager
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#0891b2]" />
                  Accreditation Forms
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-gray-500">
                  Build and manage accreditation review forms with org-based visibility rules, quality scoring, and branching logic.
                </p>
                <Link href="/admin/form-builder">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs text-white"
                    style={{ background: BRAND }}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Open Form Builder
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Domain note */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <strong>accreditation.iheartecho.com</strong> — This division is also accessible at the dedicated accreditation subdomain.
          All tools here are shared with the main platform and use the same database.
        </div>
      </div>
    </Layout>
  );
}
