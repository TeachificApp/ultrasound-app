import React, { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Tag, Users, Package, LayoutTemplate,
  ChevronRight, GripVertical, X, Copy, RefreshCw, DollarSign, Percent,
  BookOpen, Download, Globe, Lock, Settings, FileText, Award, Search,
  Loader2, CheckCircle2, AlertTriangle, RotateCcw, Workflow, Code
} from "lucide-react";
import MembershipPageBuilder from "@/components/MembershipPageBuilder";
import { PublishDomainSelect } from "@/components/PublishDomainSelect";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import { AfterPurchaseWorkflowEditor } from "@/components/AfterPurchaseWorkflowEditor";
import { HidePricingOptionsToggle } from "@/components/HidePricingOptionsToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

type MembershipPlan = {
  id: number;
  title: string;
  slug: string;
  brand: string;
  description: string | null;
  coverImage: string | null;
  iconImage: string | null;
  accentColor: string | null;
  status: "draft" | "published";
  billingInterval: "monthly" | "annual" | "lifetime" | "one_time";
  price: number;
  compareAtPrice: number | null;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  features: string | null;
  featureBullets: string | null;
  landingPageBlocks: string | null;
  memberPageBlocks: string | null;
  trialDays: number;
  sortOrder: number;
  publishDomain: string | null;
  settings: string | null;
  subtitle: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

type AccessItem = {
  id: number;
  planId: number;
  itemType: string;
  itemId: number | null;
  label: string | null;
  sortOrder: number;
};

type DiscountCode = {
  id: number;
  planId: number | null;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: number | null;
  isActive: boolean;
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
  ultrasoundassist_free: "UltrasoundAssist™ (Free Member)",
  ultrasoundassist_premium: "UltrasoundAssist™ (Premium Member)",
  echoassist_free: "EchoAssist™ (Free Member)",
  echoassist_premium: "EchoAssist™ (Premium Member)",
};

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-3.5 h-3.5" />,
  quiz: <FileText className="w-3.5 h-3.5" />,
  bundle: <Package className="w-3.5 h-3.5" />,
  community: <Users className="w-3.5 h-3.5" />,
  webinar: <Globe className="w-3.5 h-3.5" />,
  download: <Download className="w-3.5 h-3.5" />,
  product: <Tag className="w-3.5 h-3.5" />,
  all_courses: <BookOpen className="w-3.5 h-3.5" />,
  all_downloads: <Download className="w-3.5 h-3.5" />,
  ultrasoundassist_free: <Globe className="w-3.5 h-3.5" />,
  ultrasoundassist_premium: <Globe className="w-3.5 h-3.5" />,
  echoassist_free: <Globe className="w-3.5 h-3.5" />,
  echoassist_premium: <Globe className="w-3.5 h-3.5" />,
};

const BILLING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  annual: "Annual",
  lifetime: "Lifetime",
  one_time: "One-time",
};

function formatPrice(price: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price / 100);
}

// ─── Membership List ──────────────────────────────────────────────────────────

