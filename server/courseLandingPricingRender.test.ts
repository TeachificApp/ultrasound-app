import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RenderBlock, formatPrice } from "../client/src/pages/CourseLanding";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  containers.splice(0).forEach((container) => container.remove());
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

describe("CourseLanding pricing card display", () => {
  it("renders the authored $2,297.00 primary price and selected cohort offer before checkout", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    const course = {
      id: 44,
      title: "Adult Echocardiography Cohort",
      status: "public",
      price: "2297.00",
      pricingType: "one_time",
      isFree: false,
      pricingOptions: [{ id: 45, label: "Cohort tuition", price: "2297.00", pricingType: "one_time", isActive: true }],
      sections: [],
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(React.createElement(RenderBlock, {
        block: { id: "price-cards", type: "pricing_options_auto", data: {} } as any,
        course,
        onEnroll: () => undefined,
        onEnrollWithOption: () => undefined,
        enrolling: false,
        ctaText: "Enroll Now",
        price: formatPrice(course),
        selectedPricingOptionId: 45,
        onSelectPricingOption: () => undefined,
      }));
    });

    expect(container.textContent).toContain("$2,297.00");
    expect(container.textContent?.match(/\$2,297\.00/g)).toHaveLength(2);
  });
});
