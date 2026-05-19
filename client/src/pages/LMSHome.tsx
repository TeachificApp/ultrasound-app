/**
 * LMSHome.tsx
 * Dedicated home page for the learn subdomain (learn.allaboutultrasound.com)
 * Shows hero, featured courses, new downloads, and enrollment CTAs
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Download,
  GraduationCap,
  ArrowRight,
  Star,
  Users,
  Play,
  FileDown,
  Sparkles,
} from "lucide-react";

export default function LMSHome() {
  const { user, isAuthenticated } = useAuth();
  const { data: featuredCourses, isLoading: loadingFeatured } = trpc.lms.listFeatured.useQuery();
  const { data: downloads, isLoading: loadingDownloads } = trpc.downloads.list.useQuery({ limit: 4 });

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0e6b70] via-[#189aa1] to-[#4ad9e0]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#4ad9e0] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-6 h-6 text-[#4ad9e0]" />
              <span className="text-sm font-medium text-white/80 uppercase tracking-wider">
                All About Ultrasound | iHeartEcho Learning Platform
              </span>
            </div>
            <h1 className="text-3xl lg:text-5xl font-bold text-white leading-tight mb-4">
              Advance Your Ultrasound{" "}
              <span className="text-[#4ad9e0]">Expertise</span>
            </h1>
            <p className="text-lg text-white/80 mb-8 max-w-2xl">
              Comprehensive courses, quizzes, and downloadable resources designed by
              experienced sonographers and physicians. Earn CME credits and build
              clinical confidence.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/education-library">
                <Button size="lg" className="bg-white text-[#189aa1] hover:bg-white/90 font-semibold shadow-lg">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Courses
                </Button>
              </Link>
              <Link href="/downloads">
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold">
                  <FileDown className="w-4 h-4 mr-2" />
                  Digital Downloads
                </Button>
              </Link>
              {!isAuthenticated && (
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="outline" className="border-[#4ad9e0] text-[#4ad9e0] hover:bg-[#4ad9e0]/10 font-semibold">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </div>
          {/* Stats */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: BookOpen, label: "Courses", value: "50+" },
              { icon: Users, label: "Learners", value: "14,000+" },
              { icon: GraduationCap, label: "CME Credits", value: "Available" },
              { icon: Star, label: "Avg Rating", value: "4.9/5" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10">
                <stat.icon className="w-5 h-5 text-[#4ad9e0] mb-1" />
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#189aa1]" />
              Featured Courses
            </h2>
            <p className="text-sm text-gray-500 mt-1">Hand-picked by our team for maximum impact</p>
          </div>
          <Link href="/education-library">
            <Button variant="ghost" className="text-[#189aa1] hover:text-[#0e6b70] font-medium">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : featuredCourses && featuredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredCourses.map((course: any) => (
              <Link key={course.id} href={`/learn/${course.slug}`}>
                <div className="group bg-white rounded-xl border border-gray-200 hover:border-[#4ad9e0] hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
                  <div className="relative h-40 bg-gradient-to-br from-teal-50 to-teal-100 overflow-hidden">
                    {course.coverImageUrl ? (
                      <img src={course.coverImageUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-teal-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1 group-hover:text-[#189aa1] transition-colors">
                      {course.title}
                    </h3>
                    {course.subtitle && (
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{course.subtitle}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm font-bold text-[#189aa1]">
                        {course.isFree ? "Free" : `$${(course.price / 100).toFixed(0)}`}
                      </span>
                      {course.instructor && (
                        <span className="text-xs text-gray-400 truncate ml-2">
                          {course.instructor.name}
                        </span>
                      )}
                    </div>
                    {course.isFree && (
                      <div className="mt-1.5">
                        <Badge className="bg-green-500 text-white text-xs">Free</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Featured courses coming soon</p>
            <Link href="/education-library">
              <Button variant="link" className="text-[#189aa1] mt-2">
                Browse all courses <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* New Downloads */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-[#189aa1]" />
                Latest Downloads
              </h2>
              <p className="text-sm text-gray-500 mt-1">Study guides, cheat sheets, and clinical resources</p>
            </div>
            <Link href="/downloads">
              <Button variant="ghost" className="text-[#189aa1] hover:text-[#0e6b70] font-medium">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {loadingDownloads ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 overflow-hidden">
                  <Skeleton className="h-32 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : downloads && downloads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {downloads.map((product: any) => (
                <Link key={product.id} href={`/downloads/${product.slug}`}>
                  <div className="group bg-gray-50 rounded-xl border border-gray-200 hover:border-[#4ad9e0] hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer flex flex-col h-full">
                    <div className="relative h-32 bg-gradient-to-br from-cyan-50 to-teal-50 overflow-hidden">
                      {product.thumbnailUrl ? (
                        <img src={product.thumbnailUrl} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileDown className="w-8 h-8 text-teal-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-[#189aa1] transition-colors">
                        {product.title}
                      </h3>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-sm font-bold text-[#189aa1]">
                          {product.price === 0 ? "Free" : `$${(product.price / 100).toFixed(2)}`}
                        </span>
                        <FileDown className="w-4 h-4 text-gray-400 group-hover:text-[#4ad9e0] transition-colors" />
                      </div>
                      {product.price === 0 && (
                        <div className="mt-1.5">
                          <Badge className="bg-green-500 text-white text-xs">Free</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <FileDown className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Downloads coming soon</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0e6b70] to-[#189aa1] p-8 lg:p-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ad9e0]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                Ready to Level Up Your Skills?
              </h2>
              <p className="text-white/80 text-base max-w-lg">
                Join thousands of ultrasound professionals advancing their careers with
                our expert-led courses and resources. Start learning today.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated ? (
                <Link href="/education-library">
                  <Button size="lg" className="bg-white text-[#189aa1] hover:bg-white/90 font-semibold shadow-lg">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Continue Learning
                  </Button>
                </Link>
              ) : (
                <>
                  <a href={getLoginUrl()}>
                    <Button size="lg" className="bg-white text-[#189aa1] hover:bg-white/90 font-semibold shadow-lg">
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Create Free Account
                    </Button>
                  </a>
                  <Link href="/education-library">
                    <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold">
                      Browse Courses
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} All About Ultrasound™ | iHeartEcho. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href={import.meta.env.VITE_APP_URL || "https://app.allaboutultrasound.com"} className="text-sm text-[#189aa1] hover:text-[#0e6b70] font-medium">
                Clinical Tools →
              </a>
              <a href="https://www.allaboutultrasound.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">
                Main Website
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
