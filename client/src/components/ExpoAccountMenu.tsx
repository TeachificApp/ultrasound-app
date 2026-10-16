import { LogIn, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { UnifiedProfileLinks } from "@/components/UnifiedProfileLinks";

type ExpoAccountMenuProps = {
  returnPath?: string;
  className?: string;
};

/** Shared event-site account menu. The same Learn-first destinations appear in both Expo headers. */
export function ExpoAccountMenu({ returnPath = "/expo-dashboard", className }: ExpoAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, loading, logout, user } = useAuth();
  const close = () => setOpen(false);

  if (loading) return <div className={`h-9 w-9 animate-pulse rounded-lg bg-white/10 ${className ?? ""}`} aria-label="Loading account" />;
  if (!isAuthenticated) return <a href={getLoginUrl(returnPath)} className={`rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 ${className ?? ""}`}><LogIn className="mr-1.5 inline-block h-3.5 w-3.5" />Sign in</a>;

  return <div className={`relative ${className ?? ""}`}>
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#a5f4ef] hover:bg-white/10">
      <UserRound className="h-4 w-4" />
      <span className="hidden max-w-28 truncate lg:block">{user?.displayName || user?.name || "Account"}</span>
      <span className="lg:hidden">Account</span>
    </button>
    {open && <>
      <button aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={close} />
      <div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-5rem)] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 text-slate-900 shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="truncate text-sm font-black text-slate-900">{user?.displayName || user?.name || "Account"}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email || ""}</p>
        </div>
        <UnifiedProfileLinks user={user} onNavigate={close} />
        <div className="mt-1 border-t border-slate-100 px-2 pt-1.5">
          <button type="button" onClick={() => { close(); logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </div>
    </>}
  </div>;
}

/** Mobile Expo navigation uses the identical set of account destinations. */
export function ExpoMobileAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated, loading, logout, user } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <a href={getLoginUrl("/expo-dashboard")} onClick={onNavigate} className="mt-2 block rounded-lg border border-white/20 px-3 py-3 text-sm font-bold text-white hover:bg-white/10"><LogIn className="mr-2 inline-block h-4 w-4" />Sign in</a>;
  return <div className="mt-2 rounded-xl bg-white p-1.5 text-slate-900"><div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-black">{user?.displayName || user?.name || "Account"}</p><p className="truncate text-xs text-slate-500">{user?.email || ""}</p></div><UnifiedProfileLinks user={user} onNavigate={onNavigate} /><div className="border-t border-slate-100 px-1 pt-1"><button type="button" onClick={() => { onNavigate(); logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-3.5 w-3.5" />Sign out</button></div></div>;
}
