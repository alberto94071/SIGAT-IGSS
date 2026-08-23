// Reimportación de Base de Datos Central desde el Excel limpio que el cliente
// preparó ("CODIGOS_INSUMOS_BASE_DE_DATOS_CENTRAL_SOLO_CODIGOS_IGSS.xlsx",
// hoja "Homologaciones", 6 columnas: Renglon, Codigo, Descripcion, PpR,
// Nombre/Caracteristicas, Presentación/Unidad de Medida).
//
// Reemplaza por completo el import anterior (import-homologados.mjs), que
// traía "codigo_ppr" como un número pequeño (1, 2, 3...) de la columna 4 del
// Excel viejo — el cliente confirmó que ese mapeo estaba mal: el código PPR
// correcto es el de formato "número - número" (columna "PpR" de este Excel
// nuevo), que además es único en el 100% de las filas (a diferencia del
// código IGSS real, que solo existe en ~15% del catálogo).
//
// También elimina la columna `codigo` (duplicada de `codigo_igss` — el Excel
// nuevo ya no tiene esa ambigüedad, un solo campo de código real alcanza).
//
// CommonJS (no .mjs): la build ESM de la librería `xlsx` (xlsx.mjs) falla
// con "Cannot access file" al leer este archivo de 15MB bajo `import`; con
// `require()` (CJS) lee sin problema — bug de esa build, no del archivo.
const { neon } = require("@neondatabase/serverless");
const XLSX = require("xlsx");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Falta DATABASE_URL (¿olvidaste 'source .env.local'?)");
const sql = neon(DATABASE_URL);

const ARCHIVO = process.argv[2];
if (!ARCHIVO) throw new Error("Uso: node import-base-datos-central-v2.cjs <archivo.xlsx>");

function limpia(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function main() {
  console.log("📖 Leyendo Excel...");
  const wb = XLSX.readFile(ARCHIVO);
  const hoja = wb.Sheets["Homologaciones"];
  if (!hoja) throw new Error("No se encontró la hoja 'Homologaciones'");
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });
  console.log(`✓ ${filas.length - 1} filas de datos leídas`);

  const registros = [];
  for (let i = 1; i < filas.length; i++) {
    const row = filas[i];
    if (!row || row.length === 0) continue;

    const renglonRaw = row[0];
    const renglon = renglonRaw !== null && renglonRaw !== "" && !isNaN(Number(renglonRaw)) ? Number(renglonRaw) : null;
    const codigo_igss = limpia(row[1]);
    const descripcion_igss = limpia(row[2]);
    const codigo_ppr = limpia(row[3]);
    const nombreCaract = limpia(row[4]) ?? "";
    const presentacionUm = limpia(row[5]) ?? "";

    if (!codigo_ppr) continue; // el PPR es la clave única — sin él no hay fila válida
    if (!nombreCaract) continue;

    const idxPuntoComa = nombreCaract.indexOf(";");
    const nombre = (idxPuntoComa === -1 ? nombreCaract : nombreCaract.slice(0, idxPuntoComa)).trim();
    const caracteristicas = idxPuntoComa === -1 ? null : nombreCaract.slice(idxPuntoComa + 1).trim() || null;
    if (!nombre) continue;

    const idxSlash = presentacionUm.indexOf("/");
    const presentacion = (idxSlash === -1 ? presentacionUm : presentacionUm.slice(0, idxSlash)).trim() || null;
    const unidad_medida = idxSlash === -1 ? null : presentacionUm.slice(idxSlash + 1).trim() || null;

    registros.push({ renglon, codigo_igss, descripcion_igss, codigo_ppr, nombre, caracteristicas, presentacion, unidad_medida });
  }
  console.log(`✓ ${registros.length} registros válidos para insertar`);
  console.log(`  (muestra de codigo_ppr: "${registros[0].codigo_ppr}")`);

  console.log("🛠️  Migrando esquema de base_datos_central...");
  await sql("ALTER TABLE base_datos_central ALTER COLUMN codigo_ppr TYPE text USING codigo_ppr::text", []);
  await sql("ALTER TABLE base_datos_central DROP COLUMN IF EXISTS codigo", []);

  console.log("🗑️  Vaciando base_datos_central...");
  await sql("TRUNCATE TABLE base_datos_central RESTART IDENTITY CASCADE", []);

  console.log("📥 Insertando en lotes...");
  const BATCH = 500;
  let insertados = 0;
  for (let i = 0; i < registros.length; i += BATCH) {
    const chunk = registros.slice(i, i + BATCH);
    const valuesSql = chunk.map((_, j) => {
      const b = j * 8;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
    }).join(",");
    const params = chunk.flatMap(r => [r.renglon, r.codigo_igss, r.descripcion_igss, r.codigo_ppr, r.nombre, r.caracteristicas, r.presentacion, r.unidad_medida]);
    await sql(
      `INSERT INTO base_datos_central (renglon, codigo_igss, descripcion_igss, codigo_ppr, nombre, caracteristicas, presentacion, unidad_medida) VALUES ${valuesSql}`,
      params
    );
    insertados += chunk.length;
    if (insertados % 10000 === 0 || insertados === registros.length) {
      console.log(`  ✓ ${insertados} / ${registros.length}`);
    }
  }

  const [{ count }] = await sql("SELECT COUNT(*)::int AS count FROM base_datos_central", []);
  const [{ distintos }] = await sql("SELECT COUNT(DISTINCT codigo_ppr)::int AS distintos FROM base_datos_central", []);
  console.log(`✅ Listo. Total filas: ${count}. codigo_ppr distintos: ${distintos}`);
}

main().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
