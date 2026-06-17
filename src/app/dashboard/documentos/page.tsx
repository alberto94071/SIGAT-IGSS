import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { pagos, movimientosBanco } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
import DocumentosClient from "./DocumentosClient";

export default async function DocumentosPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.documentos) redirect("/dashboard");

  const [pagosList, chequesList] = await Promise.all([
    db.select({
      id: pagos.id, siaf_numero: pagos.siaf_numero,
      descripcion: pagos.descripcion, monto: pagos.monto,
      estatus: pagos.estatus, numero_cheque: pagos.numero_cheque,
      numero_dab: pagos.numero_dab, proveedor: pagos.proveedor,
      cuatrimestre: pagos.cuatrimestre,
    }).from(pagos).orderBy(desc(pagos.id)).limit(200),
    db.select({
      numero_documento: movimientosBanco.numero_documento,
      tipo_documento: movimientosBanco.tipo_documento,
      beneficiario: movimientosBanco.beneficiario,
      mes: movimientosBanco.mes,
    }).from(movimientosBanco)
      .where(eq(movimientosBanco.tipo_documento, "Cheque"))
      .orderBy(desc(movimientosBanco.id)).limit(100),
  ]);

  return <DocumentosClient pagos={pagosList} cheques={chequesList} />;
}
