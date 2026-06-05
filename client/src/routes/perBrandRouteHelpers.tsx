/**
 * Reusable wouter routes for per-brand clinical tools (`-aaus` / `-ihe` suffixes).
 */
import { Fragment, type ReactNode } from "react";
import { Route } from "wouter";
import BrandPathRedirect from "@/components/BrandPathRedirect";
import { withBrandTag } from "@shared/brandScopedRoutes";

type BrandedRouteDef = {
  base: string;
  render: () => ReactNode;
};

function BrandedRoutes({ routes }: { routes: BrandedRouteDef[] }) {
  return (
    <>
      {routes.map(({ base, render }) => (
        <Fragment key={base}>
          <Route path={withBrandTag(base, "aaus")}>{render}</Route>
          <Route path={withBrandTag(base, "iheartecho")}>{render}</Route>
          <Route path={base}>{() => <BrandPathRedirect basePath={base} />}</Route>
        </Fragment>
      ))}
    </>
  );
}

export function PerBrandUserRoutes({
  routes,
}: {
  routes: { base: string; component: React.ComponentType }[];
}) {
  return (
    <BrandedRoutes
      routes={routes.map(({ base, component: Component }) => ({
        base,
        render: () => <Component />,
      }))}
    />
  );
}

export function PerBrandAdminRoutes({ routes }: { routes: BrandedRouteDef[] }) {
  return <BrandedRoutes routes={routes} />;
}
