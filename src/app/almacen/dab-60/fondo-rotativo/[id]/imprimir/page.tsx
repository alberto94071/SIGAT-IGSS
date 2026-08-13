import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fondoRotativoPagos, consolidaciones, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { gruposRenglonDeConsolidacion, siafCorrelativosDeConsolidacion } from "@/lib/adjudicacion/renglon-utils";
import { getPosicionesDab60 } from "@/lib/adjudicacion/dab60-actions";
import ImprimirDab60Client from "../../../[id]/imprimir/ImprimirDab60Client";

interface Props { params: Promise<{ id: string }> }

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

// Mismo talonario físico DAB-60 que Almacén/Compromiso, pero para pagos
// Regularizados de Fondo Rotativo — no tienen Orden de Compra ni Compromiso,
// así que se reutiliza el mismo componente de impresión con esos campos
// adaptados desde consolidaciones/fondo_rotativo_pagos.
export default async function ImprimirDab60FondoRotativoPage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [pago] = await db.select().from(fondoRotativoPagos).where(eq(fondoRotativoPagos.id, Number(id))).limit(1);
  if (!pago || !pago.dab60_generado_en) notFound();

  const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, pago.consolidacion_id)).limit(1);
  if (!con) notFound();

  const [renglones, a01SiafCorrelativos, config, posicionesGuardadas] = await Promise.all([
    gruposRenglonDeConsolidacion(con.id),
    siafCorrelativosDeConsolidacion(con.id),
    db.select().from(configuracion).limit(1),
    getPosicionesDab60(),
  ]);

  const cfg = config[0];
  const renglonesUnicos = [...new Set(renglones.map(r => r.renglon).filter((r): r is number => r != null))];
  const descripcion = [...new Set(renglones.map(r => r.nombre.trim()).filter(Boolean))].join("; ");
  const fecha = con.a04_fecha ?? con.fecha;
  const numeroA04 = con.numero_a04 != null && con.anio_a04 != null ? `${con.numero_a04}/${con.anio_a04}` : "—";

  const orden = {
    id: pago.id, numero: con.numero_a04 ?? 0, anio: con.anio_a04 ?? new Date().getFullYear(),
    fecha, tipo_compra: con.tipo_compra ?? "Regularizado",
    proveedor_nit: con.proveedor_nit, proveedor_nombre: con.proveedor_nombre, total: con.total,
    no_compromiso: null,
    no_recibo_almacen: pago.dab60_no_recibo_almacen, serie_recibo_almacen: pago.dab60_serie_recibo_almacen,
    encargado_almacen: pago.dab60_encargado_almacen,
    fecha_ingreso_producto: pago.dab60_fecha_ingreso_producto,
    no_factura: pago.no_factura, serie_factura: pago.serie_factura, fecha_emision: pago.fecha_emision_factura,
    lote: pago.dab60_lote, fecha_vencimiento: pago.dab60_fecha_vencimiento,
    marca: pago.dab60_marca, modelo: pago.dab60_modelo, serie: pago.dab60_serie,
  };

  const datos = {
    lugarFecha: cfg ? `${cfg.municipio}, ${fechaLarga(fecha)}` : fechaLarga(fecha),
    dependencia: cfg ? `${cfg.codigo_contable}-${cfg.nombre_unidad}`.toUpperCase() : "",
    claveAdministrativa: cfg?.codigo_centro_costo ?? "",
    ordenCompra: `A-04 ${numeroA04}`,
    a01Siaf: a01SiafCorrelativos.join(", "),
    metodoCompra: con.tipo_compra ?? "Regularizado",
    renglon: renglonesUnicos.join(", "),
    descripcion,
  };

  return (
    <ImprimirDab60Client
      orden={orden as any}
      renglones={renglones as any}
      datos={datos}
      posicionesGuardadas={posicionesGuardadas}
      tituloOverride={`A-04 ${numeroA04}`}
    />
  );
}
