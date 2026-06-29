/**
 * Registry Review Hub — All About Ultrasound™
 * Displays Registry Review courses from the native LMS collection (ID 60001).
 * Brand: Teal #189aa1, Aqua #4ad9e0
 */
import { useState } from "react";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Award, BookOpen, Search, Play, GraduationCap, Star } from "lucide-react";
import { LEARN_APP_URL } from "@/hooks/useSubdomain";

const REGISTRY_COLLECTION_ID = 60001;
const BRAND = "#189aa1";
const BRAND_BORDER = "#b2e8eb";
const EDUCATION_LIBRARY_URL = `${LEARN_APP_URL}/education-library`;

function buildCourseLandingUrl(slug: string): string {
  return `${LEARN_APP_URL}/courses/${slug}`;
}

function formatPrice(price: number | string | null | undefined, isFree: boolean | number | null): string {
  if (isFree) return "Free";
  const num = Number(price ?? 0);
  if (num === 0) return "Free";
  return `$${num.toFixed(2)}`;
}

function getCategory(title: string): string {
  if (/echo|cardiac|doppler|diastol|stenosis|pericarditis|valve/i.test(title)) return "Cardiac";
  if (/vascular|duplex|venous|arterial/i.test(title)) return "Vascular";
  if (/fetal/i.test(title)) return "Fetal";
  if (/physics|spi/i.test(title)) return "Physics";
  if (/abdominal|abdomen/i.test(title)) return "Abdominal";
  if (/obstetric|ob|gyn|pelvic/i.test(title)) return "OB/Gyn";
  if (/small parts|thyroid|breast|scrotum/i.test(title)) return "Small Parts";
  if (/msk|musculoskeletal/i.test(title)) return "MSK";
  if (/pocus/i.test(title)) return "POCUS";
  if (/bundle|membership|pass/i.test(title)) return "Bundle";
  return "Registry Review";
}

const CATEGORY_COLORS: Record<string, string> = {
  Cardiac: "#e11d48",
  Vascular: "#0369a1",
  Fetal: "#7c3aed",
  Physics: "#d97706",
  Abdominal: "#059669",
  "OB/Gyn": "#db2777",
  "Small Parts": "#64748b",
  MSK: "#92400e",
  POCUS: "#0891b2",
  Bundle: "#189aa1",
  "Registry Review": "#189aa1",
};

const ALL_CATEGORIES = ["All", "Cardiac", "Vascular", "Fetal", "Physics", "Abdominal", "OB/Gyn", "Small Parts", "MSK", "POCUS", "Bundle", "Registry Review"];

