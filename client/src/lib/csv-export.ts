/**
 * Minimal CSV helpers (RFC4180-style quoting) + browser download via Blob.
 */

export function csvEscapeCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** One row = one array of cell values; first row is often headers. */
export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => row.map(csvEscapeCell).join(",")).join("\n");
}

export type DownloadCsvOptions = {
  /** Prepend UTF-8 BOM so Excel opens UTF-8 correctly on some locales */
  utf8Bom?: boolean;
};

export function downloadCsv(
  content: string,
  filename: string,
  options: DownloadCsvOptions = { utf8Bom: true }
): void {
  const prefix = options.utf8Bom === false ? "" : "\uFEFF";
  const blob = new Blob([prefix + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
