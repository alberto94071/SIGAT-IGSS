"use server";
import { db } from "@/lib/db";
import { cajaChica } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function uid() {
  const s = await auth(); return s ? Number(s.user.id) : null;
}

function n(v: string) { return v.trim() === "" ? null : v; }
function ni(v: string) { return v.trim() === "" ? null : Number(v); }

export async function crearGasto(data: any) {
  try {
    const userId = await uid();
    const [nuevo] = await db.insert(cajaChica).values({
      numero_cheque:       n(data.numero_cheque),
      numero_vale:         ni(data.numero_vale),
      tipo_documento:      (n(data.tipo_documento)) as any,
      numero_documento:    n(data.numero_documento),
      numero_serie:        n(data.numero_serie),
      fecha:               n(data.fecha),
      nombre_beneficiario: n(data.nombre_beneficiario),
      municipio_residencia:n(data.municipio_residencia),
      municipio_cita:      n(data.municipio_cita),
      costo:               n(data.costo),
      tipo_servicio:       n(data.tipo_servicio),
      fecha_pago:          n(data.fecha_pago),
      creado_por:          userId,
    }).returning();
    return { gasto: nuevo };
  } catch {
    return { error: "Error al crear el gasto" };
  }
}

export async function editarGasto(data: any) {
  try {
    await db.update(cajaChica).set({
      numero_cheque:       n(data.numero_cheque),
      numero_vale:         ni(data.numero_vale),
      tipo_documento:      (n(data.tipo_documento)) as any,
      numero_documento:    n(data.numero_documento),
      numero_serie:        n(data.numero_serie),
      fecha:               n(data.fecha),
      nombre_beneficiario: n(data.nombre_beneficiario),
      municipio_residencia:n(data.municipio_residencia),
      municipio_cita:      n(data.municipio_cita),
      costo:               n(data.costo),
      tipo_servicio:       n(data.tipo_servicio),
      fecha_pago:          n(data.fecha_pago),
    }).where(eq(cajaChica.id, data.id));
    return { ok: true };
  } catch {
    return { error: "Error al editar" };
  }
}

export async function eliminarGasto(id: number) {
  try {
    await db.delete(cajaChica).where(eq(cajaChica.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar" };
  }
}
