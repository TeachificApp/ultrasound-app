import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const availabilityRouter = readFileSync(resolve(process.cwd(), "server/routers/contentAvailabilityRouter.ts"), "utf8");
const downloadsRouter = readFileSync(resolve(process.cwd(), "server/routers/downloadsRouter.ts"), "utf8");
const bundleRouter = readFileSync(resolve(process.cwd(), "server/routers/bundleRouter.ts"), "utf8");
const membershipRouter = readFileSync(resolve(process.cwd(), "server/routers/membershipRouter.ts"), "utf8");

describe("remaining product availability safeguards", () => {
  it("supports duplicate-safe Waitlist targets for downloads, bundles, memberships, and quizzes", () => {
    for (const productType of ["download", "bundle", "membership", "quiz"]) {
      expect(availabilityRouter).toContain(`"${productType}"`);
      expect(availabilityRouter).toContain(`case "${productType}"`);
    }
  });

  it("blocks direct download checkout for Waitlist and Enrollment Closed products", () => {
    expect(downloadsRouter).toContain('product.status === "waitlist"');
    expect(downloadsRouter).toContain('product.status === "enrollment_closed"');
  });

  it("blocks direct bundle and membership checkout for Waitlist and Enrollment Closed offerings", () => {
    expect(bundleRouter).toContain('bundle.status === "waitlist"');
    expect(bundleRouter).toContain('bundle.status === "enrollment_closed"');
    expect(membershipRouter).toContain('plan.status === "waitlist"');
    expect(membershipRouter).toContain('plan.status === "enrollment_closed"');
  });
});
