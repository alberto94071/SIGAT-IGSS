import * as XLSX from 'xlsx';
import { db } from '../src/lib/db';
import { catalogoCompras } from '../src/lib/schema';
import { celdaNumero, celdaTexto } from '../src/lib/excel-utils';

async function main() {
  console.log("Leyendo archivo Excel...");
  const filePath = 'C:\\Users\\alber\\Downloads\\PAC 2026-412.xlsx';
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  
  const headers = data[0] as string[];
  console.log("Encabezados encontrados:", headers);

  // Encontrar índices de columnas
  function findColIndex(keywords: string[]): number {
    return headers.findIndex(h => {
      if (!h) return false;
      const H = h.toUpperCase();
      return keywords.some(k => H.includes(k));
    });
  }

  const idxUg = findColIndex(['UG']);
  const idxCc = findColIndex(['C.C.', 'CC']);
  const idxEstructura = findColIndex(['ESTRUCTURA PROGRAMATICA', 'ESTRUCTURA']);
  const idxCodigoIgss = findColIndex(['CÓDIGO IGSS', 'CODIGO IGSS']);
  const idxNombre = findColIndex(['NOMBRE GENÉRICO', 'NOMBRE GENERICO', 'NOMBRE DEL INSUMO', 'NOMBRE']);
  const idxCodigoNombrePpr = findColIndex(['CÓDIGO NOMBRE PPR', 'CODIGO NOMBRE PPR']);
  const idxNombrePpr = findColIndex(['NOMBRE PPR']);
  const idxCodigoPresPpr = findColIndex(['CÓDIGO PRESENTACIÓN PPR', 'CODIGO PRESENTACION PPR']);
  const idxUnidadMedida = findColIndex(['UNIDAD DE MEDIDA']);
  const idxRenglon = findColIndex(['RENGLÓN', 'RENGLON']);
  const idxSubproducto = findColIndex(['SUB-PRODUCTO', 'SUBPRODUCTO']);
  const idxCantidad = findColIndex(['CANTIDAD', 'CANTIDAD AUTORIZADA']);
  const idxPrecioEstimado = findColIndex(['PRECIO ESTIMADO']);
  const idxMonto = findColIndex(['MONTO']);

  console.log("Índices detectados:", {
    ug: idxUg, cc: idxCc, estructura: idxEstructura, codigoIgss: idxCodigoIgss, nombre: idxNombre,
    codigoNombrePpr: idxCodigoNombrePpr, nombrePpr: idxNombrePpr, codigoPresPpr: idxCodigoPresPpr,
    unidadMedida: idxUnidadMedida, renglon: idxRenglon, subproducto: idxSubproducto,
    cantidad: idxCantidad, precioEstimado: idxPrecioEstimado, monto: idxMonto
  });

  const rows = data.slice(1).filter(r => r.some(c => c !== null && c !== ''));

  console.log(`Borrando catálogo actual...`);
  await db.delete(catalogoCompras);

  const batchSize = 100;
  console.log(`Insertando ${rows.length} registros...`);
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => ({
      ug: celdaNumero(r[idxUg]),
      cc: celdaNumero(r[idxCc]),
      estructura_programatica: celdaTexto(r[idxEstructura]),
      codigo_igss: celdaTexto(r[idxCodigoIgss]),
      nombre: celdaTexto(r[idxNombre]) || 'Sin nombre',
      codigo_nombre_ppr: celdaNumero(r[idxCodigoNombrePpr]),
      nombre_ppr: celdaTexto(r[idxNombrePpr]),
      codigo_presentacion_ppr: celdaNumero(r[idxCodigoPresPpr]),
      unidad_medida: celdaTexto(r[idxUnidadMedida]),
      renglon: celdaNumero(r[idxRenglon]),
      subproducto: celdaTexto(r[idxSubproducto]) || '000-000',
      cantidad: celdaNumero(r[idxCantidad]),
      precio_estimado: celdaNumero(r[idxPrecioEstimado]),
      monto: celdaNumero(r[idxMonto]),
      activo: true
    }));
    await db.insert(catalogoCompras).values(batch);
  }

  console.log("¡Importación completada!");
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
