"use server";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const MASTER_PASSWORD = "Katerine.94071";

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
        modificacion_ingru = 0,
        modificacion_entre_renglones = 0,
        modificacion_ampliacion = 0,
        saldo_disponible = COALESCE(saldo_presupuestario, saldo_disponible)
    `);

    await db.execute(sql`UPDATE siaf_seq SET valor = 1`);

    return { ok: true };
  } catch (e: any) {
    return { error: e.message || "Error al reiniciar la base de datos" };
  }
}
