import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { fechaGuatemala } from "@/lib/date-utils";
import { getLibroCajaChicaLedger } from "@/lib/caja-chica-liquidacion-actions";

// Exportar Libro Caja Chica (2026-09-16) — mismo formato/colores que pidió
// el cliente en MODELO_LIBRO_CAJA_CHICA.pdf: título de rango de fechas en
// barra azul oscuro, encabezado de tabla verde oliva oscuro, columnas
// Fecha/Tipo de Documento/No. Documento/Beneficiario/Descripción del
// Desembolso/Crédito/Debito/Saldo. A diferencia de los reportes de Almacén
// (varios tipos por query param `tipo`), este es un solo formato por mes —
// mismo dato que ya usa la impresión (getLibroCajaChicaLedger), filtrado
// por el query param `mes` (YYYY-MM).
const MESES_CAP = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ultimoDiaDelMes(anio: number, mesNum: number): number {
  return new Date(anio, mesNum, 0).getDate();
}

export async function GET(req: NextRequest) {
  const acceso = await requireTabAccessAction("mod_caja_chica", "tab_cajachica_libro");
  if ("error" in acceso) return Response.json({ error: acceso.error }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mes = searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return Response.json({ error: "Mes inválido" }, { status: 400 });
  const [anio, mesNum] = mes.split("-").map(Number);

  const movimientos = await getLibroCajaChicaLedger();
  const delMes = movimientos.filter(m => m.fecha.slice(0, 7) === mes);
  const anteriores = movimientos.filter(m => m.fecha.slice(0, 7) < mes);
  const saldoInicial = anteriores.length > 0 ? anteriores[anteriores.length - 1].saldo : 0;
  const totalCredito = delMes.reduce((s, m) => s + m.credito, 0);
  const totalDebito = delMes.reduce((s, m) => s + m.debito, 0);
  const saldoFinal = delMes.length > 0 ? delMes[delMes.length - 1].saldo : saldoInicial;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Libro Caja Chica");
  ws.columns = [
    { key: "fecha", width: 12 }, { key: "tipo", width: 16 }, { key: "numero", width: 14 },
    { key: "beneficiario", width: 30 }, { key: "descripcion", width: 45 },
    { key: "credito", width: 14 }, { key: "debito", width: 14 }, { key: "saldo", width: 14 },
  ];

  ws.mergeCells(1, 1, 1, 8);
  const tituloCell = ws.getCell(1, 1);
  tituloCell.value = `Movimiento correspondiente del 1 al ${ultimoDiaDelMes(anio, mesNum)} de ${MESES_CAP[mesNum - 1] ?? mes} de ${anio}`;
  tituloCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, 8);
  const subtituloCell = ws.getCell(2, 1);
  subtituloCell.value = "Cifras expresadas en Quetzales";
  subtituloCell.alignment = { horizontal: "center" };
  subtituloCell.font = { italic: true, size: 9 };

  const encabezados = ["Fecha", "Tipo de Documento", "No. Documento", "Beneficiario", "Descripción del Desembolso", "Crédito", "Debito", "Saldo"];
  const headerRow = ws.getRow(3);
  encabezados.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A5A2A" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.eachCell(c => { c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });

  const filaSaldoInicial = ws.addRow({ fecha: "", tipo: "", numero: "", beneficiario: "", descripcion: "Saldo inicial del mes", credito: "", debito: "", saldo: saldoInicial });
  filaSaldoInicial.font = { bold: true };
  filaSaldoInicial.getCell(8).numFmt = "Q#,##0.00";

  for (const m of delMes) {
    const row = ws.addRow({
      fecha: m.fecha, tipo: m.tipoDocumento, numero: m.numeroDocumento,
      beneficiario: m.beneficiario, descripcion: m.descripcion,
      credito: m.credito || "", debito: m.debito || "", saldo: m.saldo,
    });
    row.getCell(6).numFmt = "Q#,##0.00";
    row.getCell(7).numFmt = "Q#,##0.00";
    row.getCell(8).numFmt = "Q#,##0.00";
  }

  const filaTotales = ws.addRow({ fecha: "", tipo: "", numero: "", beneficiario: "", descripcion: "Totales del mes", credito: totalCredito, debito: totalDebito, saldo: saldoFinal });
  filaTotales.font = { bold: true };
  filaTotales.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  filaTotales.getCell(6).numFmt = "Q#,##0.00";
  filaTotales.getCell(7).numFmt = "Q#,##0.00";
  filaTotales.getCell(8).numFmt = "Q#,##0.00";

  ws.views = [{ state: "frozen", ySplit: 3 }];

  const salida = Buffer.from(await wb.xlsx.writeBuffer());
  const nombreArchivo = `libro-caja-chica-${mes}.xlsx`;
  return new Response(new Uint8Array(salida), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
