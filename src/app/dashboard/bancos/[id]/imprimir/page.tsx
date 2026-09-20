import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fondoRotativoPagos, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
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

  // Un mismo cheque físico puede cubrir varias facturas — Fondo Rotativo/
  // Pagos no tiene selección múltiple (ver CLAUDE.md), así que el encargado
  // asigna el mismo número de cheque a cada pago por separado. El cliente
  // pidió que, al imprimir, salga UN solo Voucher con la descripción de
  // TODO lo que se pagó con ese cheque, no uno por pago (2026-09-20). Se
  // agrupan acá todos los `fondo_rotativo_pagos` con el mismo `numero_
  // cheque` — cualquiera de sus ids que se use en la URL llega al mismo
  // Voucher combinado.
  const grupo = await db.select().from(fondoRotativoPagos)
    .where(eq(fondoRotativoPagos.numero_cheque, pago.numero_cheque))
    .orderBy(fondoRotativoPagos.id);

  const montoTotal = grupo.reduce((s, r) => s + (r.monto_cheque ?? 0), 0);
  // Mismo formato que la Descripción de Fondo Rotativo/Bancos y Libro Bancos
  // (ver fondo-rotativo-pagos-actions.ts) — una línea por factura pagada con
  // este cheque, reemplaza el concepto_voucher libre de cada pago individual.
  const conceptoCombinado = grupo.map(r => `Pago de Factura No. ${r.no_factura} y Serie: ${r.serie_factura}`).join("; ");
  const facturas = grupo.filter(r => r.tipo_documento_pago === "Factura");
  const tiposDocumento = [...new Set(grupo.map(r => r.tipo_documento_pago).filter((t): t is string => !!t))];
  const beneficiarios = [...new Set(grupo.map(r => r.destinatario_nombre).filter((x): x is string => !!x))];
  const nits = [...new Set(grupo.map(r => r.nit_beneficiario).filter((x): x is string => !!x))];

  // Saldo antes/después del efecto NETO de este cheque (todos sus pagos
  // enlazados), no solo del pago puntual que trajo la URL — se busca la
  // posición más temprana y más tardía del grupo dentro de Libro Bancos
  // (mismo orden cronológico ya calculado ahí, ver getLibroBancosCompleto)
  // para no desincronizarse de esa fuente ni recalcular el saldo aparte.
  const movimientosGrupo = grupo
    .map(r => libroBancos.find(m => m.pagoId === r.id && m.origen === "compra"))
    .filter((m): m is NonNullable<typeof m> => m != null);
  const indices = movimientosGrupo.map(m => libroBancos.indexOf(m));
  const primero = indices.length > 0 ? libroBancos[Math.min(...indices)] : null;
  const ultimo = indices.length > 0 ? libroBancos[Math.max(...indices)] : null;
  const saldoAnterior = primero ? primero.saldo + primero.debe - primero.haber : null;
  const saldoNuevo = ultimo?.saldo ?? null;

  return (
    <ImprimirVoucherBancosClient
      pago={{
        numero_cheque: pago.numero_cheque,
        fecha_emision_cheque: pago.fecha_emision_cheque,
        monto_cheque: montoTotal,
        monto_letras: montoEnLetras(montoTotal),
        destinatario_nombre: beneficiarios.join(" / "),
        concepto_voucher: conceptoCombinado,
        numero_a04: null, anio_a04: null,
        tipo_documento_pago: tiposDocumento.join(" / ") || null,
        no_factura: facturas.map(r => r.no_factura).join(", "),
        serie_factura: facturas.map(r => r.serie_factura).join(", "),
        nit_beneficiario: nits.join(" / ") || null,
      }}
      municipio={config?.municipio ?? "Tacaná, San Marcos"}
      bancoNombre={config?.banco_nombre ?? ""}
      cuentaNumero={config?.cuenta_numero ?? ""}
      cuentaNombre={config?.cuenta_nombre ?? ""}
      saldoAnterior={saldoAnterior}
      saldoNuevo={saldoNuevo}
      posicionesGuardadas={posicionesGuardadas}
    />
  );
}
