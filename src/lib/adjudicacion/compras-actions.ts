"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import {
  consolidaciones, oferentes, oferentePrecios, cotizacionesServicio, siafCompras, siafComprasItems,
  cotizacionesAnuales, cotizacionesAnualesItems, catalogoCompras, nogRegistros,
} from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { TIPOS, MAX_OFERENTES, REFERENCIA_LABEL, LIMITE_POR_TIPO, type TipoCompra } from "./types";
import { verificarLimiteInsumos, mensajeLimiteExcedido } from "./limite-baja-cuantia";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { mensajePresupuestoExcedido, getDisponible } from "@/lib/presupuesto-disponible";
import { calcularReversionPresupuestoAplicado } from "@/app/compras/a01-siaf/actions";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// codigo_igss+subproducto solos no bastan para identificar un insumo cuando
// el código es "S/C" (sin código real) — varios insumos distintos (Agua,
// Energía Eléctrica, cada mes...) comparten ese mismo código y subproducto
// (ver catalogo_compras_codigo_subproducto_idx en schema.ts). Si el llamador
// mandó el nombre, se cruza también por nombre para no mezclarlos; si no lo
// mandó (llamadores viejos), se compara solo por código+subproducto como
// antes — no empeora nada, pero tampoco lo arregla del todo.
function mismoInsumo(
  r: { codigo_igss: string | null; subproducto: string; nombre: string },
  grupo: { codigo_igss: string | null; subproducto: string; nombre?: string },
): boolean {
  return r.codigo_igss === grupo.codigo_igss && r.subproducto === grupo.subproducto
    && (grupo.nombre == null || r.nombre === grupo.nombre);
}

// Rechazo de Compras antes de enviar a Junta — distinto del rechazo de Junta
// (rechazarJunta en junta-actions.ts): este regresa la solicitud a Consolidación
// (no a A01-SIAF), deshaciendo la consolidación por completo para que se vuelva a
// armar (posiblemente con otro Pre Orden).
export async function rechazarEnAdjudicacion(consolidacionId: number, motivo: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const trimmed = motivo.trim();
    if (!trimmed) return { error: "Debes indicar el motivo del rechazo" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Pendiente adjudicación" && con.estado !== "Rechazado por Junta")
      return { error: "Esta consolidación ya no se puede rechazar desde Adjudicación" };

    await db.update(siafCompras)
      .set({ estado: "Aprobado", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, consolidacionId));
    // Libera cualquier cotización de servicio que se hubiera reservado para esta consolidación
    await db.update(cotizacionesServicio)
      .set({ usado: false, usado_en_consolidacion_id: null })
      .where(eq(cotizacionesServicio.usado_en_consolidacion_id, consolidacionId));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, consolidacionId));

    if (con.creado_por) {
      const correlativo = con.pre_orden ? `PRE-${con.pre_orden}` : `${con.numero}/${con.anio}`;
      await crearNotificacion({
        usuario_id:      con.creado_por,
        tipo:            "consolidacion_rechazada",
        titulo:          `Consolidación ${correlativo} rechazada`,
        mensaje:         trimmed,
        ruta:            `/compras/consolidacion`,
        referencia_tipo: "consolidaciones",
        referencia_id:   consolidacionId,
      });
    }

    return { ok: true };
  } catch {
    return { error: "Error al rechazar la consolidación" };
  }
}

export async function elegirTipoCompra(consolidacionId: number, tipo: TipoCompra): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!TIPOS.includes(tipo)) return { error: "Tipo de compra inválido" };

    const [con] = await db.select({ estado: consolidaciones.estado, tipo_compra: consolidaciones.tipo_compra })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Pendiente adjudicación" && con.estado !== "Rechazado por Junta")
      return { error: "Esta consolidación ya no está disponible para elegir tipo de compra" };

    if (con.tipo_compra && con.tipo_compra !== tipo) {
      // Cambiar de tipo invalida los oferentes ya armados para el tipo anterior
      await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    }
    await db.update(consolidaciones).set({ tipo_compra: tipo, regularizado: null })
      .where(eq(consolidaciones.id, consolidacionId));
    return { ok: true };
  } catch {
    return { error: "Error al elegir el tipo de compra" };
  }
}

