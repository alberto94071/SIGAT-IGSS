import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parsePermisos, type Rol } from "@/lib/permisos";
import { db } from "@/lib/db";
import { pagos, movimientosBanco, configuracion, cajaChica } from "@/lib/schema";
import { eq, sum, sql, and, ne } from "drizzle-orm";
import LiquidacionClient from "./LiquidacionClient";

export default async function LiquidacionPage() {
  const session  = await auth();
  const rol      = session!.user.rol as Rol;
  const permisos = parsePermisos(session!.user.permisos, rol);
  if (!permisos.liquidacion) redirect("/dashboard");

  const [config] = await db.select().from(configuracion).limit(1);
  const montoInicial = parseFloat(config?.monto_fondo_rotativo ?? "15000");

  // Saldo banco (último movimiento)
  const [ultimoBanco] = await db
    .select({ saldo: movimientosBanco.saldo })
    .from(movimientosBanco)
    .orderBy(sql`${movimientosBanco.id} DESC`)
    .limit(1);
  const saldoBanco = parseFloat(ultimoBanco?.saldo ?? "0");

  // Fondos en circulación (pagos pendientes)
  const [pendResult] = await db
    .select({ total: sum(pagos.monto) })
    .from(pagos)
    .where(eq(pagos.estatus, "Pendiente"));
  const fondosCirculacion = parseFloat(pendResult?.total ?? "0");

  // Efectivo en caja
  const efectivo = parseFloat(config?.efectivo_caja ?? "0");

  // Lista de pagos pendientes (para la tabla de FRI)
  const pendientes = await db
    .select({
      id: pagos.id, numero_fri: pagos.numero_fri,
      descripcion: pagos.descripcion, monto: pagos.monto,
      numero_cheque: pagos.numero_cheque, proveedor: pagos.proveedor,
    })
    .from(pagos)
    .where(eq(pagos.estatus, "Pendiente"))
    .limit(20);

  // Documentos pagados no incluidos en FRI
  const nofri = await db
    .select({
      id: pagos.id, numero_oc: pagos.numero_oc,
      descripcion: pagos.descripcion, monto: pagos.monto,
      numero_cheque: pagos.numero_cheque, estatus: pagos.estatus,
    })
    .from(pagos)
    .where(and(eq(pagos.estatus, "Pagado"), sql`${pagos.numero_fri} IS NULL`))
    .limit(20);

  return (
    <LiquidacionClient
      montoInicial={montoInicial}
      saldoBanco={saldoBanco}
      efectivo={efectivo}
      fondosCirculacion={fondosCirculacion}
      pendientes={pendientes}
      nofri={nofri}
      config={config}
    />
  );
}
