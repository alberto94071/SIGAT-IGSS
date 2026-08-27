"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { ordenesCompra, dab60Posiciones, fondoRotativoPagos, consolidaciones, almacenInsumos, almacenLotes } from "@/lib/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { conDetalle, type PagoFondoRotativo } from "./fondo-rotativo-pagos-actions";
import { trazabilidadPorConsolidaciones } from "./trazabilidad-utils";
import { readFile } from "fs/promises";
import path from "path";
import { LoteYaDespachadoEnTransaccion } from "./almacen-errors";

// Da de alta existencia en el Catálogo de Almacén cuando un DAB-60 queda
// firme (aprobado en la vía Normal; generado directo en la vía Fondo
// Rotativo, que no tiene paso de aprobación aparte) — un lote nuevo por cada
// insumo distinto de la consolidación, con la cantidad que trae ese grupo.
// Lote/fecha de vencimiento/marca/modelo/serie se capturan una sola vez por
// documento completo (no por insumo) porque en la práctica un DAB-60 real
// casi siempre es de un solo insumo (confirmado por el cliente 2026-08-26);
// si alguna vez trae más de uno, todos heredan el mismo lote de ese
// documento.
async function registrarIngresoAlmacen(tx: Tx, params: {
  consolidacionId: number; fechaIngreso: string;
  lote: string | null; fechaVencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null;
  ordenCompraId?: number; pagoFrId?: number;
}): Promise<void> {
  const grupos = await gruposRenglonDeConsolidacion(params.consolidacionId);
  for (const g of grupos) {
    const [insumo] = await tx.insert(almacenInsumos).values({
      codigo_igss: g.codigo_igss, subproducto: g.subproducto, nombre: g.nombre,
      descripcion_igss: g.descripcion_igss, renglon: g.renglon, unidad_medida: g.unidad_medida,
    }).onConflictDoUpdate({
      target: [almacenInsumos.codigo_igss, almacenInsumos.subproducto, almacenInsumos.nombre],
      set: { nombre: g.nombre },
    }).returning();

    await tx.insert(almacenLotes).values({
      insumo_id: insumo.id, lote: params.lote, fecha_vencimiento: params.fechaVencimiento,
      fecha_ingreso: params.fechaIngreso, cantidad_ingresada: g.cantidad, cantidad_disponible: g.cantidad,
      marca: params.marca, modelo: params.modelo, serie: params.serie,
      orden_compra_id: params.ordenCompraId ?? null, pago_fr_id: params.pagoFrId ?? null,
    });
  }
}

// Deshace el ingreso a Almacén que hizo aprobarDab60/generarDab60FondoRotativo
// para una orden/pago puntual — se usa al devolver una orden rechazada por la
// DAF de vuelta a Almacén/DAB-60 para corregir datos (ver regresarADab60 en
// compromiso-actions.ts): sin esto, al corregir y volver a aprobar, aprobarDab60
// registraba un lote NUEVO además del que ya existía — duplicando existencia
// de algo que físicamente nunca volvió a entrar a la bodega. Si ya se
// despachó parte de ese lote por un DAB-75 antes de que se detectara el
// rechazo (algo salió de bodega con datos que ahora resultan incorrectos), no
// se puede deshacer solo — se bloquea la devolución para que el encargado de
// Almacén lo resuelva a mano en vez de dejar cantidades inconsistentes.
export async function revertirIngresoAlmacen(
  tx: Tx, filtro: { ordenCompraId?: number; pagoFrId?: number }
): Promise<void> {
  const condicion = filtro.ordenCompraId != null
    ? eq(almacenLotes.orden_compra_id, filtro.ordenCompraId)
    : eq(almacenLotes.pago_fr_id, filtro.pagoFrId!);
  const lotes = await tx.select({
    id: almacenLotes.id, cantidad_ingresada: almacenLotes.cantidad_ingresada,
    cantidad_disponible: almacenLotes.cantidad_disponible, nombre: almacenInsumos.nombre,
  }).from(almacenLotes).innerJoin(almacenInsumos, eq(almacenInsumos.id, almacenLotes.insumo_id))
    .where(condicion);

  for (const l of lotes) {
    if (l.cantidad_disponible !== l.cantidad_ingresada) throw new LoteYaDespachadoEnTransaccion(l.nombre);
  }
  for (const l of lotes) {
    await tx.delete(almacenLotes).where(eq(almacenLotes.id, l.id));
  }
}

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Posiciones (mm) de cada campo del DAB-60, guardadas por el modo "Ver
// posiciones" — arrancan vacías hasta que alguien arrastra y guarda por
// primera vez; el cliente completa lo que falte con sus valores por defecto.
type PosGuardada = { top: number; left: number; width?: number; height?: number };

