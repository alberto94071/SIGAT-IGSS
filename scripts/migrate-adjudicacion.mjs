import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB);

// Ampliar tabla consolidaciones
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS tipo_compra TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'Pendiente adjudicación'`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS nog TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS fecha_evento TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS referencia TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS costo_unitario DOUBLE PRECISION`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS exento_iva BOOLEAN NOT NULL DEFAULT FALSE`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS total DOUBLE PRECISION`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS proveedor_id INTEGER`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS proveedor_nit TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS proveedor_nombre TEXT`;

// Crear tabla ordenes_compra
await sql`
  CREATE TABLE IF NOT EXISTS ordenes_compra (
    id               SERIAL PRIMARY KEY,
    numero           INTEGER NOT NULL,
    anio             INTEGER NOT NULL,
    fecha            TEXT NOT NULL,
    consolidacion_id INTEGER NOT NULL,
    tipo_compra      TEXT NOT NULL,
    nog              TEXT,
    referencia       TEXT,
    proveedor_id     INTEGER,
    proveedor_nit    TEXT,
    proveedor_nombre TEXT,
    costo_unitario   DOUBLE PRECISION,
    total_cantidad   DOUBLE PRECISION,
    exento_iva       BOOLEAN NOT NULL DEFAULT FALSE,
    total            DOUBLE PRECISION,
    estado           TEXT NOT NULL DEFAULT 'Activa',
    creado_por       INTEGER,
    created_at       TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  )
`;

// Estado de siaf_compras puede ser "Orden de Compra" — no requiere cambio de esquema

console.log("✅ Migración adjudicación completada.");
process.exit(0);
