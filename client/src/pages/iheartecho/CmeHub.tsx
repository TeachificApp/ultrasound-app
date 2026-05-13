/*
  iHeartEcho™ — CME & E-Learning Courses
  Displays All About Ultrasound CME courses from the E-Learning & CME collection on Thinkific.
  Course data is fetched live from the Thinkific API via tRPC (cached, refreshed every 6 hours).
  Static fallback data is used if the API is unavailable.
  Checkout links are prefilled with the logged-in user's email for fast checkout.
  Brand: Teal #189aa1, Aqua #4ad9e0
*/
import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { GraduationCap, ExternalLink, Star, BookOpen, Clock, Info } from "lucide-react";
import { parseCreditHoursFromName } from "@/lib/cmeUtils";

const BRAND = "#189aa1";

// ─── Static Fallback Data ─────────────────────────────────────────────────────
// Used when the Thinkific API is unavailable. Keep in sync with live data.

interface CmeCourse {
  id: string;
  title: string;
  description: string;
  image: string;
  price: string;
  credits: string;
  creditType: string;
  category: string;
  enrollUrl: string;
  /** Thinkific product page URL for "Learn More" */
  courseUrl: string;
  isFeatured?: boolean;
  isBundle?: boolean;
  isFree?: boolean;
  /** Thinkific course ID — used to match enrollment records */
  thinkificCourseId?: number | null;
}

