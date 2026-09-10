"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { consolidaciones, fondoRotativoPagos, oferentes, cotizacionesServicio, actasAdjudicacion } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getPendientesPorDestino } from "./actions";
import { gruposRenglonDeConsolidacion, getPprsPorItems, clavePprDeItem, guardarPprSeleccion } from "./renglon-utils";
import { requiereDab60 } from "@/lib/programacion-constants";
import { revertirIngresoAlmacen } from "./dab60-actions";
import { LoteYaDespachadoEnTransaccion } from "./almacen-errors";
import type { Consolidacion } from "./types";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Correlativo A-04 SIAF — ahora se asigna hasta este paso (Generar SIAF), no al
// registrar la compra Regularizado, porque ya se tiene la factura física en mano.
async function siguienteNumeroA04(anio: number): Promise<number> {
  const res = await db.execute(
    sql`SELECT COALESCE(MAX(numero_a04), 0) + 1 AS next FROM consolidaciones WHERE anio_a04 = ${anio}`
  );
  return Number((res.rows[0] as any).next) || 1;
}

export async function getPendientesSiaf04(): Promise<Consolidacion[]> {
  const cons = await getPendientesPorDestino("fondo_rotativo");
  return cons.filter(c => c.numero_a04 == null);
}

export async function generarSiaf04(consolidacionId: number, data: {
  no_factura: string; serie_factura: string; fecha_emision: string;
  seleccionPpr: { codigo_igss: string; subproducto: string; nombre: string; codigo_ppr: string; descripcion_igss?: string | null }[];
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const noFactura = data.no_factura.trim();
    const serie = data.serie_factura.trim();
    if (!noFactura || !serie || !data.fecha_emision)
      return { error: "No. de Factura, Serie y Fecha de Emisión son obligatorios" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.destino !== "fondo_rotativo" || con.estado !== "Enviado a Fondo Rotativo")
      return { error: "Esta consolidación no está pendiente en Fondo Rotativo" };
    if (con.numero_a04 != null) return { error: "Ya se generó el SIAF-04 para esta consolidación" };

    const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
    const pprDisponibles = await getPprsPorItems(renglones.map(r => ({ codigo_igss: r.codigo_igss, nombre: r.nombre, renglon: r.renglon })));
    for (const r of renglones) {
      const clave = clavePprDeItem({ codigo_igss: r.codigo_igss, nombre: r.nombre, renglon: r.renglon });
      if (!pprDisponibles[clave]?.length) continue;
      const elegido = data.seleccionPpr.find(s => s.codigo_igss === r.codigo_igss && s.subproducto === r.subproducto && s.nombre === r.nombre);
      if (!elegido?.codigo_ppr) return { error: `Selecciona el PPR/presentación de "${r.nombre}" antes de generar el SIAF-04` };
    }
    await guardarPprSeleccion(consolidacionId, data.seleccionPpr);

    const anioActual = new Date().getFullYear();
    const numeroA04 = await siguienteNumeroA04(anioActual);

    // "Fecha:" del A-04 impreso es la fecha de la factura, no la de hoy
    // (pedido del cliente 2026-09-09) — el correlativo (numeroA04/anioActual)
    // no se toca, sigue por año calendario real de generación.
    await db.update(consolidaciones).set({
      numero_a04: numeroA04, anio_a04: anioActual, a04_fecha: data.fecha_emision,
      a04_dte_numero: noFactura, a04_dte_serie: serie, a04_dte_fecha: data.fecha_emision,
    }).where(eq(consolidaciones.id, consolidacionId));

    // Si algún renglón de esta compra Regularizada requiere pasar por
    // Almacén (mismo criterio que la vía Normal — grupos 200/300 excepto
    // 261/266/295), primero se queda en Almacén/DAB-60 antes de llegar a
    // Fondo Rotativo/Pagos — ver generarDab60FondoRotativo en dab60-actions.ts.
    const necesitaDab60 = renglones.some(r => requiereDab60(r.renglon));

    await db.insert(fondoRotativoPagos).values({
      consolidacion_id: consolidacionId,
      no_factura: noFactura, serie_factura: serie, fecha_emision_factura: data.fecha_emision,
      destinatario_nombre: con.proveedor_nombre,
      nit_beneficiario: con.proveedor_nit,
      creado_por: check.uid,
      estado: necesitaDab60 ? "Pendiente DAB-60" : "Pendiente forma de pago",
    });

    return { ok: true };
  } catch {
    return { error: "Error al generar el SIAF-04" };
  }
}

