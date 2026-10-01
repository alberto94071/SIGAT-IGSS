import ExcelJS from "exceljs";
import { requireModuloAccessAction, requireTabAccessAction } from "@/lib/modulo-access";
import { getReporteA01SiafCompleto } from "@/lib/reportes/compras-actions";
import { fechaGuatemala } from "@/lib/date-utils";

function estilizarEncabezado(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { vertical: "middle" };
  ws.columns.forEach(col => { col.width = Math.max((col.width ?? 10), 14); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET() {
  const acceso = await requireModuloAccessAction("mod_reportes");
  if ("error" in acceso) return Response.json({ error: acceso.error }, { status: 403 });
  const tab = await requireTabAccessAction("mod_reportes", "tab_reportes_compras_a01siaf");
  if ("error" in tab) return Response.json({ error: tab.error }, { status: 403 });

  const filas = await getReporteA01SiafCompleto();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("A-01 SIAF");
  ws.columns = [
    { header: "No. SIAF", key: "no_siaf" },
    { header: "Fecha", key: "fecha" },
    { header: "Estado", key: "estado" },
    { header: "Insumo", key: "insumo", width: 45 },
    { header: "Subproducto", key: "subproducto" },
    { header: "Renglón", key: "renglon" },
    { header: "PPR / Código", key: "ppr" },
    { header: "Cantidad", key: "cantidad" },
    { header: "Características PPR", key: "caracteristicas", width: 45 },
    { header: "Presentación", key: "presentacion" },
    { header: "Unidad de Medida", key: "unidad_medida" },
  ];
  for (const f of filas) {
    ws.addRow({
      no_siaf: `${f.siaf_numero}/${f.siaf_anio}`,
      fecha: f.siaf_fecha,
      estado: f.siaf_estado,
      insumo: f.insumo,
      subproducto: f.subproducto,
      renglon: f.renglon ?? "",
      ppr: f.codigo_o_ppr,
      cantidad: f.cantidad,
      caracteristicas: f.caracteristicas ?? "",
      presentacion: f.presentacion ?? "",
      unidad_medida: f.unidad_medida ?? "",
    });
  }
  estilizarEncabezado(ws);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-a01-siaf-${fechaGuatemala()}.xlsx"`,
    },
  });
}
