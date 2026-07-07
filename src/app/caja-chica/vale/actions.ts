"use server";
import { db } from "@/lib/db";
import { valesCajaChica } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { desc, eq, sql } from "drizzle-orm";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

export async function getVales() {
  return db.select().from(valesCajaChica).orderBy(desc(valesCajaChica.numero));
}

// Vales que todavía no se han ligado a ningún pago en efectivo de Fondo
// Rotativo — son los que aparecen en Fondo Rotativo/Vales y los que se pueden
// elegir al registrar un pago en efectivo en Fondo Rotativo/Pagos.
export async function getValesPendientes() {
  return db.select().from(valesCajaChica)
    .where(eq(valesCajaChica.estado, "Pendiente"))
    .orderBy(desc(valesCajaChica.numero));
}

export type NuevoValeData = {
  fecha: string; monto: number; motivo: string;
  solicitante_nombre: string; solicitante_numero_empleado: string; solicitante_nit: string;
  jefe_nombre: string; jefe_numero_empleado: string; jefe_nit: string;
  numero_cheque: string; fecha_emision: string; fecha_entregado: string;
};

export async function crearVale(data: NuevoValeData): Promise<{ vale: typeof valesCajaChica.$inferSelect } | { error: string }> {
  try {
    const check = await requireEdit();
    if ("error" in check) return check;

    if (!data.fecha) return { error: "La fecha es obligatoria" };
    if (!(data.monto > 0)) return { error: "Ingresa un monto válido" };
    if (!data.motivo.trim()) return { error: "El motivo es obligatorio" };
    if (!data.solicitante_nombre.trim() || !data.solicitante_numero_empleado.trim() || !data.solicitante_nit.trim())
      return { error: "Los datos del solicitante son obligatorios" };
    if (!data.jefe_nombre.trim() || !data.jefe_numero_empleado.trim() || !data.jefe_nit.trim())
      return { error: "Los datos del Jefe de la Dependencia son obligatorios" };
    if (!data.numero_cheque.trim()) return { error: "El número de cheque es obligatorio" };
    if (!data.fecha_emision) return { error: "La fecha de emisión es obligatoria" };
    if (!data.fecha_entregado) return { error: "La fecha de entrega es obligatoria" };

    const res = await db.execute(sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM vales_caja_chica`);
    const numero = Number((res.rows[0] as any).next) || 1;

    const [vale] = await db.insert(valesCajaChica).values({
      numero, fecha: data.fecha, monto: data.monto, motivo: data.motivo.trim(),
      solicitante_nombre: data.solicitante_nombre.trim(),
      solicitante_numero_empleado: data.solicitante_numero_empleado.trim(),
      solicitante_nit: data.solicitante_nit.trim(),
      jefe_nombre: data.jefe_nombre.trim(),
      jefe_numero_empleado: data.jefe_numero_empleado.trim(),
      jefe_nit: data.jefe_nit.trim(),
      numero_cheque: data.numero_cheque.trim(),
      fecha_emision: data.fecha_emision, fecha_entregado: data.fecha_entregado,
      creado_por: check.uid,
    }).returning();

    return { vale };
  } catch {
    return { error: "Error al registrar el vale" };
  }
}
