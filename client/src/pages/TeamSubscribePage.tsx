/**
 * TeamSubscribePage — /team/subscribe
 * Lets a user purchase a Team/University subscription with variable seat count.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Building2, Zap, CheckCircle2, ChevronRight, Loader2, Tag } from "lucide-react";

const BRAND_OPTIONS = [
  {
    value: "aaus" as const,
    label: "UltrasoundAssist™",
    description: "General & Vascular Ultrasound Clinical Intelligence",
    color: "bg-teal-500",
  },
  {
    value: "iheartecho" as const,
    label: "EchoAssist™",
    description: "Echocardiography Clinical Intelligence",
    color: "bg-blue-500",
  },
  {
    value: "dual" as const,
    label: "Both Apps",
    description: "Full access to UltrasoundAssist™ + EchoAssist™",
    color: "bg-purple-500",
  },
];

const FEATURES = [
  "Premium access for every invited member",
  "Centralized seat management dashboard",
  "Invite members by email — they join with one click",
  "Revoke or reassign seats at any time",
  "15% bulk discount on 10+ seats",
  "Monthly or lifetime pricing",
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function TeamSubscribePage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [brand, setBrand] = useState<"aaus" | "iheartecho" | "dual">("aaus");
  const [plan, setPlan] = useState<"monthly" | "lifetime">("monthly");
  const [seatCount, setSeatCount] = useState(5);
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show existing teams banner if user already has a team
  const myTeamsQuery = trpc.team.getMyTeams.useQuery(undefined, { enabled: !!user });

  const pricingQuery = trpc.team.getPricing.useQuery(
    { brand, plan, seatCount: Math.max(1, seatCount) },
    { keepPreviousData: true },
  );

  const createCheckout = trpc.team.createCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutUrl, "_blank");
      toast({ title: "Redirecting to checkout…", description: "A new tab has been opened for payment." });
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      setIsSubmitting(false);
    },
  });

  const handleCheckout = () => {
    if (!user) {
      window.location.href = getLoginUrl("/team/subscribe");
      return;
    }
    if (!orgName.trim()) {
      toast({ title: "Organisation name required", description: "Please enter your team or university name.", variant: "destructive" });
      return;
    }
    if (seatCount < 1) {
      toast({ title: "Invalid seat count", description: "Please enter at least 1 seat.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    createCheckout.mutate({
      orgName: orgName.trim(),
      brand,
      plan,
      seatCount,
      origin: window.location.origin,
    });
  };

  const pricing = pricingQuery.data;
  const hasDiscount = (pricing?.discountPct ?? 0) > 0;
  const nearDiscount = seatCount >= 7 && seatCount < 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-white/60 hover:text-white text-sm flex items-center gap-1">
          ← Back
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Existing teams banner */}
        {(myTeamsQuery.data?.length ?? 0) > 0 && (
          <div className="mb-8 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-teal-400 shrink-0" />
              <div>
                <p className="font-medium text-teal-300 text-sm">You already have a team subscription</p>
                <p className="text-white/50 text-xs">{myTeamsQuery.data!.map(t => t.orgName).join(", ")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {myTeamsQuery.data!.map(t => (
                <Button
                  key={t.id}
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/team/${t.id}`)}
                  className="border-teal-500/40 text-teal-300 hover:bg-teal-500/20 text-xs"
                >
                  Manage {t.orgName}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 text-teal-300 text-sm font-medium mb-4">
            <Building2 className="h-4 w-4" />
            Team &amp; University Access
          </div>
          <h1 className="text-4xl font-bold mb-3">Equip your entire team</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            One subscription. Variable seats. Full premium access for every member — managed from a single dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Brand selection */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Choose App Access</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BRAND_OPTIONS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBrand(b.value)}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      brand === b.value
                        ? "border-teal-400 bg-teal-500/10"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${b.color} mb-2`} />
                    <div className="font-medium text-sm">{b.label}</div>
                    <div className="text-xs text-white/50 mt-0.5">{b.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Plan selection */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Billing Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={plan} onValueChange={(v) => setPlan(v as "monthly" | "lifetime")}>
                  <TabsList className="bg-white/10 w-full">
                    <TabsTrigger value="monthly" className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white">
                      Monthly
                    </TabsTrigger>
                    <TabsTrigger value="lifetime" className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white">
                      Lifetime
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="monthly" className="mt-3 text-sm text-white/60">
                    Billed monthly per seat. Cancel anytime. Members lose access when subscription ends.
                  </TabsContent>
                  <TabsContent value="lifetime" className="mt-3 text-sm text-white/60">
                    One-time payment per seat. Members keep access permanently.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Seat count + org name */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">3. Seats &amp; Organisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white/80 mb-1.5 block">Number of seats</Label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg font-bold"
                    >−</button>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={seatCount}
                      onChange={(e) => setSeatCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center bg-white/10 border-white/20 text-white"
                    />
                    <button
                      onClick={() => setSeatCount(Math.min(500, seatCount + 1))}
                      className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg font-bold"
                    >+</button>
                    <div className="flex gap-2">
                      {[5, 10, 25, 50].map((n) => (
                        <button
                          key={n}
                          onClick={() => setSeatCount(n)}
                          className={`px-2.5 py-1 rounded text-xs border transition-all ${
                            seatCount === n ? "bg-teal-500 border-teal-400 text-white" : "border-white/20 text-white/60 hover:border-white/40"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  {nearDiscount && (
                    <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      Add {10 - seatCount} more seat{10 - seatCount > 1 ? "s" : ""} to unlock 15% bulk discount
                    </p>
                  )}
                  {hasDiscount && (
                    <p className="text-teal-400 text-xs mt-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      15% bulk discount applied!
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-white/80 mb-1.5 block">Organisation / University name</Label>
                  <Input
                    placeholder="e.g. General Hospital Ultrasound Department"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary + CTA */}
          <div className="space-y-4">
            <Card className="bg-white/5 border-white/10 text-white sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>App</span>
                    <span className="text-white">{BRAND_OPTIONS.find(b => b.value === brand)?.label}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Plan</span>
                    <span className="text-white capitalize">{plan}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Seats</span>
                    <span className="text-white">{seatCount}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between text-teal-400">
                      <span>Bulk discount</span>
                      <span>−{pricing?.discountPct}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white/60">
                    <span>Per seat</span>
                    <span className="text-white">
                      {pricing ? formatCents(pricing.pricePerSeatCents) : "…"}
                      {plan === "monthly" ? "/mo" : ""}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-teal-400">
                      {pricing ? formatCents(pricing.totalCents) : "…"}
                      {plan === "monthly" ? "/mo" : ""}
                    </span>
                  </div>
                  {plan === "monthly" && (
                    <p className="text-xs text-white/40 mt-1">Billed monthly. Cancel anytime.</p>
                  )}
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={isSubmitting || authLoading}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold"
                  size="lg"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                  ) : !user ? (
                    <>Sign in to purchase <ChevronRight className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Purchase {seatCount} seat{seatCount > 1 ? "s" : ""} <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>

                <p className="text-xs text-white/40 text-center">
                  Secure checkout via Stripe. Test card: 4242 4242 4242 4242
                </p>
              </CardContent>
            </Card>

            {/* Features */}
            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4 space-y-2">
                {FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
