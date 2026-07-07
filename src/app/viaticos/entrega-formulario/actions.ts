"use server";
import { db } from "@/lib/db";
import { viaticoLiquidaciones } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export type Comision = { tipo: string; lugar: string };

export type NuevaLiquidacionData = {
  comisiones: Comision[];
  dias: number;
  gasto_desayuno: number | null;
  gasto_almuerzo: number | null;
  gasto_cena: number | null;
  gasto_hospedaje: number | null;
  otros_gastos: number;
  recibido_va_no: string;
  recibido_va_monto: number | null;
  reintegro: number | null;
  complemento: number | null;
  forma_pago: string;
  fecha_pago: string;
  persona_nombre: string;
  persona_nit: string;
  persona_cargo: string;
  persona_grupo: string;
  persona_no_empleado: string;
  persona_sueldo: number | null;
  persona_categoria_puesto: string;
  partida_presupuestaria: string;
  nombramiento_numero: string;
  fecha_nombramiento: string;
};

export async function getLiquidaciones() {
  const session = await auth();
  if (!session) return [];
  const rows = await db.select().from(viaticoLiquidaciones).orderBy(sql`id DESC`);
  return rows.map(r => ({ ...r, comisiones: JSON.parse(r.comisiones_json) as Comision[] }));
}

export async function getLiquidacion(id: number) {
  const session = await auth();
  if (!session) return null;
  const [r] = await db.select().from(viaticoLiquidaciones).where(eq(viaticoLiquidaciones.id, id)).limit(1);
  if (!r) return null;
  return { ...r, comisiones: JSON.parse(r.comisiones_json) as Comision[] };
}

export async function crearLiquidacion(data: NuevaLiquidacionData): Promise<{ ok: true; id: number } | { error: string }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

  const comisiones = data.comisiones.filter(c => c.tipo.trim() || c.lugar.trim());
  if (comisiones.length === 0) return { error: "Debe indicar al menos un tipo de comisión" };
  if (!(data.dias > 0)) return { error: "El número de días debe ser mayor a cero" };
  if (!data.persona_nombre.trim()) return { error: "El nombre de la persona nombrada es obligatorio" };
  if (!data.persona_nit.trim()) return { error: "El NIT es obligatorio" };
  if (!data.persona_cargo.trim()) return { error: "El cargo es obligatorio" };
  if (!data.persona_no_empleado.trim()) return { error: "El número de empleado es obligatorio" };
  if (!data.forma_pago.trim()) return { error: "La forma de pago es obligatoria" };
  if (!data.fecha_pago) return { error: "La fecha de pago es obligatoria" };

  const gastos = [data.gasto_desayuno, data.gasto_almuerzo, data.gasto_cena, data.gasto_hospedaje]
    .reduce((s: number, v) => s + (v ?? 0), 0);
  if (gastos + (data.otros_gastos ?? 0) <= 0) return { error: "Debe registrar al menos un gasto" };

  try {
    const [row] = await db.insert(viaticoLiquidaciones).values({
      comisiones_json: JSON.stringify(comisiones),
      dias: data.dias,
      gasto_desayuno: data.gasto_desayuno,
      gasto_almuerzo: data.gasto_almuerzo,
      gasto_cena: data.gasto_cena,
      gasto_hospedaje: data.gasto_hospedaje,
      otros_gastos: data.otros_gastos ?? 0,
      recibido_va_no: data.recibido_va_no.trim() || null,
      recibido_va_monto: data.recibido_va_monto,
      reintegro: data.reintegro,
      complemento: data.complemento,
      forma_pago: data.forma_pago.trim(),
      fecha_pago: data.fecha_pago,
      persona_nombre: data.persona_nombre.trim(),
      persona_nit: data.persona_nit.trim(),
      persona_cargo: data.persona_cargo.trim(),
      persona_grupo: data.persona_grupo.trim() || null,
      persona_no_empleado: data.persona_no_empleado.trim(),
      persona_sueldo: data.persona_sueldo,
      persona_categoria_puesto: data.persona_categoria_puesto.trim() || null,
      partida_presupuestaria: data.partida_presupuestaria.trim() || null,
      nombramiento_numero: data.nombramiento_numero.trim() || null,
      fecha_nombramiento: data.fecha_nombramiento || null,
      creado_por: Number(session.user.id),
    }).returning({ id: viaticoLiquidaciones.id });

    return { ok: true, id: row.id };
  } catch {
    return { error: "Error al registrar la liquidación de viático" };
  }
}
