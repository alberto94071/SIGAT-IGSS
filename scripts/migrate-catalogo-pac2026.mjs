import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// 1. Cambiar codigo_igss de INTEGER a TEXT en catalogo_compras
await sql`ALTER TABLE catalogo_compras ALTER COLUMN codigo_igss TYPE TEXT USING codigo_igss::text`;

// 2. Cambiar codigo_igss de INTEGER a TEXT en siaf_compras_items
await sql`ALTER TABLE siaf_compras_items ALTER COLUMN codigo_igss TYPE TEXT USING codigo_igss::text`;

// 3. Agregar columnas nuevas del PAC
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS ug INTEGER`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS cc INTEGER`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS estructura_programatica TEXT`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS codigo_nombre_ppr INTEGER`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS nombre_ppr TEXT`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS codigo_presentacion_ppr INTEGER`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS renglon INTEGER`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS precio_estimado DOUBLE PRECISION`;
await sql`ALTER TABLE catalogo_compras ADD COLUMN IF NOT EXISTS monto DOUBLE PRECISION`;

console.log("✅ Migración catalogo PAC 2026 completada.");
process.exit(0);
