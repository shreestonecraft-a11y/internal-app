import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";
import { Invoice, BusinessSettings } from "./store";

function formatINR(n: number) {
  return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function downloadInvoicePdf(inv: Invoice, settings?: BusinessSettings) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const RED: [number, number, number] = [220, 38, 38];
  const DARK: [number, number, number] = [24, 24, 27];
  const MUTED: [number, number, number] = [113, 113, 122];

  const businessName = settings?.businessName || "Shree Stone Craft";
  const businessGstin = settings?.gstin || "";
  const businessAddress = settings?.address || "";
  const businessPhone = settings?.phone || "";

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 90, "F");

  try { doc.addImage(logo, "PNG", 40, 22, 46, 46); } catch { /* ignore */ }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(businessName.toUpperCase(), 100, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  const subline = [businessGstin ? `GSTIN: ${businessGstin}` : null, businessPhone].filter(Boolean).join(" · ");
  doc.text(subline || "Premium Stone Manufacturing & Trading", 100, 60);
  if (businessAddress) {
    doc.setFontSize(8);
    doc.text(businessAddress, 100, 73);
  }

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TAX INVOICE", W - 40, 50, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(inv.number, W - 40, 68, { align: "right" });

  doc.setFillColor(...RED);
  doc.rect(0, 90, W, 3, "F");

  // Bill to / Date
  let y = 125;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 40, y);
  doc.text("INVOICE DATE", W - 200, y);

  y += 14;
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(inv.customerName || "—", 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(inv.date), W - 200, y);

  if (inv.customerAddress) {
    y += 13;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(inv.customerAddress, 280);
    doc.text(lines, 40, y);
    y += (lines.length - 1) * 11;
  }
  if (inv.customerGstin) {
    y += 13;
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${inv.customerGstin}`, 40, y);
    doc.setFont("helvetica", "normal");
  }

  // Items table — with HSN + GST%
  const body = inv.items.map((it, i) => [
    String(i + 1),
    `${it.name}${it.size ? "\n" + it.size : ""}${it.packing ? " · " + it.packing : ""}`,
    it.hsnCode || "—",
    String(it.quantity),
    formatINR(it.rate),
    `${it.gstPercent}%`,
    formatINR(it.quantity * it.rate),
  ]);

  autoTable(doc, {
    startY: y + 25,
    head: [["#", "Item & Description", "HSN", "Qty", "Rate", "GST", "Amount"]],
    body,
    theme: "plain",
    headStyles: {
      fillColor: DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: { fontSize: 9.5, textColor: DARK, cellPadding: 7 },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" },
      2: { cellWidth: 50, halign: "center", fontStyle: "bold" },
      3: { halign: "right", cellWidth: 40 },
      4: { halign: "right", cellWidth: 65 },
      5: { halign: "right", cellWidth: 40 },
      6: { halign: "right", cellWidth: 75, fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error lastAutoTable is added by autoTable plugin
  let endY: number = doc.lastAutoTable.finalY + 15;
  const rightX = W - 40;
  const labelX = rightX - 200;

  // Totals breakdown
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Subtotal
  doc.setTextColor(...MUTED);
  doc.text("Subtotal", labelX, endY);
  doc.setTextColor(...DARK);
  doc.text(formatINR(inv.subtotal), rightX, endY, { align: "right" });
  endY += 16;

  // Tax breakdown
  if (inv.isInterState) {
    doc.setTextColor(...MUTED);
    doc.text("IGST", labelX, endY);
    doc.setTextColor(...DARK);
    doc.text(formatINR(inv.igstAmount), rightX, endY, { align: "right" });
    endY += 16;
  } else {
    doc.setTextColor(...MUTED);
    doc.text("CGST", labelX, endY);
    doc.setTextColor(...DARK);
    doc.text(formatINR(inv.cgstAmount), rightX, endY, { align: "right" });
    endY += 14;
    doc.setTextColor(...MUTED);
    doc.text("SGST", labelX, endY);
    doc.setTextColor(...DARK);
    doc.text(formatINR(inv.sgstAmount), rightX, endY, { align: "right" });
    endY += 16;
  }

  // Grand total bar
  endY += 4;
  doc.setFillColor(...DARK);
  doc.rect(rightX - 220, endY, 220, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GRAND TOTAL", rightX - 210, endY + 20);
  doc.setTextColor(...RED);
  doc.setFontSize(14);
  doc.text(formatINR(inv.total), rightX - 10, endY + 21, { align: "right" });

  // Notes
  if (inv.customerNotes) {
    const notesY = endY + 60;
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("NOTES", 40, notesY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(inv.customerNotes, W - 80);
    doc.text(lines, 40, notesY + 14);
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(230, 230, 230);
  doc.line(40, pageH - 50, W - 40, pageH - 50);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text(`Thank you for your business — ${businessName}`, W / 2, pageH - 30, { align: "center" });

  doc.save(`${inv.number}.pdf`);
}
