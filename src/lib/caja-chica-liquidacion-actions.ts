"use server";
import { fechaGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { fondoRotativoPagos, pasajesPagos, polizas, valesCajaChica } from "@/lib/schema";
import { eq, or, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { conDetalle, type PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Pagos en efectivo que llegaron de Fondo Rotativo/Pagos y todavía no se han
// liquidado contra su vale de Caja Chica.
export async function getLiquidacionesPendientes(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Enviado a Liquidación"));
  return conDetalle(rows);
}

// Aquí es donde se asigna el vale y se confirma el pago en efectivo — Fondo
// Rotativo/Pagos solo lo marcó como "efectivo" y lo mandó para acá, sin vale
// ni fecha (ver registrarFormaPagoEfectivo). Si todavía no hay vale de
// "gastos varios" activo, el pago simplemente se queda esperando en esta
// pantalla hasta que Caja Chica/Vale genere uno.
//
// Al confirmar, el pago no se queda "Liquidado" como punto final — sigue de
// largo a Fondo Rotativo/Pago-FRI, a esperar que se conforme en un FRI junto
// con el resto de pagos pendientes de reintegro (mismo destino que ya tenían
// los pagos de grupo 100-199). fecha_liquidacion_caja_chica queda como la
// marca de que este pago sí pasó por Caja Chica, para el Libro de Caja Chica.
export async function liquidarPago(id: number, data: {
  fecha_pago: string; vale_id: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;
    if (!data.fecha_pago || !data.vale_id)
      return { error: "Fecha de pago y vale son obligatorios" };

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Enviado a Liquidación") return { error: "Este pago no está pendiente de liquidar" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, data.vale_id)).limit(1);
    if (!vale) return { error: "No se encontró el vale seleccionado" };
    if (vale.tipo !== "gastos_varios" || vale.estado !== "Activo") return { error: "Ese vale no está activo" };

    await db.update(fondoRotativoPagos).set({
      estado: "Pendiente FRI",
      fecha_pago: data.fecha_pago,
      numero_vale: String(vale.numero).padStart(7, "0"),
      vale_id: vale.id,
      fecha_liquidacion_caja_chica: fechaGuatemala(),
    }).where(eq(fondoRotativoPagos.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al liquidar el pago" };
  }
}

// Por si se asignó el vale equivocado (o el pago no debía liquidarse
// todavía) — suelta el vale y regresa el pago a "Enviado a Liquidación",
// para volver a elegir el vale correcto o corregir algo antes. A diferencia
// de devolverAFormaPago (fondo-rotativo-pagos-actions.ts), esto NO toca
// Ejecución: reflejarEnEjecucion se posteó antes, al elegir "Efectivo" en
// Fondo Rotativo/Pagos (cuando pasó a "Enviado a Liquidación") — liquidarPago
// solo asigna el vale, no vuelve a postear nada. Solo mientras el pago siga
// sin agruparse en ningún FRI.
export async function devolverLiquidacionCajaChica(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente FRI" || pago.vale_id == null)
      return { error: "Este pago no tiene un vale de Caja Chica asignado pendiente de devolver" };
    if (pago.fri_id != null)
      return { error: "Este pago ya se agrupó en un FRI — hay que sacarlo de ahí primero (todavía no existe esa opción)" };

    await db.update(fondoRotativoPagos).set({
      estado: "Enviado a Liquidación",
      vale_id: null, numero_vale: null, fecha_pago: null, fecha_liquidacion_caja_chica: null,
    }).where(eq(fondoRotativoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al devolver la liquidación" };
  }
}

// Libro de Caja Chica — pagos en efectivo ya pagados por Caja Chica, sin
// importar si ya avanzaron a Pendiente FRI/En FRI/Reintegrado. Incluye
// también los pocos registros históricos que quedaron en "Liquidado" de
// antes de este cambio (cuando ese sí era el estado final).
export async function getLibroCajaChica(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos)
    .where(or(eq(fondoRotativoPagos.estado, "Liquidado"), isNotNull(fondoRotativoPagos.fecha_liquidacion_caja_chica)));
  return conDetalle(rows);
}

// Libro de Caja Chica completo: une los pagos con factura (vale de gastos
// varios liquidado, que ya pasó por Fondo Rotativo/Pagos) con los pasajes
// pagados a afiliados (vale de pasajes liquidado, sin factura — cada pasaje
// individual de cada póliza liquidada aparece como su propia fila).
export type LibroCajaChicaRow = {
  id: string;
  origen: "Factura" | "Vale";
  numero_a04: number | null;
  anio_a04: number | null;
  destinatario_nombre: string | null;
  factura: string | null;
  numero_vale: string | null;
  fecha_pago: string | null;
  detalle: string | null;
  total: number | null;
};

export async function getLibroCajaChicaCompleto(): Promise<LibroCajaChicaRow[]> {
  const [facturas, pasajesLiquidados] = await Promise.all([
    getLibroCajaChica(),
    db.select({
      id: pasajesPagos.id,
      formulario_no: pasajesPagos.formulario_no,
      nombre_afiliado: pasajesPagos.nombre_afiliado,
      destino: pasajesPagos.destino,
      fecha_pago: pasajesPagos.fecha_pago,
      valor_pasaje: pasajesPagos.valor_pasaje,
      vale_numero: valesCajaChica.numero,
    })
      .from(pasajesPagos)
      .innerJoin(polizas, eq(pasajesPagos.poliza_id, polizas.id))
      .leftJoin(valesCajaChica, eq(polizas.vale_id, valesCajaChica.id))
      .where(eq(polizas.estado, "Liquidada")),
  ]);

  const filas: LibroCajaChicaRow[] = facturas.map(p => ({
    id: `f-${p.id}`,
    origen: "Factura",
    numero_a04: p.numero_a04,
    anio_a04: p.anio_a04,
    destinatario_nombre: p.destinatario_nombre,
    factura: `${p.serie_factura}-${p.no_factura} · ${p.fecha_emision_factura}`,
    numero_vale: p.numero_vale,
    fecha_pago: p.fecha_pago,
    detalle: null,
    total: p.total,
  }));

  for (const p of pasajesLiquidados) {
    filas.push({
      id: `v-${p.id}`,
      origen: "Vale",
      numero_a04: null,
      anio_a04: null,
      destinatario_nombre: p.nombre_afiliado,
      factura: null,
      numero_vale: p.vale_numero != null ? String(p.vale_numero).padStart(7, "0") : "—",
      fecha_pago: p.fecha_pago,
      detalle: `Formulario ${String(p.formulario_no).padStart(6, "0")} · ${p.destino}`,
      total: p.valor_pasaje,
    });
  }

  filas.sort((a, b) => (b.fecha_pago ?? "").localeCompare(a.fecha_pago ?? ""));
  return filas;
}
