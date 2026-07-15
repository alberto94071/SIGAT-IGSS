import { NextResponse } from 'next/server';
import { db, sql } from '@/lib/db';

export async function GET() {
  try {
    // 1. Drop the existing constraint
    await db.execute(sql`ALTER TABLE siaf_compras_items DROP CONSTRAINT IF EXISTS "siaf_compras_items_catalogo_id_fkey"`);
    await db.execute(sql`ALTER TABLE siaf_compras_items DROP CONSTRAINT IF EXISTS "siaf_compras_items_catalogo_id_catalogo_compras_id_fk"`);

    // 2. Add the new constraint with ON DELETE SET NULL
    await db.execute(sql`ALTER TABLE siaf_compras_items ADD CONSTRAINT "siaf_compras_items_catalogo_id_fkey" FOREIGN KEY (catalogo_id) REFERENCES catalogo_compras(id) ON DELETE SET NULL`);

    // 3. Drop legacy columns from catalogo_compras
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS codigo_ppr`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS caracteristicas`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS presentacion`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS ug`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS cc`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS estructura_programatica`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS codigo_nombre_ppr`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS nombre_ppr`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS codigo_presentacion_ppr`);
    await db.execute(sql`ALTER TABLE catalogo_compras DROP COLUMN IF EXISTS unidad_medida`);

    return NextResponse.json({ success: true, message: "Migration completed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
