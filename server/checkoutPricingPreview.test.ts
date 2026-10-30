import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPublicCheckoutPreview } from "../shared/checkoutPreview";

const projectRoot = resolve(import.meta.dirname, "..");
const readProjectFile = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

describe("public checkout pricing preview", () => {
  it("renders a selected course offer before payer details are entered", () => {
    const preview = buildPublicCheckoutPreview({
      entityType: "course",
      pricingOptionId: 22,
      course: {
        title: "Pediatric Echocardiography",
        price: "799.00",
        pricingType: "one_time",
        currency: "usd",
        pricingOptions: [{ id: 22, label: "Cross-training tuition", price: "249.50", pricingType: "one_time" }],
      },
    });

    expect(preview).toMatchObject({
      courseTitle: "Pediatric Echocardiography",
      productName: "Pediatric Echocardiography — Cross-training tuition",
      displayPrice: 249.5,
      pricingType: "one_time",
      currency: "usd",
    });
  });

  it("renders the exact discounted per-seat team price before payer details are entered", () => {
    const preview = buildPublicCheckoutPreview({
      entityType: "course",
      teamTierId: 4,
      course: {
        title: "Team Echo Training",
        price: "100.00",
        currency: "usd",
        teamTiers: [{ id: 4, minSeats: 3, discountPercent: "20" }],
      },
    });

    expect(preview).toMatchObject({
      displayPrice: 80,
      minSeats: 3,
      discountPercent: 20,
      billingLabel: "$80.00/seat × 3 seats minimum",
    });
  });

  it("preserves authored decimal download prices and webinar dollar prices", () => {
    const download = buildPublicCheckoutPreview({
      entityType: "download",
      download: { title: "Echo Workbook", price: "29.97", currency: "usd", isFree: false },
    });
    const webinar = buildPublicCheckoutPreview({
      entityType: "webinar",
      webinar: {
        title: "Fetal Echo Update",
        accessType: "paid",
        pricingOptions: JSON.stringify([{ id: "standard", price: 49.5, label: "Standard" }]),
      },
    });

    expect(download?.displayPrice).toBe(29.97);
    expect(webinar?.displayPrice).toBe(49.5);
  });

  it("keeps public catalog preview separate from payment-session creation in the hosted checkout", () => {
    const checkout = readProjectFile("client/src/pages/Checkout.tsx");

    expect(checkout).toContain("trpc.lms.getCourse.useQuery");
    expect(checkout).toContain("trpc.downloads.getBySlug.useQuery");
    expect(checkout).toContain("trpc.products.getBySlug.useQuery");
    expect(checkout).toContain("trpc.webinar.getBySlug.useQuery");
    expect(checkout).toContain("trpc.membership.getBySlug.useQuery");
    expect(checkout).toContain("const checkoutMeta = sessionMeta ?? publicPreviewMeta;");
    expect(checkout).toContain("if (!slug || !hasValidLearnerDetails");
  });

  it("keeps checkout response display prices in dollar units", () => {
    const downloads = readProjectFile("server/routers/downloadsRouter.ts");
    const webinars = readProjectFile("server/routers/webinarRouter.ts");

    expect(downloads).toContain("displayPrice: Number(product.price)");
    expect(webinars).toContain("displayPrice: priceCents / 100");
  });
});
