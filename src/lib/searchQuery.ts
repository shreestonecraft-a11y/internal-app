// Parses search input for a minimum-quantity intent.
// Recognizes: "100sft", "100 sqft", ">=100", ">100", "100+", "min 100", "min:100", "qty>100"
// Returns { min, text } where `text` is the remaining free-text search.
export function parseSearchQuery(raw: string): { min: number | null; text: string } {
  if (!raw) return { min: null, text: "" };
  let text = raw;
  let min: number | null = null;

  const patterns: RegExp[] = [
    /\b(?:min|minimum|qty|quantity)\s*[:=]?\s*(\d+(?:\.\d+)?)\b/i,
    />=\s*(\d+(?:\.\d+)?)/,
    />\s*(\d+(?:\.\d+)?)/,
    /\b(\d+(?:\.\d+)?)\s*\+/,
    /\b(\d+(?:\.\d+)?)\s*(?:sft|sqft|sq\.?\s*ft|sq\.?\s*feet|pcs|pieces|nos)\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1]);
      if (!isNaN(v)) {
        min = min === null ? v : Math.max(min, v);
        text = text.replace(re, " ");
      }
    }
  }

  return { min, text: text.replace(/\s+/g, " ").trim() };
}
