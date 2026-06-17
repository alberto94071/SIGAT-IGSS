import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { movimientosBanco, pagos, cajaChica } from "@/lib/schema";
import { eq, and, sum, sql, asc } from "drizzle-orm";
import ReportesClient from "./ReportesClient";

export default async function ReportesPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.reportes) redirect("/dashboard");

  const [banco, pagosList, cajaList] = await Promise.all([
    db.select().from(movimientosBanco).orderBy(asc(movimientosBanco.id)),
    db.select({
      id: pagos.id, siaf_numero: pagos.siaf_numero,
      descripcion: pagos.descripcion, monto: pagos.monto,
      estatus: pagos.estatus, cuatrimestre: pagos.cuatrimestre,
      numero_cheque: pagos.numero_cheque, proveedor: pagos.proveedor,
      fecha_pagado: pagos.fecha_pagado, renglon: pagos.renglon,
    }).from(pagos).orderBy(asc(pagos.id)),
    db.select().from(cajaChica).orderBy(asc(cajaChica.id)),
  ]);

  return <ReportesClient banco={banco} pagos={pagosList} cajaChica={cajaList} />;
}
