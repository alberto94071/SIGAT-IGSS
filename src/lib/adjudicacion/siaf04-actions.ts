"use server";
import { db } from "@/lib/db";
import { consolidaciones, fondoRotativoPagos } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getPendientesPorDestino } from "./actions";
import type { Consolidacion } from "./types";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Correlativo A-04 SIAF — ahora se asigna hasta este paso (Generar SIAF), no al
// registrar la compra Regularizado, porque ya se tiene la factura física en mano.
async function siguienteNumeroA04(anio: number): Promise<number> {
  const res = await db.execute(
    sql`SELECT COALESCE(MAX(numero_a04), 0) + 1 AS next FROM consolidaciones WHERE anio_a04 = ${anio}`
  );
  return Number((res.rows[0] as any).next) || 1;
}

export async function getPendientesSiaf04(): Promise<Consolidacion[]> {
  const cons = await getPendientesPorDestino("fondo_rotativo");
  return cons.filter(c => c.numero_a04 == null);
}

export async function generarSiaf04(consolidacionId: number, data: {
  no_factura: string; serie_factura: string; fecha_emision: string;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const noFactura = data.no_factura.trim();
    const serie = data.serie_factura.trim();
    if (!noFactura || !serie || !data.fecha_emision)
      return { error: "No. de Factura, Serie y Fecha de Emisión son obligatorios" };

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.destino !== "fondo_rotativo" || con.estado !== "Enviado a Fondo Rotativo")
      return { error: "Esta consolidación no está pendiente en Fondo Rotativo" };
    if (con.numero_a04 != null) return { error: "Ya se generó el SIAF-04 para esta consolidación" };

    const anioActual = new Date().getFullYear();
    const numeroA04 = await siguienteNumeroA04(anioActual);
    const hoy = new Date().toISOString().slice(0, 10);

    await db.update(consolidaciones).set({
      numero_a04: numeroA04, anio_a04: anioActual, a04_fecha: hoy,
      a04_dte_numero: noFactura, a04_dte_serie: serie, a04_dte_fecha: data.fecha_emision,
    }).where(eq(consolidaciones.id, consolidacionId));

    await db.insert(fondoRotativoPagos).values({
      consolidacion_id: consolidacionId,
      no_factura: noFactura, serie_factura: serie, fecha_emision_factura: data.fecha_emision,
      destinatario_nombre: con.proveedor_nombre,
      creado_por: check.uid,
    });

    return { ok: true };
  } catch {
    return { error: "Error al generar el SIAF-04" };
  }
}
