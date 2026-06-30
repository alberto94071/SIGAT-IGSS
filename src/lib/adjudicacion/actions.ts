"use server";
import { db } from "@/lib/db";
import {
  consolidaciones, consolidacionPrecios, siafCompras, siafComprasItems,
  ordenesCompra, proveedores,
} from "@/lib/schema";
import { eq, sql, inArray, ilike, or, and, isNotNull, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { Consolidacion, InsumoPrecio, TipoCompra } from "./types";
import { LIMITE_POR_TIPO, REFERENCIA_LABEL } from "./types";

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getConsolidacionesConDetalles(): Promise<Consolidacion[]> {
  const cons = await db.select().from(consolidaciones)
    .orderBy(sql`anio DESC, numero DESC`);

  const siaf = await db.select({
    id:               siafCompras.id,
    numero:           siafCompras.numero,
    anio:             siafCompras.anio,
    fecha:            siafCompras.fecha,
    estado:           siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(isNotNull(siafCompras.consolidacion_id));

  const siafIds = siaf.map(s => s.id);
  let items: { solicitud_id: number; codigo_igss: number | null; subproducto: string;
    nombre: string; unidad_medida: string | null; cantidad_solicitada: number }[] = [];
  if (siafIds.length > 0) {
    items = await db.select({
      solicitud_id:        siafComprasItems.solicitud_id,
      codigo_igss:         siafComprasItems.codigo_igss,
      subproducto:         siafComprasItems.subproducto,
      nombre:              siafComprasItems.nombre,
      unidad_medida:       siafComprasItems.unidad_medida,
      cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));
  }

  const precios = cons.length > 0
    ? await db.select().from(consolidacionPrecios)
        .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)))
    : [];

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + (i.cantidad_solicitada ?? 0), 0);

    // Agrupar por codigo_igss + subproducto (mismo patrón que el historial de SiafClient)
    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const existente = grupos.get(key);
      if (existente) {
        existente.cantidad += item.cantidad_solicitada;
      } else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
        });
      }
    }
    const cPrecios = precios.filter(p => p.consolidacion_id === c.id);
    for (const p of cPrecios) {
      const key = `${p.codigo_igss}::${p.subproducto}`;
      const grupo = grupos.get(key);
      if (grupo) grupo.precio_unitario = p.precio_unitario;
    }

    return { ...c, siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()) };
  });
}

export async function getOrdenes() {
  return db.select().from(ordenesCompra).orderBy(sql`anio DESC, numero DESC`);
}

export async function buscarProveedoresAuto(q: string) {
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:       proveedores.id,
    nit:      proveedores.nit,
    nombre:   proveedores.nombre,
    telefono: proveedores.telefono,
  }).from(proveedores).where(
    and(
      eq(proveedores.activo, true),
      or(
        ilike(proveedores.nombre, `%${q}%`),
        sql`${proveedores.nit} ILIKE ${'%' + q + '%'}`,
      )
    )
  ).limit(8);
}

// ─── Adjudicación (Junta Adjudicadora) ───────────────────────────────────────

