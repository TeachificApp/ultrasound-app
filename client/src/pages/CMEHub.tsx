/**
 * CME Hub — All About Ultrasound™
 * Displays accredited CME/CE courses from the Thinkific catalog.
 * Uses cmeCatalog.getCatalog (E-Learning & CME collection).
 * Brand: Teal #189aa1, Aqua #4ad9e0
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { ExternalLink, GraduationCap, Award, Clock, Search, BookOpen } from "lucide-react";
import { parseCreditHoursFromName } from "@/lib/cmeUtils";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#f0fbfc";
const BRAND_BORDER = "#b2e8eb";

const CREDIT_TYPE_LABELS: Record<string, string> = {
  SDMS: "SDMS CME",
  AMA_PRA_1: "AMA PRA Category 1",
  ANCC: "ANCC",
  OTHER: "CE",
};

const CREDIT_TYPE_COLORS: Record<string, string> = {
  SDMS: "#189aa1",
  AMA_PRA_1: "#7c3aed",
  ANCC: "#0369a1",
  OTHER: "#64748b",
};

export default function CMEHub() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: courses = [], isLoading } = trpc.cmeCatalog.getCatalog.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrolledCourseIds = [] } = trpc.cmeCatalog.getMyEnrollments.useQuery(
    undefined,
    { enabled: !!user, staleTime: 5 * 60 * 1000 }
  );

  const filtered = courses.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Banner */}
        <div
          className="rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{ background: "linear-gradient(135deg, #0e1e2e 0%, #189aa1 100%)" }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(74,217,224,0.15)" }}
          >
            <GraduationCap className="w-7 h-7 text-[#4ad9e0]" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              CME Hub
            </h1>
            <p className="text-sm text-[#4ad9e0]/90">
              Accredited continuing medical education from All About Ultrasound™ — SDMS CME, AMA PRA Category 1, and more.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search CME courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
          />
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
                <div className="h-32 bg-gray-100 rounded-lg mb-3" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {search ? "No courses match your search." : "No CME courses available yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => {
              const credit = parseCreditHoursFromName(course.name);
              const isEnrolled = enrolledCourseIds.includes(course.thinkificProductId);
              return (
                <div
                  key={course.thinkificProductId}
                  className="rounded-xl border bg-white overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  style={{ borderColor: BRAND_BORDER }}
                >
                  {/* Card image */}
                  {course.cardImageUrl ? (
                    <img
                      src={course.cardImageUrl}
                      alt={course.name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-32 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #0e1e2e, #189aa1)" }}
                    >
                      <GraduationCap className="w-10 h-10 text-[#4ad9e0]/60" />
                    </div>
                  )}

                  <div className="p-4 flex flex-col flex-1">
                    {/* Credit badge */}
                    {credit && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Award className="w-3.5 h-3.5" style={{ color: CREDIT_TYPE_COLORS[credit.type] }} />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: CREDIT_TYPE_COLORS[credit.type] }}
                        >
                          {credit.hours} {CREDIT_TYPE_LABELS[credit.type]} Credits
                        </span>
                      </div>
                    )}

                    <h3
                      className="font-semibold text-gray-900 text-sm leading-snug mb-1 flex-1"
                      style={{ fontFamily: "Merriweather, serif" }}
                    >
                      {course.name}
                    </h3>

                    {course.instructorNames && (
                      <p className="text-xs text-gray-400 mb-2">
                        {course.instructorNames}
                      </p>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                      <span className="text-sm font-bold text-gray-800">
                        {course.price === "0.00" || course.price === "0" ? (
                          <span style={{ color: BRAND }}>Free</span>
                        ) : (
                          `$${course.price}`
                        )}
                      </span>
                      {isEnrolled ? (
                        <a
                          href={course.courseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                          style={{ background: BRAND }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Continue
                        </a>
                      ) : (
                        <a
                          href={course.enrollUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                          style={{ borderColor: BRAND + "60", color: BRAND }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Enroll
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          All courses are hosted on Thinkific. Clicking Enroll or Continue will open the All About Ultrasound™ learning platform.
        </p>
      </div>
    </Layout>
  );
}
