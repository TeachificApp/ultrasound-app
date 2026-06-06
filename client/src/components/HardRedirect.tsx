/**
 * Hard navigation redirect — uses window.location instead of wouter Redirect.
 * Wouter Redirect renders null; inside a Suspense boundary that re-suspends,
 * the redirect effect can be dropped and the page stays blank.
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function HardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    </div>
  );
}
