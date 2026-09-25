import { useMemo, useState } from "react";
import { Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SourceType = "cohort_group" | "workshop_instance";
type TargetType = "course" | "download" | "webinar" | "workshop_instance";

const TARGET_LABELS: Record<TargetType, string> = {
  course: "Course or quiz",
  download: "Download",
  webinar: "Webinar",
  workshop_instance: "Workshop instance",
};

export function ScheduledContentLinksPanel({ sourceType, sourceId }: { sourceType: SourceType; sourceId: number }) {
  const utils = trpc.useUtils();
  const [targetType, setTargetType] = useState<TargetType>("course");
  const [targetId, setTargetId] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("");
  const { data: links = [], isLoading } = trpc.scheduledContentAdmin.list.useQuery({ sourceType, sourceId });
  const { data: catalog } = trpc.scheduledContentAdmin.catalog.useQuery();
  const invalidate = () => utils.scheduledContentAdmin.list.invalidate({ sourceType, sourceId });
  const create = trpc.scheduledContentAdmin.create.useMutation({
    onSuccess: (result) => {
      setTargetId("");
      setDurationDays("");
      invalidate();
      toast.success(result.grantedToExistingParticipants > 0
        ? `Linked item added and granted to ${result.grantedToExistingParticipants} existing participant(s).`
        : "Linked item added. Future participants will receive access on enrollment.");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.scheduledContentAdmin.remove.useMutation({
    onSuccess: () => { invalidate(); toast.success("Link removed. Existing grants remain unchanged."); },
    onError: (error) => toast.error(error.message),
  });

  const options = useMemo(() => {
    if (!catalog) return [] as Array<{ id: number; label: string }>;
    if (targetType === "course") return catalog.courses.map((item) => ({ id: item.id, label: `${item.title} · ${item.type}` }));
    if (targetType === "download") return catalog.downloads.map((item) => ({ id: item.id, label: item.title }));
    if (targetType === "webinar") return catalog.webinars.map((item) => ({ id: item.id, label: item.title }));
    return catalog.workshopInstances.map((item) => ({
      id: item.id,
      label: `${item.workshopTitle} — ${item.title}${item.startDate ? ` (${new Date(item.startDate).toLocaleDateString()})` : ""}`,
    }));
  }, [catalog, targetType]);

  const labelByTarget = useMemo(() => {
    if (!catalog) return new Map<string, string>();
    const entries: Array<[string, string]> = [
      ...catalog.courses.map((item) => [`course:${item.id}`, `${item.title} · ${item.type}`] as [string, string]),
      ...catalog.downloads.map((item) => [`download:${item.id}`, item.title] as [string, string]),
      ...catalog.webinars.map((item) => [`webinar:${item.id}`, item.title] as [string, string]),
      ...catalog.workshopInstances.map((item) => [`workshop_instance:${item.id}`, `${item.workshopTitle} — ${item.title}`] as [string, string]),
    ];
    return new Map(entries);
  }, [catalog]);

  const addLink = () => {
    const parsedTargetId = Number(targetId);
    const parsedDuration = durationDays.trim() ? Number(durationDays) : null;
    if (!Number.isInteger(parsedTargetId) || parsedTargetId < 1) {
      toast.error("Choose the content participants should receive.");
      return;
    }
    if (parsedDuration !== null && (!Number.isInteger(parsedDuration) || parsedDuration < 1)) {
      toast.error("Access duration must be a whole number of days.");
      return;
    }
    create.mutate({ sourceType, sourceId, targetType, targetId: parsedTargetId, accessDurationDays: parsedDuration });
  };

  return (
    <section className="mt-4 border-t border-teal-100 pt-4" aria-label="Linked participant access">
      <div className="flex items-start gap-2">
        <div className="rounded-md bg-teal-50 p-1.5 text-teal-700"><Link2 className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-800">Included content & access</h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Link courses, downloads, webinars, or another workshop run. New and existing participants receive only the linked access; removing a link never revokes a prior grant.</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.7fr)_110px_auto] md:items-end">
        <div>
          <Label className="text-xs">Content type</Label>
          <Select value={targetType} onValueChange={(value) => { setTargetType(value as TargetType); setTargetId(""); }}>
            <SelectTrigger className="mt-1 h-9 bg-white text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TARGET_LABELS) as TargetType[]).map((type) => <SelectItem key={type} value={type}>{TARGET_LABELS[type]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Included item</Label>
          <Select value={targetId || undefined} onValueChange={setTargetId} disabled={!catalog || options.length === 0}>
            <SelectTrigger className="mt-1 h-9 bg-white text-xs"><SelectValue placeholder={options.length ? "Select content" : "No eligible items"} /></SelectTrigger>
            <SelectContent>
              {options.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Access days</Label>
          <Input className="mt-1 h-9 bg-white text-xs" inputMode="numeric" min={1} placeholder="Lifetime" value={durationDays} onChange={(event) => setDurationDays(event.target.value)} />
        </div>
        <Button size="sm" className="h-9 bg-teal-600 text-xs hover:bg-teal-700" onClick={addLink} disabled={create.isPending || !catalog}>
          {create.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />} Link
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? <p className="text-xs text-slate-400">Loading linked items…</p> : links.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">No additional content is linked to this scheduled run.</p>
        ) : links.map((link) => (
          <div key={link.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">{labelByTarget.get(`${link.targetType}:${link.targetId}`) ?? `${TARGET_LABELS[link.targetType as TargetType]} #${link.targetId}`}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{TARGET_LABELS[link.targetType as TargetType]} · {link.accessDurationDays ? `${link.accessDurationDays} day access` : "Use normal/lifetime access"}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove link" onClick={() => remove.mutate({ id: link.id })} disabled={remove.isPending}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
