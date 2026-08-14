export type MemberAccessProduct = {
  id: number;
  type: "download" | "bundle";
  title: string;
};

/** Product types accepted by productAnalytics.grantProductAccess in the member workflow. */
export const MEMBER_ACCESS_GRANTABLE_PRODUCT_TYPES = ["download", "bundle"] as const;

type CatalogCourse = { id: number; title?: string | null; type?: string | null };
type CatalogProduct = { id: number; title?: string | null; type?: string | null };
type CatalogMembership = {
  id: number;
  title?: string | null;
  name?: string | null;
  billingInterval?: string | null;
  interval?: string | null;
};

const matchesSearch = (search: string, ...values: Array<string | null | undefined>) => {
  const term = search.trim().toLowerCase();
  return !term || values.filter(Boolean).join(" ").toLowerCase().includes(term);
};

export function buildMemberAccessCatalog(
  { courses, products, memberships }: { courses: CatalogCourse[]; products: CatalogProduct[]; memberships: CatalogMembership[] },
  search: string,
) {
  return {
    courses: courses.filter((course) => matchesSearch(search, course.title, course.type)),
    products: products
      .filter((product): product is CatalogProduct & { type: "download" | "bundle" } => MEMBER_ACCESS_GRANTABLE_PRODUCT_TYPES.includes(product.type as "download" | "bundle"))
      .filter((product) => matchesSearch(search, product.title, product.type))
      .map((product) => ({ id: product.id, type: product.type, title: product.title ?? "Untitled Product" })),
    memberships: memberships.filter((membership) => matchesSearch(search, membership.title ?? membership.name, membership.billingInterval ?? membership.interval)),
  };
}

export function toggleMemberAccessId(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((currentId) => currentId !== id) : [...ids, id];
}

export function toggleMemberAccessProduct(products: MemberAccessProduct[], product: MemberAccessProduct) {
  const alreadySelected = products.some((current) => current.id === product.id && current.type === product.type);
  return alreadySelected
    ? products.filter((current) => current.id !== product.id || current.type !== product.type)
    : [...products, product];
}

export async function submitMemberAccessGrants({
  member,
  courseIds,
  products,
  planIds,
  createAndEnroll,
  grantProductAccess,
  grantMembershipAccess,
}: {
  member: { name: string; email: string; userId: number };
  courseIds: number[];
  products: MemberAccessProduct[];
  planIds: number[];
  createAndEnroll: (input: { name: string; email: string; courseId: number }) => Promise<unknown>;
  grantProductAccess: (input: { userEmail: string; productType: "download" | "bundle"; productId: number }) => Promise<unknown>;
  grantMembershipAccess: (input: { userId: number; planId: number }) => Promise<unknown>;
}) {
  for (const courseId of courseIds) await createAndEnroll({ name: member.name, email: member.email, courseId });
  for (const product of products) await grantProductAccess({ userEmail: member.email, productType: product.type, productId: product.id });
  for (const planId of planIds) await grantMembershipAccess({ userId: member.userId, planId });
}
