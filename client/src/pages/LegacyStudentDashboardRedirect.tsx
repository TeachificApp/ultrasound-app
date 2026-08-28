import { HardRedirect } from "@/components/HardRedirect";
import { normalizeLegacyStudentDashboardLocation } from "@shared/studentDashboardUrls";

/** Redirect broken legacy dashboard paths to /my-dashboard with correct tab params. */
export default function LegacyStudentDashboardRedirect() {
  const target = normalizeLegacyStudentDashboardLocation(
    window.location.pathname,
    window.location.search,
  ) ?? "/my-dashboard?tab=content";
  return <HardRedirect to={target} />;
}
