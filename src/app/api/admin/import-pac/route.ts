"use server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { baseDatosCentral, catalogoCompras, presupuestoRenglones } from "@/lib/schema";
import { sql } from "drizzle-orm";
import pacData from "../../../../../scripts/pac-data.json";

// POST /api/admin/import-pac
// Solo superadmin. Ejecutar una vez para cargar el PAC 2026 y presupuesto.
export async function POST() {
  const session = await auth();
  if (!session || (session.user as any).rol !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const results: Record<string, number> = {};

  // ── 1. Presupuesto renglones ──────────────────────────────────────────────
  await db.execute(sql`TRUNCATE presupuesto_renglones RESTART IDENTITY`);
  const BATCH = 50;
  for (let i = 0; i < pacData.presupuesto.length; i += BATCH) {
    const chunk = pacData.presupuesto.slice(i, i + BATCH);
    await db.insert(presupuestoRenglones).values(
      chunk.map((r) => ({
        ejercicio_fiscal: 2026,
        pg_spg_py_act_ob: r.pg || null,
        subproducto:      r.sub || null,
        renglon:          r.ren,
        nombre:           r.nom,
        vigente:          r.vig,
        modificado:       r.mod,
        presupuesto:      r.pre,
      }))
    );
  }
  results.presupuesto_renglones = pacData.presupuesto.length;

  // ── 2. Base de datos central (skip duplicados por codigo_ppr) ────────────
  const existingPpr = await db
    .select({ ppr: baseDatosCentral.codigo_ppr })
    .from(baseDatosCentral);
  const existingSet = new Set(existingPpr.map((r) => r.ppr));

  const newBdc = pacData.bdc.filter((r) => !existingSet.has(r.ppr));
  let bdcInserted = 0;
  for (let i = 0; i < newBdc.length; i += BATCH) {
    const chunk = newBdc.slice(i, i + BATCH);
    await db.insert(baseDatosCentral).values(
      chunk.map((r) => ({
        codigo_ppr:      r.ppr,
        nombre:          r.nombre,
        caracteristicas: r.caract || null,
        presentacion:    r.present || null,
        renglon:         r.ren,
        activo:          true,
      }))
    );
    bdcInserted += chunk.length;
  }
  results.base_datos_central = bdcInserted;

  // ── 3. Catálogo de compras ────────────────────────────────────────────────
  // Limpiar primero los registros que vengan del PAC (por si se re-ejecuta)
  await db.execute(sql`DELETE FROM catalogo_compras WHERE codigo_ppr IS NOT NULL AND codigo_igss IS NULL`);
  let ccInserted = 0;
  for (let i = 0; i < pacData.cc.length; i += BATCH) {
    const chunk = pacData.cc.slice(i, i + BATCH);
    const rows = chunk.map((r) => ({
      codigo_ppr:      String(r.ppr),
      nombre:          r.nombre,
      caracteristicas: r.caract || null,
      presentacion:    r.present || null,
      subproducto:     r.sub,
      cantidad:        r.cant,
      activo:          true,
    }));
    await db.insert(catalogoCompras).values(rows);
    ccInserted += rows.length;
  }
  results.catalogo_compras = ccInserted;

  return NextResponse.json({
    ok: true,
    message: "Importación completada",
    results,
  });
}
