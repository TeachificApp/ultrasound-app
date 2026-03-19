/*
  UltrasoundAssist™ — Registry Review Hub
  Displays All About Ultrasound™ Registry Review courses pulled from the live
  Thinkific catalog cache.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Star, Clock, Info, GraduationCap, Award } from "lucide-react";

const BRAND = "#189aa1";
const BRAND_LIGHT = "#f0fbfc";
const BRAND_BORDER = "#b2e8eb";

interface RegistryCourse {
  id: string;
  title: string;
  description: string;
  image: string;
  price: string;
  category: string;
  enrollUrl: string;
  courseUrl: string;
  isFeatured?: boolean;
  isBundle?: boolean;
  isFree?: boolean;
  thinkificCourseId?: number | null;
}

function buildCheckoutUrl(enrollUrl: string, email?: string | null): string {
  if (!email) return enrollUrl;
  const sep = enrollUrl.includes("?") ? "&" : "?";
  return `${enrollUrl}${sep}prefill_email=${encodeURIComponent(email)}`;
}

function mapLiveCourse(c: {
  thinkificProductId: number;
  thinkificCourseId?: number | null;
  name: string;
  description: string | null;
  price: string;
  cardImageUrl: string | null;
  enrollUrl: string;
  courseUrl: string;
  hasCertificate: boolean;
}): RegistryCourse {
  const isFree = parseFloat(c.price) === 0;
  const isBundle =
    c.name.toLowerCase().includes("membership") ||
    c.name.toLowerCase().includes("bundle");

  let category = "Registry Review";
  if (/echo|cardiac|doppler|diastol|stenosis|pericarditis|valve/i.test(c.name)) category = "Cardiac";
  else if (/vascular|duplex|venous|arterial/i.test(c.name)) category = "Vascular";
  else if (/fetal/i.test(c.name)) category = "Fetal";
  else if (/physics|spi/i.test(c.name)) category = "Physics";
  else if (/abdominal|abdomen/i.test(c.name)) category = "Abdominal";
  else if (/obstetric|ob|gyn|pelvic/i.test(c.name)) category = "OB/Gyn";
  else if (/small parts|thyroid|breast|scrotum/i.test(c.name)) category = "Small Parts";
  else if (/msk|musculoskeletal/i.test(c.name)) category = "MSK";
  else if (/pocus/i.test(c.name)) category = "POCUS";
  else if (/bundle|membership|pass/i.test(c.name)) category = "Bundle";

  const priceNum = parseFloat(c.price);
  return {
    id: `live-${c.thinkificProductId}`,
    title: c.name,
    description: c.description ?? "",
    image:
      c.cardImageUrl ??
      "https://import.cdn.thinkific.com/109594/bBfoeeNT6Sky2NMI5wIg_Ultrasound%20Fundamenta%3Bs.png",
    price: isFree ? "Free" : `$${priceNum.toFixed(2)}`,
    category,
    enrollUrl: c.enrollUrl,
    courseUrl: c.courseUrl,
    isFeatured: isBundle,
    isBundle,
    isFree,
    thinkificCourseId: c.thinkificCourseId,
  };
}

export default function RegistryReviewHub() {
  const { user } = useAuth();
  const { data: liveCatalog, isLoading, isError } =
    trpc.cmeCatalog.getRegistryCatalog.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    });

  const { data: enrolledCourseIds } = trpc.cmeCatalog.getMyEnrollments.useQuery(
    undefined,
    { enabled: !!user, staleTime: 2 * 60 * 1000, retry: 1 }
  );
  const enrolledSet = new Set(enrolledCourseIds ?? []);

  const allCourses: RegistryCourse[] =
    liveCatalog && liveCatalog.length > 0 ? liveCatalog.map(mapLiveCourse) : [];

  const featured = allCourses.find((c) => c.isFeatured);
  const regular = allCourses.filter((c) => !c.isFeatured);

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
              All About Ultrasound™ — Registry Review Courses
            </p>
            <p className="text-white/70 text-sm leading-relaxed max-w-lg">
              Prepare for your registry exams with comprehensive review courses and test & learn quizzes from All About Ultrasound™. Click "Learn More" to view course details or "Enroll" to register directly on Thinkific.
            </p>

          </div>
        </div>
      </div>

      <div className="container py-8">
        {isError && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Some courses may be temporarily unavailable. Please refresh to retry.</span>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#189aa1]/10 animate-pulse"
              >
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

        {/* Featured Bundle */}
        {!isLoading && featured && (
          <div className="mb-8">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0e1e2e, #0e4a50)" }}
            >
              <div className="flex flex-col md:flex-row">
                <div className="md:w-72 h-48 md:h-auto overflow-hidden flex-shrink-0">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                      Best Value
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#189aa1]/30 text-[#4ad9e0]">
                      Bundle
                    </span>
                  </div>
                  <h2
                    className="text-xl md:text-2xl font-bold text-white mb-2"
                    style={{ fontFamily: "Merriweather, serif" }}
                  >
                    {featured.title}
                  </h2>
                  <p className="text-white/70 text-sm leading-relaxed mb-4 max-w-lg">
                    {featured.description}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-black text-white">{featured.price}</span>
                    <a
                      href={featured.courseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-all"
                    >
                      Learn More <Info className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={buildCheckoutUrl(featured.enrollUrl, user?.email)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{
                        background:
                          featured.thinkificCourseId && enrolledSet.has(featured.thinkificCourseId)
                            ? "#059669"
                            : BRAND,
                      }}
                    >
                      {featured.thinkificCourseId && enrolledSet.has(featured.thinkificCourseId) ? (
                        "Continue Learning"
                      ) : (
                        <>Enroll Now <ExternalLink className="w-3.5 h-3.5" /></>
                      )}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Course Grid */}
        {!isLoading && regular.length > 0 && (
          <>
            <h2
              className="text-lg font-bold text-gray-800 mb-4"
              style={{ fontFamily: "Merriweather, serif" }}
            >
              Registry Review Courses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {regular.map((course) => (
                <div
                  key={course.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#189aa1]/10 hover:shadow-md hover:border-[#189aa1]/30 transition-all flex flex-col"
                >
                  <div className="relative h-40 overflow-hidden bg-[#0e1e2e] flex-shrink-0">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-full object-cover opacity-90"
                    />
                    {course.isFree && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white">
                          FREE
                        </span>
                      </div>
                    )}

                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3
                      className="font-bold text-gray-800 text-sm leading-snug mb-2"
                      style={{ fontFamily: "Merriweather, serif" }}
                    >
                      {course.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-3">
                      {course.description.length > 120
                        ? course.description.substring(0, 117) + "..."
                        : course.description}
                    </p>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-base font-black ${
                            course.isFree ? "text-green-600" : "text-gray-800"
                          }`}
                        >
                          {course.price}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={course.courseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg border transition-all hover:bg-[#f0fbfc]"
                          style={{ borderColor: BRAND, color: BRAND }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Learn More <Info className="w-3 h-3" />
                        </a>
                        <a
                          href={buildCheckoutUrl(course.enrollUrl, user?.email)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg text-white transition-all hover:opacity-90"
                          style={{
                            background:
                              course.thinkificCourseId && enrolledSet.has(course.thinkificCourseId)
                                ? "#059669"
                                : BRAND,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {course.thinkificCourseId && enrolledSet.has(course.thinkificCourseId) ? (
                            "Continue Learning"
                          ) : (
                            <>Enroll <ExternalLink className="w-3 h-3" /></>
                          )}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!isLoading && regular.length === 0 && !featured && (
          <div className="text-center py-16 text-gray-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No registry review courses found in this category.</p>
          </div>
        )}

        {/* Footer note */}
        <div
          className="mt-10 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-3"
          style={{ background: BRAND_LIGHT, borderColor: BRAND_BORDER }}
        >
          <Clock className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs text-gray-600 leading-relaxed">
            All courses are from <strong>All About Ultrasound™</strong>. "Learn More" opens the course details page; "Enroll" takes you directly to the Thinkific checkout page.
          </p>
          <a
            href="https://member.allaboutultrasound.com/collections/registry-review"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#189aa1] hover:underline"
          >
            View all on site <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Layout>
  );
}
