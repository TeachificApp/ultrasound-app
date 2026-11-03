import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "wouter";
import {
  CalendarPlus,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VendorPartnerAdminPanel } from "@/components/admin/VendorPartnerAdminPanel";
import { ExpoPartnerOperationsPanel } from "@/components/admin/ExpoPartnerOperationsPanel";
import { ExpoEventInstancePanel } from "@/components/admin/ExpoEventInstancePanel";
import { ExpoAudienceManagementPanel } from "@/components/admin/ExpoAudienceManagementPanel";
import {
  EXPO_PACKAGE_TYPE_META,
  formatExpoMoney,
  type ExpoPackageType,
  ULTRASOUND_EXPO_HERO_IMAGE,
} from "@shared/ultrasoundExpo";
import { type ExpoEventTenant } from "@shared/expoTenant";
import {
  formatScheduledInput,
  parseScheduledTimestamp,
} from "@shared/platformTime";

const TYPES: ExpoPackageType[] = [
  "registrant",
  "exhibitor",
  "sponsor",
  "product",
  "other",
];
const LABELS: Record<ExpoEventTenant, string> = {
  ultrasound_expo: "UltrasoundExpo™",
  echo_expo: "EchoExpo™",
};
const ECHO_HERO = "/manus-storage/echoexpo-hero-approved_2a95e8a5.png";
const asTenant = (value: string): ExpoEventTenant =>
  value === "echo_expo" ? "echo_expo" : "ultrasound_expo";
const FORM_FIELDS =
  "[&_.input]:w-full [&_.input]:min-w-0 [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-slate-200 [&_.input]:bg-white [&_.input]:px-3 [&_.input]:py-2.5 [&_.input]:font-normal [&_.input]:text-slate-800 [&_.input]:outline-none [&_.input:focus]:border-[#087f8c] [&_.input:focus]:ring-2 [&_.input:focus]:ring-cyan-100";
const MANAGEMENT_TABS = [
  ["settings", "Event settings"],
  ["attendees", "Event attendees"],
  ["vendors", "Event vendors"],
  ["exhibitors", "Event exhibitors"],
  ["sponsors", "Event sponsors"],
  ["map", "Event map"],
  ["prospectus", "Exhibitor prospectus"],
  ["commerce", "Pricing & registration"],
  ["agenda", "Agenda & calendar"],
  ["pages", "Event pages"],
  ["resources", "Partner resources"],
  ["recordings", "Recordings"],
  ["community", "Community"],
  ["points", "ExpoPoints"],
  ["reporting", "Payments & reports"],
  ["applications", "Partner approvals"],
  ["audiences", "All-event audiences"],
  ["websites", "Website pages"],
] as const;
type ManagementTab = (typeof MANAGEMENT_TABS)[number][0];
const GLOBAL_TABS = new Set<ManagementTab>([
  "applications",
  "audiences",
  "websites",
]);
const isoForInput = (
  value: Date | string | null | undefined,
  timezone: string
) => (value ? formatScheduledInput(value, timezone) : "");
const dateFromInput = (value: string, timezone: string) =>
  parseScheduledTimestamp(value, timezone);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const eventDate = (
  value: Date | string | null | undefined,
  timezone: string
) => {
  if (!value) return "Date not set";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Check event date";
  }
};
const blankEvent = (tenant: ExpoEventTenant = "ultrasound_expo") => ({
  tenant,
  name: LABELS[tenant],
  slug: tenant === "echo_expo" ? "echoexpo" : "ultrasoundexpo",
  startsAt: "",
  endsAt: "",
  timezone: "America/New_York",
  locationLabel: "",
  description: "",
  heroImageUrl: tenant === "echo_expo" ? ECHO_HERO : ULTRASOUND_EXPO_HERO_IMAGE,
  registrationTerms: "",
  attendeeInstructions: "",
  partnerInstructions: "",
  status: "draft" as "draft" | "published" | "archived",
});
const blankPackage = () => ({
  id: undefined as number | undefined,
  packageType: "registrant" as ExpoPackageType,
  name: "",
  description: "",
  benefits: "",
  amount: "",
  currency: "usd",
  sortOrder: "0",
  isActive: true,
  combinedWithPackageId: "",
});

