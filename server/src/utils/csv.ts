// Spreadsheet-safe CSV. Cells that start with = + - @ (or a tab/return) are prefixed with ' so Excel
// shows them as text instead of running them as formulas, since some cells hold text people typed.
// Quotes, commas and line breaks are escaped. The file starts with a BOM so Excel reads UTF-8 (names, ₹) correctly.
export function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return "﻿" + [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}
