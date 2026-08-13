import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fondoRotativoPagos, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import ImprimirVoucherBancosClient from "./ImprimirVoucherBancosClient";

export default async function ImprimirVoucherBancosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [pago, config, posicionesGuardadas] = await Promise.all([
    db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, Number(id))).limit(1).then(r => r[0]),
    db.select().from(configuracion).limit(1).then(r => r[0]),
    getPosicionesImpresion("cheque"),
  ]);
  if (!pago || !pago.numero_cheque || pago.estado !== "Enviado a Bancos") notFound();

  return (
    <ImprimirVoucherBancosClient
      pago={{
        numero_cheque: pago.numero_cheque,
        fecha_emision_cheque: pago.fecha_emision_cheque,
        monto_cheque: pago.monto_cheque ?? 0,
        monto_letras: pago.monto_letras ?? "",
        destinatario_nombre: pago.destinatario_nombre ?? "",
        concepto_voucher: pago.concepto_voucher ?? "",
        numero_a04: null, anio_a04: null,
      }}
      municipio={config?.municipio ?? "Tacaná, San Marcos"}
      codigoContable={config?.codigo_contable ?? "12.07.04"}
      solicitante={config?.nombre_solicitante ?? ""}
      jefe={config?.nombre_encargado_unidad ?? ""}
      posicionesGuardadas={posicionesGuardadas}
    />
  );
}
