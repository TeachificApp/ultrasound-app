import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submitLead = trpc.funnelPublic.submitLead.useMutation({
    onSuccess: () => {
      onClose();
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Submission failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email"); return; }
    submitLead.mutate({
      funnelId,
      funnelPageId: pageId,
      email,
      name: name || undefined,
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
          <Input
            type="text"
            placeholder="Your name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-11"
          />
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
