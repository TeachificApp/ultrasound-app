/**
 * CertificatePreviewBlock.tsx
 *
 * Learner-facing block that shows the course certificate available for preview
 * and download. Rendered inside a lesson page when the block type is
 * "lesson_certificate".
 *
 * Block data fields:
 *   heading         — heading shown above the preview
 *   subtext         — sub-text shown below the heading
 *   lockedMessage   — message when certificate not yet earned
 *   bgColor         — background colour of the block wrapper
 *   requireQuizPass — boolean: gate behind a quiz pass
 *   gateQuizLessonId — number: the lesson whose quiz must be passed
 *   quizNotPassedMessage — message shown when quiz gate is not met
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Award, Download, Lock, ExternalLink, Loader2, ClipboardCheck } from "lucide-react";

export interface CertificatePreviewBlockData {
  heading?: string;
  subtext?: string;
  lockedMessage?: string;
  bgColor?: string;
  /** When true, the certificate is only shown after the gateQuizLessonId quiz is passed */
  requireQuizPass?: boolean;
  /** Lesson ID whose quiz must be passed before the certificate is shown */
  gateQuizLessonId?: number;
  /** Message shown when the quiz gate is not yet met */
  quizNotPassedMessage?: string;
}

interface Props {
  data: CertificatePreviewBlockData;
  /** Slug of the course this lesson belongs to */
  courseSlug?: string;
  /** When true, render admin placeholder (no tRPC call) */
  isAdmin?: boolean;
}

export default function CertificatePreviewBlock({ data, courseSlug, isAdmin }: Props) {
  const [showEmbed, setShowEmbed] = useState(true);

  const heading = data.heading ?? "Your Certificate of Completion";
  const subtext = data.subtext ?? "Download and share your achievement.";
  const lockedMessage =
    data.lockedMessage ?? "Complete all required lessons to unlock your certificate.";
  const bgColor = data.bgColor ?? "#f0fafa";

  // ── Admin placeholder ──────────────────────────────────────────────────────
  if (isAdmin) {
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
        <Button size="sm" disabled className="gap-2 bg-teal-600 text-white opacity-60 cursor-not-allowed">
          <Download size={14} /> Download Certificate
        </Button>
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

// Separate component so hooks are only called in learner context
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

  // Quiz gate check (only fires when requireQuizPass is true and gateQuizLessonId is set)
  const gateEnabled = !!(data.requireQuizPass && data.gateQuizLessonId && courseSlug);
  const { data: quizStatus, isLoading: quizLoading } = trpc.lmsLearner.getLessonQuizPassStatus.useQuery(
    { lessonId: data.gateQuizLessonId ?? 0, courseSlug: courseSlug ?? "" },
    { enabled: gateEnabled }
  );

  // Certificate fetch
  const { data: cert, isLoading: certLoading } = trpc.lmsLearner.getCourseCertificate.useQuery(
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
              Best score: {quizStatus.score ?? 0}% &mdash; {quizStatus.attempts} attempt{quizStatus.attempts !== 1 ? "s" : ""}
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
      className="rounded-2xl border border-teal-200 p-6 flex flex-col items-center gap-4"
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

      {/* PDF embed toggle */}
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

      {/* Action buttons */}
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
    </div>
  );
}
