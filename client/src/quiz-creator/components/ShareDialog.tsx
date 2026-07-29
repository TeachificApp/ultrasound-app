import { useState } from "react";
import { X, Copy, Check, Globe, GlobeLock, Code, Link2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useQuizStore } from "../store/quizStore";
import { getOrgSubdomainUrl } from "@/hooks/useSubdomain";

interface Props {
  open: boolean;
  onClose: () => void;
  quizId: number | null;
}

export function ShareDialog({ open, onClose, quizId }: Props) {
  const { quiz } = useQuizStore();
  const [copied, setCopied] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const publishMutation = trpc.quizMaker.publish.useMutation();
  const unpublishMutation = trpc.quizMaker.unpublish.useMutation();
  const utils = trpc.useUtils();

  const { data: publishStatus, refetch } = trpc.quizMaker.getPublishStatus.useQuery(
    { quizId: quizId! },
    { enabled: !!quizId }
  );

  if (!open) return null;

  const isPublished = publishStatus?.isPublished ?? false;
  const shareToken = publishStatus?.shareToken ?? null;
  const orgSlug = publishStatus?.orgSlug ?? null;

  // Build the share URL using the org's subdomain
  const buildShareUrl = (token: string, slug: string | null) => {
    if (slug) {
      return getOrgSubdomainUrl(slug, `/quiz/${token}`);
    }
    // Fallback: use current origin (for dev/preview environments)
    return `${window.location.origin}/quiz/${token}`;
  };

  const shareUrl = shareToken ? buildShareUrl(shareToken, orgSlug) : "";
  const embedCode = shareToken
    ? `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;" allow="fullscreen"></iframe>`
    : "";

  const handlePublish = async () => {
    if (!quizId) return;
    setPublishing(true);
    try {
      await publishMutation.mutateAsync({ quizId });
      await refetch();
      utils.quizMaker.listQuizzes.invalidate();
    } catch (err) {
      alert("Failed to publish: " + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!quizId) return;
    setPublishing(true);
    try {
      await unpublishMutation.mutateAsync({ quizId });
      await refetch();
      utils.quizMaker.listQuizzes.invalidate();
    } catch (err) {
      alert("Failed to unpublish: " + (err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-bold text-gray-800">Publish & Share</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Quiz info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#24abbc" }}>
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{quiz.meta.title || "Untitled Quiz"}</p>
              <p className="text-xs text-gray-500">{quiz.questions.length} questions</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isPublished ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
            }`}>
              {isPublished ? "Published" : "Draft"}
            </span>
          </div>

          {/* Publish toggle */}
          {!quizId ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <p className="font-semibold mb-1">Save to Cloud First</p>
              <p className="text-xs text-amber-600">You need to save this quiz to the cloud before you can publish it. Use File → Save to Cloud.</p>
            </div>
          ) : !isPublished ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Publishing makes your quiz accessible to anyone with the link on your school's subdomain. No login required for quiz takers.
              </p>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #24abbc, #0d8a9a)" }}
              >
                <Globe className="w-4 h-4" />
                {publishing ? "Publishing..." : "Publish Quiz"}
              </button>
            </div>
          ) : (
            <>
              {/* Share URL */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Link2 className="w-3.5 h-3.5" /> Share Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl, "link")}
                    className="shrink-0 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Copy link"
                  >
                    {copied === "link" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                </div>
                {orgSlug && (
                  <p className="text-xs text-gray-400">
                    Quiz will be served on your school's subdomain: <span className="font-mono text-teal-600">{orgSlug}.teachific.app</span>
                  </p>
                )}
              </div>

              {/* Embed Code */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Code className="w-3.5 h-3.5" /> Embed Code
                </label>
                <div className="relative">
                  <textarea
                    readOnly
                    value={embedCode}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 font-mono resize-none"
                  />
                  <button
                    onClick={() => copyToClipboard(embedCode, "embed")}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Copy embed code"
                  >
                    {copied === "embed" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Paste this HTML into any website to embed the quiz.</p>
              </div>

              {/* Visibility */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visibility</label>
                <select
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white"
                  value="published"
                  onChange={(e) => {
                    if (e.target.value === "draft") handleUnpublish();
                  }}
                >
                  <option value="published">Published — Anyone with link</option>
                  <option value="hidden">Hidden — URL only (not in directory)</option>
                  <option value="draft">Draft — Unpublish</option>
                </select>
                <p className="text-xs text-gray-400">Controls who can access this quiz.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
