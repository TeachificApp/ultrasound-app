import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface LeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after lead is successfully stored — execute the original button action */
  onSuccess: () => void;
  title?: string;
  subtext?: string;
  tags?: string;
  campaignId?: number;
  funnelId: number;
  pageId: number;
}

export default function LeadCaptureModal({
  open,
  onClose,
  onSuccess,
  title = "Get Instant Access",
  subtext,
  tags,
  campaignId,
  funnelId,
  pageId,
}: LeadCaptureModalProps) {
  const { user } = useAuth();

  // Derive initial first/last name from user.name or user.displayName
  const getInitialName = () => {
    const fullName = (user?.displayName || user?.name || "").trim();
    const parts = fullName.split(" ");
    return {
      first: parts[0] ?? "",
      last: parts.slice(1).join(" ") ?? "",
    };
  };

  const [firstName, setFirstName] = useState(() => getInitialName().first);
  const [lastName, setLastName] = useState(() => getInitialName().last);
  const [email, setEmail] = useState(() => user?.email ?? "");

  // Re-populate if user loads after modal opens
  useEffect(() => {
    if (!user) return;
    const { first, last } = getInitialName();
    if (first) setFirstName(first);
    if (last) setLastName(last);
    if (user.email) setEmail(user.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submitLead = trpc.funnelPublic.submitLead.useMutation({
    onSuccess: () => {
      onClose();
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Submission failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error("Please enter your first name"); return; }
    if (!lastName.trim()) { toast.error("Please enter your last name"); return; }
    if (!email) { toast.error("Please enter your email"); return; }
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    submitLead.mutate({
      funnelId,
      funnelPageId: pageId,
      email,
      name: fullName,
      tags: tags || undefined,
      campaignId: campaignId || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      referrer: document.referrer || undefined,
      sourcePage: window.location.href,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtext && <DialogDescription>{subtext}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              required
              className="h-11"
            />
            <Input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="h-11"
          />
          <Button
            type="submit"
            disabled={submitLead.isPending}
            className="w-full h-11 font-semibold bg-teal-600 hover:bg-teal-700 text-white"
          >
            {submitLead.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Continue
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
          >
            No thanks, skip
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-1">We respect your privacy. Unsubscribe anytime.</p>
      </DialogContent>
    </Dialog>
  );
}
