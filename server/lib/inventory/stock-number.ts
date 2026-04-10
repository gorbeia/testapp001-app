/**
 * Parse `products.stock` / `min_stock` and movement deltas.
 * Values are stored as text to avoid float drift in the DB.
 */
export function parseStockNumber(value: string): number {
  const n = parseFloat(value);
  return n;
}

export function isValidStockString(value: string): boolean {
  if (value.trim() === "") return false;
  const n = parseFloat(value);
  return Number.isFinite(n);
}

/** Serialize a numeric stock for `products.stock` / movement rows. */
export function formatStockNumber(n: number): string {
  if (!Number.isFinite(n)) {
    return "0";
  }
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  if (s === "" || s === "-") return "0";
  return s;
}
