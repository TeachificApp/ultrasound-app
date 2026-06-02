import React, { useState, useCallback, useMemo } from "react";
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
  Plus, Edit2, Trash2, Eye, EyeOff, Tag, Users, Package, LayoutTemplate,
  ChevronRight, GripVertical, X, Copy, RefreshCw, DollarSign, Percent,
  BookOpen, Download, Globe, Lock, Settings, FileText, Award, Search
} from "lucide-react";
import MembershipPageBuilder from "@/components/MembershipPageBuilder";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";

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

export default function MembershipsAdmin() {
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: plans, refetch } = trpc.membership.listAll.useQuery();
  const createMutation = trpc.membership.create.useMutation({
    onSuccess: async (data) => {
      await refetch();
      setCreatingNew(false);
      setNewTitle("");
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
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => setCreatingNew(true)}
        >
          <Plus className="w-4 h-4 mr-1" /> New Membership
        </Button>
      </div>

      {/* New membership dialog */}
      <Dialog open={creatingNew} onOpenChange={setCreatingNew}>
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
                onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createMutation.mutate({ title: newTitle.trim() })}
              />
            </div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ title: newTitle.trim() })}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plans list */}
      {!plans || plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No memberships yet</p>
          <p className="text-sm mt-1">Create your first membership tier above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
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
      )}
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
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
        </TabsList>

        <div className="flex-1 overflow-y-auto">
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
            <MembershipPageBuilderTab
              planId={planId}
              blocks={plan.landingPageBlocks}
              pageType="landing"
              onRefetch={refetch}
            />
          </TabsContent>

          <TabsContent value="member-page" className="m-0 h-full">
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
            <CheckoutPageEditor
              entityType="membership"
              entityId={planId}
              entitySlug={plan.slug}
              previewQuery="type=membership"
            />
          </TabsContent>
        </div>
      </Tabs>
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
    description: plan.description ?? "",
    billingInterval: plan.billingInterval,
    price: String(plan.price / 100),
    compareAtPrice: plan.compareAtPrice ? String(plan.compareAtPrice / 100) : "",
    trialDays: String(plan.trialDays ?? 0),
    accentColor: plan.accentColor ?? "#189aa1",
    stripeProductId: plan.stripeProductId ?? "",
    stripePriceId: plan.stripePriceId ?? "",
    publishDomain: plan.publishDomain ?? "",
    featureBullets: plan.featureBullets
      ? (JSON.parse(plan.featureBullets) as string[]).join("\n")
      : "",
  });

  const handleSave = () => {
    const bullets = form.featureBullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    onSave({
      title: form.title,
      description: form.description || null,
      billingInterval: form.billingInterval as any,
      price: Math.round(parseFloat(form.price || "0") * 100),
      compareAtPrice: form.compareAtPrice ? Math.round(parseFloat(form.compareAtPrice) * 100) : null,
      trialDays: parseInt(form.trialDays || "0", 10),
      accentColor: form.accentColor,
      stripeProductId: form.stripeProductId || null,
      stripePriceId: form.stripePriceId || null,
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
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1"
              placeholder="Brief description shown on the sales page"
            />
          </div>
          <div>
            <Label>Accent Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <Input
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="w-32 font-mono text-sm"
              />
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
        <CardHeader><CardTitle className="text-sm">Stripe Integration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Stripe Product ID</Label>
            <Input
              value={form.stripeProductId}
              onChange={(e) => setForm({ ...form, stripeProductId: e.target.value })}
              className="mt-1 font-mono text-sm"
              placeholder="prod_..."
            />
          </div>
          <div>
            <Label>Stripe Price ID</Label>
            <Input
              value={form.stripePriceId}
              onChange={(e) => setForm({ ...form, stripePriceId: e.target.value })}
              className="mt-1 font-mono text-sm"
              placeholder="price_..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Domain</CardTitle></CardHeader>
        <CardContent>
          <Label>Publish Domain</Label>
          <Select value={form.publishDomain || "__default__"} onValueChange={(v) => setForm({ ...form, publishDomain: v === "__default__" ? "" : v })}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Default domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">Default (all domains)</SelectItem>
              <SelectItem value="learn.allaboutultrasound.com">learn.allaboutultrasound.com</SelectItem>
              <SelectItem value="app.allaboutultrasound.com">app.allaboutultrasound.com</SelectItem>
              <SelectItem value="members.allaboutultrasound.com">members.allaboutultrasound.com</SelectItem>
              <SelectItem value="app.iheartecho.com">app.iheartecho.com (canonical)</SelectItem>
              <SelectItem value="app.iheartecho.net">app.iheartecho.net (legacy)</SelectItem>
              <SelectItem value="accreditation.iheartecho.com">accreditation.iheartecho.com</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave}>
        Save Settings
      </Button>
    </div>
  );
}