export default function MembershipsAdmin({ initialEditId }: { initialEditId?: number } = {}) {
  const [editingId, setEditingId] = useState<number | null>(initialEditId ?? null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStripePriceId, setNewStripePriceId] = useState("");
  const [syncResults, setSyncResults] = useState<null | { total: number; created: number; skipped: number; errors: number; results: Array<{ action: string; message: string; sourceTitle?: string; stripePriceId?: string }> }>(null);
  const [showSyncResults, setShowSyncResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: plans, refetch } = trpc.membership.listAll.useQuery();
  const createMutation = trpc.membership.create.useMutation({
    onSuccess: async (data) => {
      await refetch();
      setCreatingNew(false);
      setNewTitle("");
      setNewStripePriceId("");
      setEditingId(data.id);
      toast.success("Membership created");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.membership.delete.useMutation({
    onSuccess: async () => { await refetch(); toast.success("Membership deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.membership.update.useMutation({
    onSuccess: async () => { await refetch(); },
  });
  const bulkSyncMutation = trpc.membership.bulkSyncPlans.useMutation({
    onSuccess: (data) => {
      setSyncResults(data);
      setShowSyncResults(true);
      refetch();
      toast.success(`Sync complete: ${data.created} created, ${data.skipped} skipped, ${data.errors} errors`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (editingId) {
    return (
      <MembershipEditor
        planId={editingId}
        onBack={() => { setEditingId(null); refetch(); }}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-600" /> Memberships
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create membership tiers with bundled access to courses, downloads, communities, and more.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-teal-700 border-teal-300 hover:bg-teal-50"
            onClick={() => bulkSyncMutation.mutate()}
            disabled={bulkSyncMutation.isPending}
          >
            {bulkSyncMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sync Plans from Courses
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setCreatingNew(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Membership
          </Button>
        </div>
      </div>

      {/* Sync results panel */}
      {showSyncResults && syncResults && (
        <div className="mb-6 border border-teal-200 rounded-lg bg-teal-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-teal-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Plan Sync Results
            </h3>
            <button onClick={() => setShowSyncResults(false)} className="text-teal-600 hover:text-teal-800 text-sm">Dismiss</button>
          </div>
          <div className="flex gap-4 mb-3 text-sm">
            <span className="text-gray-600">Total: <strong>{syncResults.total}</strong></span>
            <span className="text-green-700">Created: <strong>{syncResults.created}</strong></span>
            <span className="text-gray-500">Skipped: <strong>{syncResults.skipped}</strong></span>
            {syncResults.errors > 0 && <span className="text-red-600">Errors: <strong>{syncResults.errors}</strong></span>}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {syncResults.results.map((r, i) => (
              <div key={i} className={`text-xs flex items-start gap-2 py-1 border-b border-teal-100 last:border-0 ${
                r.action === "created" ? "text-green-700" : r.action === "error" ? "text-red-600" : "text-gray-500"
              }`}>
                <span className="font-mono shrink-0">{r.action === "created" ? "✓" : r.action === "error" ? "✗" : "–"}</span>
                <span><strong>{r.sourceTitle ?? "—"}</strong> — {r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New membership dialog */}
      <Dialog open={creatingNew} onOpenChange={(open) => { setCreatingNew(open); if (!open) { setNewTitle(""); setNewStripePriceId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Membership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. All Access Membership"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate({ title: newTitle.trim(), stripePriceId: newStripePriceId.trim() || null })}
              />
            </div>
            <div>
              <Label>Stripe Price ID <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                value={newStripePriceId}
                onChange={(e) => setNewStripePriceId(e.target.value)}
                placeholder="price_1Abc..."
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Find in Stripe Dashboard → Products → Prices. Required for auto-matching subscriptions.</p>
            </div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ title: newTitle.trim(), stripePriceId: newStripePriceId.trim() || null })}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search */}
      {plans && plans.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search memberships..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
          />
        </div>
      )}
      {/* Plans list */}
      {!plans || plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No memberships yet</p>
          <p className="text-sm mt-1">Create your first membership tier above.</p>
        </div>
      ) : (() => {
        const filteredPlans = searchQuery.trim()
          ? plans.filter(p => p.title?.toLowerCase().includes(searchQuery.toLowerCase()))
          : plans;
        return filteredPlans.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No memberships match "{searchQuery}"</div>
        ) : (
        <div className="space-y-3">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 hover:border-teal-300 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: plan.accentColor ?? "#189aa1" }}
              >
                <Award className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 truncate">{plan.title}</span>
                  <Badge
                    variant={plan.status === "published" ? "default" : "secondary"}
                    className={plan.status === "published" ? "bg-green-100 text-green-700 border-green-200" : ""}
                  >
                    {plan.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {BILLING_LABELS[plan.billingInterval]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm font-medium text-teal-700">
                    {formatPrice(plan.price, plan.currency)}
                    {plan.billingInterval === "monthly" && "/mo"}
                    {plan.billingInterval === "annual" && "/yr"}
                  </span>
                  {plan.compareAtPrice && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatPrice(plan.compareAtPrice, plan.currency)}
                    </span>
                  )}
                  {plan.description && (
                    <span className="text-xs text-gray-500 truncate max-w-xs">{plan.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-teal-700"
                  onClick={() => updateMutation.mutate({ id: plan.id, status: plan.status === "published" ? "draft" : "published" })}
                  title={plan.status === "published" ? "Unpublish" : "Publish"}
                >
                  {plan.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-teal-700"
                  onClick={() => setEditingId(plan.id)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-red-600"
                  onClick={() => {
                    if (confirm(`Delete "${plan.title}"? This cannot be undone.`)) {
                      deleteMutation.mutate({ id: plan.id });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => setEditingId(plan.id)}
                >
                  Edit <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        );
      })()}
    </div>
  );
}

// ─── Membership Editor ────────────────────────────────────────────────────────

function MembershipEditor({ planId, onBack }: { planId: number; onBack: () => void }) {
  
  const [activeTab, setActiveTab] = useState("settings");

  const { data, refetch, isLoading } = trpc.membership.getById.useQuery({ id: planId });

  const updateMutation = trpc.membership.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  const { plan, items, discountCodes, subscribers } = data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">
          ← Back
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-7 h-7 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: plan.accentColor ?? "#189aa1" }}
          >
            <Award className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold text-gray-900 truncate">{plan.title}</h2>
          <Badge
            variant={plan.status === "published" ? "default" : "secondary"}
            className={plan.status === "published" ? "bg-green-100 text-green-700 border-green-200" : ""}
          >
            {plan.status}
          </Badge>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-xs font-mono font-semibold text-gray-600 select-all cursor-text" title="Plan ID">ID: {plan.id}</span>
        {plan.slug && (
          <a href={`/memberships/${plan.slug}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-teal-600">
              <Eye className="w-3.5 h-3.5 mr-1" /> View Sales Page
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1"
          onClick={() => {
            const url = `${window.location.origin}/checkout/${plan.slug}?type=membership`;
            navigator.clipboard.writeText(url);
            toast.success("Checkout link copied");
          }}
        >
          <Copy className="w-3.5 h-3.5" /> Copy Checkout Link
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateMutation.mutate({ id: planId, status: plan.status === "published" ? "draft" : "published" })}
        >
          {plan.status === "published" ? <><EyeOff className="w-3.5 h-3.5 mr-1" /> Unpublish</> : <><Eye className="w-3.5 h-3.5 mr-1" /> Publish</>}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mx-6 mt-4 w-auto justify-start bg-gray-100 rounded-lg p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="settings" className="text-xs data-[state=active]:bg-white">
            <Settings className="w-3.5 h-3.5 mr-1" /> Settings
          </TabsTrigger>
          <TabsTrigger value="items" className="text-xs data-[state=active]:bg-white">
            <Package className="w-3.5 h-3.5 mr-1" /> Included Items
          </TabsTrigger>
          <TabsTrigger value="codes" className="text-xs data-[state=active]:bg-white">
            <Tag className="w-3.5 h-3.5 mr-1" /> Discount Codes
          </TabsTrigger>
          <TabsTrigger value="sales-page" className="text-xs data-[state=active]:bg-white">
            <LayoutTemplate className="w-3.5 h-3.5 mr-1" /> Sales Page
          </TabsTrigger>
          <TabsTrigger value="member-page" className="text-xs data-[state=active]:bg-white">
            <Lock className="w-3.5 h-3.5 mr-1" /> Member Page
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs data-[state=active]:bg-white">
            <Users className="w-3.5 h-3.5 mr-1" /> Members ({subscribers?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="checkout-page" className="text-xs data-[state=active]:bg-white">
            <DollarSign className="w-3.5 h-3.5 mr-1" /> Checkout Page
          </TabsTrigger>
          <TabsTrigger value="after-purchase" className="text-xs data-[state=active]:bg-white">
            <Workflow className="w-3.5 h-3.5 mr-1" />After Purchase
          </TabsTrigger>
          <TabsTrigger value="reconcile" className="text-xs data-[state=active]:bg-white">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reconcile Stripe
          </TabsTrigger>
          <TabsTrigger value="widget" className="text-xs data-[state=active]:bg-white">
            <Code className="w-3.5 h-3.5 mr-1" /> Widget Code
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="settings" className="m-0 p-6">
            <MembershipSettingsTab plan={plan} onSave={(data) => updateMutation.mutate({ id: planId, ...data })} />
          </TabsContent>

          <TabsContent value="items" className="m-0 p-6">
            <MembershipItemsTab planId={planId} items={items} onRefetch={refetch} />
          </TabsContent>

          <TabsContent value="codes" className="m-0 p-6">
            <MembershipDiscountCodesTab planId={planId} codes={discountCodes} onRefetch={refetch} />
          </TabsContent>

          <TabsContent value="sales-page" className="m-0 h-full">
            <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-1">
              <a href={`/admin/memberships/${planId}/sales-builder`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open Full Editor
              </a>
            </div>
            <MembershipPageBuilderTab
              planId={planId}
              blocks={plan.landingPageBlocks}
              pageType="landing"
              onRefetch={refetch}
            />
          </TabsContent>

          <TabsContent value="member-page" className="m-0 h-full">
            <div className="flex items-center justify-end gap-2 px-4 pt-3 pb-1">
              <a href={`/admin/memberships/${planId}/member-builder`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open Full Editor
              </a>
            </div>
            <MembershipPageBuilderTab
              planId={planId}
              blocks={plan.memberPageBlocks}
              pageType="member"
              onRefetch={refetch}
            />
          </TabsContent>

          <TabsContent value="members" className="m-0 p-6">
            <MembershipMembersTab planId={planId} subscribers={subscribers ?? []} onRefetch={refetch} />
          </TabsContent>

          <TabsContent value="checkout-page" className="m-0 p-6">
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Checkout Page Editor</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Customise the sections shown on the hosted checkout page at{" "}
                      <a href={`/checkout/${plan.slug}?type=membership`} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                        /checkout/{plan.slug}
                      </a>.
                      Use the full-screen editor to add trust seals, testimonials, FAQs, guarantees, and more.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={`/checkout/${plan.slug}?type=membership`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Preview
                    </a>
                    <a href={`/admin/checkout-editor/membership/${planId}`}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Open Page Editor
                    </a>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {["Trust Seals & Badges","Membership Includes","Money-Back Guarantee","Testimonials","FAQ","Custom HTML"].map(s => (
                    <div key={s} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <span className="text-xs text-gray-600">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="after-purchase" className="m-0 p-6">
            <MembershipAfterPurchaseTab planId={planId} />
          </TabsContent>

          <TabsContent value="reconcile" className="m-0 p-6">
            <StripeReconcileTab planId={planId} stripePriceId={plan.stripePriceId} />
          </TabsContent>

          <TabsContent value="widget" className="m-0 p-6">
            <IncludedItemsWidgetCodePanel source="membership" id={plan.id} title={plan.title} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── After Purchase Tab ─────────────────────────────────────────────────────────────────────
function MembershipAfterPurchaseTab({ planId }: { planId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.memberships.getAfterPurchaseWorkflow.useQuery({ planId });
  const saveMut = trpc.memberships.updateAfterPurchaseWorkflow.useMutation({
    onSuccess: () => { utils.memberships.getAfterPurchaseWorkflow.invalidate({ planId }); toast.success("After purchase workflow saved"); },
    onError: (e) => toast.error(e.message),
  });
  const { data: hideData } = trpc.memberships.getHidePricingOptions.useQuery({ planId });
  const hideToggleMut = trpc.memberships.updateHidePricingOptions.useMutation({
    onSuccess: () => { utils.memberships.getHidePricingOptions.invalidate({ planId }); toast.success("Setting saved"); },
    onError: (e) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Workflow className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">After Purchase Workflow</p>
          <p className="text-xs text-teal-600 mt-0.5">Configure what happens immediately after a member completes their purchase. Actions run in order.</p>
        </div>
      </div>
      <HidePricingOptionsToggle
        value={hideData?.hidePricingOptions ?? false}
        onChange={(v) => hideToggleMut.mutate({ planId, hidePricingOptions: v })}
        isSaving={hideToggleMut.isPending}
      />
      <AfterPurchaseWorkflowEditor
        value={data?.afterPurchaseWorkflow ?? null}
        onChange={(workflow) => saveMut.mutate({ planId, workflow })}
        isSaving={saveMut.isPending}
      />
    </div>
  );
}

// ─── Stripe Reconcile Tab ───────────────────────────────────────────────────────────────────

function StripeReconcileTab({ planId, stripePriceId }: { planId: number; stripePriceId: string | null }) {
  const [results, setResults] = useState<Array<{
    subscriptionId: string;
    customerEmail: string | null;
    priceId: string | null;
    status: "fulfilled" | "skipped" | "error" | "dry_run";
    notes: string[];
    error?: string;
    userId?: number | null;
  }> | null>(null);
  const [summary, setSummary] = useState<{ processed: number; fulfilled: number; errors: number; skipped: number } | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [limitVal, setLimitVal] = useState("200");

  const reconcileMutation = trpc.membership.bulkReconcileStripeSubscriptions.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setSummary({ processed: data.processed, fulfilled: data.fulfilled, errors: data.errors, skipped: data.skipped });
      if (data.errors > 0) {
        toast.error(`Reconcile complete with ${data.errors} error(s). Check results below.`);
      } else {
        toast.success(`Reconcile complete: ${data.fulfilled} fulfilled, ${data.skipped} skipped.`);
      }
    },
    onError: (e) => toast.error(`Reconcile failed: ${e.message}`),
  });

  const STATUS_COLORS: Record<string, string> = {
    fulfilled: "bg-green-100 text-green-700 border-green-200",
    error: "bg-red-100 text-red-600 border-red-200",
    skipped: "bg-gray-100 text-gray-500 border-gray-200",
    dry_run: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Reconcile Stripe Subscriptions</h3>
        <p className="text-sm text-gray-500 mt-1">
          Syncs all active Stripe subscriptions for this plan to the database — creating subscription records,
          granting all plan access items (courses, downloads, bundles, app access), and updating billing details.
          This is idempotent: safe to run multiple times.
        </p>
      </div>

      {!stripePriceId && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            This plan has no Stripe Price ID configured. Set it in the Settings tab first so subscriptions can be matched.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Stripe Price ID (pre-filled from plan)</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono text-gray-600">
              {stripePriceId ?? <span className="text-gray-400 italic">Not configured</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max subscriptions to process</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={limitVal}
              onChange={e => setLimitVal(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="dryRun"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="dryRun" className="text-sm text-gray-600">
            Dry run (preview only — no DB writes)
          </label>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => reconcileMutation.mutate({
              priceId: stripePriceId ?? undefined,
              limit: Math.min(500, Math.max(1, parseInt(limitVal) || 200)),
              dryRun,
            })}
            disabled={reconcileMutation.isPending || !stripePriceId}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {reconcileMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reconciling...</>
              : <><RotateCcw className="w-4 h-4 mr-2" /> {dryRun ? "Preview (Dry Run)" : "Reconcile All Subscriptions"}</>}
          </Button>
          {results && (
            <Button variant="outline" onClick={() => { setResults(null); setSummary(null); }}>
              Clear Results
            </Button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Processed", value: summary.processed, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
            { label: "Fulfilled", value: summary.fulfilled, color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Errors", value: summary.errors, color: "text-red-700", bg: "bg-red-50 border-red-200" },
            { label: "Skipped", value: summary.skipped, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-3 ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Results ({results.length})</span>
            <span className="text-xs text-gray-400">Showing all processed subscriptions</span>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Subscription ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">User ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Notes / Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500">{r.subscriptionId}</td>
                    <td className="px-3 py-2 text-gray-700">{r.customerEmail ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[r.status] ?? ""}`}>
                        {r.status === "fulfilled" && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === "error" && <AlertTriangle className="w-3 h-3" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.userId ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs">
                      {r.error
                        ? <span className="text-red-600">{r.error}</span>
                        : r.notes.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function MembershipSettingsTab({
  plan,
  onSave,
}: {
  plan: MembershipPlan;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    title: plan.title,
    subtitle: plan.subtitle ?? "",
    description: plan.description ?? "",
    billingInterval: plan.billingInterval,
    price: String(plan.price / 100),
    compareAtPrice: plan.compareAtPrice ? String(plan.compareAtPrice / 100) : "",
    trialDays: String(plan.trialDays ?? 0),
    accentColor: plan.accentColor ?? "#189aa1",
    brand: (plan as any).brand ?? "all_about_ultrasound",
    coverImage: plan.coverImage ?? "",
    slug: plan.slug ?? "",
    metaTitle: plan.metaTitle ?? "",
    metaDescription: plan.metaDescription ?? "",
    publishDomain: plan.publishDomain ?? "",
    featureBullets: plan.featureBullets
      ? (JSON.parse(plan.featureBullets) as string[]).join("\n")
      : "",
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) { toast.error("Image must be under 10 MB"); return; }
    e.target.value = "";
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-course-image", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      const { url } = await res.json();
      setForm(prev => ({ ...prev, coverImage: url }));
      toast.success("Cover image uploaded");
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = () => {
    const bullets = form.featureBullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    onSave({
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      billingInterval: form.billingInterval as any,
      price: Math.round(parseFloat(form.price || "0") * 100),
      compareAtPrice: form.compareAtPrice ? Math.round(parseFloat(form.compareAtPrice) * 100) : null,
      trialDays: parseInt(form.trialDays || "0", 10),
      accentColor: form.accentColor,
      brand: form.brand,
      coverImage: form.coverImage || null,
      slug: form.slug || undefined,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      publishDomain: form.publishDomain || null,
      featureBullets: bullets.length > 0 ? JSON.stringify(bullets) : null,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Subtitle <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="mt-1" placeholder="Short tagline shown below the title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1"
              placeholder="Brief description shown on the sales page"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Brand</Label>
              <select className="mt-1 border rounded px-2 py-2 text-sm bg-background w-full" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                <option value="all_about_ultrasound">All About Ultrasound</option>
                <option value="iheartecho">iHeartEcho</option>
              </select>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-32 font-mono text-sm" />
              </div>
            </div>
          </div>
          <div>
            <Label>Cover Image</Label>
            <div className="mt-1 flex items-start gap-3">
              {form.coverImage && (
                <img src={form.coverImage} alt="Cover" className="w-24 h-16 object-cover rounded border border-gray-200" />
              )}
              <div className="flex flex-col gap-2">
                <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverUpload} />
                <Button type="button" size="sm" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover}>
                  {uploadingCover ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading...</> : <><Search className="w-3.5 h-3.5 mr-1" /> Upload Image</>}
                </Button>
                <Input value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} placeholder="Or paste image URL" className="text-xs" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Billing Interval</Label>
              <Select value={form.billingInterval} onValueChange={(v) => setForm({ ...form, billingInterval: v as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Price (USD)</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Compare-at Price (optional)</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.compareAtPrice}
                  onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Free Trial Days</Label>
              <Input
                type="number"
                min="0"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Feature Bullets</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-2">One bullet per line — shown on the sales page.</p>
          <Textarea
            value={form.featureBullets}
            onChange={(e) => setForm({ ...form, featureBullets: e.target.value })}
            rows={6}
            placeholder={"Access to all courses\nUnlimited downloads\nExclusive community access"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">URL &amp; SEO</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL Slug</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400">/memberships/</span>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="flex-1 font-mono text-sm" placeholder="my-membership" />
            </div>
          </div>
          <div>
            <Label>Meta Title <span className="text-gray-400 font-normal">(SEO)</span></Label>
            <Input value={form.metaTitle} onChange={(e) => setForm({ ...form, metaTitle: e.target.value })} className="mt-1" placeholder={form.title} />
          </div>
          <div>
            <Label>Meta Description <span className="text-gray-400 font-normal">(SEO)</span></Label>
            <Textarea value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} rows={2} className="mt-1" placeholder="Brief description for search engines" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Stripe Integration</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Auto-sync enabled</p>
              <p className="text-xs text-gray-500 mt-0.5">Stripe product &amp; price are automatically created and updated when you save pricing changes.</p>
            </div>
          </div>
          {plan.stripeProductId && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-white rounded border border-gray-100">
                <span className="text-gray-400">Product ID</span>
                <p className="font-mono text-gray-700 truncate mt-0.5">{plan.stripeProductId}</p>
              </div>
              <div className="p-2 bg-white rounded border border-gray-100">
                <span className="text-gray-400">Price ID</span>
                <p className="font-mono text-gray-700 truncate mt-0.5">{plan.stripePriceId ?? "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Domain</CardTitle></CardHeader>
        <CardContent>
          <PublishDomainSelect value={form.publishDomain} onChange={(v) => setForm({ ...form, publishDomain: v ?? "" })} />
        </CardContent>
      </Card>

      <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave}>
        Save Settings
      </Button>
    </div>
  );
}

// ─── Items Tab ────────────────────────────────────────────────────────────────


// ─── Sortable Item Row ────────────────────────────────────────────────────────

function SortableAccessItem({
  item,
  label,
  typeLabel,
  icon,
  onRemove,
}: {
  item: AccessItem;
  label: string;
  typeLabel: string;
  icon: React.ReactNode;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="text-teal-600 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="ml-2 text-xs text-gray-400">{typeLabel}</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-gray-400 hover:text-red-600 shrink-0"
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function MembershipItemsTab({
  planId,
  items,
  onRefetch,
}: {
  planId: number;
  items: AccessItem[];
  onRefetch: () => void;
}) {
  
  const [addType, setAddType] = useState<string>("course");
  const [addItemId, setAddItemId] = useState("");
  const [addItemTitle, setAddItemTitle] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [search, setSearch] = useState("");

  // ── Data fetches for all 6 product types ──────────────────────────────────
  const { data: allCourses } = trpc.lmsAdmin.listCourses.useQuery({ pageSize: 500 });
  const { data: downloads } = trpc.downloadsAdmin.list.useQuery();
  const { data: quizzes } = trpc.sonoQuiz.adminListAll.useQuery({ status: "all" });
  const { data: webinarsData } = trpc.webinarAdmin.list.useQuery({ pageSize: 500 });
  const { data: communities } = trpc.community.admin.listCommunities.useQuery();
  const { data: products } = trpc.productsAdmin.list.useQuery();
  const { data: bundlesData } = trpc.bundlesAdmin.list.useQuery({ pageSize: 200 });

  // ── Unified item list for the current type ────────────────────────────────
  const itemsForType = useMemo(() => {
    const q = search.toLowerCase();
    const filter = (title: string) => !q || title.toLowerCase().includes(q);
    switch (addType) {
      case "course": return (allCourses?.courses ?? []).filter((c: any) => filter(c.title ?? "")).map((c: any) => ({ id: c.id, title: c.title ?? `Course #${c.id}` }));
      case "download": return (downloads ?? []).filter((d: any) => filter(d.title ?? "")).map((d: any) => ({ id: d.id, title: d.title ?? `Download #${d.id}` }));
      case "quiz": return (quizzes ?? []).filter((q2: any) => filter(q2.title ?? "")).map((q2: any) => ({ id: q2.id, title: q2.title ?? `Quiz #${q2.id}` }));
      case "webinar": return (webinarsData?.webinars ?? []).filter((w: any) => filter(w.title ?? "")).map((w: any) => ({ id: w.id, title: w.title ?? `Webinar #${w.id}` }));
      case "community": return (communities ?? []).filter((c: any) => filter(c.title ?? c.name ?? "")).map((c: any) => ({ id: c.id, title: c.title ?? c.name ?? `Community #${c.id}` }));
      case "product": return (products ?? []).filter((p: any) => filter(p.name ?? p.title ?? "")).map((p: any) => ({ id: p.id, title: p.name ?? p.title ?? `Product #${p.id}` }));
      case "bundle": return (bundlesData?.bundles ?? []).filter((b: any) => filter(b.title ?? "")).map((b: any) => ({ id: b.id, title: b.title ?? `Bundle #${b.id}` }));
      default: return [];
    }
  }, [addType, search, allCourses, downloads, quizzes, webinarsData, communities, products, bundlesData]);

  // ── Build lookup maps for resolving saved item names ──────────────────────
  const courseMap = useMemo(() => { const m: Record<number, string> = {}; for (const c of allCourses?.courses ?? []) m[(c as any).id] = (c as any).title; return m; }, [allCourses]);
  const downloadMap = useMemo(() => { const m: Record<number, string> = {}; for (const d of downloads ?? []) m[(d as any).id] = (d as any).title; return m; }, [downloads]);
  const quizMap = useMemo(() => { const m: Record<number, string> = {}; for (const q2 of quizzes ?? []) m[(q2 as any).id] = (q2 as any).title; return m; }, [quizzes]);
  const webinarMap = useMemo(() => { const m: Record<number, string> = {}; for (const w of webinarsData?.webinars ?? []) m[(w as any).id] = (w as any).title; return m; }, [webinarsData]);
  const communityMap = useMemo(() => { const m: Record<number, string> = {}; for (const c of communities ?? []) m[(c as any).id] = (c as any).title ?? (c as any).name; return m; }, [communities]);
  const productMap = useMemo(() => { const m: Record<number, string> = {}; for (const p of products ?? []) m[(p as any).id] = (p as any).name ?? (p as any).title; return m; }, [products]);
  const bundleMap = useMemo(() => { const m: Record<number, string> = {}; for (const b of bundlesData?.bundles ?? []) m[(b as any).id] = (b as any).title; return m; }, [bundlesData]);

  function resolveItemName(item: AccessItem): string {
    if (item.label) return item.label;
    if (!item.itemId) return ITEM_TYPE_LABELS[item.itemType];
    const id = item.itemId;
    switch (item.itemType) {
      case "course": return courseMap[id] ?? `Course #${id}`;
      case "download": return downloadMap[id] ?? `Download #${id}`;
      case "quiz": return quizMap[id] ?? `Quiz #${id}`;
      case "webinar": return webinarMap[id] ?? `Webinar #${id}`;
      case "community": return communityMap[id] ?? `Community #${id}`;
      case "product": return productMap[id] ?? `Product #${id}`;
      case "bundle": return bundleMap[id] ?? `Bundle #${id}`;
      default: return `${ITEM_TYPE_LABELS[item.itemType]} #${id}`;
    }
  }

  // ── Local sorted state (mirrors DB order, updated optimistically on drag) ──
  const [localItems, setLocalItems] = useState<AccessItem[]>(() =>
    [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  // Keep localItems in sync when parent refetches
  const prevItemsRef = useRef(items);
  if (prevItemsRef.current !== items) {
    prevItemsRef.current = items;
    setLocalItems([...items].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  const reorderMutation = trpc.membership.reorderItems.useMutation({
    onError: (e) => { toast.error("Reorder failed: " + e.message); onRefetch(); },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate({ orderedIds: next.map((i) => i.id) });
      return next;
    });
  }, [reorderMutation]);

  const addMutation = trpc.membership.addItem.useMutation({
    onSuccess: () => { onRefetch(); setAddItemId(""); setAddItemTitle(""); setAddLabel(""); setSearch(""); toast.success("Item added"); },
    onError: (e) => toast.error(e.message),
  });
  const removeMutation = trpc.membership.removeItem.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Item removed"); },
    onError: (e) => toast.error(e.message),
  });

  const needsItemId = !["all_courses", "all_downloads", "ultrasoundassist_free", "ultrasoundassist_premium", "echoassist_free", "echoassist_premium"].includes(addType);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Item Type</Label>
              <Select value={addType} onValueChange={v => { setAddType(v); setAddItemId(""); setAddItemTitle(""); setSearch(""); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsItemId && (
              <div>
                <Label className="capitalize">{ITEM_TYPE_LABELS[addType] ?? "Item"}</Label>
                <div className="mt-1 space-y-1">
                  {/* Selected badge */}
                  {addItemId ? (
                    <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded px-2 py-1">
                      <span className="text-xs text-teal-700 flex-1 truncate">{addItemTitle}</span>
                      <button onClick={() => { setAddItemId(""); setAddItemTitle(""); setSearch(""); }} className="text-teal-400 hover:text-teal-600"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder={`Search ${ITEM_TYPE_LABELS[addType]?.toLowerCase() ?? "items"}…`}
                          className="pl-8 text-sm"
                        />
                      </div>
                      {search && (
                        <div className="border rounded-md max-h-48 overflow-y-auto bg-white shadow-sm">
                          {itemsForType.length === 0 ? (
                            <p className="text-xs text-gray-400 p-2 text-center">No results found</p>
                          ) : itemsForType.slice(0, 30).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 border-b last:border-0 truncate"
                              onClick={() => { setAddItemId(String(item.id)); setAddItemTitle(item.title); setSearch(""); }}
                            >
                              <span className="font-medium">{item.title}</span>
                              <span className="ml-2 text-xs text-gray-400">#{item.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!search && itemsForType.length > 0 && (
                        <div className="border rounded-md max-h-48 overflow-y-auto bg-white shadow-sm">
                          {itemsForType.slice(0, 30).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 border-b last:border-0 truncate"
                              onClick={() => { setAddItemId(String(item.id)); setAddItemTitle(item.title); }}
                            >
                              <span className="font-medium">{item.title}</span>
                              <span className="ml-2 text-xs text-gray-400">#{item.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Label (optional override)</Label>
            <Input
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. All Vascular Courses"
              className="mt-1"
            />
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={addMutation.isPending || (needsItemId && !addItemId)}
            onClick={() =>
              addMutation.mutate({
                planId,
                itemType: addType as any,
                itemId: needsItemId && addItemId ? parseInt(addItemId) : null,
                label: addLabel || null,
              })
            }
          >
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Included Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {localItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No items added yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {localItems.map((item) => (
                    <SortableAccessItem
                      key={item.id}
                      item={item}
                      label={resolveItemName(item)}
                      typeLabel={ITEM_TYPE_LABELS[item.itemType]}
                      icon={ITEM_TYPE_ICONS[item.itemType]}
                      onRemove={() => removeMutation.mutate({ id: item.id })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Discount Codes Tab ───────────────────────────────────────────────────────

function MembershipDiscountCodesTab({
  planId,
  codes,
  onRefetch,
}: {
  planId: number;
  codes: DiscountCode[];
  onRefetch: () => void;
}) {
  
  const [form, setForm] = useState({
    code: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    maxUses: "",
    expiresAt: "",
    allPlans: false,
  });

  const createMutation = trpc.membership.createDiscountCode.useMutation({
    onSuccess: () => {
      onRefetch();
      setForm({ code: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", allPlans: false });
      toast.success("Discount code created");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.membership.updateDiscountCode.useMutation({
    onSuccess: () => { onRefetch(); },
  });
  const deleteMutation = trpc.membership.deleteDiscountCode.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Code deleted"); },
  });

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm({ ...form, code });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Create Discount Code</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className="font-mono uppercase"
                />
                <Button variant="outline" size="sm" onClick={generateCode} title="Generate random code">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Discount Type</Label>
              <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v as any })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="fixed">Fixed ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Value {form.discountType === "percent" ? "(%)" : "($)"}</Label>
              <div className="relative mt-1">
                {form.discountType === "percent" ? (
                  <Percent className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                ) : (
                  <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                )}
                <Input
                  type="number"
                  min="1"
                  max={form.discountType === "percent" ? "100" : undefined}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>Max Uses (optional)</Label>
              <Input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="mt-1"
                placeholder="Unlimited"
              />
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.allPlans}
              onCheckedChange={(v) => setForm({ ...form, allPlans: v })}
              id="all-plans"
            />
            <Label htmlFor="all-plans" className="cursor-pointer">Apply to all membership plans</Label>
          </div>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!form.code.trim() || !form.discountValue || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                planId: form.allPlans ? null : planId,
                code: form.code.trim(),
                discountType: form.discountType,
                discountValue: form.discountType === "fixed"
                  ? Math.round(parseFloat(form.discountValue) * 100)
                  : parseInt(form.discountValue),
                maxUses: form.maxUses ? parseInt(form.maxUses) : null,
                expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : null,
              })
            }
          >
            <Plus className="w-4 h-4 mr-1" /> Create Code
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Discount Codes ({codes.length})</CardTitle></CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No discount codes yet.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((code) => (
                <div key={code.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-gray-900">{code.code}</span>
                      <Badge variant={code.isActive ? "default" : "secondary"} className={code.isActive ? "bg-green-100 text-green-700 border-green-200 text-xs" : "text-xs"}>
                        {code.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {code.planId === null && (
                        <Badge variant="outline" className="text-xs">All plans</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>
                        {code.discountType === "percent"
                          ? `${code.discountValue}% off`
                          : `$${Number(code.discountValue).toFixed(2)} off`}
                      </span>
                      <span>{code.usedCount} used{code.maxUses ? ` / ${code.maxUses} max` : ""}</span>
                      {code.expiresAt && (
                        <span>Expires {new Date(code.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-700"
                      onClick={() => { navigator.clipboard.writeText(code.code); toast.success("Copied!"); }}
                      title="Copy code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-700"
                      onClick={() => updateMutation.mutate({ id: code.id, isActive: !code.isActive })}
                      title={code.isActive ? "Deactivate" : "Activate"}
                    >
                      {code.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate({ id: code.id })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page Builder Tab ─────────────────────────────────────────────────────────

function MembershipPageBuilderTab({
  planId,
  blocks,
  pageType,
  onRefetch,
}: {
  planId: number;
  blocks: string | null;
  pageType: "landing" | "member";
  onRefetch: () => void;
}) {
  
  const landingMutation = trpc.membership.updateLandingPageBlocks.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Sales page saved"); },
    onError: (e) => toast.error(e.message),
  });
  const memberMutation = trpc.membership.updateMemberPageBlocks.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Member page saved"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = useCallback(
    (blocksJson: string) => {
      if (pageType === "landing") {
        landingMutation.mutate({ id: planId, blocks: blocksJson });
      } else {
        memberMutation.mutate({ id: planId, blocks: blocksJson });
      }
    },
    [planId, pageType, landingMutation, memberMutation]
  );

  const isSaving = landingMutation.isPending || memberMutation.isPending;

  return (
    <div className="h-full" style={{ minHeight: 600 }}>
      <MembershipPageBuilder
        initialBlocks={blocks ? JSON.parse(blocks) : []}
        onSave={handleSave}
        isSaving={isSaving}
        context={pageType === "landing" ? "membership_sales" : "membership_member"}
      />
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembershipMembersTab({
  planId,
  subscribers,
  onRefetch,
}: {
  planId: number;
  subscribers: Array<{ subscription: any; user: any }>;
  onRefetch: () => void;
}) {
  
  const cancelMutation = trpc.membership.cancelEnrollment.useMutation({
    onSuccess: () => { onRefetch(); toast.success("Enrollment cancelled"); },
    onError: (e) => toast.error(e.message),
  });

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    trialing: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-gray-100 text-gray-500",
    expired: "bg-red-100 text-red-600 border-red-200",
    past_due: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Members ({subscribers.length})</h3>
      </div>
      {subscribers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No members yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscribers.map(({ subscription, user }) => (
            <div key={subscription.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-teal-700">
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {user.displayName ?? user.name ?? user.email}
                  </span>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[subscription.status] ?? ""}`}>
                    {subscription.status}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {user.email} · Joined {new Date(subscription.createdAt).toLocaleDateString()}
                  {subscription.currentPeriodEnd && (
                    <> · Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              {subscription.status === "active" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-red-600 shrink-0 text-xs"
                  onClick={() => {
                    if (confirm("Cancel this member's enrollment?")) {
                      cancelMutation.mutate({ subscriptionId: subscription.id });
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Included Items Widget Code Panel ────────────────────────────────────────

function IncludedItemsWidgetCodePanel({ source, id, title }: { source: "membership" | "bundle"; id: number; title: string }) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [columns, setColumns] = useState("3");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [accent, setAccent] = useState("#14b8a6");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Explore");
  const [bgColor, setBgColor] = useState("");
  const [copied, setCopied] = useState<"script" | "iframe" | null>(null);

  const base = window.location.origin;
  const params = new URLSearchParams({
    source,
    id: String(id),
    accent,
    theme,
    layout,
    columns,
    ...(headline ? { headline } : {}),
    ...(subtext ? { subtext } : {}),
    ...(ctaUrl ? { ctaUrl } : {}),
    ...(ctaLabel !== "Explore" ? { ctaLabel } : {}),
    ...(bgColor ? { bg: bgColor } : {}),
  });
  const iframeSrc = `${base}/embed/included-items?${params.toString()}`;

  const scriptSnippet = `<!-- Included Items Widget: ${title} -->
<div data-included-items-embed="${source}:${id}"
     data-accent="${accent}"
     data-theme="${theme}"
     data-layout="${layout}"
     data-columns="${columns}"${headline ? `\n     data-headline="${headline}"` : ""}${subtext ? `\n     data-subtext="${subtext}"` : ""}${ctaUrl ? `\n     data-cta-url="${ctaUrl}"` : ""}${ctaLabel !== "Explore" ? `\n     data-cta-label="${ctaLabel}"` : ""}${bgColor ? `\n     data-bg="${bgColor}"` : ""}
     data-base-url="${base}"></div>
<script src="${base}/embed/included-items.js" async></script>`;

  const iframeSnippet = `<iframe
  src="${iframeSrc}"
  style="width:100%;border:none;display:block;min-height:200px;"
  scrolling="no"
  frameborder="0"
  allowtransparency="true"
></iframe>`;

  function copySnippet(type: "script" | "iframe") {
    navigator.clipboard.writeText(type === "script" ? scriptSnippet : iframeSnippet);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Code className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-teal-800">Embeddable Widget</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Embed the included items for <strong>{title}</strong> on any external website using the snippet below.
            Paste the script tag anywhere in your page's HTML — it auto-sizes to fit its content.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Layout</Label>
          <Select value={layout} onValueChange={(v) => setLayout(v as "grid" | "list")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grid</SelectItem>
              <SelectItem value="list">List</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Columns (grid only)</Label>
          <Select value={columns} onValueChange={setColumns}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Accent Color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 text-xs font-mono flex-1" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Headline (optional)</Label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What's Included" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">Subtext (optional)</Label>
          <Input value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="Everything in this membership" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">CTA Button URL (optional)</Label>
          <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-gray-700">CTA Button Label</Label>
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Explore" className="h-8 text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs font-medium text-gray-700">Background Color (optional, leave blank for default)</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={bgColor || "#ffffff"} onChange={(e) => setBgColor(e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
            <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="transparent / #ffffff" className="h-8 text-xs font-mono flex-1" />
            {bgColor && <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => setBgColor("")}>Clear</Button>}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-gray-700">Live Preview</Label>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            style={{ width: "100%", border: "none", display: "block", minHeight: "200px" }}
            scrolling="no"
            frameBorder="0"
            onLoad={(e) => {
              const iframe = e.currentTarget;
              const handler = (ev: MessageEvent) => {
                if (ev.data?.type === "included-items-resize" && ev.source === iframe.contentWindow) {
                  iframe.style.height = (ev.data.height + 8) + "px";
                  window.removeEventListener("message", handler);
                }
              };
              window.addEventListener("message", handler);
            }}
          />
        </div>
      </div>

      {/* Script tag snippet */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-700">Script Tag (recommended)</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copySnippet("script")}>
            {copied === "script" ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{scriptSnippet}</pre>
      </div>

      {/* Raw iframe snippet */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-gray-700">Raw iframe (for CMS / page builders)</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copySnippet("iframe")}>
            {copied === "iframe" ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </Button>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{iframeSnippet}</pre>
      </div>
    </div>
  );
}
