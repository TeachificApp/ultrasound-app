import { type FormEvent, useEffect, useState } from "react";
import { CalendarDays, FilePlus2, Film, Loader2, MessageSquare, RefreshCw, Save, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ExpoPointsAdminPanel } from "@/components/admin/ExpoPointsAdminPanel";
import { formatInTimeZone, formatScheduledInput, isValidInstant, parseScheduledTimestamp, PLATFORM_TIMEZONE } from "@shared/platformTime";
import {
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS,
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPE_LABELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPES,
} from "@shared/ultrasoundExpoEvent";

export type ExpoEventInstanceSection = "agenda" | "pages" | "attendees" | "recordings" | "community" | "points";

type PanelProps = { eventId: number; section?: ExpoEventInstanceSection };
type Workspace = NonNullable<ReturnType<typeof trpc.ultrasoundExpoEvent.adminEventWorkspace.useQuery>["data"]>;
type AgendaItem = Workspace["agenda"][number];
type RecordingItem = Workspace["recordings"][number];
type AgendaForm = {
  id?: number;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  speakerNames: string;
  category: string;
  status: "draft" | "published" | "cancelled";
  sortOrder: string;
};
type PageForm = {
  title: string;
  slug: string;
  pageType: (typeof ULTRASOUND_EXPO_EVENT_PAGE_TYPES)[number];
  accessLevel: (typeof ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS)[number];
  status: "draft" | "published" | "archived";
  seoTitle: string;
  seoDescription: string;
};
type RecordingForm = {
  id?: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: string;
  status: "draft" | "published" | "archived";
  sortOrder: string;
};

const localInput = (value: Date | string | null | undefined, timezone: string) => isValidInstant(value) ? formatScheduledInput(value, timezone) : "";
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const emptyAgenda = (): AgendaForm => ({ title: "", description: "", startsAt: "", endsAt: "", locationLabel: "", speakerNames: "", category: "", status: "draft", sortOrder: "0" });
const emptyPage = (): PageForm => ({ title: "", slug: "", pageType: "custom", accessLevel: "public", status: "draft", seoTitle: "", seoDescription: "" });
const emptyRecording = (): RecordingForm => ({ title: "", description: "", videoUrl: "", thumbnailUrl: "", durationSeconds: "", status: "draft", sortOrder: "0" });

const sectionDescriptions: Record<ExpoEventInstanceSection, string> = {
  agenda: "Manage this event’s agenda and calendar without changing another event’s schedule.",
  pages: "Create public and gated event pages, then edit their existing content in the visual editor.",
  attendees: "Review registrations associated with this event instance.",
  recordings: "Manage this event’s post-event recording library and access purchase counts.",
  community: "Open the event’s community and review its exhibitor, sponsor, and organization directory.",
  points: "Manage ExpoPoints for this event instance.",
};

export function ExpoEventInstancePanel({ eventId, section }: PanelProps) {
  // Remount all transient forms and mutation state when the selected event changes,
  // including for callers that do not key this panel themselves.
  // Points has its own queries; do not fetch the unrelated community workspace for it.
  if (section === "points") return <ExpoPointsAdminPanel key={eventId} eventId={eventId} />;
  return <EventInstanceWorkspace key={eventId} eventId={eventId} section={section} />;
}

