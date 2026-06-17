"use server";
import { db } from "@/lib/db";
import { movimientosBanco, pagos, auditLog } from "@/lib/schema";
import { eq, sum } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db";

async function uid() {
  const s = await auth(); return s ? Number(s.user.id) : null;
}

async function getSaldoAnterior(): Promise<number> {
  const rows = await db
    .select({ saldo: movimientosBanco.saldo })
    .from(movimientosBanco)
    .orderBy(sql`${movimientosBanco.id} DESC`)
    .limit(1);
  return rows.length ? parseFloat(rows[0].saldo ?? "0") : 0;
}

export async function crearMovimiento(data: any) {
  try {
    const userId = await uid();
    const saldoPrev = await getSaldoAnterior();
    const egresos  = parseFloat(data.egresos  || "0");
    const ingresos = parseFloat(data.ingresos || "0");
    const nuevoSaldo = saldoPrev - egresos + ingresos;

    const [nuevo] = await db.insert(movimientosBanco).values({
      mes:              data.mes || null,
      numero_documento: data.numero_documento || null,
      tipo_documento:   (data.tipo_documento || null) as any,
      status:           data.status || null,
      fecha_movimiento: data.fecha_movimiento,
      nit_beneficiario: data.nit_beneficiario || null,
      beneficiario:     data.beneficiario || null,
      descripcion:      data.descripcion || null,
      egresos:          egresos.toFixed(2),
      ingresos:         ingresos.toFixed(2),
      saldo:            nuevoSaldo.toFixed(2),
      creado_por:       userId,
    }).returning();

    if (userId) await db.insert(auditLog).values({
      usuario_id: userId, accion: "crear_movimiento_banco",
      tabla: "movimientos_banco", registro_id: nuevo.id,
      detalle: `${data.tipo_documento} ${data.numero_documento} Q${egresos || ingresos}`,
    });

    return { mov: nuevo };
  } catch (e) {
    return { error: "Error al registrar el movimiento" };
  }
}

export async function editarMovimiento(data: any) {
  try {
    await db.update(movimientosBanco).set({
      mes:              data.mes || null,
      numero_documento: data.numero_documento || null,
      tipo_documento:   (data.tipo_documento || null) as any,
      status:           data.status || null,
      fecha_movimiento: data.fecha_movimiento,
      nit_beneficiario: data.nit_beneficiario || null,
      beneficiario:     data.beneficiario || null,
      descripcion:      data.descripcion || null,
      egresos:          data.egresos || "0",
      ingresos:         data.ingresos || "0",
      // Nota: el saldo se recalcula en un paso separado
    }).where(eq(movimientosBanco.id, data.id));

    // Recalcular saldos en cascada desde ese registro
    await recalcularSaldos(data.id);
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

// Recalcula el saldo corrido desde un punto hacia adelante
async function recalcularSaldos(desdeId: number) {
  const todos = await db
    .select()
    .from(movimientosBanco)
    .orderBy(movimientosBanco.id);

  const idx = todos.findIndex(m => m.id === desdeId);
  if (idx < 0) return;

  let saldo = idx > 0 ? parseFloat(todos[idx - 1].saldo ?? "0") : 0;

  for (let i = idx; i < todos.length; i++) {
    const m = todos[i];
    saldo = saldo - parseFloat(m.egresos ?? "0") + parseFloat(m.ingresos ?? "0");
    await db.update(movimientosBanco)
      .set({ saldo: saldo.toFixed(2) })
      .where(eq(movimientosBanco.id, m.id));
  }
}

// Suma el total de pagos asociados a un N° de cheque
export async function calcularMontoDesdeChecks(numeroCheque: string) {
  try {
    const rows = await db
      .select({
        total:     sum(pagos.monto),
        proveedor: pagos.proveedor,
        nit:       pagos.nit_proveedor,
      })
      .from(pagos)
      .where(eq(pagos.numero_cheque, numeroCheque))
      .groupBy(pagos.proveedor, pagos.nit_proveedor)
      .limit(1);

    if (!rows.length || !rows[0].total) return { monto: 0 };

    return {
      monto:    parseFloat(rows[0].total),
      proveedor:rows[0].proveedor,
      nit:      rows[0].nit,
    };
  } catch {
    return { monto: 0 };
  }
}
