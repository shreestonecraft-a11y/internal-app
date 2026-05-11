export const CSV_HEADERS = ["Stone Name", "Size", "Packing", "Quantity", "Location", "Notes"] as const;

const TEMPLATE_ROWS = [
  ["Mint Sandstone", "24x24", "10 Sqft/box", "50", "Showroom", "Optional remarks"],
  ["Black Granite", "12x12", "5 Sqft/box", "100", "Godown", ""],
];

export function buildTemplateCsv(): string {
  const lines = [CSV_HEADERS.join(","), ...TEMPLATE_ROWS.map(r => r.map(csvEscape).join(","))];
  return lines.join("\n");
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseRows(text);
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(cell => cell.trim() !== ""))
    .map(r => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/^﻿/, "");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && t[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
