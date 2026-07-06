"use server";
import { db } from "@/lib/db";
import { consolidaciones, oferentes, cotizacionesServicio, siafCompras, siafComprasItems } from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { TIPOS, MAX_OFERENTES, REFERENCIA_LABEL, LIMITE_POR_TIPO, type TipoCompra } from "./types";

async function requireCompras(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Correlativo A-04 SIAF — se asigna automáticamente a toda consolidación que
// llega a Fondo Rotativo (Baja Cuantía o Casos de Excepción, en su forma Regularizado).
async function siguienteNumeroA04(anio: number): Promise<number> {
  const res = await db.execute(
    sql`SELECT COALESCE(MAX(numero_a04), 0) + 1 AS next FROM consolidaciones WHERE anio_a04 = ${anio}`
  );
  return Number((res.rows[0] as any).next) || 1;
}

export async function elegirTipoCompra(consolidacionId: number, tipo: TipoCompra): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!TIPOS.includes(tipo)) return { error: "Tipo de compra inválido" };

    const [con] = await db.select({ estado: consolidaciones.estado, tipo_compra: consolidaciones.tipo_compra })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Pendiente adjudicación" && con.estado !== "Rechazado por Junta")
      return { error: "Esta consolidación ya no está disponible para elegir tipo de compra" };

    if (con.tipo_compra && con.tipo_compra !== tipo) {
      // Cambiar de tipo invalida los oferentes ya armados para el tipo anterior
      await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    }
    await db.update(consolidaciones).set({ tipo_compra: tipo, regularizado: null })
      .where(eq(consolidaciones.id, consolidacionId));
    return { ok: true };
  } catch {
    return { error: "Error al elegir el tipo de compra" };
  }
}

export async function guardarCompraDirectaEvento(consolidacionId: number, data: { nog: string; fecha_evento: string }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.nog.trim()) return { error: "El NOG es obligatorio" };
    if (!data.fecha_evento) return { error: "La fecha de finalización del evento es obligatoria" };

    await db.update(consolidaciones).set({
      nog: data.nog.trim(), fecha_evento: data.fecha_evento,
    }).where(eq(consolidaciones.id, consolidacionId));
    return { ok: true };
  } catch {
    return { error: "Error al guardar el NOG" };
  }
}

export async function agregarOferente(consolidacionId: number, data: {
  proveedor_id: number | null; nit: string; nombre: string; costo: number; exento_iva: boolean;
}): Promise<{ oferente: typeof oferentes.$inferSelect } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!(data.costo > 0)) return { error: "Ingresa un costo válido" };

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(oferentes)
      .where(eq(oferentes.consolidacion_id, consolidacionId));
    if (count >= MAX_OFERENTES) return { error: `Ya hay ${MAX_OFERENTES} oferentes registrados (máximo permitido)` };

    const [nuevo] = await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo: data.costo, exento_iva: data.exento_iva,
      orden: count, creado_por: check.uid,
    }).returning();

    return { oferente: nuevo };
  } catch {
    return { error: "Error al agregar el oferente" };
  }
}

export async function eliminarOferente(oferenteId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;
    await db.delete(oferentes).where(eq(oferentes.id, oferenteId));
    return { ok: true };
  } catch {
    return { error: "Error al eliminar el oferente" };
  }
}

export async function elegirFormaBajaCuantia(consolidacionId: number, regularizado: boolean): Promise<
  { ok: true; subTipo: "con_insumos" | "por_servicios" | null } | { error: string }
> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.tipo_compra !== "Baja Cuantía" && con.tipo_compra !== "Casos de Excepción")
      return { error: "Esta acción solo aplica a Baja Cuantía o Casos de Excepción" };

    await db.update(consolidaciones).set({ regularizado }).where(eq(consolidaciones.id, consolidacionId));
    if (regularizado) return { ok: true as const, subTipo: null };

    // "con_insumos" si algún ítem del SIAF consolidado tiene código IGSS; si no, "por_servicios"
    const siafIds = (await db.select({ id: siafCompras.id }).from(siafCompras)
      .where(eq(siafCompras.consolidacion_id, consolidacionId))).map(s => s.id);
    let tieneCodigo = false;
    if (siafIds.length > 0) {
      const [row] = await db.select({ id: siafComprasItems.id }).from(siafComprasItems)
        .where(and(
          inArray(siafComprasItems.solicitud_id, siafIds),
          sql`${siafComprasItems.codigo_igss} IS NOT NULL`,
        )).limit(1);
      tieneCodigo = !!row;
    }
    return { ok: true as const, subTipo: tieneCodigo ? ("con_insumos" as const) : ("por_servicios" as const) };
  } catch {
    return { error: "Error al elegir la forma de Baja Cuantía" };
  }
}

export async function buscarCotizacionServicio() {
  const session = await auth();
  if (!session) return [];
  return db.select().from(cotizacionesServicio)
    .where(eq(cotizacionesServicio.usado, false))
    .orderBy(sql`created_at DESC`);
}

export async function confirmarBajaCuantiaServicios(consolidacionId: number, cotizacionId: number, referencia: string): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [cot] = await db.select().from(cotizacionesServicio)
      .where(eq(cotizacionesServicio.id, cotizacionId)).limit(1);
    if (!cot) return { error: "No se encontró la cotización" };
    if (cot.usado) return { error: "Esa cotización ya fue usada en otra consolidación" };

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: cot.proveedor_id,
      cotizacion_servicio_id: cot.id,
      nit: cot.proveedor_nit ?? "", nombre: cot.proveedor_nombre,
      costo: cot.costo, exento_iva: cot.exento_iva,
      orden: 0, creado_por: check.uid,
    });
    await db.update(cotizacionesServicio)
      .set({ usado: true, usado_en_consolidacion_id: consolidacionId })
      .where(eq(cotizacionesServicio.id, cotizacionId));

    return enviarAJunta(consolidacionId, { referencia });
  } catch {
    return { error: "Error al confirmar la cotización de servicio" };
  }
}

