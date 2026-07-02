import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // 1. Columnas nuevas en consolidaciones (excepto oferente_ganador_id, que depende de oferentes)
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS rechazado_por INTEGER REFERENCES usuarios(id)`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS rechazado_en TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS enviado_a_junta_por INTEGER REFERENCES usuarios(id)`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS enviado_a_junta_en TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS numero_cheque TEXT`;
  console.log("✓ Columnas nuevas en consolidaciones");

  // 2. Cotizaciones de servicio (sin dependencia de oferentes)
  await sql`
    CREATE TABLE IF NOT EXISTS cotizaciones_servicio (
      id                         SERIAL PRIMARY KEY,
      fecha                      TEXT NOT NULL,
      proveedor_id               INTEGER,
      proveedor_nit              TEXT,
      proveedor_nombre           TEXT NOT NULL,
      servicio                   TEXT NOT NULL,
      costo                      DOUBLE PRECISION NOT NULL,
      exento_iva                 BOOLEAN NOT NULL DEFAULT false,
      usado_en_consolidacion_id  INTEGER,
      usado                      BOOLEAN NOT NULL DEFAULT false,
      creado_por                 INTEGER REFERENCES usuarios(id),
      created_at                 TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla cotizaciones_servicio creada");

  // 3. Oferentes (referencia consolidaciones, proveedores y cotizaciones_servicio)
  await sql`
    CREATE TABLE IF NOT EXISTS oferentes (
      id                      SERIAL PRIMARY KEY,
      consolidacion_id        INTEGER NOT NULL REFERENCES consolidaciones(id) ON DELETE CASCADE,
      proveedor_id            INTEGER,
      cotizacion_servicio_id  INTEGER REFERENCES cotizaciones_servicio(id),
      nit                     TEXT NOT NULL,
      nombre                  TEXT NOT NULL,
      costo                   DOUBLE PRECISION NOT NULL,
      exento_iva              BOOLEAN NOT NULL DEFAULT false,
      orden                   INTEGER NOT NULL DEFAULT 0,
      creado_por              INTEGER REFERENCES usuarios(id),
      created_at              TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla oferentes creada");

  // 4. oferente_ganador_id en consolidaciones — después de crear oferentes
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS oferente_ganador_id INTEGER REFERENCES oferentes(id)`;
  console.log("✓ Columna oferente_ganador_id en consolidaciones");

  // 5. Acta de Negociación — plantilla fija por año
  await sql`
    CREATE TABLE IF NOT EXISTS actas_negociacion (
      id               SERIAL PRIMARY KEY,
      anio             INTEGER NOT NULL UNIQUE,
      contenido        TEXT,
      archivo_url      TEXT,
      actualizado_por  INTEGER REFERENCES usuarios(id),
      updated_at       TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ Tabla actas_negociacion creada");

  console.log("\n¡Listo!");
}

main().catch(console.error);