const STATIC_CME_COURSES: CmeCourse[] = [
  // --- Featured Bundle ---
  {
    id: "cme-membership",
    title: "CME Membership Bundle",
    description: "Unlimited access for 1 year to all available CME courses. New courses added monthly. Credits backed by SDMS.",
    image: "https://files.cdn.thinkific.com/bundles/bundle_card_image_000/327/490/1765206872.original.png",
    price: "$69.97/yr",
    credits: "All CME",
    creditType: "SDMS",
    category: "Bundle",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3612790",
    courseUrl: "https://member.allaboutultrasound.com/products/cme-membership",
    isFeatured: true,
    isBundle: true,
  },
  // --- Individual Courses ---
  {
    id: "sonographer-ergonomics",
    title: "Sonographer Ergonomics",
    description: "Learn correct techniques for performing ultrasound exams with ergonomic approaches to avoid work-related musculoskeletal disorders.",
    image: "https://import.cdn.thinkific.com/109594/mtuwE4AFQQkjy7wK7omQ_2.png",
    price: "Free",
    credits: "1",
    creditType: "SDMS CME",
    category: "Ergonomics",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/617498",
    courseUrl: "https://member.allaboutultrasound.com/products/sonographer-ergonomics-1-sdms-cme",
    isFree: true,
  },
  {
    id: "doppler-hemodynamics",
    title: "Mastering Doppler & Hemodynamics",
    description: "Reviews fundamental Doppler principles, hemodynamics, and flow physiology. Learn proper techniques and pitfalls to avoid.",
    image: "https://import.cdn.thinkific.com/109594/ZUOzJ8DJRQDpYUiM2G2i_Course%20Images_Doppler%201%20CME.png",
    price: "$24.97",
    credits: "1",
    creditType: "SDMS CME",
    category: "Adult Echo",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/603157",
    courseUrl: "https://member.allaboutultrasound.com/products/doppler-hemodynamics-cme",
  },
  {
    id: "upper-extremity-duplex",
    title: "Mastering Upper Extremity Duplex",
    description: "Learn correct techniques for performing and interpreting upper extremity venous & arterial duplex exams, including hemodialysis access testing.",
    image: "https://import.cdn.thinkific.com/109594/6zYIBjSVuJJ3uslgslQw_3.png",
    price: "$29.97",
    credits: "2.5",
    creditType: "SDMS CME",
    category: "Vascular",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3512551",
    courseUrl: "https://member.allaboutultrasound.com/products/all-about-upper-extremity-duplex-sdms-cme",
  },
  {
    id: "venous-insufficiency",
    title: "Mastering Venous Insufficiency",
    description: "Approved for 2 SDMS CME Credit Hours. Easy-to-follow audio format covering venous insufficiency exams, venous ablation, and EVLT techniques.",
    image: "https://import.cdn.thinkific.com/109594/R7AgLJ2NTQKFQUGNHLeQ_4.png",
    price: "$29.97",
    credits: "2",
    creditType: "SDMS CME",
    category: "Vascular",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3512552",
    courseUrl: "https://member.allaboutultrasound.com/products/all-about-venous-insufficiency-sdms-cme",
  },
  {
    id: "lv-diastology",
    title: "Mastering LV Diastology",
    description: "Approved for 2 SDMS CME Credit Hours. Correct techniques for evaluating left ventricular diastolic function by echocardiography.",
    image: "https://import.cdn.thinkific.com/109594/52PsIdGQVSIvXcw2WvAm_6.png",
    price: "$29.97",
    credits: "2",
    creditType: "SDMS CME",
    category: "Adult Echo",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3512545",
    courseUrl: "https://member.allaboutultrasound.com/products/all-about-left-ventricular-diastology-sdms-cme",
  },
  {
    id: "aortic-stenosis",
    title: "All About Aortic Stenosis",
    description: "Learn and review correct techniques for performing and interpreting echocardiography imaging and Doppler ultrasound of aortic stenosis.",
    image: "https://import.cdn.thinkific.com/109594/4nGAZaibQS6AAhRfvt5b_5.png",
    price: "$29.97",
    credits: "2",
    creditType: "SDMS CME",
    category: "Adult Echo",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3512549",
    courseUrl: "https://member.allaboutultrasound.com/products/all-about-aortic-stenosis-sdms-cme",
  },
  {
    id: "determining-situs",
    title: "Determining Situs in Fetal Echo",
    description: "Learn correct techniques for performing fetal echo and determining situs. Includes free preview.",
    image: "https://import.cdn.thinkific.com/109594/suRpX5sfTEyZDZ7xCDez_BANNER_Square_Fetal%20Echo1.png",
    price: "$29.97",
    credits: "2",
    creditType: "SDMS CME",
    category: "Fetal Echo",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3510863",
    courseUrl: "https://member.allaboutultrasound.com/products/determining-situs-cme",
  },
  {
    id: "constrictive-pericarditis",
    title: "All About Constrictive Pericarditis",
    description: "Learn correct techniques for evaluating constrictive pericarditis by echocardiography, including scanning techniques and protocols.",
    image: "https://cdn.thinkific.com/courses/course_card_image_000/633/6211643261183.original.png",
    price: "$29.97",
    credits: "2",
    creditType: "SDMS CME",
    category: "Adult Echo",
    enrollUrl: "https://member.allaboutultrasound.com/order?ct=ce76d1e8-7fa8-4e7a-92b0-97c07287581e",
    courseUrl: "https://member.allaboutultrasound.com/products/all-about-constrictive-pericarditis-echo-cme",
  },
  {
    id: "ultrasound-fundamentals",
    title: "Fundamentals of Ultrasound Imaging",
    description: "A confidence-building starter for new and cross-training sonographers. Build a rock-solid foundation in ultrasound physics and image optimization.",
    image: "https://import.cdn.thinkific.com/109594/bBfoeeNT6Sky2NMI5wIg_Ultrasound%20Fundamenta%3Bs.png",
    price: "$299.97",
    credits: "Course",
    creditType: "Fundamentals",
    category: "Foundations",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3584663",
    courseUrl: "https://member.allaboutultrasound.com/products/ultrasound101-fundamentals",
  },
  {
    id: "fetal-echo-fundamentals",
    title: "Fetal Echo Fundamentals",
    description: "Learn how to obtain, optimize, and interpret the core fetal echocardiography views used in routine screening and targeted exams.",
    image: "https://import.cdn.thinkific.com/109594/M32SKPpRKe2gHTFHjZig_Fetal%20Echo.png",
    price: "$299.97",
    credits: "Course",
    creditType: "Fundamentals",
    category: "Fetal Echo",
    enrollUrl: "https://member.allaboutultrasound.com/enroll/3523147",
    courseUrl: "https://member.allaboutultrasound.com/products/fetal-echo-fundamentals",
  },
];

