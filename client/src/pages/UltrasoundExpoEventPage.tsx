import { useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { BlockPreview, type Block } from "@/components/BlockPreview";

export default function UltrasoundExpoEventPage() {
  const { eventSlug, pageSlug } = useParams<{ eventSlug: string; pageSlug: string }>();
  const page = trpc.ultrasoundExpoEvent.getEventPage.useQuery({ eventSlug: eventSlug || "", pageSlug: pageSlug || "" }, { enabled: !!eventSlug && !!pageSlug, retry: false });
  useEffect(() => { if (page.data?.page.seoTitle) document.title = page.data.page.seoTitle; }, [page.data?.page.seoTitle]);
  const blocks = useMemo<Block[]>(() => { try { const parsed = JSON.parse(page.data?.page.blocksJson || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }, [page.data?.page.blocksJson]);
  const path = `/events/${eventSlug}/${pageSlug}`;
  if (page.isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f4fbfc] text-[#087f8c]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading event page…</div>;
  if (page.error || !page.data) return <AccessRequired path={path} eventSlug={eventSlug} />;
  return <div className="min-h-screen bg-white"><header className="border-b bg-[#062634] px-4 py-4 text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#80eee8]">UltrasoundExpo™ event page</p><p className="mt-1 text-lg font-black">{page.data.event.name}</p></div><Link href={`/events/${eventSlug}`} className="inline-flex items-center rounded-lg border border-white/25 px-3 py-2 text-sm font-bold hover:bg-white/10"><ArrowLeft className="mr-2 h-4 w-4" />Event hub</Link></div></header>{blocks.length ? <main>{blocks.map(block => <BlockPreview key={block.id} block={block} />)}</main> : <main className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="text-3xl font-black text-[#062634]">{page.data.page.title}</h1><p className="mt-4 text-slate-600">This event page is being prepared. Please check back soon.</p></main>}</div>;
}
function AccessRequired({ path, eventSlug }: { path: string; eventSlug?: string }) { return <div className="min-h-screen bg-[#f4fbfc] px-4 py-24 text-center"><div className="mx-auto max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm"><LockKeyhole className="mx-auto h-10 w-10 text-[#087f8c]" /><h1 className="mt-4 text-2xl font-black text-[#062634]">Event page access required</h1><p className="mt-3 leading-7 text-slate-600">This page is available to eligible UltrasoundExpo™ event participants. Sign in with the account used for your event registration, or return to your event hub.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><a href={getLoginUrl(path)} className="rounded-lg bg-[#0c9ba3] px-5 py-3 font-bold text-white hover:bg-[#0a858d]">Sign in</a>{eventSlug && <Link href={`/events/${eventSlug}`} className="rounded-lg border border-cyan-200 px-5 py-3 font-bold text-[#087f8c]">Event hub</Link>}</div></div></div>; }
