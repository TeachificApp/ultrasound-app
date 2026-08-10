/**
 * WorkshopDetail.tsx
 * Public workshop landing page — /workshops/:slug
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase, MapPin, Calendar, Clock, Users, ChevronRight,
  CheckCircle, ArrowLeft, Globe, Video, Building2
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";

function formatPrice(cents: number | null | undefined, isFree: boolean) {
  if (isFree || cents === 0 || cents == null) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function LocationIcon({ type }: { type: string }) {
  if (type === "virtual") return <Video className="w-4 h-4 text-teal-600" />;
  if (type === "hybrid") return <Globe className="w-4 h-4 text-teal-600" />;
  return <Building2 className="w-4 h-4 text-teal-600" />;
}

function InstanceCard({ instance, workshopSlug, isDraft }: { instance: any; workshopSlug: string; isDraft?: boolean }) {
  const price = instance.price != null
    ? `$${(instance.price / 100).toFixed(2)}`
    : null;
  const compareAt = instance.compareAtPrice != null
    ? `$${(instance.compareAtPrice / 100).toFixed(2)}`
    : null;
  const startDate = instance.startDate ? new Date(instance.startDate) : null;
  const endDate = instance.endDate ? new Date(instance.endDate) : null;
  const spotsLeft = instance.capacity != null
    ? Math.max(0, instance.capacity - (instance.enrolledCount ?? 0))
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-teal-400 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base">{instance.title}</h3>
          {startDate && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-2">
              <Calendar className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span>
                {format(startDate, "MMMM d, yyyy")}
                {endDate && ` – ${format(endDate, "MMMM d, yyyy")}`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-1">
            <LocationIcon type={instance.locationType} />
            <span className="capitalize">{instance.locationType?.replace("_", "-") ?? "In Person"}</span>
            {instance.venueCity && (
              <span className="text-gray-400">
                · {instance.venueCity}{instance.venueState ? `, ${instance.venueState}` : ""}
              </span>
            )}
          </div>
          {spotsLeft != null && (
            <div className="flex items-center gap-1.5 text-sm mt-1">
              <Users className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span className={spotsLeft <= 5 ? "text-red-600 font-medium" : "text-gray-600"}>
                {spotsLeft === 0 ? "Sold out" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {price && (
            <div className="text-right">
              <span className="text-xl font-bold text-teal-700">{price}</span>
              {compareAt && (
                <span className="text-sm text-gray-400 line-through ml-2">{compareAt}</span>
              )}
            </div>
          )}
          {isDraft ? (
            <Button className="font-semibold" size="sm" disabled variant="outline">Enrollment Closed</Button>
          ) : (
            <Link href={`/checkout/workshop/${workshopSlug}?instance=${instance.id}`}>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                size="sm"
                disabled={spotsLeft === 0}
              >
                {spotsLeft === 0 ? "Sold Out" : "Register"}
                {spotsLeft !== 0 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkshopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.workshop.getBySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Workshop Not Found</h1>
        <p className="text-gray-500 mb-6">
          This workshop may have been removed or is no longer available.
        </p>
        <Link href="/workshops">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workshops
          </Button>
        </Link>
      </div>
    );
  }

  const { workshop, availableInstances, pricingOptions } = data;
  const defaultPrice = formatPrice(workshop.price, workshop.isFree);
  const compareAt = workshop.compareAtPrice
    ? `$${Number(workshop.compareAtPrice).toFixed(2)}`
    : null;
  const isDraft = workshop.status === "draft" || workshop.status === "enrollment_closed";

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb */}
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/workshops" className="hover:text-teal-600 transition-colors">
              Workshops
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium truncate">{workshop.title}</span>
          </nav>
        </div>

        {/* Hero */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left — details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cover image */}
              {(workshop.coverImageUrl || workshop.thumbnailUrl) && (
                <div className="rounded-xl overflow-hidden h-64 bg-gradient-to-br from-teal-50 to-cyan-50">
                  <img
                    src={workshop.coverImageUrl || workshop.thumbnailUrl}
                    alt={workshop.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title & badges */}
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge className="bg-teal-100 text-teal-700 border-teal-200">Workshop</Badge>
                  {workshop.isFeatured && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">Featured</Badge>
                  )}
                  {workshop.brand === "iheartecho" && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">iHeartEcho™</Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900">{workshop.title}</h1>
                {workshop.subtitle && (
                  <p className="text-lg text-gray-600 mt-2">{workshop.subtitle}</p>
                )}
              </div>

              {/* Description */}
              {workshop.description && (
                <div className="prose prose-sm max-w-none text-gray-700">
                  <div dangerouslySetInnerHTML={{ __html: workshop.description }} />
                </div>
              )}

              {/* Available instances */}
              {availableInstances.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-teal-600" />
                    Upcoming Dates
                  </h2>
                  <div className="space-y-3">
                    {availableInstances.map((inst: any) => (
                      <InstanceCard key={inst.id} instance={inst} workshopSlug={slug ?? ""} isDraft={isDraft} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — pricing sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6 shadow-sm space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-teal-700">{defaultPrice}</span>
                    {compareAt && (
                      <span className="text-lg text-gray-400 line-through">{compareAt}</span>
                    )}
                  </div>
                  {workshop.isFree && (
                    <p className="text-sm text-teal-600 font-medium mt-1">No payment required</p>
                  )}
                </div>

                {availableInstances.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 font-medium">
                      {availableInstances.length} date{availableInstances.length !== 1 ? "s" : ""} available
                    </p>
                    {availableInstances.slice(0, 3).map((inst: any) => {
                      const d = inst.startDate ? new Date(inst.startDate) : null;
                      return (
                        <Link
                          key={inst.id}
                          href={`/checkout/workshop/${slug}?instance=${inst.id}`}
                        >
                          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all cursor-pointer">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{inst.title}</p>
                              {d && (
                                <p className="text-xs text-gray-500">{format(d, "MMM d, yyyy")}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No upcoming dates scheduled.</p>
                    <p className="text-xs text-gray-400 mt-1">Check back soon!</p>
                  </div>
                )}

                {/* Pricing options */}
                {pricingOptions && pricingOptions.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Pricing Options</p>
                    {pricingOptions.map((opt: any) => (
                      <div key={opt.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{opt.label}</span>
                        <span className="font-semibold text-teal-700">
                          {formatPrice(opt.price, false)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Highlights */}
                <div className="border-t pt-4 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>Expert-led hands-on training</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>CME/CE credits available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>Certificate of completion</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
