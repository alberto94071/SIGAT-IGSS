import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_yC2AmJswoXQ6@ep-winter-boat-atha96e8.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DB);

async function main() {
  console.log("Aplicando migraciones...");

  // Agregar precio_unitario al catálogo
  await sql`ALTER TABLE catalogo_insumos ADD COLUMN IF NOT EXISTS precio_unitario double precision`;
  console.log("✓ precio_unitario en catalogo_insumos");

  // Agregar tipo_documento a servicios
  await sql`ALTER TABLE servicios ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'SIAF'`;
  console.log("✓ tipo_documento en servicios");

  console.log("\nVaciando tablas operativas (manteniendo catálogo, usuarios y configuración)...");

  // Vaciamos en orden por las foreign keys
  await sql`TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE`;
  await sql`TRUNCATE TABLE caja_chica RESTART IDENTITY CASCADE`;
  await sql`TRUNCATE TABLE movimientos_banco RESTART IDENTITY CASCADE`;
  await sql`TRUNCATE TABLE pagos RESTART IDENTITY CASCADE`;
  await sql`TRUNCATE TABLE servicios RESTART IDENTITY CASCADE`;
  console.log("✓ Tablas operativas vaciadas");

  // Reiniciar secuencia SIAF a 0
  await sql`UPDATE siaf_seq SET valor = 0 WHERE id = 1`;
  console.log("✓ Secuencia SIAF reiniciada a 0");

  console.log("\n¡Todo listo! La base de datos está limpia.");
}

main().catch(console.error);
