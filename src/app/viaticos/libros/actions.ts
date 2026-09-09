"use server";
import { db } from "@/lib/db";
import { viaticoSolicitudes, viaticoPagos, viaticoLibroRecepciones } from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { requireTabAccessAction } from "@/lib/modulo-access";

const TAB = "tab_viaticos_libros" as const;

export async function getRecepciones() {
  return db.select().from(viaticoLibroRecepciones)
    .orderBy(sql`${viaticoLibroRecepciones.fecha} DESC, ${viaticoLibroRecepciones.id} DESC`);
}

export type DatosRecepcion = { fecha: string; cantidad: number; detalle: string };

// "Recepción de formularios" — cuando Tesorería/Guatecompras manda un lote
// nuevo de talonarios V-A/V-C/V-L en blanco. No está ligada a una solicitud
// ni a un mes puntual: la fecha decide sola a qué Libro mensual pertenece
// cuando se genera (ver getLibroViaticos).
export async function agregarRecepcion(datos: DatosRecepcion): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  if (!datos.fecha) return { error: "La fecha es obligatoria" };
  if (!(datos.cantidad > 0)) return { error: "Ingresá una cantidad mayor a cero" };

  await db.insert(viaticoLibroRecepciones).values({
    fecha: datos.fecha, cantidad: Math.round(datos.cantidad),
    detalle: datos.detalle.trim() || null, creado_por: check.uid,
  });
  return { ok: true };
}

export async function eliminarRecepcion(id: number): Promise<{ ok: true } | { error: string }> {
  const check = await requireTabAccessAction("mod_viaticos", TAB);
  if ("error" in check) return check;

  await db.delete(viaticoLibroRecepciones).where(eq(viaticoLibroRecepciones.id, id));
  return { ok: true };
}

export type MovimientoLibro = {
  tipo: "formulario" | "recepcion";
  fecha: string;
  nombre: string;
  nombramiento: string | null;
  fecha_nombramiento: string | null;
  utilizados: number; anulados: number; extraviados: number;
  numero_formulario: string | null;
  valor: number | null;
  cantidad_recepcion: number | null;
};

// Movimientos del mes (YYYY-MM) para el Libro de Control, Existencia, Uso y
// Entrega de Formularios de Viáticos: cada solicitud cuyo formulario llegó a
// un estado terminal ese mes (Aprobado = Utilizado, o Anulado/Extraviado) más
// las recepciones de talonario registradas ese mes — ordenados por fecha
// para poder calcular la existencia corrida al imprimir.
export async function getLibroViaticos(mes: string): Promise<MovimientoLibro[]> {
  const solicitudes = await db.select({
    id: viaticoSolicitudes.id, estado: viaticoSolicitudes.estado,
    numero_formulario: viaticoSolicitudes.numero_formulario, persona_nombre: viaticoSolicitudes.persona_nombre,
    nombramiento_numero: viaticoSolicitudes.nombramiento_numero, fecha_nombramiento: viaticoSolicitudes.fecha_nombramiento,
    aprobado_en: viaticoSolicitudes.aprobado_en, formulario_marcado_en: viaticoSolicitudes.formulario_marcado_en,
  }).from(viaticoSolicitudes)
    .where(sql`${viaticoSolicitudes.estado} IN ('Aprobado', 'Anulado', 'Extraviado')`);

  const relevantes = solicitudes
    .map(s => ({ ...s, fechaEvento: (s.estado === "Aprobado" ? s.aprobado_en : s.formulario_marcado_en) ?? "" }))
    .filter(s => s.fechaEvento.slice(0, 7) === mes);

  const idsAprobados = relevantes.filter(s => s.estado === "Aprobado").map(s => s.id);
  const pagosMap = new Map<number, number>();
  if (idsAprobados.length > 0) {
    const pagos = await db.select({ viatico_solicitud_id: viaticoPagos.viatico_solicitud_id, total: viaticoPagos.total })
      .from(viaticoPagos).where(inArray(viaticoPagos.viatico_solicitud_id, idsAprobados));
    for (const p of pagos) pagosMap.set(p.viatico_solicitud_id, p.total);
  }

  const movimientosFormularios: MovimientoLibro[] = relevantes.map(s => ({
    tipo: "formulario",
    fecha: s.fechaEvento.slice(0, 10),
    nombre: s.persona_nombre ?? "—",
    nombramiento: s.nombramiento_numero,
    fecha_nombramiento: s.fecha_nombramiento,
    utilizados: s.estado === "Aprobado" ? 1 : 0,
    anulados: s.estado === "Anulado" ? 1 : 0,
    extraviados: s.estado === "Extraviado" ? 1 : 0,
    numero_formulario: s.numero_formulario,
    valor: s.estado === "Aprobado" ? (pagosMap.get(s.id) ?? 0) : null,
    cantidad_recepcion: null,
  }));

  const recepciones = await db.select().from(viaticoLibroRecepciones)
    .where(sql`${viaticoLibroRecepciones.fecha} LIKE ${mes + "%"}`);
  const movimientosRecepcion: MovimientoLibro[] = recepciones.map(r => ({
    tipo: "recepcion",
    fecha: r.fecha,
    nombre: "Recepción de formularios",
    nombramiento: null, fecha_nombramiento: null,
    utilizados: 0, anulados: 0, extraviados: 0,
    numero_formulario: null, valor: null,
    cantidad_recepcion: r.cantidad,
  }));

  return [...movimientosFormularios, ...movimientosRecepcion].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
