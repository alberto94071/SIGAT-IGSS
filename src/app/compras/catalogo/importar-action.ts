"use server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { celdaNumero, celdaTexto } from "@/lib/excel-utils";
import { revalidatePath } from "next/cache";

export async function importarPac2026(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { error: "No se proporcionó ningún archivo" };
    
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
    
    const headers = data[0] as string[];
    
    function findColIndex(keywords: string[]): number {
      return headers.findIndex(h => {
        if (!h) return false;
        const H = h.toUpperCase();
        return keywords.some(k => H.includes(k));
      });
    }

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

    const rows = data.slice(1).filter(r => r && r.some && r.some(c => c !== null && c !== ''));

    // Borramos todo
    await db.delete(catalogoCompras);

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map(r => ({
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

    revalidatePath("/compras/catalogo");
    revalidatePath("/compras/a01-siaf");
    return { ok: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
