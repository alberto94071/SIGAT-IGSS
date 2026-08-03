"use server";
import { db } from "@/lib/db";
import { ordenesCompra, consolidaciones, actasAdjudicacion, oferentes, cotizacionesServicio } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { requireModuloAccessAction } from "@/lib/modulo-access";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { presupuestoRenglones, programacionEntradas, programacionCompromisos } from "@/lib/schema";
import { and } from "drizzle-orm";
import { requiereDab60, cuatrimestreDeFecha } from "@/lib/programacion-constants";
import { fechaGuatemala, fechaHoraGuatemala } from "@/lib/date-utils";
import { verificarProgramadoPorTipo, mensajeProgramadoExcedido } from "@/lib/presupuesto-disponible";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getOrdenesEnCompromiso() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "En Compromiso")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

/** Órdenes con el No. de Compromiso ya registrado, esperando que Presupuesto lo apruebe. */
export async function getOrdenesCompromisoSolicitado() {
  const ordenes = await db.select().from(ordenesCompra).where(eq(ordenesCompra.estado, "Compromiso Solicitado")).orderBy(sql`created_at ASC`);
  return Promise.all(ordenes.map(async o => ({
    ...o, renglones: await gruposRenglonDeConsolidacion(o.consolidacion_id),
  })));
}

/**
 * Registra el No. de Compromiso de una orden y la deja "Compromiso
 * Solicitado" — todavía NO mueve presupuesto ni la deja pasar a Almacén/
 * DAB-60/Devengado. Eso solo pasa al aprobar (ver aprobarCompromiso), que
 * requiere acceso al módulo de Presupuesto.
 */
export async function registrarCompromiso(ordenId: number, noCompromiso: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!noCompromiso.trim()) return { error: "El No. de Compromiso es obligatorio" };

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "En Compromiso") return { error: "Esta orden ya fue enviada a Devengado" };

    await db.update(ordenesCompra).set({
      no_compromiso: noCompromiso.trim(), estado: "Compromiso Solicitado",
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al registrar el compromiso" };
  }
}

/**
 * Aprueba el Compromiso — solo quien tenga acceso a mod_presupuesto. Recién
 * aquí se mueve Pre-Compromiso → Compromiso y la orden puede avanzar a
 * Almacén/DAB-60 o Devengado; antes de esto queda bloqueada.
 *
 * Antes de mover nada, valida que cada renglón/sub-producto todavía tenga
 * suficiente Pre-Compromiso reservado para cubrir el monto actual — puede
 * haber cambiado desde que se aprobó el SIAF (ej. el precio se ajustó ya
 * adjudicado) y por eso no basta con lo que ya se validó en ese momento.
 */
