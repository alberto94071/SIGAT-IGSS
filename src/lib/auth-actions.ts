"use server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq, or } from "drizzle-orm";
import { MAX_INTENTOS_FALLIDOS } from "@/lib/auth";

export type EstadoLogin =
  | { bloqueado: true; segundosRestantes: number }
  | { bloqueado: false; intentosRestantes: number };

// Se consulta desde LoginClient.tsx justo después de un intento de login
// fallido, para distinguir "contraseña incorrecta, te quedan N intentos" de
// "cuenta bloqueada temporalmente, faltan X:XX" — antes ambos casos mostraban
// el mismo mensaje genérico ("Credenciales incorrectas"), lo que hacía que
// usuarios bloqueados siguieran reintentando sin saber que estaban
// bloqueados, reiniciando el bloqueo cada vez (reportado por el cliente
// 2026-08-25). Lee intentos_fallidos/bloqueado_hasta directo de la fila del
// usuario — la misma fuente de verdad que actualiza `authorize()` en auth.ts.
export async function estadoLoginUsuario(identificador: string): Promise<EstadoLogin> {
  const [user] = await db.select({
    intentos_fallidos: usuarios.intentos_fallidos, bloqueado_hasta: usuarios.bloqueado_hasta,
  }).from(usuarios).where(or(eq(usuarios.email, identificador), eq(usuarios.ibm, identificador))).limit(1);

  if (user?.bloqueado_hasta) {
    const restanteMs = new Date(user.bloqueado_hasta).getTime() - Date.now();
    if (restanteMs > 0) return { bloqueado: true, segundosRestantes: Math.ceil(restanteMs / 1000) };
  }
  return { bloqueado: false, intentosRestantes: Math.max(0, MAX_INTENTOS_FALLIDOS - (user?.intentos_fallidos ?? 0)) };
}
