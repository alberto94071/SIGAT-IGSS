"use server";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { MASTER_PASSWORD } from "./master-password";
import {
  configuracion, usuarios, catalogoInsumos, catalogo182, catalogoCompras, catalogoSubproductos,
  catalogoFirmantes, siafSeq, baseDatosCentral, presupuestoRenglones, proveedores, pasajesAfiliados,
  servicios, friFondoRotativo, movimientosBanco, cajaChica, auditLog, pasajesTarifario,
  cotizacionesServicio, cotizacionesAnuales, actasNegociacion, notificaciones, nogRegistros,
  viaticoLiquidaciones, programacionEntradas, pasajesSolicitudes, requisicionesBodega, valesCajaChica,
  consolidaciones, siafCompras, reprogramacionLotes, reprogramaciones, modificacionesPresupuestarias,
  ordenesCompra, pagos, fondoRotativoPagos, cotizacionesAnualesItems, actasAdjudicacion, consolidacionPrecios,
  oferentes, siafComprasItems, programacionCompromisos, requisicionBodegaItems, polizas,
  oferentePrecios, pasajesPagos,
} from "@/lib/schema";

// Todas las tablas de la base de datos, en orden de dependencia (las que
// otras tablas referencian por llave foránea van primero). Este mismo orden
// se usa para restaurar (insertar) un respaldo — así ninguna fila hija se
// inserta antes que su padre. Para TRUNCATE el orden no importa porque se
// truncan todas juntas con CASCADE.
const TABLAS = [
  { nombre: "configuracion", tabla: configuracion },
  { nombre: "usuarios", tabla: usuarios },
  { nombre: "catalogo_insumos", tabla: catalogoInsumos },
  { nombre: "catalogo_182", tabla: catalogo182 },
  { nombre: "catalogo_compras", tabla: catalogoCompras },
  { nombre: "catalogo_subproductos", tabla: catalogoSubproductos },
  { nombre: "catalogo_firmantes", tabla: catalogoFirmantes },
  { nombre: "siaf_seq", tabla: siafSeq },
  { nombre: "base_datos_central", tabla: baseDatosCentral },
  { nombre: "presupuesto_renglones", tabla: presupuestoRenglones },
  { nombre: "proveedores", tabla: proveedores },
  { nombre: "pasajes_afiliados", tabla: pasajesAfiliados },
  { nombre: "servicios", tabla: servicios },
  { nombre: "fri_fondo_rotativo", tabla: friFondoRotativo },
  { nombre: "movimientos_banco", tabla: movimientosBanco },
  { nombre: "caja_chica", tabla: cajaChica },
  { nombre: "audit_log", tabla: auditLog },
  { nombre: "pasajes_tarifario", tabla: pasajesTarifario },
  { nombre: "cotizaciones_servicio", tabla: cotizacionesServicio },
  { nombre: "cotizaciones_anuales", tabla: cotizacionesAnuales },
  { nombre: "actas_negociacion", tabla: actasNegociacion },
  { nombre: "notificaciones", tabla: notificaciones },
  { nombre: "nog_registros", tabla: nogRegistros },
  { nombre: "viatico_liquidaciones", tabla: viaticoLiquidaciones },
  { nombre: "programacion_entradas", tabla: programacionEntradas },
  { nombre: "pasajes_solicitudes", tabla: pasajesSolicitudes },
  { nombre: "requisiciones_bodega", tabla: requisicionesBodega },
  { nombre: "vales_caja_chica", tabla: valesCajaChica },
  { nombre: "consolidaciones", tabla: consolidaciones },
  { nombre: "siaf_compras", tabla: siafCompras },
  { nombre: "reprogramacion_lotes", tabla: reprogramacionLotes },
  { nombre: "reprogramaciones", tabla: reprogramaciones },
  { nombre: "modificaciones_presupuestarias", tabla: modificacionesPresupuestarias },
  { nombre: "ordenes_compra", tabla: ordenesCompra },
  { nombre: "pagos", tabla: pagos },
  { nombre: "fondo_rotativo_pagos", tabla: fondoRotativoPagos },
  { nombre: "cotizaciones_anuales_items", tabla: cotizacionesAnualesItems },
  { nombre: "actas_adjudicacion", tabla: actasAdjudicacion },
  { nombre: "consolidacion_precios", tabla: consolidacionPrecios },
  { nombre: "oferentes", tabla: oferentes },
  { nombre: "siaf_compras_items", tabla: siafComprasItems },
  { nombre: "programacion_compromisos", tabla: programacionCompromisos },
  { nombre: "requisicion_bodega_items", tabla: requisicionBodegaItems },
  { nombre: "polizas", tabla: polizas },
  { nombre: "oferente_precios", tabla: oferentePrecios },
  { nombre: "pasajes_pagos", tabla: pasajesPagos },
] as const;

