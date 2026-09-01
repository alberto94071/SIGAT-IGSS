"use server";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { verificarMasterPassword } from "./master-password";

// Todo lo que se genera al USAR el sistema (compras, presupuesto, fondo
// rotativo, viáticos, pasajes, etc). No incluye catálogos, configuración,
// usuarios, firmantes ni actas de negociación — esos son datos de
// referencia/configuración que el Administrador Máster arma una sola vez y
// que sobreviven al reinicio.
// A propósito NO incluye requisiciones_bodega/requisicion_bodega_items
// (historial de DAB-75 de cada colaborador — debe sobrevivir para que
// puedan ver todo lo que han solicitado desde que trabajan acá) ni
// almacen_insumos/almacen_lotes/requisicion_bodega_despachos (el stock real
// de Almacén puede tener insumos del año pasado que todavía no se han
// entregado — confirmado por el cliente 2026-08-27).
const TABLAS_TRANSACCIONALES = [
  "siaf_compras",
  "siaf_compras_items",
  "cotizaciones_servicio",
  "cotizaciones_anuales",
  "cotizaciones_anuales_items",
  "nog_registros",
  "consolidaciones",
  "consolidacion_precios",
  "actas_adjudicacion",
  "oferentes",
  "oferente_precios",
  "ordenes_compra",
  "fri_fondo_rotativo",
  "fondo_rotativo_pagos",
  "movimientos_banco",
  "caja_chica",
  "vales_caja_chica",
  "polizas",
  "viatico_solicitudes",
  "viatico_comisiones",
  "pasajes_solicitudes",
  "pasajes_pagos",
  "audit_log",
  "notificaciones",
  "programacion_entradas",
  "programacion_compromisos",
  "reprogramacion_lotes",
  "reprogramaciones",
  "modificaciones_presupuestarias",
];

async function truncarDatosTransaccionales() {
  for (const table of TABLAS_TRANSACCIONALES) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE;`));
    } catch (err: any) {
      console.warn(`No se pudo truncar ${table}:`, err.message);
    }
  }

  await db.execute(sql`
    UPDATE presupuesto_renglones
    SET
      saldo_presupuestario = COALESCE(saldo_presupuestario, saldo_disponible),
      pre_compromiso = 0,
      compromiso = 0,
      devengado = 0,
      devengado_regularizado = 0,
      modificacion_ingru = 0,
      modificacion_entre_renglones = 0,
      modificacion_ampliacion = 0,
      no_ejecutado = 0,
      saldo_disponible = COALESCE(saldo_presupuestario, saldo_disponible)
  `);

  await db.execute(sql`UPDATE siaf_seq SET valor = 1`);

  // El saldo en caja del Fondo Rotativo vuelve al monto total una vez que
  // se borran vales, pagos y FRIs pendientes de reintegro. El marcador de
  // cierre de cuatrimestre también se limpia — si no, procesarCierreCuatrimestres
  // (cierre-cuatrimestre.ts) "recuerda" haber cerrado cuatrimestres del ciclo
  // anterior y se salta el cierre de esos mismos números en el ciclo nuevo.
  await db.execute(sql`UPDATE configuracion SET efectivo_caja = monto_fondo_rotativo, ultimo_cuatrimestre_cerrado = NULL`);
}

// Reinicio desde la ruta de desarrollador (/developer/peligro/reset),
// protegido con la clave compartida del programador Y con sesión de
// Administrador Máster — la clave por sí sola ya no basta (queda expuesta
// en el código fuente del repositorio), así que el rol es la barrera real.
export async function executeDatabaseReset(password: string): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session || session.user.rol !== "superadmin") return { error: "Sin permiso" };
  if (!verificarMasterPassword(password)) {
    return { error: "Contraseña incorrecta." };
  }
  try {
    await truncarDatosTransaccionales();
    return { ok: true };
  } catch (e) {
    // El detalle técnico (nombres de tabla, mensaje crudo de Postgres, etc.)
    // solo va al log del servidor — al cliente no, aunque quien lo pida ya
    // sea superadmin, para no filtrar detalles internos de la base de datos.
    console.error("Error al reiniciar la base de datos:", e);
    return { error: "Error al reiniciar la base de datos" };
  }
}

// Misma operación, pero para el Administrador Máster (rol "superadmin")
// desde dentro de la aplicación — sin necesidad de la clave de desarrollador
// ni de tocar código. Ver src/app/administracion/reiniciar.
export async function reiniciarSistemaComoSuperadmin(): Promise<{ ok: true } | { error: string }> {
  const session = await auth();
  if (!session || session.user.rol !== "superadmin") return { error: "Sin permiso" };
  try {
    await truncarDatosTransaccionales();
    return { ok: true };
  } catch (e) {
    console.error("Error al reiniciar la base de datos:", e);
    return { error: "Error al reiniciar la base de datos" };
  }
}
