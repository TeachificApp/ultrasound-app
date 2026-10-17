import { useEffect } from "react";
import { getStudentLoginToken } from "@/lib/studentLoginSession";

const MANAGED_HOST_SUFFIXES = [
  "allaboutultrasound.com",
  "allaboutultrasound.net",
  "iheartecho.com",
  "iheartecho.net",
  "ultrasoundexpo.com",
  "echocardiographyexpo.com",
];

function isManagedAppUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return MANAGED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

/**
 * Keeps a temporary student session within its browser tab when the admin follows
 * a normal link to another first-party domain. It never applies the token to a
 * third-party URL, and it leaves same-origin navigation to tab storage.
 */
export default function StudentLoginSessionBridge() {
  useEffect(() => {
    if (!getStudentLoginToken()) return;

    const preserveStudentLoginAcrossDomain = (event: MouseEvent) => {
      const element = event.target;
      const anchor = element instanceof Element ? element.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (destination.origin === window.location.origin || !isManagedAppUrl(destination)) return;

      const token = getStudentLoginToken();
      if (!token) return;
      destination.searchParams.set("student_login", token);
      anchor.href = destination.toString();
    };

    // Capture phase means menu links work without changing each page/component.
    document.addEventListener("click", preserveStudentLoginAcrossDomain, true);
    return () => document.removeEventListener("click", preserveStudentLoginAcrossDomain, true);
  }, []);

  return null;
}