export default function UltrasoundExpoAdmin() {
  const utils = trpc.useUtils();
  const snapshot = trpc.ultrasoundExpo.adminSnapshot.useQuery();
  const [eventId, setEventId] = useState<number | "new" | null>(null);
  const [category, setCategory] = useState<ExpoEventTenant | "all">("all");
  const [archiveView, setArchiveView] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ManagementTab>("settings");
  const [visitedTabs, setVisitedTabs] = useState<Set<ManagementTab>>(
    () => new Set(["settings"])
  );
  const [eventForm, setEventForm] = useState(blankEvent());
  const [eventDirty, setEventDirty] = useState(false);
  const [packageForm, setPackageForm] = useState(blankPackage());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [duplicate, setDuplicate] = useState<{
    sourceEventId: number;
    name: string;
    slug: string;
    tenant: ExpoEventTenant;
    timezone: string;
    startsAt: string;
    endsAt: string;
  } | null>(null);

  const visibleEvents = useMemo(
    () =>
      (snapshot.data?.events ?? []).filter(
        event =>
          (archiveView
            ? event.status === "archived"
            : event.status !== "archived") &&
          (category === "all" || event.tenant === category) &&
          (!search.trim() ||
            `${event.name} ${event.slug} ${event.locationLabel ?? ""}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()))
      ),
    [snapshot.data?.events, archiveView, category, search]
  );
  // A deliberate new-event state never falls back to the first saved event.
  const activeEvent =
    eventId === "new"
      ? null
      : (visibleEvents.find(event => event.id === eventId) ??
        visibleEvents[0] ??
        null);
  const eventPackages = useMemo(
    () =>
      (snapshot.data?.packages ?? []).filter(
        item => item.eventId === activeEvent?.id
      ),
    [snapshot.data?.packages, activeEvent?.id]
  );
  const eventRegistrations = useMemo(
    () =>
      (snapshot.data?.registrations ?? []).filter(
        item => item.eventId === activeEvent?.id
      ),
    [snapshot.data?.registrations, activeEvent?.id]
  );
  const companionPackageCandidates = useMemo(
    () =>
      (snapshot.data?.packages ?? []).filter(item => {
        const candidateEvent = snapshot.data?.events.find(
          event => event.id === item.eventId
        );
        return (
          activeEvent &&
          candidateEvent &&
          item.eventId !== activeEvent.id &&
          candidateEvent.tenant !== activeEvent.tenant &&
          candidateEvent.status !== "archived" &&
          item.packageType === packageForm.packageType &&
          item.currency.toLowerCase() === packageForm.currency.toLowerCase()
        );
      }),
    [
      snapshot.data?.packages,
      snapshot.data?.events,
      activeEvent?.id,
      activeEvent?.tenant,
      packageForm.packageType,
      packageForm.currency,
    ]
  );

  useEffect(() => {
    if (activeEvent && eventId !== activeEvent.id) setEventId(activeEvent.id);
  }, [activeEvent?.id, eventId]);
  useEffect(() => {
    if (activeEvent) {
      setEventForm({
        tenant: asTenant(activeEvent.tenant),
        name: activeEvent.name,
        slug: activeEvent.slug,
        startsAt: isoForInput(activeEvent.startsAt, activeEvent.timezone),
        endsAt: isoForInput(activeEvent.endsAt, activeEvent.timezone),
        timezone: activeEvent.timezone,
        locationLabel: activeEvent.locationLabel ?? "",
        description: activeEvent.description ?? "",
        heroImageUrl:
          activeEvent.heroImageUrl ??
          (activeEvent.tenant === "echo_expo"
            ? ECHO_HERO
            : ULTRASOUND_EXPO_HERO_IMAGE),
        registrationTerms: activeEvent.registrationTerms ?? "",
        attendeeInstructions: activeEvent.attendeeInstructions ?? "",
        partnerInstructions: activeEvent.partnerInstructions ?? "",
        status: activeEvent.status,
      });
    } else if (eventId !== "new") {
      setEventForm(
        blankEvent(category === "echo_expo" ? "echo_expo" : "ultrasound_expo")
      );
    }
    setEventDirty(false);
    setPackageForm(blankPackage());
    // Selection changes reset instance-specific editors, never catalog records.
    setVisitedTabs(new Set(["settings", tab]));
  }, [activeEvent?.id, eventId === "new"]);

  const invalidate = async () => {
    await Promise.all([
      utils.ultrasoundExpo.adminSnapshot.invalidate(),
      utils.ultrasoundExpoEvent.adminEventWorkspace.invalidate(),
      utils.vendorPortal.adminExpoOperations.invalidate(),
    ]);
  };
  const createEvent = trpc.ultrasoundExpo.createEvent.useMutation({
    onSuccess: async (result, input) => {
      toast.success(
        `${LABELS[input.tenant ?? "ultrasound_expo"]} event created.`
      );
      setCategory(input.tenant ?? "ultrasound_expo");
      setArchiveView(input.status === "archived");
      setSearch("");
      setEventDirty(false);
      await invalidate();
      setEventId(result.id);
    },
    onError: error => toast.error(error.message),
  });
  const updateEvent = trpc.ultrasoundExpo.updateEvent.useMutation({
    onSuccess: async (_result, input) => {
      toast.success("Event settings saved.");
      setEventDirty(false);
      await invalidate();
      if (input.tenant) setCategory(input.tenant);
      setArchiveView(input.status === "archived");
      setEventId(input.id);
    },
    onError: error => toast.error(error.message),
  });
  const duplicateEvent = trpc.ultrasoundExpo.duplicateEvent.useMutation({
    onSuccess: async (result, input) => {
      toast.success(
        `Event duplicated with ${result.copiedPackages} inactive package${result.copiedPackages === 1 ? "" : "s"}.`
      );
      setDuplicate(null);
      setCategory(input.tenant ?? "all");
      setArchiveView(false);
      setSearch("");
      setTab("settings");
      setEventDirty(false);
      await invalidate();
      setEventId(result.id);
    },
    onError: error => toast.error(error.message),
  });
  const deleteEvent = trpc.ultrasoundExpo.deleteEvent.useMutation({
    onSuccess: async () => {
      toast.success(
        "Event removed from active events. You can restore it from Archived events."
      );
      setDeleteTarget(null);
      setConfirmDeleteName("");
      setEventDirty(false);
      setEventId(null);
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const restoreEvent = trpc.ultrasoundExpo.restoreEvent.useMutation({
    onSuccess: async (_result, input) => {
      toast.success("Event restored as a private draft.");
      await invalidate();
      setArchiveView(false);
      setEventId(input.id);
      setEventForm(current => ({ ...current, status: "draft" }));
    },
    onError: error => toast.error(error.message),
  });
  const savePackage = trpc.ultrasoundExpo.savePackage.useMutation({
    onSuccess: async () => {
      toast.success("Registration option saved.");
      await invalidate();
      resetPackage();
    },
    onError: error => toast.error(error.message),
  });
  const resetPackage = () =>
    setPackageForm({
      ...blankPackage(),
      sortOrder: String(eventPackages.length),
    });
  const setForm = (values: Partial<typeof eventForm>) => {
    setEventForm(current => ({ ...current, ...values }));
    setEventDirty(true);
  };
  const canLeaveSettings = () =>
    !eventDirty ||
    window.confirm(
      "You have unsaved event settings. Leave without saving those changes?"
    );
  const selectEvent = (id: number) => {
    if (id === activeEvent?.id || !canLeaveSettings()) return;
    setEventId(id);
    setEventDirty(false);
    setPackageForm(blankPackage());
  };
  const chooseCategory = (value: ExpoEventTenant | "all") => {
    if (!canLeaveSettings()) return;
    setCategory(value);
    setEventId(null);
    setEventDirty(false);
    setSearch("");
  };
  const chooseArchiveView = (value: boolean) => {
    if (!canLeaveSettings()) return;
    setArchiveView(value);
    setEventId(null);
    setEventDirty(false);
  };
  const chooseTab = (value: string) => {
    setTab(value as ManagementTab);
    setVisitedTabs(current => new Set([...current, value as ManagementTab]));
  };

  const saveEvent = (event: FormEvent) => {
    event.preventDefault();
    try {
      const { tenant, ...eventDetails } = eventForm;
      const startsAt = dateFromInput(
        eventDetails.startsAt,
        eventDetails.timezone
      );
      const endsAt = eventDetails.endsAt
        ? dateFromInput(eventDetails.endsAt, eventDetails.timezone)
        : null;
      if (endsAt && endsAt < startsAt)
        return toast.error("The event end must be on or after its start.");
      const payload = { ...eventDetails, startsAt, endsAt };
      if (activeEvent)
        updateEvent.mutate({ id: activeEvent.id, ...payload, tenant });
      else createEvent.mutate({ ...payload, tenant });
    } catch {
      toast.error(
        "Enter valid event dates and a recognized event time zone, such as America/New_York."
      );
    }
  };
  const copyEvent = () => {
    if (!activeEvent) return;
    const starts = isoForInput(activeEvent.startsAt, activeEvent.timezone);
    const ends = isoForInput(activeEvent.endsAt, activeEvent.timezone);
    const nextYear = Number(starts.slice(0, 4)) + 1;
    setDuplicate({
      sourceEventId: activeEvent.id,
      tenant: asTenant(activeEvent.tenant),
      timezone: activeEvent.timezone,
      name: /\b20\d{2}\b/.test(activeEvent.name)
        ? activeEvent.name.replace(/\b20\d{2}\b/, String(nextYear))
        : `${activeEvent.name} ${nextYear}`,
      slug: `${activeEvent.slug.replace(/-20\d{2}$/, "")}-${nextYear}`,
      startsAt: `${nextYear}${starts.slice(4)}`,
      endsAt: ends ? `${nextYear}${ends.slice(4)}` : "",
    });
  };
  const submitDuplicate = (event: FormEvent) => {
    event.preventDefault();
    if (!duplicate) return;
    try {
      const startsAt = dateFromInput(duplicate.startsAt, duplicate.timezone);
      const endsAt = duplicate.endsAt
        ? dateFromInput(duplicate.endsAt, duplicate.timezone)
        : null;
      if (endsAt && endsAt < startsAt)
        return toast.error(
          "The duplicate's end must be on or after its start."
        );
      duplicateEvent.mutate({
        ...duplicate,
        startsAt,
        endsAt,
        status: "draft",
      });
    } catch {
      toast.error("Check the duplicate's dates and time zone.");
    }
  };
  const saveOption = (event: FormEvent) => {
    event.preventDefault();
    if (!activeEvent) return;
    const amountCents = Math.round(Number(packageForm.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 50)
      return toast.error("Enter a package price of at least $0.50.");
    savePackage.mutate({
      id: packageForm.id,
      eventId: activeEvent.id,
      packageType: packageForm.packageType,
      name: packageForm.name,
      description: packageForm.description,
      benefits: packageForm.benefits,
      amountCents,
      currency: packageForm.currency,
      sortOrder: Number(packageForm.sortOrder) || 0,
      isActive: packageForm.isActive,
      combinedWithPackageId: packageForm.combinedWithPackageId
        ? Number(packageForm.combinedWithPackageId)
        : null,
    });
  };
  const editPackage = (item: (typeof eventPackages)[number]) =>
    setPackageForm({
      id: item.id,
      packageType: item.packageType,
      name: item.name,
      description: item.description ?? "",
      benefits: item.benefits ?? "",
      amount: (item.amountCents / 100).toFixed(2),
      currency: item.currency,
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
      combinedWithPackageId: item.combinedWithPackageId
        ? String(item.combinedWithPackageId)
        : "",
    });
  const newEvent = (tenant: ExpoEventTenant = "ultrasound_expo") => {
    if (!canLeaveSettings()) return;
    setEventId("new");
    setEventForm(blankEvent(tenant));
    setEventDirty(false);
    setTab("settings");
    setVisitedTabs(new Set(["settings"]));
    setPackageForm(blankPackage());
    setCategory(tenant);
    setArchiveView(false);
  };

  if (snapshot.isLoading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-[#087f8c]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Expo management…
      </div>
    );
  if (snapshot.error)
    return (
      <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h1 className="font-bold">Expo management could not be loaded</h1>
        <p className="mt-2 text-sm">
          Please retry. If this continues, confirm platform-admin access.
        </p>
        <Button
          onClick={() => snapshot.refetch()}
          variant="outline"
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  const paidRegistrations = eventRegistrations.filter(
    row => row.paymentStatus === "paid"
  );
  const paidTotal = paidRegistrations.reduce(
    (sum, row) => sum + Number(row.amountCents),
    0
  );
  const eventLabel = LABELS[asTenant(activeEvent?.tenant ?? eventForm.tenant)];
  const archivedCount = (snapshot.data?.events ?? []).filter(
    event => event.status === "archived"
  ).length;
  const vendorRecords = eventRegistrations.filter(row =>
    row.partnerTypes?.includes("vendor")
  );
  const exhibitorRecords = eventRegistrations.filter(
    row =>
      row.packageType === "exhibitor" || row.partnerTypes?.includes("exhibitor")
  );
  const sponsorRecords = eventRegistrations.filter(
    row =>
      row.packageType === "sponsor" || row.partnerTypes?.includes("sponsor")
  );

  const panel = (id: ManagementTab, children: ReactNode) =>
    visitedTabs.has(id) && (
      <TabsContent
        key={id}
        value={id}
        forceMount
        className="mt-0 data-[state=inactive]:hidden"
      >
        {children}
      </TabsContent>
    );

  return (
    <div
      className={`min-h-screen bg-[#f4fbfc] px-4 py-6 sm:px-6 lg:px-8 ${FORM_FIELDS}`}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">
              Platform administration
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#062634]">
              Expo event management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Select an event, then manage one area at a time. UltrasoundExpo™
              and EchoExpo™ are separate event categories.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => newEvent("ultrasound_expo")}
              className="bg-[#087f8c] hover:bg-[#066a76]"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              New UltrasoundExpo™
            </Button>
            <Button
              onClick={() => newEvent("echo_expo")}
              variant="outline"
              className="border-cyan-200 bg-white text-[#087f8c]"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              New EchoExpo™
            </Button>
          </div>
        </header>
        {snapshot.data?.tenantSchemaAvailable === false && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            New UltrasoundExpo™ instances can be created. Separate EchoExpo™
            instances require the approved Railway event-identity migration. An
            EchoExpo™ save will not create an UltrasoundExpo™ event instead.
          </p>
        )}
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside
            className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm lg:sticky lg:top-4"
            aria-label="Select an Expo event"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-black text-[#062634]">Your events</h2>
              <span className="text-xs text-slate-500">
                {visibleEvents.length} shown
              </span>
            </div>
            <div
              className="mt-3 grid gap-1"
              role="group"
              aria-label="Event category filter"
            >
              {(["all", "ultrasound_expo", "echo_expo"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={category === value}
                  onClick={() => chooseCategory(value)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-bold ${category === value ? "bg-[#087f8c] text-white" : "bg-slate-50 text-slate-600 hover:bg-cyan-50"}`}
                >
                  {value === "all" ? "All event categories" : LABELS[value]}
                </button>
              ))}
            </div>
            <label className="relative mt-4 block">
              <span className="sr-only">Search events</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={event => {
                  if (canLeaveSettings()) {
                    setSearch(event.target.value);
                    setEventDirty(false);
                  }
                }}
                placeholder="Find an event…"
                className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm"
              />
            </label>
            <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => chooseArchiveView(false)}
                aria-pressed={!archiveView}
                className={`flex-1 rounded-md py-2 text-xs font-bold ${!archiveView ? "bg-white text-[#087f8c] shadow-sm" : "text-slate-500"}`}
              >
                Active events
              </button>
              <button
                type="button"
                onClick={() => chooseArchiveView(true)}
                aria-pressed={archiveView}
                className={`flex-1 rounded-md py-2 text-xs font-bold ${archiveView ? "bg-white text-[#087f8c] shadow-sm" : "text-slate-500"}`}
              >
                Archived ({archivedCount})
              </button>
            </div>
            <div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto">
              {visibleEvents.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => selectEvent(item.id)}
                  aria-current={
                    activeEvent?.id === item.id ? "true" : undefined
                  }
                  className={`w-full rounded-xl border p-3 text-left ${activeEvent?.id === item.id ? "border-[#087f8c] bg-[#eafbfb]" : "border-slate-100 hover:border-cyan-200"}`}
                >
                  <TenantBadge tenant={asTenant(item.tenant)} />
                  <span className="mt-2 block font-bold leading-5 text-[#062634]">
                    {item.name}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {eventDate(item.startsAt, item.timezone)}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">
                      {item.locationLabel || "Venue pending"}
                    </span>
                    <span className="rounded bg-white px-1.5 py-1 text-[10px] font-bold capitalize text-slate-600">
                      {item.status}
                    </span>
                  </span>
                </button>
              ))}
              {!visibleEvents.length && (
                <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">
                  {archiveView
                    ? "No archived events match this category."
                    : "No events match. Choose another category or create a new event."}
                </p>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              An event’s category can be corrected in{" "}
              <strong>Event settings</strong>. Deleting moves it to Archived,
              where it can be restored.
            </p>
          </aside>
          <main className="min-w-0" aria-label="Selected event workspace">
            <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                <div>
                  <TenantBadge
                    tenant={asTenant(activeEvent?.tenant ?? eventForm.tenant)}
                  />
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-[#062634]">
                    {activeEvent?.name ??
                      (eventId === "new"
                        ? `New ${eventLabel} event`
                        : "Choose or create an event")}
                  </h2>
                  {activeEvent && (
                    <p className="mt-2 text-sm text-slate-600">
                      {eventDate(activeEvent.startsAt, activeEvent.timezone)}
                      {activeEvent.endsAt
                        ? ` – ${eventDate(activeEvent.endsAt, activeEvent.timezone)}`
                        : ""}{" "}
                      · {activeEvent.timezone}
                      <span className="mt-1 block">
                        {activeEvent.locationLabel || "Venue pending"} ·{" "}
                        <span className="capitalize">{activeEvent.status}</span>
                      </span>
                    </p>
                  )}
                </div>
                {activeEvent && (
                  <div className="flex flex-wrap gap-2">
                    {activeEvent.status === "archived" ? (
                      <Button
                        variant="outline"
                        disabled={restoreEvent.isPending}
                        onClick={() =>
                          restoreEvent.mutate({ id: activeEvent.id })
                        }
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore as draft
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" onClick={copyEvent}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteTarget({
                              id: activeEvent.id,
                              name: activeEvent.name,
                            });
                            setConfirmDeleteName("");
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete event
                        </Button>
                      </>
                    )}
                    <a
                      href={`https://${activeEvent.tenant === "echo_expo" ? "www.echocardiographyexpo.com" : "www.ultrasoundexpo.com"}/events/${activeEvent.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 px-3 py-2 text-sm font-bold text-[#087f8c]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View event
                    </a>
                  </div>
                )}
              </div>
              {activeEvent && (
                <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  <CompactMetric
                    label="Paid registrations"
                    value={String(paidRegistrations.length)}
                  />
                  <CompactMetric
                    label="Event revenue"
                    value={formatExpoMoney(paidTotal)}
                  />
                  <CompactMetric
                    label="Active options"
                    value={String(
                      eventPackages.filter(item => item.isActive).length
                    )}
                  />
                </div>
              )}
            </div>
            <Tabs value={tab} onValueChange={chooseTab} className="mt-4 gap-4">
              <TabsList
                aria-label="Expo management areas"
                className="h-auto flex-wrap gap-1 rounded-xl border border-cyan-100 bg-white p-2 shadow-sm"
              >
                {MANAGEMENT_TABS.map(([value, label]) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    disabled={
                      !activeEvent &&
                      value !== "settings" &&
                      !GLOBAL_TABS.has(value)
                    }
                    className="h-auto rounded-lg px-3 py-2.5 text-xs font-bold data-[state=active]:bg-[#087f8c] data-[state=active]:text-white data-[state=active]:shadow-none"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {panel(
                "settings",
                <Section
                  title={activeEvent ? "Event settings" : "Create event"}
                  description="Manage this event’s category, dates, venue, details and registration instructions."
                >
                  {activeEvent?.status === "archived" && (
                    <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                      This event is archived and not available for new public
                      registrations. Its content and records are retained.
                      Restore it as a draft to use it again.
                    </p>
                  )}
                  {createEvent.error && (
                    <p
                      role="alert"
                      className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
                    >
                      {createEvent.error.message}
                    </p>
                  )}
                  <form
                    onSubmit={saveEvent}
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    <Field label="Event category">
                      <select
                        value={eventForm.tenant}
                        onChange={event =>
                          setForm({
                            tenant: event.target.value as ExpoEventTenant,
                          })
                        }
                        className="input"
                      >
                        <option value="ultrasound_expo">
                          UltrasoundExpo™
                        </option>
                        <option value="echo_expo">EchoExpo™</option>
                      </select>
                      <span className="text-xs font-normal leading-5 text-slate-500">
                        Select which event brand this instance belongs to.
                      </span>
                    </Field>
                    <Field label="Event name">
                      <input
                        required
                        value={eventForm.name}
                        onChange={event => {
                          const name = event.target.value;
                          setForm({
                            name,
                            ...(!activeEvent &&
                            eventForm.slug === slugify(eventForm.name)
                              ? { slug: slugify(name) }
                              : {}),
                          });
                        }}
                        className="input"
                      />
                    </Field>
                    {activeEvent && eventForm.tenant !== activeEvent.tenant && (
                      <p
                        role="status"
                        className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-medium text-[#087f8c] sm:col-span-2"
                      >
                        Saving moves this event into {LABELS[eventForm.tenant]}.
                        Its existing pages, dates, registrations and files
                        remain attached to the same event record.
                      </p>
                    )}
                    <Field label="Starts">
                      <input
                        required
                        type="datetime-local"
                        value={eventForm.startsAt}
                        onChange={event =>
                          setForm({ startsAt: event.target.value })
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Ends">
                      <input
                        type="datetime-local"
                        value={eventForm.endsAt}
                        onChange={event =>
                          setForm({ endsAt: event.target.value })
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Time zone">
                      <input
                        required
                        value={eventForm.timezone}
                        onChange={event =>
                          setForm({ timezone: event.target.value })
                        }
                        placeholder="America/New_York"
                        className="input"
                      />
                      <span className="text-xs font-normal text-slate-500">
                        Start and end are entered in this event’s time zone.
                      </span>
                    </Field>
                    <Field label="Event status">
                      <select
                        value={eventForm.status}
                        onChange={event =>
                          setForm({
                            status: event.target
                              .value as typeof eventForm.status,
                          })
                        }
                        className="input"
                      >
                        <option value="draft">Draft — private</option>
                        <option value="published">Published — public</option>
                        <option value="archived">Archived</option>
                      </select>
                    </Field>
                    <Field label="City / venue" className="sm:col-span-2">
                      <input
                        value={eventForm.locationLabel}
                        onChange={event =>
                          setForm({ locationLabel: event.target.value })
                        }
                        placeholder="e.g., Orlando, Florida · Venue TBD"
                        className="input"
                      />
                    </Field>
                    <Field label="URL slug">
                      <input
                        required
                        pattern="[a-z0-9-]+"
                        value={eventForm.slug}
                        onChange={event =>
                          setForm({ slug: slugify(event.target.value) })
                        }
                        className="input"
                      />
                      <span className="text-xs font-normal text-slate-500">
                        Changing the slug changes this event’s page URLs.
                      </span>
                    </Field>
                    <Field label="Hero image URL">
                      <input
                        value={eventForm.heroImageUrl}
                        onChange={event =>
                          setForm({ heroImageUrl: event.target.value })
                        }
                        placeholder="https://… or /manus-storage/…"
                        className="input"
                      />
                    </Field>
                    <Field label="Event overview" className="sm:col-span-2">
                      <textarea
                        rows={4}
                        value={eventForm.description}
                        onChange={event =>
                          setForm({ description: event.target.value })
                        }
                        className="input"
                      />
                    </Field>
                    <details className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                      <summary className="cursor-pointer text-sm font-bold text-[#062634]">
                        Registration terms & participant instructions
                      </summary>
                      <div className="mt-4 grid gap-4">
                        <Field label="Registration terms">
                          <textarea
                            rows={4}
                            value={eventForm.registrationTerms}
                            onChange={event =>
                              setForm({ registrationTerms: event.target.value })
                            }
                            placeholder="Event-specific registration terms and conditions"
                            className="input"
                          />
                        </Field>
                        <Field label="Attendee instructions">
                          <textarea
                            rows={3}
                            value={eventForm.attendeeInstructions}
                            onChange={event =>
                              setForm({
                                attendeeInstructions: event.target.value,
                              })
                            }
                            placeholder="Arrival, check-in, accessibility, or attendee instructions"
                            className="input"
                          />
                        </Field>
                        <Field label="Exhibitor and sponsor instructions">
                          <textarea
                            rows={3}
                            value={eventForm.partnerInstructions}
                            onChange={event =>
                              setForm({
                                partnerInstructions: event.target.value,
                              })
                            }
                            placeholder="Event-specific partner, booth, and sponsor instructions"
                            className="input"
                          />
                        </Field>
                      </div>
                    </details>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
                      <span className="text-xs text-slate-500">
                        {eventDirty
                          ? "Unsaved changes"
                          : "Saved event details are preserved until you save changes."}
                      </span>
                      <Button
                        disabled={
                          createEvent.isPending || updateEvent.isPending
                        }
                        className="bg-[#087f8c] hover:bg-[#066a76]"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {createEvent.isPending || updateEvent.isPending
                          ? "Saving…"
                          : activeEvent
                            ? "Save event settings"
                            : `Create ${LABELS[eventForm.tenant]} event`}
                      </Button>
                    </div>
                  </form>
                </Section>
              )}
              {activeEvent &&
                panel(
                  "attendees",
                  <ExpoEventInstancePanel
                    key={`attendees-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="attendees"
                  />
                )}
              {activeEvent &&
                panel(
                  "vendors",
                  <Section
                    title="Event vendors"
                    description="Vendor organizations registered for this selected event. Applications and general approvals are managed separately under Partner approvals."
                  >
                    <RegistrationTable
                      rows={vendorRecords}
                      empty="No registered vendor organizations for this event yet."
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => chooseTab("applications")}
                      >
                        Review partner applications
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => chooseTab("resources")}
                      >
                        Manage vendor resources
                      </Button>
                    </div>
                  </Section>
                )}
              {activeEvent &&
                panel(
                  "exhibitors",
                  <>
                    <Section
                      title="Event exhibitors"
                      description="Exhibitor registrations and booth selections belong to this event only."
                    >
                      <RegistrationTable
                        rows={exhibitorRecords}
                        empty="No exhibitor registrations for this event yet."
                      />
                    </Section>
                    <ExpoPartnerOperationsPanel
                      key={`exhibitors-${activeEvent.id}`}
                      eventId={activeEvent.id}
                      section="exhibitors"
                    />
                  </>
                )}
              {activeEvent &&
                panel(
                  "sponsors",
                  <Section
                    title="Event sponsors"
                    description="Sponsorship registrations for this event, separate from exhibitors and general organizational approvals."
                  >
                    <RegistrationTable
                      rows={sponsorRecords}
                      empty="No sponsor registrations for this event yet."
                    />
                    <Button
                      onClick={() => {
                        resetPackage();
                        setPackageForm(current => ({
                          ...current,
                          packageType: "sponsor",
                        }));
                        chooseTab("commerce");
                      }}
                      variant="outline"
                      className="mt-4"
                    >
                      Manage sponsorship options
                    </Button>
                  </Section>
                )}
              {activeEvent &&
                panel(
                  "map",
                  <ExpoPartnerOperationsPanel
                    key={`map-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="map"
                  />
                )}
              {activeEvent &&
                panel(
                  "prospectus",
                  <ExpoPartnerOperationsPanel
                    key={`prospectus-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="prospectus"
                  />
                )}
              {activeEvent &&
                panel(
                  "resources",
                  <ExpoPartnerOperationsPanel
                    key={`resources-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="resources"
                  />
                )}
              {activeEvent &&
                panel(
                  "agenda",
                  <ExpoEventInstancePanel
                    key={`agenda-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="agenda"
                  />
                )}
              {activeEvent &&
                panel(
                  "pages",
                  <ExpoEventInstancePanel
                    key={`pages-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="pages"
                  />
                )}
              {activeEvent &&
                panel(
                  "recordings",
                  <ExpoEventInstancePanel
                    key={`recordings-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="recordings"
                  />
                )}
              {activeEvent &&
                panel(
                  "community",
                  <ExpoEventInstancePanel
                    key={`community-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="community"
                  />
                )}
              {activeEvent &&
                panel(
                  "points",
                  <ExpoEventInstancePanel
                    key={`points-${activeEvent.id}`}
                    eventId={activeEvent.id}
                    section="points"
                  />
                )}
              {activeEvent &&
                panel(
                  "commerce",
                  <Section
                    title="Pricing & registration options"
                    description="Manage attendee, exhibitor, sponsor and other prices for this event. Combined offers remain explicitly paired across the two brands."
                  >
                    <div className="grid items-start gap-6 xl:grid-cols-2">
                      <form
                        onSubmit={saveOption}
                        className="grid gap-4 rounded-xl bg-[#f4fbfc] p-5"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-[#062634]">
                            {packageForm.id
                              ? "Edit registration option"
                              : "Add registration option"}
                          </h3>
                          <Button
                            type="button"
                            onClick={resetPackage}
                            variant="outline"
                            size="sm"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            New
                          </Button>
                        </div>
                        <Field label="Option type">
                          <select
                            value={packageForm.packageType}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                packageType: event.target
                                  .value as ExpoPackageType,
                                combinedWithPackageId: "",
                              }))
                            }
                            className="input"
                          >
                            {TYPES.map(type => (
                              <option key={type} value={type}>
                                {EXPO_PACKAGE_TYPE_META[type].label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Option name">
                          <input
                            required
                            value={packageForm.name}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            className="input"
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Price">
                            <input
                              required
                              min="0.50"
                              step="0.01"
                              type="number"
                              value={packageForm.amount}
                              onChange={event =>
                                setPackageForm(current => ({
                                  ...current,
                                  amount: event.target.value,
                                }))
                              }
                              className="input"
                            />
                          </Field>
                          <Field label="Display order">
                            <input
                              type="number"
                              min="0"
                              value={packageForm.sortOrder}
                              onChange={event =>
                                setPackageForm(current => ({
                                  ...current,
                                  sortOrder: event.target.value,
                                }))
                              }
                              className="input"
                            />
                          </Field>
                        </div>
                        <Field label="Currency">
                          <input
                            maxLength={3}
                            value={packageForm.currency}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                currency: event.target.value.toLowerCase(),
                              }))
                            }
                            className="input"
                          />
                        </Field>
                        <Field label="Summary">
                          <textarea
                            rows={3}
                            value={packageForm.description}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            className="input"
                          />
                        </Field>
                        <Field label="Benefits / inclusions">
                          <textarea
                            rows={4}
                            value={packageForm.benefits}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                benefits: event.target.value,
                              }))
                            }
                            placeholder="One benefit per line"
                            className="input"
                          />
                        </Field>
                        {(
                          [
                            "registrant",
                            "exhibitor",
                            "sponsor",
                          ] as ExpoPackageType[]
                        ).includes(packageForm.packageType) && (
                          <Field label="Pair with a companion event package">
                            <select
                              value={packageForm.combinedWithPackageId}
                              disabled={
                                snapshot.data?.combinedOfferSchemaAvailable ===
                                false
                              }
                              onChange={event =>
                                setPackageForm(current => ({
                                  ...current,
                                  combinedWithPackageId: event.target.value,
                                }))
                              }
                              className="input"
                            >
                              <option value="">No combined offer</option>
                              {companionPackageCandidates.map(item => (
                                <option key={item.id} value={item.id}>
                                  {
                                    snapshot.data?.events.find(
                                      event => event.id === item.eventId
                                    )?.name
                                  }{" "}
                                  — {item.name} (
                                  {formatExpoMoney(
                                    item.amountCents,
                                    item.currency
                                  )}
                                  )
                                </option>
                              ))}
                            </select>
                            {snapshot.data?.combinedOfferSchemaAvailable ===
                              false && (
                              <span className="text-xs font-normal text-amber-700">
                                Individual options can be edited now. Combined
                                offers need the separate paired-package database
                                migration.
                              </span>
                            )}
                            <span className="text-xs font-normal leading-5 text-slate-500">
                              Pair matching packages across UltrasoundExpo™ and
                              EchoExpo™ for a 20% combined discount. Both
                              packages and events must be active and published.
                            </span>
                          </Field>
                        )}
                        <label className="flex items-center gap-2 text-sm font-bold text-[#062634]">
                          <input
                            type="checkbox"
                            checked={packageForm.isActive}
                            onChange={event =>
                              setPackageForm(current => ({
                                ...current,
                                isActive: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 accent-[#087f8c]"
                          />
                          Activate this option
                        </label>
                        <p className="text-xs leading-5 text-slate-500">
                          Attendee options are public; exhibitor and sponsor
                          options remain inside the approved partner portal.
                        </p>
                        <Button
                          disabled={savePackage.isPending}
                          className="bg-[#087f8c] hover:bg-[#066a76]"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {savePackage.isPending
                            ? "Saving…"
                            : "Save registration option"}
                        </Button>
                      </form>
                      <div>
                        <h3 className="font-black text-[#062634]">
                          Existing options
                        </h3>
                        <div className="mt-3 space-y-2">
                          {eventPackages.length ? (
                            eventPackages.map(item => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => editPackage(item)}
                                className="w-full rounded-xl border border-slate-100 p-4 text-left hover:border-[#087f8c]"
                              >
                                <span className="flex justify-between gap-4">
                                  <span>
                                    <span className="block font-bold text-[#062634]">
                                      {item.name}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-500">
                                      {
                                        EXPO_PACKAGE_TYPE_META[item.packageType]
                                          .label
                                      }{" "}
                                      ·{" "}
                                      {item.isActive
                                        ? item.packageType === "registrant"
                                          ? "Public attendee"
                                          : "Private partner"
                                        : "Inactive"}
                                    </span>
                                  </span>
                                  <span className="font-black text-[#087f8c]">
                                    {formatExpoMoney(
                                      item.amountCents,
                                      item.currency
                                    )}
                                  </span>
                                </span>
                              </button>
                            ))
                          ) : (
                            <Empty text="No registration options yet. Add one using the form." />
                          )}
                        </div>
                      </div>
                    </div>
                  </Section>
                )}
              {activeEvent &&
                panel(
                  "reporting",
                  <Section
                    title="Payments & registration records"
                    description="All records below belong to the selected event. Historical records remain available even if the event is archived."
                  >
                    <div className="mb-5 grid gap-3 sm:grid-cols-3">
                      <CompactMetric
                        label="Paid revenue"
                        value={formatExpoMoney(paidTotal)}
                      />
                      <CompactMetric
                        label="Paid registrations"
                        value={String(paidRegistrations.length)}
                      />
                      <CompactMetric
                        label="Total records"
                        value={String(eventRegistrations.length)}
                      />
                    </div>
                    <RegistrationTable
                      rows={eventRegistrations}
                      empty="No registration records yet."
                    />
                  </Section>
                )}
              {panel(
                "applications",
                <>
                  <Section
                    title="Partner approvals — across Expo events"
                    description="Applications show interest in UltrasoundExpo™, EchoExpo™, or both. Approval is organization-wide; an event registration is tracked separately in that event’s vendor, exhibitor or sponsor tab."
                  >
                    <p className="text-sm text-slate-600">
                      Review organizations without mixing general approval with
                      event-specific bookings.
                    </p>
                  </Section>
                  <VendorPartnerAdminPanel scope="ultrasound_expo" />
                </>
              )}
              {panel("audiences", <ExpoAudienceManagementPanel />)}
              {panel(
                "websites",
                <Section
                  title="Website pages"
                  description="Website marketing pages are separate from the event-instance pages managed under Event pages."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["ultrasound_expo", "echo_expo"] as const).map(tenant => (
                      <article
                        key={tenant}
                        className="rounded-xl border border-cyan-100 p-5"
                      >
                        <TenantBadge tenant={tenant} />
                        <h3 className="mt-3 font-black text-[#062634]">
                          {LABELS[tenant]} website
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/admin/lms/site-pages?domain=${tenant === "echo_expo" ? "echocardiographyexpo.com" : "ultrasoundexpo.com"}`}
                            className="rounded-lg bg-[#087f8c] px-3 py-2 text-sm font-bold text-white"
                          >
                            Manage site pages
                          </Link>
                          <a
                            href={`https://${tenant === "echo_expo" ? "www.echocardiographyexpo.com" : "www.ultrasoundexpo.com"}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-cyan-200 px-3 py-2 text-sm font-bold text-[#087f8c]"
                          >
                            View website
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </Section>
              )}
            </Tabs>
          </main>
        </div>
      </div>
      <Dialog
        open={!!duplicate}
        onOpenChange={open => {
          if (!open && !duplicateEvent.isPending) setDuplicate(null);
        }}
      >
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto sm:max-w-xl ${FORM_FIELDS}`}
        >
          <DialogHeader>
            <DialogTitle>Duplicate an Expo event</DialogTitle>
            <DialogDescription>
              Choose the category, name and dates for the new instance. Pages
              and configuration are copied as drafts; registration options are
              inactive. Existing attendees, payments and approvals are not
              copied.
            </DialogDescription>
          </DialogHeader>
          {duplicate && (
            <form
              onSubmit={submitDuplicate}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="New event category">
                <select
                  value={duplicate.tenant}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && {
                          ...current,
                          tenant: event.target.value as ExpoEventTenant,
                        }
                    )
                  }
                  className="input"
                >
                  <option value="ultrasound_expo">UltrasoundExpo™</option>
                  <option value="echo_expo">EchoExpo™</option>
                </select>
              </Field>
              <Field label="New event name">
                <input
                  required
                  value={duplicate.name}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && { ...current, name: event.target.value }
                    )
                  }
                  className="input"
                />
              </Field>
              <Field label="New URL slug">
                <input
                  required
                  pattern="[a-z0-9-]+"
                  value={duplicate.slug}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && {
                          ...current,
                          slug: slugify(event.target.value),
                        }
                    )
                  }
                  className="input"
                />
              </Field>
              <Field label="Time zone">
                <input
                  required
                  value={duplicate.timezone}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && { ...current, timezone: event.target.value }
                    )
                  }
                  className="input"
                />
              </Field>
              <Field label="Starts">
                <input
                  required
                  type="datetime-local"
                  value={duplicate.startsAt}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && { ...current, startsAt: event.target.value }
                    )
                  }
                  className="input"
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  value={duplicate.endsAt}
                  onChange={event =>
                    setDuplicate(
                      current =>
                        current && { ...current, endsAt: event.target.value }
                    )
                  }
                  className="input"
                />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={duplicateEvent.isPending}
                  onClick={() => setDuplicate(null)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={duplicateEvent.isPending}
                  className="bg-[#087f8c] hover:bg-[#066a76]"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {duplicateEvent.isPending
                    ? "Duplicating…"
                    : "Create duplicate draft"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open && !deleteEvent.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent className={FORM_FIELDS}>
          <DialogHeader>
            <DialogTitle>Delete this event from active events?</DialogTitle>
            <DialogDescription>
              This moves the event to Archived and stops new public
              registrations. Existing registrations, payment records, pages,
              files and settings are retained. Restore it as a draft from
              Archived events if needed.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <form
              onSubmit={event => {
                event.preventDefault();
                deleteEvent.mutate({
                  id: deleteTarget.id,
                  confirmName: confirmDeleteName,
                });
              }}
              className="grid gap-4"
            >
              <p className="text-sm text-slate-600">
                Type{" "}
                <strong className="text-[#062634]">{deleteTarget.name}</strong>{" "}
                to confirm.
              </p>
              <Field label="Event name confirmation">
                <input
                  autoComplete="off"
                  value={confirmDeleteName}
                  onChange={event => setConfirmDeleteName(event.target.value)}
                  className="input"
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteEvent.isPending}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={
                    deleteEvent.isPending ||
                    confirmDeleteName.trim() !== deleteTarget.name
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteEvent.isPending ? "Deleting…" : "Delete event"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TenantBadge({ tenant }: { tenant: ExpoEventTenant }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${tenant === "echo_expo" ? "bg-sky-100 text-sky-800" : "bg-cyan-100 text-[#087f8c]"}`}
    >
      {LABELS[tenant]}
    </span>
  );
}
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-xl font-black text-[#062634]">{title}</h3>
      <p className="mt-2 mb-5 text-sm leading-6 text-slate-600">
        {description}
      </p>
      {children}
    </section>
  );
}
function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-black text-[#062634]">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`grid gap-1.5 text-sm font-bold text-slate-700 ${className}`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">
      {text}
    </p>
  );
}
function RegistrationTable({
  rows,
  empty,
}: {
  rows: {
    id: number;
    attendeeName: string;
    attendeeEmail: string;
    organizationName: string | null;
    packageName: string;
    paymentStatus: string;
    amountCents: number;
    currency: string;
  }[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <th className="px-3 py-3">Registrant / organization</th>
            <th className="px-3 py-3">Registration option</th>
            <th className="px-3 py-3">Payment status</th>
            <th className="px-3 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(row => (
              <tr key={row.id} className="border-b border-slate-50">
                <td className="px-3 py-3">
                  <span className="block font-bold text-slate-800">
                    {row.attendeeName}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {row.organizationName || row.attendeeEmail}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">{row.packageName}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${row.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {row.paymentStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-bold text-[#087f8c]">
                  {formatExpoMoney(row.amountCents, row.currency)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="px-3 py-7 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
