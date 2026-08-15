import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fondoRotativoPagos, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import ImprimirVoucherBancosClient from "./ImprimirVoucherBancosClient";

export default async function ImprimirVoucherBancosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [pago, config, posicionesGuardadas, libroBancos] = await Promise.all([
    db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, Number(id))).limit(1).then(r => r[0]),
    db.select().from(configuracion).limit(1).then(r => r[0]),
    getPosicionesImpresion("cheque"),
    getLibroBancosCompleto(),
  ]);
  if (!pago || !pago.numero_cheque || pago.estado !== "Enviado a Bancos") notFound();

  // El saldo corriente de este cheque específico ya lo calculó Libro Bancos
  // (mismo orden cronológico, ver getLibroBancosCompleto) — se busca por
  // pagoId en vez de recalcularlo aquí para no desincronizarse de esa fuente.
  const movimiento = libroBancos.find(m => m.pagoId === pago.id);
  const saldoNuevo = movimiento?.saldo ?? null;
  const saldoAnterior = movimiento ? movimiento.saldo + movimiento.debe - movimiento.haber : null;

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
      bancoNombre={config?.banco_nombre ?? ""}
      cuentaNumero={config?.cuenta_numero ?? ""}
      cuentaNombre={config?.cuenta_nombre ?? ""}
      saldoAnterior={saldoAnterior}
      saldoNuevo={saldoNuevo}
      posicionesGuardadas={posicionesGuardadas}
    />
  );
}
