"use server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function celdaTexto(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function celdaNumero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function importarPac2026(formData: FormData) {
  try {
    const session = await auth();
    if (!session) return { error: "No autorizado" };
    if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };

    const file = formData.get("file") as File;
    if (!file) return { error: "No se proporcionó ningún archivo" };

    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "buffer" });
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
    const idxRenglon = findColIndex(['RENGLÓN', 'RENGLON']);
    const idxSubproducto = findColIndex(['SUB-PRODUCTO', 'SUBPRODUCTO']);
    const idxCantidad = findColIndex(['CANTIDAD', 'CANTIDAD AUTORIZADA']);
    const idxPrecioEstimado = findColIndex(['PRECIO ESTIMADO']);
    const idxMonto = findColIndex(['MONTO']);

    const rows = data.slice(1).filter(r => r && r.some && r.some(c => c !== null && c !== ''));

    // catalogo_compras tiene un índice único en (codigo_igss, subproducto) —
    // el resto del sistema (SIAF, PPR, presupuesto por renglón) confía en que
    // esa combinación resuelve siempre a un solo renglón. Un mismo PAC puede
    // traer dos filas con ese mismo par pero datos distintos (ej. varios
    // servicios con código "S/C" bajo el mismo sub-producto genérico) — antes
    // eso tumbaba el INSERT a medio archivo, y como el DELETE ya se había
    // ejecutado, dejaba el catálogo incompleto para siempre hasta el próximo
    // intento. Ahora se detecta ANTES de tocar la base de datos: una fila que
    // sea copia exacta de otra ya vista se ignora sola; el resto de choques
    // se dejan afuera y se reportan — no se les inventa un sub-producto a
    // nombre del cliente, porque eso es una decisión de ellos.
    type Fila = (typeof rows)[number];
    const porClave = new Map<string, { nombre: string; renglon: unknown }>();
    const filasValidas: Fila[] = [];
    const conflictos: string[] = [];

    for (const r of rows) {
      const codigo = celdaTexto(r[idxCodigoIgss]);
      const nombre = celdaTexto(r[idxNombre]) || "Sin nombre";
      const subproducto = celdaTexto(r[idxSubproducto]) || "000-000";
      const renglon = r[idxRenglon];
      const clave = `${codigo}::${subproducto}`;
      const existente = porClave.get(clave);
      if (!existente) {
        porClave.set(clave, { nombre, renglon });
        filasValidas.push(r);
      } else if (existente.nombre === nombre && existente.renglon === renglon) {
        // Fila repetida tal cual (mismo nombre y renglón) — no hay nada que decidir, se ignora.
      } else {
        conflictos.push(
          `Código "${codigo}" / Sub-producto "${subproducto}": "${existente.nombre}" (renglón ${existente.renglon ?? "—"}) choca con "${nombre}" (renglón ${renglon ?? "—"}) — dale a uno de los dos un sub-producto distinto en el PAC.`
        );
      }
    }

    // DELETE + todos los INSERT en una sola transacción — si algo falla a la
    // mitad, Postgres deshace todo en vez de dejar el catálogo a medio
    // reemplazar (que es justo lo que pasó sin esto).
    await db.transaction(async (tx) => {
      await tx.delete(catalogoCompras);
      const batchSize = 100;
      for (let i = 0; i < filasValidas.length; i += batchSize) {
        const batch = filasValidas.slice(i, i + batchSize).map(r => ({
          codigo_igss: celdaTexto(r[idxCodigoIgss]),
          nombre: celdaTexto(r[idxNombre]) || 'Sin nombre',
          renglon: celdaNumero(r[idxRenglon]),
          subproducto: celdaTexto(r[idxSubproducto]) || '000-000',
          cantidad: celdaNumero(r[idxCantidad]),
          precio_estimado: celdaNumero(r[idxPrecioEstimado]),
          monto: celdaNumero(r[idxMonto]),
          activo: true
        }));
        await tx.insert(catalogoCompras).values(batch);
      }
    });

    revalidatePath("/compras/catalogo");
    revalidatePath("/compras/a01-siaf");

    if (conflictos.length > 0) {
      return {
        ok: true as const,
        importadas: filasValidas.length,
        advertencia:
          `Se importaron ${filasValidas.length} de ${rows.length} filas. Estas ${conflictos.length} quedaron afuera por compartir código + sub-producto con otra fila distinta — corrígelas en el PAC (dale a cada una un sub-producto propio) y vuelve a subir el archivo para agregarlas:\n\n${conflictos.join("\n")}`,
      };
    }
    return { ok: true as const, importadas: filasValidas.length };
  } catch (error: any) {
    return { error: error.message };
  }
}
