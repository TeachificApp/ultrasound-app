import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const PROFESSION_OPTIONS = [
  "Sonographer / Ultrasound Technologist",
  "Cardiologist / Echocardiographer",
  "Cardiac Sonographer",
  "Vascular Technologist",
  "Radiologist",
  "Radiology Technologist",
  "Nurse / NP / PA",
  "Medical Student / Resident",
  "Educator / Program Director",
  "Other",
];

const INTEREST_OPTIONS = [
  { value: "echo", label: "Echocardiography" },
  { value: "vascular", label: "Vascular Ultrasound" },
  { value: "general", label: "General / Abdominal Ultrasound" },
  { value: "cme", label: "CME / Continuing Education" },
  { value: "accreditation", label: "Lab Accreditation" },
  { value: "ai_tools", label: "AI & Clinical Tools" },
  { value: "new_courses", label: "New Course Announcements" },
  { value: "events", label: "Webinars & Live Events" },
];

export default function NewsletterSubscribe() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    profession: "",
    interests: [] as string[],
  });
  const [submitted, setSubmitted] = useState(false);

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const toggleInterest = (value: string) => {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(value)
        ? f.interests.filter(i => i !== value)
        : [...f.interests, value],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast.error("Please enter your email address.");
      return;
    }
    subscribeMutation.mutate({
      email: form.email,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      profession: form.profession || undefined,
      interests: form.interests.length > 0 ? form.interests : undefined,
      source: "subscribe_page",
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d4f52] via-[#0f6b70] to-[#189aa1] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-10 text-center">
          {/* Logos */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-[#189aa1] font-bold text-lg leading-tight">All About<br />Ultrasound</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Education</div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <div className="text-[#0d4f52] font-bold text-lg leading-tight">iHeartEcho</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Cardiology</div>
            </div>
          </div>

          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#189aa1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're subscribed!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Thank you for joining the <strong>All About Ultrasound</strong> and <strong>iHeartEcho</strong> community.
            You'll receive updates on new courses, CME opportunities, clinical tools, and upcoming events.
          </p>
          <p className="text-xs text-gray-400 mt-6">
            You can unsubscribe at any time by clicking the link in any email we send.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d4f52] via-[#0f6b70] to-[#189aa1] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d4f52] to-[#189aa1] px-8 py-8 text-white">
          {/* Dual brand logos */}
          <div className="flex items-center gap-6 mb-5">
            <div>
              <div className="font-bold text-xl leading-tight">All About Ultrasound™</div>
              <div className="text-teal-200 text-xs uppercase tracking-widest">allaboutultrasound.com</div>
            </div>
            <div className="w-px h-10 bg-white/30" />
            <div>
              <div className="font-bold text-xl leading-tight">iHeartEcho™</div>
              <div className="text-teal-200 text-xs uppercase tracking-widest">iheartecho.com</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1">Stay Connected</h1>
          <p className="text-teal-100 text-sm leading-relaxed">
            Get the latest CME courses, clinical tools, accreditation resources, and ultrasound education
            delivered directly to your inbox.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="jane@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
            />
          </div>

          {/* Profession */}
          <div className="space-y-1.5">
            <Label htmlFor="profession" className="text-sm font-medium text-gray-700">Profession</Label>
            <select
              id="profession"
              value={form.profession}
              onChange={e => setForm(f => ({ ...f, profession: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#189aa1] focus:outline-none focus:ring-1 focus:ring-[#189aa1]"
            >
              <option value="">Select your profession…</option>
              {PROFESSION_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Topics of Interest</Label>
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <Checkbox
                    checked={form.interests.includes(opt.value)}
                    onCheckedChange={() => toggleInterest(opt.value)}
                    className="border-gray-300 data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="w-full bg-[#189aa1] hover:bg-[#147f85] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {subscribeMutation.isPending ? "Subscribing…" : "Subscribe to Newsletter"}
          </Button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            By subscribing, you agree to receive educational emails from All About Ultrasound, Inc. dba iHeartEcho.
            You can unsubscribe at any time. We respect your privacy and will never share your information.
          </p>
        </form>
      </div>
    </div>
  );
}