export async function adjudicar(id: number, data: {
  tipo_compra:      TipoCompra;
  proveedor_id:     number | null;
  proveedor_nit:    string;
  proveedor_nombre: string;
  numero_adjudicacion: string;
  nog?:          string;
  fecha_evento?: string;
}) {
  try {
    const numAdj = data.numero_adjudicacion.trim();
    if (!/^\d+$/.test(numAdj)) {
      return { error: "El Número de Adjudicación solo puede contener dígitos" };
    }
    if (!data.proveedor_nombre.trim()) {
      return { error: "Selecciona un proveedor" };
    }
    if (data.tipo_compra === "Compra Directa") {
      if (!data.nog?.trim()) return { error: "El NOG es obligatorio para Compra Directa" };
      if (!data.fecha_evento) return { error: "La fecha de finalización del evento es obligatoria" };
    }

    const [existente] = await db.select({ id: consolidaciones.id })
      .from(consolidaciones).where(
        and(eq(consolidaciones.numero_adjudicacion, numAdj), ne(consolidaciones.id, id))
      ).limit(1);
    if (existente) return { error: `Ya existe una consolidación con el Número de Adjudicación ${numAdj}` };

    await db.update(consolidaciones).set({
      tipo_compra:         data.tipo_compra,
      estado:               "Adjudicado",
      proveedor_id:         data.proveedor_id,
      proveedor_nit:        data.proveedor_nit,
      proveedor_nombre:     data.proveedor_nombre,
      numero_adjudicacion:  numAdj,
      nog:                  data.tipo_compra === "Compra Directa" ? data.nog!.trim() : null,
      fecha_evento:         data.tipo_compra === "Compra Directa" ? data.fecha_evento! : null,
    }).where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Adjudicado" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar la adjudicación" };
  }
}

// ─── Anular Consolidación ─────────────────────────────────────────────────────

export async function anularConsolidacion(id: number) {
  try {
    await db.update(siafCompras)
      .set({ estado: "Borrador", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, id));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al anular la consolidación" };
  }
}

// ─── Completar Adjudicación (Compras) ────────────────────────────────────────

