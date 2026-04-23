/**
 * CourseLanding.tsx
 * Public course landing page — auto-generated from course data, editable by admin.
 * Routes: /learn/:slug
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { BookOpen, CheckCircle, ChevronRight, Clock, Download, HelpCircle, Lock, PlayCircle, Star } from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  course: <BookOpen className="w-5 h-5" />,
  quiz: <HelpCircle className="w-5 h-5" />,
  download: <Download className="w-5 h-5" />,
};

export default function CourseLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [enrolling, setEnrolling] = useState(false);

  const { data: course, isLoading } = trpc.lms.getCourse.useQuery({ slug: slug! }, { enabled: !!slug });

  // Check if user is already enrolled
  const { data: myCourses } = trpc.lmsLearner.getMyCourses.useQuery(undefined, { enabled: !!user });
  const enrollment = myCourses?.find((e: any) => e.courseId === course?.id);

  const enrollFree = trpc.lmsLearner.enrollFree.useMutation({
    onSuccess: () => {
      toast.success("Enrolled! You now have access to this course.");
      navigate(`/learn/${slug}/player`);
    },
    onError: (e) => toast.error(`Enrollment failed: ${e.message}`),
  });

  const createCheckout = trpc.lmsLearner.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank");
    },
    onError: (e) => toast.error(`Checkout failed: ${e.message}`),
  });

  const handleEnroll = async () => {
    if (!user) { navigate("/login"); return; }
    if (enrollment) { navigate(`/learn/${slug}/player`); return; }
    setEnrolling(true);
    try {
      if (course?.isFree) {
        await enrollFree.mutateAsync({ courseSlug: slug! });
      } else {
        await createCheckout.mutateAsync({ courseSlug: slug!, seats: 1, origin: window.location.origin });
      }
    } finally {
      setEnrolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">Course not found</p>
        <Button variant="link" onClick={() => navigate("/education-library")}>Back to Library</Button>
      </div>
    );
  }

  const lp = course.landingPage;
  const price = course.isFree ? "Free" : `$${(course.price / 100).toFixed(0)}`;
  const ctaText = enrollment ? "Continue Learning" : (lp?.ctaText ?? "Enroll Now");
  const totalLessons = course.sections.reduce((sum: number, s: any) => sum + s.lessons.length, 0);
  const totalDuration = course.sections.reduce((sum: number, s: any) =>
    sum + s.lessons.reduce((ls: number, l: any) => ls + (l.durationMinutes ?? 0), 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Course info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-teal-600 text-white border-0 flex items-center gap-1">
                {TYPE_ICONS[course.type]} {course.type.charAt(0).toUpperCase() + course.type.slice(1)}
              </Badge>
              <Badge variant="outline" className="border-teal-400 text-teal-200">
                {course.brand === "aaus" ? "All About Ultrasound™" : "iHeartEcho"}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold leading-tight">{lp?.heroTitle ?? course.title}</h1>
            {(lp?.heroSubtitle ?? course.subtitle) && (
              <p className="text-teal-100 text-lg">{lp?.heroSubtitle ?? course.subtitle}</p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm text-teal-200 pt-2">
              {totalLessons > 0 && (
                <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{totalLessons} lesson{totalLessons !== 1 ? "s" : ""}</span>
              )}
              {totalDuration > 0 && (
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{totalDuration} min</span>
              )}
              {course.hasCertificate && (
                <span className="flex items-center gap-1"><Star className="w-4 h-4" />Certificate included</span>
              )}
            </div>

            {/* Instructors */}
            {course.instructors.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-2">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex items-center gap-2">
                    {ins.avatarUrl ? (
                      <img src={ins.avatarUrl} alt={ins.name} className="w-8 h-8 rounded-full object-cover border-2 border-teal-400" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">{ins.name[0]}</div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{ins.name}</p>
                      {ins.title && <p className="text-xs text-teal-300">{ins.title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Enrollment card */}
          <div className="bg-white rounded-xl shadow-xl p-6 text-gray-900 space-y-4">
            {course.coverImageUrl && (
              <img src={course.coverImageUrl} alt={course.title} className="w-full h-36 object-cover rounded-lg" />
            )}
            <div className="text-3xl font-bold text-teal-700">{price}</div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              size="lg"
              onClick={handleEnroll}
              disabled={enrolling || enrollFree.isPending || createCheckout.isPending}
            >
              {enrolling ? "Processing..." : ctaText}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            {!user && (
              <p className="text-xs text-gray-500 text-center">
                <button className="text-teal-600 underline" onClick={() => navigate("/login")}>Sign in</button> or{" "}
                <button className="text-teal-600 underline" onClick={() => navigate("/register")}>create an account</button> to enroll
              </p>
            )}
            {course.hasCertificate && (
              <div className="flex items-center gap-2 text-sm text-gray-600 border-t pt-3">
                <Star className="w-4 h-4 text-yellow-500" />
                Certificate of completion included
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* What you'll learn */}
          {lp?.whatYouLearn && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What You'll Learn</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.whatYouLearn }} />
            </section>
          )}

          {/* Course description */}
          {(lp?.bodyContent ?? course.description) && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">About This Course</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp?.bodyContent ?? course.description ?? "" }} />
            </section>
          )}

          {/* Curriculum */}
          {course.sections.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Curriculum</h2>
              <Accordion type="multiple" defaultValue={[`section-0`]}>
                {course.sections.map((section: any, si: number) => (
                  <AccordionItem key={section.id} value={`section-${si}`}>
                    <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline">
                      <span>{section.title}</span>
                      <span className="text-xs text-gray-400 ml-auto mr-2">{section.lessons.length} lesson{section.lessons.length !== 1 ? "s" : ""}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 pt-1">
                        {section.lessons.map((lesson: any) => (
                          <li key={lesson.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 text-sm">
                            {lesson.isPreview ? (
                              <PlayCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                            ) : (
                              <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            )}
                            <span className={lesson.isPreview ? "text-teal-700 font-medium" : "text-gray-700"}>{lesson.title}</span>
                            {lesson.isPreview && <Badge variant="outline" className="text-xs text-teal-600 border-teal-300 ml-auto">Preview</Badge>}
                            {lesson.durationMinutes && <span className="text-xs text-gray-400 ml-auto">{lesson.durationMinutes} min</span>}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}

          {/* Requirements */}
          {lp?.requirements && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: lp.requirements }} />
            </section>
          )}

          {/* Instructors section */}
          {course.instructors.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructor{course.instructors.length > 1 ? "s" : ""}</h2>
              <div className="space-y-6">
                {course.instructors.map((ins: any) => ins && (
                  <div key={ins.id} className="flex gap-4">
                    {ins.avatarUrl ? (
                      <img src={ins.avatarUrl} alt={ins.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 flex-shrink-0">{ins.name[0]}</div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{ins.name}</p>
                      {ins.title && <p className="text-sm text-teal-600">{ins.title}</p>}
                      {ins.bio && <div className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ins.bio }} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — sticky enroll card on desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-6 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="text-2xl font-bold text-teal-700">{price}</div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              size="lg"
              onClick={handleEnroll}
              disabled={enrolling || enrollFree.isPending || createCheckout.isPending}
            >
              {enrolling ? "Processing..." : ctaText}
            </Button>
            <ul className="space-y-2 text-sm text-gray-600">
              {totalLessons > 0 && <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-500" />{totalLessons} lessons</li>}
              {totalDuration > 0 && <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-teal-500" />{totalDuration} minutes of content</li>}
              {course.hasCertificate && <li className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Certificate of completion</li>}
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-500" />Full lifetime access</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
