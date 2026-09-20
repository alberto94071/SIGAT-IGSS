import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { viaticoPagos, viaticoSolicitudes, configuracion } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { getPosicionesImpresion } from "@/lib/impresion-posiciones-actions";
import { getLibroBancosCompleto } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import { montoEnLetras } from "@/lib/adjudicacion/deletreo";
import ImprimirVoucherBancosClient from "../../../[id]/imprimir/ImprimirVoucherBancosClient";

// Voucher de un cheque de Viáticos — no existía ninguna ruta de impresión
// para esto (los viáticos completan sus datos de cheque enteros en Fondo
// Rotativo/Pagos, nunca pasan por "Completar cheque y Voucher" de
// compras, así que nunca cayeron en esa pantalla). Mismo talonario físico
// ("cheque") y mismo Client que el Voucher de compras — solo cambia de
// dónde se leen los datos. Igual que compras (2026-09-20), agrupa por
// numero_cheque: si el mismo cheque paga varios V-L, imprime un solo
// Voucher con todas las descripciones.
export default async function ImprimirVoucherViaticoBancosPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [pago] = await db.select().from(viaticoPagos).where(eq(viaticoPagos.id, Number(id))).limit(1);
  if (!pago || !pago.numero_cheque) notFound();

  const [grupoRaw, config, posicionesGuardadas, libroBancos] = await Promise.all([
    db.select().from(viaticoPagos).where(eq(viaticoPagos.numero_cheque, pago.numero_cheque)).orderBy(viaticoPagos.id),
    db.select().from(configuracion).limit(1).then(r => r[0]),
    getPosicionesImpresion("cheque"),
    getLibroBancosCompleto(),
  ]);

  const solicitudIds = grupoRaw.map(r => r.viatico_solicitud_id);
  const solicitudes = solicitudIds.length > 0
    ? await db.select({ id: viaticoSolicitudes.id, numero_formulario: viaticoSolicitudes.numero_formulario })
        .from(viaticoSolicitudes).where(inArray(viaticoSolicitudes.id, solicitudIds))
    : [];
  const numeroFormularioMap = new Map(solicitudes.map(s => [s.id, s.numero_formulario]));
  const grupo = grupoRaw.map(r => ({ ...r, numero_formulario: numeroFormularioMap.get(r.viatico_solicitud_id) ?? null }));

  const montoTotal = grupo.reduce((s, r) => s + r.total, 0);
  // Mismo formato que la Descripción de Bancos/Libro Bancos para viáticos
  // (ver fondo-rotativo-pagos-actions.ts), una línea por V-L pagado con
  // este cheque.
  const conceptoCombinado = grupo.map(r => `Pago de Formulario No. ${r.numero_formulario ?? "—"}`).join("; ");
  const numerosFormulario = grupo.map(r => r.numero_formulario).filter((x): x is string => !!x).join(", ");
  const beneficiarios = [...new Set(grupo.map(r => r.destinatario_nombre).filter((x): x is string => !!x))];
  const nits = [...new Set(grupo.map(r => r.nit_beneficiario).filter((x): x is string => !!x))];
  const tiposDocumento = [...new Set(grupo.map(r => r.tipo_documento_pago).filter((t): t is string => !!t))];

  // Saldo antes/después del efecto neto de este cheque (todos sus V-L
  // enlazados) — mismo criterio que el Voucher de compras: se busca en
  // Libro Bancos (que ya mezcla viáticos y compras en la misma línea de
  // tiempo, ver Fase F de Viáticos) la posición más temprana y más tardía
  // del grupo, filtrando por origen "viatico" para no cruzarse con un
  // pago de compra que por casualidad comparta el mismo id.
  const movimientosGrupo = grupo
    .map(r => libroBancos.find(m => m.pagoId === r.id && m.origen === "viatico"))
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
        no_factura: numerosFormulario,
        serie_factura: "",
        nit_beneficiario: nits.join(" / ") || null,
        origen: "viatico",
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
