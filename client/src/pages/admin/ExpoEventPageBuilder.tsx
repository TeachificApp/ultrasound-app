import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Eye, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BlockPreview, type Block, type BlockType } from "@/components/BlockPreview";
import { BLOCK_CATALOG, BlockSettings, uid } from "@/pages/admin/LandingPageBuilder";
import { trpc } from "@/lib/trpc";
import {
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS,
  ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPE_LABELS,
  ULTRASOUND_EXPO_EVENT_PAGE_TYPES,
} from "@shared/ultrasoundExpoEvent";

export default function ExpoEventPageBuilder() {
  const { eventId: eventIdParam, pageId: pageIdParam } = useParams<{ eventId: string; pageId: string }>();
  const [, navigate] = useLocation();
  const eventId = Number(eventIdParam);
  const pageId = Number(pageIdParam);
  const workspace = trpc.ultrasoundExpoEvent.adminEventWorkspace.useQuery({ eventId }, { enabled: Number.isFinite(eventId) });
  const utils = trpc.useUtils();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState({ title: "", slug: "", pageType: "custom" as any, accessLevel: "public" as any, status: "draft" as any, seoTitle: "", seoDescription: "" });
  const [loaded, setLoaded] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [category, setCategory] = useState("Layout");
  const page = workspace.data?.pages.find((item: any) => item.id === pageId);

  useEffect(() => {
    if (!page || loaded) return;
    setMeta({ title: page.title, slug: page.slug, pageType: page.pageType, accessLevel: page.accessLevel, status: page.status, seoTitle: page.seoTitle || "", seoDescription: page.seoDescription || "" });
    try { const parsed = JSON.parse(page.blocksJson || "[]"); setBlocks(Array.isArray(parsed) ? parsed : []); } catch { setBlocks([]); }
    setLoaded(true);
  }, [page, loaded]);

  const save = trpc.ultrasoundExpoEvent.adminSaveEventPage.useMutation({
    onSuccess: async () => { toast.success("UltrasoundExpo™ event page saved."); await utils.ultrasoundExpoEvent.adminEventWorkspace.invalidate({ eventId }); },
    onError: error => toast.error(error.message),
  });
  const selected = blocks.find(block => block.id === selectedId) || null;
  const categories = useMemo(() => [...new Set(BLOCK_CATALOG.map(item => item.category))], []);
  const catalog = BLOCK_CATALOG.filter(item => item.category === category);
  const add = (type: BlockType) => {
    const source = BLOCK_CATALOG.find(item => item.type === type);
    if (!source) return;
    const block: Block = { id: uid(), type, data: { ...source.defaultData } };
    setBlocks(current => [...current, block]); setSelectedId(block.id); setCatalogOpen(false);
  };
  const move = (index: number, delta: number) => setBlocks(current => { const target = index + delta; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const savePage = () => save.mutate({ id: pageId, eventId, ...meta, blocksJson: JSON.stringify(blocks) });

  if (workspace.isLoading) return <div className="flex min-h-screen items-center justify-center text-[#087f8c]">Loading event page editor…</div>;
  if (!workspace.data || !page) return <div className="p-8"><p className="text-red-700">This UltrasoundExpo™ event page is unavailable.</p><Button className="mt-4" onClick={() => navigate("/admin/ultrasound-expo")}>Back to administration</Button></div>;
  const preview = `/events/${workspace.data.event.slug}/${meta.slug}`;
  return <div className="min-h-screen bg-slate-100"><header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm"><div className="flex min-w-0 items-center gap-3"><Link href="/admin/ultrasound-expo" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#087f8c]"><ArrowLeft className="h-4 w-4" />Event admin</Link><div className="h-6 w-px bg-slate-200" /><div className="min-w-0"><p className="truncate font-black text-[#062634]">{meta.title}</p><p className="truncate text-xs text-slate-500">UltrasoundExpo™ · {workspace.data.event.name}</p></div></div><div className="flex items-center gap-2"><a href={preview} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-cyan-200 px-3 py-2 text-sm font-bold text-[#087f8c]"><Eye className="mr-1.5 h-4 w-4" />Preview</a><Button onClick={savePage} disabled={save.isPending} className="bg-[#0c9ba3] hover:bg-[#0a858d]"><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save"}</Button></div></header><div className="grid gap-5 p-4 xl:grid-cols-[minmax(0,1fr)_330px]"><main className="min-w-0"><section className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#087f8c]">Visual event page builder</p><p className="mt-1 text-sm text-slate-600">Build this event’s landing page with the same reusable content blocks used across the platform.</p></div><Button variant="outline" onClick={() => setCatalogOpen(current => !current)} className="border-cyan-200 text-[#087f8c]"><Plus className="mr-2 h-4 w-4" />Add block</Button></div>{catalogOpen && <div className="mt-4 rounded-xl border border-cyan-100 bg-[#f4fbfc] p-3"><div className="flex flex-wrap gap-1">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${category === item ? "bg-[#087f8c] text-white" : "bg-white text-slate-600 hover:bg-cyan-50"}`}>{item}</button>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{catalog.map(item => <button key={item.type} onClick={() => add(item.type)} className="rounded-lg border border-cyan-100 bg-white px-3 py-2 text-left text-sm font-bold text-[#062634] hover:border-[#087f8c] hover:bg-cyan-50">+ {item.label}</button>)}</div></div>}</section><section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{blocks.length ? <div className="space-y-3 p-3">{blocks.map((block, index) => <div key={block.id} className={`rounded-xl border p-2 ${selectedId === block.id ? "border-[#0c9ba3] ring-2 ring-cyan-100" : "border-slate-200"}`}><div className="mb-2 flex items-center justify-between gap-3 px-1"><button onClick={() => setSelectedId(block.id)} className="min-w-0 truncate text-left text-xs font-black uppercase tracking-wide text-[#087f8c]">{BLOCK_CATALOG.find(item => item.type === block.type)?.label || block.type}</button><div className="flex shrink-0 gap-1"><button onClick={() => move(index, -1)} disabled={!index} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↑</button><button onClick={() => move(index, 1)} disabled={index === blocks.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↓</button><button onClick={() => setBlocks(current => current.filter(item => item.id !== block.id))} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600">Remove</button></div></div><button className="block w-full text-left" onClick={() => setSelectedId(block.id)}><BlockPreview block={block} /></button></div>)}</div> : <div className="p-16 text-center"><p className="font-bold text-slate-700">This event page is ready for content.</p><p className="mt-2 text-sm text-slate-500">Add a hero, text, image, schedule, file, CTA, or any other reusable block.</p><Button onClick={() => setCatalogOpen(true)} className="mt-5 bg-[#0c9ba3] hover:bg-[#0a858d]"><Plus className="mr-2 h-4 w-4" />Add first block</Button></div>}</section></main><aside className="space-y-5"><section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm"><h2 className="font-black text-[#062634]">Page settings</h2><label className="mt-4 grid gap-1 text-sm font-bold">Title<input value={meta.title} onChange={e => setMeta(current => ({ ...current, title: e.target.value }))} className="input" /></label><label className="mt-3 grid gap-1 text-sm font-bold">URL slug<input value={meta.slug} onChange={e => setMeta(current => ({ ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} className="input" /></label><label className="mt-3 grid gap-1 text-sm font-bold">Purpose<select value={meta.pageType} onChange={e => setMeta(current => ({ ...current, pageType: e.target.value }))} className="input">{ULTRASOUND_EXPO_EVENT_PAGE_TYPES.map(type => <option key={type} value={type}>{ULTRASOUND_EXPO_EVENT_PAGE_TYPE_LABELS[type]}</option>)}</select></label><label className="mt-3 grid gap-1 text-sm font-bold">Audience<select value={meta.accessLevel} onChange={e => setMeta(current => ({ ...current, accessLevel: e.target.value }))} className="input">{ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LEVELS.map(level => <option key={level} value={level}>{ULTRASOUND_EXPO_EVENT_PAGE_ACCESS_LABELS[level]}</option>)}</select></label><label className="mt-3 grid gap-1 text-sm font-bold">Status<select value={meta.status} onChange={e => setMeta(current => ({ ...current, status: e.target.value }))} className="input"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label className="mt-3 grid gap-1 text-sm font-bold">SEO title<input value={meta.seoTitle} onChange={e => setMeta(current => ({ ...current, seoTitle: e.target.value }))} className="input" /></label><label className="mt-3 grid gap-1 text-sm font-bold">SEO description<textarea rows={3} value={meta.seoDescription} onChange={e => setMeta(current => ({ ...current, seoDescription: e.target.value }))} className="input" /></label></section>{selected && <section className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.16em] text-[#087f8c]">Block settings</p><h2 className="mt-1 font-black text-[#062634]">{BLOCK_CATALOG.find(item => item.type === selected.type)?.label || selected.type}</h2><div className="mt-4"><BlockSettings block={selected} onChange={data => setBlocks(current => current.map(item => item.id === selected.id ? { ...item, data } : item))} /></div></section>}</aside></div></div>;
}
