import { useEffect } from "react";
import { resolveLegacyPasswordSetupPath } from "@shared/legacyPasswordSetupPath";

export default function LegacyPasswordSetupRedirect() {
  useEffect(() => {
    const target = resolveLegacyPasswordSetupPath(window.location.pathname, window.location.search, window.location.hash);
    if (!target) return;
    window.history.replaceState(null, "", target);
    window.dispatchEvent(new window.PopStateEvent("popstate"));
  }, []);
  return null;
}
