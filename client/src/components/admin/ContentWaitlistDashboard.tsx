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
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
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
  const groupedEntries = entries.reduce((groups: Record<string, any[]>, entry: any) => {
    const key = `${entry.productType}:${entry.productId}`;
    (groups[key] ??= []).push(entry);
    return groups;
  }, {});
  const openNotification = (groupEntries: any[]) => {
    setSelected(groupEntries[0] ?? null);
    setSelectedEntryIds(groupEntries.map((entry) => entry.id));
  };
  return <div className="space-y-4">
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4"><div className="flex gap-2"><Users className="w-4 h-4 mt-0.5 text-teal-700" /><div><h3 className="font-semibold text-teal-950">Availability-status waitlists</h3><p className="text-sm text-teal-800">Track product and instance sign-ups. Enrollment-open email is always an explicit administrator action.</p></div></div></div>
    {isLoading ? <p className="py-8 text-center text-sm text-gray-500">Loading waitlists…</p> : entries.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No status-based waitlist sign-ups yet.</p> : <div className="space-y-4">{Object.values(groupedEntries).map((group: any) => <div key={`${group[0].productType}:${group[0].productId}`} className="border rounded-lg overflow-hidden"><div className="flex items-center justify-between bg-slate-50 px-3 py-2"><span className="text-sm font-medium capitalize">{group[0].productType.replace(/_/g, " ")} #{group[0].productId} · {group.length} waitlisted</span><Button size="sm" variant="outline" onClick={() => openNotification(group)}><Mail className="w-3 h-3 mr-1" />Notify All</Button></div><Table><TableHeader><TableRow><TableHead>Visitor</TableHead><TableHead>Signed up</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{group.map((entry: any) => <TableRow key={entry.id}><TableCell><div className="text-sm font-medium">{entry.name}</div><div className="text-xs text-gray-500">{entry.email}</div></TableCell><TableCell className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openNotification([entry])}><Mail className="w-3 h-3 mr-1" />Notify</Button></TableCell></TableRow>)}</TableBody></Table></div>)}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Send Enrollment Open</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This message will be sent to {selectedEntryIds.length} selected waitlisted {selectedEntryIds.length === 1 ? "visitor" : "visitors"}.</p><div className="space-y-3"><div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div><div><Label>Message</Label><Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></div><div><Label>Enrollment URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button className="bg-teal-600 hover:bg-teal-700" disabled={notify.isPending || !subject || !message || !url} onClick={() => selected && notify.mutate({ productType: selected.productType, productId: selected.productId, entryIds: selectedEntryIds, subject, messageHtml: message, enrollmentUrl: url })}>{notify.isPending ? "Sending…" : `Send to ${selectedEntryIds.length}`}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
