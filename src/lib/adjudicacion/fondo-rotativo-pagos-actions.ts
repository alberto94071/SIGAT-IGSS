"use server";
import { db } from "@/lib/db";
import { fondoRotativoPagos, consolidaciones, valesCajaChica, friFondoRotativo, presupuestoRenglones, configuracion } from "@/lib/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { gruposRenglonDeConsolidacion } from "./renglon-utils";
import { esGrupo100 } from "@/lib/programacion-constants";
import { trazabilidadPorConsolidaciones, type TrazabilidadConsolidacion } from "./trazabilidad-utils";
import { netoDeIva } from "@/lib/iva-utils";

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
  const [con] = await tx.select({ exento_iva: consolidaciones.exento_iva })
    .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
  const exentoIva = con?.exento_iva ?? false;

  const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
  for (const r of renglones) {
    // Neto de IVA, igual que aprobarDevengado (la vía Normal) — pre_compromiso
    // y devengado_regularizado tienen que moverse en la misma unidad que el
    // resto de presupuesto_renglones, o "Regularizado" queda inflado por el
    // 12% del IVA frente a "Normal" en el reporte de Ejecución.
    const montoNeto = exentoIva ? r.total : netoDeIva(r.total);
    await tx.update(presupuestoRenglones).set({
      devengado_regularizado: sql`COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) + ${montoNeto}`,
      pre_compromiso: sql`GREATEST(COALESCE(${presupuestoRenglones.pre_compromiso}, 0) - ${montoNeto}, 0)`,
    }).where(and(
      eq(presupuestoRenglones.renglon, r.renglon as number),
      eq(presupuestoRenglones.subproducto, r.subproducto),
      eq(presupuestoRenglones.ejercicio_fiscal, 2026),
    ));
  }
}

