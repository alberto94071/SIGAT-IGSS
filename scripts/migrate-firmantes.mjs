import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // Crear tabla firmantes
  await sql`
    CREATE TABLE IF NOT EXISTS catalogo_firmantes (
      id         SERIAL PRIMARY KEY,
      nombre     TEXT NOT NULL,
      cargo      TEXT NOT NULL,
      activo     BOOLEAN NOT NULL DEFAULT true,
      created_at TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `;
  console.log("✓ catalogo_firmantes creada");

  // Firmantes iniciales (del documento escaneado)
  await sql`
    INSERT INTO catalogo_firmantes (nombre, cargo) VALUES
      ('BERNON RAUL MIRANDA GONZALEZ', 'Analista "A"'),
      ('LICDA. LILIA ZUCELY PEREZ FUENTES', 'Analista "A"')
    ON CONFLICT DO NOTHING
  `;
  console.log("✓ Firmantes iniciales insertados");

  // Agregar columnas a configuracion si no existen
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_unidad_ejecutora TEXT NOT NULL DEFAULT 'UNIDAD EJECUTORA 407 CONSULTORIO DEL INSTITUTO EN SAN MARCOS'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS centro_costo_nombre TEXT NOT NULL DEFAULT 'CENTRO DE COSTO: 121009 UNIDAD INTEGRAL DE ADSCRIPCIÓN, ACREDITACIÓN DE DERECHOS Y DESPACHO DE MEDICAMENTOS EN EL MUNICIPIO DE TEJUTLA, SAN MARCOS'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS direccion_unidad TEXT NOT NULL DEFAULT '2ª. AVENIDA 4-54 ZONA 2 TEJUTLA, SAN MARCOS'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS justificacion_siaf TEXT NOT NULL DEFAULT 'SERVICIOS NECESARIOS E INDISPENSABLES PARA BRINDAR ATENCIÓN A LOS PACIENTES DEL IGSS U.I.A.A.D.D.M. EN EL MUNICIPIO DE TEJUTLA.'`;
  console.log("✓ Columnas agregadas a configuracion");

  console.log("\n¡Listo!");
}

main().catch(console.error);
