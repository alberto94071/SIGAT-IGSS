import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'Pendiente'`;
  console.log("✓ Columna vales_caja_chica.estado");

  await sql`ALTER TABLE fondo_rotativo_pagos ADD COLUMN IF NOT EXISTS vale_id INTEGER REFERENCES vales_caja_chica(id)`;
  console.log("✓ Columna fondo_rotativo_pagos.vale_id");

  // Los pagos en efectivo que ya existían con el estado viejo ("Enviado a
  // Libro Caja Chica") representaban un pago ya asentado — equivalen al nuevo
  // estado terminal "Liquidado".
  await sql`UPDATE fondo_rotativo_pagos SET estado = 'Liquidado' WHERE estado = 'Enviado a Libro Caja Chica'`;
  console.log("✓ Migrados pagos con estado 'Enviado a Libro Caja Chica' -> 'Liquidado'");

  console.log("\n¡Listo!");
}

main().catch(console.error);