// Inverso exacto de reflejarEnEjecucion — para cuando se devuelve un pago
// que ya había elegido forma de pago (ver devolverAFormaPago) y hay que
// deshacer lo que ya se posteó en Ejecución, o al volver a elegir forma de
// pago quedaría contado dos veces.
async function revertirEjecucion(tx: Tx, consolidacionId: number): Promise<void> {
  const [con] = await tx.select({ exento_iva: consolidaciones.exento_iva })
    .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
  const exentoIva = con?.exento_iva ?? false;

  const renglones = await gruposRenglonDeConsolidacion(consolidacionId);
  for (const r of renglones) {
    const montoNeto = exentoIva ? r.total : netoDeIva(r.total);
    await tx.update(presupuestoRenglones).set({
      devengado_regularizado: sql`GREATEST(COALESCE(${presupuestoRenglones.devengado_regularizado}, 0) - ${montoNeto}, 0)`,
      pre_compromiso: sql`COALESCE(${presupuestoRenglones.pre_compromiso}, 0) + ${montoNeto}`,
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
  monto_cheque: number | null; monto_letras: string | null; concepto_voucher: string | null;
  estado: string;
  numero_a04: number | null; anio_a04: number | null;
  total: number | null; tipo_compra: string | null; exento_iva: boolean;
  fri_id: number | null; fri_numero: number | null; fri_anio: number | null;
  // true si TODOS los renglones de esta compra son 100-199 — ver esGrupo100 en
  // programacion-constants.ts. Determina si Fondo Rotativo/Pagos pide los
  // datos completos de cheque ahí mismo (grupo 100, va directo a Pendiente
  // FRI) o los deja para completar en Fondo Rotativo/Bancos (grupo 200/300).
  es_grupo_100: boolean;
  traz: TrazabilidadConsolidacion | null;
};

export async function conDetalle(rows: (typeof fondoRotativoPagos.$inferSelect)[]): Promise<PagoFondoRotativo[]> {
  if (rows.length === 0) return [];
  const consIds = rows.map(r => r.consolidacion_id);
  const valeIds = rows.map(r => r.vale_id).filter((v): v is number => v != null);
  const friIds = rows.map(r => r.fri_id).filter((v): v is number => v != null);
  const [cons, vales, fris, trazMap] = await Promise.all([
    db.select().from(consolidaciones).where(inArray(consolidaciones.id, consIds)),
    valeIds.length > 0
      ? db.select().from(valesCajaChica).where(inArray(valesCajaChica.id, valeIds))
      : Promise.resolve([]),
    friIds.length > 0
      ? db.select().from(friFondoRotativo).where(inArray(friFondoRotativo.id, friIds))
      : Promise.resolve([]),
    trazabilidadPorConsolidaciones(consIds),
  ]);
  const consMap = new Map(cons.map(c => [c.id, c]));
  const valeMap = new Map(vales.map(v => [v.id, v]));
  const friMap = new Map(fris.map(f => [f.id, f]));
  return Promise.all(rows.map(async r => {
    const c = consMap.get(r.consolidacion_id);
    const vale = r.vale_id != null ? valeMap.get(r.vale_id) : undefined;
    const fri = r.fri_id != null ? friMap.get(r.fri_id) : undefined;
    return {
      ...r,
      numero_a04: c?.numero_a04 ?? null, anio_a04: c?.anio_a04 ?? null,
      total: c?.total ?? null, tipo_compra: c?.tipo_compra ?? null, exento_iva: c?.exento_iva ?? false,
      vale_solicitante_nombre: vale?.solicitante_nombre ?? null,
      fri_numero: fri?.numero ?? null, fri_anio: fri?.anio ?? null,
      es_grupo_100: await esPagoGrupo100(r.consolidacion_id),
      traz: trazMap.get(r.consolidacion_id) ?? null,
    };
  }));
}

export async function getPagosPendientesFormaPago(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Pendiente forma de pago"));
  return conDetalle(rows);
}

export async function getLibroBancos(): Promise<PagoFondoRotativo[]> {
  const rows = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.estado, "Enviado a Bancos"));
  return conDetalle(rows);
}

// ─── Libro Bancos (registro permanente) ────────────────────────────────────
// A diferencia de getLibroBancos (que es la bandeja de trabajo de "Enviado a
// Bancos" pendientes de completar voucher), este es el libro real: TODO
// cheque ya emitido, sin importar en qué estado siga después, con saldo
// corriente estilo chequera (saldo anterior ± monto = saldo nuevo).
//
// El saldo arranca en configuracion.monto_fondo_rotativo (el monto asignado
// al fondo) y de ahí se resta cada cheque emitido (fecha_emision_cheque) y se
// suma cada Reintegro FRI ya recibido (fecha_reintegro) — ambos intercalados
// en orden cronológico. Ojo: no todo cheque se reintegra — los de renglón
// 200-300 quedan en "Enviado a Bancos" sin pasar por FRI (ver el estado en
// schema.ts), así que el saldo de este libro asume que esos gastos salen del
// mismo fondo sin reposición. Si el cliente confirma un criterio distinto
// para el saldo bancario real, este cálculo hay que ajustarlo.
export type MovimientoBanco = {
  id: string; fecha: string; tipo: "Cheque" | "Reintegro FRI";
  descripcion: string; beneficiario: string | null; numero_cheque: string | null;
  debe: number; haber: number; saldo: number;
  numero_a04: number | null; anio_a04: number | null; pagoId: number | null;
};

// ─── Libro Conciliación ─────────────────────────────────────────────────────
// "Similar al de Bancos" (pedido del cliente): mismo registro de cheques
// emitidos, pero acá cada uno se marca si ya se cotejó contra el estado de
// cuenta del banco — independiente de en qué parte del flujo de la compra
// vaya después. No incluye los Reintegro FRI del Libro Bancos: la
// conciliación bancaria es sobre los cheques que salieron de la cuenta, no
// sobre los depósitos de reintegro (esos se concilian por separado, contra
// el estado de cuenta, el día que el cliente lo pida).
export type MovimientoConciliacion = MovimientoBanco & { conciliado: boolean; fecha_conciliacion: string | null };

export async function getLibroConciliacion(): Promise<MovimientoConciliacion[]> {
  const movimientos = (await getLibroBancosCompleto()).filter(m => m.tipo === "Cheque" && m.pagoId != null);
  if (movimientos.length === 0) return [];
  const chequeIds = movimientos.map(m => m.pagoId as number);
  const rows = await db.select({
    id: fondoRotativoPagos.id, conciliado: fondoRotativoPagos.conciliado, fecha_conciliacion: fondoRotativoPagos.fecha_conciliacion,
  }).from(fondoRotativoPagos).where(inArray(fondoRotativoPagos.id, chequeIds));
  const map = new Map(rows.map(r => [r.id, r]));
  return movimientos.map(m => ({
    ...m,
    conciliado: map.get(m.pagoId as number)?.conciliado ?? false,
    fecha_conciliacion: map.get(m.pagoId as number)?.fecha_conciliacion ?? null,
  }));
}

export async function marcarConciliado(pagoId: number, fecha: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!fecha.trim()) return { error: "La fecha de conciliación es obligatoria" };
    await db.update(fondoRotativoPagos).set({ conciliado: true, fecha_conciliacion: fecha.trim() })
      .where(eq(fondoRotativoPagos.id, pagoId));
    return { ok: true };
  } catch {
    return { error: "Error al marcar como conciliado" };
  }
}

