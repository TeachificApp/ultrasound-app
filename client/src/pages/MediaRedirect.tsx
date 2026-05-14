import { useEffect } from "react";
import { useParams } from "wouter";

/**
 * Client-side redirect from /media/:slug[/:action] to /api/media/:slug[/:action].
 *
 * The Manus deployment platform routes only /api/* to the Express server;
 * all other paths get the SPA fallback (index.html). This component catches
 * /media/:slug on the client side and redirects to the server-handled
 * /api/media/:slug route, preserving query parameters and sub-actions.
 */
export default function MediaRedirect() {
  const params = useParams();

  useEffect(() => {
    // Extract slug and optional action from the URL path
    const path = window.location.pathname;
    const search = window.location.search; // preserve ?token=... etc.
    
    // Replace /media/ with /api/media/ in the path
    const apiPath = path.replace(/^\/media\//, "/api/media/");
    
    // Use replace so the browser doesn't keep the /media/ URL in history
    window.location.replace(`${apiPath}${search}`);
  }, [params]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading media...</p>
      </div>
    </div>
  );
}
