"use server";
import { db } from "@/lib/db";
import { catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { SIN_CODIGO } from "@/lib/adjudicacion/renglon-utils";

async function checkAuth() {
  const s = await auth();
  if (!s) throw new Error("Sin sesión");
  return s;
}

// Para las acciones de escritura (crear/editar/activar/eliminar) — el rol
// "consulta" es de solo lectura en todo el resto del sistema y aquí se le
// había quedado sin bloquear.
async function checkAuthEdit() {
  const s = await checkAuth();
  if (s.user.rol === "consulta") throw new Error("No tienes permiso para esta acción");
  return s;
}

export type InsumoCentralAgrupado = {
  codigo: string; codigoReal: boolean; nombre: string; descripcion_igss: string | null;
  caracteristicas: string | null; renglon: number | null;
};

// Busca en la Base de Datos Central, agrupado por código base (sin distinguir
// PPR/presentación todavía) — así el catálogo de la unidad solo registra QUÉ
// insumo compra, y la presentación se decide después, al generar la Orden de
// Compra o el SIAF-04, cuando ya se sabe qué puede entregar el proveedor.
//
// El "código base" que agrupa es codigo_igss cuando existe — pero solo ~15%
// de Base de Datos Central lo tiene. Para el resto (insumos sin código real,
// ej. "Mesa de conferencia", "Olla de presión") se agrupa por NOMBRE, no por
// codigo_ppr: un mismo insumo sin código puede tener docenas de
// presentaciones (tamaños, capacidades...), cada una con su propio
// codigo_ppr — agrupar por codigo_ppr las mostraba como si fueran insumos
// distintos y llenaba las 10 opciones visibles con variantes del mismo
// producto (detectado 2026-08-24: "Olla de presión" con 25+ presentaciones
// desplazaba cualquier otro resultado). El valor que se guarda para estos es
// literal "S/C" — el mismo placeholder que ya usa el resto del sistema
// (`SIN_CODIGO` en renglon-utils.ts) para "sin código real"; la
// presentación puntual se sigue eligiendo después, al generar la Orden o el
// SIAF-04 (getPprsPorItems ya sabe agrupar ese caso por nombre).
export async function buscarInsumosCentral(q: string): Promise<InsumoCentralAgrupado[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const termino = q.trim();
    const like = `%${termino}%`;
    const prefijo = `${termino}%`;
    // Agrupar EN SQL (DISTINCT ON), no después de traer un LIMIT de filas
    // planas: un solo insumo sin código real puede tener docenas de
    // presentaciones (ej. "Servidor" con 60+ filas) — con un LIMIT plano
    // esas filas por sí solas llenaban el límite entero y ningún otro
    // insumo (ej. "Servidor de almacenamiento en red") llegaba a aparecer,
    // aunque existiera (detectado 2026-08-24). DISTINCT ON se queda con la
    // fila más relevante de cada grupo (código real, o nombre normalizado
    // si no lo tiene) antes de aplicar el límite, así ningún grupo puede
    // desplazar a otro.
    const rows = await db.execute<{
      codigo_igss: string | null; nombre: string; descripcion_igss: string | null;
      caracteristicas: string | null; renglon: number | null;
    }>(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(codigo_igss, lower(nombre)))
          codigo_igss, nombre, descripcion_igss, caracteristicas, renglon,
          CASE
            WHEN codigo_igss = ${termino} OR codigo_ppr = ${termino} THEN 0
            WHEN nombre ILIKE ${prefijo} THEN 1
            WHEN codigo_igss ILIKE ${prefijo} OR codigo_ppr ILIKE ${prefijo} THEN 2
            ELSE 3
          END AS relevancia
        FROM base_datos_central
        WHERE nombre ILIKE ${like} OR descripcion_igss ILIKE ${like} OR caracteristicas ILIKE ${like}
           OR codigo_igss ILIKE ${like} OR codigo_ppr ILIKE ${like}
        ORDER BY COALESCE(codigo_igss, lower(nombre)), relevancia, nombre
      ) agrupado
      ORDER BY relevancia, nombre
      LIMIT 10
    `);

    return rows.rows.map(r => ({
      codigo: r.codigo_igss ?? SIN_CODIGO,
      codigoReal: r.codigo_igss != null,
      nombre: r.nombre, descripcion_igss: r.descripcion_igss,
      caracteristicas: r.caracteristicas, renglon: r.renglon,
    }));
  } catch {
    return [];
  }
}

type InsumoComprasInput = {
  nombre: string;
  subproducto: string;
  cantidad: number;
  codigo_igss?: string | null;
  descripcion_igss?: string | null;
  renglon?: number | null;
  precio_estimado?: number | null;
};

function toValues(data: InsumoComprasInput) {
  const precio = data.precio_estimado ?? null;
  return {
    nombre:           data.nombre,
    subproducto:      data.subproducto,
    cantidad:         data.cantidad,
    codigo_igss:      data.codigo_igss || null,
    descripcion_igss: data.descripcion_igss || null,
    renglon:          data.renglon ?? null,
    precio_estimado:  data.precio_estimado ?? null,
    monto:            precio != null ? precio * data.cantidad : null,
  };
}

// El insumo debe existir en Base de Datos Central — si no está ahí, no existe
// para efectos de compras. Se valida también aquí, no solo en la UI, por si
// alguna vez se llama esta acción con un código inventado. "S/C" es un caso
// aparte: no corresponde a ninguna fila puntual de Base de Datos Central (es
// el placeholder para insumos sin código real, ver SIN_CODIGO en
// renglon-utils.ts), así que siempre se acepta sin buscarlo ahí.
async function validarCodigoCentral(codigo: string): Promise<string | null> {
  if (codigo === SIN_CODIGO) return null;
  const [existe] = await db.select({ codigo_igss: baseDatosCentral.codigo_igss }).from(baseDatosCentral)
    .where(eq(baseDatosCentral.codigo_igss, codigo)).limit(1);
  return existe ? null : `El código "${codigo}" no existe en Base de Datos Central`;
}

// Código de Postgres para "viola una restricción única" — catalogo_compras
// tiene un índice único en (codigo_igss, subproducto) (ver schema.ts). Sin
// esto, intentar agregar el mismo código+subproducto dos veces se veía como
// un "Error al crear el insumo" genérico, sin decir por qué.
const UNIQUE_VIOLATION = "23505";

function esCodigoSubproductoDuplicado(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === UNIQUE_VIOLATION;
}

export async function crearInsumoCompras(data: InsumoComprasInput): Promise<
  { insumo: typeof catalogoCompras.$inferSelect } | { error: string }
> {
  try {
    await checkAuthEdit();
    if (!data.nombre.trim()) return { error: "El nombre es obligatorio" };
    if (!data.subproducto.trim()) return { error: "El subproducto es obligatorio" };
    if (!(data.cantidad > 0)) return { error: "Ingresa una cantidad válida" };
    if (!data.codigo_igss?.trim()) return { error: "Debes elegir el insumo desde Base de Datos Central" };
    const errCodigo = await validarCodigoCentral(data.codigo_igss.trim());
    if (errCodigo) return { error: errCodigo };

    const [row] = await db.insert(catalogoCompras).values({
      ...toValues(data),
      activo: true,
    }).returning();
    return { insumo: row };
  } catch (e) {
    if (esCodigoSubproductoDuplicado(e)) {
      return { error: `Ya existe un insumo en el catálogo con el código "${data.codigo_igss}" y el subproducto "${data.subproducto.trim()}".` };
    }
    return { error: "Error al crear el insumo" };
  }
}

export async function editarInsumoCompras(id: number, data: InsumoComprasInput): Promise<{ ok: true } | { error: string }> {
  try {
    await checkAuthEdit();
    if (!data.nombre.trim()) return { error: "El nombre es obligatorio" };
    if (!data.subproducto.trim()) return { error: "El subproducto es obligatorio" };
    if (!(data.cantidad > 0)) return { error: "Ingresa una cantidad válida" };

    // Solo revalidar contra Base de Datos Central si el código realmente
    // cambió. Hay insumos del catálogo (ej. servicios como "Arrendamiento de
    // Inmuebles") que se cargaron sin pasar por Base de Datos Central y no
    // tienen contraparte ahí — sin esto, cualquier edición de esas filas
    // (aunque solo fuera para ajustar la cantidad autorizada) quedaba
    // bloqueada con "El código no existe en Base de Datos Central".
    const [actual] = await db.select({ codigo_igss: catalogoCompras.codigo_igss })
      .from(catalogoCompras).where(eq(catalogoCompras.id, id)).limit(1);
    const codigoNuevo = data.codigo_igss?.trim() || null;
    if (codigoNuevo && codigoNuevo !== actual?.codigo_igss) {
      const errCodigo = await validarCodigoCentral(codigoNuevo);
      if (errCodigo) return { error: errCodigo };
    }

    await db.update(catalogoCompras).set(toValues(data)).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch (e) {
    if (esCodigoSubproductoDuplicado(e)) {
      return { error: `Ya existe otro insumo en el catálogo con el código "${data.codigo_igss}" y el subproducto "${data.subproducto.trim()}".` };
    }
    return { error: "Error al editar" };
  }
}

export async function toggleInsumoCompras(id: number, activo: boolean): Promise<{ ok: true } | { error: string }> {
  try {
    await checkAuthEdit();
    await db.update(catalogoCompras).set({ activo }).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estado" };
  }
}

export async function eliminarInsumoCompras(id: number): Promise<{ ok: true } | { error: string }> {
  try {
    await checkAuthEdit();
    await db.delete(catalogoCompras).where(eq(catalogoCompras.id, id));
    return { ok: true };
  } catch (e: any) {
    if (e.message?.includes('violates foreign key constraint')) {
      return { error: "No se puede eliminar porque este producto ya se usó en una orden o solicitud." };
    }
    return { error: "Error al eliminar el insumo" };
  }
}