export async function aprobarCompromiso(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      no_compromiso: ordenesCompra.no_compromiso,
    }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Compromiso Solicitado") return { error: "Esta orden no está pendiente de aprobación de Compromiso" };

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

    const faltantes: string[] = [];
    for (const r of renglones) {
      const [vivo] = await db.select({ pre_compromiso: presupuestoRenglones.pre_compromiso })
        .from(presupuestoRenglones).where(and(
          eq(presupuestoRenglones.renglon, r.renglon as number),
          eq(presupuestoRenglones.subproducto, r.subproducto),
          eq(presupuestoRenglones.ejercicio_fiscal, 2026),
        )).limit(1);
      const disponible = vivo?.pre_compromiso ?? 0;
      if (r.total > disponible + 0.01) {
        const faltante = r.total - disponible;
        faltantes.push(`renglón ${r.renglon} / ${r.subproducto} (disponible Q${disponible.toLocaleString("es-GT", { minimumFractionDigits: 2 })}, faltan Q${faltante.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`);
      }
    }
    if (faltantes.length > 0) {
      return { error: `La programación no es suficiente: ${faltantes.join("; ")}. Solicita una Reprogramación antes de aprobar.` };
    }

    // Toda orden que llega a Compromiso es "Normal" (Regularizado nunca
    // genera Orden de Compra) — además del Pre-Compromiso reservado arriba,
    // se valida que exista Programado NORMAL suficiente en el cuatrimestre
    // vigente para ese renglón: el Pre-Compromiso combinado (Normal +
    // Regularizado, reservado al aprobar el SIAF) puede alcanzar aunque el
    // tipo específico que se terminó eligiendo no tenga Programado propio.
    const excedidosProgramado = await verificarProgramadoPorTipo(
      renglones.map(r => ({ renglon: r.renglon as number, subproducto: r.subproducto, monto: r.total })),
      "normal",
    );
    if (excedidosProgramado.length > 0) {
      return { error: mensajeProgramadoExcedido(excedidosProgramado, "normal") };
    }

    // Insumos (renglones 200-299/300-399, salvo servicios 261/266/295) pasan
    // primero por Almacén/DAB-60; el resto va directo a Devengado.
    const necesitaDab60 = renglones.some(r => requiereDab60(r.renglon));
    const siguienteEstado = necesitaDab60 ? "Pendiente DAB-60" : "En Devengado";

    await db.update(ordenesCompra).set({ estado: siguienteEstado }).where(eq(ordenesCompra.id, ordenId));

    const cuatrimestreActual = cuatrimestreDeFecha(fechaGuatemala());

    for (const r of renglones) {
      await db.update(presupuestoRenglones).set({
        pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) - ${r.total}`,
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) + ${r.total}`,
        saldo_disponible: sql`COALESCE(${presupuestoRenglones.saldo_disponible}, 0) - ${r.total}`
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026)
      ));

      // Ledger para la caducidad de cuatrimestre (ver cierre-cuatrimestre.ts):
      // el Compromiso solo aplica a Órdenes de Compra (Normal), nunca a Fondo
      // Rotativo. Si no hay una entrada de Programación vigente para este
      // renglón/sub-producto en el cuatrimestre actual, no hay nada que
      // registrar (no se podrá trasladar, que es lo correcto).
      const [entrada] = await db.select({ id: programacionEntradas.id })
        .from(programacionEntradas).where(and(
          eq(programacionEntradas.ejercicio_fiscal, 2026),
          eq(programacionEntradas.cuatrimestre, cuatrimestreActual),
          eq(programacionEntradas.renglon, r.renglon as number),
          eq(programacionEntradas.subproducto, r.subproducto),
          eq(programacionEntradas.tipo, "normal"),
        )).limit(1);

      if (entrada) {
        await db.insert(programacionCompromisos).values({
          programacion_entrada_id: entrada.id,
          orden_id: ordenId,
          no_compromiso: orden.no_compromiso ?? "",
          monto: r.total,
        });
      }
    }

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el compromiso" };
  }
}

