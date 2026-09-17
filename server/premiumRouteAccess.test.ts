import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const app = source("client/src/App.tsx");
const premiumOverlay = source("client/src/components/PremiumOverlay.tsx");
const premiumPearlGate = source("client/src/components/PremiumPearlGate.tsx");
const soundBytes = source("client/src/pages/SoundBytes.tsx");

describe("public Premium access and POCUS route safety", () => {
  it("registers the established iHeartEcho POCUS navigator URL aliases", () => {
    const routerStart = app.indexOf("function IHeartEchoRouter()");
    const routerEnd = app.indexOf("function AccreditationDivisionRouter()");
    const iHeartRouter = app.slice(routerStart, routerEnd);

    expect(iHeartRouter).toContain('path="/pocus-cardiac-navigator" component={POCUSCardiacNavigator}');
    expect(iHeartRouter).toContain('path="/pocus-efast-navigator" component={POCUSEfastNavigator}');
    expect(iHeartRouter).toContain('path="/pocus-rush-navigator"');
    expect(iHeartRouter).toContain('path="/pocus-lung-navigator"');
  });

  it("never starts a Premium preview or renders protected children for an anonymous visitor", () => {
    expect(premiumOverlay).toContain('if (!isAuthenticated)');
    expect(premiumOverlay).toContain('<PremiumPearlGate type="login"');
    expect(premiumOverlay).toContain('Authenticated free members receive the brief');

    expect(premiumPearlGate).toContain('type === "premium" && isLoggedIn && !isLoading');
    expect(premiumPearlGate).toContain('const renderedGateType: GateType = type === "premium" && !isLoggedIn ? "login" : type;');
    expect(premiumPearlGate).toContain('renderedGateType === "premium" && teaserHeight > 0');
  });

  it("keeps a non-interactive but visibly useful SoundBytes background behind the sign-in gate", () => {
    expect(soundBytes).toContain('filter: "blur(2.5px)", opacity: 0.64');
    expect(soundBytes).toContain('<SoundByteCard key={sb.id} sb={{ ...sb, canPlay: false }} onClick={() => {}} />');
    expect(soundBytes).toContain('pointer-events-none select-none');
  });
});
