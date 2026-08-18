import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BundleOptionPrice } from "../client/src/pages/BundleLanding";
import { DownloadProductPrice } from "../client/src/pages/DownloadLanding";
import { PhysicalProductPrice } from "../client/src/pages/ProductLanding";

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  containers.splice(0).forEach((container) => container.remove());
  delete (globalThis as any).window;
  delete (globalThis as any).document;
});

async function renderPrice(Component: React.ComponentType<{ price: string }>, price: string) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(React.createElement(Component, { price })));
  return container.textContent;
}

describe("public purchase price rendering", () => {
  it("renders explicitly authored cents in bundle, download, and physical product price components", async () => {
    await expect(renderPrice(BundleOptionPrice, "199.97")).resolves.toBe("$199.97");
    await expect(renderPrice(DownloadProductPrice, "299.97")).resolves.toBe("$299.97");
    await expect(renderPrice(PhysicalProductPrice, "97.00")).resolves.toBe("$97.00");
  });
});
