import { describe, expect, it } from "vitest";
import { buildInvoicePrintDocument, INVOICE_LOGO_URL } from "../client/src/lib/printInvoice";

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
});