/**
 * Devuelve una consolidación de Fondo Rotativo hasta Compras/Adjudicación,
 * por si se confundieron los datos al registrar el Regularizado (tipo de
 * compra, cotización, proveedor, precios...) — deja la consolidación en
 * "Pendiente adjudicación" para volver a ingresarlos desde cero, sin
 * deshacer la consolidación de SIAFs (a diferencia de rechazarEnAdjudicacion,
 * que sí la deshace por completo). Borra el Acta (ya "Aprobada" a estas
 * alturas — aprobarActa es lo que manda la consolidación a "Enviado a Fondo
 * Rotativo") y libera oferente_ganador_id/oferentes/cotización de servicio,
 * mismo patrón que regresarOrdenAAdjudicacion (vía Normal).
 *
 * Aplica tanto si el SIAF-04 todavía no se generó (numero_a04 null) como si
 * ya se generó y el pago está esperando en "Pendiente DAB-60" o "Pendiente
 * forma de pago" — en ninguno de los dos casos hubo reflejarEnEjecucion
 * todavía (eso solo pasa al elegir forma de pago en Fondo Rotativo/Pagos),
 * así que no hay presupuesto que deshacer (pre_compromiso se reservó desde
 * la aprobación del A-01 SIAF y sigue intacto). Si el DAB-60 ya se generó
 * (el pago ya no está en "Pendiente DAB-60"), primero se deshace el ingreso
 * a Almacén — bloqueado si ya se despachó parte de ese lote por un DAB-75.
 * Si ya se eligió forma de pago (cheque/efectivo), se rechaza — hay que usar
 * "Devolver" desde Fondo Rotativo/Pagos o Bancos primero, porque ahí sí ya
 * se movió presupuesto real. Queda registrado en historial_devoluciones,
 * para que se vea en Hoja de Ruta.
 */
export async function regresarAAdjudicacion(consolidacionId: number, motivo?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.destino !== "fondo_rotativo" || con.estado !== "Enviado a Fondo Rotativo")
      return { error: "Esta consolidación no está pendiente en Fondo Rotativo" };

    let pago: { id: number; estado: string; forma_pago: string | null } | undefined;
    if (con.numero_a04 != null) {
      [pago] = await db.select({ id: fondoRotativoPagos.id, estado: fondoRotativoPagos.estado, forma_pago: fondoRotativoPagos.forma_pago })
        .from(fondoRotativoPagos).where(eq(fondoRotativoPagos.consolidacion_id, consolidacionId)).limit(1);
      if (pago?.forma_pago != null)
        return { error: "Ya se eligió la forma de pago para esta compra — devolvela primero desde Fondo Rotativo/Pagos o Bancos" };
    }

    const nota = `${fechaHoraGuatemala()}: Devuelta desde Fondo Rotativo/${con.numero_a04 != null ? "DAB-60" : "SIAF-04"} a Compras/Adjudicación${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historial = con.historial_devoluciones ? `${con.historial_devoluciones}\n${nota}` : nota;

    await db.transaction(async (tx) => {
      if (pago) {
        if (pago.estado !== "Pendiente DAB-60") {
          await revertirIngresoAlmacen(tx, { pagoFrId: pago.id });
        }
        await tx.delete(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, pago.id));
      }

      // El Acta tiene consolidacion_id único — hay que borrarla para poder
      // volver a generar una nueva al re-adjudicar. oferente_ganador_id
      // referencia oferentes.id sin cascade — hay que soltarlo antes de poder
      // borrar los oferentes (mismo orden que regresarOrdenAAdjudicacion).
      await tx.update(consolidaciones).set({ oferente_ganador_id: null }).where(eq(consolidaciones.id, consolidacionId));
      await tx.delete(actasAdjudicacion).where(eq(actasAdjudicacion.consolidacion_id, consolidacionId));
      await tx.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
      await tx.update(cotizacionesServicio)
        .set({ usado: false, usado_en_consolidacion_id: null })
        .where(eq(cotizacionesServicio.usado_en_consolidacion_id, consolidacionId));

      await tx.update(consolidaciones).set({
        estado: "Pendiente adjudicación",
        destino: null,
        tipo_compra: null,
        regularizado: null,
        proveedor_id: null, proveedor_nit: null, proveedor_nombre: null,
        exento_iva: false, total: null, monto_bruto: null,
        proveedor_direccion: null, proveedor_telefono: null,
        numero_adjudicacion: null, razon_adjudicacion: null,
        cotizacion_anual_id: null,
        a04_no_pedido: null, a04_descripcion: null, a04_unidad_medida: null, a04_cantidad: null,
        numero_a04: null, anio_a04: null, a04_fecha: null,
        a04_dte_numero: null, a04_dte_serie: null, a04_dte_fecha: null,
        acta_aprobada: false,
        motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
        historial_devoluciones: historial,
      }).where(eq(consolidaciones.id, consolidacionId));
    });

    return { ok: true };
  } catch (e) {
    if (e instanceof LoteYaDespachadoEnTransaccion) {
      return { error: `No se puede devolver: ya se despachó parte de "${e.nombre}" desde Almacén (DAB-75). Ajustá el stock a mano antes de corregir esta compra.` };
    }
    return { error: "Error al devolver la consolidación a Adjudicación" };
  }
}