export default function RegistryReviewHub() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: collection, isLoading } = trpc.lms.getCollection.useQuery(
    { id: REGISTRY_COLLECTION_ID },
    { staleTime: 5 * 60 * 1000 }
  );

  const items = (collection?.courses ?? []).filter((item: any) => item !== null);

  const filtered = items.filter((item: any) => {
    const title: string = item.title ?? "";
    const matchesSearch = !search || title.toLowerCase().includes(search.toLowerCase());
    const category = getCategory(title);
    const matchesCategory = activeCategory === "All" || category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Separate bundles/featured from regular courses
  const featured = filtered.filter((item: any) =>
    /bundle|membership|pass/i.test(item.title ?? "")
  );
  const regular = filtered.filter((item: any) =>
    !/bundle|membership|pass/i.test(item.title ?? "")
  );

  // Get categories that actually have courses
  const presentCategories = ["All", ...Array.from(new Set(items.map((item: any) => getCategory(item.title ?? ""))))];

  return (
    <Layout>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #0e4a50 60%, #189aa1 100%)" }}
      >
        <div className="relative container py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <Award className="w-3.5 h-3.5 text-[#4ad9e0]" />
              <span className="text-xs text-white/80 font-medium">Registry Exam Preparation</span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-black text-white leading-tight mb-2"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Registry Review
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">
              All About Ultrasound™ — Registry Review Resources
            </p>
            <p className="text-white/70 text-sm leading-relaxed max-w-lg mb-5">
              Prepare for your registry exams with comprehensive review courses and test &amp; learn quizzes from All About Ultrasound™.
            </p>
            <a
              href={EDUCATION_LIBRARY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white/15 border border-white/30 text-white hover:bg-white/25 transition-all"
            >
              <BookOpen className="w-4 h-4 text-[#4ad9e0]" />
              Browse Education Library
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search registry review courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
              style={
                activeCategory === cat
                  ? { background: BRAND, color: "#fff", borderColor: BRAND }
                  : { background: "#fff", color: "#374151", borderColor: BRAND_BORDER }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Featured bundles */}
        {!isLoading && featured.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              Best Value Bundles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featured.map((item: any) => {
                const title: string = item.title ?? "";
                const slug: string | undefined = item.slug;
                const detailUrl = slug ? buildCourseLandingUrl(slug) : EDUCATION_LIBRARY_URL;
                const priceStr = formatPrice(item.price, item.isFree);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl overflow-hidden flex flex-col sm:flex-row border"
                    style={{ borderColor: BRAND_BORDER, background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
                  >
                    {item.coverImageUrl && (
                      <img
                        src={item.coverImageUrl}
                        alt={title}
                        className="w-full sm:w-40 h-36 sm:h-auto object-cover opacity-80 flex-shrink-0"
                      />
                    )}
                    <div className="p-5 flex flex-col justify-center flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Best Value</span>
                      </div>
                      <h3 className="font-bold text-white text-sm leading-snug mb-3" style={{ fontFamily: "Merriweather, serif" }}>
                        {title}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-white">{priceStr}</span>
                        <a
                          href={detailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                          style={{ background: BRAND }}
                        >
                          <Play className="w-3 h-3" />
                          View Course
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular course grid */}
        {!isLoading && (
          <>
            {regular.length === 0 && filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {search || activeCategory !== "All" ? "No courses match your filters." : "No registry review courses available yet."}
                </p>
              </div>
            ) : regular.length > 0 ? (
              <>
                <h2 className="text-base font-bold text-gray-700 mb-4" style={{ fontFamily: "Merriweather, serif" }}>
                  Registry Review Resources
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {regular.map((item: any) => {
                    const title: string = item.title ?? "";
                    const slug: string | undefined = item.slug;
                    const detailUrl = slug ? buildCourseLandingUrl(slug) : EDUCATION_LIBRARY_URL;
                    const priceStr = formatPrice(item.price, item.isFree);
                    const category = getCategory(title);
                    const catColor = CATEGORY_COLORS[category] ?? BRAND;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md hover:border-[#189aa1]/30 transition-all flex flex-col"
                      >
                        <a href={detailUrl} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                          {item.coverImageUrl ? (
                            <img
                              src={item.coverImageUrl}
                              alt={title}
                              className="w-full h-40 object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-40 flex items-center justify-center"
                              style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                            >
                              <GraduationCap className="w-10 h-10 text-[#4ad9e0]/60" />
                            </div>
                          )}
                        </a>

                        <div className="p-4 flex flex-col flex-1">
                          {/* Category badge */}
                          <div className="flex items-center gap-1.5 mb-2">
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: catColor + "18", color: catColor }}
                            >
                              {category}
                            </span>
                            {item.isFree && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                FREE
                              </span>
                            )}
                          </div>

                          <a
                            href={detailUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-900 text-sm leading-snug mb-3 flex-1 hover:underline"
                            style={{ fontFamily: "Merriweather, serif" }}
                          >
                            {title}
                          </a>

                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                            <span className="text-sm font-bold" style={{ color: item.isFree ? "#059669" : "#1f2937" }}>
                              {priceStr}
                            </span>
                            <a
                              href={detailUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                              style={{ background: BRAND }}
                            >
                              <Play className="w-3 h-3" />
                              View Course
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-gray-400">
          <p>All courses are from All About Ultrasound™.</p>
          <a
            href={EDUCATION_LIBRARY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-[#189aa1] hover:underline"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Education Library <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Layout>
  );
}
