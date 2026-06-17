"use server";
import { db } from "@/lib/db";
import { servicios, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { nextSiafNumber } from "@/lib/siaf";

async function me() {
  const s = await auth();
  return s ? Number(s.user.id) : null;
}

export async function crearServicio(data: any) {
  try {
    const uid = await me();
    // SIAF siempre automático — secuencia PostgreSQL atómica, sin colisiones
    const siafNum = await nextSiafNumber();
    const [nuevo] = await db.insert(servicios).values({
      siaf_numero:       siafNum,
      fecha:             data.fecha,
      cuatrimestre:      data.cuatrimestre || null,
      renglon:           data.renglon ? Number(data.renglon) : null,
      codigo_igss:       data.codigo_igss ? Number(data.codigo_igss) : null,
      insumo:            data.insumo || null,
      cantidad:          data.cantidad || null,
      subproducto:       data.subproducto || null,
      precio_registrado: data.precio_registrado || null,
      fecha_compra:      data.fecha_compra || null,
      numero_compra:     data.numero_compra || null,
      numero_documento:  data.numero_documento || null,
      estado_oc:         data.estado_oc || null,
      creado_por:        uid,
    }).returning();
    if (uid) await db.insert(auditLog).values({
      usuario_id: uid, accion: "crear_servicio",
      tabla: "servicios", registro_id: nuevo.id,
      detalle: `SIAF #${siafNum} — ${data.insumo}`,
    });
    return { servicio: nuevo };
  } catch (e) {
    return { error: "Error al crear el servicio" };
  }
}

export async function editarServicio(data: any) {
  try {
    // SIAF no se edita — es inmutable una vez asignado
    await db.update(servicios).set({
      fecha:             data.fecha,
      cuatrimestre:      data.cuatrimestre || null,
      renglon:           data.renglon ? Number(data.renglon) : null,
      codigo_igss:       data.codigo_igss ? Number(data.codigo_igss) : null,
      insumo:            data.insumo || null,
      cantidad:          data.cantidad || null,
      subproducto:       data.subproducto || null,
      precio_registrado: data.precio_registrado || null,
      fecha_compra:      data.fecha_compra || null,
      numero_compra:     data.numero_compra || null,
      numero_documento:  data.numero_documento || null,
      estado_oc:         data.estado_oc || null,
    }).where(eq(servicios.id, data.id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function eliminarServicio(id: number) {
  try {
    await db.delete(servicios).where(eq(servicios.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar" };
  }
}
