import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInvoicePrintDocument,
  formatWorkshopInvoiceInstance,
  INVOICE_BRAND_FOOTER,
  INVOICE_LOGO_URL,
} from "../client/src/lib/printInvoice";
import { buildReceiptParticipants } from "./lib/receiptParticipants";

describe("branded invoice print document", () => {
  it("preserves application styles, invoice markup, and the supplied company logo", () => {
    const invoiceMarkup = `<section data-invoice-document class="rounded-xl bg-gradient-to-r"><img data-invoice-logo src="${INVOICE_LOGO_URL}" alt="All About Ultrasound and iHeartEcho"><p>Invoice total</p></section>`;
    const html = buildInvoicePrintDocument({
      title: "Invoice / Receipt",
      invoiceHtml: invoiceMarkup,
      appStyleMarkup: "<style>.bg-gradient-to-r { background: linear-gradient(90deg, #0e4a50, #189aa1); }</style>",
      baseUrl: "https://learn.allaboutultrasound.com/",
    });

    expect(html).toContain('<base href="https://learn.allaboutultrasound.com/">');
    expect(html).toContain(".bg-gradient-to-r");
    expect(html).toContain("data-invoice-document");
    expect(html).toContain(INVOICE_LOGO_URL);
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("@page { size: letter");
  });

  it("escapes the document title while retaining the rendered invoice document", () => {
    const html = buildInvoicePrintDocument({
      title: 'Receipt <script>alert("unsafe")</script>',
      invoiceHtml: '<article data-invoice-document>Paid</article>',
      appStyleMarkup: "",
      baseUrl: "https://learn.iheartecho.com/",
    });

    expect(html).toContain("Receipt &lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;");
    expect(html).toContain('<article data-invoice-document>Paid</article>');
  });

  it("uses the approved footer identity and support mailbox on every rendered invoice", () => {
    expect(INVOICE_BRAND_FOOTER).toEqual({
      issuer: "All About Ultrasound™, Inc. dba iHeartEcho™",
      allAboutUltrasoundWebsite: "www.allaboutultrasound.com",
      iHeartEchoWebsite: "www.iheartecho.com",
      supportEmail: "support@allaboutultrasound.com",
    });
  });

  it("renders a selected workshop instance without inventing one", () => {
    expect(formatWorkshopInvoiceInstance("Adult Echo — Fall Session", 44)).toBe("Adult Echo — Fall Session");
    expect(formatWorkshopInvoiceInstance("   ", 44)).toBe("Instance #44");
    expect(formatWorkshopInvoiceInstance(null, null)).toBeNull();
  });

  it("projects workshop instance data into learner and administrator invoice payloads", () => {
    const learnerPurchases = readFileSync(new URL("./routers/dashboardRouter.ts", import.meta.url), "utf8");
    const administratorTransactions = readFileSync(new URL("./routers/productAnalyticsRouter.ts", import.meta.url), "utf8");

    for (const source of [learnerPurchases, administratorTransactions]) {
      expect(source).toContain("workshopInstanceId: workshopEnrollments.instanceId");
      expect(source).toContain("workshopInstanceTitle: workshopInstances.title");
      expect(source).toContain(".leftJoin(workshopInstances, eq(workshopEnrollments.instanceId, workshopInstances.id))");
    }
  });

  it("links learner receipts to the public Terms of Service page", () => {
    const learnerReceipt = readFileSync(new URL("../client/src/pages/StudentDashboardPage.tsx", import.meta.url), "utf8");
    expect(learnerReceipt).toContain('href="https://www.allaboutultrasound.com/terms.html"');
    expect(learnerReceipt).not.toContain('href="https://app.allaboutultrasound.com/terms"');
  });

  it("shows only the registered learner when the learner is also the purchaser", () => {
    expect(buildReceiptParticipants(
      { name: "Registered Learner", email: "learner@example.com" },
      { name: "Same Learner", email: "LEARNER@example.com" },
    )).toEqual({
      learner: { name: "Registered Learner", email: "learner@example.com" },
      payer: null,
    });
  });

  it("retains a different purchaser alongside the registered learner", () => {
    expect(buildReceiptParticipants(
      { name: "Registered Learner", email: "learner@example.com" },
      { name: "Institution Buyer", email: "buyer@example.com" },
    )).toEqual({
      learner: { name: "Registered Learner", email: "learner@example.com" },
      payer: { name: "Institution Buyer", email: "buyer@example.com" },
    });
  });
});