// ─── Items Tab ────────────────────────────────────────────────────────────────

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
  const [courseSearch, setCourseSearch] = useState("");
  const [downloadSearch, setDownloadSearch] = useState("");

  const { data: allCourses } = trpc.lmsAdmin.listCourses.useQuery({ pageSize: 500 });
  const { data: downloads } = trpc.downloads.admin.list.useQuery({ pageSize: 500 });

  const filteredCourses = (allCourses?.courses ?? []).filter((c: any) =>
    !courseSearch || c.title?.toLowerCase().includes(courseSearch.toLowerCase())
  );
  const filteredDownloads = (downloads?.downloads ?? []).filter((d: any) =>
    !downloadSearch || d.title?.toLowerCase().includes(downloadSearch.toLowerCase())
  );

  // Build lookup maps for resolving item names
  const courseMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of allCourses?.courses ?? []) m[c.id] = c.title;
    return m;
  }, [allCourses]);
  const downloadMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const d of downloads?.downloads ?? []) m[d.id] = d.title;
    return m;
  }, [downloads]);

  function resolveItemName(item: AccessItem): string {
    if (item.label) return item.label;
    if (!item.itemId) return ITEM_TYPE_LABELS[item.itemType];
    if (item.itemType === "course") return courseMap[item.itemId] ?? `Course #${item.itemId}`;
    if (item.itemType === "download") return downloadMap[item.itemId] ?? `Download #${item.itemId}`;
    return `${ITEM_TYPE_LABELS[item.itemType]} #${item.itemId}`;
  }

  const addMutation = trpc.membership.addItem.useMutation({
    onSuccess: () => { onRefetch(); setAddItemId(""); setAddItemTitle(""); setAddLabel(""); setCourseSearch(""); setDownloadSearch(""); toast.success("Item added"); },
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
              <Select value={addType} onValueChange={v => { setAddType(v); setAddItemId(""); setAddItemTitle(""); setCourseSearch(""); setDownloadSearch(""); }}>
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
                <Label>
                  {addType === "course" ? "Course" : addType === "download" ? "Download" : "Item ID"}
                </Label>
                {addType === "course" ? (
                  <div className="mt-1 space-y-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        value={courseSearch}
                        onChange={e => { setCourseSearch(e.target.value); setAddItemId(""); setAddItemTitle(""); }}
                        placeholder="Search courses..."
                        className="pl-8 text-sm"
                      />
                    </div>
                    {addItemId && (
                      <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded px-2 py-1">
                        <span className="text-xs text-teal-700 flex-1 truncate">{addItemTitle}</span>
                        <button onClick={() => { setAddItemId(""); setAddItemTitle(""); setCourseSearch(""); }} className="text-teal-400 hover:text-teal-600"><X className="w-3 h-3" /></button>
                      </div>
                    )}
                    {!addItemId && courseSearch && (
                      <div className="border rounded-md max-h-40 overflow-y-auto bg-white shadow-sm">
                        {filteredCourses.length === 0 ? (
                          <p className="text-xs text-gray-400 p-2 text-center">No courses found</p>
                        ) : filteredCourses.slice(0, 20).map((c: any) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 border-b last:border-0 truncate"
                            onClick={() => { setAddItemId(String(c.id)); setAddItemTitle(c.title); setCourseSearch(""); }}
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : addType === "download" ? (
                  <div className="mt-1 space-y-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        value={downloadSearch}
                        onChange={e => { setDownloadSearch(e.target.value); setAddItemId(""); setAddItemTitle(""); }}
                        placeholder="Search downloads..."
                        className="pl-8 text-sm"
                      />
                    </div>
                    {addItemId && (
                      <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded px-2 py-1">
                        <span className="text-xs text-teal-700 flex-1 truncate">{addItemTitle}</span>
                        <button onClick={() => { setAddItemId(""); setAddItemTitle(""); setDownloadSearch(""); }} className="text-teal-400 hover:text-teal-600"><X className="w-3 h-3" /></button>
                      </div>
                    )}
                    {!addItemId && downloadSearch && (
                      <div className="border rounded-md max-h-40 overflow-y-auto bg-white shadow-sm">
                        {filteredDownloads.length === 0 ? (
                          <p className="text-xs text-gray-400 p-2 text-center">No downloads found</p>
                        ) : filteredDownloads.slice(0, 20).map((d: any) => (
                          <button
                            key={d.id}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-teal-50 border-b last:border-0 truncate"
                            onClick={() => { setAddItemId(String(d.id)); setAddItemTitle(d.title); setDownloadSearch(""); }}
                          >
                            {d.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                    placeholder="Item ID"
                    className="mt-1"
                  />
                )}
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
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No items added yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-teal-600">{ITEM_TYPE_ICONS[item.itemType]}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">
                      {resolveItemName(item)}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">{ITEM_TYPE_LABELS[item.itemType]}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-red-600 shrink-0"
                    onClick={() => removeMutation.mutate({ id: item.id })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
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
