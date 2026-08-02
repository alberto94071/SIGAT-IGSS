"use server";
// Caducidad de cuatrimestre: el saldo programado no comprometido NO se
// traslada al siguiente cuatrimestre (se vuelve cero); solo se traslada el
// monto que tenga un número de Compromiso asignado (ver
// programacionCompromisos en schema.ts, alimentado por
// comprometerYEnviarADevengado). Lo que queda sin comprometer se pierde
// para siempre, pero se acumula en presupuesto_renglones.no_ejecutado (ver
// acumularNoEjecutado) — solo vuelve a estar disponible si alguien lo
// libera manualmente desde Presupuesto General (ver
// liberarNoEjecutado en presupuesto-general-actions.ts).
// Sin cron: se resuelve de forma perezosa la primera vez que alguien pide
// datos de Programación después de que un cuatrimestre venció — ver dónde
// se llama procesarCierreCuatrimestres() en programacion-actions.ts.
import { db } from "@/lib/db";
import { programacionEntradas, programacionCompromisos, configuracion, presupuestoRenglones } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";
import { cuatrimestreDeFecha } from "@/lib/programacion-constants";
import { EJERCICIO_FISCAL } from "@/lib/presupuesto-disponible";
import { PRESUPUESTO_DATA } from "@/lib/presupuesto-general-data";

function marca(cuatrimestre: number): string {
  return `${EJERCICIO_FISCAL}-${cuatrimestre}`;
}

async function acumularNoEjecutado(renglon: number, subproducto: string, monto: number): Promise<void> {
  const [existente] = await db.select({ id: presupuestoRenglones.id })
    .from(presupuestoRenglones)
    .where(and(
      eq(presupuestoRenglones.ejercicio_fiscal, EJERCICIO_FISCAL),
      eq(presupuestoRenglones.renglon, renglon),
      eq(presupuestoRenglones.subproducto, subproducto),
    )).limit(1);

  if (existente) {
    await db.update(presupuestoRenglones).set({
      no_ejecutado: sql`COALESCE(${presupuestoRenglones.no_ejecutado}, 0) + ${monto}`,
    }).where(eq(presupuestoRenglones.id, existente.id));
  } else {
    const base = PRESUPUESTO_DATA.find(r => r.renglon === renglon && r.subProducto === subproducto);
    await db.insert(presupuestoRenglones).values({
      ejercicio_fiscal: EJERCICIO_FISCAL,
      renglon, subproducto,
      nombre: base?.descripcion ?? "",
      vigente: base?.vigente ?? null,
      no_ejecutado: monto,
    });
  }
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

  // Cuánto se había Programado (Aprobado) en total este cuatrimestre, por
  // renglón + sub-producto (ambos tipos juntos) — es la base para calcular
  // cuánto de eso NO se llegó a comprometer (No Ejecutado).
  const programadoDelCuatrimestre = await db.select({
    renglon:     programacionEntradas.renglon,
    subproducto: programacionEntradas.subproducto,
    mes1:        programacionEntradas.mes1,
    mes2:        programacionEntradas.mes2,
    mes3:        programacionEntradas.mes3,
    mes4:        programacionEntradas.mes4,
  }).from(programacionEntradas).where(and(
    eq(programacionEntradas.ejercicio_fiscal, EJERCICIO_FISCAL),
    eq(programacionEntradas.cuatrimestre, cuatrimestre),
    eq(programacionEntradas.estado, "Aprobado"),
  ));

  const totalProgramadoPorClave = new Map<string, number>();
  for (const p of programadoDelCuatrimestre) {
    const clave = `${p.renglon}|${p.subproducto}`;
    const total = p.mes1 + p.mes2 + p.mes3 + p.mes4;
    totalProgramadoPorClave.set(clave, (totalProgramadoPorClave.get(clave) ?? 0) + total);
  }

  const comprometidoPorClaveSimple = new Map<string, number>();
  for (const { renglon, subproducto, monto } of porClave.values()) {
    const clave = `${renglon}|${subproducto}`;
    comprometidoPorClaveSimple.set(clave, (comprometidoPorClaveSimple.get(clave) ?? 0) + monto);
  }

  for (const [clave, totalProgramado] of totalProgramadoPorClave.entries()) {
    const [renglonStr, subproducto] = clave.split("|");
    const comprometidoAqui = comprometidoPorClaveSimple.get(clave) ?? 0;
    const noEjecutado = totalProgramado - comprometidoAqui;
    if (noEjecutado > 0.01) {
      await acumularNoEjecutado(Number(renglonStr), subproducto, noEjecutado);
    }
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
  // como Programado (ver filtro estado='Aprobado' en getSaldoRenglon /
  // getEjecucionData) — lo que no se comprometió ya quedó registrado en
  // no_ejecutado arriba, así que perderlo aquí no reduce el Saldo dos veces
  // ni lo libera de más.
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
