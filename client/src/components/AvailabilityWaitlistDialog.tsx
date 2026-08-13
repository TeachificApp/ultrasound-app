import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AvailabilityWaitlistDialog({
  open,
  onClose,
  productType,
  productId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  productType: "course" | "cohort_group" | "workshop" | "workshop_instance" | "webinar" | "download" | "bundle" | "membership" | "quiz";
  productId: number;
  title: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const join = trpc.contentAvailability.joinWaitlist.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      join.reset();
    }
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) return;
    join.mutate({ productType, productId, name: name.trim(), email: email.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-md">
        {submitted ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100"><Bell className="h-8 w-8 text-teal-600" /></div>
            <DialogHeader>
              <DialogTitle className="text-xl text-teal-700">You’re on the Waitlist</DialogTitle>
              <DialogDescription>We’ll let you know when enrolment opens for {title}.</DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-teal-700">Join the Waitlist</DialogTitle>
              <DialogDescription>Be the first to know when enrolment opens for {title}.</DialogDescription>
            </DialogHeader>
            <form className="mt-2 space-y-4" onSubmit={submit}>
              <div className="space-y-1"><Label htmlFor="availability-waitlist-name">Full Name <span className="text-red-500">*</span></Label><Input id="availability-waitlist-name" required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Smith" /></div>
              <div className="space-y-1"><Label htmlFor="availability-waitlist-email">Email Address <span className="text-red-500">*</span></Label><Input id="availability-waitlist-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@example.com" /></div>
              <Button type="submit" className="w-full bg-teal-600 text-white hover:bg-teal-700" disabled={join.isPending}>{join.isPending ? "Submitting…" : "Join the Waitlist"}</Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