export async function desmarcarConciliado(pagoId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    await db.update(fondoRotativoPagos).set({ conciliado: false, fecha_conciliacion: null })
      .where(eq(fondoRotativoPagos.id, pagoId));
    return { ok: true };
  } catch {
    return { error: "Error al desmarcar" };
  }
}

export async function getLibroBancosCompleto(): Promise<MovimientoBanco[]> {
  const [config, chequesRows, reintegros] = await Promise.all([
    db.select({ monto_fondo_rotativo: configuracion.monto_fondo_rotativo }).from(configuracion).limit(1),
    db.select().from(fondoRotativoPagos).where(isNotNull(fondoRotativoPagos.numero_cheque)),
    db.select().from(friFondoRotativo).where(isNotNull(friFondoRotativo.fecha_reintegro)),
  ]);
  const cheques = await conDetalle(chequesRows);

  type Evento = {
    fecha: string; orden: number; tipo: "Cheque" | "Reintegro FRI";
    descripcion: string; beneficiario: string | null; numero_cheque: string | null; monto: number;
    numero_a04: number | null; anio_a04: number | null; pagoId: number | null;
  };
  const eventos: Evento[] = [
    ...cheques.map((p): Evento => ({
      fecha: p.fecha_emision_cheque ?? "", orden: p.id, tipo: "Cheque",
      descripcion: p.concepto_voucher ?? `A-04 ${p.numero_a04 ?? "—"}/${p.anio_a04 ?? "—"}`,
      beneficiario: p.destinatario_nombre, numero_cheque: p.numero_cheque,
      monto: p.monto_cheque ?? p.total ?? 0,
      numero_a04: p.numero_a04, anio_a04: p.anio_a04, pagoId: p.id,
    })),
    ...reintegros.map((f): Evento => ({
      fecha: f.fecha_reintegro ?? "", orden: -f.id, tipo: "Reintegro FRI",
      descripcion: `Reintegro FRI ${f.numero}/${f.anio}`, beneficiario: null, numero_cheque: null,
      monto: f.total, numero_a04: null, anio_a04: null, pagoId: null,
    })),
  ];
  eventos.sort((a, b) => a.fecha === b.fecha ? a.orden - b.orden : a.fecha.localeCompare(b.fecha));

  let saldo = config[0]?.monto_fondo_rotativo ?? 0;
  return eventos.map((e, i) => {
    saldo += e.tipo === "Cheque" ? -e.monto : e.monto;
    return {
      id: `${e.tipo}-${i}`, fecha: e.fecha, tipo: e.tipo, descripcion: e.descripcion,
      beneficiario: e.beneficiario, numero_cheque: e.numero_cheque,
      debe: e.tipo === "Cheque" ? e.monto : 0, haber: e.tipo === "Reintegro FRI" ? e.monto : 0,
      saldo, numero_a04: e.numero_a04, anio_a04: e.anio_a04, pagoId: e.pagoId,
    };
  });
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

// Elegir "Cheque" en Pagos para un pago que NO es grupo 100 ya no pide
// ningún dato ahí — solo manda el registro a Fondo Rotativo/Bancos. El
// número de cheque, monto, cantidad (en letras) y el resto de los datos del
// Voucher se completan después en Bancos (ver completarVoucherBancos), que
// es donde también se imprime. Los pagos de grupo 100 siguen usando
// registrarFormaPagoCheque de una vez (van directo a Pendiente FRI, no pasan
// por Bancos).
export async function elegirChequeDirecto(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    const esGrupo100 = await esPagoGrupo100(pago.consolidacion_id);
    if (esGrupo100) return { error: "Este pago es de renglón 100-199 — usa el formulario completo (va a Pago/FRI)" };

    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        forma_pago: "cheque",
        estado: "Enviado a Bancos",
      }).where(eq(fondoRotativoPagos.id, id));

      await reflejarEnEjecucion(tx, pago.consolidacion_id);
    });

    return { ok: true };
  } catch {
    return { error: "Error al enviar el pago a Bancos" };
  }
}

