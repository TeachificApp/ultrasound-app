import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plane, MapPin, Award, Users, CheckCircle, ArrowRight, Stethoscope, Globe } from "lucide-react";

const REGISTRY_OPTIONS = [
  "RDMS", "RVT", "RDCS", "RCS", "RCCS", "CCI", "RMSK",
  "RMSKS", "RPVI", "RT(R)", "ARRT", "Other",
];

const SPECIALTY_OPTIONS = [
  "Abdominal", "OB/GYN", "Vascular", "Adult Echo",
  "Pediatric Echo", "Fetal Echo", "MSK", "Small Parts",
  "POCUS", "Breast", "Neuro", "Interventional",
];

export default function SonoTravelers() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [communitySlug, setCommunitySlug] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    registryCredentials: "",
    travelType: "" as "short_term" | "long_term" | "both" | "",
    currentLocation: "",
    travelAgency: "",
    yearsTravel: "",
    scanSpecialties: [] as string[],
    additionalInfo: "",
  });

  const submitMutation = trpc.sonoTravelers.submitLead.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setCommunitySlug(data.communitySlug);
    },
    onError: (err) => {
      toast({
        title: "Submission failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      scanSpecialties: prev.scanSpecialties.includes(s)
        ? prev.scanSpecialties.filter((x) => x !== s)
        : [...prev.scanSpecialties, s],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.travelType) {
      toast({ title: "Please select your travel type.", variant: "destructive" });
      return;
    }
    submitMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      registryCredentials: form.registryCredentials.trim() || undefined,
      travelType: form.travelType as "short_term" | "long_term" | "both",
      currentLocation: form.currentLocation.trim() || undefined,
      travelAgency: form.travelAgency.trim() || undefined,
      yearsTravel: form.yearsTravel.trim() || undefined,
      scanSpecialties: form.scanSpecialties.length > 0 ? form.scanSpecialties.join(", ") : undefined,
      additionalInfo: form.additionalInfo.trim() || undefined,
    });
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-900 to-teal-900 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to Sono Travelers!</h1>
          <p className="text-teal-200 text-lg mb-8 leading-relaxed">
            You now have immediate access to the Sono Travelers community. Connect with fellow travel sonographers, share tips, and find your next assignment.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-teal-500 hover:bg-teal-400 text-white font-semibold"
              onClick={() => navigate(`/community/${communitySlug ?? "sono-travelers"}`)}
            >
              <Users className="w-5 h-5 mr-2" />
              Enter the Community
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-teal-600 text-teal-200 hover:bg-teal-900"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lead / Funnel page ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-900 to-teal-900">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-teal-400 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-cyan-400 blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-teal-500/20 border border-teal-500/40 text-teal-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Plane className="w-4 h-4" />
            Free Community — Instant Access
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight">
            Sono Travelers
          </h1>
          <p className="text-xl sm:text-2xl text-teal-200 font-medium mb-3">
            The community built for travel sonographers.
          </p>
          <p className="text-teal-300/80 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect with fellow travelers, share agency reviews, swap assignment tips, and find your next opportunity — all in one place built specifically for sonographers on the road.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {[
              { icon: <Globe className="w-4 h-4" />, label: "Travel Tips & Resources" },
              { icon: <Award className="w-4 h-4" />, label: "Registry & CEU Support" },
              { icon: <MapPin className="w-4 h-4" />, label: "Assignment Reviews" },
              { icon: <Users className="w-4 h-4" />, label: "Peer Network" },
              { icon: <Stethoscope className="w-4 h-4" />, label: "All Modalities Welcome" },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-teal-200 text-sm px-3 py-1.5 rounded-full"
              >
                {icon}
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Join Sono Travelers</h2>
          <p className="text-teal-300/70 text-sm mb-6">
            Fill out the form below to get immediate access to the community.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-teal-200 text-sm font-medium">First Name *</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Jane"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-teal-200 text-sm font-medium">Last Name *</Label>
                <Input
                  required
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Smith"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-teal-200 text-sm font-medium">Email Address *</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="jane@example.com"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
              />
            </div>

            {/* Registry credentials */}
            <div className="space-y-1.5">
              <Label className="text-teal-200 text-sm font-medium">Registry Credentials</Label>
              <p className="text-teal-400/60 text-xs">e.g. RDMS, RVT, RDCS, CCI — list all that apply</p>
              <Input
                value={form.registryCredentials}
                onChange={(e) => setForm((p) => ({ ...p, registryCredentials: e.target.value }))}
                placeholder="RDMS, RVT"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {REGISTRY_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const current = form.registryCredentials;
                      const parts = current.split(",").map((s) => s.trim()).filter(Boolean);
                      if (parts.includes(r)) {
                        setForm((p) => ({ ...p, registryCredentials: parts.filter((x) => x !== r).join(", ") }));
                      } else {
                        setForm((p) => ({ ...p, registryCredentials: [...parts, r].join(", ") }));
                      }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.registryCredentials.split(",").map((s) => s.trim()).includes(r)
                        ? "bg-teal-500 border-teal-400 text-white"
                        : "bg-white/5 border-white/20 text-teal-300 hover:border-teal-500"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel type */}
            <div className="space-y-1.5">
              <Label className="text-teal-200 text-sm font-medium">Travel Type *</Label>
              <Select
                value={form.travelType}
                onValueChange={(v) => setForm((p) => ({ ...p, travelType: v as typeof form.travelType }))}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white focus:border-teal-400">
                  <SelectValue placeholder="Select your travel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short-Term (less than 13 weeks)</SelectItem>
                  <SelectItem value="long_term">Long-Term (13 weeks or more)</SelectItem>
                  <SelectItem value="both">Both Short-Term and Long-Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scan specialties */}
            <div className="space-y-1.5">
              <Label className="text-teal-200 text-sm font-medium">Scan Specialties</Label>
              <p className="text-teal-400/60 text-xs">Select all modalities you scan while traveling</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {SPECIALTY_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.scanSpecialties.includes(s)
                        ? "bg-teal-500 border-teal-400 text-white"
                        : "bg-white/5 border-white/20 text-teal-300 hover:border-teal-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel details section */}
            <div className="border-t border-white/10 pt-5">
              <p className="text-teal-300 text-sm font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Travel Details (optional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-teal-200 text-sm font-medium">Current Location / Assignment</Label>
                  <Input
                    value={form.currentLocation}
                    onChange={(e) => setForm((p) => ({ ...p, currentLocation: e.target.value }))}
                    placeholder="City, State"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-teal-200 text-sm font-medium">Travel Agency</Label>
                  <Input
                    value={form.travelAgency}
                    onChange={(e) => setForm((p) => ({ ...p, travelAgency: e.target.value }))}
                    placeholder="Agency name"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <Label className="text-teal-200 text-sm font-medium">Years Traveling</Label>
                <Input
                  value={form.yearsTravel}
                  onChange={(e) => setForm((p) => ({ ...p, yearsTravel: e.target.value }))}
                  placeholder="e.g. 2 years, just starting out, 5+"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400"
                />
              </div>
            </div>

            {/* Additional info */}
            <div className="space-y-1.5">
              <Label className="text-teal-200 text-sm font-medium">Anything else you'd like to share?</Label>
              <Textarea
                value={form.additionalInfo}
                onChange={(e) => setForm((p) => ({ ...p, additionalInfo: e.target.value }))}
                placeholder="Questions, goals, what you're looking to get from the community..."
                rows={3}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-teal-400 resize-none"
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              disabled={submitMutation.isPending}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold text-base py-3 rounded-xl shadow-lg shadow-teal-900/50"
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Join Sono Travelers — Free Access
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>

            <p className="text-center text-teal-400/60 text-xs">
              By joining, you agree to our community guidelines. No payment required.
            </p>
          </form>
        </div>

        {/* Social proof */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { stat: "Free", label: "Always free to join" },
            { stat: "Instant", label: "Immediate access" },
            { stat: "All Modalities", label: "Every specialty welcome" },
          ].map(({ stat, label }) => (
            <div key={stat} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-teal-300 font-bold text-lg">{stat}</div>
              <div className="text-teal-400/60 text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
