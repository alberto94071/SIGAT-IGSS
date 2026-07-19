"use server";

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const MASTER_PASSWORD = "SIGAT-Dev-2026!";

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
      "cotizaciones_servicio",
      "cotizaciones_anuales",
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
      "nog_registros",
      "audit_log",
      "notificaciones",
    ];

    for (const table of tablesToTruncate) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE;`));
    }

    await db.execute(sql`
      UPDATE presupuesto_renglones 
      SET 
        pre_compromiso = 0,
        compromiso = 0,
        devengado = 0,
        saldo_disponible = presupuesto
    `);

    await db.execute(sql`UPDATE siaf_seq SET valor = 1`);

    return { ok: true };
  } catch (e: any) {
    return { error: e.message || "Error al reiniciar la base de datos" };
  }
}