export async function guardarCompraDirectaEvento(consolidacionId: number, data: { nog: string; fecha_evento: string }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.nog.trim()) return { error: "El NOG es obligatorio" };
    if (!data.fecha_evento) return { error: "La fecha de finalización del evento es obligatoria" };

    await db.update(consolidaciones).set({
      nog: data.nog.trim(), fecha_evento: data.fecha_evento,
    }).where(eq(consolidaciones.id, consolidacionId));
    return { ok: true };
  } catch {
    return { error: "Error al guardar el NOG" };
  }
}

// Compra Directa recurrente (ej. arrendamiento mensual) cuyo NOG ya quedó
// registrado en Contrato y Cotizaciones/NOG — al aprobarse la primera vez
// (ver aprobarActa en actas-adjudicacion-actions.ts, que deja el catálogo de
// NOG actualizado), los meses siguientes se envían directo a Presupuesto sin
// volver a pasar por Junta Adjudicadora ni Acta, igual que Contrato Abierto
// (adjudicarDirecto). No hay presupuesto que verificar más allá del límite
// legal del tipo de compra — el precio viene ya aprobado del catálogo.
export async function confirmarCompraDirectaConNog(consolidacionId: number, nog: string): Promise<
  { ok: true } | { error: string; limitExceeded?: true }
> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.tipo_compra !== "Compra Directa") return { error: "Esta acción solo aplica a Compra Directa" };
    if (con.estado !== "Pendiente adjudicación" && con.estado !== "Rechazado por Junta")
      return { error: "Esta consolidación ya no está disponible para adjudicar" };

    const n = nog.trim();
    if (!n) return { error: "El NOG es obligatorio" };

    const registros = await db.select().from(nogRegistros).where(eq(nogRegistros.nog, n));
    if (registros.length === 0) return { error: `No hay ningún NOG registrado con el número ${n}` };

    const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
    if (renglones.length === 0) return { error: "Esta consolidación no tiene insumos" };

    // codigo_igss+subproducto solos no bastan para cruzar con el NOG cuando
    // es "S/C": varios insumos distintos (Agua, Energía, cada mes...)
    // comparten ese mismo código y subproducto — se agrega el nombre para no
    // aplicarle a un insumo el precio de otro.
    const porInsumo = new Map(registros.map(r => [`${r.insumo_codigo_igss}::${r.subproducto}::${r.insumo_nombre}`, r]));
    const faltantes: string[] = [];
    let bruto = 0;
    const itemsConPrecio: { codigo_igss: string | null; subproducto: string; nombre: string; precio_unitario: number; exento_iva: boolean }[] = [];
    for (const r of renglones) {
      const linea = porInsumo.get(`${r.codigo_igss}::${r.subproducto}::${r.nombre}`);
      if (!linea || linea.precio == null) { faltantes.push(r.nombre); continue; }
      bruto += r.cantidad * linea.precio;
      itemsConPrecio.push({ codigo_igss: r.codigo_igss, subproducto: r.subproducto, nombre: r.nombre, precio_unitario: linea.precio, exento_iva: linea.exento_iva });
    }
    if (faltantes.length > 0) {
      return { error: `El NOG ${n} no tiene precio registrado para: ${faltantes.join(", ")}. Completa el precio a mano o corrígelo en Contrato y Cotizaciones/NOG.` };
    }

    const todosExentos = itemsConPrecio.every(i => i.exento_iva);
    const total = todosExentos ? bruto : bruto * 0.88;
    const limite = LIMITE_POR_TIPO["Compra Directa"];
    if (total > limite) {
      return { error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para Compra Directa`, limitExceeded: true as const };
    }

    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras).where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
    const rawItems = siafIds.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];
    for (const item of itemsConPrecio) {
      const filas = rawItems.filter(r => r.codigo_igss === item.codigo_igss && r.subproducto === item.subproducto && r.nombre === item.nombre);
      for (const fila of filas) {
        const filaBruto = fila.cantidad_solicitada * item.precio_unitario;
        const montoNeto = item.exento_iva ? filaBruto : filaBruto * 0.88;
        await db.update(siafComprasItems).set({
          precio_unitario: item.precio_unitario, item_exento_iva: item.exento_iva, monto_neto: montoNeto,
        }).where(eq(siafComprasItems.id, fila.id));
      }
    }

    const primero = registros[0];
    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    const [ofrt] = await db.insert(oferentes).values({
      consolidacion_id: consolidacionId, proveedor_id: primero.proveedor_id,
      nit: primero.proveedor_nit ?? "", nombre: primero.proveedor_nombre,
      costo: bruto, exento_iva: todosExentos, orden: 0, creado_por: check.uid,
    }).returning();

    await db.update(consolidaciones).set({
      nog: n,
      proveedor_id: primero.proveedor_id, proveedor_nit: primero.proveedor_nit, proveedor_nombre: primero.proveedor_nombre,
      oferente_ganador_id: ofrt.id, exento_iva: todosExentos, total,
      razon_adjudicacion: `Repetición del NOG ${n} — mismo proveedor y precio ya aprobados anteriormente.`,
      destino: "presupuesto", estado: "Enviado a Presupuesto",
      motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al confirmar la Compra Directa con el NOG" };
  }
}

export async function agregarOferente(consolidacionId: number, data: {
  proveedor_id: number | null; nit: string; nombre: string; exento_iva: boolean;
  items: { codigo_igss: string | null; subproducto: string; precio_unitario: number }[];
}): Promise<{ oferente: typeof oferentes.$inferSelect } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (data.items.length === 0) return { error: "No hay insumos para cotizar" };
    if (data.items.some(i => !(i.precio_unitario > 0))) return { error: "Ingresa un precio unitario válido para cada insumo" };

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(oferentes)
      .where(eq(oferentes.consolidacion_id, consolidacionId));
    if (count >= MAX_OFERENTES) return { error: `Ya hay ${MAX_OFERENTES} oferentes registrados (máximo permitido)` };

    // El costo total se calcula (cantidad × precio de cada insumo) en vez de
    // pedirlo directo — así se guarda el mismo total de siempre en
    // oferentes.costo para las pantallas de comparación/Acta, pero ahora con
    // el desglose por insumo respaldándolo en oferente_precios.
    const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
    let costo = 0;
    for (const item of data.items) {
      const renglon = renglones.find(r => r.codigo_igss === item.codigo_igss && r.subproducto === item.subproducto);
      if (!renglon) return { error: "Uno de los insumos no pertenece a esta consolidación" };
      costo += renglon.cantidad * item.precio_unitario;
    }

    const [nuevo] = await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo, exento_iva: data.exento_iva,
      orden: count, creado_por: check.uid,
    }).returning();

    await db.insert(oferentePrecios).values(data.items.map(i => ({
      oferente_id: nuevo.id, codigo_igss: i.codigo_igss, subproducto: i.subproducto, precio_unitario: i.precio_unitario,
    })));

    return { oferente: nuevo };
  } catch {
    return { error: "Error al agregar el oferente" };
  }
}

export async function eliminarOferente(oferenteId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    await db.delete(oferentes).where(eq(oferentes.id, oferenteId));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar el oferente" };
  }
}

export async function elegirFormaBajaCuantia(consolidacionId: number, regularizado: boolean): Promise<
  { ok: true; subTipo: "con_insumos" | "por_servicios" | null } | { error: string }
> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.tipo_compra !== "Baja Cuantía" && con.tipo_compra !== "Casos de Excepción")
      return { error: "Esta acción solo aplica a Baja Cuantía o Casos de Excepción" };

    await db.update(consolidaciones).set({ regularizado }).where(eq(consolidaciones.id, consolidacionId));
    if (regularizado) return { ok: true as const, subTipo: null };

    // "con_insumos" si algún ítem del SIAF consolidado tiene código IGSS; si no, "por_servicios"
    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
    let tieneCodigo = false;
    if (siafIds.length > 0) {
      const [row] = await db.select({ id: siafComprasItems.id }).from(siafComprasItems)
        .where(and(
          inArray(siafComprasItems.solicitud_id, siafIds),
          sql`${siafComprasItems.codigo_igss} IS NOT NULL`,
        )).limit(1);
      tieneCodigo = !!row;
    }
    return { ok: true as const, subTipo: tieneCodigo ? ("con_insumos" as const) : ("por_servicios" as const) };
  } catch {
    return { error: "Error al elegir la forma de Baja Cuantía" };
  }
}

export async function buscarCotizacionServicio() {
  const session = await auth();
  if (!session) return [];
  return db.select().from(cotizacionesServicio)
    .where(eq(cotizacionesServicio.usado, false))
    .orderBy(sql`created_at DESC`);
}

export async function confirmarBajaCuantiaServicios(consolidacionId: number, cotizacionId: number, referencia: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [cot] = await db.select().from(cotizacionesServicio)
      .where(eq(cotizacionesServicio.id, cotizacionId)).limit(1);
    if (!cot) return { error: "No se encontró la cotización" };
    if (cot.usado) return { error: "Esa cotización ya fue usada en otra consolidación" };

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: cot.proveedor_id,
      cotizacion_servicio_id: cot.id,
      nit: cot.proveedor_nit ?? "", nombre: cot.proveedor_nombre,
      costo: cot.costo, exento_iva: cot.exento_iva,
      orden: 0, creado_por: check.uid,
    });
    await db.update(cotizacionesServicio)
      .set({ usado: true, usado_en_consolidacion_id: consolidacionId })
      .where(eq(cotizacionesServicio.id, cotizacionId));

    return enviarAJunta(consolidacionId, { referencia });
  } catch {
    return { error: "Error al confirmar la cotización de servicio" };
  }
}

// Baja Cuantía/Normal con insumos, respaldada por una cotización anual (varios
// insumos con precio ya pactado por proveedor). A diferencia de la comparación
// manual de oferentes, aquí el precio de cada insumo se cruza automáticamente
// por código contra la cotización — no hay "ganador" que elegir, así que se
// salta por completo la pantalla de Junta Adjudicadora/Adjudicación (SIGES) y
// se pasa directo a "Adjudicado", que ya es justo el estado que
// getActasPendientes() usa para poblar Junta Adjudicadora/Acta. Junta sigue
// revisando/aprobando ahí, igual que hoy.
export async function confirmarBajaCuantiaConCotizacionAnual(consolidacionId: number, cotizacionAnualId: number): Promise<
  { ok: true } | { error: string; limitExceeded?: true }
> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.tipo_compra !== "Baja Cuantía")
      return { error: "Esta acción solo aplica a Baja Cuantía" };
    if (con.estado !== "Pendiente adjudicación" && con.estado !== "Rechazado por Junta")
      return { error: "Esta consolidación ya no está disponible para adjudicar" };

    const [cotAnual] = await db.select().from(cotizacionesAnuales)
      .where(eq(cotizacionesAnuales.id, cotizacionAnualId)).limit(1);
    if (!cotAnual) return { error: "No se encontró la cotización anual" };

    const lineas = await db.select().from(cotizacionesAnualesItems)
      .where(eq(cotizacionesAnualesItems.cotizacion_anual_id, cotizacionAnualId));
    // codigo_igss solo no basta cuando es "S/C" — varios insumos distintos
    // (Agua, Energía, cada mes...) lo comparten, así que también se cruza
    // por nombre.
    const precioPorCodigo = new Map(lineas.map(l => [`${l.codigo_igss}::${l.nombre}`, l]));

    const siafs = await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId));
    const items = siafs.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafs.map(s => s.id)))
      : [];
    if (items.length === 0) return { error: "Esta consolidación no tiene insumos" };

    const faltantes: string[] = [];
    let total = 0;
    const itemsConPrecio: { id: number; codigo_igss: string; nombre: string; precio_unitario: number; exento_iva: boolean; monto_neto: number }[] = [];
    for (const item of items) {
      const linea = item.codigo_igss ? precioPorCodigo.get(`${item.codigo_igss}::${item.nombre}`) : undefined;
      if (!linea) { faltantes.push(item.codigo_igss ?? item.nombre); continue; }
      const bruto = item.cantidad_solicitada * linea.precio_unitario;
      const montoNeto = linea.exento_iva ? bruto : bruto * 0.88;
      total += montoNeto;
      itemsConPrecio.push({ id: item.id, codigo_igss: item.codigo_igss!, nombre: item.nombre, precio_unitario: linea.precio_unitario, exento_iva: linea.exento_iva, monto_neto: montoNeto });
    }
    if (faltantes.length > 0)
      return { error: `La cotización ${cotAnual.numero} no tiene precio para: ${faltantes.join(", ")}` };

    // Q25,000 por insumo por cuatrimestre — solo Baja Cuantía (Excepción no tiene límite).
    const excedidos = await verificarLimiteInsumos(itemsConPrecio, con.fecha, consolidacionId);
    if (excedidos.length > 0) {
      return { error: mensajeLimiteExcedido(excedidos), limitExceeded: true as const };
    }

    for (const item of itemsConPrecio) {
      await db.update(siafComprasItems).set({
        precio_unitario: item.precio_unitario, item_exento_iva: item.exento_iva, monto_neto: item.monto_neto,
      }).where(eq(siafComprasItems.id, item.id));
    }

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    // exento_iva=true porque el IVA ya se aplicó por línea al calcular `total` —
    // evita que aprobarActa() lo vuelva a descontar.
    const [ofrt] = await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: cotAnual.proveedor_id,
      nit: cotAnual.proveedor_nit ?? "",
      nombre: cotAnual.proveedor_nombre,
      costo: total,
      exento_iva: true,
      orden: 0,
      creado_por: check.uid,
    }).returning();

    await db.update(consolidaciones).set({
      estado: "Adjudicado",
      oferente_ganador_id: ofrt.id,
      proveedor_id: cotAnual.proveedor_id,
      proveedor_nit: cotAnual.proveedor_nit,
      proveedor_nombre: cotAnual.proveedor_nombre,
      cotizacion_anual_id: cotizacionAnualId,
      referencia: cotAnual.numero,
      motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
    }).where(eq(consolidaciones.id, consolidacionId));

    await db.update(siafCompras).set({ estado: "Adjudicado" }).where(eq(siafCompras.consolidacion_id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al confirmar la Baja Cuantía con cotización anual" };
  }
}

// Contrato Abierto ya no pasa por Junta Adjudicadora: Compras adjudica
// directamente con una razón de adjudicación (texto libre) y el costo de
// factura (con IVA incluido, salvo que se marque exento), y la consolidación
// pasa de una vez a Presupuesto. Casos de Excepción ahora se ramifica igual
// que Baja Cuantía (Normal vs Regularizado) — ver elegirFormaBajaCuantia /
// registrarRegularizado / enviarAJunta.
export async function adjudicarDirecto(consolidacionId: number, data: {
  proveedor_id: number | null; nit: string; nombre: string;
  exento_iva: boolean; referencia: string;
  numero_adjudicacion: string; razon_adjudicacion: string;
  items: { codigo_igss: string | null; nombre?: string; subproducto: string; precio_unitario: number }[];
}): Promise<{ ok: true } | { error: string; limitExceeded?: true }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra, referencia: consolidaciones.referencia })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (tipo !== "Contrato Abierto") return { error: "Esta acción solo aplica a Contrato Abierto" };

    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!data.numero_adjudicacion.trim()) return { error: "El número de adjudicación es obligatorio" };
    if (!data.razon_adjudicacion.trim()) return { error: "La razón de adjudicación es obligatoria" };
    if (data.items.length === 0) return { error: "No hay insumos para valorizar" };
    if (data.items.some(i => !(i.precio_unitario > 0))) return { error: "Ingresa un precio unitario válido para cada insumo" };
    const label = REFERENCIA_LABEL[tipo];
    if (label && !data.referencia.trim()) return { error: `El campo "${label}" es obligatorio` };

    const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
    let bruto = 0;
    for (const item of data.items) {
      const renglon = renglones.find(r => mismoInsumo(r, item));
      if (!renglon) return { error: "Uno de los insumos no pertenece a esta consolidación" };
      bruto += renglon.cantidad * item.precio_unitario;
    }
    const total = data.exento_iva ? bruto : bruto * 0.88;
    const limite = LIMITE_POR_TIPO[tipo];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}`,
        limitExceeded: true as const,
      };
    }

    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
    const rawItems = siafIds.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];
    for (const grupo of data.items) {
      const filas = rawItems.filter(r => mismoInsumo(r, grupo));
      for (const fila of filas) {
        const filaBruto = fila.cantidad_solicitada * grupo.precio_unitario;
        const montoNeto = data.exento_iva ? filaBruto : filaBruto * 0.88;
        await db.update(siafComprasItems).set({
          precio_unitario: grupo.precio_unitario, item_exento_iva: data.exento_iva, monto_neto: montoNeto,
        }).where(eq(siafComprasItems.id, fila.id));
      }
    }

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo: bruto, exento_iva: data.exento_iva,
      orden: 0, creado_por: check.uid,
    });

    await db.update(consolidaciones).set({
      referencia: label ? data.referencia.trim() : con.referencia,
      numero_adjudicacion: data.numero_adjudicacion.trim(),
      razon_adjudicacion: data.razon_adjudicacion.trim(),
      proveedor_id: data.proveedor_id,
      proveedor_nit: data.nit.trim(), proveedor_nombre: data.nombre.trim(),
      exento_iva: data.exento_iva, total,
      destino: "presupuesto", estado: "Enviado a Presupuesto",
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true as const };
  } catch {
    return { error: "Error al adjudicar" };
  }
}