export async function getPosicionesDab60(): Promise<Record<string, PosGuardada>> {
  const rows = await db.select().from(dab60Posiciones);
  const out: Record<string, PosGuardada> = {};
  for (const r of rows) {
    out[r.campo] = { top: r.top, left: r.left, width: r.width ?? undefined, height: r.height ?? undefined };
  }
  return out;
}

export async function guardarPosicionesDab60(
  posiciones: Record<string, PosGuardada>
): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;

  for (const [campo, { top, left, width, height }] of Object.entries(posiciones)) {
    const values = { campo, top, left, width: width ?? null, height: height ?? null };
    await db.insert(dab60Posiciones).values(values)
      .onConflictDoUpdate({ target: dab60Posiciones.campo, set: { top, left, width: values.width, height: values.height } });
  }
  return { ok: true };
}

// Imagen del talonario DAB-60 real, solo para calibrar posiciones — no vive
// en /public (que Next.js sirve sin autenticación) sino en /private, y esta
// server action exige sesión antes de devolverla como data URI.
export async function getFondoDab60(): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "private", "dab60-fondo.jpg"));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function getOrdenesEnDab() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Pendiente DAB-60")).orderBy(sql`created_at ASC`);
  const trazMap = await trazabilidadPorConsolidaciones(ordenes.map(o => o.consolidacion_id));
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
    traz: trazMap.get(o.consolidacion_id) ?? null,
  })));
}

// Órdenes con DAB-60 ya generado, esperando aprobación antes de poder pasar
// a Presupuesto/Devengado — bandeja propia dentro del mismo módulo Almacén,
// para poder corregir datos mal ingresados sin tener que devolver la orden
// hasta Compromiso.
export async function getOrdenesDab60PendienteAprobacion() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "DAB-60 Pendiente Aprobación")).orderBy(sql`created_at ASC`);
  const trazMap = await trazabilidadPorConsolidaciones(ordenes.map(o => o.consolidacion_id));
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
    traz: trazMap.get(o.consolidacion_id) ?? null,
  })));
}

// Órdenes que ya pasaron por Almacén/DAB-60 (sin importar en qué etapa vayan
// después) — para consulta histórica y reimpresión en Almacén/Archivo.
// El archivo de almacén nunca se borra, así que crece para siempre — se
// pagina por lotes (más reciente primero) en vez de traer y procesar toda
// la tabla en cada visita. Pide un registro de más para saber si queda algo
// atrás sin otra consulta. (Un archivo "use server" solo puede exportar
// funciones async.)
const ARCHIVO_ALMACEN_PAGE_SIZE = 50;

