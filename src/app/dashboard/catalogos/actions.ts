"use server";
import { db } from "@/lib/db";
import { catalogoInsumos, auditLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { type Rol } from "@/lib/permisos";

async function getMe() {
  const s = await auth();
  return s ? { id: Number(s.user.id), rol: s.user.rol as Rol } : null;
}

export async function crearInsumo(data: any) {
  try {
    const me = await getMe();
    if (!me || (me.rol !== "superadmin" && me.rol !== "admin")) return { error: "Sin permiso" };

    const [nuevo] = await db.insert(catalogoInsumos).values({
      codigo_igss:         data.codigo_igss,
      codigo_ppr:          data.codigo_ppr || null,
      codigo_minfin:       data.codigo_minfin || null,
      nombre:              data.nombre,
      caracteristicas:     data.caracteristicas || null,
      presentacion:        data.presentacion || null,
      unidad_medida:       data.unidad_medida || null,
      subproducto:         data.subproducto || null,
      cantidad_solicitada: data.cantidad_solicitada || null,
      activo:              true,
    }).returning();
    return { insumo: nuevo };
  } catch (e: any) {
    if (e.message?.includes("unique")) return { error: "El código IGSS ya existe" };
    return { error: "Error al crear el insumo" };
  }
}

export async function editarInsumo(data: any) {
  try {
    const me = await getMe();
    if (!me || (me.rol !== "superadmin" && me.rol !== "admin")) return { error: "Sin permiso" };

    await db.update(catalogoInsumos).set({
      codigo_igss:         data.codigo_igss,
      codigo_ppr:          data.codigo_ppr || null,
      codigo_minfin:       data.codigo_minfin || null,
      nombre:              data.nombre,
      caracteristicas:     data.caracteristicas || null,
      presentacion:        data.presentacion || null,
      unidad_medida:       data.unidad_medida || null,
      subproducto:         data.subproducto || null,
      cantidad_solicitada: data.cantidad_solicitada || null,
    }).where(eq(catalogoInsumos.id, data.id));
    return { ok: true };
  } catch {
    return { error: "Error al editar el insumo" };
  }
}

export async function toggleInsumo(data: { id: number; activo: boolean }) {
  try {
    const me = await getMe();
    if (!me || (me.rol !== "superadmin" && me.rol !== "admin")) return { error: "Sin permiso" };

    await db.update(catalogoInsumos)
      .set({ activo: data.activo })
      .where(eq(catalogoInsumos.id, data.id));

    await db.insert(auditLog).values({
      usuario_id: me.id,
      accion:     data.activo ? "habilitar_insumo" : "deshabilitar_insumo",
      tabla:      "catalogo_insumos",
      registro_id:data.id,
    });
    return { ok: true };
  } catch {
    return { error: "Error al cambiar estado" };
  }
}