export async function enviarAJunta(consolidacionId: number, data?: { referencia?: string }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (!tipo) return { error: "Selecciona primero el tipo de compra" };

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(oferentes)
      .where(eq(oferentes.consolidacion_id, consolidacionId));
    if (count === 0) return { error: "Agrega al menos un oferente antes de enviar a Junta" };

    if (tipo === "Compra Directa" && (!con.nog || !con.fecha_evento))
      return { error: "Completa el NOG y la fecha del evento antes de enviar a Junta" };

    const label = REFERENCIA_LABEL[tipo];
    const referencia = data?.referencia?.trim() || con.referencia || "";
    if (label && !referencia) return { error: `El campo "${label}" es obligatorio` };

    const ahora = fechaHoraGuatemala();
    await db.update(consolidaciones).set({
      estado: "Enviado a Junta",
      enviado_a_junta_por: check.uid,
      enviado_a_junta_en: ahora,
      motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
      referencia: label ? referencia : con.referencia,
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al enviar a Junta" };
  }
}

// Nota: el No. de Pedido, la Unidad de Medida, la Descripción y la Cantidad ya
// no se piden al usuario — se derivan de los SIAF/insumos consolidados (ver
// ComprasAdjudicacionClient.tsx). Los datos de factura/DTE y el correlativo
// A-04 SIAF (numero_a04/anio_a04) ya no se capturan aquí: se generan más
// adelante en Fondo Rotativo/SIAF-04 (ver siaf04-actions.ts), cuando ya se
// tiene la factura física en mano.
//
// El monto ya no se teclea combinado: se captura un precio_unitario por cada
// insumo consolidado (mismo agrupado codigo_igss+subproducto que ya se
// mostraba), y el total se calcula solo. Esto deja cada ítem valorizado en
// siaf_compras_items (precio_unitario/monto_neto), que es lo que permite
// controlar el límite de Q25,000 por insumo por cuatrimestre en Baja
// Cuantía. Casos de Excepción no tiene ninguna limitante.
export async function registrarRegularizado(consolidacionId: number, data: {
  nit: string; nombre: string; exento_iva: boolean;
  proveedor_direccion: string; proveedor_telefono: string;
  no_pedido: string; descripcion: string; unidad_medida: string; cantidad: number;
  items: { codigo_igss: string | null; nombre?: string; subproducto: string; precio_unitario: number }[];
  cotizacion_anual_id?: number; cotizacion_servicio_id?: number;
}): Promise<{ ok: true } | { error: string; limitExceeded?: true }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({
      tipo_compra: consolidaciones.tipo_compra, regularizado: consolidaciones.regularizado, fecha: consolidaciones.fecha,
    }).from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if ((con.tipo_compra !== "Baja Cuantía" && con.tipo_compra !== "Casos de Excepción") || con.regularizado !== true)
      return { error: "Esta acción solo aplica a Baja Cuantía o Casos de Excepción, en su forma Regularizado" };

    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!data.proveedor_direccion.trim()) return { error: "La dirección del proveedor es obligatoria" };
    if (!data.no_pedido.trim()) return { error: "El No. de Pedido es obligatorio" };
    if (!data.descripcion.trim()) return { error: "La descripción del gasto es obligatoria" };
    if (!data.unidad_medida.trim()) return { error: "La unidad de medida es obligatoria" };
    if (!(data.cantidad > 0)) return { error: "Ingresa una cantidad válida" };
    if (data.items.length === 0) return { error: "No hay insumos para valorizar" };
    if (data.items.some(i => !(i.precio_unitario > 0))) return { error: "Ingresa un precio unitario válido para cada insumo" };

    // Casos de Excepción no lleva cotización — Baja Cuantía sí, sea anual
    // (insumos con precio pactado) o de servicio (una sola cotización recibida
    // con antelación), según el caso.
    let cotAnual: typeof cotizacionesAnuales.$inferSelect | null = null;
    let cotServicio: typeof cotizacionesServicio.$inferSelect | null = null;
    if (con.tipo_compra === "Baja Cuantía") {
      if (!data.cotizacion_anual_id && !data.cotizacion_servicio_id)
        return { error: "Selecciona una cotización (anual o de servicio) antes de continuar" };
      if (data.cotizacion_anual_id) {
        const [cot] = await db.select().from(cotizacionesAnuales).where(eq(cotizacionesAnuales.id, data.cotizacion_anual_id)).limit(1);
        if (!cot) return { error: "No se encontró la cotización anual" };
        cotAnual = cot;
      } else if (data.cotizacion_servicio_id) {
        const [cot] = await db.select().from(cotizacionesServicio).where(eq(cotizacionesServicio.id, data.cotizacion_servicio_id)).limit(1);
        if (!cot) return { error: "No se encontró la cotización de servicio" };
        if (cot.usado) return { error: "Esa cotización ya fue usada en otra consolidación" };
        cotServicio = cot;
      }
    }

    const siafsDeConsolidacion = await db.select({ id: siafCompras.id, presupuesto_aplicado: siafCompras.presupuesto_aplicado })
      .from(siafCompras).where(eq(siafCompras.consolidacion_id, consolidacionId));
    const siafIds = siafsDeConsolidacion.map(s => s.id);
    const rawItems = siafIds.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];

    let monto_bruto = 0;
    const actualizaciones: { id: number; codigo_igss: string | null; nombre: string; precio_unitario: number; monto_neto: number }[] = [];
    for (const grupo of data.items) {
      const filas = rawItems.filter(r => mismoInsumo(r, grupo));
      for (const fila of filas) {
        const bruto = fila.cantidad_solicitada * grupo.precio_unitario;
        monto_bruto += bruto;
        const montoNeto = data.exento_iva ? bruto : bruto * 0.88;
        actualizaciones.push({ id: fila.id, codigo_igss: fila.codigo_igss, nombre: fila.nombre, precio_unitario: grupo.precio_unitario, monto_neto: montoNeto });
      }
    }
    if (actualizaciones.length === 0) return { error: "No se encontraron los insumos consolidados" };

    const total = data.exento_iva ? monto_bruto : monto_bruto * 0.88;

    if (con.tipo_compra === "Baja Cuantía") {
      const excedidos = await verificarLimiteInsumos(
        actualizaciones.filter((a): a is typeof a & { codigo_igss: string } => a.codigo_igss != null)
          .map(a => ({ codigo_igss: a.codigo_igss, nombre: a.nombre, monto_neto: a.monto_neto })),
        con.fecha, consolidacionId,
      );
      if (excedidos.length > 0) return { error: mensajeLimiteExcedido(excedidos), limitExceeded: true as const };
    }
    // Casos de Excepción: sin limitante alguna, no se aplica ningún control aquí.

    // Regularizado nunca pasa por Pre-Compromiso/Compromiso — va directo a
    // Devengado Regularizado (ver reflejarEnEjecucion en
    // fondo-rotativo-pagos-actions.ts) sin que nada más valide antes que
    // haya presupuesto. Por eso se valida aquí, contra el presupuesto
    // disponible real de cada renglón (Vigente − ya reservado/ejecutado en
    // cualquier etapa — ver getDisponible en presupuesto-disponible.ts).
    const montosPorRenglon = new Map<string, { renglon: number; subproducto: string; monto: number }>();
    for (const grupo of data.items) {
      if (!grupo.codigo_igss) continue;
      const [cat] = await db.select({ renglon: catalogoCompras.renglon }).from(catalogoCompras)
        .where(and(eq(catalogoCompras.codigo_igss, grupo.codigo_igss), eq(catalogoCompras.subproducto, grupo.subproducto)))
        .limit(1);
      if (cat?.renglon == null) continue;
      const filas = rawItems.filter(r => mismoInsumo(r, grupo));
      const bruto = filas.reduce((s, f) => s + f.cantidad_solicitada * grupo.precio_unitario, 0);
      const montoNeto = data.exento_iva ? bruto : bruto * 0.88;
      const key = `${cat.renglon}::${grupo.subproducto}`;
      const existente = montosPorRenglon.get(key);
      if (existente) existente.monto += montoNeto;
      else montosPorRenglon.set(key, { renglon: cat.renglon, subproducto: grupo.subproducto, monto: montoNeto });
    }

    // El o los SIAF de esta consolidación ya reservaron Pre-Compromiso al
    // aprobarse (aprobarSolicitud), y Regularizado no lo libera hasta Fondo
    // Rotativo/Pagos (reflejarEnEjecucion) — bastante más adelante que este
    // paso. Sin sumarlo de vuelta aquí, el disponible real de este mismo
    // gasto se contaría dos veces: una como Pre-Compromiso ya reservado y
    // otra en esta verificación, rechazando compras que sí caben en el
    // presupuesto.
    const yaReservado = new Map<string, number>();
    for (const s of siafsDeConsolidacion) {
      if (!s.presupuesto_aplicado) continue;
      const montos = await calcularReversionPresupuestoAplicado(s.id);
      if (!montos) continue;
      for (const { renglon, subproducto, monto } of montos.values()) {
        const key = `${renglon}::${subproducto}`;
        yaReservado.set(key, (yaReservado.get(key) ?? 0) + monto);
      }
    }

    const excedidos: { renglon: number; subproducto: string; disponible: number; requerido: number }[] = [];
    for (const { renglon, subproducto, monto } of montosPorRenglon.values()) {
      const { disponible } = await getDisponible(renglon, subproducto);
      const disponibleAjustado = disponible + (yaReservado.get(`${renglon}::${subproducto}`) ?? 0);
      if (monto > disponibleAjustado + 0.01) {
        excedidos.push({ renglon, subproducto, disponible: disponibleAjustado, requerido: monto });
      }
    }
    if (excedidos.length > 0) {
      return { error: await mensajePresupuestoExcedido(excedidos) };
    }

    for (const act of actualizaciones) {
      await db.update(siafComprasItems).set({
        precio_unitario: act.precio_unitario, item_exento_iva: data.exento_iva, monto_neto: act.monto_neto,
      }).where(eq(siafComprasItems.id, act.id));
    }

    await db.update(consolidaciones).set({
      proveedor_nit: data.nit.trim(), proveedor_nombre: data.nombre.trim(),
      exento_iva: data.exento_iva, total, monto_bruto,
      destino: "fondo_rotativo", estado: "Enviado a Fondo Rotativo",
      proveedor_direccion: data.proveedor_direccion.trim(), proveedor_telefono: data.proveedor_telefono.trim(),
      a04_no_pedido: data.no_pedido.trim(), a04_descripcion: data.descripcion.trim(),
      a04_unidad_medida: data.unidad_medida.trim(), a04_cantidad: data.cantidad,
      cotizacion_anual_id: cotAnual?.id ?? null,
    }).where(eq(consolidaciones.id, consolidacionId));

    if (cotServicio) {
      await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
      await db.insert(oferentes).values({
        consolidacion_id: consolidacionId,
        proveedor_id: cotServicio.proveedor_id,
        cotizacion_servicio_id: cotServicio.id,
        nit: data.nit.trim(), nombre: data.nombre.trim(),
        costo: monto_bruto, exento_iva: data.exento_iva,
        orden: 0, creado_por: check.uid,
      });
      await db.update(cotizacionesServicio)
        .set({ usado: true, usado_en_consolidacion_id: consolidacionId })
        .where(eq(cotizacionesServicio.id, cotServicio.id));
    }

    return { ok: true as const };
  } catch {
    return { error: "Error al registrar la compra regularizada" };
  }
}
