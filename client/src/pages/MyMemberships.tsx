/**
 * MyMemberships — member-facing page showing a user's active memberships,
 * what they include, and the admin-editable member page content.
 * Route: /my-memberships  (also /my-memberships/:slug for a specific plan)
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlockPreview } from "@/components/BlockPreview";
import { Award, BookOpen, Download, Users, Globe, Package, Tag, ChevronRight, Loader2, Lock } from "lucide-react";

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-4 h-4" />,
  quiz: <BookOpen className="w-4 h-4" />,
  bundle: <Package className="w-4 h-4" />,
  community: <Users className="w-4 h-4" />,
  webinar: <Globe className="w-4 h-4" />,
  download: <Download className="w-4 h-4" />,
  product: <Tag className="w-4 h-4" />,
  all_courses: <BookOpen className="w-4 h-4" />,
  all_downloads: <Download className="w-4 h-4" />,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  quiz: "Quiz",
  bundle: "Bundle",
  community: "Community",
  webinar: "Webinar",
  download: "Download",
  product: "Product",
  all_courses: "All Courses",
  all_downloads: "All Downloads",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  trialing: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-red-100 text-red-600 border-red-200",
  past_due: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export default function MyMemberships() {
  const { slug } = useParams<{ slug?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: memberships, isLoading } = trpc.membership.myMemberships.useQuery(undefined, {
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-500 px-4">
        <Lock className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg font-semibold mb-2">Sign in to view your memberships</p>
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white mt-2"
          onClick={() => navigate("/login?return=/my-memberships")}
        >
          Sign In
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // If a slug is specified, show the detail view for that membership
  if (slug && memberships) {
    const entry = memberships.find((m: any) => m.plan.slug === slug);
    if (entry) {
      return <MembershipDetail entry={entry} onBack={() => navigate("/my-memberships")} />;
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Award className="w-7 h-7 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-900">My Memberships</h1>
      </div>

      {!memberships || memberships.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-600 text-lg">No active memberships</p>
          <p className="text-sm mt-1 mb-6">Explore our membership plans to unlock premium access.</p>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => navigate("/memberships")}
          >
            Browse Memberships
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {memberships.map((entry: any) => (
            <MembershipCard
              key={entry.subscription.id}
              entry={entry}
              onClick={() => navigate(`/my-memberships/${entry.plan.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Membership Card ──────────────────────────────────────────────────────────

function MembershipCard({ entry, onClick }: { entry: any; onClick: () => void }) {
  const { plan, subscription, items } = entry;
  const accentColor = plan.accentColor ?? "#189aa1";

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accentColor }}
      >
        <Award className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-gray-900">{plan.title}</span>
          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[subscription.status] ?? ""}`}>
            {subscription.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {(items ?? []).slice(0, 4).map((item: any, i: number) => (
            <span key={i} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
              <span className="text-gray-400">{ITEM_TYPE_ICONS[item.itemType]}</span>
              {item.label ?? ITEM_TYPE_LABELS[item.itemType]}
            </span>
          ))}
          {items && items.length > 4 && (
            <span className="text-xs text-gray-400">+{items.length - 4} more</span>
          )}
        </div>
        {subscription.currentPeriodEnd && subscription.status === "active" && (
          <p className="text-xs text-gray-400 mt-1">
            Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
    </div>
  );
}

// ─── Membership Detail ────────────────────────────────────────────────────────

function MembershipDetail({ entry, onBack }: { entry: any; onBack: () => void }) {
  const { plan, subscription, items } = entry;
  const accentColor = plan.accentColor ?? "#189aa1";
  const blocks = plan.memberPageBlocks ? JSON.parse(plan.memberPageBlocks) : [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">
            ← Back
          </Button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            <Award className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-gray-900 flex-1 truncate">{plan.title}</h1>
          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[subscription.status] ?? ""}`}>
            {subscription.status}
          </Badge>
        </div>
      </div>

      {/* Admin-configured member page blocks */}
      {blocks.length > 0 ? (
        <div>
          {blocks.map((block: any) => (
            <BlockPreview key={block.id} block={block} />
          ))}
        </div>
      ) : (
        /* Default member page layout */
        <div className="max-w-4xl mx-auto px-4 py-8">
          {plan.description && (
            <p className="text-gray-600 mb-8">{plan.description}</p>
          )}

          {/* Included items */}
          <h2 className="text-lg font-bold text-gray-900 mb-4">Your Access</h2>
          {items && items.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3 mb-8">
              {items.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <div className="text-teal-600 shrink-0">{ITEM_TYPE_ICONS[item.itemType]}</div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {item.label ?? ITEM_TYPE_LABELS[item.itemType]}
                    </p>
                    <p className="text-xs text-gray-500">{ITEM_TYPE_LABELS[item.itemType]}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm mb-8">No specific items listed for this membership.</p>
          )}

          {/* Subscription info */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Subscription Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900 capitalize">{subscription.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Started</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(subscription.createdAt).toLocaleDateString()}
                </dd>
              </div>
              {subscription.currentPeriodEnd && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">
                    {subscription.status === "cancelled" ? "Access until" : "Next renewal"}
                  </dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
