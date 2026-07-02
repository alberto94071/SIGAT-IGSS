import { db } from "@/lib/db";
import { notificaciones } from "@/lib/schema";

export async function crearNotificacion(data: {
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  ruta?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: number | null;
}) {
  await db.insert(notificaciones).values({
    usuario_id:      data.usuario_id,
    tipo:            data.tipo,
    titulo:          data.titulo,
    mensaje:         data.mensaje,
    ruta:            data.ruta ?? null,
    referencia_tipo: data.referencia_tipo ?? null,
    referencia_id:   data.referencia_id ?? null,
  });
}
