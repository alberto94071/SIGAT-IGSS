/**
 * Importa PAC 2026 a base_datos_central, catalogo_compras y presupuesto_renglones.
 * Ejecutar: DATABASE_URL=... node scripts/import-pac.mjs
 */
import { neon } from "@neondatabase/serverless";
import { createReadStream } from "fs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pacData = JSON.parse(readFileSync(join(__dirname, "pac-data.json"), "utf-8"));

const sql = neon(process.env.DATABASE_URL);

async function batch(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size), i);
  }
}

async function main() {
  console.log("Conectando a Neon...");
  await sql`SELECT 1`;
  console.log("Conexión OK\n");

  // ── 1. Crear tabla si no existe ──────────────────────────────────────────
  console.log("Verificando tabla presupuesto_renglones...");
  await sql`
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
  `;
  console.log("Tabla OK\n");

  // ── 2. Presupuesto renglones (99 filas) ──────────────────────────────────
  console.log("Importando presupuesto_renglones...");
  await sql`TRUNCATE presupuesto_renglones RESTART IDENTITY`;
  await batch(pacData.presupuesto, 50, async (chunk) => {
    const values = chunk.map(r =>
      `(2026, ${r.pg ? `'${r.pg.replace(/'/g,"''")}'` : "NULL"}, ` +
      `${r.sub ? `'${r.sub.replace(/'/g,"''")}'` : "NULL"}, ` +
      `${r.ren}, '${r.nom.replace(/'/g,"''")}', ` +
      `${r.vig}, ${r.mod}, ${r.pre})`
    ).join(",\n");
    await sql.unsafe(`INSERT INTO presupuesto_renglones
      (ejercicio_fiscal, pg_spg_py_act_ob, subproducto, renglon, nombre, vigente, modificado, presupuesto)
      VALUES ${values}`);
  });
  console.log(`  ✓ ${pacData.presupuesto.length} renglones insertados\n`);

  // ── 3. Base de datos central (579 únicos, skip existentes) ───────────────
  console.log("Importando base_datos_central...");
  const existing = await sql`SELECT codigo_ppr FROM base_datos_central WHERE codigo_ppr IS NOT NULL`;
  const existingPpr = new Set(existing.map(r => r.codigo_ppr));
  const newBdc = pacData.bdc.filter(r => !existingPpr.has(r.ppr));
  console.log(`  ${existingPpr.size} ya existentes, insertando ${newBdc.length} nuevos...`);
  let bdcCount = 0;
  await batch(newBdc, 50, async (chunk) => {
    if (chunk.length === 0) return;
    const values = chunk.map(r => {
      const nom = r.nombre.replace(/'/g, "''");
      const car = (r.caract || "").replace(/'/g, "''");
      const pre = (r.present || "").replace(/'/g, "''");
      return `(${r.ppr}, '${nom}', ${car ? `'${car}'` : "NULL"}, ${pre ? `'${pre}'` : "NULL"}, ${r.ren}, true)`;
    }).join(",\n");
    await sql.unsafe(`INSERT INTO base_datos_central
      (codigo_ppr, nombre, caracteristicas, presentacion, renglon, activo)
      VALUES ${values}`);
    bdcCount += chunk.length;
  });
  console.log(`  ✓ ${bdcCount} insumos insertados en base_datos_central\n`);

  // ── 4. Catálogo de compras (1404 filas) ──────────────────────────────────
  console.log("Importando catalogo_compras...");
  await sql`DELETE FROM catalogo_compras WHERE codigo_igss IS NULL AND codigo_ppr IS NOT NULL`;
  let ccCount = 0;
  await batch(pacData.cc, 50, async (chunk) => {
    const values = chunk.map(r => {
      const nom = r.nombre.replace(/'/g, "''");
      const car = (r.caract || "").replace(/'/g, "''");
      const pre = (r.present || "").replace(/'/g, "''");
      const sub = (r.sub || "").replace(/'/g, "''");
      return `('${r.ppr}', '${nom}', ${car ? `'${car}'` : "NULL"}, ${pre ? `'${pre}'` : "NULL"}, '${sub}', ${r.cant}, true)`;
    }).join(",\n");
    await sql.unsafe(`INSERT INTO catalogo_compras
      (codigo_ppr, nombre, caracteristicas, presentacion, subproducto, cantidad, activo)
      VALUES ${values}`);
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

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
