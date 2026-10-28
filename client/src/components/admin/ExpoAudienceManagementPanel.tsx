import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export function ExpoAudienceManagementPanel() {
  const [view, setView] = useState<"attendees" | "partners">("attendees");
  const snapshot = trpc.ultrasoundExpo.adminSnapshot.useQuery();
  const applications = trpc.vendorPortal.adminListApplications.useQuery({ status: "all" });

  const attendees = useMemo(() => {
    const records = (snapshot.data?.registrations ?? []).filter((row: any) => row.packageType === "registrant");
    const indexed = new Map<string, { name: string; email: string; ultrasound: boolean; echo: boolean; paid: number; latest: string }>();
    for (const row of records as any[]) {
      const email = (row.attendeeEmail || "").trim().toLowerCase();
      if (!email) continue;
      const previous = indexed.get(email) ?? { name: row.attendeeName || "Attendee", email, ultrasound: false, echo: false, paid: 0, latest: row.eventName || "" };
      if (row.eventTenant === "echo_expo") previous.echo = true; else previous.ultrasound = true;
      if (row.paymentStatus === "paid") previous.paid += 1;
      previous.latest = row.eventName || previous.latest;
      indexed.set(email, previous);
    }
    return [...indexed.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot.data?.registrations]);

  const partners = useMemo(() => (applications.data ?? [])
    .filter((application: any) => application.expoAccess || application.requestedScopes?.includes("ultrasound_expo"))
    .map((application: any) => ({
      ...application,
      ultrasound: application.eventInterests?.includes("ultrasound_expo") ?? application.eventFocus !== "echo_expo",
      echo: application.eventInterests?.includes("echo_expo") ?? application.eventFocus === "echo_expo",
    })), [applications.data]);

  const busy = snapshot.isLoading || applications.isLoading;
  return <section className="mt-7 rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">Unified people management</p><h2 className="mt-1 text-2xl font-black text-[#062634]">UltrasoundExpo™ &amp; EchoExpo™ audiences</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">View attendee and organization participation across both event pathways. Individual event rosters, pages, agendas, resources, and registrations remain available in the event-instance workspace below.</p></div><div className="flex gap-2"><Tab active={view === "attendees"} onClick={() => setView("attendees")} label="Attendees" /><Tab active={view === "partners"} onClick={() => setView("partners")} label="Exhibitors, vendors & sponsors" /></div></div>
    {busy ? <p className="mt-6 rounded-xl bg-[#f4fbfc] p-5 text-sm text-slate-600">Loading event participation…</p> : view === "attendees" ? <><div className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="UltrasoundExpo™ attendees" value={attendees.filter(row => row.ultrasound).length} /><Metric label="EchoExpo™ attendees" value={attendees.filter(row => row.echo).length} /><Metric label="Both pathways" value={attendees.filter(row => row.ultrasound && row.echo).length} /></div><RosterTable rows={attendees} kind="attendee" /></> : <><div className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="UltrasoundExpo™ partner pathway" value={partners.filter(row => row.ultrasound).length} /><Metric label="EchoExpo™ partner pathway" value={partners.filter(row => row.echo).length} /><Metric label="Approved organizations" value={partners.filter(row => row.status === "approved").length} /></div><RosterTable rows={partners} kind="partner" /></>}
  </section>;
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-[#087f8c] text-white" : "border border-cyan-100 bg-white text-slate-600 hover:border-[#087f8c]"}`}>{label}</button>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-[#f4fbfc] p-4"><p className="text-2xl font-black text-[#062634]">{value}</p><p className="mt-1 text-xs font-bold text-slate-600">{label}</p></div>; }
function EventBadges({ ultrasound, echo }: { ultrasound: boolean; echo: boolean }) { return <span className="flex flex-wrap gap-1">{ultrasound && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-black text-[#087f8c]">UltrasoundExpo™</span>}{echo && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-800">EchoExpo™</span>}</span>; }
function RosterTable({ rows, kind }: { rows: any[]; kind: "attendee" | "partner" }) { return <div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><th className="px-3 py-3">{kind === "attendee" ? "Attendee" : "Organization"}</th><th className="px-3 py-3">Event pathway</th><th className="px-3 py-3">{kind === "attendee" ? "Registration" : "Participation"}</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.email || row.id || index} className="border-b border-slate-50"><td className="px-3 py-3"><span className="block font-bold text-[#062634]">{kind === "attendee" ? row.name : row.organizationName}</span><span className="block text-xs text-slate-500">{kind === "attendee" ? row.email : `${row.contactName} · ${row.contactEmail}`}</span></td><td className="px-3 py-3"><EventBadges ultrasound={row.ultrasound} echo={row.echo} /></td><td className="px-3 py-3 text-slate-600">{kind === "attendee" ? row.latest : (row.partnerTypes ?? []).map((type: string) => type.replace(/^./, char => char.toUpperCase())).join(", ")}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${kind === "attendee" ? row.paid > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800" : row.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{kind === "attendee" ? row.paid > 0 ? "Paid" : "Pending" : row.status}</span></td></tr>) : <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No {kind === "attendee" ? "attendee" : "partner"} records match this event workspace yet.</td></tr>}</tbody></table></div>; }
