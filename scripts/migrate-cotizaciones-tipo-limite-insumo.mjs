import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  // ─── Cotizaciones Anuales: tipo (baja_cuantia | excepcion | contrato_abierto) ─
  await sql`ALTER TABLE cotizaciones_anuales ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'baja_cuantia'`;
  console.log("✓ Columna cotizaciones_anuales.tipo");

  await sql`ALTER TABLE cotizaciones_anuales_items ADD COLUMN IF NOT EXISTS nombre TEXT`;
  console.log("✓ Columna cotizaciones_anuales_items.nombre");

  await sql`
    UPDATE cotizaciones_anuales_items i
    SET nombre = c.nombre
    FROM catalogo_compras c
    WHERE i.codigo_igss = c.codigo_igss AND i.nombre IS NULL
  `;
  console.log("✓ Backfill de nombre en cotizaciones_anuales_items existentes");

  // ─── SIAF Compras Items: snapshot de precio al adjudicar (Baja Cuantía) ──────
  // Base del control de Q25,000 por insumo por cuatrimestre.
  await sql`ALTER TABLE siaf_compras_items ADD COLUMN IF NOT EXISTS precio_unitario DOUBLE PRECISION`;
  await sql`ALTER TABLE siaf_compras_items ADD COLUMN IF NOT EXISTS item_exento_iva BOOLEAN`;
  await sql`ALTER TABLE siaf_compras_items ADD COLUMN IF NOT EXISTS monto_neto DOUBLE PRECISION`;
  console.log("✓ Columnas de precio en siaf_compras_items");

  console.log("\n¡Listo!");
}

main().catch(console.error);
