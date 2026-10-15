import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Mail, RefreshCw, Save, Search, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ContentItem = {
  id: number;
  source: string;
  contentType: string;
  title: string;
  subtitle: string | null;
  brand: string | null;
  status: string;
  previewOnly?: boolean;
  workshopId?: number;
};
type Override = {
  id: number;
  contentType: string;
  contentId: number;
  enabled: boolean;
  subject: string | null;
  heading: string | null;
  intro: string | null;
  detailsHtml: string | null;
  updatedAt: Date | string;
};

const LABELS: Record<string, string> = {
  course: "Course", quiz: "Quiz", cohort: "Cohort", download: "Download", bundle: "Bundle",
  webinar: "Webinar", workshop: "Workshop", workshop_instance: "Workshop instance",
  physical_product: "Physical product", membership: "Membership", account_setup: "Account setup", team_subscription: "Team subscription",
};

const DEFAULT_COPY: Record<string, { subject: string; heading: string; intro: string }> = {
  course: { subject: "Welcome to your course", heading: "Welcome — your access is ready", intro: "Your purchase is complete and your course access is ready." },
  quiz: { subject: "Your quiz access is ready", heading: "Your access is ready", intro: "Your purchase is complete and your quiz access is ready." },
  cohort: { subject: "Welcome to your cohort", heading: "Welcome — your access is ready", intro: "Your purchase is complete and your cohort access is ready." },
  download: { subject: "Your download is ready", heading: "Your download is ready", intro: "Your purchase is complete and your files are ready." },
  bundle: { subject: "Your bundle access is ready", heading: "Your bundle is ready", intro: "Your purchase is complete and bundle access is ready." },
  webinar: { subject: "Your webinar registration is confirmed", heading: "Your webinar registration is confirmed", intro: "Your purchase is complete and webinar access is ready." },
  workshop: { subject: "Your workshop registration is confirmed", heading: "Your workshop registration is confirmed", intro: "Your purchase is complete and workshop access is ready." },
  workshop_instance: { subject: "Your workshop registration is confirmed", heading: "Your workshop registration is confirmed", intro: "Your purchase is complete and workshop access is ready." },
  physical_product: { subject: "Your order is confirmed", heading: "Your order is confirmed", intro: "Your order has been received and is being processed." },
  membership: { subject: "Your membership is active", heading: "Welcome — your membership is active", intro: "Your purchase is complete and membership access is ready." },
};

