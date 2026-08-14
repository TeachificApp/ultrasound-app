import React from "react";
import { Badge } from "@/components/ui/badge";
import { buildMemberAccessCatalog, type MemberAccessProduct } from "@/lib/memberAccessCatalog";

function CatalogSection({ title, count, emptyMessage, children }: { title: string; count: number; emptyMessage: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 last:border-b-0" data-catalog-section={title}>
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <span className="text-xs text-slate-500">{count} available</span>
      </div>
      {count > 0 ? children : <p className="px-4 py-3 text-sm text-slate-500">{emptyMessage}</p>}
    </section>
  );
}

export function MemberAccessCatalogList({
  courses,
  products,
  memberships,
  search,
  selectedCourseIds,
  selectedProducts,
  selectedPlanIds,
  onToggleCourse,
  onToggleProduct,
  onTogglePlan,
}: {
  courses: any[];
  products: any[];
  memberships: any[];
  search: string;
  selectedCourseIds: number[];
  selectedProducts: MemberAccessProduct[];
  selectedPlanIds: number[];
  onToggleCourse: (id: number) => void;
  onToggleProduct: (product: MemberAccessProduct) => void;
  onTogglePlan: (id: number) => void;
}) {
  const catalog = buildMemberAccessCatalog({ courses, products, memberships }, search);
  return (
    <div className="mt-4 max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200 bg-white" data-testid="member-access-catalog">
      <CatalogSection title="Courses and content" count={catalog.courses.length} emptyMessage="No courses or content match this search.">
        {catalog.courses.map((course: any) => <label key={course.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-teal-50/50">
          <input type="checkbox" checked={selectedCourseIds.includes(course.id)} onChange={() => onToggleCourse(course.id)} className="mt-1 h-4 w-4 accent-teal-600" />
          <span className="min-w-0 flex-1"><span className="block break-words font-medium text-slate-800">{course.title || "Untitled Course"}</span><span className="mt-0.5 block text-xs text-slate-500">{course.type || "Course"}</span></span>
          <Badge variant="outline" className="shrink-0 border-teal-200 bg-teal-50 text-teal-700">Course</Badge>
        </label>)}
      </CatalogSection>
      <CatalogSection title="Downloads and bundles" count={catalog.products.length} emptyMessage="No downloads or bundles match this search.">
        {catalog.products.map((product) => {
          const checked = selectedProducts.some((item) => item.id === product.id && item.type === product.type);
          return <label key={`${product.type}-${product.id}`} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-teal-50/50">
            <input type="checkbox" checked={checked} onChange={() => onToggleProduct(product)} className="mt-1 h-4 w-4 accent-teal-600" />
            <span className="min-w-0 flex-1"><span className="block break-words font-medium text-slate-800">{product.title}</span><span className="mt-0.5 block text-xs text-slate-500">Grant at no charge</span></span>
            <Badge variant="outline" className="shrink-0 border-sky-200 bg-sky-50 text-sky-700 capitalize">{product.type}</Badge>
          </label>;
        })}
      </CatalogSection>
      <CatalogSection title="Memberships" count={catalog.memberships.length} emptyMessage="No memberships match this search.">
        {catalog.memberships.map((plan: any) => <label key={plan.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-teal-50/50">
          <input type="checkbox" checked={selectedPlanIds.includes(plan.id)} onChange={() => onTogglePlan(plan.id)} className="mt-1 h-4 w-4 accent-teal-600" />
          <span className="min-w-0 flex-1"><span className="block break-words font-medium text-slate-800">{plan.title ?? plan.name ?? "Untitled Membership"}</span><span className="mt-0.5 block text-xs capitalize text-slate-500">{plan.billingInterval ?? plan.interval ?? "Membership"} · complimentary active access</span></span>
          <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700">Membership</Badge>
        </label>)}
      </CatalogSection>
    </div>
  );
}
