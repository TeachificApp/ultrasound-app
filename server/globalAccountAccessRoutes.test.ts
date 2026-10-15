import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("global account access routes", () => {
  it("prioritizes account recovery pages over the public marketing catch-all", () => {
    const app = source("client/src/App.tsx");
    const start = app.indexOf("function PublicWebsiteRouter()");
    const end = app.indexOf("function App()", start);
    const publicWebsiteRouter = app.slice(start, end);

    expect(publicWebsiteRouter).toContain('<Route path="/forgot-password" component={ForgotPassword} />');
    expect(publicWebsiteRouter).toContain('<Route path="/reset-password" component={ResetPassword} />');
    expect(publicWebsiteRouter).toContain('<Route path="/magic-link" component={MagicLinkRequest} />');
    expect(publicWebsiteRouter.indexOf('path="/reset-password"')).toBeLessThan(publicWebsiteRouter.indexOf("<Route component={PublicMarketingSitePage} />"));
  });

  it("does not report password storage success until it is verified in the database", () => {
    const db = source("server/db.ts");
    const start = db.indexOf("export async function updateUserPassword");
    const end = db.indexOf("export async function setPendingEmail", start);
    const helper = db.slice(start, end);

    expect(helper).toContain('throw new Error("Database unavailable while saving the password")');
    expect(helper).toContain("Password could not be verified after saving");
    expect(helper).toContain("saved?.passwordHash !== newHash");
  });

  it("resolves authenticated app Premium status through the current brand subscription", () => {
    const context = source("server/_core/context.ts");
    const auth = source("server/routers.ts");

    expect(context).toContain('resolveAppPremiumEntitlement');
    expect(context).toContain('brand,');
    expect(auth).toContain('resolveExplicitBrandPremium');
    expect(auth).toContain('const isPremium = opts.ctx.user.isPremium === true || isPremiumByRole;');
  });

  it("redirects app-domain learning content and checkout URLs to the matching Learn tenant", () => {
    const app = source("client/src/App.tsx");
    const start = app.indexOf("function Router()");
    const end = app.indexOf("function MembersRouter()", start);
    const appRouter = app.slice(start, end);

    expect(app).toContain("function LearnContentRedirect()");
    expect(app).toContain("getLearnAppUrl()");
    expect(appRouter).toContain('<Route path="/checkout/:slug" component={LearnContentRedirect} />');
    expect(appRouter).toContain('<Route path="/workshops/:slug" component={LearnContentRedirect} />');
    expect(appRouter).toContain('<Route path="/courses/:slug/player" component={LearnContentRedirect} />');
    expect(appRouter).toContain('<Route path="/cohort/:courseId" component={LearnContentRedirect} />');
    expect(appRouter).toContain('<Route path="/my-dashboard" component={LearnContentRedirect} />');
    expect(appRouter.indexOf('path="/checkout/:slug"')).toBeLessThan(
      appRouter.indexOf('path="/:slug/:pageSlug"'),
    );
    expect(appRouter.indexOf('path="/workshops/:slug" component={LearnContentRedirect}')).toBeLessThan(
      appRouter.indexOf('path="/workshops/:slug" component={WorkshopLanding}'),
    );
  });
});
