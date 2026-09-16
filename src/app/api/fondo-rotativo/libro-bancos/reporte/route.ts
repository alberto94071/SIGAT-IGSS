import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { requireTabAccessAction } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getRegistroBancos } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

// Exportar Libro Bancos (2026-09-16) — mismo formato que
// ImprimirLibroBancosClient.tsx (título de rango en barra azul, encabezado
// verde oliva, columnas Fecha/Tipo de Documento/No. Documento/Beneficiario/
// Descripción/Estado/Crédito/Débito/Saldo, más las secciones "Conciliación
// del estado de cuenta monetaria" y "Resumen de libro de bancos"), a
// partir de MODELO_LIBRO_BANCOS.pdf que mandó el cliente. "Saldo según
// estado de cuenta" se precarga desde el query param `saldoCorte` (modal
// "Saldo a corte" en LibroBancosClient.tsx, 2026-09-16) en vez de quedar
// vacío — la celda sigue editable en Excel por si hace falta corregirlo.
// "Cheques en circulación" ya no es un proxy sobre status === "Operado" —
// lista los cheques marcados explícitamente "En circulación" en Fondo
// Rotativo/Bancos (ver MovimientoBancoTotal.status).
const MESES_CAP = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ultimoDiaDelMes(anio: number, mesNum: number): number {
  return new Date(anio, mesNum, 0).getDate();
}

