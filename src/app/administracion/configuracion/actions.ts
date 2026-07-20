"use server";
import { fechaHoraGuatemala } from "@/lib/date-utils";

import { db } from "@/lib/db";
import { configuracion, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function guardarConfiguracion(data: any) {
  try {
    const session = await auth();
    if (!session || session.user.rol !== "superadmin") return { error: "Sin permiso" };

    const [existing] = await db.select({ id: configuracion.id }).from(configuracion).limit(1);
    if (existing) {
      await db.update(configuracion)
        .set({
          nombre_unidad:        data.nombre_unidad,
          codigo_unidad:        data.codigo_unidad,
          codigo_contable:      data.codigo_contable,
          municipio:            data.municipio,
          monto_fondo_rotativo: Number(data.monto_fondo_rotativo),
          efectivo_caja:        Number(data.efectivo_caja),
          ejercicio_fiscal:     Number(data.ejercicio_fiscal),
          nombre_responsable:   data.nombre_responsable,
          numero_empleado_resp: data.numero_empleado_resp,
          nombre_solicitante:   data.nombre_solicitante,
          numero_empleado_sol:  data.numero_empleado_sol,
          resolucion_fondo:     data.resolucion_fondo,
          updated_at:           fechaHoraGuatemala(),
        })
        .where(eq(configuracion.id, existing.id));
    } else {
      await db.insert(configuracion).values(data);
    }

    await db.insert(auditLog).values({
      usuario_id: Number(session.user.id),
      accion:     "editar_configuracion",
      tabla:      "configuracion",
      detalle:    "Actualizó la configuración del sistema",
    });

    return { ok: true };
  } catch {
    return { error: "Error al guardar la configuración" };
  }
}