export type BackupData = {
  version: 1;
  generado_en: string;
  tablas: Record<string, Record<string, unknown>[]>;
  // Tablas que el schema define pero que no existen físicamente en esta base
  // de datos todavía (ver implementation_plan.md — hay features más viejas
  // que Presupuesto, como DAB-75 y Viáticos, cuya migración nunca se aplicó).
  // No se detiene el respaldo por eso; solo se avisa.
  omitidas: string[];
};

// Código de Postgres para "la relación (tabla) no existe".
const RELATION_NOT_FOUND = "42P01";

function esTablaInexistente(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === RELATION_NOT_FOUND;
}

async function generarBackupData(): Promise<BackupData> {
  const tablas: Record<string, Record<string, unknown>[]> = {};
  const omitidas: string[] = [];
  for (const { nombre, tabla } of TABLAS) {
    try {
      tablas[nombre] = await db.select().from(tabla as never);
    } catch (e) {
      if (!esTablaInexistente(e)) throw e;
      omitidas.push(nombre);
    }
  }
  return { version: 1, generado_en: new Date().toISOString(), tablas, omitidas };
}

/**
 * Respaldo completo del sistema: exporta el contenido íntegro de todas las
 * tablas (catálogos, usuarios, configuración, y toda la operación
 * transaccional) a un solo objeto — se descarga como archivo .json desde el
 * navegador. Ese archivo se puede volver a cargar más adelante con
 * restaurarBackup para regresar el sistema exactamente a este punto.
 */
export async function exportarBackup(password: string): Promise<{ ok: true; data: BackupData } | { error: string }> {
  if (password !== MASTER_PASSWORD) return { error: "Contraseña incorrecta." };
  try {
    return { ok: true, data: await generarBackupData() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al generar el respaldo" };
  }
}

// Mismo respaldo, pero para el Administrador Máster (rol "superadmin") desde
// dentro de la aplicación — ver src/app/administracion/reiniciar.
export async function exportarBackupComoSuperadmin(): Promise<{ ok: true; data: BackupData } | { error: string }> {
  const session = await auth();
  if (!session || session.user.rol !== "superadmin") return { error: "Sin permiso" };
  try {
    return { ok: true, data: await generarBackupData() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al generar el respaldo" };
  }
}

/**
 * Restaura la base de datos completa desde un respaldo generado por
 * exportarBackup: BORRA todo lo que haya actualmente (con TRUNCATE CASCADE,
 * igual que el reinicio) y lo reemplaza fila por fila con el contenido del
 * respaldo, en orden de dependencia. Al final reinicia cada secuencia de id
 * autoincremental al máximo id restaurado, para que los próximos registros
 * nuevos no choquen con los restaurados.
 */
export async function restaurarBackup(password: string, backup: BackupData): Promise<{ ok: true; omitidas: string[] } | { error: string }> {
  if (password !== MASTER_PASSWORD) return { error: "Contraseña incorrecta." };
  if (!backup || backup.version !== 1 || !backup.tablas) return { error: "El archivo de respaldo no es válido" };

  try {
    // Se trunca tabla por tabla (no todas en un solo TRUNCATE) para que, si
    // alguna no existe físicamente en esta base de datos (schema más viejo o
    // más nuevo que cuando se generó el respaldo), no tumbe todo el proceso.
    const omitidas: string[] = [];
    for (const { nombre } of TABLAS) {
      try {
        await db.execute(sql.raw(`TRUNCATE TABLE "${nombre}" CASCADE;`));
      } catch (e) {
        if (!esTablaInexistente(e)) throw e;
        omitidas.push(nombre);
      }
    }

    // En lotes: insertar miles de filas en un solo .values() hace que la
    // consulta que arma el driver crezca demasiado (se vio un "Maximum call
    // stack size exceeded" con catalogo_compras, ~1600 filas).
    const LOTE = 200;

    for (const { nombre, tabla } of TABLAS) {
      if (omitidas.includes(nombre)) continue;
      const filas = backup.tablas[nombre];
      if (!filas || filas.length === 0) continue;
      for (let i = 0; i < filas.length; i += LOTE) {
        await db.insert(tabla as never).values(filas.slice(i, i + LOTE) as never);
      }
      if (nombre !== "siaf_seq") {
        await db.execute(sql.raw(
          `SELECT setval(pg_get_serial_sequence('${nombre}', 'id'), COALESCE((SELECT MAX(id) FROM "${nombre}"), 1), true);`
        ));
      }
    }

    return { ok: true, omitidas };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al restaurar el respaldo" };
  }
}
