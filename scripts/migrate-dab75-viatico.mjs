import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_encargado_unidad TEXT NOT NULL DEFAULT 'Lilia Zucely Pérez Fuentes'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS cargo_encargado_unidad TEXT NOT NULL DEFAULT 'Analista "A" con funciones de Encargada de Unidad'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS entidad_recibio_viatico TEXT NOT NULL DEFAULT 'IGSS U.I.A.A.D.D.M. en el Municipio de Tejutla'`;
  console.log("✓ Columnas nuevas en configuracion");

  await sql`
    CREATE TABLE IF NOT EXISTS requisiciones_bodega (
      id                    SERIAL PRIMARY KEY,
      no_pedido             TEXT NOT NULL,
      fecha_emision         TEXT NOT NULL,
      clave_administrativa  TEXT NOT NULL,
      sala_servicio         TEXT NOT NULL,
      bodega                TEXT NOT NULL,
      fecha_despacho        TEXT,
      solicita_nombre       TEXT NOT NULL,
      solicita_no_empleado  TEXT NOT NULL,
      solicita_cargo        TEXT NOT NULL,
      entrega_nombre        TEXT,
      entrega_no_empleado   TEXT,
      entrega_cargo         TEXT,
      recibe_nombre         TEXT,
      recibe_no_empleado    TEXT,
      recibe_cargo          TEXT,
      director_nombre       TEXT,
      creado_por            INTEGER REFERENCES usuarios(id),
      created_at            TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla requisiciones_bodega");

  await sql`
    CREATE TABLE IF NOT EXISTS requisicion_bodega_items (
      id                  SERIAL PRIMARY KEY,
      requisicion_id      INTEGER NOT NULL REFERENCES requisiciones_bodega(id) ON DELETE CASCADE,
      codigo              TEXT NOT NULL,
      nombre              TEXT NOT NULL,
      cantidad_solicitada DOUBLE PRECISION NOT NULL,
      orden               INTEGER NOT NULL DEFAULT 0
    )
  `;
  console.log("✓ Tabla requisicion_bodega_items");

  await sql`
    CREATE TABLE IF NOT EXISTS viatico_liquidaciones (
      id                       SERIAL PRIMARY KEY,
      comisiones_json          TEXT NOT NULL DEFAULT '[]',
      dias                     INTEGER NOT NULL DEFAULT 0,
      gasto_desayuno           DOUBLE PRECISION,
      gasto_almuerzo           DOUBLE PRECISION,
      gasto_cena               DOUBLE PRECISION,
      gasto_hospedaje          DOUBLE PRECISION,
      otros_gastos             DOUBLE PRECISION NOT NULL DEFAULT 0,
      recibido_va_no           TEXT,
      recibido_va_monto        DOUBLE PRECISION,
      reintegro                DOUBLE PRECISION,
      complemento              DOUBLE PRECISION,
      forma_pago               TEXT,
      fecha_pago               TEXT,
      persona_nombre           TEXT NOT NULL,
      persona_nit              TEXT NOT NULL,
      persona_cargo            TEXT NOT NULL,
      persona_grupo            TEXT,
      persona_no_empleado      TEXT NOT NULL,
      persona_sueldo           DOUBLE PRECISION,
      persona_categoria_puesto TEXT,
      partida_presupuestaria   TEXT,
      nombramiento_numero      TEXT,
      fecha_nombramiento       TEXT,
      creado_por               INTEGER REFERENCES usuarios(id),
      created_at               TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla viatico_liquidaciones");

  console.log("\n¡Listo!");
}

main().catch(console.error);
