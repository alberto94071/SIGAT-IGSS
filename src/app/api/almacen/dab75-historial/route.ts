import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import {
  almacenInsumos, almacenLotes, requisicionBodegaDespachos, requisicionBodegaItems,
  requisicionesBodega, ordenesCompra, fondoRotativoPagos, consolidaciones,
} from "@/lib/schema";
import { requireModuloAccessAction, requireTabAccessAction } from "@/lib/modulo-access";
import { fechaGuatemala } from "@/lib/date-utils";
import { eq } from "drizzle-orm";

type Movimiento = { fecha: string; tipo: "Ingreso" | "Egreso"; cantidad: number; documento: string };

export async function GET(req: NextRequest) {
  const acceso = await requireModuloAccessAction("mod_almacen");
  if ("error" in acceso) return Response.json({ error: acceso.error }, { status: 403 });
  const tab = await requireTabAccessAction("mod_almacen", "tab_almacen_archivo");
  if ("error" in tab) return Response.json({ error: tab.error }, { status: 403 });

  const insumoId = Number(req.nextUrl.searchParams.get("insumoId"));
  if (!insumoId || Number.isNaN(insumoId)) return Response.json({ error: "Debe indicar el insumo" }, { status: 400 });

  const [insumo] = await db.select().from(almacenInsumos).where(eq(almacenInsumos.id, insumoId)).limit(1);
  if (!insumo) return Response.json({ error: "Insumo no encontrado" }, { status: 404 });

  const ingresos = await db.select({
    fecha: almacenLotes.fecha_ingreso, lote: almacenLotes.lote,
    cantidad: almacenLotes.cantidad_ingresada,
    ordenNumero: ordenesCompra.numero, ordenAnio: ordenesCompra.anio,
    a04Numero: consolidaciones.numero_a04, a04Anio: consolidaciones.anio_a04,
  }).from(almacenLotes)
    .leftJoin(ordenesCompra, eq(ordenesCompra.id, almacenLotes.orden_compra_id))
    .leftJoin(fondoRotativoPagos, eq(fondoRotativoPagos.id, almacenLotes.pago_fr_id))
    .leftJoin(consolidaciones, eq(consolidaciones.id, fondoRotativoPagos.consolidacion_id))
    .where(eq(almacenLotes.insumo_id, insumoId));

  const egresos = await db.select({
    fecha: requisicionesBodega.fecha_despacho, fechaEmision: requisicionesBodega.fecha_emision,
    noPedido: requisicionesBodega.no_pedido, salaServicio: requisicionesBodega.sala_servicio,
    cantidad: requisicionBodegaDespachos.cantidad,
  }).from(requisicionBodegaDespachos)
    .innerJoin(almacenLotes, eq(almacenLotes.id, requisicionBodegaDespachos.lote_id))
    .innerJoin(requisicionBodegaItems, eq(requisicionBodegaItems.id, requisicionBodegaDespachos.requisicion_item_id))
    .innerJoin(requisicionesBodega, eq(requisicionesBodega.id, requisicionBodegaItems.requisicion_id))
    .where(eq(almacenLotes.insumo_id, insumoId));

  const movimientos: Movimiento[] = [
    ...ingresos.map((r): Movimiento => ({
      fecha: r.fecha,
      tipo: "Ingreso",
      cantidad: r.cantidad,
      documento: r.ordenNumero != null ? `DAB-60 (Orden No. ${r.ordenNumero}/${r.ordenAnio})`
        : r.a04Numero != null ? `DAB-60 (A-04 ${r.a04Numero}/${r.a04Anio})`
        : r.lote ? `DAB-60 (Lote ${r.lote})` : "DAB-60",
    })),
    ...egresos.map((r): Movimiento => ({
      fecha: r.fecha ?? r.fechaEmision,
      tipo: "Egreso",
      cantidad: -r.cantidad,
      documento: `DAB-75 No. ${r.noPedido} — ${r.salaServicio}`,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Historial");
  ws.columns = [
    { key: "fecha" }, { key: "tipo" }, { key: "cantidad" }, { key: "documento" }, { key: "saldo" },
  ];
  ws.columns.forEach(col => { col.width = 18; });

  ws.addRow([`Insumo: ${insumo.nombre} (${insumo.codigo_igss ?? "S/C"})`]);
  ws.mergeCells("A1:E1");
  ws.getRow(1).font = { bold: true, size: 12 };
  ws.addRow([]);

  const filaEncabezado = ws.addRow(["Fecha", "Tipo de movimiento", "Cantidad", "Documento", "Saldo"]);
  filaEncabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  filaEncabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  ws.views = [{ state: "frozen", ySplit: 3 }];

  let saldo = 0;
  if (movimientos.length === 0) {
    ws.addRow(["", "", "", "Sin movimientos registrados todavía.", ""]);
  }
  for (const m of movimientos) {
    saldo += m.cantidad;
    ws.addRow([m.fecha, m.tipo, m.cantidad, m.documento, saldo]);
  }

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const nombreArchivo = `historial-${(insumo.codigo_igss ?? "SC").replace(/[^a-zA-Z0-9]/g, "")}-${fechaGuatemala()}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
