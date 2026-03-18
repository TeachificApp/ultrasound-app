/**
 * CaseLibrary.tsx — Echo Case Library
 *
 * Browse, search, and filter approved echo cases.
 * Authenticated users see a "My Submissions" tab with status tracking.
 * Users can submit their own cases (with HIPAA warning).
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Layout from "@/components/Layout";
import { BlurredOverlay } from "@/components/BlurredOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Search,
  Plus,
  Eye,
  ChevronRight,
  Filter,
  ImageIcon,
  PlayCircle,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  UserCheck,
  Link2,
  TrendingUp,
  ArrowUpDown,
  Lock,
  LogIn,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatViewCount, getDisplayViewCount } from "@/lib/caseViewCount";
import CaseLibraryBanner from "@/components/CaseLibraryBanner";

const MODALITY_COLORS: Record<string, string> = {
  TTE: "bg-blue-100 text-blue-700",
  TEE: "bg-purple-100 text-purple-700",
  Stress: "bg-orange-100 text-orange-700",
  Pediatric: "bg-pink-100 text-pink-700",
  Fetal: "bg-rose-100 text-rose-700",
  POCUS: "bg-teal-100 text-teal-700",
  Other: "bg-gray-100 text-gray-600",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const MODALITIES = ["All", "TTE", "TEE", "Stress", "Pediatric", "Fetal", "POCUS", "Other"];
const DIFFICULTIES = ["All", "beginner", "intermediate", "advanced"];

type TabType = "browse" | "mySubmissions";

export default function CaseLibrary() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("browse");
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "mostViewed">("newest");
  const [page, setPage] = useState(1);
  const limit = 12;

  // Browse query
  const { data, isLoading, error } = trpc.caseLibrary.listCases.useQuery(
    {
      modality: modality !== "All" ? (modality as any) : undefined,
      difficulty: difficulty !== "All" ? (difficulty as any) : undefined,
      search: search.trim() || undefined,
      sortBy,
      page,
      limit,
    },
    {}
  );

  // My Submissions query (only when authenticated and on that tab)
  const mySubmissionsQuery = trpc.caseLibrary.getUserSubmissions.useQuery(undefined, {
    enabled: isAuthenticated && activeTab === "mySubmissions",
  });

  const cases = data?.cases ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const mySubmissions = mySubmissionsQuery.data ?? [];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleModality = (val: string) => {
    setModality(val);
    setPage(1);
  };

  const handleDifficulty = (val: string) => {
    setDifficulty(val);
    setPage(1);
  };

  const handleSortBy = (val: string) => {
    setSortBy(val as "newest" | "mostViewed");
    setPage(1);
  };

  const handleViewCase = (caseId: number) => {
    if (!isAuthenticated) {
      setShowRegisterModal(true);
      return;
    }
    navigate(`/case-library/${caseId}`);
  };

  return (
    <Layout>
      {/* Full-width hero banner */}
      <CaseLibraryBanner isAuthenticated={isAuthenticated} />
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#189aa1" }}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Merriweather, serif" }}>
                Echo Case Library
              </h1>
            </div>
            <p className="text-sm text-gray-500 ml-11">
              Our Echo Case Library has image, video and non-image cases. Cases are intended to encourage critical thinking, not just in image review, but also in clinical history, clinical scenarios and outcomes.
            </p>
          </div>
          {isAuthenticated ? (
            <Link href="/case-library/submit">
              <Button style={{ background: "#189aa1" }} className="text-white gap-2">
                <Plus className="w-4 h-4" /> Submit a Case
              </Button>
            </Link>
          ) : (
            <a href="/login">
              <Button variant="outline" className="gap-2 border-[#189aa1] text-[#189aa1]">
                <Plus className="w-4 h-4" /> Sign In to Submit
              </Button>
            </a>
          )}
        </div>

        {/* Tabs (only show My Submissions when authenticated) */}
        {isAuthenticated && (
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab("browse")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "browse" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Browse Cases
            </button>
            <button
              onClick={() => setActiveTab("mySubmissions")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "mySubmissions" ? "bg-white text-[#189aa1] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              My Submissions
              {mySubmissions.filter((c: any) => c.status === "pending").length > 0 && (
                <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                  {mySubmissions.filter((c: any) => c.status === "pending").length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Browse Tab ─────────────────────────────────────────────────────── */}
        {activeTab === "browse" && (
          <BlurredOverlay type="login" featureName="Echo Case Library" disabled={authLoading || isAuthenticated}>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search cases, diagnoses, tags…"
                  value={search}
                  onChange={handleSearch}
                  className="pl-9"
                />
              </div>
              <Select value={modality} onValueChange={handleModality}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Modality" />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map((m) => (
                    <SelectItem key={m} value={m}>{m === "All" ? "All Modalities" : m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={difficulty} onValueChange={handleDifficulty}>
                <SelectTrigger className="w-full sm:w-40">
                  <Star className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === "All" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={handleSortBy}>
                <SelectTrigger className="w-full sm:w-44">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Newest First
                    </span>
                  </SelectItem>
                  <SelectItem value="mostViewed">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Most Viewed
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cases grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-gray-100 animate-pulse h-52" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Failed to load cases. Please refresh.</p>
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {search || modality !== "All" || difficulty !== "All"
                    ? "No cases match your filters."
                    : "No cases available yet. Be the first to submit one!"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cases.map((c: any) => {
                  const tags: string[] = Array.isArray(c.tags) ? c.tags : (c.tags ? JSON.parse(c.tags) : []);
                  return (
                    <div key={c.id} onClick={() => handleViewCase(c.id)} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-[#189aa1]/30 transition-all cursor-pointer group h-full flex flex-col">
                        {/* Media preview indicator */}
                        {c.mediaCount > 0 && (
                          <div className="flex items-center gap-1.5 mb-3">
                            {c.hasVideo ? (
                              <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                                <PlayCircle className="w-3 h-3" /> Video
                              </span>
                            ) : null}
                            {c.imageCount > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                                <ImageIcon className="w-3 h-3" /> {c.imageCount} Image{c.imageCount !== 1 ? "s" : ""}
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MODALITY_COLORS[c.modality] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.modality}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[c.difficulty] ?? ""}`}>
                            {c.difficulty}
                          </span>
                        </div>

                        <h3 className="font-bold text-gray-800 text-sm leading-snug mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                          {c.title}
                        </h3>

                        <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1 line-clamp-3">
                          {c.summary}
                        </p>

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                #{tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-xs text-gray-400">+{tags.length - 3}</span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Eye className="w-3 h-3" />
                            {formatViewCount(getDisplayViewCount(c.id, c.viewCount ?? 0, c.submittedAt))} views
                          </div>
                          <div className="flex items-center gap-1 text-xs font-semibold text-[#189aa1] group-hover:gap-2 transition-all">
                            View Case <ChevronRight className="w-3 h-3" />
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center text-sm text-gray-500 px-3">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
             )}
          </BlurredOverlay>
        )}
        {/* ── My Submissions Tab ─────────────────────────────────────────────── */}
        {activeTab === "mySubmissions" && (
          <div>
            {/* Summary stats */}
            {mySubmissions.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(["pending", "approved", "rejected"] as const).map((status) => {
                  const count = mySubmissions.filter((c: any) => c.status === status).length;
                  const Icon = STATUS_ICONS[status];
                  return (
                    <div key={status} className={`rounded-xl border p-3 flex items-center gap-3 ${STATUS_COLORS[status]}`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <div className="text-lg font-bold leading-none">{count}</div>
                        <div className="text-xs capitalize mt-0.5">{status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mySubmissionsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : mySubmissions.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No submissions yet</p>
                <p className="text-sm text-gray-400 mt-1">Share your clinical knowledge with the community.</p>
                <Link href="/case-library/submit">
                  <Button className="mt-4 text-white gap-2" style={{ background: "#189aa1" }}>
                    <Plus className="w-4 h-4" /> Submit Your First Case
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {mySubmissions.map((c: any) => {
                  const StatusIcon = STATUS_ICONS[c.status] ?? Clock;
                  const tags: string[] = Array.isArray(c.tags) ? c.tags : (c.tags ? JSON.parse(c.tags) : []);
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-[#189aa1]/30 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-gray-800 text-sm leading-snug">{c.title}</h3>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status] ?? ""}`}>
                              <StatusIcon className="w-3 h-3" />
                              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{c.summary}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${MODALITY_COLORS[c.modality] ?? "bg-gray-100 text-gray-600"}`}>
                              {c.modality}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[c.difficulty] ?? ""}`}>
                              {c.difficulty}
                            </span>
                            <span>Submitted {formatDistanceToNow(new Date(c.submittedAt), { addSuffix: true })}</span>
                            {tags.slice(0, 2).map((t: string) => (
                              <span key={t} className="text-gray-400">#{t}</span>
                            ))}
                          </div>
                          {/* Credit attribution display */}
                          {(c.submitterCreditName || c.submitterLinkedIn) && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <UserCheck className="w-3.5 h-3.5 text-[#189aa1] flex-shrink-0" />
                              {c.submitterCreditName && (
                                <span className="text-xs text-gray-600 font-medium">{c.submitterCreditName}</span>
                              )}
                              {c.submitterLinkedIn && (
                                <a
                                  href={c.submitterLinkedIn}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#189aa1] hover:underline flex items-center gap-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Link2 className="w-3 h-3" /> LinkedIn
                                </a>
                              )}
                            </div>
                          )}
                          {c.status === "rejected" && c.rejectionReason && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 border border-red-100">
                              <span className="font-semibold">Rejection reason: </span>{c.rejectionReason}
                            </div>
                          )}
                          {c.status === "rejected" && (
                            <Link href={`/case-library/edit/${c.id}`}>
                              <button className="mt-2 text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: "#189aa1" }}>
                                <RefreshCw className="w-3 h-3" /> Edit &amp; Resubmit
                              </button>
                            </Link>
                          )}
                          {c.status === "approved" && (
                            <Link href={`/case-library/${c.id}`}>
                              <button className="mt-2 text-xs text-[#189aa1] font-semibold flex items-center gap-1 hover:underline">
                                View Published Case <ChevronRight className="w-3 h-3" />
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Registration gate modal for unauthenticated users */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 sm:items-center sm:pt-0"
          style={{ background: "rgba(14, 30, 46, 0.85)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowRegisterModal(false)}
        >
          <div
            className="rounded-2xl border shadow-2xl px-8 py-8 text-center max-w-md w-full"
            style={{ background: "rgba(14, 30, 46, 0.97)", borderColor: "#4ad9e040" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #0e4a50, #189aa1)" }}
            >
              <Lock className="w-7 h-7 text-white" />
            </div>
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3 text-xs font-semibold"
              style={{ background: "#189aa125", color: "#4ad9e0", border: "1px solid #4ad9e030" }}
            >
              <LogIn className="w-3 h-3" />
              Sign In Required
            </div>
            <h2 className="font-bold text-white text-xl mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              Sign In to View Cases
            </h2>
            <p className="text-white/60 text-sm mb-5 leading-relaxed">
              Create a free account to access the Echo Case Library. Free members can view cases and submit their own. Upgrade to Premium for the full clinical suite.
            </p>
            <div className="flex flex-col gap-2">
              <a href={getLoginUrl()} className="block">
                <button
                  className="w-full font-semibold text-white py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #189aa1, #0e7490)" }}
                >
                  <LogIn className="w-4 h-4" />
                  Sign In or Create Free Account
                </button>
              </a>
              <button
                className="w-full text-white/50 text-sm py-2 hover:text-white/70 transition-colors"
                onClick={() => setShowRegisterModal(false)}
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