export async function GET(req: NextRequest) {
  const acceso = await requireTabAccessAction("mod_fondo_rotativo", "tab_fr_libro_bancos");
  if ("error" in acceso) return Response.json({ error: acceso.error }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const mes = searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return Response.json({ error: "Mes inválido" }, { status: 400 });
  const [anio, mesNum] = mes.split("-").map(Number);
  const saldoCorteParam = searchParams.get("saldoCorte");
  const saldoCorte = saldoCorteParam != null && saldoCorteParam.trim() !== "" ? Number(saldoCorteParam) : null;

  const [movimientos, [config]] = await Promise.all([
    getRegistroBancos(),
    db.select().from(configuracion).limit(1),
  ]);
  const delMes = movimientos.filter(m => m.fecha.slice(0, 7) === mes);
  const anteriores = movimientos.filter(m => m.fecha.slice(0, 7) < mes);
  const saldoAnterior = anteriores.length > 0 ? anteriores[anteriores.length - 1].saldo : (config?.monto_fondo_rotativo ?? 0);
  const totalCredito = delMes.reduce((s, m) => s + m.ingresos, 0);
  const totalDebito = delMes.reduce((s, m) => s + m.egresos, 0);
  const saldoFinal = delMes.length > 0 ? delMes[delMes.length - 1].saldo : saldoAnterior;

  const depositos = delMes.filter(m => m.tipoDocumento === "Depósito").reduce((s, m) => s + m.ingresos, 0);
  const chequesAnulados = delMes.filter(m => m.status === "Anulado").reduce((s, m) => s + m.egresos, 0);
  const chequesEmitidos = delMes.filter(m => m.tipoDocumento !== "Depósito").reduce((s, m) => s + m.egresos, 0);
  const saldoFinalResumen = saldoAnterior + depositos + chequesAnulados - chequesEmitidos;
  const chequesEnCirculacion = delMes.filter(m => m.tipoDocumento !== "Depósito" && m.status === "En circulación");
  const circulacionNos = chequesEnCirculacion.map(m => m.numeroCheque).filter(Boolean).join(", ");
  const circulacionMonto = chequesEnCirculacion.reduce((s, m) => s + m.egresos, 0);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Libro Bancos");
  ws.columns = [
    { key: "fecha", width: 12 }, { key: "tipo", width: 15 }, { key: "numero", width: 12 },
    { key: "beneficiario", width: 26 }, { key: "descripcion", width: 45 }, { key: "estado", width: 11 },
    { key: "credito", width: 13 }, { key: "debito", width: 13 }, { key: "saldo", width: 13 },
  ];

  ws.mergeCells(1, 1, 1, 9);
  const tituloCell = ws.getCell(1, 1);
  tituloCell.value = `Movimiento correspondiente del 1 al ${ultimoDiaDelMes(anio, mesNum)} de ${MESES_CAP[mesNum - 1] ?? mes} de ${anio}`;
  tituloCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  tituloCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, 9);
  const subtituloCell = ws.getCell(2, 1);
  subtituloCell.value = "Cifras expresadas en Quetzales";
  subtituloCell.alignment = { horizontal: "center" };
  subtituloCell.font = { italic: true, size: 9 };

  const encabezados = ["Fecha", "Tipo de Documento", "No. Documento", "Beneficiario", "Descripción", "Estado", "Crédito", "Débito", "Saldo"];
  const headerRow = ws.getRow(3);
  encabezados.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A5A2A" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.eachCell(c => { c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });

  for (const m of delMes) {
    const row = ws.addRow({
      fecha: m.fecha, tipo: m.tipoDocumento, numero: m.numeroCheque ?? "",
      beneficiario: m.beneficiario ?? "", descripcion: m.descripcion, estado: m.status,
      credito: m.ingresos || "", debito: m.egresos || "", saldo: m.saldo,
    });
    row.getCell(7).numFmt = "Q#,##0.00";
    row.getCell(8).numFmt = "Q#,##0.00";
    row.getCell(9).numFmt = "Q#,##0.00";
  }

  const filaTotales = ws.addRow({
    fecha: "", tipo: "", numero: "", beneficiario: "", descripcion: "", estado: `Saldo al ${ultimoDiaDelMes(anio, mesNum)} de ${MESES_CAP[mesNum - 1] ?? mes} de ${anio}`,
    credito: totalCredito, debito: totalDebito, saldo: saldoFinal,
  });
  filaTotales.font = { bold: true };
  filaTotales.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  filaTotales.getCell(6).alignment = { horizontal: "right" };
  filaTotales.getCell(7).numFmt = "Q#,##0.00";
  filaTotales.getCell(8).numFmt = "Q#,##0.00";
  filaTotales.getCell(9).numFmt = "Q#,##0.00";

  // ── Conciliación del estado de cuenta monetaria ──────────────────────
  ws.addRow([]);
  const filaConcTitulo = ws.addRow(["Conciliación del estado de cuenta monetaria"]);
  ws.mergeCells(filaConcTitulo.number, 1, filaConcTitulo.number, 8);
  filaConcTitulo.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaConcTitulo.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A5A2A" } };
  filaConcTitulo.getCell(1).alignment = { horizontal: "center" };

  const filaSaldoBanco = ws.addRow([`Saldo final según estado de cuenta al ${ultimoDiaDelMes(anio, mesNum)} de ${MESES_CAP[mesNum - 1] ?? mes} de ${anio}`]);
  ws.mergeCells(filaSaldoBanco.number, 1, filaSaldoBanco.number, 8);
  if (saldoCorte != null) filaSaldoBanco.getCell(9).value = saldoCorte;
  filaSaldoBanco.getCell(9).numFmt = "Q#,##0.00"; // precargado desde "Saldo a corte", editable en Excel

  const filaCirculacion = ws.addRow([`(-) Integración de cheques en circulación Nos. ${circulacionNos || "—"}`]);
  ws.mergeCells(filaCirculacion.number, 1, filaCirculacion.number, 8);
  filaCirculacion.getCell(9).value = circulacionMonto || undefined;
  filaCirculacion.getCell(9).numFmt = "Q#,##0.00"; // sugerido, editable

  const filaConciliado = ws.addRow(["Saldo final conciliado"]);
  ws.mergeCells(filaConciliado.number, 1, filaConciliado.number, 8);
  filaConciliado.font = { bold: true };
  filaConciliado.getCell(9).value = { formula: `I${filaSaldoBanco.number}-I${filaCirculacion.number}` };
  filaConciliado.getCell(9).numFmt = "Q#,##0.00";
  filaConciliado.getCell(9).font = { bold: true };

  // ── Resumen de libro de bancos ────────────────────────────────────────
  ws.addRow([]);
  const filaResTitulo = ws.addRow(["Resumen de libro de bancos"]);
  ws.mergeCells(filaResTitulo.number, 1, filaResTitulo.number, 8);
  filaResTitulo.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaResTitulo.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A5A2A" } };
  filaResTitulo.getCell(1).alignment = { horizontal: "center" };

  const filaResumen = (label: string, valor: number, bold = false) => {
    const row = ws.addRow([label]);
    ws.mergeCells(row.number, 1, row.number, 8);
    row.getCell(9).value = valor;
    row.getCell(9).numFmt = "Q#,##0.00";
    if (bold) { row.font = { bold: true }; row.getCell(9).font = { bold: true }; }
  };
  filaResumen("Saldo inicial del libro de banco", saldoAnterior);
  filaResumen("(+) Depósitos", depositos);
  filaResumen("(+) Notas de Crédito", 0);
  filaResumen("(+) Cheques anulados", chequesAnulados);
  filaResumen("(-) Cheques emitidos", chequesEmitidos);
  filaResumen("(-) Notas de débito", 0);
  filaResumen("Saldo final conciliado", saldoFinalResumen, true);

  ws.views = [{ state: "frozen", ySplit: 3 }];

  const salida = Buffer.from(await wb.xlsx.writeBuffer());
  const nombreArchivo = `libro-bancos-${mes}.xlsx`;
  return new Response(new Uint8Array(salida), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
