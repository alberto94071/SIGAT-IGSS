"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  actasAdjudicacion, consolidaciones, oferentes, oferentePrecios, siafCompras, siafComprasItems,
  cotizacionesServicio, nogRegistros,
} from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { crearNotificacion } from "@/lib/notificaciones";
import { LIMITE_POR_TIPO, type TipoCompra } from "./types";
import { netoDeIva } from "@/lib/iva-utils";

async function requireJunta(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getActasPendientes() {
  const cons = await db.select().from(consolidaciones).where(eq(consolidaciones.estado, "Adjudicado"));
  if (cons.length === 0) return [];

  const actas = await db.select().from(actasAdjudicacion);
  const actasMap = new Map(actas.map(a => [a.consolidacion_id, a]));

  return cons.map(c => ({ consolidacion: c, acta: actasMap.get(c.id) ?? null }));
}

export async function generarActa(consolidacionId: number, data: {
  no_formulario: string; no_acta: string; lugar: string; fecha: string; hora: string;
}): Promise<{ acta: typeof actasAdjudicacion.$inferSelect } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    if (!data.no_formulario.trim()) return { error: "El No. de Formulario es obligatorio" };
    if (!data.no_acta.trim()) return { error: "El No. de Acta es obligatorio" };
    if (!data.lugar.trim()) return { error: "El lugar es obligatorio" };
    if (!data.fecha.trim()) return { error: "La fecha es obligatoria" };
    if (!data.hora.trim()) return { error: "La hora es obligatoria" };

    const [con] = await db.select({ estado: consolidaciones.estado }).from(consolidaciones)
      .where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Adjudicado") return { error: "Solo se puede generar acta de una consolidación Adjudicada" };

    // Si ya existe un acta (p. ej. una rechazada que se está corrigiendo), se reemplaza
    await db.delete(actasAdjudicacion).where(eq(actasAdjudicacion.consolidacion_id, consolidacionId));

    const [acta] = await db.insert(actasAdjudicacion).values({
      consolidacion_id: consolidacionId,
      no_formulario: data.no_formulario.trim(),
      no_acta: data.no_acta.trim(),
      lugar: data.lugar.trim(),
      fecha: data.fecha,
      hora: data.hora,
      generado_por: check.uid,
    }).returning();

    return { acta };
  } catch {
    return { error: "Error al generar el acta" };
  }
}

export async function marcarActaPrevisualizada(actaId: number): Promise<{ ok: true } | { error: string }> {
  try {
    await db.update(actasAdjudicacion).set({ previsualizada: true }).where(eq(actasAdjudicacion.id, actaId));
    // Sin esto, la lista de Actas (/junta-adjudicadora/acta) queda con el
    // Router Cache de Next.js desactualizado — al volver de la vista previa
    // el botón "Aprobar" no aparece hasta recargar la página a mano, porque
    // aprobarActa exige acta.previsualizada=true y esa lectura la hace fresca
    // desde la BD, pero la LISTA que el usuario ve seguía usando el snapshot
    // de antes de generar/previsualizar el acta.
    revalidatePath("/junta-adjudicadora/acta");
    return { ok: true };
  } catch {
    return { error: "Error al marcar el acta como previsualizada" };
  }
}

