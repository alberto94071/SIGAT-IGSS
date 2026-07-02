/**
 * Seed: PAC 2026 Tacana → catalogo_compras
 * Vacía la tabla y carga el Excel completo.
 * Ejecutar: DATABASE_URL="..." node scripts/seed-catalogo-pac2026.mjs
 */
import { neon } from "@neondatabase/serverless";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import path from "path";

const sql = neon(process.env.DATABASE_URL);

const EXCEL_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "Users",
  "elvis.rodriguez",
  "Downloads",
  "PAC PARA CIP 2026 TACANA.xlsx"
);

const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const headers = rows[0];
const data = rows.slice(1).filter(r => r.length > 0 && r[4]); // requiere nombre

console.log(`📄 ${data.length} filas a cargar...`);

// Vaciar tabla
await sql`TRUNCATE catalogo_compras RESTART IDENTITY CASCADE`;
console.log("🗑️  catalogo_compras vaciada.");

// Insertar en lotes de 100
const BATCH = 100;
let inserted = 0;

for (let i = 0; i < data.length; i += BATCH) {
  const batch = data.slice(i, i + BATCH);

  for (const row of batch) {
    await sql`
      INSERT INTO catalogo_compras
        (ug, cc, estructura_programatica, codigo_igss, nombre,
         codigo_nombre_ppr, nombre_ppr, codigo_presentacion_ppr,
         unidad_medida, renglon, subproducto, cantidad,
         precio_estimado, monto, activo)
      VALUES
        (${row[0] ?? null}, ${row[1] ?? null}, ${row[2] ?? null},
         ${row[3] ?? null}, ${(row[4] ?? "").toString().trim()},
         ${row[5] ?? null}, ${row[6] ?? null}, ${row[7] ?? null},
         ${(row[8] ?? "").toString().trim()},
         ${row[9] ?? null}, ${(row[10] ?? "").toString().trim()},
         ${row[11] ?? null}, ${row[12] ?? null}, ${row[13] ?? null},
         true)
    `;
    inserted++;
  }
  console.log(`   → ${Math.min(i + BATCH, data.length)}/${data.length} filas`);
}

console.log(`✅ ${inserted} insumos cargados en catalogo_compras.`);
process.exit(0);
