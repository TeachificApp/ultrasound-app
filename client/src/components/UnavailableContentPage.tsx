import { ArrowLeft, Clock3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export type UnavailableContentKind =
  | "course"
  | "cohort"
  | "product"
  | "download"
  | "workshop"
  | "webinar"
  | "bundle"
  | "membership"
  | "event"
  | "page";

const LABELS: Record<UnavailableContentKind, string> = {
  course: "course",
  cohort: "cohort",
  product: "product",
  download: "download",
  workshop: "workshop",
  webinar: "webinar",
  bundle: "bundle",
  membership: "membership",
  event: "event",
  page: "page",
};

type Props = {
  kind: UnavailableContentKind;
  returnHref?: string;
  returnLabel?: string;
};

/**
 * Public-facing fallback used when a direct URL points to non-published content.
 * The server withholds the record itself; this component only explains the safe
 * public state without confirming whether the item was drafted, removed, or moved.
 */
export function UnavailableContentPage({
  kind,
  returnHref = "/",
  returnLabel = "Back to Home",
}: Props) {
  const label = LABELS[kind];
  const title = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;

  return (
    <main
      className="min-h-[70vh] bg-slate-50 flex items-center justify-center px-4 py-12"
      data-testid={`unavailable-${kind}-page`}
    >
      <section className="max-w-md w-full rounded-2xl border border-teal-100 bg-white px-7 py-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
          <Clock3 className="h-7 w-7 text-teal-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{title} currently unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          We&apos;re working on updating this {label}. Please check back soon for availability.
        </p>
        <Link href={returnHref}>
          <Button variant="outline" className="mt-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {returnLabel}
          </Button>
        </Link>
      </section>
    </main>
  );
}
