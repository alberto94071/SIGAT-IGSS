import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Reiniciando base de datos...");

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
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE;`));
      console.log(`Truncated ${table}`);
    } catch (e: any) {
      console.log(`Error truncating ${table}:`, e.message);
    }
  }

  try {
    await db.execute(sql`
      UPDATE presupuesto_renglones 
      SET 
        saldo_presupuestario = COALESCE(saldo_presupuestario, saldo_disponible),
        pre_compromiso = 0,
        compromiso = 0,
        devengado = 0,
        saldo_disponible = COALESCE(saldo_presupuestario, saldo_disponible)
    `);
    console.log("Reset presupuesto_renglones balances to 0");
  } catch (e: any) {
    console.log("Error resetting presupuesto_renglones:", e.message);
  }

  try {
    await db.execute(sql`UPDATE siaf_seq SET valor = 1`);
    console.log("Reset SIAF sequence to 1");
  } catch (e: any) {
    console.log("Error resetting siaf sequence:", e.message);
  }

  console.log("Reinicio de base de datos completado.");
  process.exit(0);
}

main().catch(console.error);
