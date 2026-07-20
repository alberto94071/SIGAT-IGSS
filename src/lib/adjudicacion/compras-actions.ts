"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import {
  consolidaciones, oferentes, cotizacionesServicio, siafCompras, siafComprasItems,
  cotizacionesAnuales, cotizacionesAnualesItems,
} from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { TIPOS, MAX_OFERENTES, REFERENCIA_LABEL, LIMITE_POR_TIPO, type TipoCompra } from "./types";
import { verificarLimiteInsumos, mensajeLimiteExcedido } from "./limite-baja-cuantia";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
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

export async function agregarOferente(consolidacionId: number, data: {
  proveedor_id: number | null; nit: string; nombre: string; costo: number; exento_iva: boolean;
}): Promise<{ oferente: typeof oferentes.$inferSelect } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!(data.costo > 0)) return { error: "Ingresa un costo válido" };

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(oferentes)
      .where(eq(oferentes.consolidacion_id, consolidacionId));
    if (count >= MAX_OFERENTES) return { error: `Ya hay ${MAX_OFERENTES} oferentes registrados (máximo permitido)` };

    const [nuevo] = await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo: data.costo, exento_iva: data.exento_iva,
      orden: count, creado_por: check.uid,
    }).returning();

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
    const precioPorCodigo = new Map(lineas.map(l => [l.codigo_igss, l]));

    const siafs = await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId));
    const items = siafs.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafs.map(s => s.id)))
      : [];
    if (items.length === 0) return { error: "Esta consolidación no tiene insumos" };

    const faltantes: string[] = [];
    let total = 0;
    const itemsConPrecio: { id: number; codigo_igss: string; precio_unitario: number; exento_iva: boolean; monto_neto: number }[] = [];
    for (const item of items) {
      const linea = item.codigo_igss ? precioPorCodigo.get(item.codigo_igss) : undefined;
      if (!linea) { faltantes.push(item.codigo_igss ?? item.nombre); continue; }
      const bruto = item.cantidad_solicitada * linea.precio_unitario;
      const montoNeto = linea.exento_iva ? bruto : bruto * 0.88;
      total += montoNeto;
      itemsConPrecio.push({ id: item.id, codigo_igss: item.codigo_igss!, precio_unitario: linea.precio_unitario, exento_iva: linea.exento_iva, monto_neto: montoNeto });
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
  costo: number; exento_iva: boolean; referencia: string; razon: string;
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
    if (!(data.costo > 0)) return { error: "Ingresa un costo de factura válido" };
    if (!data.razon.trim()) return { error: "La razón de adjudicación es obligatoria" };
    const label = REFERENCIA_LABEL[tipo];
    if (label && !data.referencia.trim()) return { error: `El campo "${label}" es obligatorio` };

    const total = data.exento_iva ? data.costo : data.costo * 0.88;
    const limite = LIMITE_POR_TIPO[tipo];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}`,
        limitExceeded: true as const,
      };
    }

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo: data.costo, exento_iva: data.exento_iva,
      orden: 0, creado_por: check.uid,
    });

    await db.update(consolidaciones).set({
      referencia: label ? data.referencia.trim() : con.referencia,
      numero_adjudicacion: data.razon.trim(),
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
  items: { codigo_igss: string | null; subproducto: string; precio_unitario: number }[];
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

    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
    const rawItems = siafIds.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];

    let monto_bruto = 0;
    const actualizaciones: { id: number; codigo_igss: string | null; precio_unitario: number; monto_neto: number }[] = [];
    for (const grupo of data.items) {
      const filas = rawItems.filter(r => r.codigo_igss === grupo.codigo_igss && r.subproducto === grupo.subproducto);
      for (const fila of filas) {
        const bruto = fila.cantidad_solicitada * grupo.precio_unitario;
        monto_bruto += bruto;
        const montoNeto = data.exento_iva ? bruto : bruto * 0.88;
        actualizaciones.push({ id: fila.id, codigo_igss: fila.codigo_igss, precio_unitario: grupo.precio_unitario, monto_neto: montoNeto });
      }
    }
    if (actualizaciones.length === 0) return { error: "No se encontraron los insumos consolidados" };

    const total = data.exento_iva ? monto_bruto : monto_bruto * 0.88;

    if (con.tipo_compra === "Baja Cuantía") {
      const excedidos = await verificarLimiteInsumos(
        actualizaciones.filter((a): a is typeof a & { codigo_igss: string } => a.codigo_igss != null)
          .map(a => ({ codigo_igss: a.codigo_igss, monto_neto: a.monto_neto })),
        con.fecha, consolidacionId,
      );
      if (excedidos.length > 0) return { error: mensajeLimiteExcedido(excedidos), limitExceeded: true as const };
    }
    // Casos de Excepción: sin limitante alguna, no se aplica ningún control aquí.

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
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true as const };
  } catch {
    return { error: "Error al registrar la compra regularizada" };
  }
}
