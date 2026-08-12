"use server";
import { db } from "@/lib/db";
import { posicionesImpresion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

async function requireEdit(): Promise<{ error: string } | { uid: number }> {
  const session = await auth();
  if (!session) return { error: "No autorizado" };
  if (session.user.rol === "consulta") return { error: "No tienes permiso para esta acción" };
  return { uid: Number(session.user.id) };
}

// Posiciones (mm) de los campos de formularios pre-impresos que no son el
// DAB-60 (ver dab60Posiciones/dab60-actions.ts) — Vale de Caja Chica, Cheque.
// Misma idea: el modo "Ver posiciones" arrastra cada campo sobre una imagen
// de referencia del formulario real; la posición donde se suelta queda
// guardada acá y es la que usan todas las impresiones siguientes.
export type PosGuardada = { top: number; left: number; width?: number; height?: number };

// Documentos válidos y su imagen de referencia — ambas viven en /private (no
// en /public, que Next.js sirve sin autenticación).
const FONDOS: Record<string, string> = {
  vale: "vale-fondo.jpg",
  cheque: "cheque-fondo.jpg",
};

export async function getPosicionesImpresion(documento: string): Promise<Record<string, PosGuardada>> {
  const rows = await db.select().from(posicionesImpresion).where(eq(posicionesImpresion.documento, documento));
  const out: Record<string, PosGuardada> = {};
  for (const r of rows) {
    out[r.campo] = { top: r.top, left: r.left, width: r.width ?? undefined, height: r.height ?? undefined };
  }
  return out;
}

export async function guardarPosicionesImpresion(
  documento: string,
  posiciones: Record<string, PosGuardada>,
): Promise<{ ok: true } | { error: string }> {
  const check = await requireEdit();
  if ("error" in check) return check;
  if (!FONDOS[documento]) return { error: "Documento desconocido" };

  for (const [campo, { top, left, width, height }] of Object.entries(posiciones)) {
    const values = { documento, campo, top, left, width: width ?? null, height: height ?? null };
    await db.insert(posicionesImpresion).values(values)
      .onConflictDoUpdate({
        target: [posicionesImpresion.documento, posicionesImpresion.campo],
        set: { top, left, width: values.width, height: values.height },
      });
  }
  return { ok: true };
}

// Imagen del formulario real, solo para calibrar posiciones — igual que
// getFondoDab60, exige sesión antes de devolverla como data URI.
export async function getFondoImpresion(documento: string): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  const archivo = FONDOS[documento];
  if (!archivo) return null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "private", archivo));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