export async function getOrdenesArchivadasAlmacen(offset: number = 0) {
  const limit = ARCHIVO_ALMACEN_PAGE_SIZE;
  const pagina = await db.select().from(ordenesCompra)
    .where(isNotNull(ordenesCompra.dab60_generado_en))
    .orderBy(sql`dab60_generado_en DESC`)
    .limit(limit + 1).offset(offset);
  const hasMore = pagina.length > limit;
  const ordenesPagina = pagina.slice(0, limit);
  const ordenes = await Promise.all(ordenesPagina.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
  return { ordenes, hasMore };
}

// Igual que getOrdenesArchivadasAlmacen, pero para los DAB-60 de la vía
// Fondo Rotativo — antes no aparecían en ningún archivo (el DAB-60 de un
// pago Regularizado solo se podía imprimir desde su bandeja activa, y
// dejaba de ser accesible en cuanto el pago avanzaba de etapa).
export async function getPagosFondoRotativoArchivados(offset: number = 0) {
  const limit = ARCHIVO_ALMACEN_PAGE_SIZE;
  const pagina = await db.select({
    id: fondoRotativoPagos.id,
    consolidacion_id: fondoRotativoPagos.consolidacion_id,
    estado: fondoRotativoPagos.estado,
    dab60_generado_en: fondoRotativoPagos.dab60_generado_en,
    dab60_no_recibo_almacen: fondoRotativoPagos.dab60_no_recibo_almacen,
    dab60_serie_recibo_almacen: fondoRotativoPagos.dab60_serie_recibo_almacen,
    dab60_encargado_almacen: fondoRotativoPagos.dab60_encargado_almacen,
    dab60_lote: fondoRotativoPagos.dab60_lote,
    dab60_fecha_vencimiento: fondoRotativoPagos.dab60_fecha_vencimiento,
    dab60_marca: fondoRotativoPagos.dab60_marca,
    dab60_modelo: fondoRotativoPagos.dab60_modelo,
    dab60_serie: fondoRotativoPagos.dab60_serie,
    no_factura: fondoRotativoPagos.no_factura,
    serie_factura: fondoRotativoPagos.serie_factura,
    numero_a04: consolidaciones.numero_a04,
    anio_a04: consolidaciones.anio_a04,
    proveedor_nit: consolidaciones.proveedor_nit,
    proveedor_nombre: consolidaciones.proveedor_nombre,
    total: consolidaciones.total,
  }).from(fondoRotativoPagos)
    .innerJoin(consolidaciones, eq(consolidaciones.id, fondoRotativoPagos.consolidacion_id))
    .where(isNotNull(fondoRotativoPagos.dab60_generado_en))
    .orderBy(sql`dab60_generado_en DESC`)
    .limit(limit + 1).offset(offset);
  const hasMore = pagina.length > limit;
  const pagosPagina = pagina.slice(0, limit);
  const pagos = await Promise.all(pagosPagina.map(async p => ({
    ...p, renglones: await gruposRenglonDeConsolidacion(p.consolidacion_id),
  })));
  return { pagos, hasMore };
}

export type Dab60Data = {
  no_recibo_almacen: string; serie_recibo_almacen: string; encargado_almacen: string;
  fecha_ingreso_producto: string; no_factura: string; serie_factura: string;
  fecha_emision: string; lote: string; fecha_vencimiento: string;
  marca: string; modelo: string; serie: string;
};

// Generar (o corregir) el DAB-60 es puramente administrativo/de bodega — no
// vuelve a tocar Compromiso ni Devengado (eso ya se movió al comprometer y
// se termina de mover al devengar). El No./Serie de Recibo de Almacén y el
// Encargado de Almacén son los únicos datos obligatorios; el resto de
// factura/lote/marca/etc. son opcionales. Se puede llamar tanto para
// generarlo por primera vez ("Pendiente DAB-60") como para corregirlo
// mientras sigue en la bandeja de aprobación ("DAB-60 Pendiente
// Aprobación") — en ambos casos deja la orden en esa bandeja, esperando
// aprobarDab60 antes de poder pasar a Devengado.
export async function generarDab60(ordenId: number, data: Dab60Data): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.no_recibo_almacen.trim() || !data.serie_recibo_almacen.trim())
      return { error: "El No. y la Serie de Recibo de Almacén son obligatorios" };
    if (!data.encargado_almacen.trim())
      return { error: "El nombre del Encargado de Almacén es obligatorio" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Pendiente DAB-60" && orden.estado !== "DAB-60 Pendiente Aprobación")
      return { error: "Esta orden ya fue procesada en DAB-60" };

    await db.update(ordenesCompra).set({
      no_recibo_almacen:      data.no_recibo_almacen.trim(),
      serie_recibo_almacen:   data.serie_recibo_almacen.trim(),
      encargado_almacen:      data.encargado_almacen.trim(),
      fecha_ingreso_producto: data.fecha_ingreso_producto.trim() || null,
      no_factura:             data.no_factura.trim() || null,
      serie_factura:          data.serie_factura.trim() || null,
      fecha_emision:          data.fecha_emision.trim() || null,
      lote:                   data.lote.trim() || null,
      fecha_vencimiento:      data.fecha_vencimiento.trim() || null,
      marca:                  data.marca.trim() || null,
      modelo:                 data.modelo.trim() || null,
      serie:                  data.serie.trim() || null,
      dab60_generado_en:      fechaHoraGuatemala(),
      estado:                 "DAB-60 Pendiente Aprobación",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al generar el DAB-60" };
  }
}

// Aprueba el DAB-60 — recién aquí la orden puede pasar a Presupuesto/
// Devengado. Mismo módulo Almacén, sin cambios de presupuesto (esos ya
// ocurrieron al comprometer).
export async function aprobarDab60(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [orden] = await db.select().from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "DAB-60 Pendiente Aprobación") return { error: "Esta orden no está pendiente de aprobación de DAB-60" };

    // El cambio de estado y el ingreso a Almacén van en una sola transacción
    // — si el ingreso fallara a la mitad, no debe quedar la orden marcada
    // "En Devengado" con el stock sin registrar.
    await db.transaction(async (tx) => {
      await tx.update(ordenesCompra).set({ estado: "En Devengado" }).where(eq(ordenesCompra.id, ordenId));

      // Recién aquí, no en generarDab60, porque generarDab60 se puede llamar
      // varias veces corrigiendo datos antes de aprobar — dar de alta stock ahí
      // duplicaría el ingreso en cada corrección.
      await registrarIngresoAlmacen(tx, {
        consolidacionId: orden.consolidacion_id,
        fechaIngreso: orden.fecha_ingreso_producto ?? orden.fecha,
        lote: orden.lote, fechaVencimiento: orden.fecha_vencimiento,
        marca: orden.marca, modelo: orden.modelo, serie: orden.serie,
        ordenCompraId: orden.id,
      });
    });

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el DAB-60" };
  }
}

