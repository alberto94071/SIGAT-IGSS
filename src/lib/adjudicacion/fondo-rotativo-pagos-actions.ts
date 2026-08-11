"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos, consolidaciones, valesCajaChica, friFondoRotativo, presupuestoRenglones } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { esGrupo100 } from "@/lib/programacion-constants";

// true si TODOS los renglones de la consolidación de este pago son 100-199 —
// esos van a Pago/FRI en vez de Bancos/Caja Chica-Vale.
async function esPagoGrupo100(consolidacionId: number): Promise<boolean> {
  const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
  return renglones.length > 0 && renglones.every(r => esGrupo100(r.renglon));
}

// Fondo Rotativo no pasa por aprobación de Presupuesto (confirmado por el
// cliente) — se refleja en Ejecución/Regularizado con lo que el propio
// Fondo Rotativo ya decidió y ejecutó: en el momento en que se registra la
// forma de pago (cheque emitido o vale asignado), no antes.
//
// Regularizado nunca pasa por Compromiso (que es el único otro lugar que
// libera Pre-Compromiso) — así que hay que liberarlo aquí mismo, o el monto
// que se reservó al aprobar el SIAF (a01-siaf/actions.ts) se queda contando
// como "usado" para siempre además de lo recién sumado a
// devengado_regularizado, inflando el "usado" real de cada renglón
// Regularizado de forma permanente.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function reflejarEnEjecucion(tx: Tx, consolidacionId: number): Promise<void> {
  const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
  for (const r of renglones) {
    await tx.update(presupuestoRenglones).set({
      devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) + ${r.total}`,
      pre_compromiso: sql`GREATEST(COALESCE(${presupuestoRenglones.pre_compromiso}, 0) - ${r.total}, 0)`,
    }).where(and(
      eq(presupuestoRenglones.renglon, r.renglon as number),
      eq(presupuestoRenglones.subproducto, r.subproducto),
      eq(presupuestoRenglones.ejercicio_fiscal, 2026),
    ));
  }
}

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export type PagoFondoRotativo = {
  id: number; consolidacion_id: number;
  no_factura: string; serie_factura: string; fecha_emision_factura: string;
  forma_pago: string | null; numero_cheque: string | null; fecha_emision_cheque: string | null;
  destinatario_nombre: string | null; tipo_documento_pago: string | null; nit_beneficiario: string | null;
  fecha_pago: string | null; numero_vale: string | null;
  vale_id: number | null; vale_solicitante_nombre: string | null;
  estado: string;
  numero_a04: number | null; anio_a04: number | null;
  total: number | null; tipo_compra: string | null;
  fri_id: number | null; fri_numero: number | null; fri_anio: number | null;
};

export async function conDetalle(rows: (typeof fondoRotativoPagos.$inferSelect)[]): Promise<PagoFondoRotativo[]> {
  if (rows.length === 0) return [];
  const consIds = rows.map(r => r.consolidacion_id);
  const valeIds = rows.map(r => r.vale_id).filter((v): v is number => v != null);
  const friIds = rows.map(r => r.fri_id).filter((v): v is number => v != null);
  const [cons, vales, fris] = await Promise.all([
    db.select().from(consolidaciones).where(inArray(consolidaciones.id, consIds)),
    valeIds.length > 0
      ? db.select().from(valesCajaChica).where(inArray(valesCajaChica.id, valeIds))
      : Promise.resolve([]),
    friIds.length > 0
      ? db.select().from(friFondoRotativo).where(inArray(friFondoRotativo.id, friIds))
      : Promise.resolve([]),
  ]);
  const consMap = new Map(cons.map(c => [c.id, c]));
  const valeMap = new Map(vales.map(v => [v.id, v]));
  const friMap = new Map(fris.map(f => [f.id, f]));
  return rows.map(r => {
    const c = consMap.get(r.consolidacion_id);
    const vale = r.vale_id != null ? valeMap.get(r.vale_id) : undefined;
    const fri = r.fri_id != null ? friMap.get(r.fri_id) : undefined;
    return {
      ...r,
      numero_a04: c?.numero_a04 ?? null, anio_a04: c?.anio_a04 ?? null,
      total: c?.total ?? null, tipo_compra: c?.tipo_compra ?? null,
      vale_solicitante_nombre: vale?.solicitante_nombre ?? null,
      fri_numero: fri?.numero ?? null, fri_anio: fri?.anio ?? null,
    };
  });
}

export async function getPagosPendientesFormaPago(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Pendiente forma de pago"));
  return conDetalle(rows);
}

export async function getLibroBancos(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Enviado a Bancos"));
  return conDetalle(rows);
}

// Historial completo de Fondo Rotativo — toda consolidación que ya generó su
// SIAF-04, sin importar en qué parte del flujo (Pagos, Bancos, Liquidación o
// Libro Caja Chica) haya quedado. Aquí solo se puede volver a ver/imprimir el SIAF-04.
//
// Nunca se borra, así que crece para siempre — se pagina por lotes (más
// recientes primero) en vez de traer toda la tabla de un jalón. Pide un
// registro de más para saber si queda algo atrás sin otra consulta.
// (Un archivo "use server" solo puede exportar funciones async.)
const ARCHIVO_FONDO_ROTATIVO_PAGE_SIZE = 50;

export async function getArchivoFondoRotativo(offset: number = 0): Promise<{ pagos: PagoFondoRotativo[]; hasMore: boolean }> {
  const limit = ARCHIVO_FONDO_ROTATIVO_PAGE_SIZE;
  const rows = await db.select().from(fondoRotativoPagos).orderBy(sql`id DESC`).limit(limit + 1).offset(offset);
  const hasMore = rows.length > limit;
  const pagos = await conDetalle(rows.slice(0, limit));
  return { pagos, hasMore };
}

export type TipoDocumentoPago = "Factura" | "Vale" | "Formulario";

export async function registrarFormaPagoCheque(id: number, data: {
  numero_cheque: string; fecha_emision_cheque: string;
  tipo_documento_pago: TipoDocumentoPago; nit_beneficiario: string; destinatario_nombre: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.numero_cheque.trim() || !data.fecha_emision_cheque)
      return { error: "No. de cheque y fecha de emisión son obligatorios" };
    if (!data.tipo_documento_pago) return { error: "Selecciona el tipo de documento" };
    if (!data.nit_beneficiario.trim()) return { error: "El NIT del beneficiario es obligatorio" };
    if (!data.destinatario_nombre.trim()) return { error: "El nombre del beneficiario es obligatorio" };

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    const esGrupo100 = await esPagoGrupo100(pago.consolidacion_id);

    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        forma_pago: "cheque",
        numero_cheque: data.numero_cheque.trim(),
        fecha_emision_cheque: data.fecha_emision_cheque,
        tipo_documento_pago: data.tipo_documento_pago,
        nit_beneficiario: data.nit_beneficiario.trim(),
        destinatario_nombre: data.destinatario_nombre.trim(),
        estado: esGrupo100 ? "Pendiente FRI" : "Enviado a Bancos",
      }).where(eq(fondoRotativoPagos.id, id));

      await reflejarEnEjecucion(tx, pago.consolidacion_id);
    });

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago con cheque" };
  }
}

// Por si se ingresaron mal los datos del SIAF-04 (factura, serie, fecha):
// deshace lo que hizo generarSiaf04 y regresa la consolidación a Fondo
// Rotativo/SIAF-04 para volver a generarlo. La Hoja de Ruta ya se actualiza
// sola porque sus pasos de SIAF-04 y Pago dependen de que numero_a04 y este
// registro de pago existan — al limpiarlos, esos pasos dejan de mostrarse.
export async function devolverPagoASiaf04(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya no está pendiente de forma de pago" };

    await db.update(consolidaciones).set({
      numero_a04: null, anio_a04: null, a04_fecha: null,
      a04_dte_numero: null, a04_dte_serie: null, a04_dte_fecha: null,
    }).where(eq(consolidaciones.id, pago.consolidacion_id));

    await db.delete(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al devolver a SIAF-04" };
  }
}

// El pago en efectivo se liga al vale de "gastos varios" activo (con cheque ya
// asignado en Fondo Rotativo/Vales) generado en Caja Chica/Vale. Un mismo vale
// puede financiar varios pagos en efectivo antes de liquidarse, así que aquí
// NO se marca el vale como usado — solo se liquida como un todo desde Caja
// Chica/Liquidación una vez que Caja Chica termina de usarlo.
export async function registrarFormaPagoEfectivo(id: number, data: {
  fecha_pago: string; vale_id: number;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.fecha_pago || !data.vale_id)
      return { error: "Fecha de pago y vale son obligatorios" };

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    const [vale] = await db.select().from(valesCajaChica).where(eq(valesCajaChica.id, data.vale_id)).limit(1);
    if (!vale) return { error: "No se encontró el vale seleccionado" };
    if (vale.tipo !== "gastos_varios" || vale.estado !== "Activo") return { error: "Ese vale no está activo" };

    const esGrupo100 = await esPagoGrupo100(pago.consolidacion_id);

    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        forma_pago: "efectivo",
        fecha_pago: data.fecha_pago,
        numero_vale: String(vale.numero).padStart(7, "0"),
        vale_id: vale.id,
        estado: esGrupo100 ? "Pendiente FRI" : "Enviado a Liquidación",
      }).where(eq(fondoRotativoPagos.id, id));

      await reflejarEnEjecucion(tx, pago.consolidacion_id);
    });

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago en efectivo" };
  }
}
