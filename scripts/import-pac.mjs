/**
 * Importa PAC 2026 a base_datos_central, catalogo_compras y presupuesto_renglones.
 * Ejecutar: DATABASE_URL=... node scripts/import-pac.mjs
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  pgTable, serial, integer, text, doublePrecision, boolean
} from "drizzle-orm/pg-core";
import { sql as drizzleSql } from "drizzle-orm";

// ── Definiciones de tabla (inline para evitar TSX) ───────────────────────────
const baseDatosCentral = pgTable("base_datos_central", {
  id:              serial("id").primaryKey(),
  codigo_igss:     integer("codigo_igss"),
  codigo_ppr:      integer("codigo_ppr"),
  nombre:          text("nombre").notNull(),
  caracteristicas: text("caracteristicas"),
  presentacion:    text("presentacion"),
  renglon:         integer("renglon"),
  activo:          boolean("activo").notNull().default(true),
});

const catalogoCompras = pgTable("catalogo_compras", {
  id:              serial("id").primaryKey(),
  codigo_igss:     integer("codigo_igss"),
  codigo_ppr:      text("codigo_ppr"),
  codigo_rango:    text("codigo_rango"),
  nombre:          text("nombre").notNull(),
  caracteristicas: text("caracteristicas"),
  presentacion:    text("presentacion"),
  unidad_medida:   text("unidad_medida"),
  subproducto:     text("subproducto").notNull(),
  cantidad:        doublePrecision("cantidad"),
  activo:          boolean("activo").notNull().default(true),
});

const presupuestoRenglones = pgTable("presupuesto_renglones", {
  id:                    serial("id").primaryKey(),
  ejercicio_fiscal:      integer("ejercicio_fiscal").notNull().default(2026),
  pg_spg_py_act_ob:      text("pg_spg_py_act_ob"),
  subproducto:           text("subproducto"),
  renglon:               integer("renglon").notNull(),
  nombre:                text("nombre").notNull(),
  vigente:               doublePrecision("vigente").default(0),
  modificado:            doublePrecision("modificado").default(0),
  presupuesto:           doublePrecision("presupuesto").default(0),
  pre_compromiso:        doublePrecision("pre_compromiso").default(0),
  compromiso:            doublePrecision("compromiso").default(0),
  devengado:             doublePrecision("devengado").default(0),
  saldo_presupuestario:  doublePrecision("saldo_presupuestario").default(0),
  saldo_disponible:      doublePrecision("saldo_disponible").default(0),
});

// ── Setup ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const pacData = JSON.parse(readFileSync(join(__dirname, "pac-data.json"), "utf-8"));

const neonSql = neon(process.env.DATABASE_URL);
const db = drizzle(neonSql);

async function batch(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size), i);
  }
}

async function main() {
  console.log("Conectando a Neon...");
  await neonSql`SELECT 1`;
  console.log("Conexión OK\n");

  // ── 1. Agregar columna codigo_rango si no existe ──────────────────────────
  console.log("Verificando columnas codigo_rango...");
  await db.execute(drizzleSql`ALTER TABLE base_datos_central ADD COLUMN IF NOT EXISTS codigo_rango TEXT`);
  await db.execute(drizzleSql`ALTER TABLE catalogo_compras   ADD COLUMN IF NOT EXISTS codigo_rango TEXT`);
  console.log("Columnas OK\n");

  // ── 2. Crear tabla presupuesto_renglones si no existe ─────────────────────
  console.log("Verificando tabla presupuesto_renglones...");
  await db.execute(drizzleSql`
    CREATE TABLE IF NOT EXISTS presupuesto_renglones (
      id                   SERIAL PRIMARY KEY,
      ejercicio_fiscal     INTEGER NOT NULL DEFAULT 2026,
      pg_spg_py_act_ob     TEXT,
      subproducto          TEXT,
      renglon              INTEGER NOT NULL,
      nombre               TEXT NOT NULL,
      vigente              DOUBLE PRECISION DEFAULT 0,
      modificado           DOUBLE PRECISION DEFAULT 0,
      presupuesto          DOUBLE PRECISION DEFAULT 0,
      pre_compromiso       DOUBLE PRECISION DEFAULT 0,
      compromiso           DOUBLE PRECISION DEFAULT 0,
      devengado            DOUBLE PRECISION DEFAULT 0,
      saldo_presupuestario DOUBLE PRECISION DEFAULT 0,
      saldo_disponible     DOUBLE PRECISION DEFAULT 0,
      created_at           TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      updated_at           TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    )
  `);
  console.log("Tabla OK\n");

  // ── 3. Presupuesto renglones ──────────────────────────────────────────────
  console.log("Importando presupuesto_renglones...");
  await db.execute(drizzleSql`TRUNCATE presupuesto_renglones RESTART IDENTITY`);
  await batch(pacData.presupuesto, 50, async (chunk) => {
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
  });
  console.log(`  ✓ ${pacData.presupuesto.length} renglones insertados\n`);

  // ── 4. Base de datos central ──────────────────────────────────────────────
  console.log("Importando base_datos_central...");
  const existing = await db.execute(drizzleSql`SELECT codigo_ppr FROM base_datos_central WHERE codigo_ppr IS NOT NULL`);
  const existingPpr = new Set(existing.rows.map((r) => r.codigo_ppr));
  const newBdc = pacData.bdc.filter((r) => !existingPpr.has(r.ppr));
  console.log(`  ${existingPpr.size} ya existentes, insertando ${newBdc.length} nuevos...`);
  let bdcCount = 0;
  await batch(newBdc, 50, async (chunk) => {
    if (chunk.length === 0) return;
    await db.insert(baseDatosCentral).values(
      chunk.map((r) => ({
        codigo_ppr:      r.ppr,
        codigo_rango:    r.rango || null,
        nombre:          r.nombre,
        caracteristicas: r.caract || null,
        presentacion:    r.present || null,
        renglon:         r.ren,
        activo:          true,
      }))
    );
    bdcCount += chunk.length;
  });
  console.log(`  ✓ ${bdcCount} insumos insertados en base_datos_central\n`);

  // ── 5. Catálogo de compras ────────────────────────────────────────────────
  console.log("Importando catalogo_compras...");
  await db.execute(drizzleSql`DELETE FROM catalogo_compras WHERE codigo_igss IS NULL AND codigo_ppr IS NOT NULL`);
  let ccCount = 0;
  await batch(pacData.cc, 50, async (chunk) => {
    await db.insert(catalogoCompras).values(
      chunk.map((r) => ({
        codigo_ppr:      String(r.ppr),
        codigo_rango:    r.rango || null,
        nombre:          r.nombre,
        caracteristicas: r.caract || null,
        presentacion:    r.present || null,
        subproducto:     r.sub,
        cantidad:        r.cant,
        activo:          true,
      }))
    );
    ccCount += chunk.length;
  });
  console.log(`  ✓ ${ccCount} filas insertadas en catalogo_compras\n`);

  console.log("═══════════════════════════════════════");
  console.log("✅ Importación completada exitosamente");
  console.log(`   presupuesto_renglones : ${pacData.presupuesto.length}`);
  console.log(`   base_datos_central    : ${bdcCount}`);
  console.log(`   catalogo_compras      : ${ccCount}`);
  console.log("═══════════════════════════════════════");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
