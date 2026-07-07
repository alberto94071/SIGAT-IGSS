import { neon } from "@neondatabase/serverless";

const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL no definida");
const sql = neon(DB);

async function main() {
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS proveedor_direccion TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS proveedor_telefono TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_fecha TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_dte_numero TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_dte_serie TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_dte_fecha TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_no_pedido TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_descripcion TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_unidad_medida TEXT`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS a04_cantidad DOUBLE PRECISION`;
  await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS monto_bruto DOUBLE PRECISION`;
  console.log("✓ Columnas de la Forma A-04 SIAF en consolidaciones");

  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_analista_presupuesto TEXT NOT NULL DEFAULT 'Ener Ivandrino Vásquez Barrios'`;
  await sql`ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS nombre_director TEXT NOT NULL DEFAULT 'Kareen Marisol Guevara Orozco'`;
  console.log("✓ Columnas de firmantes A-04 en configuracion");

  console.log("\n¡Listo!");
}

main().catch(console.error);