export function PurchaseEmailOverrides() {
  const utils = trpc.useUtils();
  const query = trpc.purchaseEmailOverrides.list.useQuery(undefined, {
    // Always refresh when the console opens. The catalog reflects live content
    // and should not retain an empty response following a just-completed
    // Railway schema or content update.
    staleTime: 0,
    refetchOnMount: "always",
    retry: 2,
  });
  const save = trpc.purchaseEmailOverrides.save.useMutation({
    onSuccess: async () => { await Promise.all([utils.purchaseEmailOverrides.list.invalidate(), utils.purchaseEmailOverrides.preview.invalidate()]); toast.success("Purchase email copy saved. No email was sent."); },
    onError: (error) => toast.error(error.message),
  });
  const revert = trpc.purchaseEmailOverrides.revertToDefault.useMutation({
    onSuccess: async () => { await Promise.all([utils.purchaseEmailOverrides.list.invalidate(), utils.purchaseEmailOverrides.preview.invalidate()]); toast.success("Reverted to generated purchase email. No email was sent."); },
    onError: (error) => toast.error(error.message),
  });

  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [intro, setIntro] = useState("");
  const [detailsHtml, setDetailsHtml] = useState("");
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedWorkshopInstanceId, setSelectedWorkshopInstanceId] = useState<string>("");

  const catalog = (query.data?.content ?? []) as ContentItem[];
  const overrides = (query.data?.overrides ?? []) as Override[];
  const unavailableSources = query.data?.unavailableSources ?? [];
  const overrideByKey = useMemo(() => new Map(overrides.map((item) => [`${item.contentType}:${item.contentId}`, item])), [overrides]);
  const items = useMemo(() => catalog.filter((item) => {
    if (typeFilter !== "all" && item.contentType !== typeFilter) return false;
    const text = `${item.title} ${item.subtitle ?? ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [catalog, typeFilter, search]);
  const selected = catalog.find((item) => `${item.source}:${item.contentType}:${item.id}` === selectedKey) ?? null;
  const selectedOverride = selected && !selected.previewOnly ? overrideByKey.get(`${selected.contentType}:${selected.id}`) : null;
  const workshopInstances = useMemo(() => selected?.source === "workshop"
    ? catalog.filter((item) => item.source === "workshop_instance" && item.workshopId === selected.id)
    : [], [catalog, selected]);
  const selectedWorkshopInstance = workshopInstances.find((item) => String(item.id) === selectedWorkshopInstanceId) ?? null;
  const preview = trpc.purchaseEmailOverrides.preview.useQuery(
    previewItem ? { source: previewItem.source as any, contentId: previewItem.id, contentType: previewItem.contentType as any } : undefined as any,
    { enabled: Boolean(previewItem), retry: false },
  );

  useEffect(() => {
    if (!selected) return;
    const defaults = DEFAULT_COPY[selected.contentType] ?? DEFAULT_COPY.course;
    setEnabled(selectedOverride?.enabled ?? true);
    setSubject(selectedOverride?.subject ?? defaults.subject);
    setHeading(selectedOverride?.heading ?? defaults.heading);
    setIntro(selectedOverride?.intro ?? defaults.intro);
    setDetailsHtml(selectedOverride?.detailsHtml ?? "");
  }, [selectedKey, selectedOverride?.id, selectedOverride?.updatedAt]);

  useEffect(() => {
    setSelectedWorkshopInstanceId("");
  }, [selectedKey]);

  function select(item: ContentItem) {
    setSelectedKey(`${item.source}:${item.contentType}:${item.id}`);
  }

  function openPreview() {
    if (!selected) return;
    const previewTarget = selected.source === "workshop" ? selectedWorkshopInstance : selected;
    if (!previewTarget) {
      toast.message("Select a scheduled workshop instance to preview its confirmation with the correct date, time zone, and location.");
      return;
    }
    const wasAlreadySelected = previewItem?.source === previewTarget.source && previewItem.id === previewTarget.id && previewItem.contentType === previewTarget.contentType;
    setPreviewItem(previewTarget);
    setPreviewOpen(true);
    if (wasAlreadySelected) void preview.refetch();
  }

  async function saveCopy() {
    if (!selected || selected.previewOnly) return;
    await save.mutateAsync({
      contentType: selected.contentType as any,
      contentId: selected.id,
      enabled,
      subject: subject || null,
      heading: heading || null,
      intro: intro || null,
      detailsHtml: detailsHtml || null,
    });
  }

  return (
    <div className="space-y-5">
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 via-white to-cyan-50">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-xl bg-teal-600 p-2.5 text-white"><Mail className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Purchase Email Overrides</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Purchase emails are automatic. Use this page only to tailor reliable, content-specific copy; all links and workshop schedule details remain generated from the active purchase and scheduled instance.</p>
              </div>
            </div>
            <Badge className="w-fit bg-teal-100 text-teal-800 hover:bg-teal-100"><ShieldCheck className="mr-1 h-3.5 w-3.5" />No retrospective sends</Badge>
          </div>
          <div className="mt-4 rounded-lg border border-teal-100 bg-white/80 p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Safe by design:</strong> saving, disabling, or reverting an override never sends or resends an email. A future paid checkout receives exactly one idempotent confirmation. For workshops, the date, time zone, and location are populated from the instance actually purchased—not typed into the default email.</div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
        <Card className="min-h-[620px]">
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">Select purchased content</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All content types</SelectItem>{Object.entries(LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => query.refetch()} aria-label="Refresh catalog"><RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="h-9 pl-9" placeholder="Search title" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            {query.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800"><p className="font-semibold">Content catalog could not load</p><p className="mt-1">{query.error.message}</p><Button variant="outline" size="sm" className="mt-2 border-rose-300 bg-white text-rose-800 hover:bg-rose-100" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Try again</Button></div>}
            {unavailableSources.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Some content is temporarily unavailable in this list:</strong> {unavailableSources.join(", ")}. All other purchase-email templates remain available to review.</div>}
            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {query.isLoading ? <p className="p-4 text-sm text-slate-500">Loading content…</p> : items.map((item) => {
                const key = `${item.source}:${item.contentType}:${item.id}`;
                const isSelected = key === selectedKey;
                const override = item.previewOnly ? null : overrideByKey.get(`${item.contentType}:${item.id}`);
                return <button key={key} onClick={() => select(item)} className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold text-slate-800">{item.title}</p>{item.previewOnly ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">System preview</Badge> : override ? <Badge className={override.enabled ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"}>{override.enabled ? "Customized" : "Disabled"}</Badge> : <Badge variant="outline" className="text-slate-500">Default</Badge>}</div>
                  <p className="mt-1 text-xs text-slate-500">{LABELS[item.contentType]}{item.subtitle ? ` · ${item.subtitle}` : ""}</p>
                </button>;
              })}
              {!query.isLoading && !query.error && items.length === 0 && <p className="p-4 text-sm text-slate-500">No matching content. Clear the search or choose another content type.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[620px]">
          {!selected ? <CardContent className="flex min-h-[620px] flex-col items-center justify-center p-8 text-center"><div className="rounded-2xl bg-teal-50 p-4 text-teal-600"><Sparkles className="h-7 w-7" /></div><h3 className="mt-4 font-semibold text-slate-800">Choose an item to customize</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Its standard confirmation remains active until you save an override.</p></CardContent> : <>
            <CardHeader className="border-b pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{selected.title}</CardTitle><p className="mt-1 text-xs text-slate-500">{LABELS[selected.contentType]}{selected.subtitle ? ` · ${selected.subtitle}` : ""}</p></div><Badge variant="outline">{selected.status}</Badge></div></CardHeader>
            <CardContent className="space-y-5 p-5">
              {selected.source === "workshop" && <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4">
                <Label htmlFor="workshop-email-preview-instance" className="font-semibold text-slate-800">Workshop instance for preview</Label>
                <p className="mb-2 mt-1 text-xs leading-5 text-slate-600">Choose the scheduled instance whose confirmation you want to review. The preview uses that instance’s current date, time zone, and location; it does not send an email.</p>
                <Select value={selectedWorkshopInstanceId} onValueChange={setSelectedWorkshopInstanceId}>
                  <SelectTrigger id="workshop-email-preview-instance" className="bg-white"><SelectValue placeholder="Select a scheduled workshop instance" /></SelectTrigger>
                  <SelectContent>
                    {workshopInstances.map((instance) => <SelectItem key={instance.id} value={String(instance.id)}>{instance.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                {workshopInstances.length === 0 && <p className="mt-2 text-xs text-amber-800">No scheduled instances are available for this workshop yet. Add one in Workshops Admin, then refresh this list.</p>}
              </div>}
              {selected.previewOnly ? <div className="space-y-4"><div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950"><p className="font-semibold">System-generated template</p><p className="mt-1">This is an automatic system-level purchase message rather than an individual content record. It is shown here for review only. No email is sent from this page.</p></div><Button variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50" onClick={openPreview}><ExternalLink className="mr-2 h-4 w-4" />Preview current email</Button><p className="flex gap-2 text-xs leading-5 text-slate-500"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />The preview contains a sample recipient and illustrative links—never a live access token or password-reset token.</p></div> : <>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4"><div><Label htmlFor="purchase-email-override-enabled" className="font-semibold text-slate-800">Use tailored purchase email copy</Label><p className="mt-1 text-xs leading-5 text-slate-600">Switch off to keep this saved draft but use the platform-generated email.</p></div><Switch id="purchase-email-override-enabled" checked={enabled} onCheckedChange={setEnabled} /></div>
              <div className="grid gap-4 md:grid-cols-2"><div><Label>Subject line</Label><Input className="mt-1" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={500} /></div><div><Label>Heading</Label><Input className="mt-1" value={heading} onChange={(event) => setHeading(event.target.value)} maxLength={500} /></div></div>
              <div><Label>Opening message</Label><textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-teal-500" value={intro} onChange={(event) => setIntro(event.target.value)} maxLength={5000} /></div>
              <div><Label>Additional details <span className="font-normal text-slate-400">(optional)</span></Label><p className="mb-2 mt-1 text-xs leading-5 text-slate-500">Use for logistics, preparation instructions, or a help contact. Workshop dates, times, time zone, and location are automatically inserted from the active instance, so leave dated details out of this field.</p><RichTextEditor value={detailsHtml} onChange={setDetailsHtml} minHeight={160} /></div>
              <div className="flex flex-col-reverse justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center"><div className="flex flex-wrap gap-2">{selectedOverride && <Button variant="ghost" className="text-slate-600 hover:text-slate-900" disabled={revert.isPending} onClick={() => revert.mutate({ contentType: selected.contentType as any, contentId: selected.id })}>Revert to generated default</Button>}<Button variant="outline" className="border-teal-200 text-teal-800 hover:bg-teal-50" onClick={openPreview}><ExternalLink className="mr-2 h-4 w-4" />Preview current email</Button></div><Button className="bg-teal-600 text-white hover:bg-teal-700" disabled={save.isPending} onClick={saveCopy}>{save.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save copy</Button></div>
              <p className="flex gap-2 text-xs leading-5 text-slate-500"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />Preview reads the saved, live system configuration and never sends email. Save copy first, then preview it. The delivery system always provides the purchased learner’s access link for future completed purchases.</p>
              </>}
            </CardContent>
          </>}
        </Card>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="border-b bg-teal-50/60 px-6 py-5">
            <DialogTitle>Current automatic purchase email</DialogTitle>
            <DialogDescription>
              {preview.data ? `${preview.data.contentType}: ${preview.data.contentTitle}` : "Rendering the saved current email…"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            {preview.isLoading && <div className="flex min-h-72 items-center justify-center text-sm text-slate-500"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Rendering current email…</div>}
            {preview.error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{preview.error.message}</div>}
            {preview.data && <>
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="font-semibold text-slate-700">To:</span> {preview.data.sampleRecipient.name} &lt;{preview.data.sampleRecipient.email}&gt;</div><div><span className="font-semibold text-slate-700">Subject:</span> {preview.data.subject}</div></div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-inner"><iframe title={`Purchase email preview: ${preview.data.contentTitle}`} srcDoc={preview.data.htmlBody} sandbox="" className="h-[620px] w-full rounded-md border-0 bg-white" /></div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Safe preview:</strong> {preview.data.accessLinkNotice}</p>
            </>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
