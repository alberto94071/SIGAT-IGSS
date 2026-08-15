"use server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { catalogoCompras } from "@/lib/schema";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { COLUMNAS_PAC } from "./pac-columnas";

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
    if (!file || !(file instanceof File) || file.size === 0) return { error: "No se seleccionó ningún archivo." };
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return { error: `"${file.name}" no es un archivo Excel (.xlsx o .xls) — selecciona el archivo correcto del PAC.` };
    }

    let wb: XLSX.WorkBook;
    try {
      const arrayBuffer = await file.arrayBuffer();
      wb = XLSX.read(arrayBuffer, { type: "buffer" });
    } catch {
      return { error: "No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx), y que no esté dañado ni protegido con contraseña." };
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return { error: "El archivo no tiene ninguna hoja con datos." };
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
    if (data.length < 2) {
      return { error: "El archivo solo tiene encabezado (o está vacío) — no se encontró ninguna fila de insumos debajo." };
    }

    const headers = (data[0] as unknown[]).map(h => (h == null ? "" : String(h)));

    function findColIndex(keywords: string[]): number {
      return headers.findIndex(h => {
        if (!h) return false;
        const H = h.toUpperCase();
        return keywords.some(k => H.includes(k.toUpperCase()));
      });
    }

    // COLUMNAS_PAC es la misma lista que se muestra en el instructivo (ver
    // pac-columnas.ts) — una sola fuente de verdad para qué encabezados
    // reconoce el importador, así nunca se desalinean entre el código y lo
    // que el instructivo le promete al usuario.
    const idxPorClave = Object.fromEntries(
      COLUMNAS_PAC.map(c => [c.clave, findColIndex(c.nombres as unknown as string[])])
    ) as Record<typeof COLUMNAS_PAC[number]["clave"], number>;

    const idxCodigoIgss = idxPorClave.codigo_igss;
    const idxNombre = idxPorClave.nombre;
    const idxRenglon = idxPorClave.renglon;
    const idxSubproducto = idxPorClave.subproducto;
    const idxCantidad = idxPorClave.cantidad;
    const idxPrecioEstimado = idxPorClave.precio_estimado;
    const idxMonto = idxPorClave.monto;

    // Sin las columnas obligatorias no hay forma de saber a qué insumo/
    // renglón corresponde cada fila — mejor avisar exactamente cuáles faltan
    // que importar el catálogo con datos vacíos o mal ubicados en silencio.
    const columnasFaltantes = COLUMNAS_PAC
      .filter(c => c.obligatoria && idxPorClave[c.clave] === -1)
      .map(c => `"${c.nombres[0]}"`);
    if (columnasFaltantes.length > 0) {
      return {
        error: `No se encontraron estas columnas en el encabezado (primera fila) del archivo: ${columnasFaltantes.join(", ")}. Revisa el instructivo para ver los nombres de columna exactos que reconoce el sistema.`,
      };
    }

    // Se excluyen filas de resumen/totales al final del archivo (sin nombre,
    // código ni sub-producto, pero con cantidad/monto llenos) — no son un
    // insumo real y antes se colaban como una fila "sin Renglón".
    const rows = data.slice(1).filter(r =>
      r && r.some && r.some(c => c !== null && c !== '') &&
      (celdaTexto(r[idxNombre]) || celdaTexto(r[idxCodigoIgss]) || celdaTexto(r[idxSubproducto]))
    );
    if (rows.length === 0) {
      return { error: "El archivo tiene encabezado pero ninguna fila con datos debajo." };
    }

    // catalogo_compras tiene un índice único en (codigo_igss, subproducto,
    // nombre) — el resto del sistema (SIAF, PPR, presupuesto por renglón)
    // confía en que esa terna resuelve siempre a un solo renglón. El PAC de
    // Guatemala reutiliza un mismo Sub-Producto como "cajón" genérico para
    // varios servicios sin código real (ej. "S/C" bajo el mismo sub-producto
    // agrupa Energía, Agua, Teléfono...), así que Código+Sub-Producto solos
    // no bastan como identidad — el nombre es el que de verdad distingue un
    // insumo de otro en esos casos. Un mismo PAC puede traer dos filas con
    // esa misma terna pero renglón distinto (dato realmente contradictorio,
    // no una convención) — antes cualquier choque tumbaba el INSERT a medio
    // archivo, y como el DELETE ya se había ejecutado, dejaba el catálogo
    // incompleto para siempre hasta el próximo intento. Ahora se detecta
    // ANTES de tocar la base de datos: una fila que sea copia exacta de otra
    // ya vista se ignora sola; el resto de choques se dejan afuera y se
    // reportan — no se les inventa un renglón a nombre del cliente, porque
    // eso es una decisión de ellos.
    type Fila = (typeof rows)[number];
    const porClave = new Map<string, { renglon: unknown }>();
    const filasValidas: Fila[] = [];
    const conflictos: string[] = [];
    // Filas que sí se importan pero con Renglón vacío/no numérico — quedan
    // guardadas, pero no se van a poder usar en Compras hasta que se les
    // asigne un renglón real (ver renglonLookupMap en renglon-utils.ts, que
    // lee esta misma columna). Se avisan aparte de los conflictos porque no
    // bloquean nada, solo quedan "incompletas".
    let filasSinRenglon = 0;

    for (const r of rows) {
      const codigo = celdaTexto(r[idxCodigoIgss]);
      const nombre = celdaTexto(r[idxNombre]) || "Sin nombre";
      const subproducto = celdaTexto(r[idxSubproducto]) || "000-000";
      const renglon = r[idxRenglon];
      const clave = `${codigo}::${subproducto}::${nombre}`;
      const existente = porClave.get(clave);
      if (!existente) {
        porClave.set(clave, { renglon });
        filasValidas.push(r);
        if (celdaNumero(renglon) === null) filasSinRenglon++;
      } else if (existente.renglon === renglon) {
        // Fila repetida tal cual — no hay nada que decidir, se ignora.
      } else {
        conflictos.push(
          `Código "${codigo}" / Sub-producto "${subproducto}" / "${nombre}": renglón ${existente.renglon ?? "—"} choca con renglón ${renglon ?? "—"} — el mismo insumo no puede tener dos renglones distintos en el mismo PAC.`
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

    const avisos: string[] = [];
    if (conflictos.length > 0) {
      avisos.push(
        `${conflictos.length} fila(s) quedaron AFUERA por compartir código + sub-producto con otra fila distinta — corrígelas en el PAC (dale a cada una un sub-producto propio) y vuelve a subir el archivo para agregarlas:\n${conflictos.join("\n")}`
      );
    }
    if (filasSinRenglon > 0) {
      avisos.push(
        `${filasSinRenglon} fila(s) se importaron sin Renglón (columna vacía o no numérica) — quedaron guardadas, pero no se van a poder usar en Compras hasta que les asignes un renglón (editando el insumo en el catálogo, o corrigiendo el PAC y volviendo a subirlo).`
      );
    }

    if (avisos.length > 0) {
      return {
        ok: true as const,
        importadas: filasValidas.length,
        advertencia: `Se importaron ${filasValidas.length} de ${rows.length} filas.\n\n${avisos.join("\n\n")}`,
      };
    }
    return { ok: true as const, importadas: filasValidas.length };
  } catch (error) {
    console.error("Error al importar PAC:", error);
    return { error: "Ocurrió un error inesperado al leer o guardar el archivo. Verifica que tenga la estructura del instructivo (mismos nombres de columna, un renglón por fila) y volvé a intentar." };
  }
}
