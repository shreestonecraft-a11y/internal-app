import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";
import { ReturnSlip } from "./store";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const COMPANY_ADDRESS = "2-4-208/5, Beside Maruthi Nexa Showroom, Snehapuri Colony, Nagole, Hyderabad - 500102";
const COMPANY_GST = "36ADHPD1781B1Z0";

async function buildReturnSlipPdf(slip: ReturnSlip): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const GREEN: [number, number, number] = [22, 163, 74];
  const DARK: [number, number, number] = [24, 24, 27];
  const MUTED: [number, number, number] = [113, 113, 122];

  const HEADER_H = 140;
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, HEADER_H, "F");

  try { doc.addImage(logo, "PNG", 40, 22, 46, 46); } catch { /* ignore */ }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SHREE STONE CRAFT", 100, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text("Stone Inventory · Return Slip", 100, 60);

  const addressLines = doc.splitTextToSize(COMPANY_ADDRESS, W - 100 - 180);
  doc.setFontSize(8.5);
  doc.setTextColor(210, 210, 210);
  doc.text(addressLines, 40, 92);

  const gstY = 92 + addressLines.length * 11 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`GSTIN: ${COMPANY_GST}`, 40, gstY);

  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("RETURN SLIP", W - 40, 50, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(slip.number, W - 40, 68, { align: "right" });

  doc.setFillColor(...GREEN);
  doc.rect(0, HEADER_H, W, 3, "F");

  const META_Y = HEADER_H + 25;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DATE", 40, META_Y);
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(slip.date), 40, META_Y + 15);

  const totalQty = slip.items.reduce((s, it) => s + it.quantity, 0);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL ITEMS", W - 200, META_Y);
  doc.text("TOTAL QUANTITY", W - 100, META_Y);
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(String(slip.items.length), W - 200, META_Y + 17);
  doc.text(String(totalQty), W - 100, META_Y + 17);

  const body = slip.items.map((it, i) => [
    String(i + 1),
    `${it.name}${it.size ? "\n" + it.size : ""}${it.packing ? " · " + it.packing : ""}`,
    String(it.quantity),
  ]);

  autoTable(doc, {
    startY: META_Y + 45,
    head: [["#", "Item & Description", "Qty"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "left",
    },
    bodyStyles: { fontSize: 11, textColor: DARK, cellPadding: 9 },
    columnStyles: {
      0: { cellWidth: 36, halign: "center" },
      2: { halign: "right", cellWidth: 80, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error lastAutoTable is added by autoTable plugin
  let endY: number = doc.lastAutoTable.finalY + 20;

  doc.setFillColor(...DARK);
  doc.rect(W - 240, endY, 200, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL QUANTITY", W - 230, endY + 22);
  doc.setTextColor(...GREEN);
  doc.setFontSize(16);
  doc.text(String(totalQty), W - 50, endY + 23, { align: "right" });

  if (slip.notes) {
    const notesY = endY + 70;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTES", 40, notesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(slip.notes, W - 80);
    doc.text(lines, 40, notesY + 14);
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(230, 230, 230);
  doc.line(40, pageH - 50, W - 40, pageH - 50);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text("Shree Stone Craft — Internal Return Record", W / 2, pageH - 30, { align: "center" });

  return doc;
}

export async function downloadReturnSlipPdf(slip: ReturnSlip) {
  const doc = await buildReturnSlipPdf(slip);
  doc.save(`${slip.number}.pdf`);
}

/**
 * Share PDF using the native Web Share API with the file ONLY (no url, no
 * title, no text). See shareInvoicePdf for rationale.
 */
export async function shareReturnSlipPdf(slip: ReturnSlip): Promise<"shared" | "downloaded" | "cancelled"> {
  const doc = await buildReturnSlipPdf(slip);
  const filename = `${slip.number}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (data: ShareData) => boolean }) : null;
  if (nav && typeof nav.share === "function" && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }

  doc.save(filename);
  return "downloaded";
}
