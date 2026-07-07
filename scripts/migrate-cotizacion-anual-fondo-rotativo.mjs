import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS cotizaciones_anuales (
      id                SERIAL PRIMARY KEY,
      numero            TEXT NOT NULL UNIQUE,
      anio              INTEGER NOT NULL,
      proveedor_id      INTEGER,
      proveedor_nit     TEXT,
      proveedor_nombre  TEXT NOT NULL,
      fecha             TEXT NOT NULL,
      creado_por        INTEGER REFERENCES usuarios(id),
      created_at        TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla cotizaciones_anuales");

  await sql`
    CREATE TABLE IF NOT EXISTS cotizaciones_anuales_items (
      id                    SERIAL PRIMARY KEY,
      cotizacion_anual_id   INTEGER NOT NULL REFERENCES cotizaciones_anuales(id) ON DELETE CASCADE,
      codigo_igss           TEXT NOT NULL,
      precio_unitario       DOUBLE PRECISION NOT NULL,
      exento_iva            BOOLEAN NOT NULL DEFAULT false
    )
  `;
  console.log("✓ Tabla cotizaciones_anuales_items");

  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS cotizacion_anual_id INTEGER`;
  console.log("✓ Columna consolidaciones.cotizacion_anual_id");

  await sql`
    CREATE TABLE IF NOT EXISTS fondo_rotativo_pagos (
      id                     SERIAL PRIMARY KEY,
      consolidacion_id       INTEGER NOT NULL UNIQUE REFERENCES consolidaciones(id),
      no_factura             TEXT NOT NULL,
      serie_factura          TEXT NOT NULL,
      fecha_emision_factura  TEXT NOT NULL,
      forma_pago             TEXT,
      numero_cheque          TEXT,
      fecha_emision_cheque   TEXT,
      destinatario_nombre    TEXT,
      fecha_pago             TEXT,
      numero_vale            TEXT,
      estado                 TEXT NOT NULL DEFAULT 'Pendiente forma de pago',
      creado_por             INTEGER REFERENCES usuarios(id),
      created_at             TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla fondo_rotativo_pagos");

  console.log("\n¡Listo!");
}

main().catch(console.error);
