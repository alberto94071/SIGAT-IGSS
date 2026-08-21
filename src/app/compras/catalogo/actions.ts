"use server";
import { db } from "@/lib/db";
import { catalogoCompras, baseDatosCentral } from "@/lib/schema";
import { eq, or, and, ilike, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

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
  codigo: string; nombre: string; descripcion_igss: string | null; renglon: number | null;
};

// Busca en la Base de Datos Central, agrupado por código base (sin distinguir
// PPR/presentación todavía) — así el catálogo de la unidad solo registra QUÉ
// insumo compra, y la presentación se decide después, al generar la Orden de
// Compra o el SIAF-04, cuando ya se sabe qué puede entregar el proveedor.
//
// El "código base" que agrupa puede venir de dos columnas distintas (ver
// mismo comentario en renglon-utils.ts): "código" (el específico de una
// presentación) o, si ese insumo todavía no tiene ninguna presentación
// cargada, "código IGSS" (el compartido) — para que un insumo recién
// agregado a Base de Datos Central sin "código" propio todavía se pueda
// encontrar y elegir aquí, en vez de parecer que "no existe".
export async function buscarInsumosCentral(q: string): Promise<InsumoCentralAgrupado[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const results = await db
      .select({
        codigo:           baseDatosCentral.codigo,
        codigo_igss:      baseDatosCentral.codigo_igss,
        nombre:           baseDatosCentral.nombre,
        descripcion_igss: baseDatosCentral.descripcion_igss,
        renglon:          baseDatosCentral.renglon,
      })
      .from(baseDatosCentral)
      .where(
        and(
          or(isNotNull(baseDatosCentral.codigo), isNotNull(baseDatosCentral.codigo_igss)),
          or(
            ilike(baseDatosCentral.nombre, `%${q}%`),
            ilike(baseDatosCentral.descripcion_igss, `%${q}%`),
            ilike(baseDatosCentral.caracteristicas, `%${q}%`),
            ilike(baseDatosCentral.codigo, `%${q}%`),
            ilike(baseDatosCentral.codigo_igss, `%${q}%`),
          ),
        )
      )
      .limit(60);

    const porCodigo = new Map<string, InsumoCentralAgrupado>();
    for (const r of results) {
      const codigo = r.codigo ?? r.codigo_igss;
      if (!codigo || porCodigo.has(codigo)) continue;
      porCodigo.set(codigo, { codigo, nombre: r.nombre, descripcion_igss: r.descripcion_igss, renglon: r.renglon });
    }
    return Array.from(porCodigo.values()).slice(0, 10);
  } catch {
    return [];
  }
}

type InsumoComprasInput = {
  nombre: string;
  subproducto: string;
  cantidad: number;
  codigo_igss?: string | null;
  renglon?: number | null;
  precio_estimado?: number | null;
};

function toValues(data: InsumoComprasInput) {
  const precio = data.precio_estimado ?? null;
  return {
    nombre:          data.nombre,
    subproducto:     data.subproducto,
    cantidad:        data.cantidad,
    codigo_igss:     data.codigo_igss || null,
    renglon:         data.renglon ?? null,
    precio_estimado: data.precio_estimado ?? null,
    monto:           precio != null ? precio * data.cantidad : null,
  };
}

// El insumo debe existir en Base de Datos Central — si no está ahí, no existe
// para efectos de compras. Se valida también aquí, no solo en la UI, por si
// alguna vez se llama esta acción con un código inventado. Busca por
// "código" o "código IGSS" (ver buscarInsumosCentral arriba).
async function validarCodigoCentral(codigo: string): Promise<string | null> {
  const [existe] = await db.select({ codigo: baseDatosCentral.codigo }).from(baseDatosCentral)
    .where(or(eq(baseDatosCentral.codigo, codigo), eq(baseDatosCentral.codigo_igss, codigo))).limit(1);
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
