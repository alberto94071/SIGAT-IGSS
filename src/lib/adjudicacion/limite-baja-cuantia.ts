import { db } from "@/lib/db";
import { siafComprasItems, siafCompras, consolidaciones } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

// Q25,000 por insumo (código IGSS), por cuatrimestre — solo aplica a Baja
// Cuantía. Casos de Excepción no tiene ninguna limitante.
export const LIMITE_INSUMO_CUATRIMESTRE = 25000;

// Cuatrimestres del ejercicio fiscal: ene-abr, may-ago, sep-dic. Al iniciar
// uno nuevo el conteo se reinicia solo, porque el rango de fechas ya no
// incluye lo gastado en el cuatrimestre anterior.
export function bordesCuatrimestre(fechaISO: string): { inicio: string; fin: string } {
  const anio = parseInt(fechaISO.slice(0, 4), 10);
  const mes = parseInt(fechaISO.slice(5, 7), 10);
  if (mes <= 4) return { inicio: `${anio}-01-01`, fin: `${anio}-04-30` };
  if (mes <= 8) return { inicio: `${anio}-05-01`, fin: `${anio}-08-31` };
  return { inicio: `${anio}-09-01`, fin: `${anio}-12-31` };
}

// Suma lo ya adjudicado por Baja Cuantía de un código de insumo dentro del
// cuatrimestre de `fecha` (excluyendo, si se indica, la propia consolidación
// que se está evaluando — para permitir corregir/reenviar sin duplicar).
export async function totalInsumoEnCuatrimestre(
  codigoIgss: string, fecha: string, excluirConsolidacionId?: number,
): Promise<number> {
  const { inicio, fin } = bordesCuatrimestre(fecha);
  const condiciones = [
    eq(siafComprasItems.codigo_igss, codigoIgss),
    eq(consolidaciones.tipo_compra, "Baja Cuantía"),
    sql`${consolidaciones.fecha} >= ${inicio} AND ${consolidaciones.fecha} <= ${fin}`,
  ];
  if (excluirConsolidacionId != null) condiciones.push(sql`${consolidaciones.id} != ${excluirConsolidacionId}`);

  const rows = await db.select({ monto_neto: siafComprasItems.monto_neto })
    .from(siafComprasItems)
    .innerJoin(siafCompras, eq(siafComprasItems.solicitud_id, siafCompras.id))
    .innerJoin(consolidaciones, eq(siafCompras.consolidacion_id, consolidaciones.id))
    .where(and(...condiciones));

  return rows.reduce((s, r) => s + (r.monto_neto ?? 0), 0);
}

// Verifica un lote de ítems {codigo_igss, monto_neto} contra el límite de
// Q25,000/cuatrimestre, agrupando por código (varias líneas del mismo insumo
// en un mismo SIAF también se suman entre sí antes de comparar). Devuelve la
// lista de insumos que excederían el límite, ya con el detalle para el
// mensaje de error.
export async function verificarLimiteInsumos(
  items: { codigo_igss: string; monto_neto: number }[],
  fecha: string,
  excluirConsolidacionId?: number,
): Promise<{ codigo_igss: string; yaAcumulado: number; nuevoTotal: number }[]> {
  const porCodigo = new Map<string, number>();
  for (const item of items) {
    porCodigo.set(item.codigo_igss, (porCodigo.get(item.codigo_igss) ?? 0) + item.monto_neto);
  }

  const excedidos: { codigo_igss: string; yaAcumulado: number; nuevoTotal: number }[] = [];
  for (const [codigo, montoNuevo] of porCodigo) {
    const yaAcumulado = await totalInsumoEnCuatrimestre(codigo, fecha, excluirConsolidacionId);
    const nuevoTotal = yaAcumulado + montoNuevo;
    if (nuevoTotal > LIMITE_INSUMO_CUATRIMESTRE) {
      excedidos.push({ codigo_igss: codigo, yaAcumulado, nuevoTotal });
    }
  }
  return excedidos;
}

export function mensajeLimiteExcedido(excedidos: { codigo_igss: string; yaAcumulado: number; nuevoTotal: number }[]): string {
  const detalle = excedidos.map(e =>
    `${e.codigo_igss} (ya acumulado Q${e.yaAcumulado.toFixed(2)} este cuatrimestre, con este SIAF llegaría a Q${e.nuevoTotal.toFixed(2)})`
  ).join("; ");
  return `Estos insumos superarían el límite de Q${LIMITE_INSUMO_CUATRIMESTRE.toLocaleString("es-GT")} por cuatrimestre: ${detalle}`;
}
