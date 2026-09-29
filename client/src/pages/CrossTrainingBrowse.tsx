/**
 * CrossTrainingBrowse.tsx
 * Public Learn catalog page for cohort courses assigned to the Cross-Training collection.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, Search, Users } from "lucide-react";
import { CourseInstanceInfo } from "@/components/CourseInstanceInfo";
import { formatWorkshopDollars } from "../../../shared/workshopPricing";

function CrossTrainingCohortCard({ cohort }: { cohort: any }) {
  const isWaitlist = cohort.status === "waitlist" || cohort.primaryCohortGroup?.status === "waitlist";
  const price = cohort.isFree || Number(cohort.price) === 0
    ? "Free"
    : formatWorkshopDollars(cohort.price, cohort.currency);

  return (
    <Link href={`/courses/${cohort.slug}`}>
      <article className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-teal-400 hover:shadow-lg">
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-teal-50 to-cyan-50">
          {cohort.coverImageUrl || cohort.thumbnailUrl ? (
            <img
              src={cohort.coverImageUrl || cohort.thumbnailUrl}
              alt={cohort.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <GraduationCap className="h-14 w-14 text-teal-300" />
            </div>
          )}
          <Badge className={`absolute right-3 top-3 text-xs text-white ${isWaitlist ? "bg-amber-500" : "bg-teal-600"}`}>
            {isWaitlist ? "Waitlist" : "Cross-Training"}
          </Badge>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h2 className="line-clamp-2 text-base font-semibold text-gray-900 transition-colors group-hover:text-teal-700">
            {cohort.title}
          </h2>
          {cohort.subtitle && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{cohort.subtitle}</p>}
          {cohort.description && !cohort.subtitle && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{cohort.description}</p>}

          <div className="mt-3">
            <CourseInstanceInfo type="cohort" primaryCohortGroup={cohort.primaryCohortGroup} />
          </div>

          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="text-lg font-bold text-teal-700">{price}</span>
            <Badge variant="outline" className="text-xs text-gray-500">
              Cohort
            </Badge>
          </div>
        </div>
      </article>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <Skeleton className="h-48 w-full" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-4 h-4 w-1/3" />
      </div>
    </div>
  );
}

export default function CrossTrainingBrowse() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.lms.listCrossTrainingCohorts.useQuery();
  const cohorts = data?.cohorts ?? [];
  const query = search.trim().toLowerCase();
  const filteredCohorts = cohorts.filter((cohort: any) => {
    if (!query) return true;
    return [
      cohort.title,
      cohort.subtitle,
      cohort.description,
      cohort.primaryCohortGroup?.name,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="teal-header px-4 py-12">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
            <Users className="h-4 w-4" />
            Live Cohort Programs
          </div>
          <h1 className="mb-2 text-3xl font-bold">Cross-Training Cohorts</h1>
          <p className="mx-auto max-w-2xl text-base text-teal-100">
            Build new clinical expertise through immersive, instructor-led cross-training programs with live learning and structured support.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-6 max-w-5xl px-4">
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-md">
          <Search className="h-5 w-5 flex-shrink-0 text-gray-400" />
          <Input
            placeholder="Search cross-training cohorts…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        ) : filteredCohorts.length === 0 ? (
          <div className="py-20 text-center">
            <GraduationCap className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h2 className="mb-2 text-xl font-semibold text-gray-700">
              {query ? "No cross-training cohorts match your search" : "No cross-training cohorts available yet"}
            </h2>
            <p className="text-gray-500">
              {query ? "Try a different search term." : "Please check back soon for upcoming cohort programs."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {filteredCohorts.length} Cross-Training Cohort{filteredCohorts.length !== 1 ? "s" : ""} Available
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCohorts.map((cohort: any) => <CrossTrainingCohortCard key={cohort.id} cohort={cohort} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
