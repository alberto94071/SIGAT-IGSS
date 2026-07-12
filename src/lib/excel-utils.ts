"use client";
import * as XLSX from "xlsx";

// Genera y descarga una plantilla .xlsx: fila 1 = encabezados, fila 2 = un
// ejemplo ya lleno para que quede claro qué va en cada columna.
export function descargarPlantillaExcel(filename: string, headers: string[], ejemplo: (string | number)[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ejemplo]);
  ws["!cols"] = headers.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
  XLSX.writeFile(wb, filename);
}

// Lee la primera hoja de un archivo .xlsx/.xls y devuelve las filas de datos
// (sin la fila 1 de encabezados, sin filas completamente vacías).
export async function leerFilasExcel(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  return data.slice(1).filter(row => Array.isArray(row) && row.some(c => c !== null && c !== ""));
}

export function celdaTexto(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function celdaNumero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Acepta "SI"/"SÍ"/"YES"/"TRUE"/"1" como verdadero; cualquier otra cosa (incluido vacío) es falso.
export function celdaBooleano(v: unknown): boolean {
  const s = celdaTexto(v).toUpperCase();
  return s === "SI" || s === "SÍ" || s === "YES" || s === "TRUE" || s === "1" || s === "X";
}
