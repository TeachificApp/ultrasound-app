import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { Crown, Maximize, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ExpoPointsLiveDisplay() {
  const [, params] = useRoute("/expo-points/live/:programId");
  const programId = Number(params?.programId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const leaderboard = trpc.expoPoints.publicLiveLeaderboard.useQuery({ programId, limit: 15 }, { enabled: Number.isInteger(programId) && programId > 0, refetchInterval: 15_000, refetchIntervalInBackground: true });
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const updated = useMemo(() => leaderboard.data?.refreshedAt ? new Date(leaderboard.data.refreshedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null, [leaderboard.data?.refreshedAt]);
  const enterFullscreen = async () => { try { await document.documentElement.requestFullscreen(); } catch { /* Browser presentation mode is optional. */ } };

  if (!Number.isInteger(programId) || programId <= 0) return <ErrorScreen text="This ExpoPoints live display link is invalid." />;
  if (leaderboard.isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#031f2b] text-[#a9f7f2]"><RefreshCw className="mr-3 h-7 w-7 animate-spin" />Preparing the live leaderboard…</div>;
  if (leaderboard.error || !leaderboard.data) return <ErrorScreen text="This ExpoPoints live display is unavailable. An event administrator may need to enable it." />;
  const entries = leaderboard.data.entries;
  return <main className="min-h-screen overflow-hidden bg-[#031f2b] text-white"><div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_90%_10%,rgba(27,177,186,.35),transparent_30%),radial-gradient(circle_at_20%_90%,rgba(8,128,140,.28),transparent_35%)]" /><div className="relative mx-auto flex min-h-screen max-w-[1800px] flex-col px-6 py-8 md:px-10 lg:px-16"><header className="flex items-start justify-between gap-6"><div><p className="flex items-center gap-2 text-sm font-black uppercase tracking-[.28em] text-[#89eee9]"><Sparkles className="h-4 w-4" /> Live event leaderboard</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-6xl lg:text-7xl">{leaderboard.data.program.name}</h1><p className="mt-3 text-base text-slate-200 sm:text-lg">Live ExpoPoints standings · auto-refreshing every 15 seconds</p></div><button type="button" onClick={enterFullscreen} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/20"><Maximize className="h-5 w-5" />{isFullscreen ? "Presentation mode" : "Full screen"}</button></header>
    <section className="mt-8 flex-1"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{entries.map((entry) => <article key={`${entry.rank}-${entry.displayName}`} className={`flex items-center gap-5 rounded-3xl border p-5 shadow-2xl ${entry.rank === 1 ? "border-[#81ece5] bg-gradient-to-br from-[#116c75] to-[#06323e]" : "border-white/10 bg-white/[.07]"}`}><div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${entry.rank === 1 ? "bg-[#9cf7f2] text-[#05303a]" : entry.rank === 2 ? "bg-slate-200 text-slate-700" : entry.rank === 3 ? "bg-amber-300 text-amber-950" : "bg-white/10 text-[#a9f7f2]"}`}>{entry.rank === 1 ? <Crown className="h-7 w-7" /> : `#${entry.rank}`}</div><div className="min-w-0 flex-1"><p className="truncate text-xl font-black tracking-[-.03em] sm:text-2xl">{entry.displayName}</p><p className="mt-1 text-sm font-bold uppercase tracking-[.15em] text-[#a6f4ef]">{entry.points.toLocaleString()} points</p></div>{entry.rank <= 3 && <Trophy className="h-6 w-6 shrink-0 text-[#a9f7f2]" />}</article>)}</div>{entries.length === 0 && <div className="mt-16 rounded-3xl border border-dashed border-white/30 bg-white/5 p-12 text-center"><Trophy className="mx-auto h-12 w-12 text-[#a9f7f2]" /><h2 className="mt-5 text-3xl font-black">The leaderboard is ready</h2><p className="mt-3 text-slate-200">Point activity will appear here as participants earn ExpoPoints.</p></div>}</section>
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-slate-300"><span>{updated ? `Updated ${updated}` : "Live event scoring"}</span><Link href="/" className="font-bold text-[#a9f7f2] hover:underline">UltrasoundExpo™</Link></footer></div></main>;
}

function ErrorScreen({ text }: { text: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#031f2b] p-6 text-center text-white"><div><Trophy className="mx-auto h-12 w-12 text-[#a9f7f2]" /><h1 className="mt-5 text-3xl font-black">ExpoPoints</h1><p className="mt-3 max-w-md text-slate-200">{text}</p></div></main>;
}
