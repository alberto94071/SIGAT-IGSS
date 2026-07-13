import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { sql as drizzleSql } from "drizzle-orm";
import XLSX from 'xlsx';

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const neonSql = neon(DB);
const db = drizzle(neonSql);

// Definición inline de la tabla para evitar compilación TS
const baseDatosCentral = pgTable("base_datos_central", {
  id:              serial("id").primaryKey(),
  codigo_igss:     text("codigo_igss"),
  descripcion_igss: text("descripcion_igss"),
  codigo:          text("codigo"),
  codigo_ppr:      integer("codigo_ppr"),
  nombre:          text("nombre").notNull(),
  caracteristicas: text("caracteristicas"),
  presentacion:    text("presentacion"),
  unidad_medida:   text("unidad_medida"),
  codigo_rango:    text("codigo_rango"),
  renglon:         integer("renglon"),
  activo:          boolean("activo").notNull().default(true),
});

async function main() {
  try {
    console.log("📖 Leyendo archivo Excel...");
    const workbook = XLSX.readFile('C:/Users/elvis.rodriguez/Downloads/Insumos Homologados 2026.xlsx');
    
    // 1. Procesar Hoja 'Apertura' (58,800+ filas)
    const aperturaSheet = workbook.Sheets['Apertura'];
    if (!aperturaSheet) {
      throw new Error("No se encontró la hoja 'Apertura' en el archivo Excel");
    }
    const aperturaData = XLSX.utils.sheet_to_json(aperturaSheet, { header: 1 });
    console.log(`✓ Leída hoja 'Apertura'. Filas encontradas: ${aperturaData.length}`);

    // 2. Procesar Hoja 'Hoja1' (14 filas)
    const hoja1Sheet = workbook.Sheets['Hoja1'];
    let hoja1Data = [];
    if (hoja1Sheet) {
      hoja1Data = XLSX.utils.sheet_to_json(hoja1Sheet, { header: 1 });
      console.log(`✓ Leída hoja 'Hoja1'. Filas encontradas: ${hoja1Data.length}`);
    }

    const registros = [];

    // Mapear Hoja Apertura (saltamos la cabecera en fila 0)
    for (let i = 1; i < aperturaData.length; i++) {
      const row = aperturaData[i];
      if (!row || row.length === 0) continue;

      let renglon = null;
      if (row[0] !== undefined && row[0] !== null && row[0] !== '') {
        const val = Number(row[0]);
        if (!isNaN(val)) renglon = val;
      }

      const codigo_igss = row[1] !== undefined && row[1] !== null && row[1] !== '' ? String(row[1]).trim() : null;
      const descripcion_igss = row[2] !== undefined && row[2] !== null && row[2] !== '' ? String(row[2]).trim() : null;
      const codigo = row[3] !== undefined && row[3] !== null && row[3] !== '' ? String(row[3]).trim() : null;

      let codigo_ppr = null;
      if (row[4] !== undefined && row[4] !== null && row[4] !== '') {
        const val = Number(row[4]);
        if (!isNaN(val)) codigo_ppr = val;
      }
      
      let nombre = row[5] ? String(row[5]).trim() : '';
      if (!nombre && row[2]) {
        nombre = String(row[2]).trim();
      }

      if (!nombre) continue; // Nombre obligatorio

      const caracteristicas = row[6] !== undefined && row[6] !== null && row[6] !== '' ? String(row[6]).trim() : null;
      const presentacion = row[7] !== undefined && row[7] !== null && row[7] !== '' ? String(row[7]).trim() : null;
      const unidad_medida = row[8] !== undefined && row[8] !== null && row[8] !== '' ? String(row[8]).trim() : null;

      registros.push({
        codigo_igss,
        descripcion_igss,
        codigo,
        codigo_ppr,
        nombre,
        caracteristicas,
        presentacion,
        unidad_medida,
        renglon,
        activo: true
      });
    }

    // Mapear Hoja1 (no tiene cabecera, todas las filas son datos)
    for (let i = 0; i < hoja1Data.length; i++) {
      const row = hoja1Data[i];
      if (!row || row.length === 0) continue;

      let renglon = null;
      if (row[0] !== undefined && row[0] !== null && row[0] !== '') {
        const val = Number(row[0]);
        if (!isNaN(val)) renglon = val;
      }

      const codigo_igss = row[1] !== undefined && row[1] !== null && row[1] !== '' ? String(row[1]).trim() : null;
      const nombre = row[2] ? String(row[2]).trim() : null;

      if (!nombre) continue;

      // Evitar duplicados exactos de Hoja1 que ya estén cargados de Apertura
      const yaExiste = registros.some(r => r.codigo_igss === codigo_igss && r.nombre === nombre);
      if (!yaExiste) {
        registros.push({
          codigo_igss,
          descripcion_igss: null,
          codigo: null,
          codigo_ppr: null,
          nombre,
          caracteristicas: null,
          presentacion: null,
          unidad_medida: null,
          renglon,
          activo: true
        });
      }
    }

    console.log(`✓ Total registros únicos y válidos para insertar: ${registros.length}`);

    console.log("🛠️ Asegurando que las columnas de la base de datos existan...");
    await db.execute(drizzleSql`ALTER TABLE base_datos_central ALTER COLUMN codigo_igss TYPE TEXT USING codigo_igss::text`);
    await db.execute(drizzleSql`ALTER TABLE base_datos_central ADD COLUMN IF NOT EXISTS descripcion_igss TEXT`);
    await db.execute(drizzleSql`ALTER TABLE base_datos_central ADD COLUMN IF NOT EXISTS codigo TEXT`);
    await db.execute(drizzleSql`ALTER TABLE base_datos_central ADD COLUMN IF NOT EXISTS unidad_medida TEXT`);
    
    console.log("🗑️ Vaciando la tabla base_datos_central...");
    await db.execute(drizzleSql`TRUNCATE TABLE base_datos_central RESTART IDENTITY CASCADE`);

    console.log("📥 Insertando registros en lotes...");
    const BATCH_SIZE = 500;
    let insertados = 0;
    
    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const chunk = registros.slice(i, i + BATCH_SIZE);
      await db.insert(baseDatosCentral).values(chunk);
      insertados += chunk.length;
      if (insertados % 5000 === 0 || insertados === registros.length) {
        console.log(`  ✓ Insertados ${insertados} / ${registros.length} registros...`);
      }
    }

    console.log("✅ Importación completada con éxito.");
    
    const [{ count }] = await neonSql`SELECT COUNT(*)::int AS count FROM base_datos_central`;
    console.log(`📊 Total registros actuales en base_datos_central: ${count}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la importación:", error);
    process.exit(1);
  }
}

main();
