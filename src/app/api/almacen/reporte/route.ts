import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { almacenInsumos, almacenLotes } from "@/lib/schema";
import { requireModuloAccessAction, requireTabAccessAction } from "@/lib/modulo-access";
import { fechaGuatemala } from "@/lib/date-utils";
import { agregarGraficoBarras } from "@/lib/excel-chart";
import { and, eq, like, sql } from "drizzle-orm";

// Umbral de fallback cuando el insumo no tiene dias_alerta_vencimiento
// configurado — mismo valor que CatalogoAlmacenClient.tsx (mantener
// sincronizado si algún día cambia).
const DIAS_ALERTA_VENCIMIENTO_DEFAULT = 90;

const TITULOS: Record<string, string> = {
  ingresados_mes: "Insumos ingresados en el mes",
  almacenados:    "Insumos almacenados (existencia actual)",
  por_vencer:     "Insumos próximos a vencer",
  vencidos:       "Insumos vencidos",
  por_renglon:    "Cantidad de insumos por renglón",
  renglon:        "Detalle de un renglón",
};

function diasEntre(hoyIso: string, fechaIso: string): number {
  const hoy = new Date(hoyIso + "T00:00:00");
  const meta = new Date(fechaIso + "T00:00:00");
  return Math.round((meta.getTime() - hoy.getTime()) / 86400000);
}