function EventInstanceWorkspace({ eventId, section }: PanelProps) {
  const utils = trpc.useUtils();
  const workspace = trpc.ultrasoundExpoEvent.adminEventWorkspace.useQuery({ eventId });
  const [agenda, setAgenda] = useState<AgendaForm>(emptyAgenda);
  const [page, setPage] = useState<PageForm>(emptyPage);
  const [recording, setRecording] = useState<RecordingForm>(emptyRecording);
  const timezone = workspace.data?.event.timezone || PLATFORM_TIMEZONE;
  const show = (target: ExpoEventInstanceSection) => !section || section === target;
  const agendaDefaults = (): AgendaForm => ({
    ...emptyAgenda(),
    startsAt: localInput(workspace.data?.event.startsAt, timezone),
    endsAt: localInput(workspace.data?.event.endsAt, timezone),
    locationLabel: workspace.data?.event.locationLabel || "",
  });

  useEffect(() => {
    const event = workspace.data?.event;
    if (!event) return;
    setAgenda(current => current.startsAt ? current : {
      ...current,
      startsAt: localInput(event.startsAt, timezone),
      endsAt: localInput(event.endsAt, timezone),
      locationLabel: event.locationLabel || "",
    });
  }, [workspace.data?.event?.id, timezone]);

  const refresh = async () => { await utils.ultrasoundExpoEvent.adminEventWorkspace.invalidate({ eventId }); };
  const saveAgenda = trpc.ultrasoundExpoEvent.adminSaveAgendaItem.useMutation({
    onSuccess: async () => {
      toast.success("Agenda item saved.");
      setAgenda(current => ({ ...current, id: undefined, title: "", description: "", speakerNames: "", category: "", status: "draft", sortOrder: String((workspace.data?.agenda.length ?? 0) + 1) }));
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const savePage = trpc.ultrasoundExpoEvent.adminSaveEventPage.useMutation({
    onSuccess: async () => {
      toast.success("Event page created. Build it in the visual editor.");
      setPage(emptyPage());
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const saveRecording = trpc.ultrasoundExpoEvent.adminSaveRecording.useMutation({
    onSuccess: async () => {
      toast.success("Recording saved.");
      setRecording(emptyRecording());
      await refresh();
    },
    onError: error => toast.error(error.message),
  });

  const submitAgenda = (event: FormEvent) => {
    event.preventDefault();
    if (saveAgenda.isPending) return;
    if (!agenda.startsAt) return toast.error("Choose when this activity starts.");
    const startsAt = parseScheduledTimestamp(agenda.startsAt, timezone, "start");
    const endsAt = agenda.endsAt ? parseScheduledTimestamp(agenda.endsAt, timezone, "end") : null;
    if (!isValidInstant(startsAt) || (endsAt && !isValidInstant(endsAt))) return toast.error("Choose valid activity dates.");
    if (endsAt && endsAt < startsAt) return toast.error("The activity end must be on or after its start.");
    saveAgenda.mutate({ eventId, ...agenda, startsAt, endsAt, sortOrder: Number(agenda.sortOrder) || 0 });
  };
  const submitPage = (event: FormEvent) => {
    event.preventDefault();
    if (savePage.isPending) return;
    const slug = slugify(page.slug || page.title);
    if (!slug) return toast.error("Add a page title or URL slug.");
    // This form only creates pages. Existing blocks are edited via the visual editor.
    savePage.mutate({ eventId, ...page, slug, blocksJson: "[]" });
  };
  const submitRecording = (event: FormEvent) => {
    event.preventDefault();
    if (saveRecording.isPending) return;
    saveRecording.mutate({ eventId, ...recording, videoUrl: recording.videoUrl || undefined, thumbnailUrl: recording.thumbnailUrl || undefined, durationSeconds: recording.durationSeconds ? Number(recording.durationSeconds) : null, sortOrder: Number(recording.sortOrder) || 0 });
  };
  const editAgenda = (item: AgendaItem) => {
    saveAgenda.reset();
    setAgenda({ id: item.id, title: item.title, description: item.description || "", startsAt: localInput(item.startsAt, timezone), endsAt: localInput(item.endsAt, timezone), locationLabel: item.locationLabel || "", speakerNames: item.speakerNames || "", category: item.category || "", status: item.status, sortOrder: String(item.sortOrder) });
  };
  const editRecording = (item: RecordingItem) => {
    saveRecording.reset();
    setRecording({ id: item.id, title: item.title, description: item.description || "", videoUrl: item.videoUrl || "", thumbnailUrl: item.thumbnailUrl || "", durationSeconds: item.durationSeconds == null ? "" : String(item.durationSeconds), status: item.status, sortOrder: String(item.sortOrder) });
  };

  if (workspace.isLoading) return <section className="mt-7 rounded-3xl border border-cyan-100 bg-white p-6 text-sm text-slate-500" role="status"><Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#087f8c]" />Loading event-instance workspace…</section>;
  if (!workspace.data) return <section className="mt-7 rounded-3xl border border-red-100 bg-red-50 p-6 text-sm text-red-700"><p role="alert">The event-instance workspace could not be loaded.</p><Button type="button" variant="outline" disabled={workspace.isFetching} onClick={() => void workspace.refetch()} className="mt-3">{workspace.isFetching ? "Retrying…" : "Try again"}</Button></section>;
  const { event, agenda: savedAgenda, pages, recordings, attendeeRegistrations, partnerRegistrations, recordingOrders, profiles, community } = workspace.data;

  return <section className="mt-7 rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">Event instance workspace</p><h2 className="mt-1 text-2xl font-black text-[#062634]">{event.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{section ? sectionDescriptions[section] : "Build and manage this event’s agenda, calendar, public and gated pages, paid recording library, attendee roster, exhibitor and sponsor roster, and private community separately from every other UltrasoundExpo™ event."}</p></div>
      <div className="flex flex-wrap gap-2">
        {show("community") && <Link href={`/community/${community.slug}`} className="inline-flex items-center rounded-lg border border-cyan-200 px-3 py-2 text-sm font-bold text-[#087f8c] hover:bg-cyan-50"><MessageSquare className="mr-2 h-4 w-4" />Event community</Link>}
        <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-[#0c9ba3] px-3 py-2 text-sm font-bold text-white hover:bg-[#0a858d]">View event hub</a>
        <Button type="button" variant="outline" disabled={workspace.isFetching} onClick={() => void workspace.refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${workspace.isFetching ? "animate-spin" : ""}`} />{workspace.isFetching ? "Refreshing…" : "Refresh"}</Button>
      </div>
    </div>
    {workspace.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">The latest workspace refresh failed. Previously loaded data is shown; try refreshing again.</p>}

    {!section && <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Count label="Attendees" value={attendeeRegistrations.length} detail="Event-specific registrations" /><Count label="Exhibitors & sponsors" value={partnerRegistrations.length} detail="Event-specific partner records" /><Count label="Partner profiles" value={profiles.length} detail="Organization pages created" /><Count label="Recording orders" value={recordingOrders.length} detail="Post-event access purchases" /></div>}

    {show("agenda") && <div className="mt-7 grid gap-7 xl:grid-cols-2" data-expo-section="agenda">
      <form onSubmit={submitAgenda} aria-label="Agenda item" className="rounded-2xl bg-[#f4fbfc] p-5"><fieldset disabled={saveAgenda.isPending}>
        <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#087f8c]" /><div><h3 className="font-black text-[#062634]">Agenda & calendar</h3><p className="text-xs text-slate-500">Published items appear in the event hub and download as an iCal schedule.</p></div></div>
        {agenda.id && <p className="mt-3 text-sm font-bold text-[#087f8c]">Editing agenda item #{agenda.id}</p>}
        <p className="mt-3 text-xs text-slate-500">Schedule times are entered and displayed in {timezone}.</p>
        <label className="mt-4 grid gap-1 text-sm font-bold">Activity title<input required value={agenda.title} onChange={e => setAgenda(current => ({ ...current, title: e.target.value }))} className="input" /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Starts<input required type="datetime-local" value={agenda.startsAt} onChange={e => setAgenda(current => ({ ...current, startsAt: e.target.value }))} className="input" /></label><label className="grid gap-1 text-sm font-bold">Ends<input type="datetime-local" value={agenda.endsAt} onChange={e => setAgenda(current => ({ ...current, endsAt: e.target.value }))} className="input" /></label></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Location<input value={agenda.locationLabel} onChange={e => setAgenda(current => ({ ...current, locationLabel: e.target.value }))} className="input" /></label><label className="grid gap-1 text-sm font-bold">Category<input value={agenda.category} onChange={e => setAgenda(current => ({ ...current, category: e.target.value }))} placeholder="Session, reception…" className="input" /></label></div>
        <label className="mt-3 grid gap-1 text-sm font-bold">Speakers<input value={agenda.speakerNames} onChange={e => setAgenda(current => ({ ...current, speakerNames: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Description<textarea rows={3} value={agenda.description} onChange={e => setAgenda(current => ({ ...current, description: e.target.value }))} className="input" /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Visibility<select value={agenda.status} onChange={e => setAgenda(current => ({ ...current, status: e.target.value as AgendaForm["status"] }))} className="input"><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label><label className="grid gap-1 text-sm font-bold">Order<input type="number" min="0" value={agenda.sortOrder} onChange={e => setAgenda(current => ({ ...current, sortOrder: e.target.value }))} className="input" /></label></div>
        <MutationError error={saveAgenda.error} />
        <div className="mt-4 flex flex-wrap gap-2"><Button disabled={saveAgenda.isPending} className="bg-[#0c9ba3] hover:bg-[#0a858d]"><Save className="mr-2 h-4 w-4" />{saveAgenda.isPending ? "Saving…" : agenda.id ? "Save agenda changes" : "Save agenda item"}</Button>{agenda.id && <Button type="button" variant="outline" onClick={() => { setAgenda(agendaDefaults()); saveAgenda.reset(); }}>Cancel edit</Button>}</div>
      </fieldset></form>
      <section className="rounded-2xl border border-slate-100 p-5"><h3 className="font-black text-[#062634]">Published schedule</h3><div className="mt-3 space-y-2">{savedAgenda.length ? savedAgenda.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="font-bold text-[#062634]">{item.title}</p><p className="mt-1 text-xs text-slate-500">{formatInTimeZone(item.startsAt, { dateStyle: "medium", timeStyle: "short" }, timezone)} · {item.status}</p><Button type="button" variant="outline" size="sm" className="mt-2" disabled={saveAgenda.isPending} onClick={() => editAgenda(item)} aria-label={`Edit agenda: ${item.title}`}>Edit agenda item</Button></div>) : <Empty text="No agenda items created yet." />}</div></section>
    </div>}

    {show("pages") && <div className="mt-7 grid gap-7 xl:grid-cols-2" data-expo-section="pages">
      <form onSubmit={submitPage} aria-label="Create event page" className="rounded-2xl bg-[#f4fbfc] p-5"><fieldset disabled={savePage.isPending}>
        <div className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-[#087f8c]" /><div><h3 className="font-black text-[#062634]">Event pages</h3><p className="text-xs text-slate-500">Create multiple landing, attendee, exhibitor, prospectus, schedule, and custom pages for this instance.</p></div></div>
        <label className="mt-4 grid gap-1 text-sm font-bold">Page title<input required value={page.title} onChange={e => setPage(current => ({ ...current, title: e.target.value, slug: current.slug || slugify(e.target.value) }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">URL slug<input required value={page.slug} onChange={e => setPage(current => ({ ...current, slug: slugify(e.target.value) }))} className="input" /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Page purpose<select value={page.pageType} onChange={e => setPage(current => ({ ...current, pageType: e.target.value as PageForm["pageType"] }))} className="input">{ULTRASOUND_EXPO_EVENT_PAGE_TYPES.map(type => <option key={type} value={type}>{ULTRASOUND_EXPO_EVENT_PAGE_TYPE_LABELS[type]}</option>)}</select></label><label className="grid gap-1 text-sm font-bold">Audience<select value={page.accessLevel} onChange={e => setPage(current => ({ ...current, accessLevel: e.target.value as PageForm["accessLevel"] }))} className="input">{ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS.map(level => <option key={level} value={level}>{ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS[level]}</option>)}</select></label></div>
        <label className="mt-3 grid gap-1 text-sm font-bold">Status<select value={page.status} onChange={e => setPage(current => ({ ...current, status: e.target.value as PageForm["status"] }))} className="input"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Search title <span className="font-normal text-slate-400">(optional)</span><input value={page.seoTitle} onChange={e => setPage(current => ({ ...current, seoTitle: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Search description <span className="font-normal text-slate-400">(optional)</span><textarea rows={2} value={page.seoDescription} onChange={e => setPage(current => ({ ...current, seoDescription: e.target.value }))} className="input" /></label>
        <MutationError error={savePage.error} />
        <Button disabled={savePage.isPending} className="mt-4 bg-[#0c9ba3] hover:bg-[#0a858d]"><FilePlus2 className="mr-2 h-4 w-4" />{savePage.isPending ? "Creating…" : "Create visual page"}</Button>
      </fieldset></form>
      <section className="rounded-2xl border border-slate-100 p-5"><h3 className="font-black text-[#062634]">Created event pages</h3><div className="mt-3 space-y-2">{pages.length ? pages.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-[#062634]">{item.title}</p><p className="text-xs text-slate-500">/{event.slug}/{item.slug} · {ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS[item.accessLevel]} · {item.status}</p></div><Link href={`/admin/ultrasound-expo/events/${event.id}/pages/${item.id}/edit`} className="rounded-lg border border-cyan-200 px-3 py-2 text-sm font-bold text-[#087f8c] hover:bg-white">Edit page</Link></div>) : <Empty text="No event pages created yet." />}</div></section>
    </div>}

    {show("attendees") && <section className="mt-7 rounded-2xl border border-slate-100 p-5" data-expo-section="attendees"><h3 className="font-black text-[#062634]">Attendee roster</h3>{section && <div className="mt-4"><Count label="Attendees" value={attendeeRegistrations.length} detail="Event-specific registrations" /></div>}<div className="mt-4"><Roster icon={UsersRound} title="Attendees" rows={attendeeRegistrations} empty="No attendee registrations for this event." /></div></section>}

    {show("recordings") && <div className="mt-7 grid gap-7 xl:grid-cols-[.9fr_1.1fr]" data-expo-section="recordings">
      <form onSubmit={submitRecording} aria-label="Recording" className="rounded-2xl bg-[#f4fbfc] p-5"><fieldset disabled={saveRecording.isPending}>
        <div className="flex items-center gap-2"><Film className="h-5 w-5 text-[#087f8c]" /><div><h3 className="font-black text-[#062634]">Post-event recordings</h3><p className="text-xs text-slate-500">Publish recordings separately, then add a Product option in this event’s commerce configuration for paid access.</p></div></div>
        {recording.id && <p className="mt-3 text-sm font-bold text-[#087f8c]">Editing recording #{recording.id}</p>}
        <label className="mt-4 grid gap-1 text-sm font-bold">Recording title<input required value={recording.title} onChange={e => setRecording(current => ({ ...current, title: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Video URL <span className="font-normal text-slate-400">(optional while drafting)</span><input type="url" value={recording.videoUrl} onChange={e => setRecording(current => ({ ...current, videoUrl: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Thumbnail URL <span className="font-normal text-slate-400">(optional)</span><input type="url" value={recording.thumbnailUrl} onChange={e => setRecording(current => ({ ...current, thumbnailUrl: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Description<textarea rows={3} value={recording.description} onChange={e => setRecording(current => ({ ...current, description: e.target.value }))} className="input" /></label>
        <label className="mt-3 grid gap-1 text-sm font-bold">Duration (seconds) <span className="font-normal text-slate-400">(optional)</span><input type="number" min="1" max="172800" step="1" value={recording.durationSeconds} onChange={e => setRecording(current => ({ ...current, durationSeconds: e.target.value }))} className="input" /></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Status<select value={recording.status} onChange={e => setRecording(current => ({ ...current, status: e.target.value as RecordingForm["status"] }))} className="input"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label className="grid gap-1 text-sm font-bold">Display order<input type="number" min="0" value={recording.sortOrder} onChange={e => setRecording(current => ({ ...current, sortOrder: e.target.value }))} className="input" /></label></div>
        <MutationError error={saveRecording.error} />
        <div className="mt-4 flex flex-wrap gap-2"><Button disabled={saveRecording.isPending} className="bg-[#0c9ba3] hover:bg-[#0a858d]"><Save className="mr-2 h-4 w-4" />{saveRecording.isPending ? "Saving…" : recording.id ? "Save recording changes" : "Save recording"}</Button>{recording.id && <Button type="button" variant="outline" onClick={() => { setRecording(emptyRecording()); saveRecording.reset(); }}>Cancel edit</Button>}</div>
      </fieldset></form>
      <section className="rounded-2xl border border-slate-100 p-5"><h3 className="font-black text-[#062634]">Recording library</h3>{section && <div className="mt-4"><Count label="Recording orders" value={recordingOrders.length} detail="Post-event access purchases" /></div>}<div className="mt-3 space-y-2">{recordings.length ? recordings.map(item => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-bold text-[#062634]">{item.title}</span><span className="ml-2 text-xs text-slate-500">{item.status}</span><div className="mt-2"><Button type="button" variant="outline" size="sm" disabled={saveRecording.isPending} onClick={() => editRecording(item)} aria-label={`Edit recording: ${item.title}`}>Edit recording</Button></div></div>) : <Empty text="No recordings saved for this event." />}</div></section>
    </div>}

    {show("community") && <section className="mt-7 rounded-2xl border border-slate-100 p-5" data-expo-section="community"><h3 className="font-black text-[#062634]">Event people & partner directory</h3>{section && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Count label="Exhibitors & sponsors" value={partnerRegistrations.length} detail="Event-specific partner records" /><Count label="Partner profiles" value={profiles.length} detail="Organization pages created" /></div>}<div className="mt-4"><Roster icon={UsersRound} title="Exhibitors & sponsors" rows={partnerRegistrations} empty="No paid exhibitor or sponsor selections for this event." /></div><div className="mt-5"><h4 className="font-bold text-[#062634]">Organization pages</h4><div className="mt-2 space-y-2">{profiles.length ? profiles.map(profile => <div key={profile.id} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-bold text-[#062634]">{profile.displayName}</span><span className="ml-2 text-xs text-slate-500">{profile.isPublished ? "Published" : "Draft"}</span></div>) : <Empty text="Partners can create their organization pages after an event-specific paid selection." />}</div></div></section>}
    {!section && <ExpoPointsAdminPanel eventId={eventId} />}
  </section>;
}

function Count({ label, value, detail }: { label: string; value: number; detail: string }) { return <div className="rounded-xl bg-[#f4fbfc] p-4"><p className="text-2xl font-black text-[#062634]">{value}</p><p className="mt-1 text-sm font-bold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">{text}</p>; }
function MutationError({ error }: { error: { message: string } | null }) { return error ? <p role="alert" className="mt-3 text-sm text-red-700">{error.message}</p> : null; }
function Roster({ icon: Icon, title, rows, empty }: { icon: typeof UsersRound; title: string; rows: Workspace["attendeeRegistrations"]; empty: string }) { return <div><h4 className="flex items-center gap-2 font-bold text-[#062634]"><Icon className="h-4 w-4 text-[#087f8c]" />{title}</h4><div className="mt-2 max-h-52 space-y-2 overflow-auto">{rows.length ? rows.map(row => <div key={row.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-bold text-[#062634]">{row.attendeeName}</p><p className="text-xs text-slate-500">{row.organizationName || row.attendeeEmail} · {row.packageName}</p></div>) : <p className="text-xs text-slate-500">{empty}</p>}</div></div>; }
