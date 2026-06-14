/**
 * exportAnalyticsPdf
 * Captures all chart/table containers inside a given root element and
 * assembles them into a multi-page PDF using html2canvas + jsPDF.
 *
 * Usage:
 *   await exportAnalyticsPdf(containerRef.current, "Form Report – My Form", "my-form-report");
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const BRAND_TEAL = "#189aa1";
const PAGE_MARGIN = 14; // mm
const PAGE_W = 210; // A4 width mm
const PAGE_H = 297; // A4 height mm
const CONTENT_W = PAGE_W - PAGE_MARGIN * 2;
const HEADER_H = 18; // mm reserved for header band on first page
const FOOTER_H = 8; // mm reserved for footer

/**
 * Draw a thin teal header band on the first page.
 */
function drawHeader(pdf: jsPDF, title: string, exportDate: string) {
  pdf.setFillColor(BRAND_TEAL);
  pdf.rect(0, 0, PAGE_W, HEADER_H - 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(title, PAGE_MARGIN, HEADER_H - 7);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Exported ${exportDate}`, PAGE_W - PAGE_MARGIN, HEADER_H - 7, { align: "right" });
  pdf.setTextColor(0, 0, 0);
}

/**
 * Draw a footer line with page number.
 */
function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_H - FOOTER_H + 3;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(PAGE_MARGIN, y - 2, PAGE_W - PAGE_MARGIN, y - 2);
  pdf.setFontSize(7);
  pdf.setTextColor(150, 150, 150);
  pdf.text("UltrasoundAssist™ Analytics", PAGE_MARGIN, y);
  pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - PAGE_MARGIN, y, { align: "right" });
  pdf.setTextColor(0, 0, 0);
}

/**
 * Find all exportable chart/table containers inside the root element.
 * Elements must have the attribute data-pdf-export="true".
 */
function findExportTargets(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-export='true']"));
}

export async function exportAnalyticsPdf(
  root: HTMLElement | null,
  reportTitle: string,
  filename = "analytics-report"
): Promise<void> {
  if (!root) return;

  const targets = findExportTargets(root);
  if (targets.length === 0) {
    // Fall back to capturing the entire root if no tagged elements found
    targets.push(root);
  }

  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Capture all canvases first (before creating PDF so we know total pages)
  const canvases: HTMLCanvasElement[] = [];
  for (const el of targets) {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    canvases.push(canvas);
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Calculate total pages needed
  let totalPages = 0;
  const pageBreaks: number[] = []; // cumulative page count before each canvas
  let availableH = PAGE_H - HEADER_H - FOOTER_H - PAGE_MARGIN;

  for (const canvas of canvases) {
    pageBreaks.push(totalPages);
    const imgH = (canvas.height / canvas.width) * CONTENT_W;
    const pagesNeeded = Math.ceil(imgH / availableH);
    totalPages += pagesNeeded;
    // After first canvas, full page height is available
    availableH = PAGE_H - FOOTER_H - PAGE_MARGIN * 2;
  }
  if (totalPages === 0) totalPages = 1;

  let currentPage = 1;
  let isFirstPage = true;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const imgData = canvas.toDataURL("image/png");
    const imgW = CONTENT_W;
    const imgH = (canvas.height / canvas.width) * imgW;

    const topMargin = isFirstPage ? HEADER_H : PAGE_MARGIN;
    const maxH = PAGE_H - topMargin - FOOTER_H - PAGE_MARGIN;

    if (i > 0) {
      // Add a new page before each subsequent chart
      pdf.addPage();
      currentPage++;
    }

    if (isFirstPage) {
      drawHeader(pdf, reportTitle, exportDate);
    }

    // Slice the image across pages if it's taller than one page
    let srcY = 0;
    let yOnPage = topMargin;
    let remainingImgH = imgH;

    while (remainingImgH > 0) {
      const sliceH = Math.min(remainingImgH, maxH);
      // srcY in canvas pixels
      const srcYPx = (srcY / imgH) * canvas.height;
      const sliceHPx = (sliceH / imgH) * canvas.height;

      // Create a slice canvas
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHPx;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcYPx, canvas.width, sliceHPx, 0, 0, canvas.width, sliceHPx);
      const sliceData = sliceCanvas.toDataURL("image/png");

      pdf.addImage(sliceData, "PNG", PAGE_MARGIN, yOnPage, imgW, sliceH);
      drawFooter(pdf, currentPage, totalPages);

      srcY += sliceH;
      remainingImgH -= sliceH;

      if (remainingImgH > 0) {
        pdf.addPage();
        currentPage++;
        yOnPage = PAGE_MARGIN;
      }
    }

    isFirstPage = false;
  }

  pdf.save(`${filename}.pdf`);
}
