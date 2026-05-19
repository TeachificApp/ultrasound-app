/**
 * EducationLibrary.tsx
 * Public-facing course catalog for All About Ultrasound™ & iHeartEcho
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Download, HelpCircle, Search, Star, Users, CheckCircle } from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  download: <Download className="w-4 h-4" />,
};

const BRAND_LABELS: Record<string, string> = {
  aaus: "All About Ultrasound",
  iheartecho: "iHeartEcho™",
};

function CourseCard({ course, enrolledCourseIds, purchasedProductSlugs }: { course: any; enrolledCourseIds: Set<number>; purchasedProductSlugs: Set<string> }) {
  const price = course.isFree ? "Free" : `$${(course.price / 100).toFixed(0)}`;
  const isOwned = course._source === "digital_product"
    ? purchasedProductSlugs.has(course.slug)
    : enrolledCourseIds.has(course.id);
  const href = course._source === "digital_product"
    ? (isOwned ? `/downloads/${course.slug}/files` : `/downloads/${course.slug}`)
    : (isOwned ? `/learn/${course.slug}/player` : `/learn/${course.slug}`);
  const ctaLabel = isOwned
    ? (course.type === "download" ? "Access Download" : course.type === "quiz" ? "Continue Quiz" : "Continue Learning")
    : (course.type === "quiz" ? "Take Quiz" : course.type === "download" ? "Get Download" : "View Course");
  return (
    <Link href={href}>
      <div className="group bg-white rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
        {/* Cover image */}
        <div className="relative h-44 bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden">
          {course.coverImageUrl ? (
            <img src={course.coverImageUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-teal-300" />
            </div>
          )}

        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-teal-700 transition-colors">
            {course.title}
          </h3>
          {course.subtitle && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.subtitle}</p>
          )}

          {/* Instructor */}
          {course.instructor && (
            <div className="flex items-center gap-2 mt-auto mb-3">
              {course.instructor.avatarUrl ? (
                <img src={course.instructor.avatarUrl} alt={course.instructor.name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                  <span className="text-teal-700 text-xs font-bold">{course.instructor.name[0]}</span>
                </div>
              )}
              <span className="text-xs text-gray-600">{course.instructor.name}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
            <span className="text-sm font-bold text-teal-700">{price}</span>
            <Button size="sm" variant="outline" className={`text-xs h-7 ${isOwned ? "border-green-400 text-green-700 hover:bg-green-50" : "border-teal-300 text-teal-700 hover:bg-teal-50"}`}>
              {isOwned && <CheckCircle className="w-3 h-3 mr-1" />}
              {ctaLabel}
            </Button>
          </div>
          {/* Tags below price */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary" className="bg-teal-50 text-teal-700 text-xs font-medium flex items-center gap-1">
              {TYPE_ICONS[course.type]} {course.type.charAt(0).toUpperCase() + course.type.slice(1)}
            </Badge>
            {course.isFree && (
              <Badge className="bg-green-500 text-white text-xs">Free</Badge>
            )}
            {course.brand && (
              <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
                {BRAND_LABELS[course.brand] ?? course.brand}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <Skeleton className="h-44 w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex justify-between pt-3">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function EducationLibrary() {
  const [brand, setBrand] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [isFree, setIsFree] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeCollection, setActiveCollection] = useState<number | null>(null);

  const { user } = useAuth();

  // Fetch ownership data for smart routing (only when logged in)
  const { data: myCoursesData } = trpc.lmsLearner.getMyCourses.useQuery(undefined, { enabled: !!user });
  const { data: myPurchasesData } = trpc.downloads.myPurchases.useQuery(undefined, { enabled: !!user });

  // Build fast lookup sets
  const enrolledCourseIds = useMemo(() => new Set((myCoursesData ?? []).map((e: any) => e.courseId)), [myCoursesData]);
  const purchasedProductSlugs = useMemo(() => new Set((myPurchasesData ?? []).map((p: any) => p.slug)), [myPurchasesData]);

  // Fetch collections for filter tabs
  const { data: collections } = trpc.lms.listCollections.useQuery();
  const { data: collectionDetail } = trpc.lms.getCollection.useQuery(
    { id: activeCollection! },
    { enabled: activeCollection !== null }
  );

  const { data, isLoading } = trpc.lms.listCourses.useQuery({
    brand: brand !== "all" ? (brand as "aaus" | "iheartecho") : undefined,
    type: type !== "all" ? (type as "course" | "quiz" | "download") : undefined,
    isFree: isFree === "free" ? true : isFree === "paid" ? false : undefined,
    page,
    pageSize: 12,
  });

  // When a collection is active, show only its courses
  const collectionCourses = collectionDetail?.courses ?? [];
  const courses = activeCollection !== null
    ? collectionCourses
    : (data?.courses ?? []).filter(c =>
        !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.subtitle ?? "").toLowerCase().includes(search.toLowerCase())
      );
  const total = activeCollection !== null ? collectionCourses.length : (data?.total ?? 0);
  const totalPages = activeCollection !== null ? 1 : Math.ceil(total / 12);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="teal-header py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Education Library</h1>
          <p className="text-teal-100 text-base max-w-xl mx-auto">
            Courses, quizzes, and downloads from All About Ultrasound™ and iHeartEcho — designed for sonographers, physicians, and educators.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Collection Filter Tabs — Thinkific-style */}
        {collections && collections.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-1.5 pb-1 min-w-max flex-wrap">
              <button
                onClick={() => { setActiveCollection(null); setPage(1); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeCollection === null
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-700"
                }`}
              >
                All Content
              </button>
              {collections.map((col: any) => (
                <button
                  key={col.id}
                  onClick={() => { setActiveCollection(col.id); setPage(1); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activeCollection === col.id
                      ? "text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-700"
                  }`}
                  style={activeCollection === col.id ? { backgroundColor: col.color ?? "#189aa1" } : {}}
                >
                  {col.title}
                  <span className="ml-1.5 text-xs opacity-70">({col.courseCount})</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search courses, quizzes, downloads..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={brand} onValueChange={v => { setBrand(v); setPage(1); }}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              <SelectItem value="aaus">All About Ultrasound</SelectItem>
              <SelectItem value="iheartecho">iHeartEcho</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={v => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="course">Courses</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
              <SelectItem value="download">Downloads</SelectItem>
            </SelectContent>
          </Select>
          <Select value={isFree} onValueChange={v => { setIsFree(v); setPage(1); }}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue placeholder="Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Price</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          {total > 0 && (
            <span className="text-sm text-gray-500 ml-auto">
              {total} {type === "quiz" ? (total !== 1 ? "quizzes" : "quiz") : type === "download" ? (total !== 1 ? "downloads" : "download") : (total !== 1 ? "items" : "item")}
            </span>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <CourseCardSkeleton key={i} />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {type === "quiz" ? <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" /> : type === "download" ? <Download className="w-12 h-12 mx-auto mb-3 opacity-30" /> : <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />}
            <p className="text-lg font-medium">No {type === "quiz" ? "quizzes" : type === "download" ? "downloads" : "courses"} found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {courses.map((c: any) => <CourseCard key={c.id} course={c} enrolledCourseIds={enrolledCourseIds} purchasedProductSlugs={purchasedProductSlugs} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="flex items-center text-sm text-gray-600 px-3">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
