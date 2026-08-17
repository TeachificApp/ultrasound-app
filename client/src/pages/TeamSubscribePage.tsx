/**
 * TeamSubscribePage — /team/subscribe
 *
 * For App brand team memberships (aaus / iheartecho / dual):
 *   Shows a contact/inquiry form — no pricing, no direct checkout.
 *   Submits lead to admin via email + in-app notification.
 *
 * For other team products (future):
 *   Self-serve checkout flow (currently only App brands are offered here).
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Users, CheckCircle2, Loader2, Mail, Phone,
  GraduationCap, ChevronRight, ArrowLeft,
} from "lucide-react";

const BRAND_OPTIONS = [
  {
    value: "aaus" as const,
    label: "UltrasoundAssist™",
    description: "Ultrasound Clinical Intelligence",
    color: "teal",
  },
  {
    value: "iheartecho" as const,
    label: "EchoAssist™",
    description: "Echocardiography",
    color: "blue",
  },
  {
    value: "dual" as const,
    label: "Both Apps",
    description: "UltrasoundAssist™ + EchoAssist™",
    color: "purple",
  },
];

const FEATURES = [
  "Premium access for every invited member",
  "Centralized seat management dashboard",
  "Invite members by email — they join with one click",
  "Revoke or reassign seats at any time",
  "Volume pricing available for 10+ seats",
  "Monthly or lifetime options",
  "Dedicated onboarding support",
];

const SEAT_PRESETS = [5, 10, 25, 50, 100];

export default function TeamSubscribePage() {
  const [, navigate] = useLocation();
  // Form state
  const [brand, setBrand] = useState<"aaus" | "iheartecho" | "dual">("aaus");
  const [plan, setPlan] = useState<"monthly" | "lifetime">("monthly");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [seatEstimate, setSeatEstimate] = useState(10);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitInquiry = trpc.team.submitInquiry.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "Please try again or email us directly.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Organization name is required.");
      return;
    }
    if (!contactName.trim()) {
      toast.error("Contact name is required.");
      return;
    }
    if (!contactEmail.trim()) {
      toast.error("Contact email is required.");
      return;
    }
    submitInquiry.mutate({
      orgName: orgName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim() || undefined,
      seatEstimate,
      brand,
      plan,
      message: message.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-teal-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Inquiry received!</h1>
            <p className="text-white/60 text-lg">
              Thanks, <strong className="text-white">{contactName}</strong>. We'll be in touch within 1–2 business days to discuss pricing, onboarding, and next steps.
            </p>
          </div>
          <p className="text-white/40 text-sm">
            A confirmation has been sent to <span className="text-white/60">{contactEmail}</span>.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/")}
              className="bg-teal-500 hover:bg-teal-400 text-white font-semibold"
              size="lg"
            >
              Return to home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1 as any)}
          className="text-white/60 hover:text-white text-sm flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/30 rounded-full px-4 py-1.5 text-teal-300 text-sm font-medium mb-4">
            <GraduationCap className="h-4 w-4" />
            Team &amp; University Access
          </div>
          <h1 className="text-4xl font-bold mb-3">Equip your entire team</h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            One subscription. Variable seats. Full premium access for every member — managed from a single dashboard. Contact us to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Contact form */}
          <div className="lg:col-span-2">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5 text-teal-400" />
                  Contact us for team pricing
                </CardTitle>
                <p className="text-white/50 text-sm mt-1">
                  Fill in the form below and we'll reach out within 1–2 business days with a custom quote.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* App selection */}
                  <div>
                    <Label className="text-white/80 mb-2 block">App access</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {BRAND_OPTIONS.map((b) => (
                        <button
                          key={b.value}
                          type="button"
                          onClick={() => setBrand(b.value)}
                          className={`rounded-lg border p-3 text-left transition-all ${
                            brand === b.value
                              ? "border-teal-400 bg-teal-500/10"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <div className="font-medium text-sm">{b.label}</div>
                          <div className="text-xs text-white/50 mt-0.5">{b.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Plan preference */}
                  <div>
                    <Label className="text-white/80 mb-2 block">Plan preference</Label>
                    <Tabs value={plan} onValueChange={(v) => setPlan(v as "monthly" | "lifetime")}>
                      <TabsList className="bg-white/10 w-full">
                        <TabsTrigger
                          value="monthly"
                          className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white"
                        >
                          Monthly
                        </TabsTrigger>
                        <TabsTrigger
                          value="lifetime"
                          className="flex-1 data-[state=active]:bg-teal-500 data-[state=active]:text-white"
                        >
                          Lifetime
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Seat estimate */}
                  <div>
                    <Label className="text-white/80 mb-2 block">Estimated number of seats</Label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSeatEstimate(Math.max(1, seatEstimate - 1))}
                          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg font-bold"
                        >−</button>
                        <Input
                          type="number"
                          min={1}
                          max={10000}
                          value={seatEstimate}
                          onChange={(e) => setSeatEstimate(Math.max(1, Math.min(10000, parseInt(e.target.value) || 1)))}
                          className="w-20 text-center bg-white/10 border-white/20 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setSeatEstimate(Math.min(10000, seatEstimate + 1))}
                          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg font-bold"
                        >+</button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {SEAT_PRESETS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSeatEstimate(n)}
                            className={`px-2.5 py-1 rounded text-xs border transition-all ${
                              seatEstimate === n
                                ? "bg-teal-500 border-teal-400 text-white"
                                : "border-white/20 text-white/60 hover:border-white/40"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Organization name */}
                  <div>
                    <Label className="text-white/80 mb-1.5 block">
                      Organization / University name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      required
                      placeholder="e.g. General Hospital Ultrasound Department"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    />
                  </div>

                  {/* Contact name + email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-white/80 mb-1.5 block">
                        Your name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        required
                        placeholder="Dr. Jane Smith"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div>
                      <Label className="text-white/80 mb-1.5 block">
                        Email address <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        required
                        type="email"
                        placeholder="jane@hospital.org"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Phone (optional) */}
                  <div>
                    <Label className="text-white/80 mb-1.5 block flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      Phone number <span className="text-white/40 text-xs ml-1">(optional)</span>
                    </Label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <Label className="text-white/80 mb-1.5 block">
                      Additional information <span className="text-white/40 text-xs ml-1">(optional)</span>
                    </Label>
                    <Textarea
                      placeholder="Tell us about your team, any specific requirements, or questions you have…"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30 resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitInquiry.isLoading}
                    className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold"
                    size="lg"
                  >
                    {submitInquiry.isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                    ) : (
                      <>Send inquiry <ChevronRight className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>

                  <p className="text-xs text-white/40 text-center">
                    We'll respond within 1–2 business days. No commitment required.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right: Features */}
          <div className="space-y-4">
            <Card className="bg-white/5 border-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-400" />
                  What's included
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                    {f}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-teal-500/10 border-teal-500/30 text-white">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 text-teal-300 font-medium text-sm">
                  <Building2 className="h-4 w-4" />
                  Volume pricing available
                </div>
                <p className="text-white/60 text-xs">
                  Teams of 10 or more seats qualify for discounted pricing. Contact us to learn more.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 text-white">
              <CardContent className="pt-4">
                <p className="text-white/50 text-xs leading-relaxed">
                  Prefer to reach us directly? Email{" "}
                  <a
                    href="mailto:info@allaboutultrasound.com"
                    className="text-teal-400 hover:underline"
                  >
                    info@allaboutultrasound.com
                  </a>{" "}
                  with your organization name and seat count.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
