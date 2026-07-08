import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // ─── Configuración: NIT del encargado de unidad y del solicitante ───────────
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS numero_empleado_encargado TEXT NOT NULL DEFAULT '35985'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nit_encargado_unidad TEXT NOT NULL DEFAULT '52392678'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nit_solicitante TEXT NOT NULL DEFAULT ''`;
  console.log("✓ Columnas nuevas en configuracion");

  // ─── Vales de Caja Chica: rediseño (tipo, autorización, cheque, liquidación) ─
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'pasajes'`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS monto_autorizado DOUBLE PRECISION`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS destinatario_cheque TEXT`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS numero_boleta_deposito TEXT`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS monto_boleta_deposito DOUBLE PRECISION`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS fecha_liquidacion TEXT`;
  await sql`ALTER TABLE vales_caja_chica ADD COLUMN IF NOT EXISTS monto_liquidado DOUBLE PRECISION`;
  // El cheque ahora se asigna después de autorizar, no al crear el vale.
  await sql`ALTER TABLE vales_caja_chica ALTER COLUMN numero_cheque DROP NOT NULL`;
  await sql`ALTER TABLE vales_caja_chica ALTER COLUMN fecha_emision DROP NOT NULL`;
  await sql`ALTER TABLE vales_caja_chica ALTER COLUMN fecha_entregado DROP NOT NULL`;
  await sql`ALTER TABLE vales_caja_chica ALTER COLUMN estado SET DEFAULT 'Pendiente autorización'`;
  console.log("✓ Columnas nuevas en vales_caja_chica");

  // ─── Póliza (Pago de Pasajes): consolida DPD-23 antes de asignar vale ───────
  await sql`
    CREATE TABLE IF NOT EXISTS polizas (
      id          SERIAL PRIMARY KEY,
      numero      INTEGER NOT NULL UNIQUE,
      fecha       TEXT NOT NULL,
      vale_id     INTEGER REFERENCES vales_caja_chica(id),
      total       DOUBLE PRECISION NOT NULL DEFAULT 0,
      estado      TEXT NOT NULL DEFAULT 'Generada',
      creado_por  INTEGER REFERENCES usuarios(id),
      created_at  TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla polizas");

  // ─── Pasajes: ligar cada pago a su póliza ────────────────────────────────────
  await sql`ALTER TABLE pasajes_pagos ADD COLUMN IF NOT EXISTS poliza_id INTEGER REFERENCES polizas(id)`;
  console.log("✓ Columna pasajes_pagos.poliza_id");

  // ─── SPS-75: motivo de rechazo (para editar y reenviar) ──────────────────────
  await sql`ALTER TABLE pasajes_solicitudes ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT`;
  console.log("✓ Columna pasajes_solicitudes.motivo_rechazo");

  console.log("\n¡Listo!");
}

main().catch(console.error);