export async function completarAdjudicacion(id: number, data: {
  referencia:   string | null;
  exento_iva:   boolean;
  precios:      { codigo_igss: number | null; subproducto: string; precio_unitario: number }[];
  regularizado: boolean | null;
}) {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra, estado: consolidaciones.estado })
      .from(consolidaciones).where(eq(consolidaciones.id, id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Adjudicado") return { error: "Solo se puede completar una consolidación en estado Adjudicado" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (!tipo) return { error: "La consolidación no tiene un tipo de compra asignado" };

    const esDirecta = tipo === "Compra Directa";

    if (!esDirecta && !data.referencia?.trim()) {
      return { error: `El campo "${REFERENCIA_LABEL[tipo]}" es obligatorio` };
    }
    if (!esDirecta && data.regularizado === null) {
      return { error: "Selecciona si es Regularizado o Normal" };
    }
    if (data.precios.length === 0 || data.precios.some(p => !(p.precio_unitario > 0))) {
      return { error: "Ingresa un precio válido para cada insumo" };
    }

    // Cantidad real por insumo, calculada server-side (no se confía en el cliente)
    const siafIds = (await db.select({ id: siafCompras.id })
      .from(siafCompras).where(eq(siafCompras.consolidacion_id, id))).map(s => s.id);
    const items = siafIds.length > 0
      ? await db.select({
          codigo_igss:         siafComprasItems.codigo_igss,
          subproducto:         siafComprasItems.subproducto,
          cantidad_solicitada: siafComprasItems.cantidad_solicitada,
        }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];
    const cantidadPorInsumo = new Map<string, number>();
    for (const it of items) {
      const key = `${it.codigo_igss}::${it.subproducto}`;
      cantidadPorInsumo.set(key, (cantidadPorInsumo.get(key) ?? 0) + it.cantidad_solicitada);
    }

    let bruto = 0;
    for (const p of data.precios) {
      const cantidad = cantidadPorInsumo.get(`${p.codigo_igss}::${p.subproducto}`) ?? 0;
      bruto += cantidad * p.precio_unitario;
    }
    const total = data.exento_iva ? bruto : bruto * 0.88;
    const limite = LIMITE_POR_TIPO[tipo];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}`,
        limitExceeded: true as const,
      };
    }

    const destino = esDirecta ? "presupuesto" : (data.regularizado ? "fondo_rotativo" : "presupuesto");
    const estado  = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";

    await db.delete(consolidacionPrecios).where(eq(consolidacionPrecios.consolidacion_id, id));
    await db.insert(consolidacionPrecios).values(
      data.precios.map(p => ({
        consolidacion_id: id,
        codigo_igss:       p.codigo_igss,
        subproducto:       p.subproducto,
        precio_unitario:   p.precio_unitario,
      }))
    );

    await db.update(consolidaciones).set({
      referencia:   esDirecta ? null : data.referencia!.trim(),
      exento_iva:   data.exento_iva,
      total,
      destino,
      regularizado: esDirecta ? null : data.regularizado,
      estado,
    }).where(eq(consolidaciones.id, id));

    return { ok: true as const };
  } catch {
    return { error: "Error al completar la adjudicación" };
  }
}

// ─── Pantallas destino (SIAF-04 / Presupuesto General) ───────────────────────

export async function getPendientesPorDestino(destino: "fondo_rotativo" | "presupuesto"): Promise<Consolidacion[]> {
  const estadoBuscar = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";

  const cons = await db.select().from(consolidaciones)
    .where(and(eq(consolidaciones.destino, destino), eq(consolidaciones.estado, estadoBuscar)))
    .orderBy(sql`created_at DESC`);

  if (cons.length === 0) return [];

  const siaf = await db.select({
    id: siafCompras.id, numero: siafCompras.numero, anio: siafCompras.anio,
    fecha: siafCompras.fecha, estado: siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(inArray(siafCompras.consolidacion_id, cons.map(c => c.id)));

  const siafIds = siaf.map(s => s.id);
  const items = siafIds.length > 0
    ? await db.select({
        solicitud_id: siafComprasItems.solicitud_id,
        codigo_igss:  siafComprasItems.codigo_igss,
        subproducto:  siafComprasItems.subproducto,
        nombre:       siafComprasItems.nombre,
        unidad_medida: siafComprasItems.unidad_medida,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada,
      }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
    : [];

  const precios = await db.select().from(consolidacionPrecios)
    .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)));

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + i.cantidad_solicitada, 0);

    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const ex = grupos.get(key);
      if (ex) { ex.cantidad += item.cantidad_solicitada; }
      else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
        });
      }
    }
    for (const p of precios.filter(p => p.consolidacion_id === c.id)) {
      const g = grupos.get(`${p.codigo_igss}::${p.subproducto}`);
      if (g) g.precio_unitario = p.precio_unitario;
    }

    return { ...c, siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()) };
  });
}

export async function generarOrdenDesdeDestino(id: number) {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para generar órdenes de compra" };

    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();
    const fecha = new Date().toISOString().slice(0, 10);

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const estadoOk = con.estado === "Enviado a Fondo Rotativo" || con.estado === "Enviado a Presupuesto";
    if (!estadoOk) return { error: "La consolidación no está lista para generar la orden" };

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM ordenes_compra WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;

    const siafConsolIds = (await db.select({ id: siafCompras.id })
      .from(siafCompras).where(eq(siafCompras.consolidacion_id, id))).map(s => s.id);
    let total_cantidad = 0;
    if (siafConsolIds.length > 0) {
      const its = await db.select({ c: siafComprasItems.cantidad_solicitada })
        .from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafConsolIds));
      total_cantidad = its.reduce((s, i) => s + i.c, 0);
    }

    await db.insert(ordenesCompra).values({
      numero, anio: year, fecha,
      consolidacion_id: id,
      tipo_compra:      con.tipo_compra!,
      nog:              con.nog ?? null,
      referencia:       con.referencia ?? null,
      proveedor_id:     con.proveedor_id ?? null,
      proveedor_nit:    con.proveedor_nit ?? null,
      proveedor_nombre: con.proveedor_nombre ?? null,
      costo_unitario:   null,
      total_cantidad,
      exento_iva:       con.exento_iva,
      total:            con.total ?? null,
      estado:           "Activa",
      creado_por:       uid,
    });

    await db.update(consolidaciones)
      .set({ estado: "Orden de Compra Generada" })
      .where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Orden de Compra" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { ok: true as const };
  } catch {
    return { error: "Error al generar la orden de compra" };
  }
}