/** Rechaza el Compromiso mientras siga "Compromiso Solicitado" — regresa a "En Compromiso" para corregir el número. Solo quien tenga acceso a mod_presupuesto. */
export async function rechazarCompromiso(ordenId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({ estado: ordenesCompra.estado }).from(ordenesCompra)
      .where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Compromiso Solicitado") return { error: "Esta orden no está pendiente de aprobación de Compromiso" };

    await db.update(ordenesCompra).set({
      estado: "En Compromiso", no_compromiso: null,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el compromiso" };
  }
}

const ESTADOS_REGRESABLES = ["Pendiente DAB-60", "DAB-60 Pendiente Aprobación", "En Devengado", "Devengado Solicitado", "Completada"];

/**
 * Devuelve una orden a "En Compromiso" desde cualquier punto posterior a
 * que se aprobó el Compromiso — incluso ya devengada — deshaciendo los
 * movimientos de presupuesto que ya se habían hecho: si ya llegó a
 * Devengado (orden "Completada"), primero se resta lo que se había sumado
 * a Devengado (neto de IVA, ver aprobarDevengado) y se restaura el
 * Compromiso liberado ahí; siempre se deshace también la aprobación del
 * Compromiso (vuelve a Pre-Compromiso). No se puede usar si ya se marcó
 * "Pagado" — para entonces el desembolso ya ocurrió en la realidad. Solo
 * quien tenga acceso a mod_presupuesto. Queda registrado en
 * historial_devoluciones, para que se vea en Hoja de Ruta.
 */
export async function regresarACompromiso(ordenId: number, motivo?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      exento_iva: ordenesCompra.exento_iva,
      estado_devengado: ordenesCompra.estado_devengado,
      historial_devoluciones: ordenesCompra.historial_devoluciones,
    }).from(ordenesCompra).where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (!ESTADOS_REGRESABLES.includes(orden.estado)) {
      return { error: "Esta orden no se puede devolver a Compromiso desde su estado actual" };
    }
    if (orden.estado === "Completada" && orden.estado_devengado === "Pagado") {
      return { error: "Ya se marcó como Pagado — el desembolso ya ocurrió, no se puede devolver" };
    }

    const yaDevengado = orden.estado === "Completada";
    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

    let esRegularizado = false;
    if (yaDevengado) {
      const [con] = await db.select({ regularizado: consolidaciones.regularizado })
        .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
      esRegularizado = con?.regularizado === true;
    }

    for (const r of renglones) {
      if (yaDevengado) {
        const montoDevengado = orden.exento_iva ? r.total : r.total * 0.88;
        await db.update(presupuestoRenglones).set({
          pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${r.total}`,
          ...(esRegularizado
            ? { devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) - ${montoDevengado}` }
            : { devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) - ${montoDevengado}` }),
        }).where(and(
          eq(presupuestoRenglones.renglon, r.renglon as number),
          eq(presupuestoRenglones.subproducto, r.subproducto),
          eq(presupuestoRenglones.ejercicio_fiscal, 2026),
        ));
        // El Compromiso no se toca: aprobarDevengado ya lo había liberado
        // (-r.total) y ahora se está deshaciendo también la aprobación del
        // Compromiso (+r.total más abajo estaría de más) — se cancelan.
      } else {
        await db.update(presupuestoRenglones).set({
          pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${r.total}`,
          compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
          saldo_disponible: sql`COALESCE(${presupuestoRenglones.saldo_disponible}, 0) + ${r.total}`,
        }).where(and(
          eq(presupuestoRenglones.renglon, r.renglon as number),
          eq(presupuestoRenglones.subproducto, r.subproducto),
          eq(presupuestoRenglones.ejercicio_fiscal, 2026),
        ));
      }
    }

    // El compromiso de esta orden se está deshaciendo por completo (en las
    // dos ramas de arriba) — el ledger de cierre de cuatrimestre ya no debe
    // contarlo, o cierre-cuatrimestre.ts lo trasladaría igual al siguiente
    // cuatrimestre aunque el compromiso ya no exista.
    await db.delete(programacionCompromisos).where(eq(programacionCompromisos.orden_id, ordenId));

    const nota = `${fechaHoraGuatemala()}: Devuelta desde ${orden.estado} a Compromiso${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historial = orden.historial_devoluciones ? `${orden.historial_devoluciones}\n${nota}` : nota;

    await db.update(ordenesCompra).set({
      estado: "En Compromiso",
      no_compromiso: null,
      no_devengado: null,
      fecha_envio_daf: null,
      estado_devengado: null,
      fecha_pago: null,
      historial_devoluciones: historial,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al devolver la orden a Compromiso" };
  }
}

/**
 * Devuelve una orden ya "Completada" (rechazada por la DAF en seguimiento
 * de pago) a la bandeja de aprobación de Almacén/DAB-60, en vez de hasta
 * Compromiso — para el caso más común de una DAF rechazada: el error está
 * en los datos que capturó Almacén (No./Serie de Recibo, factura, lote...),
 * no en el Compromiso en sí, que sigue siendo válido y no se toca. Solo
 * aplica a órdenes que sí pasaron por DAB-60 (dab60_generado_en); las que
 * no (servicios) siguen usando regresarACompromiso. Deshace únicamente el
 * movimiento de presupuesto de Devengado (vuelve a Compromiso, resta de
 * Devengado/Devengado Regularizado). Solo quien tenga acceso a
 * mod_presupuesto. Queda registrado en historial_devoluciones.
 */
export async function regresarADab60(ordenId: number, motivo?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      exento_iva: ordenesCompra.exento_iva,
      estado_devengado: ordenesCompra.estado_devengado,
      dab60_generado_en: ordenesCompra.dab60_generado_en,
      historial_devoluciones: ordenesCompra.historial_devoluciones,
    }).from(ordenesCompra).where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (orden.estado !== "Completada") return { error: "Esta orden no está en seguimiento de pago con la DAF" };
    if (orden.estado_devengado === "Pagado") return { error: "Ya se marcó como Pagado — el desembolso ya ocurrió, no se puede devolver" };
    if (!orden.dab60_generado_en) return { error: "Esta orden no pasó por Almacén/DAB-60 — usa Devolver a Compromiso" };

    const [con] = await db.select({ regularizado: consolidaciones.regularizado })
      .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
    const esRegularizado = con?.regularizado === true;

    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);
    for (const r of renglones) {
      const montoDevengado = orden.exento_iva ? r.total : r.total * 0.88;
      await db.update(presupuestoRenglones).set({
        compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) + ${r.total}`,
        ...(esRegularizado
          ? { devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) - ${montoDevengado}` }
          : { devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) - ${montoDevengado}` }),
      }).where(and(
        eq(presupuestoRenglones.renglon, r.renglon as number),
        eq(presupuestoRenglones.subproducto, r.subproducto),
        eq(presupuestoRenglones.ejercicio_fiscal, 2026),
      ));
    }

    const nota = `${fechaHoraGuatemala()}: Devuelta desde Completada (rechazada por la DAF) a Almacén/DAB-60${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historial = orden.historial_devoluciones ? `${orden.historial_devoluciones}\n${nota}` : nota;

    await db.update(ordenesCompra).set({
      estado: "DAB-60 Pendiente Aprobación",
      no_devengado: null,
      fecha_envio_daf: null,
      estado_devengado: null,
      fecha_pago: null,
      historial_devoluciones: historial,
    }).where(eq(ordenesCompra.id, ordenId));

    return { ok: true };
  } catch {
    return { error: "Error al devolver la orden a Almacén/DAB-60" };
  }
}

/**
 * Devuelve una orden (desde cualquier punto posterior a la aprobación del
 * Compromiso, igual que regresarACompromiso) hasta Compras/Adjudicación —
 * para el caso de que el error esté en cómo se adjudicó (tipo de compra,
 * cotización, proveedor, oferentes...), no solo en el Compromiso o en
 * Almacén. Deshace TODOS los movimientos de presupuesto (Devengado si ya se
 * había hecho, y el Compromiso completo — vuelve a Pre-Compromiso), anula
 * la orden (queda "Anulada", ya no aparece en ninguna bandeja activa; si
 * tenía un DAB-60 generado se marca dab60_anulado — se conserva para
 * historial en Almacén/Archivo, pero ya no se puede reimprimir), borra el
 * Acta de Junta Adjudicadora si existía (su consolidacion_id es único, no
 * puede quedar una vieja estorbando cuando se vuelva a adjudicar) y
 * cualquier oferente/cotización de servicio reservada, y regresa la
 * consolidación a "Pendiente adjudicación" para volver a armar todo el
 * proceso desde Compras/Adjudicación. Solo quien tenga acceso a
 * mod_presupuesto. Queda registrado en historial_devoluciones (de la orden
 * y de la consolidación), para que se vea en Hoja de Ruta.
 */
export async function regresarOrdenAAdjudicacion(ordenId: number, motivo?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireModuloAccessAction("mod_presupuesto");
    if ("error" in check) return check;

    const [orden] = await db.select({
      estado: ordenesCompra.estado,
      consolidacion_id: ordenesCompra.consolidacion_id,
      exento_iva: ordenesCompra.exento_iva,
      estado_devengado: ordenesCompra.estado_devengado,
      dab60_generado_en: ordenesCompra.dab60_generado_en,
      historial_devoluciones: ordenesCompra.historial_devoluciones,
    }).from(ordenesCompra).where(eq(ordenesCompra.id, ordenId)).limit(1);
    if (!orden) return { error: "No se encontró la orden" };
    if (!ESTADOS_REGRESABLES.includes(orden.estado)) {
      return { error: "Esta orden no se puede devolver a Adjudicación desde su estado actual" };
    }
    if (orden.estado === "Completada" && orden.estado_devengado === "Pagado") {
      return { error: "Ya se marcó como Pagado — el desembolso ya ocurrió, no se puede devolver" };
    }

    const yaDevengado = orden.estado === "Completada";
    const renglones = await gruposRenglonDeConsolidacion(orden.consolidacion_id);

    // Mismo cálculo que regresarACompromiso (ya probado): si ya estaba
    // Devengado, aprobarDevengado había liberado el Compromiso (-r.total) —
    // deshacer eso Y la aprobación del propio Compromiso (+r.total) se
    // cancelan, así que ahí solo se toca Devengado y Pre-Compromiso. Si no
    // había llegado a Devengado, el Compromiso sí se deshace por completo.
    for (const r of renglones) {
      if (yaDevengado) {
        const montoDevengado = orden.exento_iva ? r.total : r.total * 0.88;
        await db.update(presupuestoRenglones).set({
          pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${r.total}`,
          devengado: sql`COALESCE(${presupuestoRenglones.devengado}, 0) - ${montoDevengado}`,
        }).where(and(
          eq(presupuestoRenglones.renglon, r.renglon as number),
          eq(presupuestoRenglones.subproducto, r.subproducto),
          eq(presupuestoRenglones.ejercicio_fiscal, 2026),
        ));
      } else {
        await db.update(presupuestoRenglones).set({
          pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${r.total}`,
          compromiso: sql`COALESCE(${presupuestoRenglones.compromiso}, 0) - ${r.total}`,
          saldo_disponible: sql`COALESCE(${presupuestoRenglones.saldo_disponible}, 0) + ${r.total}`,
        }).where(and(
          eq(presupuestoRenglones.renglon, r.renglon as number),
          eq(presupuestoRenglones.subproducto, r.subproducto),
          eq(presupuestoRenglones.ejercicio_fiscal, 2026),
        ));
      }
    }

    await db.delete(programacionCompromisos).where(eq(programacionCompromisos.orden_id, ordenId));

    const notaOrden = `${fechaHoraGuatemala()}: Devuelta desde ${orden.estado} a Compras/Adjudicación${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historialOrden = orden.historial_devoluciones ? `${orden.historial_devoluciones}\n${notaOrden}` : notaOrden;

    await db.update(ordenesCompra).set({
      estado: "Anulada",
      dab60_anulado: orden.dab60_generado_en != null,
      no_devengado: null,
      fecha_envio_daf: null,
      estado_devengado: null,
      fecha_pago: null,
      historial_devoluciones: historialOrden,
    }).where(eq(ordenesCompra.id, ordenId));

    // El Acta tiene consolidacion_id único — hay que borrarla para poder
    // volver a generar una nueva al re-adjudicar.
    await db.delete(actasAdjudicacion).where(eq(actasAdjudicacion.consolidacion_id, orden.consolidacion_id));
    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, orden.consolidacion_id));
    await db.update(cotizacionesServicio)
      .set({ usado: false, usado_en_consolidacion_id: null })
      .where(eq(cotizacionesServicio.usado_en_consolidacion_id, orden.consolidacion_id));

    const [con] = await db.select({ historial_devoluciones: consolidaciones.historial_devoluciones })
      .from(consolidaciones).where(eq(consolidaciones.id, orden.consolidacion_id)).limit(1);
    const notaCon = `${fechaHoraGuatemala()}: Devuelta desde Presupuesto/Compromiso-Devengado a Compras/Adjudicación${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historialCon = con?.historial_devoluciones ? `${con.historial_devoluciones}\n${notaCon}` : notaCon;

    await db.update(consolidaciones).set({
      estado: "Pendiente adjudicación",
      destino: null,
      tipo_compra: null,
      regularizado: null,
      proveedor_id: null, proveedor_nit: null, proveedor_nombre: null,
      exento_iva: false, total: null, monto_bruto: null,
      numero_adjudicacion: null, razon_adjudicacion: null,
      cotizacion_anual_id: null,
      motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
      historial_devoluciones: historialCon,
    }).where(eq(consolidaciones.id, orden.consolidacion_id));

    return { ok: true };
  } catch {
    return { error: "Error al devolver la orden a Compras/Adjudicación" };
  }
}
