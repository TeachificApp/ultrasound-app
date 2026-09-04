/**
 * NewsletterInlineWidget
 * Compact inline newsletter subscribe form for embedding on pages.
 * Full-page form is at /subscribe.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

interface Props {
  /** Optional dark background variant (default: light) */
  dark?: boolean;
  /** Source tag for analytics */
  source?: string;
}

export default function NewsletterInlineWidget({ dark = false, source = "inline_widget" }: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setSubscribed(true);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }
    subscribeMutation.mutate({
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      source,
    });
  };

  if (subscribed) {
    return (
      <div className={`rounded-xl px-6 py-5 flex items-center gap-4 ${dark ? "bg-white/10 text-white" : "bg-teal-50 text-teal-800"}`}>
        <CheckCircle2 className="w-7 h-7 flex-shrink-0 text-[#189aa1]" />
        <div>
          <p className="font-semibold text-sm">You're subscribed!</p>
          <p className={`text-xs mt-0.5 ${dark ? "text-white/70" : "text-teal-600"}`}>
            Thank you — you'll receive updates from All About Ultrasound™ &amp; iHeartEcho™.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-6 py-6 ${dark ? "bg-white/10" : "bg-teal-50 border border-teal-100"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Mail className={`w-4 h-4 ${dark ? "text-[#4ad9e0]" : "text-[#189aa1]"}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${dark ? "text-[#4ad9e0]" : "text-[#189aa1]"}`}>
          Newsletter
        </span>
      </div>
      <p className={`text-sm font-semibold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>
        Stay updated with All About Ultrasound™ &amp; iHeartEcho™
      </p>
      <p className={`text-xs mb-4 ${dark ? "text-white/60" : "text-gray-500"}`}>
        New courses, CME opportunities, clinical tools, and events — delivered to your inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          required
          aria-label="First Name"
          placeholder="First Name"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          className={`sm:w-32 flex-shrink-0 text-sm h-9 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#4ad9e0]" : "border-gray-300 focus:border-[#189aa1]"}`}
        />
        <Input
          type="text"
          required
          aria-label="Last Name"
          placeholder="Last Name"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          className={`sm:w-32 flex-shrink-0 text-sm h-9 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#4ad9e0]" : "border-gray-300 focus:border-[#189aa1]"}`}
        />
        <Input
          type="email"
          required
          aria-label="Email Address"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={`flex-1 text-sm h-9 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[#4ad9e0]" : "border-gray-300 focus:border-[#189aa1]"}`}
        />
        <Button
          type="submit"
          disabled={subscribeMutation.isPending}
          className="h-9 px-4 text-sm font-semibold bg-[#189aa1] hover:bg-[#147f85] text-white flex-shrink-0 flex items-center gap-1.5"
        >
          {subscribeMutation.isPending ? "…" : (
            <>Subscribe <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </Button>
      </form>
      <p className={`text-xs mt-3 ${dark ? "text-white/40" : "text-gray-400"}`}>
        No spam. Unsubscribe at any time.{" "}
        <a href="https://app.allaboutultrasound.com/subscribe" target="_blank" rel="noopener noreferrer" className={`underline ${dark ? "text-white/60 hover:text-white" : "text-[#189aa1] hover:text-[#147f85]"}`}>
          More options →
        </a>
      </p>
    </div>
  );
}