function estilizarEncabezado(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { vertical: "middle" };
  ws.columns.forEach(col => { col.width = Math.max((col.width ?? 10), 14); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function GET(req: NextRequest) {
  const acceso = await requireModuloAccessAction("mod_almacen");
  if ("error" in acceso) return Response.json({ error: acceso.error }, { status: 403 });
  const tab = await requireTabAccessAction("mod_almacen", "tab_almacen_catalogo");
  if ("error" in tab) return Response.json({ error: tab.error }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const tipo = searchParams.get("tipo") ?? "";
  if (!(tipo in TITULOS)) return Response.json({ error: "Tipo de reporte inválido" }, { status: 400 });

  const hoy = fechaGuatemala();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Datos");
  let categorias: string[] = [];
  let valores: number[] = [];
  let nombreSerie = "Cantidad";

  if (tipo === "ingresados_mes") {
    const hoyPartes = hoy.split("-");
    const anio = searchParams.get("anio") ?? hoyPartes[0];
    const mes = (searchParams.get("mes") ?? hoyPartes[1]).padStart(2, "0");
    const prefijo = `${anio}-${mes}-`;

    const rows = await db.select({
      fecha_ingreso: almacenLotes.fecha_ingreso, nombre: almacenInsumos.nombre,
      codigo_igss: almacenInsumos.codigo_igss, renglon: almacenInsumos.renglon,
      unidad_medida: almacenInsumos.unidad_medida, lote: almacenLotes.lote,
      cantidad_ingresada: almacenLotes.cantidad_ingresada, fecha_vencimiento: almacenLotes.fecha_vencimiento,
      marca: almacenLotes.marca, modelo: almacenLotes.modelo, serie: almacenLotes.serie,
    }).from(almacenLotes)
      .innerJoin(almacenInsumos, eq(almacenInsumos.id, almacenLotes.insumo_id))
      .where(like(almacenLotes.fecha_ingreso, `${prefijo}%`))
      .orderBy(almacenLotes.fecha_ingreso);

    ws.columns = [
      { header: "Fecha ingreso", key: "fecha_ingreso" },
      { header: "Insumo", key: "nombre" },
      { header: "Código", key: "codigo_igss" },
      { header: "Renglón", key: "renglon" },
      { header: "Unidad", key: "unidad_medida" },
      { header: "Lote", key: "lote" },
      { header: "Cantidad ingresada", key: "cantidad_ingresada" },
      { header: "Fecha vencimiento", key: "fecha_vencimiento" },
      { header: "Marca", key: "marca" },
      { header: "Modelo", key: "modelo" },
      { header: "Serie", key: "serie" },
    ];
    rows.forEach(r => ws.addRow({ ...r, codigo_igss: r.codigo_igss ?? "S/C" }));

    const porInsumo = new Map<string, number>();
    for (const r of rows) porInsumo.set(r.nombre, (porInsumo.get(r.nombre) ?? 0) + r.cantidad_ingresada);
    const top = [...porInsumo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    categorias = top.map(t => t[0]);
    valores = top.map(t => t[1]);
    nombreSerie = "Cantidad ingresada";

  } else if (tipo === "almacenados") {
    const rows = await db.select({
      nombre: almacenInsumos.nombre,
      codigo_igss: almacenInsumos.codigo_igss, renglon: almacenInsumos.renglon,
      unidad_medida: almacenInsumos.unidad_medida, stock_minimo: almacenInsumos.stock_minimo,
      ingresado: sql<number>`coalesce(sum(${almacenLotes.cantidad_ingresada}), 0)`,
      disponible: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
      proximo_vencimiento: sql<string | null>`min(${almacenLotes.fecha_vencimiento}) filter (where ${almacenLotes.cantidad_disponible} > 0)`,
    }).from(almacenInsumos)
      .leftJoin(almacenLotes, eq(almacenLotes.insumo_id, almacenInsumos.id))
      .groupBy(almacenInsumos.id)
      .orderBy(almacenInsumos.nombre);

    ws.columns = [
      { header: "Insumo", key: "nombre" },
      { header: "Código", key: "codigo_igss" },
      { header: "Renglón", key: "renglon" },
      { header: "Unidad", key: "unidad_medida" },
      { header: "Ingresado (total)", key: "ingresado" },
      { header: "Disponible", key: "disponible" },
      { header: "Próx. vencimiento", key: "proximo_vencimiento" },
      { header: "Stock mínimo", key: "stock_minimo" },
    ];
    rows.forEach(r => ws.addRow({ ...r, codigo_igss: r.codigo_igss ?? "S/C" }));

    const top = [...rows].sort((a, b) => b.disponible - a.disponible).slice(0, 15).filter(r => r.disponible > 0);
    categorias = top.map(t => t.nombre);
    valores = top.map(t => t.disponible);
    nombreSerie = "Disponible";

  } else if (tipo === "por_vencer" || tipo === "vencidos") {
    const rows = await db.select({
      nombre: almacenInsumos.nombre, codigo_igss: almacenInsumos.codigo_igss, renglon: almacenInsumos.renglon,
      dias_alerta_vencimiento: almacenInsumos.dias_alerta_vencimiento,
      lote: almacenLotes.lote, fecha_vencimiento: almacenLotes.fecha_vencimiento,
      cantidad_disponible: almacenLotes.cantidad_disponible,
    }).from(almacenLotes)
      .innerJoin(almacenInsumos, eq(almacenInsumos.id, almacenLotes.insumo_id))
      .where(and(sql`${almacenLotes.cantidad_disponible} > 0`, sql`${almacenLotes.fecha_vencimiento} is not null`));

    const filtradas = rows
      .map(r => ({ ...r, dias: diasEntre(hoy, r.fecha_vencimiento!) }))
      .filter(r => tipo === "vencidos"
        ? r.dias < 0
        : r.dias >= 0 && r.dias <= (r.dias_alerta_vencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFAULT))
      .sort((a, b) => a.dias - b.dias);

    const etiquetaDias = tipo === "vencidos" ? "Días vencido" : "Días restantes";
    ws.columns = [
      { header: "Insumo", key: "nombre" },
      { header: "Código", key: "codigo_igss" },
      { header: "Renglón", key: "renglon" },
      { header: "Lote", key: "lote" },
      { header: "Fecha vencimiento", key: "fecha_vencimiento" },
      { header: etiquetaDias, key: "dias" },
      { header: "Cantidad disponible", key: "cantidad_disponible" },
    ];
    filtradas.forEach(r => ws.addRow({
      ...r, codigo_igss: r.codigo_igss ?? "S/C",
      dias: tipo === "vencidos" ? Math.abs(r.dias) : r.dias,
    }));

    const top = filtradas.slice(0, 15);
    categorias = top.map(t => t.nombre);
    valores = top.map(t => t.cantidad_disponible);
    nombreSerie = "Cantidad disponible";

  } else if (tipo === "por_renglon" || tipo === "renglon") {
    const renglonFiltro = tipo === "renglon" ? Number(searchParams.get("renglon")) : null;
    if (tipo === "renglon" && (!renglonFiltro || Number.isNaN(renglonFiltro))) {
      return Response.json({ error: "Debe indicar el renglón" }, { status: 400 });
    }

    if (tipo === "por_renglon") {
      const rows = await db.select({
        renglon: almacenInsumos.renglon,
        cantidad_insumos: sql<number>`count(distinct ${almacenInsumos.id})`,
        ingresado: sql<number>`coalesce(sum(${almacenLotes.cantidad_ingresada}), 0)`,
        disponible: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
      }).from(almacenInsumos)
        .leftJoin(almacenLotes, eq(almacenLotes.insumo_id, almacenInsumos.id))
        .groupBy(almacenInsumos.renglon)
        .orderBy(almacenInsumos.renglon);

      ws.columns = [
        { header: "Renglón", key: "renglon" },
        { header: "Cantidad de insumos", key: "cantidad_insumos" },
        { header: "Total ingresado", key: "ingresado" },
        { header: "Total disponible", key: "disponible" },
      ];
      rows.forEach(r => ws.addRow({ ...r, renglon: r.renglon ?? "Sin renglón" }));

      categorias = rows.map(r => String(r.renglon ?? "Sin renglón"));
      valores = rows.map(r => r.disponible);
      nombreSerie = "Total disponible";
    } else {
      const rows = await db.select({
        nombre: almacenInsumos.nombre, codigo_igss: almacenInsumos.codigo_igss,
        unidad_medida: almacenInsumos.unidad_medida,
        ingresado: sql<number>`coalesce(sum(${almacenLotes.cantidad_ingresada}), 0)`,
        disponible: sql<number>`coalesce(sum(${almacenLotes.cantidad_disponible}), 0)`,
        proximo_vencimiento: sql<string | null>`min(${almacenLotes.fecha_vencimiento}) filter (where ${almacenLotes.cantidad_disponible} > 0)`,
      }).from(almacenInsumos)
        .leftJoin(almacenLotes, eq(almacenLotes.insumo_id, almacenInsumos.id))
        .where(eq(almacenInsumos.renglon, renglonFiltro!))
        .groupBy(almacenInsumos.id)
        .orderBy(almacenInsumos.nombre);

      ws.columns = [
        { header: "Insumo", key: "nombre" },
        { header: "Código", key: "codigo_igss" },
        { header: "Unidad", key: "unidad_medida" },
        { header: "Ingresado (total)", key: "ingresado" },
        { header: "Disponible", key: "disponible" },
        { header: "Próx. vencimiento", key: "proximo_vencimiento" },
      ];
      rows.forEach(r => ws.addRow({ ...r, codigo_igss: r.codigo_igss ?? "S/C" }));

      const top = [...rows].sort((a, b) => b.disponible - a.disponible).slice(0, 15);
      categorias = top.map(t => t.nombre);
      valores = top.map(t => t.disponible);
      nombreSerie = "Disponible";
    }
  }

  estilizarEncabezado(ws);

  // El gráfico necesita referenciar celdas reales de la hoja — no puede
  // apuntar a "Datos" directamente porque las categorías/valores de arriba
  // son un resumen agregado (top 15, reordenado) que no corresponde fila a
  // fila con la tabla cruda. Por eso se arma una hoja "Resumen" aparte, con
  // exactamente las filas que muestra el gráfico, y el gráfico vive ahí.
  let salida: Buffer;
  if (categorias.length > 0) {
    const wsResumen = wb.addWorksheet("Resumen");
    wsResumen.columns = [{ header: "Categoría", key: "cat" }, { header: nombreSerie, key: "val" }];
    categorias.forEach((c, i) => wsResumen.addRow({ cat: c, val: valores[i] }));
    estilizarEncabezado(wsResumen);

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    salida = await agregarGraficoBarras(buf, {
      sheetXmlIndex: 2,
      sheetName: "Resumen",
      titulo: TITULOS[tipo],
      filaEncabezado: 1,
      colCategoria: 1,
      colValor: 2,
      cantidadFilasDatos: categorias.length,
      serie: { categorias, valores, nombreSerie },
      anchorColDesde: 4,
    });
  } else {
    salida = Buffer.from(await wb.xlsx.writeBuffer());
  }

  const nombreArchivo = `almacen-${tipo}-${hoy}.xlsx`;
  return new Response(new Uint8Array(salida), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
