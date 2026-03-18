/**
 * DemoModeBanner
 * Persistent purple banner shown on every page when a platform admin is
 * viewing the app as a demo user. Provides one-click exit back to the
 * real admin session.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { FlaskConical, X, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function DemoModeBanner() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();

  const stopDemo = trpc.demo.stop.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Exited demo mode — back to your admin account.");
      navigate("/platform-admin");
    },
    onError: () => {
      // Even if the mutation fails, force a page reload to clear state
      window.location.href = "/platform-admin";
    },
  });

  // Only render when demoMode is active
  if (!user || !(user as any).demoMode) return null;

  const realAdminName = (user as any).realAdminName as string | null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2 text-white text-sm font-medium shadow-lg"
      style={{ background: "linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">
          <span className="font-bold">Demo Mode</span>
          {" — viewing as "}
          <span className="font-bold">
            {user.displayName ?? user.name ?? user.email ?? "Demo User"}
          </span>
          {user.credentials ? ` ${user.credentials}` : ""}
          {realAdminName ? (
            <span className="opacity-70 font-normal ml-2">
              (signed in as {realAdminName})
            </span>
          ) : null}
        </span>
      </div>
      <button
        onClick={() => stopDemo.mutate()}
        disabled={stopDemo.isPending}
        className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold disabled:opacity-60"
      >
        <LogOut className="w-3.5 h-3.5" />
        {stopDemo.isPending ? "Exiting…" : "Exit Demo"}
      </button>
    </div>
  );
}