// Contrato Abierto ya no pasa por Junta Adjudicadora: Compras adjudica
// directamente con una razón de adjudicación (texto libre) y el costo de
// factura (con IVA incluido, salvo que se marque exento), y la consolidación
// pasa de una vez a Presupuesto. Casos de Excepción ahora se ramifica igual
// que Baja Cuantía (Normal vs Regularizado) — ver elegirFormaBajaCuantia /
// registrarRegularizado / enviarAJunta.
export async function adjudicarDirecto(consolidacionId: number, data: {
  proveedor_id: number | null; nit: string; nombre: string;
  costo: number; exento_iva: boolean; referencia: string; razon: string;
}): Promise<{ ok: true } | { error: string; limitExceeded?: true }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra, referencia: consolidaciones.referencia })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (tipo !== "Contrato Abierto") return { error: "Esta acción solo aplica a Contrato Abierto" };

    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!(data.costo > 0)) return { error: "Ingresa un costo de factura válido" };
    if (!data.razon.trim()) return { error: "La razón de adjudicación es obligatoria" };
    const label = REFERENCIA_LABEL[tipo];
    if (label && !data.referencia.trim()) return { error: `El campo "${label}" es obligatorio` };

    const total = data.exento_iva ? data.costo : data.costo * 0.88;
    const limite = LIMITE_POR_TIPO[tipo];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}`,
        limitExceeded: true as const,
      };
    }

    await db.delete(oferentes).where(eq(oferentes.consolidacion_id, consolidacionId));
    await db.insert(oferentes).values({
      consolidacion_id: consolidacionId,
      proveedor_id: data.proveedor_id,
      nit: data.nit.trim(), nombre: data.nombre.trim(),
      costo: data.costo, exento_iva: data.exento_iva,
      orden: 0, creado_por: check.uid,
    });

    await db.update(consolidaciones).set({
      referencia: label ? data.referencia.trim() : con.referencia,
      numero_adjudicacion: data.razon.trim(),
      proveedor_id: data.proveedor_id,
      proveedor_nit: data.nit.trim(), proveedor_nombre: data.nombre.trim(),
      exento_iva: data.exento_iva, total,
      destino: "presupuesto", estado: "Enviado a Presupuesto",
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true as const };
  } catch {
    return { error: "Error al adjudicar" };
  }
}

export async function enviarAJunta(consolidacionId: number, data?: { referencia?: string }): Promise<{ ok: true } | { error: string }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (!tipo) return { error: "Selecciona primero el tipo de compra" };

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(oferentes)
      .where(eq(oferentes.consolidacion_id, consolidacionId));
    if (count === 0) return { error: "Agrega al menos un oferente antes de enviar a Junta" };

    if (tipo === "Compra Directa" && (!con.nog || !con.fecha_evento))
      return { error: "Completa el NOG y la fecha del evento antes de enviar a Junta" };

    const label = REFERENCIA_LABEL[tipo];
    const referencia = data?.referencia?.trim() || con.referencia || "";
    if (label && !referencia) return { error: `El campo "${label}" es obligatorio` };

    const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
    await db.update(consolidaciones).set({
      estado: "Enviado a Junta",
      enviado_a_junta_por: check.uid,
      enviado_a_junta_en: ahora,
      motivo_rechazo: null, rechazado_por: null, rechazado_en: null,
      referencia: label ? referencia : con.referencia,
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true };
  } catch {
    return { error: "Error al enviar a Junta" };
  }
}

export async function registrarRegularizado(consolidacionId: number, data: {
  nit: string; nombre: string; monto: number; exento_iva: boolean;
}): Promise<{ ok: true } | { error: string; limitExceeded?: true }> {
  try {
    const check = await requireCompras();
    if ("error" in check) return check;

    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra, regularizado: consolidaciones.regularizado })
      .from(consolidaciones).where(eq(consolidaciones.id, consolidacionId)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if ((con.tipo_compra !== "Baja Cuantía" && con.tipo_compra !== "Casos de Excepción") || con.regularizado !== true)
      return { error: "Esta acción solo aplica a Baja Cuantía o Casos de Excepción, en su forma Regularizado" };

    if (!data.nit.trim() || !data.nombre.trim()) return { error: "NIT y nombre son obligatorios" };
    if (!(data.monto > 0)) return { error: "Ingresa un monto válido" };

    const total = data.exento_iva ? data.monto : data.monto * 0.88;
    const limite = LIMITE_POR_TIPO[con.tipo_compra as TipoCompra];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")}`,
        limitExceeded: true as const,
      };
    }

    const anioActual = new Date().getFullYear();
    const numeroA04 = await siguienteNumeroA04(anioActual);

    await db.update(consolidaciones).set({
      proveedor_nit: data.nit.trim(), proveedor_nombre: data.nombre.trim(),
      exento_iva: data.exento_iva, total,
      destino: "fondo_rotativo", estado: "Enviado a Fondo Rotativo",
      numero_a04: numeroA04, anio_a04: anioActual,
    }).where(eq(consolidaciones.id, consolidacionId));

    return { ok: true as const };
  } catch {
    return { error: "Error al registrar la compra regularizada" };
  }
}
