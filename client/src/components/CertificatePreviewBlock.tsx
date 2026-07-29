/**
 * CertificatePreviewBlock.tsx
 *
 * Learner-facing block that shows the course certificate available for preview
 * and download. Rendered inside a lesson page when the block type is
 * "lesson_certificate".
 *
 * Block data fields:
 *   heading              — heading shown above the preview
 *   subtext              — sub-text shown below the heading
 *   lockedMessage        — message when certificate not yet earned
 *   bgColor              — background colour of the block wrapper
 *   requireQuizPass      — boolean: gate behind a quiz pass
 *   gateQuizLessonId     — number: the lesson whose quiz must be passed
 *   quizNotPassedMessage — message shown when quiz gate is not met
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Award, Download, Lock, ExternalLink, Loader2, ClipboardCheck, Share2 } from "lucide-react";
import { toast } from "sonner";

export interface CertificatePreviewBlockData {
  heading?: string;
  subtext?: string;
  lockedMessage?: string;
  bgColor?: string;
  requireQuizPass?: boolean;
  gateQuizLessonId?: number;
  quizNotPassedMessage?: string;
}

interface Props {
  data: CertificatePreviewBlockData;
  courseSlug?: string;
  isAdmin?: boolean;
}

// ── Social share helpers ─────────────────────────────────────────────────────

function buildShareText(heading: string): string {
  return `I just earned my certificate: "${heading}"! 🎓`;
}

function shareOnLinkedIn(certUrl: string, heading: string) {
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certUrl)}&title=${encodeURIComponent(buildShareText(heading))}`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
}

function shareOnFacebook(certUrl: string) {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(certUrl)}`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
}

function shareOnX(certUrl: string, heading: string) {
  const text = buildShareText(heading);
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(certUrl)}`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
}

// ── Social share button row ──────────────────────────────────────────────────

function SocialShareRow({ certUrl, heading }: { certUrl: string; heading: string }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Share2 size={13} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-500">Share your achievement</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* LinkedIn */}
        <button
          type="button"
          onClick={() => shareOnLinkedIn(certUrl, heading)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: "#0A66C2" }}
          aria-label="Share on LinkedIn"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          LinkedIn
        </button>

        {/* Facebook */}
        <button
          type="button"
          onClick={() => shareOnFacebook(certUrl)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: "#1877F2" }}
          aria-label="Share on Facebook"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Facebook
        </button>

        {/* X / Twitter */}
        <button
          type="button"
          onClick={() => shareOnX(certUrl, heading)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: "#000000" }}
          aria-label="Share on X (Twitter)"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          X (Twitter)
        </button>

        {/* Copy link */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(certUrl).then(() => {
              toast.success("Certificate link copied to clipboard!");
            }).catch(() => {
              toast.error("Could not copy link");
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Copy certificate link"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Copy Link
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CertificatePreviewBlock({ data, courseSlug, isAdmin, hasRealEnrollment }: Props & { hasRealEnrollment?: boolean }) {
  const [showEmbed, setShowEmbed] = useState(true);

  const heading = data.heading ?? "Your Certificate of Completion";
  const subtext = data.subtext ?? "Download and share your achievement.";
  const lockedMessage =
    data.lockedMessage ?? "Complete all required lessons to unlock your certificate.";
  const bgColor = data.bgColor ?? "#f0fafa";

  // ── Admin placeholder ──────────────────────────────────────────────────────
  // Show admin placeholder only when admin has no real enrollment (pure preview mode).
  // If admin is also an enrolled learner, show their actual certificate.
  if (isAdmin && !hasRealEnrollment) {
    return (
      <div
        className="rounded-2xl border border-teal-200 p-6 flex flex-col items-center gap-4 text-center"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
          <Award className="w-7 h-7 text-teal-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-base">{heading}</p>
          <p className="text-sm text-gray-500 mt-1">{subtext}</p>
        </div>
        {data.requireQuizPass && data.gateQuizLessonId && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <ClipboardCheck size={14} />
            <span>Gated: learner must pass quiz on lesson #{data.gateQuizLessonId}</span>
          </div>
        )}
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl h-48 flex items-center justify-center text-gray-300 text-xs">
          Certificate preview will appear here for enrolled learners
        </div>
        <div className="flex flex-wrap gap-2 justify-center opacity-50 pointer-events-none">
          <Button size="sm" disabled className="gap-2 bg-teal-600 text-white">
            <Download size={14} /> Download Certificate
          </Button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#0A66C2" }}>
            <Share2 size={12} /> LinkedIn
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#1877F2" }}>
            <Share2 size={12} /> Facebook
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#000" }}>
            <Share2 size={12} /> X
          </div>
        </div>
      </div>
    );
  }

  // ── Learner view ───────────────────────────────────────────────────────────
  return (
    <CertificatePreviewLearner
      data={data}
      courseSlug={courseSlug}
      heading={heading}
      subtext={subtext}
      lockedMessage={lockedMessage}
      bgColor={bgColor}
      showEmbed={showEmbed}
      setShowEmbed={setShowEmbed}
    />
  );
}

// ── Learner sub-component (hooks only called here) ───────────────────────────

function CertificatePreviewLearner({
  data,
  courseSlug,
  heading,
  subtext,
  lockedMessage,
  bgColor,
  showEmbed,
  setShowEmbed,
}: {
  data: CertificatePreviewBlockData;
  courseSlug?: string;
  heading: string;
  subtext: string;
  lockedMessage: string;
  bgColor: string;
  showEmbed: boolean;
  setShowEmbed: (v: boolean) => void;
}) {
  const quizNotPassedMessage =
    data.quizNotPassedMessage ??
    "You must pass the required quiz before accessing your certificate.";

  const gateEnabled = !!(data.requireQuizPass && data.gateQuizLessonId && courseSlug);
  const { data: quizStatus, isLoading: quizLoading } =
    trpc.lmsLearner.getLessonQuizPassStatus.useQuery(
      { lessonId: data.gateQuizLessonId ?? 0, courseSlug: courseSlug ?? "" },
      { enabled: gateEnabled }
    );

  const { data: cert, isLoading: certLoading } =
    trpc.lmsLearner.getCourseCertificate.useQuery(
      { courseSlug: courseSlug ?? "" },
      { enabled: !!courseSlug && (!gateEnabled || quizStatus?.passed === true) }
    );

  if (!courseSlug) return null;

  const isLoading = quizLoading || certLoading;

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border border-teal-100 p-8 flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
      </div>
    );
  }

  // Quiz gate not met
  if (gateEnabled && !quizStatus?.passed) {
    return (
      <div
        className="rounded-2xl border border-amber-200 p-6 flex flex-col items-center gap-3 text-center"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <ClipboardCheck className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-700 text-base">{heading}</p>
          <p className="text-sm text-amber-700 mt-1">{quizNotPassedMessage}</p>
          {quizStatus && quizStatus.attempts > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Best score: {quizStatus.score ?? 0}% &mdash;{" "}
              {quizStatus.attempts} attempt{quizStatus.attempts !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  // No certificate issued yet
  if (!cert || !cert.certificateUrl) {
    return (
      <div
        className="rounded-2xl border border-gray-200 p-6 flex flex-col items-center gap-3 text-center"
        style={{ backgroundColor: bgColor }}
      >
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <div>
          <p className="font-semibold text-gray-700 text-base">{heading}</p>
          <p className="text-sm text-gray-400 mt-1">{lockedMessage}</p>
        </div>
      </div>
    );
  }

  const certUrl = cert.certificateUrl;

  return (
    <div
      className="rounded-2xl border border-teal-200 p-6 flex flex-col items-center gap-5"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
          <Award className="w-7 h-7 text-teal-600" />
        </div>
        <p className="font-semibold text-gray-800 text-base">{heading}</p>
        <p className="text-sm text-gray-500">{subtext}</p>
      </div>

      {/* PDF embed */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium">Certificate Preview</span>
          <button
            type="button"
            className="text-xs text-teal-600 hover:underline"
            onClick={() => setShowEmbed(!showEmbed)}
          >
            {showEmbed ? "Hide preview" : "Show preview"}
          </button>
        </div>
        {showEmbed && (
          <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
            <iframe
              src={`${certUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              title="Certificate Preview"
              className="w-full"
              style={{ height: 480, border: "none" }}
            />
          </div>
        )}
      </div>

      {/* Download / open buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <a href={certUrl} download target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
            <Download size={14} /> Download Certificate
          </Button>
        </a>
        <a href={certUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-2">
            <ExternalLink size={14} /> Open in New Tab
          </Button>
        </a>
      </div>

      {/* Social share row */}
      <SocialShareRow certUrl={certUrl} heading={heading} />
    </div>
  );
}
