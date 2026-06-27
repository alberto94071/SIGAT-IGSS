/**
 * Seed: Base de Datos Central (versión simplificada)
 * Fuente: Exportación SIGES
 * Ejecutar: DATABASE_URL=... npx tsx scripts/seed-base-datos.ts
 * Nota: la migración completa está en scripts/migrate-base-datos.mjs
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { baseDatosCentral } from "../src/lib/schema";

const sql = neon(process.env.DATABASE_URL!);
const db  = drizzle(sql);

type Row = typeof baseDatosCentral.$inferInsert;

const registros: Row[] = [
  { codigo_ppr:1941,  nombre:"Combustible",                              caracteristicas:"Clase: Diésel",                                             presentacion:"2269 - Envase (1 Galón)",           renglon:262 },
  { codigo_ppr:2025,  nombre:"Marcador",                                  caracteristicas:"Color: Negro; Tipo: Permanente",                            presentacion:"2336 - Unidad (1 Unidad(es))",     renglon:291 },
  { codigo_ppr:2092,  nombre:"Fastener",                                  caracteristicas:"Material: Metal",                                           presentacion:"5638 - Caja (50 Unidad(es))",      renglon:291 },
  { codigo_ppr:2191,  nombre:"Folder",                                    caracteristicas:"Clase: Manila; Tamaño: Oficio",                             presentacion:"2512 - Paquete (100 Unidad(es))",  renglon:243 },
  { codigo_ppr:2204,  nombre:"Sobre",                                     caracteristicas:"Clase: Manila; Tamaño: Oficio",                             presentacion:"29028 - Unidad (1 Unidad(es))",    renglon:243 },
  { codigo_ppr:2209,  nombre:"Archivador",                                caracteristicas:"Material: Cartón; Tamaño: Carta",                           presentacion:"2532 - Unidad (1 Unidad(es))",     renglon:244 },
  { codigo_ppr:2210,  nombre:"Archivador",                                caracteristicas:"Material: Cartón; Tamaño: Oficio",                          presentacion:"2533 - Unidad (1 Unidad(es))",     renglon:244 },
  { codigo_ppr:2212,  nombre:"Bloc adhesivo",                             caracteristicas:"Ancho: 3 Pulgadas; Largo: 3 Pulgadas; Número de hojas: 100",presentacion:"26798 - Unidad (1 Unidad(es))",   renglon:244 },
  { codigo_ppr:2845,  nombre:"Jabón",                                     caracteristicas:"Estado: Polvo",                                             presentacion:"3425 - Bolsa (20 Libra)",          renglon:292 },
  { codigo_ppr:2858,  nombre:"Jabón de tocador",                          caracteristicas:"Consistencia: Líquido; Uso: Manos",                         presentacion:"47824 - Envase (500 Mililitro)",   renglon:292 },
  { codigo_ppr:11,    nombre:"Acetaminofén (paracetamol)",                caracteristicas:"Concentración: 500mg; Forma farmacéutica: Tableta",          presentacion:"103 - Unidad (1 Unidad(es))",      renglon:266 },
  { codigo_ppr:37,    nombre:"Ácido acetilsalicílico",                    caracteristicas:"Concentración: 100mg; Forma farmacéutica: Tableta",          presentacion:"129 - Unidad (1 Unidad(es))",      renglon:266 },
  { codigo_ppr:39,    nombre:"Ácido ascórbico (vitamina C)",              caracteristicas:"Concentración: 500mg; Forma farmacéutica: Tableta",          presentacion:"131 - Unidad (1 Unidad(es))",      renglon:266 },
  { codigo_ppr:1011,  nombre:"Metformina",                                caracteristicas:"Concentración: 1000mg; Forma farmacéutica: Tableta",         presentacion:"1155 - Unidad (1 Unidad(es))",     renglon:266 },
  { codigo_ppr:37284, nombre:"Insulina glargina",                         caracteristicas:"Concentración: 100u/ml; Forma farmacéutica: Solución inyectable", presentacion:"129930 - Vial (10 Mililitro)", renglon:266 },
];

async function main() {
  console.log(`Insertando ${registros.length} registros de muestra…`);
  await db.insert(baseDatosCentral).values(registros);
  console.log("✅ Seed completado.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
