import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configuracion } from "@/lib/schema";
import { getVoucher } from "@/lib/vale-actions";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
import ImprimirVoucherClient from "./ImprimirVoucherClient";

export default async function ImprimirVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const vale = await getVoucher(Number(id));
  if (!vale || !vale.numero_cheque) notFound();

  const [config] = await db.select().from(configuracion).limit(1);
  const monto = vale.monto_autorizado ?? vale.monto;

  return (
    <ImprimirVoucherClient
      vale={vale}
      montoEnLetras={montoEnLetras(monto)}
      municipio={config?.municipio ?? "Tacaná, San Marcos"}
      codigoContable={config?.codigo_contable ?? "12.07.04"}
    />
  );
}