// Aprobar el Acta ahora hace, en un solo paso, lo que antes requería un clic
// aparte de "Completar Adjudicación" en Compras/Adjudicación: calcula el total
// a partir del oferente ganador, valida el límite legal del tipo de compra, y
// si todo está en orden envía la consolidación directo a Compras/Órdenes.
export async function aprobarActa(actaId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId)).limit(1);
    if (!acta) return { error: "No se encontró el acta" };
    if (!acta.previsualizada) return { error: "Debes previsualizar el acta antes de aprobarla" };
    if (acta.estado !== "Generada") return { error: "Esta acta ya fue procesada" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, acta.consolidacion_id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación del acta" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (!tipo) return { error: "La consolidación no tiene un tipo de compra asignado" };
    if (!con.oferente_ganador_id) return { error: "La consolidación no tiene un oferente ganador registrado" };

    const [ganador] = await db.select().from(oferentes).where(eq(oferentes.id, con.oferente_ganador_id)).limit(1);
    if (!ganador) return { error: "No se encontró el oferente ganador" };

    const total = ganador.exento_iva ? ganador.costo : netoDeIva(ganador.costo);
    const limite = LIMITE_POR_TIPO[tipo];
    // Casos de Excepción Regularizado no tiene límite — así era antes de que
    // este flujo empezara a pasar por Junta (ver registrarRegularizado en
    // compras-actions.ts), y ese criterio no cambió con el nuevo requisito
    // de pasar por Junta, solo se le sumó el paso de aprobación.
    const sinLimite = con.regularizado === true && tipo === "Casos de Excepción";
    if (!sinLimite && total > limite) {
      return { error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}. Rechaza el acta para que Compras corrija el precio.` };
    }

    // Copiar el precio por insumo del oferente ganador a siaf_compras_items —
    // es lo que después usa Compras/Órdenes para mostrar el precio al elegir
    // PPR/presentación (ver getConsolidacionesPendientesOrden).
    const precios = await db.select().from(oferentePrecios).where(eq(oferentePrecios.oferente_id, ganador.id));
    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, acta.consolidacion_id))).map(s => s.id);
    const rawItems = siafIds.length > 0
      ? await db.select().from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];

    // Todo lo que dispara aprobarActa (precios copiados a siaf_compras_items,
    // el catálogo de NOG, el estado del acta y el de la consolidación) va en
    // una sola transacción — si falla a la mitad, no debe quedar el acta a
    // medio aprobar con solo parte del precio actualizado.
    const ahora = fechaHoraGuatemala();
    await db.transaction(async (tx) => {
      if (precios.length > 0) {
        for (const linea of precios) {
          const filas = rawItems.filter(r => r.codigo_igss === linea.codigo_igss && r.subproducto === linea.subproducto);
          for (const fila of filas) {
            const bruto = fila.cantidad_solicitada * linea.precio_unitario;
            const montoNeto = ganador.exento_iva ? bruto : netoDeIva(bruto);
            await tx.update(siafComprasItems).set({
              precio_unitario: linea.precio_unitario, item_exento_iva: ganador.exento_iva, monto_neto: montoNeto,
            }).where(eq(siafComprasItems.id, fila.id));
          }
        }

        // Compra Directa con NOG: deja el precio recién aprobado guardado en
        // el catálogo de NOG (reemplazando lo que hubiera antes con ese mismo
        // número) — así el próximo mes, para la misma compra recurrente (ej.
        // arrendamiento), Compras puede enviarla directo a Presupuesto sin
        // pasar de nuevo por Junta/Acta (ver confirmarCompraDirectaConNog en
        // compras-actions.ts).
        if (tipo === "Compra Directa" && con.nog?.trim()) {
          const nogTrim = con.nog.trim();
          await tx.delete(nogRegistros).where(eq(nogRegistros.nog, nogTrim));
          for (const linea of precios) {
            const filas = rawItems.filter(r => r.codigo_igss === linea.codigo_igss && r.subproducto === linea.subproducto);
            if (filas.length === 0) continue;
            const cantidadTotal = filas.reduce((sum, f) => sum + f.cantidad_solicitada, 0);
            const bruto = cantidadTotal * linea.precio_unitario;
            const totalNeto = ganador.exento_iva ? bruto : netoDeIva(bruto);
            await tx.insert(nogRegistros).values({
              nog: nogTrim,
              proveedor_id: ganador.proveedor_id, proveedor_nit: ganador.nit, proveedor_nombre: ganador.nombre,
              insumo_nombre: filas[0].nombre, insumo_codigo_igss: linea.codigo_igss, subproducto: linea.subproducto,
              cantidad_autorizada: cantidadTotal, precio: linea.precio_unitario, exento_iva: ganador.exento_iva,
              total: totalNeto, creado_por: check.uid,
            });
          }
        }
      }

      await tx.update(actasAdjudicacion).set({
        estado: "Aprobada", aprobado_por: check.uid, aprobado_en: ahora,
      }).where(eq(actasAdjudicacion.id, actaId));

      // Regularizado (Baja Cuantía o Casos de Excepción con cotización, ver
      // registrarRegularizado) llega hasta acá con con.regularizado en true
      // — recién aquí se decide que su destino final es Fondo Rotativo en
      // vez de Compras/Órdenes. monto_bruto solo se guarda para
      // Regularizado (lo usa el A-04 impreso, ver ImprimirA04Client.tsx);
      // Normal nunca lo tuvo y no hace falta empezar a escribirlo ahora.
      await tx.update(consolidaciones).set({
        acta_aprobada: true,
        exento_iva: ganador.exento_iva,
        total,
        ...(con.regularizado
          ? { destino: "fondo_rotativo", estado: "Enviado a Fondo Rotativo", monto_bruto: ganador.costo }
          : { destino: "presupuesto", estado: "Enviado a Presupuesto" }),
      }).where(eq(consolidaciones.id, acta.consolidacion_id));
    });

    return { ok: true };
  } catch {
    return { error: "Error al aprobar el acta" };
  }
}

export async function getActasHistorial() {
  const actas = await db.select().from(actasAdjudicacion)
    .where(eq(actasAdjudicacion.estado, "Aprobada"))
    .orderBy(sql`aprobado_en DESC NULLS LAST, id DESC`);
  if (actas.length === 0) return [];

  const consolIds = actas.map(a => a.consolidacion_id);
  const cons = await db.select().from(consolidaciones).where(inArray(consolidaciones.id, consolIds));
  const consMap = new Map(cons.map(c => [c.id, c]));

  return actas
    .map(acta => ({ acta, consolidacion: consMap.get(acta.consolidacion_id) }))
    .filter((r): r is { acta: typeof r.acta; consolidacion: NonNullable<typeof r.consolidacion> } => r.consolidacion != null);
}

export type DestinoRechazoActa = "junta" | "adjudicacion" | "consolidacion";

const LABEL_DESTINO: Record<DestinoRechazoActa, string> = {
  junta:         "Junta Adjudicadora",
  adjudicacion:  "Compras/Adjudicación",
  consolidacion: "Consolidación",
};

const RUTA_DESTINO: Record<DestinoRechazoActa, string> = {
  junta:         "/junta-adjudicadora/adjudicacion",
  adjudicacion:  "/compras/adjudicacion",
  consolidacion: "/compras/consolidacion",
};

// Rechazar el Acta ahora sí devuelve la consolidación hasta la etapa que
// elija quien rechaza — antes solo marcaba el acta como "Rechazada" y la
// dejaba ahí, sin mover nada. No hay presupuesto que revertir en este punto:
// el Pre-Compromiso se reserva al aprobar la solicitud A-01 SIAF (mucho
// antes) y no se vuelve a tocar hasta que se aprueba el Compromiso — un paso
// muy posterior al que un Acta puede llegar (ver aprobarCompromiso en
// compromiso-actions.ts). Por eso, sin importar el destino elegido acá, solo
// se deshacen datos de adjudicación (oferentes, consolidación, cotización),
// nunca presupuesto_renglones.
export async function rechazarActa(
  actaId: number, motivo: string, destino: DestinoRechazoActa
): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireJunta();
    if ("error" in check) return check;

    const trimmed = motivo.trim();
    if (!trimmed) return { error: "Debes indicar el motivo del rechazo" };

    const [acta] = await db.select().from(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId)).limit(1);
    if (!acta) return { error: "No se encontró el acta" };
    if (!acta.previsualizada) return { error: "Debes previsualizar el acta antes de rechazarla" };

    // Se valida sobre el estado de la CONSOLIDACIÓN (no del acta) para poder
    // corregir también actas que quedaron "Rechazada" con el comportamiento
    // anterior — su consolidación sigue en "Adjudicado", igual de atascada.
    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, acta.consolidacion_id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación del acta" };
    if (con.estado !== "Adjudicado") return { error: "Esta acta ya fue procesada" };

    const ahora = fechaHoraGuatemala();
    const nota = `${ahora}: Acta rechazada — devuelta a ${LABEL_DESTINO[destino]} — ${trimmed}`;
    const historial = con.historial_devoluciones ? `${con.historial_devoluciones}\n${nota}` : nota;

    if (destino === "junta") {
      // La Junta vuelve a evaluar el mismo expediente (mismos oferentes,
      // mismo tipo de compra) — Compras solo tiene que reenviarlo, sin
      // rearmar nada. oferente_ganador_id se limpia para dejar la
      // consolidación en el mismo estado que un rechazo normal de Junta
      // (rechazarJunta), donde todavía no hay un ganador elegido.
      await db.delete(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId));
      await db.update(consolidaciones).set({
        estado: "Rechazado por Junta",
        oferente_ganador_id: null,
        motivo_rechazo: trimmed, rechazado_por: check.uid, rechazado_en: ahora,
        historial_devoluciones: historial,
      }).where(eq(consolidaciones.id, con.id));
    } else if (destino === "adjudicacion") {
      // Compras corrige oferente/tipo de compra desde cero.
      await db.delete(actasAdjudicacion).where(eq(actasAdjudicacion.id, actaId));
      await db.update(consolidaciones).set({ oferente_ganador_id: null }).where(eq(consolidaciones.id, con.id));
      await db.delete(oferentes).where(eq(oferentes.consolidacion_id, con.id));
      await db.update(cotizacionesServicio)
        .set({ usado: false, usado_en_consolidacion_id: null })
        .where(eq(cotizacionesServicio.usado_en_consolidacion_id, con.id));
      await db.update(consolidaciones).set({
        estado: "Pendiente adjudicación",
        destino: null, tipo_compra: null, regularizado: null,
        proveedor_id: null, proveedor_nit: null, proveedor_nombre: null,
        exento_iva: false, total: null, monto_bruto: null,
        numero_adjudicacion: null, razon_adjudicacion: null,
        cotizacion_anual_id: null,
        motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
        historial_devoluciones: historial,
      }).where(eq(consolidaciones.id, con.id));
    } else {
      // Deshace la consolidación por completo: libera las solicitudes A-01
      // SIAF (vuelven a "Aprobado", listas para consolidarse de nuevo) y
      // borra la consolidación — oferentes, precios y el acta se van en
      // cascada (mismo patrón que rechazarEnAdjudicacion).
      await db.update(siafCompras)
        .set({ estado: "Aprobado", consolidacion_id: null })
        .where(eq(siafCompras.consolidacion_id, con.id));
      await db.update(cotizacionesServicio)
        .set({ usado: false, usado_en_consolidacion_id: null })
        .where(eq(cotizacionesServicio.usado_en_consolidacion_id, con.id));
      await db.delete(consolidaciones).where(eq(consolidaciones.id, con.id));
    }

    if (acta.generado_por) {
      await crearNotificacion({
        usuario_id:      acta.generado_por,
        tipo:            "acta_rechazada",
        titulo:          `Acta ${acta.no_acta} rechazada — devuelta a ${LABEL_DESTINO[destino]}`,
        mensaje:         trimmed,
        ruta:            RUTA_DESTINO[destino],
        referencia_tipo: "consolidaciones",
        referencia_id:   con.id,
      });
    }

    return { ok: true };
  } catch {
    return { error: "Error al rechazar el acta" };
  }
}
