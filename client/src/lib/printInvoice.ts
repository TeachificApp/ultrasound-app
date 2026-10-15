export const INVOICE_LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663401463434/iQsDpCNNbRktfBlU.jpg";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Carries the active application styles into the dedicated print window. The
 * invoice itself is already rendered by React, so this keeps the saved/printed
 * version visually identical to the reviewed invoice instead of discarding its
 * Tailwind design classes.
 */
export function getInvoicePrintStyleMarkup(documentRef: Document): string {
  return Array.from(documentRef.head.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node instanceof HTMLLinkElement) {
        return `<link rel="stylesheet" href="${escapeHtml(node.href)}">`;
      }
      return node.outerHTML;
    })
    .join("\n");
}

export function buildInvoicePrintDocument({
  title,
  invoiceHtml,
  appStyleMarkup,
  baseUrl,
}: {
  title: string;
  invoiceHtml: string;
  appStyleMarkup: string;
  baseUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="${escapeHtml(baseUrl)}">
    <title>${escapeHtml(title)}</title>
    ${appStyleMarkup}
    <style>
      @page { size: letter; margin: 0.45in; }
      html { background: #ffffff; }
      body {
        margin: 0;
        padding: 32px;
        background: #ffffff;
        color: #1e293b;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #invoice-print-document {
        width: 100%;
        max-width: 720px;
        margin: 0 auto;
      }
      [data-invoice-document] {
        background: #ffffff !important;
        box-shadow: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [data-invoice-logo] {
        display: block;
        width: min(300px, 88%);
        height: auto;
        margin: 0 auto;
        object-fit: contain;
      }
      @media print {
        html, body { width: 100%; background: #ffffff !important; }
        body { padding: 0; }
        #invoice-print-document { max-width: none; }
        [data-invoice-document] { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main id="invoice-print-document">${invoiceHtml}</main>
  </body>
</html>`;
}

export function printInvoiceElement({
  element,
  title = "Invoice / Receipt",
}: {
  element: HTMLElement | null;
  title?: string;
}): void {
  if (!element) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.opener = null;

  printWindow.document.write(buildInvoicePrintDocument({
    title,
    invoiceHtml: element.outerHTML,
    appStyleMarkup: getInvoicePrintStyleMarkup(document),
    baseUrl: `${window.location.origin}/`,
  }));
  printWindow.document.close();

  const printAfterAssetsLoad = () => {
    const imageLoads = Array.from(printWindow.document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    });

    const assetTimeout = new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
    void Promise.race([Promise.all(imageLoads), assetTimeout]).finally(() => {
      printWindow.focus();
      printWindow.print();
    });
  };

  if (printWindow.document.readyState === "complete") {
    printAfterAssetsLoad();
  } else {
    printWindow.addEventListener("load", printAfterAssetsLoad, { once: true });
  }
}
