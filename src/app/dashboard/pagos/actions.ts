"use server";
import { db } from "@/lib/db";
import { pagos, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function uid() {
  const s = await auth(); return s ? Number(s.user.id) : null;
}

function toNull(v: string) { return v.trim() === "" ? null : v; }
function toNum(v: string)  { return v.trim() === "" ? null : Number(v); }

export async function crearPago(data: any) {
  try {
    const userId = await uid();
    const [nuevo] = await db.insert(pagos).values({
      servicio_id:      toNum(data.servicio_id),
      siaf_numero:      toNum(data.siaf_numero),
      numero_oc:        toNull(data.numero_oc),
      renglon:          toNum(data.renglon),
      codigo_igss:      toNum(data.codigo_igss),
      codigo_ppr:        toNull(data.codigo_ppr),
      descripcion:      toNull(data.descripcion),
      unidad_medida:     toNull(data.unidad_medida),
      subproducto:       toNull(data.subproducto),
      cantidad:         toNull(data.cantidad),
      monto:            toNull(data.monto),
      metodo_compra:    (data.metodo_compra || null) as any,
      nit_proveedor:    toNull(data.nit_proveedor),
      proveedor:        toNull(data.proveedor),
      numero_documento: toNull(data.numero_documento),
      numero_serie:     toNull(data.numero_serie),
      fecha_documento:  toNull(data.fecha_documento),
      marca:             toNull(data.marca),
      modelo:            toNull(data.modelo),
      serie_equipo:      toNull(data.serie_equipo),
      fecha_recepcion:   toNull(data.fecha_recepcion),
      obs_lote:          toNull(data.obs_lote),
      npg_vencimiento:   toNull(data.npg_vencimiento),
      numero_cheque:    toNull(data.numero_cheque),
      numero_vale:      toNum(data.numero_vale),
      numero_fri:       toNull(data.numero_fri),
      estatus:          (data.estatus || "Pendiente") as any,
      fecha_pagado:     toNull(data.fecha_pagado),
      cuatrimestre:     (data.cuatrimestre || null) as any,
      numero_dab:       toNull(data.numero_dab),
      creado_por:       userId,
    }).returning();
    if (userId) await db.insert(auditLog).values({
      usuario_id: userId, accion: "crear_pago",
      tabla: "pagos", registro_id: nuevo.id,
    });
    return { pago: nuevo };
  } catch (e) {
    return { error: "Error al crear el pago" };
  }
}

export async function editarPago(data: any) {
  try {
    await db.update(pagos).set({
      siaf_numero:      toNum(data.siaf_numero),
      numero_oc:        toNull(data.numero_oc),
      renglon:          toNum(data.renglon),
      codigo_igss:      toNum(data.codigo_igss),
      codigo_ppr:        toNull(data.codigo_ppr),
      descripcion:      toNull(data.descripcion),
      unidad_medida:     toNull(data.unidad_medida),
      subproducto:       toNull(data.subproducto),
      cantidad:         toNull(data.cantidad),
      monto:            toNull(data.monto),
      metodo_compra:    (data.metodo_compra || null) as any,
      nit_proveedor:    toNull(data.nit_proveedor),
      proveedor:        toNull(data.proveedor),
      numero_documento: toNull(data.numero_documento),
      numero_serie:     toNull(data.numero_serie),
      fecha_documento:  toNull(data.fecha_documento),
      marca:             toNull(data.marca),
      modelo:            toNull(data.modelo),
      serie_equipo:      toNull(data.serie_equipo),
      fecha_recepcion:   toNull(data.fecha_recepcion),
      obs_lote:          toNull(data.obs_lote),
      npg_vencimiento:   toNull(data.npg_vencimiento),
      numero_cheque:    toNull(data.numero_cheque),
      numero_vale:      toNum(data.numero_vale),
      numero_fri:       toNull(data.numero_fri),
      estatus:          (data.estatus || "Pendiente") as any,
      fecha_pagado:     toNull(data.fecha_pagado),
      cuatrimestre:     (data.cuatrimestre || null) as any,
      numero_dab:       toNull(data.numero_dab),
      updated_at:       new Date().toISOString(),
    }).where(eq(pagos.id, data.id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function cambiarEstatus(data: {
  id: number; estatus: "Pendiente"|"Pagado"|"Anulado"
}) {
  try {
    const updates: any = { estatus: data.estatus, updated_at: new Date().toISOString() };
    if (data.estatus === "Pagado") updates.fecha_pagado = new Date().toISOString().slice(0,10);
    if (data.estatus === "Pendiente") updates.fecha_pagado = null;
    await db.update(pagos).set(updates).where(eq(pagos.id, data.id));
    const userId = await uid();
    if (userId) await db.insert(auditLog).values({
      usuario_id: userId, accion: `estatus_${data.estatus.toLowerCase()}`,
      tabla: "pagos", registro_id: data.id,
    });
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estatus" };
  }
}