// ─── DAB-60 para Fondo Rotativo (Regularizado) ───────────────────────────────
// Mismo criterio que la vía Normal (requiereDab60, grupos 200/300 excepto
// 261/266/295) pero sin etapa de aprobación separada: llenar el DAB-60 aquí
// ya manda el pago directo a Fondo Rotativo/Pagos — ver generarSiaf04 en
// siaf04-actions.ts para dónde se decide si un pago pasa por esta bandeja.

export async function getPagosFondoRotativoEnDab60(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Pendiente DAB-60")).orderBy(sql`id ASC`);
  return conDetalle(rows);
}

export type Dab60DataFr = {
  no_recibo_almacen: string; serie_recibo_almacen: string; encargado_almacen: string;
  fecha_ingreso_producto: string; lote: string; fecha_vencimiento: string;
  marca: string; modelo: string; serie: string;
};

export async function generarDab60FondoRotativo(pagoId: number, data: Dab60DataFr): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.no_recibo_almacen.trim() || !data.serie_recibo_almacen.trim())
      return { error: "El No. y la Serie de Recibo de Almacén son obligatorios" };
    if (!data.encargado_almacen.trim())
      return { error: "El nombre del Encargado de Almacén es obligatorio" };

    const [pago] = await db.select({ estado: fondoRotativoPagos.estado, consolidacion_id: fondoRotativoPagos.consolidacion_id })
      .from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, pagoId)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente DAB-60") return { error: "Este registro ya fue procesado en DAB-60" };

    const lote = data.lote.trim() || null;
    const fechaVencimiento = data.fecha_vencimiento.trim() || null;
    const marca = data.marca.trim() || null;
    const modelo = data.modelo.trim() || null;
    const serie = data.serie.trim() || null;
    const fechaIngreso = data.fecha_ingreso_producto.trim() || fechaHoraGuatemala().slice(0, 10);

    // Sin etapa de aprobación separada en esta vía (a diferencia de Normal)
    // — el ingreso a Almacén se registra de una vez, porque generarDab60FondoRotativo
    // solo se puede llamar una vez por registro (el guard de arriba lo impide).
    // Igual que en aprobarDab60, ambos pasos van en una sola transacción.
    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        dab60_no_recibo_almacen:      data.no_recibo_almacen.trim(),
        dab60_serie_recibo_almacen:   data.serie_recibo_almacen.trim(),
        dab60_encargado_almacen:      data.encargado_almacen.trim(),
        dab60_fecha_ingreso_producto: data.fecha_ingreso_producto.trim() || null,
        dab60_lote:                   lote,
        dab60_fecha_vencimiento:      fechaVencimiento,
        dab60_marca:                  marca,
        dab60_modelo:                 modelo,
        dab60_serie:                  serie,
        dab60_generado_en:            fechaHoraGuatemala(),
        estado:                       "Pendiente forma de pago",
      }).where(eq(fondoRotativoPagos.id, pagoId));

      await registrarIngresoAlmacen(tx, {
        consolidacionId: pago.consolidacion_id,
        fechaIngreso, lote, fechaVencimiento, marca, modelo, serie,
        pagoFrId: pagoId,
      });
    });

    return { ok: true };
  } catch {
    return { error: "Error al generar el DAB-60" };
  }
}
