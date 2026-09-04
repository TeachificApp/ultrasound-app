import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function NewsletterSubscribe() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }
    subscribeMutation.mutate({
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
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
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name <span className="text-red-500">*</span></Label>
              <Input
                id="firstName"
                required
                placeholder="Jane"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name <span className="text-red-500">*</span></Label>
              <Input
                id="lastName"
                required
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

          {/* Submit */}
          <Button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="w-full bg-[#189aa1] hover:bg-[#147f85] text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {subscribeMutation.isPending ? "Subscribing…" : "Subscribe to Newsletter"}
          </Button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            By subscribing, you agree to receive educational and marketing emails from All About Ultrasound, Inc. dba iHeartEcho.
            You can unsubscribe at any time. We respect your privacy and will never share your information.
          </p>
        </form>
      </div>
    </div>
  );
}
