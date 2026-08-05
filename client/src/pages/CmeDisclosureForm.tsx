/**
 * CmeDisclosureForm.tsx
 * Public electronic Financial Disclosure Form for CME faculty.
 * Accessible at /cme-disclosure/:token (no login required).
 * Teal branding, no CardioServ logo.
 */

import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Relationship {
  company: string;
  relationship: string;
  ended: boolean;
}

const ROLES = [
  "Teacher / Instructor / Faculty",
  "Planner",
  "Reviewer / Evaluator",
  "Author / Developer",
  "Committee Member",
  "Other",
];

const RELATIONSHIP_TYPES = [
  "Consulting fees",
  "Honoraria",
  "Grants / Research support",
  "Speaker's bureau",
  "Stock / Ownership interest",
  "Royalties / Patent",
  "Employee",
  "Advisory board",
  "Other financial relationship",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CmeDisclosureForm() {
  const { token: routeToken } = useParams<{ token: string }>();
  const token = routeToken ?? "";

  // ── Query: load disclosure record ──
  const { data, isLoading, error } = trpc.lmsDisclosure.getDisclosureByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // ── Form state ──
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [hasRelationships, setHasRelationships] = useState<"yes" | "no" | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([
    { company: "", relationship: "", ended: false },
  ]);
  const [attestationName, setAttestationName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.lmsDisclosure.submitDisclosure.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Submission failed. Please try again."),
  });

  // ── Handlers ──
  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const addRelationship = () => {
    setRelationships(prev => [...prev, { company: "", relationship: "", ended: false }]);
  };

  const updateRelationship = (idx: number, field: keyof Relationship, value: string | boolean) => {
    setRelationships(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRelationship = (idx: number) => {
    setRelationships(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (selectedRoles.length === 0) {
      toast.error("Please select at least one role.");
      return;
    }
    if (hasRelationships === null) {
      toast.error("Please indicate whether you have financial relationships to disclose.");
      return;
    }
    if (hasRelationships === "yes") {
      const incomplete = relationships.some(r => !r.company.trim() || !r.relationship.trim());
      if (incomplete) {
        toast.error("Please complete all relationship entries (company and relationship type are required).");
        return;
      }
    }
    if (!attestationName.trim()) {
      toast.error("Please enter your full name for the attestation.");
      return;
    }

    const responseJson = JSON.stringify({
      roles: selectedRoles,
      hasRelationships,
      relationships: hasRelationships === "yes" ? relationships : [],
      submittedAt: new Date().toISOString(),
    });

    submitMutation.mutate({ token, responseJson, attestationName: attestationName.trim() });
  };

  // ── Loading / Error / Already Submitted ──
  if (!token) {
    return <ErrorPage message="Invalid disclosure link. Please contact admin@allaboutultrasound.com." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fafa]">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorPage message="This disclosure link is invalid or has expired. Please contact admin@allaboutultrasound.com." />;
  }

  if (data.status === "submitted" || submitted) {
    return <SuccessPage facultyName={data.facultyName} courseTitle={data.courseTitle ?? "your course"} />;
  }

  // ── Main Form ──
  return (
    <div className="min-h-screen bg-[#f0fafa] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-[#189aa1] text-white rounded-t-xl px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6" />
            <span className="text-sm font-medium uppercase tracking-wider opacity-80">CME Accreditation</span>
          </div>
          <h1 className="text-2xl font-bold">Financial Disclosure Form</h1>
          <p className="text-sm opacity-80 mt-1">All About Ultrasound™ — Continuing Medical Education</p>
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-[#d0f0f2] px-8 py-6 space-y-8">
          {/* Pre-filled info */}
          <div className="bg-[#f0fafa] rounded-lg p-4 border border-[#c0e8ec] space-y-2">
            <div className="flex gap-2 text-sm">
              <span className="font-semibold text-[#189aa1] w-28 shrink-0">Faculty Name:</span>
              <span className="text-gray-800">{data.facultyName}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-semibold text-[#189aa1] w-28 shrink-0">Course:</span>
              <span className="text-gray-800">{data.courseTitle ?? "—"}</span>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-semibold text-[#189aa1] w-28 shrink-0">Email:</span>
              <span className="text-gray-800">{data.facultyEmail}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 leading-relaxed border-l-4 border-[#189aa1] pl-4">
            <p className="font-semibold text-gray-800 mb-1">Instructions</p>
            <p>
              All individuals in a position to control the content of this CME activity must disclose all relevant
              financial relationships with any commercial interest within the past 24 months. "Relevant financial
              relationships" are those in any amount that create a conflict of interest. If you have no relevant
              financial relationships, please indicate "No" below.
            </p>
          </div>

          {/* Section A: Role */}
          <section>
            <h2 className="text-base font-semibold text-[#189aa1] mb-3 flex items-center gap-2">
              <span className="bg-[#189aa1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">A</span>
              Your Role in This Activity
            </h2>
            <p className="text-sm text-gray-500 mb-3">Select all that apply.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLES.map(role => (
                <label key={role} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                    className="border-[#189aa1] data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-[#189aa1] transition-colors">{role}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Section B: Financial Relationships */}
          <section>
            <h2 className="text-base font-semibold text-[#189aa1] mb-3 flex items-center gap-2">
              <span className="bg-[#189aa1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">B</span>
              Financial Relationships Disclosure
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Do you have any relevant financial relationships with commercial interests to disclose?
            </p>
            <div className="flex gap-4 mb-4">
              {(["no", "yes"] as const).map(val => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasRelationships"
                    value={val}
                    checked={hasRelationships === val}
                    onChange={() => setHasRelationships(val)}
                    className="accent-[#189aa1]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {val === "no" ? "No — I have nothing to disclose" : "Yes — I have relationships to disclose"}
                  </span>
                </label>
              ))}
            </div>

            {hasRelationships === "yes" && (
              <div className="space-y-4">
                {relationships.map((rel, idx) => (
                  <div key={idx} className="border border-[#c0e8ec] rounded-lg p-4 bg-[#f8fefe] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#189aa1] uppercase tracking-wide">Relationship {idx + 1}</span>
                      {relationships.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRelationship(idx)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-600">Company / Organization *</Label>
                        <Input
                          value={rel.company}
                          onChange={e => updateRelationship(idx, "company", e.target.value)}
                          placeholder="e.g. Acme Medical Inc."
                          className="mt-1 h-8 text-sm border-[#c0e8ec] focus:border-[#189aa1]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Nature of Relationship *</Label>
                        <select
                          value={rel.relationship}
                          onChange={e => updateRelationship(idx, "relationship", e.target.value)}
                          className="mt-1 w-full h-8 text-sm border border-[#c0e8ec] rounded-md px-2 focus:outline-none focus:border-[#189aa1] bg-white"
                        >
                          <option value="">Select type…</option>
                          {RELATIONSHIP_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={rel.ended}
                        onCheckedChange={v => updateRelationship(idx, "ended", !!v)}
                        className="border-[#189aa1] data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                      />
                      <span className="text-xs text-gray-600">This relationship has ended</span>
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRelationship}
                  className="border-[#189aa1] text-[#189aa1] hover:bg-[#f0fafa]"
                >
                  + Add Another Relationship
                </Button>
              </div>
            )}

            {hasRelationships === "no" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                ✓ You have indicated no relevant financial relationships to disclose.
              </div>
            )}
          </section>

          {/* Section C: Attestation */}
          <section>
            <h2 className="text-base font-semibold text-[#189aa1] mb-3 flex items-center gap-2">
              <span className="bg-[#189aa1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">C</span>
              Attestation &amp; Electronic Signature
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 leading-relaxed mb-4">
              <p>
                I certify that the information provided above is complete and accurate to the best of my knowledge.
                I understand that I am required to disclose all relevant financial relationships and that failure to
                disclose may result in my removal from this CME activity. I agree to resolve any identified conflicts
                of interest prior to participating in this activity.
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Full Name (Electronic Signature) *
              </Label>
              <Input
                value={attestationName}
                onChange={e => setAttestationName(e.target.value)}
                placeholder="Type your full legal name"
                className="mt-1 border-[#c0e8ec] focus:border-[#189aa1]"
              />
              <p className="text-xs text-gray-400 mt-1">
                By typing your name above, you are providing an electronic signature equivalent to a handwritten signature.
              </p>
            </div>
          </section>

          {/* Submit */}
          <div className="pt-2 border-t border-gray-100">
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="w-full bg-[#189aa1] hover:bg-[#147a80] text-white h-11 text-base font-semibold"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
              ) : (
                "Submit Financial Disclosure"
              )}
            </Button>
            <p className="text-xs text-center text-gray-400 mt-2">
              Your submission will be sent to All About Ultrasound™ and CardioServ for review.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          All About Ultrasound™ · admin@allaboutultrasound.com · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0fafa] px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-gray-800 mb-2">Link Not Found</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

function SuccessPage({ facultyName, courseTitle }: { facultyName: string; courseTitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0fafa] px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-[#c0e8ec] p-8 text-center">
        <div className="w-16 h-16 bg-[#f0fafa] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-[#189aa1]" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Disclosure Submitted</h1>
        <p className="text-sm text-gray-600 mb-4">
          Thank you, <strong>{facultyName}</strong>. Your Financial Disclosure Form for{" "}
          <em>{courseTitle}</em> has been received and will be reviewed by All About Ultrasound™ and CardioServ.
        </p>
        <div className="bg-[#f0fafa] rounded-lg p-3 text-xs text-gray-500 border border-[#d0f0f2]">
          A notification has been sent to admin@allaboutultrasound.com and CardioServ.
        </div>
        <p className="text-xs text-gray-400 mt-6">
          All About Ultrasound™ · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