// Completa (o corrige) los datos de cheque/Voucher de un pago ya en Fondo
// Rotativo/Bancos — número de cheque, monto, cantidad en letras y el resto
// de los datos para imprimir el Voucher. No cambia el estado: "Enviado a
// Bancos" ya es terminal para este pago; una vez con numero_cheque se puede
// (re)imprimir el Voucher cuantas veces haga falta.
export async function completarVoucherBancos(id: number, data: {
  numero_cheque: string; fecha_emision_cheque: string;
  tipo_documento_pago: TipoDocumentoPago; nit_beneficiario: string; destinatario_nombre: string;
  monto_cheque: number; monto_letras: string; concepto_voucher: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.numero_cheque.trim() || !data.fecha_emision_cheque)
      return { error: "No. de cheque y fecha de emisión son obligatorios" };
    if (!data.tipo_documento_pago) return { error: "Selecciona el tipo de documento" };
    if (!data.nit_beneficiario.trim()) return { error: "El NIT del beneficiario es obligatorio" };
    if (!data.destinatario_nombre.trim()) return { error: "El nombre del beneficiario es obligatorio" };
    if (!(data.monto_cheque > 0)) return { error: "Ingresa un monto válido" };
    if (!data.monto_letras.trim()) return { error: "La cantidad en letras es obligatoria" };

    const [pago] = await db.select({ estado: fondoRotativoPagos.estado }).from(fondoRotativoPagos)
      .where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Enviado a Bancos") return { error: "Este pago no está en Fondo Rotativo/Bancos" };

    await db.update(fondoRotativoPagos).set({
      numero_cheque: data.numero_cheque.trim(),
      fecha_emision_cheque: data.fecha_emision_cheque,
      tipo_documento_pago: data.tipo_documento_pago,
      nit_beneficiario: data.nit_beneficiario.trim(),
      destinatario_nombre: data.destinatario_nombre.trim(),
      monto_cheque: data.monto_cheque,
      monto_letras: data.monto_letras.trim(),
      concepto_voucher: data.concepto_voucher.trim() || null,
    }).where(eq(fondoRotativoPagos.id, id));

    return { ok: true };
  } catch {
    return { error: "Error al completar los datos del Voucher" };
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

// Por si se eligió mal la forma de pago (ej. Efectivo sin tener efectivo
// disponible, o Cheque cuando debía ser Efectivo) — devuelve el pago a
// "Pendiente forma de pago" en Fondo Rotativo/Pagos para volver a elegir.
// Se puede llamar desde Caja Chica/Pagos ("Enviado a Liquidación", todavía
// sin vale/fecha de pago asignados — si ya se liquidó, el estado ya avanzó a
// "Pendiente FRI" y esto ya no aplica) o desde Bancos ("Enviado a Bancos",
// que es terminal para pagos que no son grupo 100 — el número de cheque
// puede estar completado o no, ambos casos se limpian igual). No aplica a
// pagos de grupo 100 (renglón 100-199): esos van directo a Pendiente FRI sin
// pasar por ninguna de las dos pantallas, así que nunca llegan a este botón.
export async function devolverAFormaPago(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Enviado a Liquidación" && pago.estado !== "Enviado a Bancos")
      return { error: "Este pago no está pendiente de vale ni en Bancos — ya no se puede devolver" };
    if (pago.conciliado) return { error: "Este cheque ya fue conciliado con el banco — ya no se puede devolver" };

    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        forma_pago: null,
        estado: "Pendiente forma de pago",
        numero_cheque: null, fecha_emision_cheque: null, tipo_documento_pago: null,
        monto_cheque: null, monto_letras: null, concepto_voucher: null,
      }).where(eq(fondoRotativoPagos.id, id));

      await revertirEjecucion(tx, pago.consolidacion_id);
    });

    return { ok: true };
  } catch {
    return { error: "Error al devolver el pago" };
  }
}

// Elegir "Efectivo" en Fondo Rotativo/Pagos solo marca la forma de pago y
// envía el registro a Caja Chica/Pagos — NO asigna vale ni fecha de pago
// aquí. Es en Caja Chica/Pagos donde se elige el vale de "gastos varios"
// activo y se confirma el pago (o se espera si todavía no hay vale/efectivo
// disponible) — ver liquidarPago en caja-chica-liquidacion-actions.ts.
export async function registrarFormaPagoEfectivo(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, id)).limit(1);
    if (!pago) return { error: "No se encontró el registro" };
    if (pago.estado !== "Pendiente forma de pago") return { error: "Este registro ya tiene forma de pago asignada" };

    const esGrupo100 = await esPagoGrupo100(pago.consolidacion_id);

    await db.transaction(async (tx) => {
      await tx.update(fondoRotativoPagos).set({
        forma_pago: "efectivo",
        estado: esGrupo100 ? "Pendiente FRI" : "Enviado a Liquidación",
      }).where(eq(fondoRotativoPagos.id, id));

      await reflejarEnEjecucion(tx, pago.consolidacion_id);
    });

    return { ok: true };
  } catch {
    return { error: "Error al registrar el pago en efectivo" };
  }
}
