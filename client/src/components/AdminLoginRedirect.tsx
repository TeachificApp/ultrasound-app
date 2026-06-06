/**
 * Hard redirect to login for admin-only routes.
 * Uses window.location (not wouter Redirect) because Redirect renders null
 * and its useLayoutEffect can be dropped when a parent Suspense boundary
 * re-suspends — leaving a blank page on app.allaboutultrasound.com.
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";

export function AdminLoginRedirect({ returnPath }: { returnPath: string }) {
  useEffect(() => {
    window.location.replace(getLoginUrl(returnPath));
  }, [returnPath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#189aa1]" />
        <p className="text-sm text-muted-foreground">Redirecting to login…</p>
      </div>
    </div>
  );
}
