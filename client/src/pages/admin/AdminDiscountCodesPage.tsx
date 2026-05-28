/**
 * AdminDiscountCodesPage.tsx
 * Manage Stripe coupons and promotion codes.
 * - Create coupons (% or fixed amount off, optional expiry, optional max redemptions)
 * - Attach a human-readable promo code to each coupon
 * - List all coupons with their promo codes and redemption counts
 * - Deactivate coupons or individual promo codes
 *
 * All coupons apply globally — Stripe's allow_promotion_codes: true is already
 * enabled on every checkout session in this app, so any active promo code
 * works across courses, quizzes, downloads, products, and memberships.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import {
  Tag, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  Percent, DollarSign, Calendar, Hash, CheckCircle, XCircle, ChevronRight, LayoutDashboard,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDollars(amount: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}
function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Create Coupon Dialog ─────────────────────────────────────────────────────
function CreateCouponDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [redeemBy, setRedeemBy] = useState("");

  const createMutation = trpc.adminUser.createCoupon.useMutation({
    onSuccess: (data) => {
      const codeStr = data.promoCode ? ` with code ${(data.promoCode as any).code}` : "";
      toast.success(`Coupon "${(data.coupon as any).name}"${codeStr} created`);
      onCreated();
      onClose();
      setName(""); setDiscountType("percent"); setDiscountValue(""); setPromoCode(""); setMaxRedemptions(""); setRedeemBy("");
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const handleSubmit = () => {
    const val = parseFloat(discountValue);
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (isNaN(val) || val <= 0) { toast.error("Enter a valid discount value"); return; }
    if (discountType === "percent" && val > 100) { toast.error("Percent discount cannot exceed 100%"); return; }
    createMutation.mutate({
      name: name.trim(),
      discountType,
      discountValue: val, // always in dollars/percent — server multiplies by 100 for Stripe
      promoCode: promoCode.trim() || undefined,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : undefined,
      redeemBy: redeemBy || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#189aa1]">
            <Tag className="w-5 h-5" /> Create Discount Coupon
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium">Coupon Name <span className="text-red-500">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Sale 20% Off" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Discount Type</Label>
              <Select value={discountType} onValueChange={v => setDiscountType(v as "percent" | "fixed")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">
                {discountType === "percent" ? "Percent Off" : "Amount Off (USD)"} <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {discountType === "percent" ? "%" : "$"}
                </span>
                <Input
                  type="number" min="0" max={discountType === "percent" ? 100 : undefined} step={discountType === "percent" ? 1 : 0.01}
                  value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  className="pl-8" placeholder={discountType === "percent" ? "20" : "10.00"}
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Promo Code (optional)</Label>
            <Input
              value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER20" className="mt-1 font-mono uppercase"
              maxLength={50}
            />
            <p className="text-xs text-gray-400 mt-1">The code customers enter at checkout. Leave blank to create a coupon without a code.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Max Redemptions (optional)</Label>
              <Input type="number" min="1" value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value)} placeholder="Unlimited" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">Expires On (optional)</Label>
              <Input type="date" value={redeemBy} onChange={e => setRedeemBy(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-[#189aa1] hover:bg-[#0e4a50] text-white gap-2"
            disabled={createMutation.isPending}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Coupon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coupon Row ───────────────────────────────────────────────────────────────
function CouponRow({ coupon, promoCodes, onRefresh }: { coupon: any; promoCodes: any[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deactivatePromoId, setDeactivatePromoId] = useState<string | null>(null);

  const deleteMutation = trpc.adminUser.deactivateCoupon.useMutation({
    onSuccess: () => { toast.success("Coupon deleted"); onRefresh(); },
    onError: e => toast.error(`Failed: ${e.message}`),
  });
  const deactivatePromoMutation = trpc.adminUser.deactivatePromoCode.useMutation({
    onSuccess: () => { toast.success("Promo code deactivated"); onRefresh(); },
    onError: e => toast.error(`Failed: ${e.message}`),
  });

  const discountLabel = coupon.percent_off != null
    ? `${coupon.percent_off}% off`
    : `${fmtDollars(coupon.amount_off / 100, coupon.currency)} off`; // Stripe returns amount_off in cents

  const isValid = coupon.valid !== false;

  return (
    <>
      <div className={`bg-white rounded-xl border ${isValid ? "border-gray-200" : "border-gray-100 opacity-60"} shadow-sm`}>
        <div className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#189aa1]/10 flex-shrink-0">
            {coupon.percent_off != null ? <Percent className="w-5 h-5 text-[#189aa1]" /> : <DollarSign className="w-5 h-5 text-[#189aa1]" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{coupon.name || coupon.id}</span>
              <Badge className={`text-xs border-0 ${isValid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {isValid ? "Active" : "Deleted"}
              </Badge>
              <Badge className="text-xs border-0 bg-blue-100 text-blue-700">{discountLabel}</Badge>
              {coupon.redeem_by && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Expires {fmtDate(coupon.redeem_by)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
              <span className="font-mono">{coupon.id}</span>
              {coupon.times_redeemed != null && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {coupon.times_redeemed} redemption{coupon.times_redeemed !== 1 ? "s" : ""}
                  {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                </span>
              )}
              {promoCodes.length > 0 && (
                <span className="flex items-center gap-1 text-[#189aa1]">
                  <Tag className="w-3 h-3" /> {promoCodes.length} promo code{promoCodes.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {promoCodes.length > 0 && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400" onClick={() => setExpanded(e => !e)}>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            )}
            {isValid && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Promo codes sub-list */}
        {expanded && promoCodes.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Promo Codes</p>
            {promoCodes.map((pc: any) => (
              <div key={pc.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm font-bold text-[#189aa1]">{pc.code}</code>
                  <Badge className={`text-xs border-0 ${pc.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {pc.active ? <><CheckCircle className="w-3 h-3 mr-1 inline" />Active</> : <><XCircle className="w-3 h-3 mr-1 inline" />Inactive</>}
                  </Badge>
                  <span className="text-xs text-gray-400">{pc.times_redeemed ?? 0} uses</span>
                </div>
                {pc.active && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setDeactivatePromoId(pc.id)}>
                    Deactivate
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete coupon confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the coupon <strong>{coupon.name || coupon.id}</strong> and all associated promo codes from Stripe. Existing redemptions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { deleteMutation.mutate({ couponId: coupon.id }); setDeleteConfirm(false); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate promo code confirm */}
      <AlertDialog open={!!deactivatePromoId} onOpenChange={o => !o && setDeactivatePromoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Promo Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This code will no longer be accepted at checkout. The coupon itself remains active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                if (deactivatePromoId) deactivatePromoMutation.mutate({ promoCodeId: deactivatePromoId });
                setDeactivatePromoId(null);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDiscountCodesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.adminUser.listCoupons.useQuery({ limit: 50 });

  const coupons: any[] = data?.coupons ?? [];
  const promoCodesByCoupon: Record<string, any[]> = data?.promoCodesByCoupon ?? {};

  const activeCoupons = coupons.filter(c => c.valid !== false);
  const inactiveCoupons = coupons.filter(c => c.valid === false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/platform-admin" className="flex items-center gap-1 hover:text-[#189aa1] transition-colors">
          <LayoutDashboard className="w-3.5 h-3.5" /> Platform Admin
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-gray-700 font-medium">Discount Codes</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#189aa1]" /> Discount Codes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create Stripe coupons and promo codes. Codes apply globally across all courses, quizzes, downloads, products, and memberships.
          </p>
        </div>
        <Button className="bg-[#189aa1] hover:bg-[#0e4a50] text-white gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" /> New Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Coupons", value: activeCoupons.length, color: "text-green-600" },
          { label: "Total Promo Codes", value: Object.values(promoCodesByCoupon).flat().filter((p: any) => p.active).length, color: "text-[#189aa1]" },
          { label: "Total Redemptions", value: coupons.reduce((s, c) => s + (c.times_redeemed ?? 0), 0), color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label} className="border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coupon list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading coupons from Stripe…
        </div>
      ) : coupons.length === 0 ? (
        <Card className="border border-dashed border-gray-200">
          <CardContent className="py-16 text-center text-gray-400">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No coupons yet</p>
            <p className="text-sm mt-1">Create your first coupon to offer discounts at checkout.</p>
            <Button className="mt-4 bg-[#189aa1] hover:bg-[#0e4a50] text-white gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Create First Coupon
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeCoupons.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active ({activeCoupons.length})</h2>
              <div className="space-y-3">
                {activeCoupons.map(c => (
                  <CouponRow key={c.id} coupon={c} promoCodes={promoCodesByCoupon[c.id] ?? []} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}
          {inactiveCoupons.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Deleted / Expired ({inactiveCoupons.length})</h2>
              <div className="space-y-3">
                {inactiveCoupons.map(c => (
                  <CouponRow key={c.id} coupon={c} promoCodes={promoCodesByCoupon[c.id] ?? []} onRefresh={refetch} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateCouponDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refetch} />
    </div>
  );
}
