/**
 * CmeDisclosureFormGeneric.tsx
 * Standalone generic Financial Disclosure Form — no token or course link required.
 * Faculty enter their own name, email, and activity title.
 * Accessible at /cme-disclosure/generic (no login required).
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, FileText, Plus, Trash2 } from "lucide-react";

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function CmeDisclosureFormGeneric() {
  // ── Identity fields (editable by the user) ──
  const [facultyName, setFacultyName] = useState("");
  const [facultyEmail, setFacultyEmail] = useState("");
  const [activityTitle, setActivityTitle] = useState("");

  // ── Form state ──
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [hasRelationships, setHasRelationships] = useState<"yes" | "no">("yes");
  const [relationships, setRelationships] = useState<Relationship[]>([
    { company: "", relationship: "", ended: false },
  ]);
  const [attestationName, setAttestationName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.lmsDisclosure.submitGenericDisclosure.useMutation({
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
    if (!facultyName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!facultyEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(facultyEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!activityTitle.trim()) {
      toast.error("Please enter the activity or course title.");
      return;
    }
    if (selectedRoles.length === 0) {
      toast.error("Please select at least one role.");
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

    submitMutation.mutate({
      facultyName: facultyName.trim(),
      facultyEmail: facultyEmail.trim(),
      activityTitle: activityTitle.trim(),
      responseJson,
      attestationName: attestationName.trim(),
    });
  };

  // ── Success ──
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0fafa] px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-[#c0e8ec] p-8 text-center">
          <div className="w-16 h-16 bg-[#f0fafa] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-[#189aa1]" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Disclosure Submitted</h1>
          <p className="text-sm text-gray-600 mb-4">
            Thank you, <strong>{facultyName}</strong>. Your Financial Disclosure Form for{" "}
            <em>{activityTitle}</em> has been received and will be reviewed by All About Ultrasound™ and CardioServ.
          </p>
          <div className="bg-[#f0fafa] rounded-lg p-3 text-xs text-gray-500 border border-[#d0f0f2]">
            A notification has been sent to admin@allaboutultrasound.com and CardioServ.
          </div>
          <p className="text-xs text-gray-400 mt-6">
            All About Ultrasound™ · CME Joint Provider with CardioServ, LLC · © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  // ── Main Form ──
  return (
    <div className="min-h-screen bg-[#f0fafa] py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-[#189aa1] text-white rounded-t-xl px-8 py-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 opacity-80" />
            <span className="text-xs font-medium uppercase tracking-wider opacity-80">CME Accreditation</span>
          </div>
          <h1 className="text-2xl font-bold">Financial Disclosure Form</h1>
          <p className="text-sm opacity-80 mt-1">
            All About Ultrasound™ is a CME joint provider with CardioServ, LLC.
          </p>
        </div>

        <div className="bg-white rounded-b-xl shadow-sm border border-[#d0f0f2] px-8 py-6 space-y-7">

          {/* Identity fields — editable */}
          <div className="bg-[#f0fafa] rounded-lg p-4 border border-[#c0e8ec] space-y-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Your Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#189aa1]">Full Name *</Label>
                <Input
                  value={facultyName}
                  onChange={e => setFacultyName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="mt-1 border-[#c0e8ec] focus:border-[#189aa1]"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-[#189aa1]">Email Address *</Label>
                <Input
                  type="email"
                  value={facultyEmail}
                  onChange={e => setFacultyEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  className="mt-1 border-[#c0e8ec] focus:border-[#189aa1]"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-[#189aa1]">Activity / Course Title *</Label>
              <Input
                value={activityTitle}
                onChange={e => setActivityTitle(e.target.value)}
                placeholder="e.g. All About LV Mechanical Support — 2 CME"
                className="mt-1 border-[#c0e8ec] focus:border-[#189aa1]"
              />
            </div>
          </div>

          {/* Intro paragraph */}
          <div className="text-sm text-gray-700 leading-relaxed space-y-3">
            <p>
              As a prospective planner or faculty member, we would like to ask for your help in protecting our
              learning environment from industry influence. Please complete the form below.
            </p>
            <p>
              The ACCME Standards for Integrity and Independence require that individuals who refuse to disclose
              relevant financial relationships be disqualified from involvement in the planning and implementation
              of accredited continuing education. Thank you for your diligence and cooperation. If you have
              questions, please contact:{" "}
              <a href="mailto:admin@allaboutultrasound.com" className="text-[#189aa1] underline">admin@allaboutultrasound.com</a>
            </p>
          </div>

          {/* ACCME disclosure instructions */}
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="font-bold italic">
              To be Completed by Planner, Faculty, or Others Who May Control Educational Content
            </p>
            <p>
              Please disclose <strong className="underline">all financial relationships</strong> that you have had
              in the past 24 months with ineligible companies (see definition below). For each financial
              relationship, enter the name of the ineligible company and the nature of the financial
              relationship(s). There is no minimum financial threshold; please disclose all financial
              relationships, regardless of the amount or perceived relevance to the educational activity.
            </p>
          </div>

          {/* Section A: Role */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-[#189aa1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">A</span>
              Your Role in This Activity
            </h2>
            <p className="text-xs text-gray-500 mb-3">Select all that apply.</p>
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

          {/* Section B: Financial Relationships Table */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="bg-[#189aa1] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">B</span>
              Financial Relationships with Ineligible Companies
            </h2>

            {/* Unified CardioServ-style table */}
            <div className="border border-gray-300 rounded-lg overflow-hidden text-xs mb-4">

              {/* Column header labels */}
              <div className="grid grid-cols-[1fr_1fr_160px] divide-x divide-gray-300 border-b border-gray-300">
                <div className="bg-gray-100 px-3 py-2 font-bold text-gray-800">Enter the Name of Ineligible Company</div>
                <div className="bg-gray-100 px-3 py-2 font-bold text-gray-800">Enter the Nature of Financial Relationship</div>
                <div className="bg-gray-100 px-3 py-2 font-bold text-gray-800 text-center">Has the Relationship Ended?</div>
              </div>

              {/* Definition text */}
              <div className="grid grid-cols-[1fr_1fr_160px] divide-x divide-gray-300 border-b border-gray-300">
                <div className="bg-gray-50 px-3 py-3 text-gray-600 leading-relaxed">
                  An <strong>ineligible company</strong> is any entity whose primary business is producing,
                  marketing, selling, re-selling, or distributing healthcare products used by or on patients.
                  <br /><br />
                  For specific examples of ineligible companies visit{" "}
                  <a href="https://accme.org/standards" target="_blank" rel="noopener noreferrer"
                    className="text-[#189aa1] underline">accme.org/standards</a>.
                </div>
                <div className="bg-gray-50 px-3 py-3 text-gray-600 leading-relaxed">
                  Examples of financial relationships include employee, researcher, consultant, advisor, speaker,
                  independent contractor (including contracted research), royalties or patent beneficiary,
                  executive role, and ownership interest. Individual stocks and stock options should be
                  disclosed; diversified mutual funds do not need to be disclosed. Research funding from
                  ineligible companies should be disclosed by the principal or named investigator even if that
                  individual's institution receives the research grant and manages the funds.
                </div>
                <div className="bg-gray-50 px-3 py-3 text-gray-600 leading-relaxed">
                  If the financial relationship existed during the last 24 months, but has now ended, please
                  check the box in this column. This will help the education staff determine if any mitigation
                  steps need to be taken.
                </div>
              </div>

              {/* Entry rows */}
              {hasRelationships !== "no" && (
                <div className="divide-y divide-gray-200">
                  {relationships.map((rel, idx) => (
                    <div key={idx} className={`grid grid-cols-[1fr_1fr_160px] divide-x divide-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="px-2 py-1.5">
                        <input
                          type="text"
                          value={rel.company}
                          onChange={e => updateRelationship(idx, "company", e.target.value)}
                          placeholder="Company name"
                          className="w-full h-7 text-sm bg-transparent border-0 outline-none focus:outline-none placeholder:text-gray-300"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <input
                          type="text"
                          value={rel.relationship}
                          onChange={e => updateRelationship(idx, "relationship", e.target.value)}
                          placeholder="e.g. Consultant, Speaker…"
                          className="w-full h-7 text-sm bg-transparent border-0 outline-none focus:outline-none placeholder:text-gray-300"
                        />
                      </div>
                      <div className="px-2 py-1.5 flex items-center justify-center gap-2">
                        <Checkbox
                          checked={rel.ended}
                          onCheckedChange={v => updateRelationship(idx, "ended", !!v)}
                          className="border-gray-400 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1] w-4 h-4"
                        />
                        {relationships.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRelationship(idx)}
                            className="text-red-300 hover:text-red-500 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {hasRelationships !== "no" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRelationship}
                className="mb-4 border-dashed border-[#189aa1] text-[#189aa1] hover:bg-[#f0fafa] text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Another Row
              </Button>
            )}

            {/* No relationships checkbox */}
            <label className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Checkbox
                checked={hasRelationships === "no"}
                onCheckedChange={checked => setHasRelationships(checked ? "no" : "yes")}
                className="border-gray-400 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1] mt-0.5 shrink-0"
              />
              <span className="text-sm text-gray-700">
                In the past 24 months, I have not had any financial relationships with any ineligible companies.
              </span>
            </label>

            <p className="text-xs text-gray-500 italic mt-2">
              *Notify CardioServ CME Program immediately if any new financial relationship with an ineligible
              company arises within 24 months following the date of this disclosure.
            </p>
          </section>

          {/* Section C: Attestation */}
          <section>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed mb-4">
              <p className="font-bold">I attest that the above information is correct as of this date of submission.</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Full Name (Electronic Signature) *
              </Label>
              <Input
                value={attestationName}
                onChange={e => setAttestationName(e.target.value)}
                placeholder="Type your full legal name"
                className="mt-1 border-[#c0e8ec] focus:border-[#189aa1] max-w-xs"
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
          All About Ultrasound™ · CME Joint Provider with CardioServ, LLC · © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
