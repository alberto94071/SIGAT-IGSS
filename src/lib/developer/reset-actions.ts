"use server";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { MASTER_PASSWORD } from "./master-password";

export async function executeDatabaseReset(password: string): Promise<{ ok: true } | { error: string }> {
  if (password !== MASTER_PASSWORD) {
    return { error: "Contraseña incorrecta." };
  }

  try {
    const tablesToTruncate = [
      "siaf_compras",
      "consolidaciones",
      "actas_adjudicacion",
      "consolidacion_precios",
      "oferentes",
      "ordenes_compra",
      "fri_fondo_rotativo",
      "fondo_rotativo_pagos",
      "movimientos_banco",
      "caja_chica",
      "vales_caja_chica",
      "polizas",
      "requisiciones_bodega",
      "viatico_liquidaciones",
      "pasajes_solicitudes",
      "pasajes_pagos",
      "audit_log",
      "notificaciones",
      "programacion_entradas",
      "reprogramaciones",
      "modificaciones_presupuestarias",
    ];

    for (const table of tablesToTruncate) {
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
        saldo_disponible = COALESCE(saldo_presupuestario, saldo_disponible)
    `);

    await db.execute(sql`UPDATE siaf_seq SET valor = 1`);

    // El saldo en caja del Fondo Rotativo vuelve al monto total una vez que
    // se borran vales, pagos y FRIs pendientes de reintegro.
    await db.execute(sql`UPDATE configuracion SET efectivo_caja = monto_fondo_rotativo`);

    return { ok: true };
  } catch (e: any) {
    return { error: e.message || "Error al reiniciar la base de datos" };
  }
}