const CATEGORIES = ["All", "Bundle", "Adult Echo", "Vascular", "Fetal Echo", "Foundations", "Ergonomics"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCheckoutUrl(enrollUrl: string, email?: string | null): string {
  if (!email) return enrollUrl;
  const separator = enrollUrl.includes("?") ? "&" : "?";
  return `${enrollUrl}${separator}prefill_email=${encodeURIComponent(email)}`;
}

/** Map a live catalog course to the local CmeCourse shape */
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
}): CmeCourse {
  const credit = parseCreditHoursFromName(c.name);
  const isFree = parseFloat(c.price) === 0;
  const isBundle = c.name.toLowerCase().includes("membership") || c.name.toLowerCase().includes("bundle");

  // Derive category from name keywords
  let category = "E-Learning";
  if (/fetal/i.test(c.name)) category = "Fetal Echo";
  else if (/vascular|duplex|venous|arterial/i.test(c.name)) category = "Vascular";
  else if (/ergonomic/i.test(c.name)) category = "Ergonomics";
  else if (/echo|cardiac|doppler|diastol|stenosis|pericarditis/i.test(c.name)) category = "Adult Echo";
  else if (/fundamental|foundation/i.test(c.name)) category = "Foundations";
  else if (/bundle|membership/i.test(c.name)) category = "Bundle";

  const priceNum = parseFloat(c.price);
  const priceDisplay = isFree ? "Free" : `$${priceNum.toFixed(2)}`;

  return {
    id: `live-${c.thinkificProductId}`,
    title: c.name,
    description: c.description ?? "",
    image: c.cardImageUrl ?? "https://import.cdn.thinkific.com/109594/bBfoeeNT6Sky2NMI5wIg_Ultrasound%20Fundamenta%3Bs.png",
    price: priceDisplay,
    credits: credit?.hours ?? (isBundle ? "All CME" : "Course"),
    creditType: credit?.type === "SDMS" ? "SDMS CME" : (credit?.type ?? "CME"),
    category,
    enrollUrl: c.enrollUrl,
    courseUrl: c.courseUrl,
    isFeatured: isBundle,
    isBundle,
    isFree,
    thinkificCourseId: c.thinkificCourseId,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CmeHub() {
  const { user } = useAuth();

  // Fetch live courses (via DB cache)
  const { data: liveCatalog, isLoading, isError } = trpc.cmeCatalog.getCatalog.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // treat as fresh for 5 min client-side
    retry: 1,
  });

  // Fetch enrollment status for logged-in users (course IDs from Thinkific)
  const { data: enrolledCourseIds } = trpc.cmeCatalog.getMyEnrollments.useQuery(undefined, {
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const enrolledSet = new Set(enrolledCourseIds ?? []);

  // Use live data when available, fall back to static
  const allCourses: CmeCourse[] = (liveCatalog && liveCatalog.length > 0)
    ? liveCatalog.map(mapLiveCourse)
    : STATIC_CME_COURSES;

  const featured = allCourses.find(c => c.isFeatured);
  const regular = allCourses.filter(c => !c.isFeatured);

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
              <GraduationCap className="w-3.5 h-3.5 text-[#4ad9e0]" />
              <span className="text-xs text-white/80 font-medium">SDMS-Accredited CME Courses</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2" style={{ fontFamily: "Merriweather, serif" }}>
              CME &amp; E-Learning Courses
            </h1>
            <p className="text-[#4ad9e0] font-semibold text-base mb-3">All About Ultrasound — E-Learning & CME</p>
            <p className="text-white/70 text-sm leading-relaxed max-w-lg">
              Browse accredited continuing medical education courses from All About Ultrasound. Click "Learn More" to view course details or "Enroll" to go directly to checkout — your email is pre-filled.
            </p>
            {user && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-white/80">Signed in as <span className="text-white font-medium">{user.email}</span> — checkout links are pre-filled</span>
              </div>
            )}
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
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#189aa1]/10 animate-pulse">
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

        {/* Featured Bundle — shown when "All" or "Bundle" selected */}
        {!isLoading && featured && (
          <div className="mb-8">
            <div
              className="block rounded-2xl overflow-hidden"
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
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Best Value</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#189aa1]/30 text-[#4ad9e0]">Bundle</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                    {featured.title}
                  </h2>
                  <p className="text-white/70 text-sm leading-relaxed mb-4 max-w-lg">{featured.description}</p>
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
                      style={{ background: featured.thinkificCourseId && enrolledSet.has(featured.thinkificCourseId) ? "#059669" : BRAND }}
                    >
                      {featured.thinkificCourseId && enrolledSet.has(featured.thinkificCourseId)
                        ? "Continue Learning"
                        : <>Enroll Now <ExternalLink className="w-3.5 h-3.5" /></>}
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
            <h2 className="text-lg font-bold text-gray-800 mb-4" style={{ fontFamily: "Merriweather, serif" }}>
              Individual Courses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {regular.map(course => (
                <div
                  key={course.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#189aa1]/10 hover:shadow-md hover:border-[#189aa1]/30 transition-all flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="relative h-40 overflow-hidden bg-[#0e1e2e] flex-shrink-0">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-full object-cover opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-300"
                    />
                    {/* Credit badge */}
                    <div className="absolute top-2 right-2">
                      {course.isFree ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white">FREE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#189aa1] text-white">
                          {course.credits} {course.creditType}
                        </span>
                      )}
                    </div>
                    {/* Category tag */}
                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white/90">
                        {course.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-800 text-sm leading-snug mb-2" style={{ fontFamily: "Merriweather, serif" }}>
                      {course.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-3">
                      {course.description.length > 120 ? course.description.substring(0, 117) + "..." : course.description}
                    </p>

                    {/* Footer — price + two action buttons */}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-base font-black ${course.isFree ? "text-green-600" : "text-gray-800"}`}>
                          {course.price}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {/* Learn More */}
                        <a
                          href={course.courseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg border transition-all hover:bg-[#f0fbfc]"
                          style={{ borderColor: BRAND, color: BRAND }}
                          onClick={e => e.stopPropagation()}
                        >
                          Learn More <Info className="w-3 h-3" />
                        </a>
                        {/* Enroll / Continue Learning */}
                        <a
                          href={buildCheckoutUrl(course.enrollUrl, user?.email)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-2 rounded-lg text-white transition-all hover:opacity-90"
                          style={{ background: course.thinkificCourseId && enrolledSet.has(course.thinkificCourseId) ? "#059669" : BRAND }}
                          onClick={e => e.stopPropagation()}
                        >
                          {course.thinkificCourseId && enrolledSet.has(course.thinkificCourseId)
                            ? "Continue Learning"
                            : <>Enroll <ExternalLink className="w-3 h-3" /></>}
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
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No courses in this category.</p>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-10 p-4 rounded-xl bg-[#f0fbfc] border border-[#189aa1]/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Clock className="w-4 h-4 text-[#189aa1] flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs text-gray-600 leading-relaxed">
            All courses are from <strong>All About Ultrasound</strong>. "Learn More" opens the course details page; "Enroll" opens the checkout page
            {user?.email ? ` with your email (${user.email}) pre-filled` : " — log in to iHeartEcho™ to have your email pre-filled automatically"}.
            SDMS CME credits are awarded upon course completion and post-test.
          </p>
          <a
            href="https://member.allaboutultrasound.com/collections/cme"
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
