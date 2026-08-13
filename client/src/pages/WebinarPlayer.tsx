/**
 * WebinarPlayer.tsx
 * Public player/watch page for a webinar (after registration).
 * Route: /webinar/:slug
 *
 * Renders the page-builder blocks stored in webinar.playerPageBlocks.
 * Falls back to a simple video player if no blocks are configured.
 * Access is gated — unregistered users are redirected to the landing page.
 */
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Lock, ArrowLeft } from "lucide-react";
import type { Block } from "@/components/BlockPreview";
import { BlockPreview } from "@/components/BlockPreview";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEmbedUrl(url: string, source: string): string {
  if (!url) return "";
  if (source === "youtube") {
    const ytMatch = url.match(/(?:[?&]v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([-\w]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    return url;
  }
  if (source === "vimeo") {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  return url;
}

// ─── Auto-layout fallback video player ───────────────────────────────────────
function AutoPlayer({ webinar }: { webinar: any }) {
  const videoUrl = webinar.videoUrl ?? webinar.replayUrl ?? "";
  const videoSource = webinar.videoSource ?? "youtube";
  const embedUrl = getEmbedUrl(videoUrl, videoSource);

  return (
    <div className="min-h-screen bg-[#0e1e2e]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">{webinar.title}</h1>
        {embedUrl ? (
          <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={webinar.title}
            />
          </div>
        ) : (
          <div className="w-full rounded-xl bg-white/10 flex items-center justify-center aspect-video">
            <div className="text-center text-white/50">
              <Video className="w-16 h-16 mx-auto mb-3" />
              <p className="text-sm">No video configured for this webinar.</p>
            </div>
          </div>
        )}
        {webinar.description && (
          <div className="mt-8 bg-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3">About This Webinar</h2>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{webinar.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebinarPlayer() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  // Fetch webinar data (public procedure — returns isRegistered)
  const { data, isLoading, error } = trpc.webinar.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug }
  );
  const webinar = data?.webinar;
  const isRegistered = data?.isRegistered ?? false;
  const isPresaleRestricted = data?.isPresaleRestricted ?? false;
  const presaleWelcome = data?.presaleWelcome;

  // Mark attended heartbeat
  const markAttended = trpc.webinarLearner.markWatchedReplay.useMutation();
  useEffect(() => {
    if (webinar && isRegistered) {
      markAttended.mutate({ webinarId: webinar.id });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinar?.id, isRegistered]);

  if (isLoading || authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  if (!webinar || error) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Webinar not found</p>
        <Button variant="link" onClick={() => navigate("/")}>Back to Home</Button>
      </div>
    );
  }

  // Access check — must be registered (or admin)
  const isAdmin = (user as any)?.role === "admin";
  if (!isAdmin && !isRegistered) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Lock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Registration Required</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">You need to register for this webinar to access the content.</p>
        <Button onClick={() => navigate(`/webinars/${slug}`)} className="bg-teal-600 hover:bg-teal-700 text-white">
          View Webinar Details
        </Button>
      </div>
    );
  }

  if (!isAdmin && isPresaleRestricted) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 text-center">
        {presaleWelcome?.mediaUrl && <img src={presaleWelcome.mediaUrl} alt="" className="mx-auto mb-6 max-h-64 rounded-xl object-cover" />}
        <h1 className="text-3xl font-bold text-slate-900">{presaleWelcome?.heading}</h1>
        <div className="mt-4 prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: presaleWelcome?.body ?? "" }} />
        {presaleWelcome?.ctaLabel && presaleWelcome?.ctaUrl && (
          <a href={presaleWelcome.ctaUrl} className="inline-flex mt-7 rounded-lg bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700">
            {presaleWelcome.ctaLabel}
          </a>
        )}
      </div>
    );
  }

  // Parse player page blocks
  let blocks: Block[] = [];
  if (webinar.playerPageBlocks) {
    try { blocks = JSON.parse(webinar.playerPageBlocks) as Block[]; } catch {}
  }

  const hasBlocks = blocks.length > 0;

  return (
    <div>
      {/* Back link */}
      <div className="bg-white border-b border-gray-100 px-4 py-2">
        <button
          onClick={() => navigate(`/webinars/${slug}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Webinar Details
        </button>
      </div>

      {hasBlocks ? (
        <div>
          {blocks.map((block) => (
            <BlockPreview key={block.id} block={block} />
          ))}
        </div>
      ) : (
        <AutoPlayer webinar={webinar} />
      )}
    </div>
  );
}
