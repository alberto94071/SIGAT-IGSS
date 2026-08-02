"use server";
// Caducidad de cuatrimestre: el saldo programado no ejecutado NO se traslada
// al siguiente cuatrimestre (se vuelve cero); solo se traslada el monto que
// tenga un número de Compromiso asignado (ver programacionCompromisos en
// schema.ts, alimentado por comprometerYEnviarADevengado). Sin cron: se
// resuelve de forma perezosa la primera vez que alguien pide datos de
// Programación después de que un cuatrimestre venció — ver dónde se llama
// procesarCierreCuatrimestres() en programacion-actions.ts.
import { db } from "@/lib/db";
import { programacionEntradas, programacionCompromisos, configuracion } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";
import { cuatrimestreDeFecha } from "@/lib/programacion-constants";
import { EJERCICIO_FISCAL } from "@/lib/presupuesto-disponible";

function marca(cuatrimestre: number): string {
  return `${EJERCICIO_FISCAL}-${cuatrimestre}`;
}

async function cerrarCuatrimestre(cuatrimestre: number): Promise<void> {
  const comprometido = await db.select({
    renglon:     programacionEntradas.renglon,
    subproducto: programacionEntradas.subproducto,
    tipo:        programacionEntradas.tipo,
    monto:       programacionCompromisos.monto,
  }).from(programacionCompromisos)
    .innerJoin(programacionEntradas, eq(programacionCompromisos.programacion_entrada_id, programacionEntradas.id))
    .where(and(
      eq(programacionEntradas.ejercicio_fiscal, EJERCICIO_FISCAL),
      eq(programacionEntradas.cuatrimestre, cuatrimestre),
    ));

  const porClave = new Map<string, { renglon: number; subproducto: string; tipo: string; monto: number }>();
  for (const c of comprometido) {
    const clave = `${c.renglon}|${c.subproducto}|${c.tipo}`;
    const acc = porClave.get(clave) ?? { renglon: c.renglon, subproducto: c.subproducto, tipo: c.tipo, monto: 0 };
    acc.monto += c.monto;
    porClave.set(clave, acc);
  }

  const siguiente = cuatrimestre + 1;
  if (siguiente <= 3) {
    for (const { renglon, subproducto, tipo, monto } of porClave.values()) {
      if (monto <= 0) continue;
      const [existente] = await db.select({ id: programacionEntradas.id }).from(programacionEntradas).where(and(
        eq(programacionEntradas.ejercicio_fiscal, EJERCICIO_FISCAL),
        eq(programacionEntradas.cuatrimestre, siguiente),
        eq(programacionEntradas.renglon, renglon),
        eq(programacionEntradas.subproducto, subproducto),
        eq(programacionEntradas.tipo, tipo),
      )).limit(1);

      if (existente) {
        await db.update(programacionEntradas).set({
          mes1: sql`${programacionEntradas.mes1} + ${monto}`,
        }).where(eq(programacionEntradas.id, existente.id));
      } else {
        await db.insert(programacionEntradas).values({
          ejercicio_fiscal: EJERCICIO_FISCAL,
          cuatrimestre: siguiente,
          renglon, subproducto, tipo,
          mes1: monto,
          estado: "Aprobado", // ya viene comprometido, no pasa de nuevo por Solicitado
        });
      }
    }
  }

  // Todo lo demás del cuatrimestre que se cierra caduca: deja de contar
  // como programado/disponible (ver filtro en presupuesto-disponible.ts).
  await db.update(programacionEntradas).set({ estado: "Caducado" }).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO_FISCAL),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
    sql`${programacionEntradas.estado} != 'Caducado'`,
  ));
}

export async function procesarCierreCuatrimestres(): Promise<void> {
  const cuatrimestreActual = cuatrimestreDeFecha(fechaGuatemala());
  if (cuatrimestreActual <= 1) return;

  const [config] = await db.select({ marca: configuracion.ultimo_cuatrimestre_cerrado }).from(configuracion).limit(1);
  const yaCerradoHasta = config?.marca?.startsWith(`${EJERCICIO_FISCAL}-`)
    ? Number(config.marca.split("-")[1])
    : 0;

  for (let c = yaCerradoHasta + 1; c < cuatrimestreActual; c++) {
    await cerrarCuatrimestre(c);
    await db.update(configuracion).set({ ultimo_cuatrimestre_cerrado: marca(c) });
  }
}
