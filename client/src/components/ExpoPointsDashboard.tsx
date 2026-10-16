import { Gift, Loader2, Medal, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { EXPO_POINTS_ACTIVITY_TYPE_LABELS, EXPO_POINTS_LEADERBOARD_SCOPE_LABELS } from "@shared/expoPoints";

function dateText(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ExpoPointsDashboard() {
  const utils = trpc.useUtils();
  const dashboard = trpc.expoPoints.myDashboard.useQuery();
  const request = trpc.expoPoints.requestRedemption.useMutation({
    onSuccess: async () => {
      toast.success("Reward request received. The event team will confirm fulfillment.");
      await utils.expoPoints.myDashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (dashboard.isLoading) return <section className="rounded-3xl border border-cyan-100 bg-white p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#087f8c]" />Loading ExpoPoints…</section>;
  if (dashboard.error) return <section className="rounded-3xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">ExpoPoints could not be loaded right now. Please refresh or contact support@allaboutultrasound.com.</section>;
  if (!dashboard.data?.length) return null;

  return <section className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#087f8c]">Event rewards</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-[-.04em] text-[#062634]"><Sparkles className="h-6 w-6 text-[#0c9ba3]" /> ExpoPoints</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Earn points for event attendance, CME education, exhibit-hall engagement, Expo games, networking, and other activities selected by the event team. Redeem eligible points for event rewards.</p></div></div>
    <div className="mt-6 grid gap-5">{dashboard.data.map((entry) => <article key={entry.program.id} className="overflow-hidden rounded-2xl border border-cyan-100"><div className="flex flex-col justify-between gap-4 bg-[#052b38] p-5 text-white sm:flex-row sm:items-center"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#93f3ee]">{EXPO_POINTS_LEADERBOARD_SCOPE_LABELS[entry.program.leaderboardScope as keyof typeof EXPO_POINTS_LEADERBOARD_SCOPE_LABELS]}</p><h3 className="mt-1 text-xl font-black">{entry.program.name}</h3><p className="mt-1 text-sm text-slate-200">Eligible as {entry.participant.role.replace("_", " ")}</p></div><div className="rounded-2xl bg-white/10 px-5 py-3 text-right"><p className="text-3xl font-black text-[#a9f7f2]">{entry.balance.toLocaleString()}</p><p className="text-xs font-black uppercase tracking-[.15em] text-slate-200">Available points</p></div></div>
      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_.9fr]"><div><h4 className="flex items-center gap-2 font-black text-[#062634]"><Gift className="h-4 w-4 text-[#087f8c]" /> Rewards</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">{entry.rewards.length ? entry.rewards.map((reward: any) => { const unavailable = reward.inventoryLimit !== null && reward.redeemedCount >= reward.inventoryLimit; const canRequest = entry.balance >= reward.pointsCost && !unavailable; return <div key={reward.id} className="rounded-xl bg-[#f4fbfc] p-4"><div className="flex justify-between gap-3"><p className="font-bold text-[#062634]">{reward.title}</p><span className="shrink-0 text-sm font-black text-[#087f8c]">{reward.pointsCost.toLocaleString()} pts</span></div>{reward.description && <p className="mt-2 text-sm leading-5 text-slate-600">{reward.description}</p>}<Button size="sm" disabled={!canRequest || request.isPending} onClick={() => request.mutate({ programId: entry.program.id, rewardId: reward.id })} className="mt-4 bg-[#0c9ba3] text-xs hover:bg-[#0a858d]">{unavailable ? "Fully reserved" : entry.balance < reward.pointsCost ? "Keep earning" : "Request reward"}</Button></div>; }) : <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">Rewards will appear when the event team publishes them.</p>}</div></div>
        <div><h4 className="flex items-center gap-2 font-black text-[#062634]"><Medal className="h-4 w-4 text-[#087f8c]" /> Recent activity</h4><div className="mt-3 space-y-2">{entry.transactions.length ? entry.transactions.map((transaction: any) => <div key={transaction.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="text-sm font-bold text-[#062634]">{transaction.description}</p><p className="mt-1 text-xs text-slate-500">{EXPO_POINTS_ACTIVITY_TYPE_LABELS[transaction.activityType as keyof typeof EXPO_POINTS_ACTIVITY_TYPE_LABELS]} · {dateText(transaction.createdAt)}</p></div><span className={`shrink-0 font-black ${transaction.points >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{transaction.points >= 0 ? "+" : ""}{transaction.points}</span></div>) : <p className="rounded-xl border border-dashed border-cyan-200 p-4 text-sm text-slate-500">Your ExpoPoints activity will appear here.</p>}</div>{entry.redemptions.length > 0 && <div className="mt-4"><p className="text-xs font-black uppercase tracking-[.14em] text-[#087f8c]">Reward requests</p><div className="mt-2 space-y-1">{entry.redemptions.map((redemption: any) => <p key={redemption.id} className="text-sm text-slate-600"><span className="font-bold text-[#062634]">{redemption.rewardTitle}</span> · {redemption.status} · {redemption.pointsCost.toLocaleString()} points</p>)}</div></div>}</div></div>
      {entry.program.liveDisplayEnabled && <div className="border-t border-cyan-100 bg-[#f7fcfc] px-5 py-3"><a href={`/expo-points/live/${entry.program.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[#087f8c] hover:underline"><Trophy className="h-4 w-4" /> Open the live event leaderboard</a></div>}</article>)}</div>
  </section>;
}
