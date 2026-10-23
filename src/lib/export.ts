/**
 * Helpers d'export : CSV (téléchargement direct) et PDF (impression navigateur).
 * Aucune dépendance externe : le PDF est généré via la boîte d'impression
 * du navigateur ("Enregistrer au format PDF").
 */

export type ExportColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
};

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: ExportColumn<T>[], sep = ";"): string {
  const head = columns.map((c) => csvCell(c.label)).join(sep);
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(sep));
  // BOM UTF-8 pour Excel FR
  return "\uFEFF" + [head, ...body].join("\r\n");
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCSV<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  downloadBlob(toCSV(rows, columns), filename, "text/csv;charset=utf-8");
}

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildPrintableHTML<T>(
  title: string,
  subtitle: string,
  rows: T[],
  columns: ExportColumn<T>[],
): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:#0F172A; }
  h1 { color:#0D7377; font-size:18px; margin:0 0 4px; }
  p.sub { color:#475569; font-size:11px; margin:0 0 16px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#0D7377; color:#fff; text-align:left; padding:6px 8px; }
  td { border-bottom:1px solid #E2E8F0; padding:5px 8px; vertical-align:top; }
  tr:nth-child(even) td { background:#F8FAFC; }
  footer { margin-top:18px; font-size:10px; color:#94A3B8; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="sub">${escapeHtml(subtitle)}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}">Aucune donnée</td></tr>`}</tbody></table>
<footer>Tontine Digitale — document généré le ${new Date().toLocaleString("fr-FR")}</footer>
</body></html>`;
}

/** Ouvre la boîte d'impression du navigateur (choisir « Enregistrer au format PDF »). */
export function exportPDF<T>(
  title: string,
  subtitle: string,
  rows: T[],
  columns: ExportColumn<T>[],
): boolean {
  const html = buildPrintableHTML(title, subtitle, rows, columns);
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
  return true;
}

export function timestampedName(prefix: string, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}
