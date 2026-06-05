/**
 * Redirects legacy per-brand paths (no suffix) to the brand-tagged URL.
 * Uses hostname when no tag is present: iheartecho → `-ihe`, otherwise `-aaus`.
 */
import { useEffect } from "react";
import { withBrandTag } from "@shared/brandScopedRoutes";
import { isIHeartEchoDomain } from "@/hooks/useSubdomain";

export default function BrandPathRedirect({ basePath }: { basePath: string }) {
  useEffect(() => {
    const brand = isIHeartEchoDomain() ? "iheartecho" : "aaus";
    const target = withBrandTag(basePath, brand);
    const search = window.location.search;
    const hash = window.location.hash;
    window.location.replace(`${target}${search}${hash}`);
  }, [basePath]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );
}
