import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nit_responsable TEXT NOT NULL DEFAULT '18864325'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_dependencia_medica TEXT NOT NULL DEFAULT 'Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos, en el Municipio de Tejutla'`;
  console.log("✓ Columnas nuevas en configuracion");

  await sql`
    CREATE TABLE IF NOT EXISTS vales_caja_chica (
      id                            SERIAL PRIMARY KEY,
      numero                        INTEGER NOT NULL,
      fecha                         TEXT NOT NULL,
      monto                         DOUBLE PRECISION NOT NULL,
      motivo                        TEXT NOT NULL,
      solicitante_nombre            TEXT NOT NULL,
      solicitante_numero_empleado   TEXT NOT NULL,
      solicitante_nit               TEXT NOT NULL,
      jefe_nombre                   TEXT NOT NULL,
      jefe_numero_empleado          TEXT NOT NULL,
      jefe_nit                      TEXT NOT NULL,
      numero_cheque                 TEXT NOT NULL,
      fecha_emision                 TEXT NOT NULL,
      fecha_entregado               TEXT NOT NULL,
      creado_por                    INTEGER REFERENCES usuarios(id),
      created_at                    TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla vales_caja_chica");

  console.log("\n¡Listo!");
}

main().catch(console.error);
