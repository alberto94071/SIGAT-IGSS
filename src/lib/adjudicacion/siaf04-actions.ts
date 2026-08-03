"use server";
import { fechaGuatemala, fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { consolidaciones, fondoRotativoPagos, oferentes, cotizacionesServicio } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getPendientesPorDestino } from "./actions";
import { gruposRenglonDeConsolidacion, getPprsPorItems, clavePprDeItem, guardarPprSeleccion } from "./renglon-utils";
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
  seleccionPpr: { codigo_igss: string; subproducto: string; codigo_ppr: string }[];
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
      const elegido = data.seleccionPpr.find(s => s.codigo_igss === r.codigo_igss && s.subproducto === r.subproducto);
      if (!elegido?.codigo_ppr) return { error: `Selecciona el PPR/presentación de "${r.nombre}" antes de generar el SIAF-04` };
    }
    await guardarPprSeleccion(consolidacionId, data.seleccionPpr);

    const anioActual = new Date().getFullYear();
    const numeroA04 = await siguienteNumeroA04(anioActual);
    const hoy = fechaGuatemala();

    await db.update(consolidaciones).set({
      numero_a04: numeroA04, anio_a04: anioActual, a04_fecha: hoy,
      a04_dte_numero: noFactura, a04_dte_serie: serie, a04_dte_fecha: data.fecha_emision,
    }).where(eq(consolidaciones.id, consolidacionId));

    await db.insert(fondoRotativoPagos).values({
      consolidacion_id: consolidacionId,
      no_factura: noFactura, serie_factura: serie, fecha_emision_factura: data.fecha_emision,
      destinatario_nombre: con.proveedor_nombre,
      nit_beneficiario: con.proveedor_nit,
      creado_por: check.uid,
    });

    return { ok: true };
  } catch {
    return { error: "Error al generar el SIAF-04" };
  }
}

/**
 * Devuelve una consolidación pendiente en Fondo Rotativo/SIAF-04 (todavía
 * sin generar el SIAF-04) hasta Compras/Adjudicación, por si se confundieron
 * los datos al registrar el Regularizado (tipo de compra, cotización,
 * proveedor, precios...) — deja la consolidación en "Pendiente
 * adjudicación" para volver a ingresarlos desde cero, sin deshacer la
 * consolidación de SIAFs (a diferencia de rechazarEnAdjudicacion, que sí la
 * deshace por completo). Libera cualquier cotización de servicio que se
 * hubiera reservado. Queda registrado en historial_devoluciones, para que
 * se vea en Hoja de Ruta.
 */
export async function regresarAAdjudicacion(consolidacionId: number, motivo?: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.destino !== "fondo_rotativo" || con.estado !== "Enviado a Fondo Rotativo")
      return { error: "Esta consolidación no está pendiente en Fondo Rotativo" };
    if (con.numero_a04 != null) return { error: "Ya se generó el SIAF-04 para esta consolidación — ya no se puede devolver" };

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.update(cotizacionesServicio)
      .set({ usado: false, usado_en_consolidacion_id: null })
      .where(eq(cotizacionesServicio.usado_en_consolidacion_id, consolidacionId));

    const nota = `${fechaHoraGuatemala()}: Devuelta desde Fondo Rotativo/SIAF-04 a Compras/Adjudicación${motivo?.trim() ? ` — ${motivo.trim()}` : ""}`;
    const historial = con.historial_devoluciones ? `${con.historial_devoluciones}\n${nota}` : nota;

    await db.update(consolidaciones).set({
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
      historial_devoluciones: historial,
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al devolver la consolidación a Adjudicación" };
  }
}
