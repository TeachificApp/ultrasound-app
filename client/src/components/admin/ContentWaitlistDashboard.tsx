import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Users } from "lucide-react";
import { toast } from "sonner";

export function ContentWaitlistDashboard() {
  const { data: entries = [], refetch, isLoading } = trpc.contentAvailability.listWaitlistEntries.useQuery();
  const [selected, setSelected] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const notify = trpc.contentAvailability.notifyEnrollmentOpen.useMutation({
    onSuccess: (result) => { toast.success(`Enrollment-open email sent to ${result.sent} waitlisted visitor.`); setSelected(null); refetch(); },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    if (!selected) return;
    const label = `${selected.productType.replace(/_/g, " ")} #${selected.productId}`;
    setSubject(`Enrollment is now open: ${label}`);
    setMessage(`<p>Enrollment is now open for <strong>${label}</strong>.</p><p>We would be delighted to welcome you.</p>`);
    setUrl(window.location.origin);
  }, [selected]);
  return <div className="space-y-4">
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4"><div className="flex gap-2"><Users className="w-4 h-4 mt-0.5 text-teal-700" /><div><h3 className="font-semibold text-teal-950">Availability-status waitlists</h3><p className="text-sm text-teal-800">Track product and instance sign-ups. Enrollment-open email is always an explicit administrator action.</p></div></div></div>
    {isLoading ? <p className="py-8 text-center text-sm text-gray-500">Loading waitlists…</p> : entries.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No status-based waitlist sign-ups yet.</p> : <div className="border rounded-lg overflow-hidden"><Table><TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Visitor</TableHead><TableHead>Signed up</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{entries.map((entry: any) => <TableRow key={entry.id}><TableCell className="text-sm capitalize">{entry.productType.replace(/_/g, " ")} #{entry.productId}</TableCell><TableCell><div className="text-sm font-medium">{entry.name}</div><div className="text-xs text-gray-500">{entry.email}</div></TableCell><TableCell className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelected(entry)}><Mail className="w-3 h-3 mr-1" />Notify</Button></TableCell></TableRow>)}</TableBody></Table></div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Send Enrollment Open</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div><div><Label>Message</Label><Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></div><div><Label>Enrollment URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={notify.isPending || !subject || !message || !url} onClick={() => selected && notify.mutate({ productType: selected.productType, productId: selected.productId, entryIds: [selected.id], subject, messageHtml: message, enrollmentUrl: url })}>{notify.isPending ? "Sending…" : "Send Email"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
