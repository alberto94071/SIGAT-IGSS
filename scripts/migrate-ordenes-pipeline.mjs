import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS codigo_ppr TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_notificacion_proveedor TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS no_compromiso TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_ingreso_producto TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS no_factura TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS serie_factura TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_emision TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS lote TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS fecha_vencimiento TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS marca TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS modelo TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS serie TEXT`;
  await sql`ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS no_devengado TEXT`;
  console.log("✓ Columnas del pipeline Ordenes → Compromiso → Devengado → DAB-60 en ordenes_compra");

  console.log("\n¡Listo!");
}

main().catch(console.error);
