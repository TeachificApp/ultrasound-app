/**
 * Reusable wouter routes for per-brand clinical tools (`-aaus` / `-ihe` suffixes).
 *
 * IMPORTANT: Return a flat array of <Route> elements for use inside <Switch>.
 * Do NOT wrap in a custom component — wouter Switch treats children without
 * `path` as `*` and stops before later routes (blank funnel/admin pages).
 */
import type { ReactNode } from "react";
import { Route } from "wouter";
import BrandPathRedirect from "@/components/BrandPathRedirect";
import { withBrandTag } from "@shared/brandScopedRoutes";

type BrandedRouteDef = {
  base: string;
  render: () => ReactNode;
};

function brandedRouteElements({ base, render }: BrandedRouteDef) {
  return [
    <Route key={`${base}-aaus`} path={withBrandTag(base, "aaus")}>
      {render}
    </Route>,
    <Route key={`${base}-ihe`} path={withBrandTag(base, "iheartecho")}>
      {render}
    </Route>,
    <Route key={base} path={base}>
      {() => <BrandPathRedirect basePath={base} />}
    </Route>,
  ];
}

export function perBrandUserRouteElements(routes: {
  base: string;
  component: React.ComponentType;
}[]) {
  return routes.flatMap(({ base, component: Component }) =>
    brandedRouteElements({
      base,
      render: () => <Component />,
    }),
  );
}

export function perBrandAdminRouteElements(routes: BrandedRouteDef[]) {
  return routes.flatMap(brandedRouteElements);
}
